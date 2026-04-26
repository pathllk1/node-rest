import mongoose from 'mongoose';
import { BankAccount, Ledger } from '../../../models/index.js';

function getFirmId(req, res, tag) {
  const raw = req.user?.firm_id;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    console.error(`[${tag}] Invalid firm_id:`, raw);
    res.status(400).json({ error: 'Invalid or missing firm ID' });
    return null;
  }
  return raw;
}

function normalizeText(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().replace(/\s+/g, ' ');
  return normalized || fallback;
}

function sanitizeBankAccountPayload(body = {}) {
  return {
    account_name: normalizeText(body.account_name),
    account_holder_name: normalizeText(body.account_holder_name),
    bank_name: normalizeText(body.bank_name),
    branch_name: normalizeText(body.branch_name),
    account_number: normalizeText(body.account_number)?.replace(/\s+/g, ''),
    ifsc_code: normalizeText(body.ifsc_code)?.toUpperCase(),
    account_type: normalizeText(body.account_type, 'CURRENT')?.toUpperCase(),
    upi_id: normalizeText(body.upi_id),
    notes: normalizeText(body.notes),
    is_default: Boolean(body.is_default),
    status: normalizeText(body.status, 'ACTIVE')?.toUpperCase(),
  };
}

function validateBankAccountPayload(payload) {
  if (!payload.account_name) return 'Account name is required';
  if (!payload.bank_name) return 'Bank name is required';
  if (!payload.account_number) return 'Account number is required';
  if (!payload.ifsc_code) return 'IFSC code is required';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(payload.ifsc_code)) return 'Valid IFSC code is required';
  if (!['SAVINGS', 'CURRENT', 'OD', 'CC', 'OTHER'].includes(payload.account_type)) return 'Invalid account type';
  if (!['ACTIVE', 'INACTIVE'].includes(payload.status)) return 'Invalid status';
  return null;
}

async function ensureFirmHasDefaultBankAccount(firmId, preferredId = null) {
  const existingDefault = await BankAccount.findOne({ firm_id: firmId, is_default: true }).lean();
  if (existingDefault?.status === 'ACTIVE') return existingDefault;
  if (existingDefault) {
    await BankAccount.updateOne({ _id: existingDefault._id }, { $set: { is_default: false } });
  }

  let fallback = null;
  if (preferredId) {
    fallback = await BankAccount.findOne({ _id: preferredId, firm_id: firmId, status: 'ACTIVE' });
  }
  if (!fallback) {
    fallback = await BankAccount.findOne({ firm_id: firmId, status: 'ACTIVE' }).sort({ createdAt: 1 });
  }
  // FIX: If no active accounts exist, pick the oldest inactive account as fallback
  // (instead of silently returning null, which leaves the firm without a default)
  if (!fallback) {
    fallback = await BankAccount.findOne({ firm_id: firmId }).sort({ createdAt: 1 });
  }
  if (!fallback) return null;

  fallback.is_default = true;
  await fallback.save();
  return fallback.toObject();
}

async function assignDefaultBankAccount(firmId, bankAccountId) {
  await BankAccount.updateMany(
    { firm_id: firmId, _id: { $ne: bankAccountId }, is_default: true },
    { $set: { is_default: false } }
  );
  const account = await BankAccount.findOneAndUpdate(
    { _id: bankAccountId, firm_id: firmId },
    { $set: { is_default: true } },
    { new: true }
  ).lean();
  await ensureFirmHasDefaultBankAccount(firmId, bankAccountId);
  return account;
}

export const getBankAccounts = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'BANK_ACCOUNTS_GET');
    if (!firmId) return;

    const activeOnly = String(req.query.activeOnly || '').toLowerCase() === 'true';
    const filter = { firm_id: firmId };
    if (activeOnly) filter.status = 'ACTIVE';

    const accounts = await BankAccount.find(filter)
      .sort({ is_default: -1, status: 1, account_name: 1, createdAt: 1 })
      .lean();

    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error('[BANK_ACCOUNTS_GET] Error:', err);
    res.status(500).json({ error: 'Failed to fetch bank accounts: ' + err.message });
  }
};

export const getBankAccountById = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'BANK_ACCOUNT_GET_BY_ID');
    if (!firmId) return;

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid bank account ID' });

    const account = await BankAccount.findOne({ _id: id, firm_id: firmId }).lean();
    if (!account) return res.status(404).json({ error: 'Bank account not found' });

    res.json({ success: true, data: account });
  } catch (err) {
    console.error('[BANK_ACCOUNT_GET_BY_ID] Error:', err);
    res.status(500).json({ error: 'Failed to fetch bank account: ' + err.message });
  }
};

export const createBankAccount = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'BANK_ACCOUNT_CREATE');
    if (!firmId) return;

    const payload = sanitizeBankAccountPayload(req.body);
    const validationError = validateBankAccountPayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });

    const existingCount = await BankAccount.countDocuments({ firm_id: firmId });
    const shouldBeDefault = existingCount === 0;
    const finalPayload = {
      ...payload,
      firm_id: firmId,
      is_default: shouldBeDefault,
    };

    const created = await BankAccount.create(finalPayload);
    if (shouldBeDefault || payload.is_default) await assignDefaultBankAccount(firmId, created._id);

    const fresh = await BankAccount.findOne({ _id: created._id, firm_id: firmId }).lean();
    res.status(201).json({ success: true, data: fresh, message: 'Bank account created successfully' });
  } catch (err) {
    console.error('[BANK_ACCOUNT_CREATE] Error:', err);
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'A bank account with the same account number already exists for this firm' });
    }
    res.status(500).json({ error: 'Failed to create bank account: ' + err.message });
  }
};

export const updateBankAccount = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'BANK_ACCOUNT_UPDATE');
    if (!firmId) return;

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid bank account ID' });

    const existing = await BankAccount.findOne({ _id: id, firm_id: firmId });
    if (!existing) return res.status(404).json({ error: 'Bank account not found' });

    const payload = sanitizeBankAccountPayload({ ...existing.toObject(), ...req.body });
    const validationError = validateBankAccountPayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });

    const requestedDefault = payload.is_default && payload.status === 'ACTIVE';
    if (requestedDefault && !existing.is_default) {
      await BankAccount.updateMany(
        { firm_id: firmId, _id: { $ne: existing._id }, is_default: true },
        { $set: { is_default: false } }
      );
    }

    existing.account_name = payload.account_name;
    existing.account_holder_name = payload.account_holder_name;
    existing.bank_name = payload.bank_name;
    existing.branch_name = payload.branch_name;
    existing.account_number = payload.account_number;
    existing.ifsc_code = payload.ifsc_code;
    existing.account_type = payload.account_type;
    existing.upi_id = payload.upi_id;
    existing.notes = payload.notes;
    existing.status = payload.status;
    existing.is_default = requestedDefault;

    await existing.save();

    if (existing.is_default) {
      await assignDefaultBankAccount(firmId, existing._id);
    } else {
      await ensureFirmHasDefaultBankAccount(firmId);
    }

    const fresh = await BankAccount.findOne({ _id: existing._id, firm_id: firmId }).lean();
    res.json({ success: true, data: fresh, message: 'Bank account updated successfully' });
  } catch (err) {
    console.error('[BANK_ACCOUNT_UPDATE] Error:', err);
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'A bank account with the same account number already exists for this firm' });
    }
    res.status(500).json({ error: 'Failed to update bank account: ' + err.message });
  }
};

export const deleteBankAccount = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'BANK_ACCOUNT_DELETE');
    if (!firmId) return;

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid bank account ID' });

    const existing = await BankAccount.findOne({ _id: id, firm_id: firmId });
    if (!existing) return res.status(404).json({ error: 'Bank account not found' });

    const voucherUsage = await Ledger.exists({ firm_id: firmId, bank_account_id: existing._id });
    if (voucherUsage) {
      return res.status(409).json({
        error: 'This bank account is already used in vouchers. Mark it inactive instead of deleting it.',
      });
    }

    const wasDefault = existing.is_default;
    await existing.deleteOne();

    if (wasDefault) await ensureFirmHasDefaultBankAccount(firmId);

    res.json({ success: true, message: 'Bank account deleted successfully' });
  } catch (err) {
    console.error('[BANK_ACCOUNT_DELETE] Error:', err);
    res.status(500).json({ error: 'Failed to delete bank account: ' + err.message });
  }
};
