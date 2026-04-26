/**
 * Ledger Helper Utility
 * Handles automatic ledger posting from bills and vouchers
 */

import { db } from './db.js';

/**
 * Auto-post bill to ledger (double-entry)
 * @param {Object} bill - Bill object with all details
 * @param {string} billType - 'SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'
 * @returns {Array} Array of ledger entry IDs created
 */
function postBillToLedger(bill, billType) {
  const entries = [];
  const narration = `${billType} Bill No: ${bill.bill_no} - ${bill.party_name}`;
  
  return db.transaction(() => {
    if (billType === 'SALES') {
      // Debit: Party Account (Sundry Debtors)
      entries.push(createLedgerEntry({
        firmId: bill.firm_id,
        date: bill.bill_date,
        accountName: bill.party_name,
        accountType: 'SUNDRY_DEBTORS',
        debit: bill.net_total,
        credit: 0,
        narration,
        refType: 'BILL',
        refId: bill.id
      }));
      
      // Credit: Sales Account
      entries.push(createLedgerEntry({
        firmId: bill.firm_id,
        date: bill.bill_date,
        accountName: 'Sales',
        accountType: 'SALES',
        debit: 0,
        credit: bill.gross_total,
        narration,
        refType: 'BILL',
        refId: bill.id
      }));
      
      // Credit: CGST Output
      if (bill.cgst > 0) {
        entries.push(createLedgerEntry({
          firmId: bill.firm_id,
          date: bill.bill_date,
          accountName: 'CGST Output',
          accountType: 'DUTIES_TAXES',
          debit: 0,
          credit: bill.cgst,
          narration,
          refType: 'BILL',
          refId: bill.id
        }));
      }
      
      // Credit: SGST Output
      if (bill.sgst > 0) {
        entries.push(createLedgerEntry({
          firmId: bill.firm_id,
          date: bill.bill_date,
          accountName: 'SGST Output',
          accountType: 'DUTIES_TAXES',
          debit: 0,
          credit: bill.sgst,
          narration,
          refType: 'BILL',
          refId: bill.id
        }));
      }
      
      // Credit: IGST Output
      if (bill.igst > 0) {
        entries.push(createLedgerEntry({
          firmId: bill.firm_id,
          date: bill.bill_date,
          accountName: 'IGST Output',
          accountType: 'DUTIES_TAXES',
          debit: 0,
          credit: bill.igst,
          narration,
          refType: 'BILL',
          refId: bill.id
        }));
      }
    } else if (billType === 'PURCHASE') {
      // Debit: Purchase Account
      entries.push(createLedgerEntry({
        firmId: bill.firm_id,
        date: bill.bill_date,
        accountName: 'Purchase',
        accountType: 'PURCHASE',
        debit: bill.gross_total,
        credit: 0,
        narration,
        refType: 'BILL',
        refId: bill.id
      }));
      
      // Debit: CGST Input
      if (bill.cgst > 0) {
        entries.push(createLedgerEntry({
          firmId: bill.firm_id,
          date: bill.bill_date,
          accountName: 'CGST Input',
          accountType: 'DUTIES_TAXES',
          debit: bill.cgst,
          credit: 0,
          narration,
          refType: 'BILL',
          refId: bill.id
        }));
      }
      
      // Debit: SGST Input
      if (bill.sgst > 0) {
        entries.push(createLedgerEntry({
          firmId: bill.firm_id,
          date: bill.bill_date,
          accountName: 'SGST Input',
          accountType: 'DUTIES_TAXES',
          debit: bill.sgst,
          credit: 0,
          narration,
          refType: 'BILL',
          refId: bill.id
        }));
      }
      
      // Debit: IGST Input
      if (bill.igst > 0) {
        entries.push(createLedgerEntry({
          firmId: bill.firm_id,
          date: bill.bill_date,
          accountName: 'IGST Input',
          accountType: 'DUTIES_TAXES',
          debit: bill.igst,
          credit: 0,
          narration,
          refType: 'BILL',
          refId: bill.id
        }));
      }
      
      // Credit: Party Account (Sundry Creditors)
      entries.push(createLedgerEntry({
        firmId: bill.firm_id,
        date: bill.bill_date,
        accountName: bill.party_name,
        accountType: 'SUNDRY_CREDITORS',
        debit: 0,
        credit: bill.net_total,
        narration,
        refType: 'BILL',
        refId: bill.id
      }));
    }
    
    return entries;
  })();
}

/**
 * Auto-post voucher to ledger
 * @param {Object} voucher - Voucher object
 * @returns {Array} Array of ledger entry IDs created
 */
function postVoucherToLedger(voucher) {
  const entries = [];
  const narration = `${voucher.voucher_type} Voucher No: ${voucher.voucher_no} - ${voucher.narration}`;
  
  return db.transaction(() => {
    if (voucher.voucher_type === 'PAYMENT') {
      // Credit: Bank/Cash Account
      entries.push(createLedgerEntry({
        firmId: voucher.firm_id,
        date: voucher.voucher_date,
        accountName: voucher.paid_from_account,
        accountType: voucher.paid_from_type,
        debit: 0,
        credit: voucher.amount,
        narration,
        refType: 'VOUCHER',
        refId: voucher.id
      }));
      
      // Debit: Expense/Party Account
      entries.push(createLedgerEntry({
        firmId: voucher.firm_id,
        date: voucher.voucher_date,
        accountName: voucher.paid_to_account,
        accountType: voucher.paid_to_type,
        debit: voucher.amount,
        credit: 0,
        narration,
        refType: 'VOUCHER',
        refId: voucher.id
      }));
    } else if (voucher.voucher_type === 'RECEIPT') {
      // Debit: Bank/Cash Account
      entries.push(createLedgerEntry({
        firmId: voucher.firm_id,
        date: voucher.voucher_date,
        accountName: voucher.received_in_account,
        accountType: voucher.received_in_type,
        debit: voucher.amount,
        credit: 0,
        narration,
        refType: 'VOUCHER',
        refId: voucher.id
      }));
      
      // Credit: Income/Party Account
      entries.push(createLedgerEntry({
        firmId: voucher.firm_id,
        date: voucher.voucher_date,
        accountName: voucher.received_from_account,
        accountType: voucher.received_from_type,
        debit: 0,
        credit: voucher.amount,
        narration,
        refType: 'VOUCHER',
        refId: voucher.id
      }));
    } else if (voucher.voucher_type === 'JOURNAL') {
      // Parse journal entries from JSON
      const journalEntries = JSON.parse(voucher.journal_entries || '[]');
      
      journalEntries.forEach(entry => {
        entries.push(createLedgerEntry({
          firmId: voucher.firm_id,
          date: voucher.voucher_date,
          accountName: entry.account_name,
          accountType: entry.account_type,
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          narration: entry.narration || narration,
          refType: 'VOUCHER',
          refId: voucher.id
        }));
      });
    }
    
    return entries;
  })();
}

/**
 * Create a single ledger entry
 * @param {Object} params - Entry parameters
 * @returns {number} Ledger entry ID
 */
function createLedgerEntry({ firmId, date, accountName, accountType, debit, credit, narration, refType, refId }) {
  const result = db.prepare(`
    INSERT INTO ledger (
      firm_id, entry_date, account_name, account_type,
      debit, credit, narration, ref_type, ref_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(firmId, date, accountName, accountType, debit, credit, narration, refType, refId);
  
  return result.lastInsertRowid;
}

/**
 * Reverse ledger entries for a bill/voucher
 * @param {string} refType - 'BILL' or 'VOUCHER'
 * @param {number} refId - Bill or voucher ID
 */
function reverseLedgerEntries(refType, refId) {
  return db.transaction(() => {
    // Get all entries for this reference
    const entries = db.prepare(`
      SELECT * FROM ledger WHERE ref_type = ? AND ref_id = ?
    `).all(refType, refId);
    
    // Create reverse entries
    entries.forEach(entry => {
      db.prepare(`
        INSERT INTO ledger (
          firm_id, entry_date, account_name, account_type,
          debit, credit, narration, ref_type, ref_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.firm_id,
        entry.entry_date,
        entry.account_name,
        entry.account_type,
        entry.credit, // Swap debit/credit
        entry.debit,
        `REVERSAL: ${entry.narration}`,
        entry.ref_type,
        entry.ref_id
      );
    });
  })();
}

/**
 * Get ledger balance for an account
 * @param {number} firmId - Firm ID
 * @param {string} accountName - Account name
 * @param {string} toDate - Optional end date (YYYY-MM-DD)
 * @returns {Object} Balance details
 */
function getAccountBalance(firmId, accountName, toDate = null) {
  let query = `
    SELECT 
      SUM(debit) as total_debit,
      SUM(credit) as total_credit
    FROM ledger
    WHERE firm_id = ? AND account_name = ?
  `;
  
  const params = [firmId, accountName];
  
  if (toDate) {
    query += ` AND entry_date <= ?`;
    params.push(toDate);
  }
  
  const result = db.prepare(query).get(...params);
  
  const totalDebit = result.total_debit || 0;
  const totalCredit = result.total_credit || 0;
  const balance = totalDebit - totalCredit;
  
  return {
    totalDebit,
    totalCredit,
    balance,
    balanceType: balance >= 0 ? 'Dr' : 'Cr',
    balanceAmount: Math.abs(balance)
  };
}

/**
 * Get trial balance for a firm
 * @param {number} firmId - Firm ID
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @returns {Array} Trial balance data
 */
function getTrialBalance(firmId, fromDate, toDate) {
  const accounts = db.prepare(`
    SELECT DISTINCT account_name, account_type
    FROM ledger
    WHERE firm_id = ? AND entry_date BETWEEN ? AND ?
    ORDER BY account_type, account_name
  `).all(firmId, fromDate, toDate);
  
  const trialBalance = accounts.map(account => {
    const balance = getAccountBalance(firmId, account.account_name, toDate);
    return {
      accountName: account.account_name,
      accountType: account.account_type,
      debit: balance.balanceType === 'Dr' ? balance.balanceAmount : 0,
      credit: balance.balanceType === 'Cr' ? balance.balanceAmount : 0
    };
  });
  
  return trialBalance;
}

export {
  postBillToLedger,
  postVoucherToLedger,
  createLedgerEntry,
  reverseLedgerEntries,
  getAccountBalance,
  getTrialBalance
};
