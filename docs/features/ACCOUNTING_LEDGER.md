# Accounting & Ledger

The accounting module is a comprehensive financial tracking system built on double-entry bookkeeping principles.

## Core Features

### 1. Vouchers & Journal Entries
*   **Sequential Numbering:** Automatic generation of voucher numbers with financial year tracking.
*   **Voucher Types:** Support for various transaction types (e.g., Sales, Purchase, Payment, Receipt, Journal).
*   **Debit/Credit Logic:** Ensures every transaction has balanced double-entry ledger postings.
*   **Narrations:** Detailed descriptions for each transaction for future auditing.

### 2. General Ledger & Sub-Ledgers
*   **Account Heads:** Categorization of transactions into specific account heads (e.g., Cash, Bank, Sales, Expense).
*   **Real-time Balances:** Instantly calculates the balance for any account head over a specified period.
*   **Party Ledgers:** Automated sub-ledgers for each customer and supplier, showing all transactions and outstanding balances.
*   **Manual Postings:** Option to create manual ledger entries for adjustments and miscellaneous transactions.

### 3. Financial Reporting
*   **Trial Balance:** A real-time summary of all debit and credit balances to verify arithmetic accuracy.
*   **Profit & Loss Statement:** Calculates gross and net profit based on sales, costs, and expenses.
*   **Closing Balances:** Automatically calculates and carries forward balances for new financial periods.

### 4. Banking & Cash Management
*   **Bank Accounts:** Dedicated management of business bank accounts including IFSC and branch details.
*   **Opening Balances:** Setting initial balances for the start of a financial year.
*   **Closing Balances:** Finalizing balances at the end of the year for reconciliation.

## Key Implementation Files
*   `server/routes/mongo/ledger.routes.js`: Backend endpoints for all accounting tasks.
*   `client/pages/accounts-dashboard.js`: Financial KPIs and analytics dashboard.
*   `client/pages/ledger/`: UI for all accounting pages.
    *   `vouchers.js`: Listing and managing vouchers.
    *   `journal-entries.js`: Creating and editing journal entries.
    *   `general-ledger.js`: Account-specific transaction views.
    *   `profit-loss.js`: Visual and tabular P&L report.
    *   `trial-balance.js`: System-wide balance report.
*   `server/models/Ledger.model.js`: The central double-entry data store.
*   `server/models/VoucherSequence.model.js`: Logic for sequential document numbering.
*   `server/utils/ledgerHelper.js`: Server-side logic for ledger calculations and postings.
