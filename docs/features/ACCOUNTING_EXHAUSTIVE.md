# Accounting & Financials (Deep Dive)

The accounting engine is the most complex part of the system, managing a pure double-entry ledger that is automatically populated from other modules.

## 1. Automated Posting Engine
The `ledgerHelper.js` utility is the central orchestrator for all ledger postings.

### Sales Invoicing Flow (Auto-Post)
*   **Debit**: `Party Account` (Type: `SUNDRY_DEBTORS`) for `Net Total`.
*   **Credit**: `Sales Account` (Type: `SALES`) for `Gross Total`.
*   **Credit**: `CGST/SGST/IGST Output` (Type: `DUTIES_TAXES`) for respective GST amounts.

### Purchase Billing Flow (Auto-Post)
*   **Debit**: `Purchase Account` (Type: `PURCHASE`) for `Gross Total`.
*   **Debit**: `CGST/SGST/IGST Input` (Type: `DUTIES_TAXES`) for respective GST amounts.
*   **Credit**: `Party Account` (Type: `SUNDRY_CREDITORS`) for `Net Total`.

## 2. Voucher Lifecycle
Managed by `voucherController.js`, vouchers represent direct cash/bank transactions.

### Creation Logic
1.  **Voucher Group ID**: Atomically generates a numeric `voucher_id` for line grouping.
2.  **Account Resolution**: 
    *   Uses `resolveLedgerPostingAccount` to find or create the appropriate account head.
    *   Determines if `payment_mode` is cash or bank (linked to `BankAccount` model).
3.  **Debit/Credit Logic**:
    *   **Receipt**: `Dr Bank/Cash`, `Cr Party/Income`.
    *   **Payment**: `Dr Party/Expense`, `Cr Bank/Cash`.
4.  **Persistence**: Uses `Ledger.insertMany()` for atomic posting of both sides of the transaction.

### Reversal Mechanism
*   The system implements a "Reversal" strategy instead of direct deletion in some modules.
*   **Logic**: Creates a new set of entries where debits and credits are swapped from the original, prefixed with `REVERSAL:`. This maintains a full audit trail.

## 3. Financial Analysis Derivation

### Account Head Resolution
*   The system dynamically maps business concepts (like a "Party Name") to Ledger "Account Heads."
*   If a party named "Acme Corp" is used in a bill, the ledger engine creates/links it to an account head `Acme Corp`.

### Trial Balance Derivation
*   **Algorithm**: 
    1.  Aggregates all unique `account_head` names for the period.
    2.  For each, calculates `SUM(debit) - SUM(credit)`.
    3.  If positive: `Dr Balance`. If negative: `Cr Balance`.
*   **Validation**: The sum of all `Dr` balances must equal the sum of all `Cr` balances.

### Profit & Loss (P&L) Calculation
*   **Gross Profit**: `(Sales + Closing Stock) - (Opening Stock + Purchases)`.
*   **Net Profit**: `Gross Profit - Operating Expenses` (aggregated from ledger heads marked as `EXPENSE`).

## 4. Bank Account Integration
*   Directly linked to the `BankAccount` model.
*   Tracks status (`ACTIVE`/`INACTIVE`) and validates that bank vouchers only use active accounts.
*   Includes `ifsc_code` and `account_number` for documentation/reporting.
