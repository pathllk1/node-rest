# Application Documentation (Deep Dive)

This documentation provides an exhaustive analysis of the ANJN SPA Business Management System, detailing implementation logic, API contracts, and internal workflows.

## 1. System Architecture & Core Logic
*   **[Core Infrastructure](ARCHITECTURE_DEEP_DIVE.md)**: Serverless adaptations, atomic sequence generators, and security middleware.
*   **[Sequence Generation](logic/SEQUENCES.md)**: Deep dive into the `billNumberGenerator` and `VoucherSequence` logic.
*   **[GST Engine](logic/GST_ENGINE.md)**: Implementation of state-wise GST, inter/intra-state logic, and HSN-based calculations.

## 2. Feature Modules (Exhaustive)

### [HR & Payroll](features/HR_PAYROLL_EXHAUSTIVE.md)
*   **Master Roll**: Employee lifecycle, statutory fields (UAN/ESIC), and category-based wage mapping.
*   **Wages**: Calculation logic for Gross/Net pay, automated deductions (EPF/ESIC), and multi-payment mode support.
*   **Documents**: Logic for appointment letter generation (.docx).

### [Inventory & Supply Chain](features/INVENTORY_EXHAUSTIVE.md)
*   **Stock Management**: Batch-level tracking, MRP/Expiry handling, and UOM conversions.
*   **Party (CRM/SRM)**: Multi-GST registration support per party, location-based tax resolution.
*   **Sales & Purchase**: Transactional flow, stock register integration (`StockReg`), and auto-stock updates.
*   **Movements**: Adjustment, Transfer, and Receipt logic.

### [Accounting & Financials](features/ACCOUNTING_EXHAUSTIVE.md)
*   **Double-Entry Engine**: Auto-posting logic from bills/vouchers to the ledger.
*   **Vouchers**: Life-cycle of Payment, Receipt, and Journal vouchers.
*   **Ledger Logic**: Account head resolution, party-ledger isolation, and reversal mechanisms.
*   **Financial Reports**: Technical derivation of Trial Balance, Profit & Loss, and Closing Balances.

### [Admin & Audit](features/ADMIN_EXHAUSTIVE.md)
*   **RBAC**: Permission matrices and role-based route protection.
*   **Audit Logs**: Implementation of `AdminAuditLog` and session-based login auditing.
*   **Database Browser**: Super-admin data inspection and direct manipulation tools.

## 3. Technical Utilities
*   **[Exports & Reporting](logic/EXPORTS_LOGIC.md)**: Implementation of `PdfMake` for bills and `ExcelJS` for bulk data exports.
*   **[Auth & Sessions](logic/AUTH_DEEP_DIVE.md)**: Token hashing, device fingerprinting, and revocation workflows.

---
*Last Updated: April 3, 2026*
