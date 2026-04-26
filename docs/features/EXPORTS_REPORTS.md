# Exports & Reports

The application provides extensive support for generating documents and data exports in common formats.

## Supported Formats

### 1. Excel (XLSX)
*   **Data Exports:** Almost all tabular data in the system (e.g., Master Roll, Stock Ledger, Bills, Trial Balance) can be exported to Excel.
*   **Library:** Uses `exceljs` for complex spreadsheet generation with formatting.
*   **Features:** Multi-sheet support, custom styling, and large dataset handling.

### 2. PDF Generation
*   **Bills & Invoices:** Professional PDF generation for sales and purchase bills.
*   **Financial Reports:** Summaries for P&L and Trial Balance.
*   **Library:** Uses `pdfmake` for layout-driven PDF creation.
*   **Customization:** Supports custom logos (via Vercel Blob), firm details, and complex table structures.

### 3. Word Documents (DOCX)
*   **Official Correspondence:** Automated generation of appointment letters for new employees.
*   **Library:** Uses `docx` for generating Word files from structured data.
*   **Template Logic:** Dynamic insertion of employee names, dates, and role details into pre-defined letter formats.

## Key Implementation Files
*   `server/utils/pdfGenerator.js`: Core server-side PDF generation logic.
*   `client/utils/appointmentLetterGenerator.js`: Frontend logic for .DOCX creation.
*   `client/public/cdns/exceljs.js`: Excel client-side support.
*   `client/pages/inventory-reports.js`: Centralized UI for generating various inventory reports and exports.
