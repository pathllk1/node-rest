import mongoose from 'mongoose';
import { Ledger, VoucherSequence } from '../../../models/index.js';

const now = () => new Date().toISOString();
const getActorUsername = (req) => req?.user?.username ?? null;

function getFirmId(req, res, tag) {
  const raw = req.user?.firm_id;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    console.error(`[${tag}] Invalid firm_id:`, raw);
    res.status(400).json({ error: 'Invalid or missing firm ID' });
    return null;
  }
  return raw;
}

function validateLines(entries) {
  if (!Array.isArray(entries) || entries.length < 1) {
    return 'At least one ledger line is required';
  }
  let totalDebits = 0, totalCredits = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const dr = parseFloat(e.debit_amount) || 0;
    const cr = parseFloat(e.credit_amount) || 0;
    if (!e.account_head?.trim()) return `Line ${i + 1}: Account head is required`;
    if (!e.account_type?.trim()) return `Line ${i + 1}: Account type is required`;
    if (dr < 0 || cr < 0) return `Line ${i + 1}: Amounts cannot be negative`;
    if (dr > 0 && cr > 0) return `Line ${i + 1}: A line cannot have both debit and credit amounts`;
    if (dr === 0 && cr === 0) return `Line ${i + 1}: Either debit or credit amount is required`;
    totalDebits += dr;
    totalCredits += cr;
  }
  // FIX: Provide more detailed error message when entry is unbalanced
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    const difference = Math.abs(totalDebits - totalCredits).toFixed(2);
    const side = totalDebits > totalCredits ? 'Debits' : 'Credits';
    return `Entry must be balanced — Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)} (Difference: ${difference} on ${side} side)`;
  }
  return null;
}

async function getNextVoucherGroupId(firmId) {
  const d = new Date();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const financialYear = month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
  const seq = await VoucherSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: financialYear },
    { $inc: { last_sequence: 1 } },
    { new: true, setDefaultsOnInsert: true, upsert: true }
  );
  return seq.last_sequence;
}

/* ── CREATE MANUAL LEDGER ENTRY ──────────────────────────────────────── */

export const createManualLedgerEntry = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'MANUAL_LEDGER_CREATE');
  if (!firmId) return;

  const { entries, narration, transaction_date } = req.body;
  const lineError = validateLines(entries);
  if (lineError) return res.status(400).json({ error: lineError });

  try {
    const voucherId = await getNextVoucherGroupId(firmId);
    const finalTransactionDate = transaction_date || now().split('T')[0];
    const totalDebits = entries.reduce((s, e) => s + (parseFloat(e.debit_amount) || 0), 0);
    const totalCredits = entries.reduce((s, e) => s + (parseFloat(e.credit_amount) || 0), 0);

    const docs = entries.map(e => ({
      firm_id: firmId,
      voucher_id: voucherId,
      voucher_type: 'MANUAL',
      voucher_no: `MANUAL/${voucherId}`,
      account_head: e.account_head.trim(),
      account_type: e.account_type.trim(),
      debit_amount: parseFloat(e.debit_amount) || 0,
      credit_amount: parseFloat(e.credit_amount) || 0,
      narration: (e.narration || narration || `Manual Entry ${voucherId}`).trim(),
      ref_type: 'MANUAL',
      bill_id: null,
      party_id: null,
      stock_id: null,
      stock_reg_id: null,
      transaction_date: finalTransactionDate,
      created_by: actorUsername,
      is_locked: false,
    }));

    const result = await Ledger.insertMany(docs);

    res.json({
      message: 'Manual ledger entry created successfully',
      id: voucherId,
      voucherId,
      voucherNo: `MANUAL/${voucherId}`,
      totalDebits,
      totalCredits,
      lineCount: result.length,
    });
  } catch (err) {
    console.error('[MANUAL_LEDGER_CREATE] Error:', err);
    res.status(500).json({ error: 'Failed to create manual ledger entry: ' + err.message });
  }
};

/* ── GET MANUAL LEDGER ENTRIES ───────────────────────────────────────── */

export const getManualLedgerEntries = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'MANUAL_LEDGER_GET');
    if (!firmId) return;

    const { start_date, end_date, search, page = 1, limit = 20 } = req.query;
    const pageInt = Math.max(1, parseInt(page) || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const match = {
      firm_id: new mongoose.Types.ObjectId(firmId),
      ref_type: 'MANUAL',
    };

    if (start_date || end_date) {
      match.transaction_date = {};
      if (start_date) match.transaction_date.$gte = start_date;
      if (end_date) match.transaction_date.$lte = end_date;
    }

    if (search?.trim()) {
      match.$or = [
        { account_head: { $regex: search.trim(), $options: 'i' } },
        { narration: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const total = await Ledger.countDocuments(match);
    const records = await Ledger.find(match)
      .sort({ transaction_date: -1, voucher_id: -1 })
      .skip((pageInt - 1) * limitInt)
      .limit(limitInt)
      .lean();

    // Group by voucher_id for display
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.voucher_id]) {
        grouped[r.voucher_id] = {
          voucherId: r.voucher_id,
          voucherNo: r.voucher_no,
          transactionDate: r.transaction_date,
          createdBy: r.created_by,
          isLocked: r.is_locked,
          lines: [],
          totalDebit: 0,
          totalCredit: 0,
        };
      }
      grouped[r.voucher_id].lines.push({
        _id: r._id,
        accountHead: r.account_head,
        accountType: r.account_type,
        debitAmount: r.debit_amount,
        creditAmount: r.credit_amount,
        narration: r.narration,
      });
      grouped[r.voucher_id].totalDebit += r.debit_amount;
      grouped[r.voucher_id].totalCredit += r.credit_amount;
    });

    const entries = Object.values(grouped);

    res.json({
      entries,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total,
        pages: Math.ceil(total / limitInt),
      },
    });
  } catch (err) {
    console.error('[MANUAL_LEDGER_GET] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ── GET MANUAL LEDGER ENTRY BY VOUCHER ID ───────────────────────────── */

export const getManualLedgerEntryById = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'MANUAL_LEDGER_GET_BY_ID');
    if (!firmId) return;

    const { voucherId } = req.params;

    if (!Number.isInteger(parseInt(voucherId))) {
      return res.status(400).json({ error: 'Invalid voucher ID' });
    }

    const records = await Ledger.find({
      firm_id: firmId,
      voucher_id: parseInt(voucherId),
      ref_type: 'MANUAL',
    }).lean();

    if (!records.length) {
      return res.status(404).json({ error: 'Manual ledger entry not found' });
    }

    const entry = {
      voucherId: records[0].voucher_id,
      voucherNo: records[0].voucher_no,
      transactionDate: records[0].transaction_date,
      createdBy: records[0].created_by,
      isLocked: records[0].is_locked,
      lines: records.map(r => ({
        _id: r._id,
        accountHead: r.account_head,
        accountType: r.account_type,
        debitAmount: r.debit_amount,
        creditAmount: r.credit_amount,
        narration: r.narration,
      })),
    };

    res.json(entry);
  } catch (err) {
    console.error('[MANUAL_LEDGER_GET_BY_ID] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ── UPDATE MANUAL LEDGER ENTRY ──────────────────────────────────────── */

export const updateManualLedgerEntry = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'MANUAL_LEDGER_UPDATE');
  if (!firmId) return;

  const { voucherId } = req.params;
  const { entries, narration, transaction_date } = req.body;

  if (!Number.isInteger(parseInt(voucherId))) {
    return res.status(400).json({ error: 'Invalid voucher ID' });
  }

  const lineError = validateLines(entries);
  if (lineError) return res.status(400).json({ error: lineError });

  try {
    // Check if entry exists and is not locked
    const existing = await Ledger.findOne({
      firm_id: firmId,
      voucher_id: parseInt(voucherId),
      ref_type: 'MANUAL',
    }).lean();

    if (!existing) {
      return res.status(404).json({ error: 'Manual ledger entry not found' });
    }

    if (existing.is_locked) {
      return res.status(400).json({ error: 'Cannot modify locked ledger entry' });
    }

    // Delete old lines
    await Ledger.deleteMany({
      firm_id: firmId,
      voucher_id: parseInt(voucherId),
      ref_type: 'MANUAL',
    });

    // Insert new lines
    const finalTransactionDate = transaction_date || existing.transaction_date;
    const totalDebits = entries.reduce((s, e) => s + (parseFloat(e.debit_amount) || 0), 0);
    const totalCredits = entries.reduce((s, e) => s + (parseFloat(e.credit_amount) || 0), 0);

    const docs = entries.map(e => ({
      firm_id: firmId,
      voucher_id: parseInt(voucherId),
      voucher_type: 'MANUAL',
      voucher_no: `MANUAL/${voucherId}`,
      account_head: e.account_head.trim(),
      account_type: e.account_type.trim(),
      debit_amount: parseFloat(e.debit_amount) || 0,
      credit_amount: parseFloat(e.credit_amount) || 0,
      narration: (e.narration || narration || `Manual Entry ${voucherId}`).trim(),
      ref_type: 'MANUAL',
      bill_id: null,
      party_id: null,
      stock_id: null,
      stock_reg_id: null,
      transaction_date: finalTransactionDate,
      created_by: actorUsername,
      is_locked: false,
    }));

    await Ledger.insertMany(docs);

    res.json({
      message: 'Manual ledger entry updated successfully',
      voucherId: parseInt(voucherId),
      totalDebits,
      totalCredits,
      lineCount: docs.length,
    });
  } catch (err) {
    console.error('[MANUAL_LEDGER_UPDATE] Error:', err);
    res.status(500).json({ error: 'Failed to update manual ledger entry: ' + err.message });
  }
};

/* ── DELETE MANUAL LEDGER ENTRY ──────────────────────────────────────── */

export const deleteManualLedgerEntry = async (req, res) => {
  const firmId = getFirmId(req, res, 'MANUAL_LEDGER_DELETE');
  if (!firmId) return;

  const { voucherId } = req.params;

  if (!Number.isInteger(parseInt(voucherId))) {
    return res.status(400).json({ error: 'Invalid voucher ID' });
  }

  try {
    const existing = await Ledger.findOne({
      firm_id: firmId,
      voucher_id: parseInt(voucherId),
      ref_type: 'MANUAL',
    }).lean();

    if (!existing) {
      return res.status(404).json({ error: 'Manual ledger entry not found' });
    }

    if (existing.is_locked) {
      return res.status(400).json({ error: 'Cannot delete locked ledger entry' });
    }

    await Ledger.deleteMany({
      firm_id: firmId,
      voucher_id: parseInt(voucherId),
      ref_type: 'MANUAL',
    });

    res.json({ message: 'Manual ledger entry deleted successfully' });
  } catch (err) {
    console.error('[MANUAL_LEDGER_DELETE] Error:', err);
    res.status(500).json({ error: 'Failed to delete manual ledger entry: ' + err.message });
  }
};

/* ── LOCK MANUAL LEDGER ENTRY ────────────────────────────────────────── */

export const lockManualLedgerEntry = async (req, res) => {
  const firmId = getFirmId(req, res, 'MANUAL_LEDGER_LOCK');
  if (!firmId) return;

  const { voucherId } = req.params;

  if (!Number.isInteger(parseInt(voucherId))) {
    return res.status(400).json({ error: 'Invalid voucher ID' });
  }

  try {
    const result = await Ledger.updateMany(
      {
        firm_id: firmId,
        voucher_id: parseInt(voucherId),
        ref_type: 'MANUAL',
      },
      { is_locked: true }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Manual ledger entry not found' });
    }

    res.json({
      message: 'Manual ledger entry locked successfully',
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('[MANUAL_LEDGER_LOCK] Error:', err);
    res.status(500).json({ error: 'Failed to lock manual ledger entry: ' + err.message });
  }
};
