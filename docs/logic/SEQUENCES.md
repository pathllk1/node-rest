# Sequence Generation Logic

The application uses an atomic, transaction-based sequence generation system to ensure unique document numbers across concurrent requests, scoped by firm and financial year.

## 1. Financial Year Calculation
The `getCurrentFinancialYear()` function defines the fiscal cycle as **April 1st to March 31st**.
*   **Logic**: If current month ≥ 4 (April), FY is `current_year - next_year_short` (e.g., `24-25`). Otherwise, it's `prev_year - current_year_short`.
*   **Validation**: All sequence requests are validated against the `YY-YY` format regex.

## 2. Bill & Invoice Numbering
*   **Storage**: Uses the `bill_sequences` collection (Prisma `BillSequence`).
*   **Uniqueness**: Scoped by `{ firm_id, financial_year, voucher_type }`.
*   **Prefixes**: 
    *   `INV`: Sales Invoices
    *   `PUR`: Purchase Bills
    *   `CN/DN`: Credit/Debit Notes
    *   `DLN`: Delivery Notes
*   **Format**: `${prefix}F${firmId}-${sequence_padded_4}/${fy}` (e.g., `INVF1-0001/24-25`).
*   **Atomicity**: Implemented using `db.transaction()` (SQLite-style in utility or MongoDB `findOneAndUpdate` in controllers) to prevent race conditions.

## 3. Voucher ID (Grouping) Logic
To group multiple ledger lines into a single logical "Voucher," the system generates a numeric `voucher_id`.
*   **Old Logic (Legacy)**: `Math.floor(Date.now()/1000) + random`.
*   **New Logic (Deep Dive)**: Uses `VoucherSequence` collection with atomic `$inc` via `findOneAndUpdate`.
*   **Benefit**: Guaranteed uniqueness and sequential ordering within a firm's records, crucial for audit trails.

## 4. Voucher Numbering (Display)
*   **Prefixes**: `PV` (Payment), `RV` (Receipt), `JV` (Journal).
*   **Format**: `${prefix}/${financialYear}/${sequence_padded_4}`.
*   **Sync Logic**: Controllers ensure that the `last_sequence` is incremented BEFORE the document is saved to prevent gaps in numbering on failure (Strict Sequential Compliance).
