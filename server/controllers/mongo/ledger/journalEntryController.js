import mongoose from 'mongoose';
import { Ledger, BillSequence, VoucherSequence } from '../../../models/index.js';

const now = () => new Date().toISOString();
const getActorUsername = (req) => req?.user?.username ?? null;

/* ── VOUCHER NUMBER ───────────────────────────────────────────────────── */

async function getNextVoucherNumber(firmId, voucherType) {
  const d = new Date();
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();
  const financialYear = month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
  const prefixMap = { JOURNAL: 'JV', PAYMENT: 'PV', RECEIPT: 'RV', SALES: 'SI', PURCHASE: 'PI' };
  const prefix = prefixMap[voucherType] ?? voucherType.slice(0, 2);
  const seq = await BillSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: financialYear, voucher_type: voucherType },
    { $inc: { last_sequence: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}/${financialYear}/${String(seq.last_sequence).padStart(4, '0')}`;
}

async function getNextVoucherGroupId(firmId) {
  const d     = new Date();
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();
  const financialYear = month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
  const seq = await VoucherSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: financialYear },
    { $inc: { last_sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return seq.last_sequence;
}

/* ── GUARD ────────────────────────────────────────────────────────────── */

function getFirmId(req, res, tag) {
  const raw = req.user?.firm_id;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    console.error(`[${tag}] Invalid firm_id:`, raw);
    res.status(400).json({ error: 'Invalid or missing firm ID' });
    return null;
  }
  return raw;
}

/* ── SHARED LINE VALIDATION (BUG 2 FIX: extracted so create + update are consistent) ── */

function validateLines(entries) {
  if (!Array.isArray(entries) || entries.length < 2) {
    return 'At least two journal entry lines are required (double-entry bookkeeping)';
  }
  let totalDebits = 0, totalCredits = 0;
  for (let i = 0; i < entries.length; i++) {
    const e  = entries[i];
    const dr = parseFloat(e.debit_amount)  || 0;
    const cr = parseFloat(e.credit_amount) || 0;
    if (!e.account_head?.trim()) return `Line ${i + 1}: Account head is required`;
    if (dr < 0 || cr < 0)       return `Line ${i + 1}: Amounts cannot be negative`;
    if (dr > 0 && cr > 0)       return `Line ${i + 1}: A line cannot have both debit and credit amounts`;
    if (dr === 0 && cr === 0)   return `Line ${i + 1}: Either debit or credit amount is required`;
    totalDebits  += dr;
    totalCredits += cr;
  }
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    return `Entry must be balanced — Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`;
  }
  return null;
}

/* ── CREATE ───────────────────────────────────────────────────────────── */

export const createJournalEntry = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'JOURNAL_ENTRY_CREATE');
  if (!firmId) return;

  const { entries, narration, transaction_date } = req.body;
  const lineError = validateLines(entries);
  if (lineError) return res.status(400).json({ error: lineError });

  let journalEntryNo;
  try {
    journalEntryNo = await getNextVoucherNumber(firmId, 'JOURNAL');
  } catch (err) {
    return res.status(500).json({ error: `Failed to generate voucher number: ${err.message}` });
  }

  try {
    const journalEntryId       = await getNextVoucherGroupId(firmId);
    const finalTransactionDate = transaction_date || now().split('T')[0];
    const totalDebits          = entries.reduce((s, e) => s + (parseFloat(e.debit_amount)  || 0), 0);
    const totalCredits         = entries.reduce((s, e) => s + (parseFloat(e.credit_amount) || 0), 0);

    const docs = entries.map(e => ({
      firm_id:          firmId,
      voucher_id:       journalEntryId,
      voucher_type:     'JOURNAL',
      voucher_no:       journalEntryNo,
      account_head:     e.account_head.trim(),
      account_type:     e.account_type || 'GENERAL',
      debit_amount:     parseFloat(e.debit_amount)  || 0,
      credit_amount:    parseFloat(e.credit_amount) || 0,
      narration:        (e.narration || narration || `Journal Entry ${journalEntryNo}`).trim(),
      ref_type:         'JOURNAL',
      bill_id:          null,
      party_id:         null,
      stock_id:         null,
      stock_reg_id:     null,
      transaction_date: finalTransactionDate,
      created_by:       actorUsername,
    }));

    await Ledger.insertMany(docs);

    res.json({
      message: 'Journal entry created successfully',
      id: journalEntryId,        // BUG 1 FIX: expose 'id' alias
      journalEntryId,
      journalEntryNo,
      totalDebits,
      totalCredits,
    });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_CREATE] Error:', err);
    res.status(500).json({ error: 'Failed to create journal entry: ' + err.message });
  }
};

/* ── GET ALL (paginated + searchable) ────────────────────────────────── */

export const getJournalEntries = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'JOURNAL_ENTRIES_GET');
    if (!firmId) return;

    const { start_date, end_date, search, page = 1, limit = 20 } = req.query;
    const pageInt  = Math.max(1, parseInt(page)  || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const match = {
      firm_id:      new mongoose.Types.ObjectId(firmId),
      voucher_type: 'JOURNAL',
    };
    if (start_date) match.transaction_date = { ...match.transaction_date, $gte: start_date };
    if (end_date)   match.transaction_date = { ...match.transaction_date, $lte: end_date };

    // BUG 3 FIX: include account_head in search so users can find by account name
    if (search?.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      match.$or = [{ voucher_no: regex }, { narration: regex }, { account_head: regex }];
    }

    const [countAgg, rows] = await Promise.all([
      Ledger.aggregate([
        { $match: match },
        { $group: { _id: '$voucher_id' } },
        { $count: 'total' },
      ]),
      Ledger.aggregate([
        { $match: match },
        {
          $group: {
            _id:              '$voucher_id',
            voucher_id:       { $first: '$voucher_id' },
            voucher_no:       { $first: '$voucher_no' },
            transaction_date: { $first: '$transaction_date' },
            narration:        { $first: '$narration' },
            total_debit:      { $sum: '$debit_amount' },
            total_credit:     { $sum: '$credit_amount' },
            line_count:       { $sum: 1 },
          },
        },
        { $sort: { transaction_date: -1, _id: -1 } },
        { $skip:  (pageInt - 1) * limitInt },
        { $limit: limitInt },
        // BUG 1 FIX: 'id' alias — client can use entry.id reliably
        { $project: {
            _id: 0,
            id:               '$voucher_id',
            voucher_id:       1,
            voucher_no:       1,
            transaction_date: 1,
            narration:        1,
            total_debit:      1,
            total_credit:     1,
            line_count:       1,
        }},
      ]),
    ]);

    res.json({
      journalEntries: rows,
      total:          countAgg[0]?.total ?? 0,
      page:           pageInt,
      limit:          limitInt,
      totalPages:     Math.ceil((countAgg[0]?.total ?? 0) / limitInt),
    });
  } catch (err) {
    console.error('[JOURNAL_ENTRIES_GET] Error:', err);
    res.status(500).json({ error: 'Failed to fetch journal entries: ' + err.message });
  }
};

/* ── GET BY ID ────────────────────────────────────────────────────────── */

export const getJournalEntryById = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'JOURNAL_ENTRY_GET_BY_ID');
    if (!firmId) return;

    const journalEntryId = parseInt(req.params.id);
    if (isNaN(journalEntryId) || journalEntryId <= 0) {
      return res.status(400).json({ error: 'Invalid journal entry ID' });
    }

    const lines = await Ledger.find({
      voucher_id:   journalEntryId,
      firm_id:      firmId,
      voucher_type: 'JOURNAL',
    }).sort({ _id: 1 }).lean();

    if (!lines.length) {
      return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
    }

    const totalDebit  = lines.reduce((s, l) => s + (l.debit_amount  || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit_amount || 0), 0);

    res.json({
      id:               journalEntryId,
      voucher_id:       journalEntryId,
      voucher_no:       lines[0].voucher_no,
      transaction_date: lines[0].transaction_date,
      narration:        lines[0].narration,
      total_debit:      totalDebit,
      total_credit:     totalCredit,
      lines,
    });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_GET_BY_ID] Error:', err);
    res.status(500).json({ error: 'Failed to fetch journal entry: ' + err.message });
  }
};

/* ── DELETE ───────────────────────────────────────────────────────────── */

export const deleteJournalEntry = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'JOURNAL_ENTRY_DELETE');
    if (!firmId) return;

    const journalEntryId = parseInt(req.params.id);
    if (isNaN(journalEntryId) || journalEntryId <= 0) {
      return res.status(400).json({ error: 'Invalid journal entry ID' });
    }

    const exists = await Ledger.findOne({
      voucher_id: journalEntryId, firm_id: firmId, voucher_type: 'JOURNAL',
    }).lean();

    if (!exists) {
      return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
    }

    await Ledger.deleteMany({
      voucher_id: journalEntryId, firm_id: firmId, voucher_type: 'JOURNAL',
    });

    res.json({ message: 'Journal entry deleted successfully', journalEntryId });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_DELETE] Error:', err);
    res.status(500).json({ error: 'Failed to delete journal entry: ' + err.message });
  }
};

/* ── UPDATE ───────────────────────────────────────────────────────────── */

export const updateJournalEntry = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'JOURNAL_ENTRY_UPDATE');
  if (!firmId) return;

  const journalEntryId = parseInt(req.params.id);
  if (isNaN(journalEntryId) || journalEntryId <= 0) {
    return res.status(400).json({ error: 'Invalid journal entry ID' });
  }

  const { entries, narration, transaction_date } = req.body;

  // BUG 2 FIX: narration optional on update (matches create behaviour)
  if (!transaction_date) return res.status(400).json({ error: 'Transaction date is required' });

  const lineError = validateLines(entries);
  if (lineError) return res.status(400).json({ error: lineError });

  try {
    const existing = await Ledger.findOne({
      voucher_id: journalEntryId, firm_id: firmId, voucher_type: 'JOURNAL',
    }).lean();

    if (!existing) {
      return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
    }

    const journalEntryNo = existing.voucher_no;
    const totalDebits    = entries.reduce((s, e) => s + (parseFloat(e.debit_amount)  || 0), 0);
    const totalCredits   = entries.reduce((s, e) => s + (parseFloat(e.credit_amount) || 0), 0);

    await Ledger.deleteMany({
      voucher_id: journalEntryId, firm_id: firmId, voucher_type: 'JOURNAL',
    });

    const docs = entries.map(e => ({
      firm_id:          firmId,
      voucher_id:       journalEntryId,
      voucher_type:     'JOURNAL',
      voucher_no:       journalEntryNo,
      account_head:     e.account_head.trim(),
      account_type:     e.account_type || 'GENERAL',
      debit_amount:     parseFloat(e.debit_amount)  || 0,
      credit_amount:    parseFloat(e.credit_amount) || 0,
      narration:        (e.narration || narration || `Journal Entry ${journalEntryNo}`).trim(),
      ref_type:         'JOURNAL',
      bill_id:          null, party_id: null, stock_id: null, stock_reg_id: null,
      transaction_date,
      created_by:       actorUsername,
    }));

    await Ledger.insertMany(docs);

    res.json({
      message: 'Journal entry updated successfully',
      id: journalEntryId,
      journalEntryId,
      journalEntryNo,
      totalDebits,
      totalCredits,
    });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_UPDATE] Error:', err);
    res.status(500).json({ error: 'Failed to update journal entry: ' + err.message });
  }
};

/* ── SUMMARY ──────────────────────────────────────────────────────────── */

export const getJournalEntrySummary = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'JOURNAL_ENTRY_SUMMARY');
    if (!firmId) return;

    const fid = new mongoose.Types.ObjectId(firmId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const [totalResult, recentResult, volumeResult] = await Promise.all([
      Ledger.aggregate([
        { $match: { firm_id: fid, voucher_type: 'JOURNAL' } },
        { $group: { _id: '$voucher_id' } },
        { $count: 'total' },
      ]),
      Ledger.aggregate([
        { $match: { firm_id: fid, voucher_type: 'JOURNAL', transaction_date: { $gte: dateStr } } },
        { $group: { _id: '$voucher_id' } },
        { $count: 'total' },
      ]),
      Ledger.aggregate([
        { $match: { firm_id: fid, voucher_type: 'JOURNAL' } },
        { $group: { _id: null, vol: { $sum: '$debit_amount' } } },
      ]),
    ]);

    res.json({
      total_journal_entries:        totalResult[0]?.total  ?? 0,
      recent_journal_entries_count: recentResult[0]?.total ?? 0,
      total_volume:                 volumeResult[0]?.vol   ?? 0,
    });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_SUMMARY] Error:', err);
    res.status(500).json({ error: 'Failed to fetch summary: ' + err.message });
  }
};