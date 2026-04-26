/**
 * billUtils.js — shared utilities for purchase and sales bill controllers.
 *
 * Contains:
 *   • Pure helpers  (no side effects, no DB)
 *   • DB helpers    (shared across both controllers)
 *   • WAC functions (Weighted Average Cost for perpetual inventory)
 *
 * Import path from prs/inventory.js or sls/inventory.js: '../billUtils.js'
 */

import mongoose from 'mongoose';
import {
  BillSequence, VoucherSequence, Settings, FirmSettings, Bill,
} from '../../../models/index.js';


/* ── Actor ────────────────────────────────────────────────────────────────── */

export const getActorUsername = (req) => req?.user?.username ?? null;

/* ── Financial year ───────────────────────────────────────────────────────── */

export function getCurrentFinancialYear() {
  const d     = new Date();
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();
  return month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
}

/* ── Guards ───────────────────────────────────────────────────────────────── */

export function getFirmId(req, res, tag) {
  const raw = req.user?.firm_id;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    console.error(`[${tag}] Invalid firm_id:`, raw);
    res.status(400).json({ success: false, error: 'Invalid or missing firm ID' });
    return null;
  }
  return raw;
}

export function validateObjectId(value, fieldName, res) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    res.status(400).json({ success: false, error: `Invalid ${fieldName}` });
    return null;
  }
  return String(value);
}

/* ── Text normalizers ─────────────────────────────────────────────────────── */

export function normalizeOptionalText(value, maxLen = 120) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

export function normalizeOptionalMultilineText(value, maxLen = 2000) {
  if (value === undefined || value === null) return null;
  const normalized = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ── Service-item helpers (sales only, harmless to share) ─────────────────── */

export function isServiceItem(item) {
  return String(item?.itemType || item?.item_type || 'GOODS').toUpperCase() === 'SERVICE';
}

export function getEffectiveItemQty(item) {
  const qty = parseFloat(item?.qty);
  if (Number.isFinite(qty) && qty > 0) return qty;
  // Services can have qty=0 (flat-rate services with no quantity)
  // Goods must have qty > 0
  return 0;
}

/* ── WAC (Weighted Average Cost) ──────────────────────────────────────────── */

function roundInventoryRate(value, precision = 6) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(precision));
}

/**
 * Compute WAC after ADDING stock (purchase).
 *
 * @param {number} existingTotal   Stock.total before this purchase
 * @param {number} existingQty     Stock.qty   before this purchase
 * @param {number} purchasedQty    Quantity being added
 * @param {number} lineValue       Cost value added (qty × rate × (1-disc))
 * @returns {{ blendedRate: number, newTotal: number, newQty: number }}
 */
export function computeWAC(existingTotal, existingQty, purchasedQty, lineValue) {
  const safeExistingTotal = existingTotal ?? (existingQty * 0); // guard against null
  const newQty   = existingQty + purchasedQty;
  const newTotal = safeExistingTotal + lineValue;
  const blendedRate = newQty > 0 ? newTotal / newQty : (purchasedQty > 0 ? lineValue / purchasedQty : 0);
  return { blendedRate: roundInventoryRate(blendedRate), newTotal, newQty };
}

/**
 * Reverse WAC when REMOVING stock (purchase cancel / purchase return).
 * Subtracts the original cost from the running total.
 *
 * @param {number} existingTotal   Stock.total before removal
 * @param {number} existingQty     Stock.qty   before removal
 * @param {number} removedQty      Quantity being removed
 * @param {number} costValue       Cost value being removed (from StockReg.total)
 * @returns {{ newRate: number, newTotal: number, newQty: number }}
 */
export function reverseWAC(existingTotal, existingQty, removedQty, costValue) {
  const newQty   = Math.max(0, existingQty - removedQty);
  const newTotal = Math.max(0, (existingTotal ?? 0) - costValue);
  // Rate: if stock goes to 0, keep last known rate; otherwise recompute
  const newRate  = newQty > 0
    ? newTotal / newQty
    : (existingQty > 0 ? (existingTotal ?? 0) / existingQty : 0);
  return { newRate: roundInventoryRate(newRate), newTotal, newQty };
}

/* ── Bill / voucher number generation ─────────────────────────────────────── */

export const BILL_PREFIX = {
  SALES: 'INV', PURCHASE: 'PUR', CREDIT_NOTE: 'CN', DEBIT_NOTE: 'DN',
  DELIVERY_NOTE: 'DLN', JOURNAL: 'JV', PAYMENT: 'PV', RECEIPT: 'RV',
};

export async function getNextBillNumber(firmId, type = 'SALES') {
  const fy     = getCurrentFinancialYear();
  const prefix = BILL_PREFIX[type.toUpperCase()] ?? type.slice(0, 3).toUpperCase();
  const seq = await BillSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: fy, voucher_type: type.toUpperCase() },
    { $inc: { last_sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${prefix}/${fy}/${String(seq.last_sequence).padStart(4, '0')}`;
}

export async function previewNextBillNumber(firmId, type = 'SALES') {
  const fy     = getCurrentFinancialYear();
  const prefix = BILL_PREFIX[type.toUpperCase()] ?? type.slice(0, 3).toUpperCase();
  const seq    = await BillSequence.findOne(
    { firm_id: firmId, financial_year: fy, voucher_type: type.toUpperCase() }
  ).lean();
  const nextNum = (seq?.last_sequence ?? 0) + 1;
  return `${prefix}/${fy}/${String(nextNum).padStart(4, '0')}`;
}

/**
 * Returns the next integer voucher group ID as a plain Number.
 *
 * Stored in Ledger.voucher_id (type: Number) directly.
 * Stored in Bill.voucher_id  (type: String) as String(number) — e.g. "1".
 *
 * Both old bills ("00000001") and new bills ("1") coerce correctly to Number 1
 * when Mongoose queries Ledger.voucher_id, so no migration is needed.
 */
export async function getNextVoucherNumber(firmId) {
  const fy  = getCurrentFinancialYear();
  const seq = await VoucherSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: fy },
    { $inc: { last_sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return seq.last_sequence; // Number — callers store directly; Bill schema casts to String
}

/* ── GST setting ──────────────────────────────────────────────────────────── */

export async function isGstEnabled(firmId) {
  try {
    const firmSetting = await FirmSettings.findOne(
      { firm_id: firmId, setting_key: 'gst_enabled' }
    ).lean();
    if (firmSetting) return firmSetting.setting_value === 'true';
    const globalSetting = await Settings.findOne({ setting_key: 'gst_enabled' }).lean();
    return globalSetting ? globalSetting.setting_value === 'true' : true;
  } catch {
    return true;
  }
}

/* ── Duplicate supplier-bill check (purchase only) ────────────────────────── */

export async function ensureUniqueSupplierBillNo({ firmId, partyId, supplierBillNo, excludeBillId = null }) {
  if (!supplierBillNo) return;
  const query = {
    firm_id:          firmId,
    party_id:         partyId,
    btype:            'PURCHASE',
    status:           { $ne: 'CANCELLED' },
    supplier_bill_no: { $regex: `^${escapeRegex(supplierBillNo)}$`, $options: 'i' },
  };
  if (excludeBillId) query._id = { $ne: excludeBillId };
  const duplicate = await Bill.findOne(query).select('_id bno supplier_bill_no bdate').lean();
  if (duplicate) {
    throw new Error(
      `Supplier bill number "${supplierBillNo}" already exists for this supplier under purchase ${duplicate.bno}`
    );
  }
}

/* ── Bill totals calculation ──────────────────────────────────────────────── */

/**
 * Calculate bill totals (GST, round-off, etc.)
 *
 * @param {Array}    cart
 * @param {Array}    otherCharges
 * @param {boolean}  gstEnabled
 * @param {string}   billType       - 'intra-state' or 'inter-state'
 * @param {boolean}  reverseCharge
 * @param {Function} [qtyFn]        - how to extract qty per item.
 *   Sales: pass getEffectiveItemQty (handles service items).
 *   Purchase: omit (defaults to item.qty).
 *
 * @returns {{ gtot, totalTax, otherChargesTotal, otherChargesGstTotal,
 *             cgst, sgst, igst, ntot, rof }}
 */
export function calcBillTotals(cart, otherCharges, gstEnabled, billType, reverseCharge, qtyFn = null) {
  const getQty = qtyFn || ((item) => parseFloat(item.qty));

  let gtot = 0, totalTax = 0;
  cart.forEach(item => {
    const lineVal = getQty(item) * item.rate * (1 - (item.disc || 0) / 100);
    if (gstEnabled) totalTax += lineVal * (item.grate / 100);
    gtot += lineVal;
  });

  let otherChargesTotal = 0, otherChargesGstTotal = 0;
  if (otherCharges?.length > 0) {
    for (const charge of otherCharges) {
      const amt = parseFloat(charge.amount) || 0;
      otherChargesTotal += amt;
      if (gstEnabled) otherChargesGstTotal += (amt * (parseFloat(charge.gstRate) || 0)) / 100;
    }
  }
  gtot += otherChargesTotal;

  let cgst = 0, sgst = 0, igst = 0;
  if (gstEnabled && billType === 'intra-state') {
    cgst = (totalTax / 2) + (otherChargesGstTotal / 2);
    sgst = (totalTax / 2) + (otherChargesGstTotal / 2);
  } else if (gstEnabled) {
    igst = totalTax + otherChargesGstTotal;
  }

  let ntot = gtot + (reverseCharge ? 0 : totalTax + otherChargesGstTotal);
  const roundedNtot = Math.round(ntot);
  const rof  = roundedNtot - ntot; // exact Number — no toFixed truncation
  ntot = roundedNtot;

  return { gtot, totalTax, otherChargesTotal, otherChargesGstTotal, cgst, sgst, igst, ntot, rof };
}
