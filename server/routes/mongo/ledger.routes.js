import express from 'express';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';
import * as ledgerController from '../../controllers/mongo/ledger/ledgerController.js';
import * as journalEntryController from '../../controllers/mongo/ledger/journalEntryController.js';
import * as voucherController from '../../controllers/mongo/ledger/voucherController.js';
import * as bankAccountController from '../../controllers/mongo/ledger/bankAccountController.js';
import * as manualLedgerController from '../../controllers/mongo/ledger/manualLedgerController.js';
import * as openingBalanceController from '../../controllers/mongo/ledger/openingBalanceController.js';

const router = express.Router();

// ── Manual Ledger Entries ─────────────────────────────────────────────────
router.post  ('/manual-ledger',             authMiddleware, manualLedgerController.createManualLedgerEntry);
router.get   ('/manual-ledger',             authMiddleware, manualLedgerController.getManualLedgerEntries);
router.get   ('/manual-ledger/:voucherId',  authMiddleware, manualLedgerController.getManualLedgerEntryById);
router.put   ('/manual-ledger/:voucherId',  authMiddleware, manualLedgerController.updateManualLedgerEntry);
router.patch ('/manual-ledger/:voucherId',  authMiddleware, manualLedgerController.updateManualLedgerEntry);
router.delete('/manual-ledger/:voucherId',  authMiddleware, manualLedgerController.deleteManualLedgerEntry);
router.post  ('/manual-ledger/:voucherId/lock', authMiddleware, manualLedgerController.lockManualLedgerEntry);

// ── Opening Balances ──────────────────────────────────────────────────────
router.post  ('/opening-balances',             authMiddleware, openingBalanceController.createOpeningBalance);
router.get   ('/opening-balances',             authMiddleware, openingBalanceController.getOpeningBalances);
router.get   ('/opening-balances/:id',         authMiddleware, openingBalanceController.getOpeningBalanceById);
router.put   ('/opening-balances/:id',         authMiddleware, openingBalanceController.updateOpeningBalance);
router.patch ('/opening-balances/:id',         authMiddleware, openingBalanceController.updateOpeningBalance);
router.delete('/opening-balances/:id',         authMiddleware, openingBalanceController.deleteOpeningBalance);
router.post  ('/opening-balances/lock',        authMiddleware, openingBalanceController.lockOpeningBalances);
router.get   ('/opening-balances-summary',     authMiddleware, openingBalanceController.getOpeningBalanceSummary);

// ── Ledger accounts ───────────────────────────────────────────────────────────
router.get('/accounts',      authMiddleware, ledgerController.getLedgerAccounts);
router.get('/account/:account_head', authMiddleware, ledgerController.getAccountDetails);
router.get('/account-types', authMiddleware, ledgerController.getAccountTypeSummaries);
router.get('/suggestions',   authMiddleware, ledgerController.getAccountSuggestions);

// ── Bank accounts ─────────────────────────────────────────────────────────────
router.get   ('/bank-accounts',     authMiddleware, bankAccountController.getBankAccounts);
router.post  ('/bank-accounts',     authMiddleware, bankAccountController.createBankAccount);
router.get   ('/bank-accounts/:id', authMiddleware, bankAccountController.getBankAccountById);
router.put   ('/bank-accounts/:id', authMiddleware, bankAccountController.updateBankAccount);
router.patch ('/bank-accounts/:id', authMiddleware, bankAccountController.updateBankAccount);
router.delete('/bank-accounts/:id', authMiddleware, bankAccountController.deleteBankAccount);

// ── PDF exports ───────────────────────────────────────────────────────────────
// Existing
router.get ('/export/account-ledger/:account_head', authMiddleware, ledgerController.exportAccountLedgerPdf);
router.get ('/export/general-ledger',               authMiddleware, ledgerController.exportGeneralLedgerPdf);
router.get ('/export/trial-balance',                authMiddleware, ledgerController.exportTrialBalancePdf);
router.post('/export/account-type',                 authMiddleware, ledgerController.exportAccountTypePdf);

// New — Financial Statements
router.get ('/export/profit-loss',    authMiddleware, ledgerController.exportProfitLossPdf);
router.get ('/export/balance-sheet',  authMiddleware, ledgerController.exportBalanceSheetPdf);

// ── Journal entries ───────────────────────────────────────────────────────────
router.post  ('/journal-entries',             authMiddleware, journalEntryController.createJournalEntry);
router.get   ('/journal-entries',             authMiddleware, journalEntryController.getJournalEntries);
router.get   ('/journal-entries/:id',         authMiddleware, journalEntryController.getJournalEntryById);
router.put   ('/journal-entries/:id',         authMiddleware, journalEntryController.updateJournalEntry);
router.delete('/journal-entries/:id',         authMiddleware, journalEntryController.deleteJournalEntry);
router.get   ('/journal-entries-summary',     authMiddleware, journalEntryController.getJournalEntrySummary);

// ── Vouchers ──────────────────────────────────────────────────────────────────
router.post  ('/vouchers',                    authMiddleware, voucherController.createVoucher);
router.get   ('/vouchers',                    authMiddleware, voucherController.getVouchers);
router.get   ('/vouchers-summary',            authMiddleware, voucherController.getVoucherSummary);
router.get   ('/vouchers/:id',                authMiddleware, voucherController.getVoucherById);
router.get   ('/vouchers/party/:partyId',     authMiddleware, voucherController.getVouchersByParty);
router.put   ('/vouchers/:id',                authMiddleware, voucherController.updateVoucher);
router.delete('/vouchers/:id',                authMiddleware, voucherController.deleteVoucher);

export default router;