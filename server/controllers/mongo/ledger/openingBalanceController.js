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

/* ── CREATE OPENING BALANCE ──────────────────────────────────────────── */

export const createOpeningBalance = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'OPENING_BALANCE_CREATE');
  if (!firmId) return;

  const { account_head, account_type, opening_date, debit_amount, credit_amount, narration } = req.body;

  if (!account_head?.trim()) return res.status(400).json({ error: 'Account head is required' });
  if (!account_type?.trim()) return res.status(400).json({ error: 'Account type is required' });
  if (!opening_date?.trim()) return res.status(400).json({ error: 'Opening date is required' });

  const dr = parseFloat(debit_amount) || 0;
  const cr = parseFloat(credit_amount) || 0;

  if (dr < 0 || cr < 0) return res.status(400).json({ error: 'Amounts cannot be negative' });
  if (dr > 0 && cr > 0) return res.status(400).json({ error: 'Cannot have both debit and credit amounts' });
  if (dr === 0 && cr === 0) return res.status(400).json({ error: 'Either debit or credit amount is required' });

  try {
    const voucherId = await getNextVoucherGroupId(firmId);

    const doc = new Ledger({
      firm_id: firmId,
      voucher_id: voucherId,
      voucher_type: 'OPENING_BALANCE',
      voucher_no: `OB/${opening_date}/${voucherId}`,
      account_head: account_head.trim(),
      account_type: account_type.trim(),
      debit_amount: dr,
      credit_amount: cr,
      narration: narration?.trim() || 'Opening Balance',
      ref_type: 'OPENING_BALANCE',
      transaction_date: opening_date.trim(),
      created_by: actorUsername,
      is_locked: false,
    });

    await doc.save();

    res.json({
      message: 'Opening balance created successfully',
      id: doc._id,
      voucherId,
      opening_balance: {
        _id: doc._id,
        accountHead: doc.account_head,
        accountType: doc.account_type,
        openingDate: doc.transaction_date,
        debitAmount: doc.debit_amount,
        creditAmount: doc.credit_amount,
        narration: doc.narration,
        isLocked: doc.is_locked,
      },
    });
  } catch (err) {
    console.error('[OPENING_BALANCE_CREATE] Error:', err);
    res.status(500).json({ error: 'Failed to create opening balance: ' + err.message });
  }
};

/* ── GET ALL OPENING BALANCES ────────────────────────────────────────── */

export const getOpeningBalances = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'OPENING_BALANCES_GET');
    if (!firmId) return;

    const { opening_date, search, page = 1, limit = 50 } = req.query;
    const pageInt = Math.max(1, parseInt(page) || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit) || 50));

    const match = {
      firm_id: new mongoose.Types.ObjectId(firmId),
      ref_type: 'OPENING_BALANCE',
    };

    if (opening_date) {
      match.transaction_date = opening_date;
    }

    if (search?.trim()) {
      match.account_head = { $regex: search.trim(), $options: 'i' };
    }

    const total = await Ledger.countDocuments(match);
    const records = await Ledger.find(match)
      .sort({ transaction_date: -1, account_head: 1 })
      .skip((pageInt - 1) * limitInt)
      .limit(limitInt)
      .lean();

    const formatted = records.map(r => ({
      _id: r._id,
      accountHead: r.account_head,
      accountType: r.account_type,
      openingDate: r.transaction_date,
      debitAmount: r.debit_amount,
      creditAmount: r.credit_amount,
      narration: r.narration,
      isLocked: r.is_locked,
      createdBy: r.created_by,
    }));

    res.json({
      records: formatted,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total,
        pages: Math.ceil(total / limitInt),
      },
    });
  } catch (err) {
    console.error('[OPENING_BALANCES_GET] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ── GET OPENING BALANCE BY ID ───────────────────────────────────────── */

export const getOpeningBalanceById = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'OPENING_BALANCE_GET_BY_ID');
    if (!firmId) return;

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid opening balance ID' });
    }

    const ob = await Ledger.findOne({
      _id: id,
      firm_id: firmId,
      ref_type: 'OPENING_BALANCE',
    }).lean();

    if (!ob) {
      return res.status(404).json({ error: 'Opening balance not found' });
    }

    res.json({
      _id: ob._id,
      accountHead: ob.account_head,
      accountType: ob.account_type,
      openingDate: ob.transaction_date,
      debitAmount: ob.debit_amount,
      creditAmount: ob.credit_amount,
      narration: ob.narration,
      isLocked: ob.is_locked,
    });
  } catch (err) {
    console.error('[OPENING_BALANCE_GET_BY_ID] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ── UPDATE OPENING BALANCE ──────────────────────────────────────────── */

export const updateOpeningBalance = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'OPENING_BALANCE_UPDATE');
  if (!firmId) return;

  const { id } = req.params;
  const { account_head, account_type, opening_date, debit_amount, credit_amount, narration } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid opening balance ID' });
  }

  try {
    const ob = await Ledger.findOne({
      _id: id,
      firm_id: firmId,
      ref_type: 'OPENING_BALANCE',
    });

    if (!ob) {
      return res.status(404).json({ error: 'Opening balance not found' });
    }

    if (ob.is_locked) {
      return res.status(400).json({ error: 'Cannot modify locked opening balance' });
    }

    // Validate amounts if provided
    if (debit_amount !== undefined || credit_amount !== undefined) {
      const dr = parseFloat(debit_amount) ?? parseFloat(ob.debit_amount);
      const cr = parseFloat(credit_amount) ?? parseFloat(ob.credit_amount);

      if (dr < 0 || cr < 0) return res.status(400).json({ error: 'Amounts cannot be negative' });
      if (dr > 0 && cr > 0) return res.status(400).json({ error: 'Cannot have both debit and credit amounts' });
      if (dr === 0 && cr === 0) return res.status(400).json({ error: 'Either debit or credit amount is required' });

      ob.debit_amount = dr;
      ob.credit_amount = cr;
    }

    if (account_head?.trim()) ob.account_head = account_head.trim();
    if (account_type?.trim()) ob.account_type = account_type.trim();
    if (opening_date?.trim()) {
      ob.transaction_date = opening_date.trim();
      ob.voucher_no = `OB/${opening_date.trim()}/${ob.voucher_id}`;
    }
    if (narration?.trim()) ob.narration = narration.trim();

    await ob.save();

    res.json({
      message: 'Opening balance updated successfully',
      opening_balance: {
        _id: ob._id,
        accountHead: ob.account_head,
        accountType: ob.account_type,
        openingDate: ob.transaction_date,
        debitAmount: ob.debit_amount,
        creditAmount: ob.credit_amount,
        narration: ob.narration,
        isLocked: ob.is_locked,
      },
    });
  } catch (err) {
    console.error('[OPENING_BALANCE_UPDATE] Error:', err);
    res.status(500).json({ error: 'Failed to update opening balance: ' + err.message });
  }
};

/* ── DELETE OPENING BALANCE ──────────────────────────────────────────── */

export const deleteOpeningBalance = async (req, res) => {
  const firmId = getFirmId(req, res, 'OPENING_BALANCE_DELETE');
  if (!firmId) return;

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid opening balance ID' });
  }

  try {
    const ob = await Ledger.findOne({
      _id: id,
      firm_id: firmId,
      ref_type: 'OPENING_BALANCE',
    });

    if (!ob) {
      return res.status(404).json({ error: 'Opening balance not found' });
    }

    if (ob.is_locked) {
      return res.status(400).json({ error: 'Cannot delete locked opening balance' });
    }

    await Ledger.deleteOne({ _id: id });

    res.json({ message: 'Opening balance deleted successfully' });
  } catch (err) {
    console.error('[OPENING_BALANCE_DELETE] Error:', err);
    res.status(500).json({ error: 'Failed to delete opening balance: ' + err.message });
  }
};

/* ── LOCK OPENING BALANCES (for a specific date) ──────────────────────── */

export const lockOpeningBalances = async (req, res) => {
  const firmId = getFirmId(req, res, 'OPENING_BALANCE_LOCK');
  if (!firmId) return;

  const { opening_date } = req.body;

  if (!opening_date?.trim()) {
    return res.status(400).json({ error: 'Opening date is required' });
  }

  try {
    const result = await Ledger.updateMany(
      {
        firm_id: firmId,
        ref_type: 'OPENING_BALANCE',
        transaction_date: opening_date.trim(),
      },
      { is_locked: true }
    );

    res.json({
      message: `Locked ${result.modifiedCount} opening balance(s)`,
      locked_count: result.modifiedCount,
    });
  } catch (err) {
    console.error('[OPENING_BALANCE_LOCK] Error:', err);
    res.status(500).json({ error: 'Failed to lock opening balances: ' + err.message });
  }
};

/* ── GET OPENING BALANCE SUMMARY (for trial balance calculation) ──────── */

export const getOpeningBalanceSummary = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'OPENING_BALANCE_SUMMARY');
    if (!firmId) return;

    const { opening_date } = req.query;

    const match = {
      firm_id: new mongoose.Types.ObjectId(firmId),
      ref_type: 'OPENING_BALANCE',
    };
    if (opening_date) {
      match.transaction_date = { $lte: opening_date };
    }

    const summary = await Ledger.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            account_head: '$account_head',
            account_type: '$account_type',
          },
          total_debit: { $sum: '$debit_amount' },
          total_credit: { $sum: '$credit_amount' },
        },
      },
      {
        $project: {
          _id: 0,
          account_head: '$_id.account_head',
          account_type: '$_id.account_type',
          total_debit: 1,
          total_credit: 1,
          balance: { $subtract: ['$total_debit', '$total_credit'] },
        },
      },
      { $sort: { account_head: 1 } },
    ]);

    res.json(summary);
  } catch (err) {
    console.error('[OPENING_BALANCE_SUMMARY] Error:', err);
    res.status(500).json({ error: err.message });
  }
};
