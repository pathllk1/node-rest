/**
 * inventoryLedgerHelper.js — perpetual inventory ledger posting.
 *
 * Replaces the old single-function postPurchaseLedger / postSalesLedger that
 * lived inside the individual controllers, and replaces the SALES / PURCHASE /
 * CREDIT_NOTE / DEBIT_NOTE branches of ledgerHelper.js postBillToLedger.
 *
 * Accounting model: PERPETUAL INVENTORY
 *   Purchase  → Inventory A/c DR (ASSET, per item line)  instead of Purchase A/c DR (EXPENSE)
 *   Sale      → COGS A/c DR (EXPENSE) + Inventory A/c CR (ASSET) at WAC, one pair per goods line
 *   Credit Note → reverse sales revenue + Inventory DR, COGS CR (goods return)
 *   Debit Note  → reverse purchase creditor + Inventory CR (goods return to supplier)
 *
 * Trial Balance always balances because every postXxx function produces
 * ΣDR = ΣCR across the docs array before insertMany.
 */

import { Ledger } from '../../../models/index.js';
import {
  resolveLedgerPostingAccount,
  normalizeLedgerAccountHead,
} from '../../../utils/mongo/ledgerAccountResolver.js';

function assertBalancedVoucher(docs, voucherType, billNo) {
  const totals = docs.reduce((acc, doc) => {
    acc.debit += parseFloat(doc.debit_amount) || 0;
    acc.credit += parseFloat(doc.credit_amount) || 0;
    return acc;
  }, { debit: 0, credit: 0 });

  const diff = Number((totals.debit - totals.credit).toFixed(6));
  if (Math.abs(diff) >= 0.01) {
    throw new Error(
      `Unbalanced ${voucherType} ledger for ${billNo}: debit ${totals.debit.toFixed(2)} vs credit ${totals.credit.toFixed(2)} (diff ${diff.toFixed(2)})`
    );
  }
}


/* ─── PURCHASE ─────────────────────────────────────────────────────────────── */

/**
 * @param {Object}  p
 * @param {string}  p.firmId
 * @param {ObjectId} p.billId
 * @param {number}  p.voucherId        integer group id
 * @param {string}  p.billNo
 * @param {string}  p.billDate
 * @param {Object}  p.party            DB party document
 * @param {number}  p.ntot
 * @param {number}  p.cgst
 * @param {number}  p.sgst
 * @param {number}  p.igst
 * @param {number}  p.rof
 * @param {Array}   p.otherCharges
 * @param {Array}   p.purchasedItems   [{ stockId, stockRegId, item, lineValue }]
 *                                     One entry per goods cart line.
 *                                     lineValue = qty × rate × (1-disc) — taxable cost.
 * @param {string}  p.actorUsername
 * @param {mongoose.ClientSession} [p.session]
 */
export async function postPurchaseLedger({
  firmId, billId, voucherId, billNo, billDate, party,
  ntot, cgst, sgst, igst, rof, otherCharges,
  purchasedItems, actorUsername, session = null,
}) {
  const base = {
    firm_id:          firmId,
    voucher_id:       voucherId,
    voucher_type:     'PURCHASE',
    voucher_no:       billNo,
    bill_id:          billId,
    ref_type:         'BILL',
    ref_id:           billId,
    transaction_date: billDate,
    created_by:       actorUsername,
  };
  const ins = session ? [{ session }] : [];
  const docs = [];

  // 1. Supplier / Party CR (creditor — total payable = ntot)
  const partyLedger = await resolveLedgerPostingAccount({
    firmId, accountHead: party.firm, fallbackType: 'CREDITOR',
    partyId: party._id ?? party.id ?? null, session,
  });
  docs.push({
    ...base,
    account_head:  partyLedger.accountHead,
    account_type:  partyLedger.accountType,
    debit_amount:  0,
    credit_amount: ntot,
    narration:     `Purchase Bill No: ${billNo}`,
    party_id:      party._id ?? party.id ?? null,
    stock_id:      null, stock_reg_id: null,
  });

  // 2. GST Input Credit DR (asset — recoverable from government)
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Input Credit', account_type: 'ASSET', debit_amount: cgst, credit_amount: 0, narration: `CGST Input on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Input Credit', account_type: 'ASSET', debit_amount: sgst, credit_amount: 0, narration: `SGST Input on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Input Credit', account_type: 'ASSET', debit_amount: igst, credit_amount: 0, narration: `IGST Input on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });

  // 3. Round-off
  // PURCHASE: rof > 0 → ntot > (gtot+GST) → extra DR closes gap → EXPENSE
  //           rof < 0 → ntot < (gtot+GST) → extra CR closes gap → INCOME
  if (Math.abs(parseFloat(rof)) > 0) {
    const rofVal = parseFloat(rof);
    const roundOffLedger = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'GENERAL', session });
    docs.push({ ...base, account_head: roundOffLedger.accountHead, account_type: roundOffLedger.accountType, debit_amount: rofVal > 0 ? rofVal : 0, credit_amount: rofVal < 0 ? Math.abs(rofVal) : 0, narration: `Round Off on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  }

  // 4. Other Charges DR (expense — freight, packing, etc.)
  if (otherCharges?.length > 0) {
    for (const charge of otherCharges) {
      const amt = parseFloat(charge.amount) || 0;
      if (amt > 0) {
        const chargeLedger = await resolveLedgerPostingAccount({ firmId, accountHead: normalizeLedgerAccountHead(charge.name || charge.type, 'Other Charges'), fallbackType: 'EXPENSE', session });
        docs.push({ ...base, account_head: chargeLedger.accountHead, account_type: chargeLedger.accountType, debit_amount: amt, credit_amount: 0, narration: `${chargeLedger.accountHead} on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
      }
    }
  }

  // 5. Inventory DR per goods line (ASSET — perpetual inventory)
  //    Each carries stock_id + stock_reg_id for full audit linkage.
  for (const pi of purchasedItems) {
    if (!pi.stockId || !(pi.lineValue > 0)) continue;
    docs.push({
      ...base,
      account_head:  'Inventory',
      account_type:  'ASSET',
      debit_amount:  pi.lineValue,
      credit_amount: 0,
      narration:     `Purchase of ${pi.item} — Bill No: ${billNo}`,
      party_id:      null,
      stock_id:      pi.stockId    ?? null,
      stock_reg_id:  pi.stockRegId ?? null,
    });
  }

  assertBalancedVoucher(docs, 'PURCHASE', billNo);
  await Ledger.insertMany(docs, ...ins);
}

/* ─── SALES ────────────────────────────────────────────────────────────────── */

/**
 * @param {Object} p
 * @param {number} p.taxableItemsTotal  sum of goods selling line values (for Sales A/c CR)
 * @param {Array}  p.cogsLines          [{ stockId, stockRegId, item, cogsValue }]
 *                                      cogsValue = qty × WAC at moment of sale.
 *                                      Empty / omitted for service-only bills.
 */
export async function postSalesLedger({
  firmId, billId, voucherId, billNo, billDate, party,
  ntot, cgst, sgst, igst, rof, otherCharges,
  taxableItemsTotal, cogsLines = [], actorUsername, session = null,
}) {
  const base = {
    firm_id: firmId, voucher_id: voucherId, voucher_type: 'SALES',
    voucher_no: billNo, bill_id: billId, ref_type: 'BILL', ref_id: billId,
    transaction_date: billDate, created_by: actorUsername,
  };
  const ins  = session ? [{ session }] : [];
  const docs = [];

  // 1. Party DR (debtor — ntot receivable)
  const partyLedger = await resolveLedgerPostingAccount({
    firmId, accountHead: party.firm, fallbackType: 'DEBTOR',
    partyId: party._id ?? party.id ?? null, session,
  });
  docs.push({
    ...base,
    account_head: partyLedger.accountHead, account_type: partyLedger.accountType,
    debit_amount: ntot, credit_amount: 0,
    narration: `Sales Bill No: ${billNo}`,
    party_id: party._id ?? party.id ?? null, stock_id: null, stock_reg_id: null,
  });

  // 2. GST Payable CR (liability — collected from customer)
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Payable', account_type: 'LIABILITY', debit_amount: 0, credit_amount: cgst, narration: `CGST on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Payable', account_type: 'LIABILITY', debit_amount: 0, credit_amount: sgst, narration: `SGST on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Payable', account_type: 'LIABILITY', debit_amount: 0, credit_amount: igst, narration: `IGST on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });

  // 3. Round-off
  // SALES: rof > 0 → customer pays more → firm gains → CR → INCOME
  //        rof < 0 → customer pays less → firm loses → DR → EXPENSE
  if (Math.abs(parseFloat(rof)) > 0) {
    const rofVal = parseFloat(rof);
    const roundOffLedger = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'GENERAL', session });
    docs.push({ ...base, account_head: roundOffLedger.accountHead, account_type: roundOffLedger.accountType, debit_amount: rofVal < 0 ? Math.abs(rofVal) : 0, credit_amount: rofVal > 0 ? rofVal : 0, narration: `Round Off on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  }

  // 4. Other Charges CR (income — freight/packing charged to customer)
  if (otherCharges?.length > 0) {
    for (const charge of otherCharges) {
      const amt = parseFloat(charge.amount) || 0;
      if (amt > 0) {
        const chargeLedger = await resolveLedgerPostingAccount({ firmId, accountHead: normalizeLedgerAccountHead(charge.name || charge.type, 'Other Charges'), fallbackType: 'INCOME', session });
        docs.push({ ...base, account_head: chargeLedger.accountHead, account_type: chargeLedger.accountType, debit_amount: 0, credit_amount: amt, narration: `${chargeLedger.accountHead} on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
      }
    }
  }

  // 5. Sales A/c CR (income — goods/items total, excludes charges)
  docs.push({ ...base, account_head: 'Sales', account_type: 'INCOME', debit_amount: 0, credit_amount: taxableItemsTotal, narration: `Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });

  // 6. COGS DR + Inventory CR per goods line (skipped for service items)
  for (const cl of cogsLines) {
    if (!cl.stockId || !(cl.cogsValue > 0)) continue;
    docs.push({ ...base, account_head: 'COGS', account_type: 'EXPENSE', debit_amount: cl.cogsValue, credit_amount: 0, narration: `Cost of goods: ${cl.item} — Bill No: ${billNo}`, party_id: null, stock_id: cl.stockId ?? null, stock_reg_id: cl.stockRegId ?? null });
    docs.push({ ...base, account_head: 'Inventory', account_type: 'ASSET', debit_amount: 0, credit_amount: cl.cogsValue, narration: `Inventory out: ${cl.item} — Bill No: ${billNo}`, party_id: null, stock_id: cl.stockId ?? null, stock_reg_id: cl.stockRegId ?? null });
  }

  assertBalancedVoucher(docs, 'SALES', billNo);
  await Ledger.insertMany(docs, ...ins);
}

/* ─── CREDIT NOTE (sales return) ──────────────────────────────────────────── */

/**
 * Reverse sales revenue and return goods to inventory.
 * @param {Array} p.cogsLines  same shape as postSalesLedger cogsLines
 *                             cogsValue = cost at which goods were originally sold
 */
export async function postCreditNoteLedger({
  firmId, billId, voucherId, billNo, billDate, party,
  ntot, cgst, sgst, igst, rof, otherCharges,
  taxableItemsTotal, cogsLines = [], actorUsername, session = null,
}) {
  const base = {
    firm_id: firmId, voucher_id: voucherId, voucher_type: 'CREDIT_NOTE',
    voucher_no: billNo, bill_id: billId, ref_type: 'BILL', ref_id: billId,
    transaction_date: billDate, created_by: actorUsername,
  };
  const ins  = session ? [{ session }] : [];
  const docs = [];

  const partyLedger = await resolveLedgerPostingAccount({ firmId, accountHead: party.firm, fallbackType: 'DEBTOR', partyId: party._id ?? party.id ?? null, session });

  // Party CR (customer owes less — reduces debtor balance)
  docs.push({ ...base, account_head: partyLedger.accountHead, account_type: partyLedger.accountType, debit_amount: 0, credit_amount: ntot, narration: `Credit Note No: ${billNo}`, party_id: party._id ?? party.id ?? null, stock_id: null, stock_reg_id: null });

  // Reverse GST Payable (liability reduces)
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Payable', account_type: 'LIABILITY', debit_amount: cgst, credit_amount: 0, narration: `CGST reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Payable', account_type: 'LIABILITY', debit_amount: sgst, credit_amount: 0, narration: `SGST reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Payable', account_type: 'LIABILITY', debit_amount: igst, credit_amount: 0, narration: `IGST reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });

  // Round-off reversal (mirror of sales: if sales had CR rof, credit note has DR rof)
  if (Math.abs(parseFloat(rof)) > 0) {
    const rofVal = parseFloat(rof);
    const roundOffLedger = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'GENERAL', session });
    docs.push({ ...base, account_head: roundOffLedger.accountHead, account_type: roundOffLedger.accountType, debit_amount: rofVal > 0 ? rofVal : 0, credit_amount: rofVal < 0 ? Math.abs(rofVal) : 0, narration: `Round Off reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  }

  // Other charges reversal DR
  if (otherCharges?.length > 0) {
    for (const charge of otherCharges) {
      const amt = parseFloat(charge.amount) || 0;
      if (amt > 0) {
        const chargeLedger = await resolveLedgerPostingAccount({ firmId, accountHead: normalizeLedgerAccountHead(charge.name || charge.type, 'Other Charges'), fallbackType: 'INCOME', session });
        docs.push({ ...base, account_head: chargeLedger.accountHead, account_type: chargeLedger.accountType, debit_amount: amt, credit_amount: 0, narration: `${chargeLedger.accountHead} reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
      }
    }
  }

  // Sales A/c DR (reverse revenue)
  docs.push({ ...base, account_head: 'Sales', account_type: 'INCOME', debit_amount: taxableItemsTotal, credit_amount: 0, narration: `Sales reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });

  // Goods back in inventory: Inventory DR, COGS CR
  for (const cl of cogsLines) {
    if (!cl.stockId || !(cl.cogsValue > 0)) continue;
    docs.push({ ...base, account_head: 'Inventory', account_type: 'ASSET', debit_amount: cl.cogsValue, credit_amount: 0, narration: `Goods returned: ${cl.item} — Credit Note No: ${billNo}`, party_id: null, stock_id: cl.stockId ?? null, stock_reg_id: cl.stockRegId ?? null });
    docs.push({ ...base, account_head: 'COGS', account_type: 'EXPENSE', debit_amount: 0, credit_amount: cl.cogsValue, narration: `COGS reversal: ${cl.item} — Credit Note No: ${billNo}`, party_id: null, stock_id: cl.stockId ?? null, stock_reg_id: cl.stockRegId ?? null });
  }

  assertBalancedVoucher(docs, 'CREDIT_NOTE', billNo);
  await Ledger.insertMany(docs, ...ins);
}

/* ─── DEBIT NOTE (purchase return) ────────────────────────────────────────── */

/**
 * Reverse purchase creditor and remove goods from inventory.
 * @param {Array} p.purchasedItems  [{ stockId, stockRegId, item, lineValue }]
 *                                  lineValue = returned goods value at original net purchase cost
 */
export async function postDebitNoteLedger({
  firmId, billId, voucherId, billNo, billDate, party,
  ntot, cgst, sgst, igst, rof, otherCharges,
  purchasedItems = [], actorUsername, session = null,
}) {
  const base = {
    firm_id: firmId, voucher_id: voucherId, voucher_type: 'DEBIT_NOTE',
    voucher_no: billNo, bill_id: billId, ref_type: 'BILL', ref_id: billId,
    transaction_date: billDate, created_by: actorUsername,
  };
  const ins  = session ? [{ session }] : [];
  const docs = [];

  const partyLedger = await resolveLedgerPostingAccount({ firmId, accountHead: party.firm, fallbackType: 'CREDITOR', partyId: party._id ?? party.id ?? null, session });

  // Party DR (creditor reduces — we owe supplier less)
  docs.push({ ...base, account_head: partyLedger.accountHead, account_type: partyLedger.accountType, debit_amount: ntot, credit_amount: 0, narration: `Debit Note No: ${billNo}`, party_id: party._id ?? party.id ?? null, stock_id: null, stock_reg_id: null });

  // GST Input Credit CR (forfeited on return)
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Input Credit', account_type: 'ASSET', debit_amount: 0, credit_amount: cgst, narration: `CGST Input reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Input Credit', account_type: 'ASSET', debit_amount: 0, credit_amount: sgst, narration: `SGST Input reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Input Credit', account_type: 'ASSET', debit_amount: 0, credit_amount: igst, narration: `IGST Input reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });

  // Round-off reversal (mirror of purchase: if purchase had DR rof, debit note has CR rof)
  if (Math.abs(parseFloat(rof)) > 0) {
    const rofVal = parseFloat(rof);
    const roundOffLedger = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'GENERAL', session });
    docs.push({ ...base, account_head: roundOffLedger.accountHead, account_type: roundOffLedger.accountType, debit_amount: rofVal < 0 ? Math.abs(rofVal) : 0, credit_amount: rofVal > 0 ? rofVal : 0, narration: `Round Off reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
  }

  // Other charges CR (reverse expense)
  if (otherCharges?.length > 0) {
    for (const charge of otherCharges) {
      const amt = parseFloat(charge.amount) || 0;
      if (amt > 0) {
        const chargeLedger = await resolveLedgerPostingAccount({ firmId, accountHead: normalizeLedgerAccountHead(charge.name || charge.type, 'Other Charges'), fallbackType: 'EXPENSE', session });
        docs.push({ ...base, account_head: chargeLedger.accountHead, account_type: chargeLedger.accountType, debit_amount: 0, credit_amount: amt, narration: `${chargeLedger.accountHead} reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null });
      }
    }
  }

  // Inventory CR per goods line (goods leave, inventory value reduces)
  for (const pi of purchasedItems) {
    if (!pi.stockId || !(pi.lineValue > 0)) continue;
    docs.push({ ...base, account_head: 'Inventory', account_type: 'ASSET', debit_amount: 0, credit_amount: pi.lineValue, narration: `Goods returned to supplier: ${pi.item} — Debit Note No: ${billNo}`, party_id: null, stock_id: pi.stockId ?? null, stock_reg_id: pi.stockRegId ?? null });
  }

  assertBalancedVoucher(docs, 'DEBIT_NOTE', billNo);
  await Ledger.insertMany(docs, ...ins);
}
