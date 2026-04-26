/**
 * Ledger Helper Utility — Mongoose version
 * Handles automatic ledger posting from bills and vouchers.
 * Replaces raw SQLite db.prepare() calls with Mongoose model operations.
 */

import mongoose from 'mongoose';
import { Ledger } from '../../../server/models/index.js';

/* ─────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────── */

/**
 * Auto-post a bill to the ledger (double-entry bookkeeping).
 * Runs inside a Mongoose session transaction.
 *
 * @param {Object} bill     - Bill document (Mongoose doc or plain object)
 * @param {'SALES'|'PURCHASE'|'CREDIT_NOTE'|'DEBIT_NOTE'} billType
 * @param {mongoose.ClientSession} [session] - Optional external session
 * @returns {Promise<mongoose.Document[]>} Created ledger entries
 */
export async function postBillToLedger(bill, billType, session) {
  const narration  = `${billType} Bill No: ${bill.bno} - ${bill.supply}`;
  const ownSession = !session;
  if (ownSession) session = await mongoose.startSession();

  try {
    if (ownSession) session.startTransaction();
    const entries = [];

    if (billType === 'SALES') {
      // Dr  Party (Debtor) ← net total receivable
      entries.push(_entry({ bill, date: bill.bdate, account: bill.supply, type: 'DEBTOR', dr: bill.ntot, cr: 0, narration }));
      // Cr  Sales Account ← gross goods value
      entries.push(_entry({ bill, date: bill.bdate, account: 'Sales', type: 'INCOME', dr: 0, cr: bill.gtot, narration }));
      // Cr  GST Payable ← tax collected (liability)
      if (bill.cgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'CGST Payable', type: 'LIABILITY', dr: 0, cr: bill.cgst, narration }));
      if (bill.sgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'SGST Payable', type: 'LIABILITY', dr: 0, cr: bill.sgst, narration }));
      if (bill.igst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'IGST Payable', type: 'LIABILITY', dr: 0, cr: bill.igst, narration }));

      // BUG FIX 2 — account_type was hardcoded 'EXPENSE'.
      // SALES rof > 0: ntot rounded UP → firm gains → CR entry → INCOME  (was EXPENSE)
      // SALES rof < 0: ntot rounded DOWN → firm loses → DR entry → EXPENSE ✓
      // Rule: DR = EXPENSE, CR = INCOME.
      const rofVal = parseFloat(bill.rof) || 0;
      if (Math.abs(rofVal) > 0) {
        const rofDr = rofVal < 0 ? Math.abs(rofVal) : 0;
        const rofCr = rofVal > 0 ? rofVal           : 0;
        entries.push(_entry({
          bill, date: bill.bdate, account: 'Round Off',
          type: rofDr > 0 ? 'EXPENSE' : 'INCOME',   // FIX: was always 'EXPENSE'
          dr: rofDr,
          cr: rofCr,
          narration: `Round Off on ${narration}`,
        }));
      }

    } else if (billType === 'PURCHASE') {
      // Dr  Purchase Account ← gross goods value
      entries.push(_entry({ bill, date: bill.bdate, account: 'Purchase', type: 'EXPENSE', dr: bill.gtot, cr: 0, narration }));
      // Dr  GST Input Credit ← tax paid (asset, recoverable)
      if (bill.cgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'CGST Input Credit', type: 'ASSET', dr: bill.cgst, cr: 0, narration }));
      if (bill.sgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'SGST Input Credit', type: 'ASSET', dr: bill.sgst, cr: 0, narration }));
      if (bill.igst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'IGST Input Credit', type: 'ASSET', dr: bill.igst, cr: 0, narration }));
      // Cr  Party (Creditor) ← net total payable to supplier
      entries.push(_entry({ bill, date: bill.bdate, account: bill.supply, type: 'CREDITOR', dr: 0, cr: bill.ntot, narration }));

      // PURCHASE round-off — direction is the OPPOSITE of SALES:
      //
      //   PURCHASE structure:
      //     DR side = gtot + GST  (multiple entries summing to gtot+GST)
      //     CR side = ntot        (single creditor entry)
      //   ntot = gtot + GST + rof  →  CR already contains rof; DR does not.
      //
      //   rof > 0: ntot (CR) exceeds gtot+GST (DR) by rof  → add rof to DR
      //   rof < 0: ntot (CR) is less than gtot+GST (DR) by |rof| → add |rof| to CR
      //
      // BUG FIX 2 — account_type was hardcoded 'EXPENSE'.
      // PURCHASE rof > 0: firm pays more → DR entry → EXPENSE ✓
      // PURCHASE rof < 0: firm pays less, saves money → CR entry → INCOME  (was EXPENSE)
      // Rule: DR = EXPENSE, CR = INCOME.
      const rofVal = parseFloat(bill.rof) || 0;
      if (Math.abs(rofVal) > 0) {
        const rofDr = rofVal > 0 ? rofVal           : 0;
        const rofCr = rofVal < 0 ? Math.abs(rofVal) : 0;
        entries.push(_entry({
          bill, date: bill.bdate, account: 'Round Off',
          type: rofDr > 0 ? 'EXPENSE' : 'INCOME',   // FIX: was always 'EXPENSE'
          dr: rofDr,
          cr: rofCr,
          narration: `Round Off on ${narration}`,
        }));
      }

    // BUG FIX — CREDIT_NOTE and DEBIT_NOTE were declared in the JSDoc but had
    // no code branch. Any call with these types produced entries = [], then
    // Ledger.insertMany([]) returned [] silently — zero rows written, no error,
    // caller unaware. Added correct double-entry logic for both.
    //
    // CREDIT_NOTE = credit memo / sales return: reverse the original SALES entry.
    } else if (billType === 'CREDIT_NOTE') {
      // Cr  Party (Debtor) ← reduce amount owed by customer
      entries.push(_entry({ bill, date: bill.bdate, account: bill.supply, type: 'DEBTOR', dr: 0, cr: bill.ntot, narration }));
      // Dr  Sales ← reverse revenue
      entries.push(_entry({ bill, date: bill.bdate, account: 'Sales', type: 'INCOME', dr: bill.gtot, cr: 0, narration }));
      // Dr  GST Payable ← reverse tax liability
      if (bill.cgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'CGST Payable', type: 'LIABILITY', dr: bill.cgst, cr: 0, narration }));
      if (bill.sgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'SGST Payable', type: 'LIABILITY', dr: bill.sgst, cr: 0, narration }));
      if (bill.igst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'IGST Payable', type: 'LIABILITY', dr: bill.igst, cr: 0, narration }));
      // BUG FIX 2 — account_type was hardcoded 'EXPENSE'.
      // CREDIT_NOTE reverses SALES, so rof direction is inverted relative to SALES:
      //   rof > 0 → DR entry → EXPENSE ✓
      //   rof < 0 → CR entry → firm gains → INCOME  (was EXPENSE)
      // Rule: DR = EXPENSE, CR = INCOME.
      const rofVal = parseFloat(bill.rof) || 0;
      if (Math.abs(rofVal) > 0) {
        const rofDr = rofVal > 0 ? rofVal           : 0;
        const rofCr = rofVal < 0 ? Math.abs(rofVal) : 0;
        entries.push(_entry({
          bill, date: bill.bdate, account: 'Round Off',
          type: rofDr > 0 ? 'EXPENSE' : 'INCOME',   // FIX: was always 'EXPENSE'
          dr: rofDr,
          cr: rofCr,
          narration: `Round Off on ${narration}`,
        }));
      }

    // DEBIT_NOTE = debit memo / purchase return: reverse the original PURCHASE entry.
    } else if (billType === 'DEBIT_NOTE') {
      // Dr  Party (Creditor) ← reduce amount owed to supplier
      entries.push(_entry({ bill, date: bill.bdate, account: bill.supply, type: 'CREDITOR', dr: bill.ntot, cr: 0, narration }));
      // Cr  Purchase ← reverse purchase cost
      entries.push(_entry({ bill, date: bill.bdate, account: 'Purchase', type: 'EXPENSE', dr: 0, cr: bill.gtot, narration }));
      // Cr  GST Input Credit ← reverse input credit claim
      if (bill.cgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'CGST Input Credit', type: 'ASSET', dr: 0, cr: bill.cgst, narration }));
      if (bill.sgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'SGST Input Credit', type: 'ASSET', dr: 0, cr: bill.sgst, narration }));
      if (bill.igst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'IGST Input Credit', type: 'ASSET', dr: 0, cr: bill.igst, narration }));
      // BUG FIX 2 — account_type was hardcoded 'EXPENSE'.
      // DEBIT_NOTE reverses PURCHASE, so rof direction is inverted relative to PURCHASE:
      //   rof > 0 → CR entry → firm gains → INCOME  (was EXPENSE)
      //   rof < 0 → DR entry → EXPENSE ✓
      // Rule: DR = EXPENSE, CR = INCOME.
      const rofVal = parseFloat(bill.rof) || 0;
      if (Math.abs(rofVal) > 0) {
        const rofDr = rofVal < 0 ? Math.abs(rofVal) : 0;
        const rofCr = rofVal > 0 ? rofVal           : 0;
        entries.push(_entry({
          bill, date: bill.bdate, account: 'Round Off',
          type: rofDr > 0 ? 'EXPENSE' : 'INCOME',   // FIX: was always 'EXPENSE'
          dr: rofDr,
          cr: rofCr,
          narration: `Round Off on ${narration}`,
        }));
      }
    }

    const created = await Ledger.insertMany(entries, { session });
    if (ownSession) await session.commitTransaction();
    return created;

  } catch (err) {
    if (ownSession) await session.abortTransaction();
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
}

/**
 * Auto-post a voucher to the ledger.
 *
 * @param {Object} voucher  - Voucher document
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<mongoose.Document[]>} Created ledger entries
 */
export async function postVoucherToLedger(voucher, session) {
  const narration  = `${voucher.voucher_type} Voucher No: ${voucher.voucher_no} - ${voucher.narration ?? ''}`;
  const ownSession = !session;
  if (ownSession) session = await mongoose.startSession();

  try {
    if (ownSession) session.startTransaction();
    const entries = [];

    // BUG FIX — voucher_id (the integer sequence field) was absent from base.
    // voucherController.updateVoucher and deleteVoucher both do:
    //   Ledger.deleteMany({ voucher_id, firm_id })
    // Without voucher_id on the stored entries, those deleteMany calls find
    // nothing — stale ledger rows accumulate after every voucher edit or delete.
    const base = {
      firm_id:          voucher.firm_id,
      transaction_date: voucher.voucher_date,
      voucher_id:       voucher.voucher_id,   // FIX: was absent
      voucher_type:     voucher.voucher_type,
      voucher_no:       voucher.voucher_no,
    };

    if (voucher.voucher_type === 'PAYMENT') {
      // Cr  Bank/Cash (source)
      entries.push({ ...base, account_head: voucher.paid_from_account, account_type: voucher.paid_from_type,  debit_amount: 0,              credit_amount: voucher.amount, narration });
      // Dr  Expense/Party (destination)
      entries.push({ ...base, account_head: voucher.paid_to_account,   account_type: voucher.paid_to_type,    debit_amount: voucher.amount, credit_amount: 0,             narration });

    } else if (voucher.voucher_type === 'RECEIPT') {
      // Dr  Bank/Cash (destination)
      entries.push({ ...base, account_head: voucher.received_in_account,   account_type: voucher.received_in_type,   debit_amount: voucher.amount, credit_amount: 0,             narration });
      // Cr  Income/Party (source)
      entries.push({ ...base, account_head: voucher.received_from_account, account_type: voucher.received_from_type, debit_amount: 0,              credit_amount: voucher.amount, narration });

    } else if (voucher.voucher_type === 'JOURNAL') {
      // Guard: journal_entries may already be a JS Array if Mongoose hydrated it
      // from an Array-typed schema field — JSON.parse() throws on an Array value.
      const rawLines = voucher.journal_entries;
      const lines    = Array.isArray(rawLines)
        ? rawLines
        : JSON.parse(rawLines || '[]');

      for (const line of lines) {
        entries.push({
          ...base,
          account_head:  line.account_name,
          account_type:  line.account_type,
          debit_amount:  line.debit  ?? 0,
          credit_amount: line.credit ?? 0,
          narration:     line.narration ?? narration,
        });
      }
    }

    const created = await Ledger.insertMany(entries, { session });
    if (ownSession) await session.commitTransaction();
    return created;

  } catch (err) {
    if (ownSession) await session.abortTransaction();
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
}

/**
 * Create a single ledger entry.
 *
 * @param {Object}   params
 * @param {ObjectId} params.firmId
 * @param {string}   params.date
 * @param {string}   params.accountName
 * @param {string}   params.accountType
 * @param {number}   params.debit
 * @param {number}   params.credit
 * @param {string}   params.narration
 * @param {number}   [params.voucherId]    - Integer sequence ID of the parent voucher/bill
 * @param {string}   [params.voucherType]
 * @param {string}   [params.voucherNo]
 * @param {string}   [params.refType]      - e.g. 'BILL', 'VOUCHER'
 * @param {ObjectId} [params.refId]
 * @param {ObjectId} [params.billId]
 * @param {ObjectId} [params.partyId]
 * @param {mongoose.ClientSession} [params.session]
 * @returns {Promise<mongoose.Document>}
 */
export async function createLedgerEntry({
  firmId, date, accountName, accountType, debit, credit, narration,
  // BUG FIX — all these fields were completely absent from the function.
  // createLedgerEntry is a public API; every caller produced entries with no
  // voucher_id, ref_type, bill_id, etc. — making those entries invisible to
  // every deleteMany and aggregate operation that keys on those fields, and
  // making them impossible to reverse via reverseLedgerEntries.
  voucherId   = null,
  voucherType = null,
  voucherNo   = null,
  refType     = null,
  refId       = null,
  billId      = null,
  partyId     = null,
  session,
}) {
  const doc = new Ledger({
    firm_id:          firmId,
    transaction_date: date,
    account_head:     accountName,
    account_type:     accountType,
    debit_amount:     debit,
    credit_amount:    credit,
    narration,
    voucher_id:       voucherId,
    voucher_type:     voucherType,
    voucher_no:       voucherNo,
    ref_type:         refType,
    ref_id:           refId,
    bill_id:          billId,
    party_id:         partyId,
  });
  return session ? doc.save({ session }) : doc.save();
}

/**
 * Reverse all ledger entries for a given bill_id or voucher reference.
 * Creates mirror entries with Dr/Cr swapped and prefixes narration with "REVERSAL: ".
 *
 * @param {{ bill_id?: ObjectId, voucher_type?: string, voucher_no?: string, firm_id: ObjectId }} filter
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<mongoose.Document[]>}
 */
export async function reverseLedgerEntries(filter, session) {
  // BUG FIX — unlike every other mutating function in this file, this function
  // had no own-session management. Without it, a caller that omits the session
  // argument gets two completely separate, unguarded DB operations:
  //   1. Ledger.find()       ← reads originals (outside any transaction)
  //   2. Ledger.insertMany() ← inserts reversals (outside any transaction)
  // A crash, timeout, or error between them leaves the ledger in a half-reversed
  // state with no rollback possible.
  const ownSession = !session;
  if (ownSession) session = await mongoose.startSession();

  try {
    if (ownSession) session.startTransaction();

    const query = { firm_id: filter.firm_id };
    if (filter.bill_id)      query.bill_id      = filter.bill_id;
    if (filter.voucher_no)   query.voucher_no   = filter.voucher_no;
    if (filter.voucher_type) query.voucher_type = filter.voucher_type;

    const originals = await Ledger.find(query).session(session).lean();

    const reversals = originals.map(e => ({
      firm_id:          e.firm_id,
      transaction_date: e.transaction_date,
      account_head:     e.account_head,
      account_type:     e.account_type,
      debit_amount:     e.credit_amount,   // swap Dr ↔ Cr
      credit_amount:    e.debit_amount,    // swap Dr ↔ Cr
      narration:        `REVERSAL: ${e.narration}`,
      voucher_id:       e.voucher_id,
      voucher_type:     e.voucher_type,
      voucher_no:       e.voucher_no,
      bill_id:          e.bill_id,
      party_id:         e.party_id,
      ref_type:         e.ref_type,
      ref_id:           e.ref_id,
    }));

    const created = await Ledger.insertMany(reversals, { session });
    if (ownSession) await session.commitTransaction();
    return created;

  } catch (err) {
    if (ownSession) await session.abortTransaction();
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
}

/**
 * Get debit/credit balance for a specific account head within a firm.
 *
 * @param {ObjectId|string} firmId
 * @param {string}          accountName
 * @param {string}          [toDate]  - ISO date string upper bound (inclusive)
 * @returns {Promise<{ totalDebit, totalCredit, balance, balanceType, balanceAmount }>}
 */
export async function getAccountBalance(firmId, accountName, toDate = null) {
  const match = { firm_id: new mongoose.Types.ObjectId(firmId), account_head: accountName };
  if (toDate) match.transaction_date = { $lte: toDate };

  const [result] = await Ledger.aggregate([
    { $match: match },
    {
      $group: {
        _id:         null,
        totalDebit:  { $sum: '$debit_amount' },
        totalCredit: { $sum: '$credit_amount' },
      },
    },
  ]);

  const totalDebit  = result?.totalDebit  ?? 0;
  const totalCredit = result?.totalCredit ?? 0;
  const balance     = totalDebit - totalCredit;

  return {
    totalDebit,
    totalCredit,
    balance,
    balanceType:   balance >= 0 ? 'Dr' : 'Cr',
    balanceAmount: Math.abs(balance),
  };
}

/**
 * Get trial balance for a firm over a date range.
 *
 * Returns the cumulative running balance for every account that had activity
 * in [fromDate, toDate].  Balances are accumulated from the beginning of time
 * up to toDate (standard trial balance convention), but only accounts with at
 * least one transaction in the requested period are included.
 *
 * BUG FIX — fromDate was documented and accepted but never used.  The
 * aggregation contained only { $lte: toDate }, so callers requesting a
 * period-scoped trial balance (e.g. April–June) received every account that
 * had ever existed, regardless of whether it was active in the period.
 * Fixed via a distinct() pre-filter that collects accounts active in
 * [fromDate, toDate], then restricts the balance aggregation to that set.
 *
 * @param {ObjectId|string} firmId
 * @param {string}          fromDate  - YYYY-MM-DD (period start, inclusive)
 * @param {string}          toDate    - YYYY-MM-DD (period end,   inclusive)
 * @returns {Promise<Array<{ accountName, accountType, debit, credit }>>}
 */
export async function getTrialBalance(firmId, fromDate, toDate) {
  const fid = new mongoose.Types.ObjectId(firmId);

  // Step 1: which accounts had activity in the requested period?
  const activeInPeriod = await Ledger.distinct('account_head', {
    firm_id:          fid,
    transaction_date: { $gte: fromDate, $lte: toDate },
  });

  if (activeInPeriod.length === 0) return [];

  // Step 2: for those accounts, compute their running balance up to toDate.
  const rows = await Ledger.aggregate([
    {
      $match: {
        firm_id:          fid,
        account_head:     { $in: activeInPeriod },
        transaction_date: { $lte: toDate },
      },
    },
    {
      $group: {
        _id:         { account_head: '$account_head', account_type: '$account_type' },
        totalDebit:  { $sum: '$debit_amount' },
        totalCredit: { $sum: '$credit_amount' },
      },
    },
    {
      $addFields: {
        balance: { $subtract: ['$totalDebit', '$totalCredit'] },
      },
    },
    {
      $project: {
        _id:         0,
        accountName: '$_id.account_head',
        accountType: '$_id.account_type',
        debit:  { $cond: [{ $gte: ['$balance', 0] }, '$balance',           0] },
        credit: { $cond: [{ $lt:  ['$balance', 0] }, { $abs: '$balance' }, 0] },
      },
    },
    { $sort: { accountType: 1, accountName: 1 } },
  ]);

  return rows;
}

/* ─────────────────────────────────────────────
   PRIVATE HELPERS
───────────────────────────────────────────── */

/**
 * Build a plain ledger entry object for Ledger.insertMany.
 * All grouping and audit fields are set here so no call site can omit them.
 */
function _entry({ bill, date, account, type, dr, cr, narration }) {
  return {
    firm_id:          bill.firm_id,
    transaction_date: date,
    account_head:     account,
    account_type:     type,
    debit_amount:     dr,
    credit_amount:    cr,
    narration,
    voucher_id:       bill.voucher_id   ?? null,
    voucher_no:       bill.bno          ?? null,
    voucher_type:     bill.btype        ?? null,
    ref_type:         'BILL',
    ref_id:           bill._id ?? bill.id ?? null,
    bill_id:          bill._id ?? bill.id ?? null,
    party_id:         bill.party_id     ?? null,
  };
}