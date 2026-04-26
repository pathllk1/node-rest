# Inventory & Supply Chain (Exhaustive)

The inventory system is designed for high-precision tracking of items, batches, and their financial impacts.

## 1. Stock Tracking (Multi-Batch Engine)
Managed by `sharedStockHandlers.js`, the system supports a sophisticated batch-level inventory model.

### Batch Implementation
*   **Storage**: `Stock` model includes a `batches` JSON array.
*   **Attributes**: Each batch tracks:
    *   `batch`: Unique batch identifier.
    *   `qty`: Quantity available in this specific batch.
    *   `mrp`: Maximum Retail Price for this batch.
    *   `rate`: Purchase/Base rate.
    *   `expiry`: Expiration date.
*   **Auto-Consolidation**: When creating stock, if the same batch identifier exists, the system atomically increments the quantity (`$set` on the `Stock` document after recalculating totals).

## 2. Party (CRM/SRM) with Multi-GST Support
The `Party` model (for both Customers and Suppliers) includes an advanced multi-location registration system.

### Multi-GST Implementation
*   **GstLocations Array**: Stores multiple location records for a single business entity.
*   **Location Schema**: 
    *   `gstin`: 15-digit GST identification number.
    *   `state`/`state_code`: Geographic location for tax calculation.
    *   `is_primary`: Boolean flag to determine default billing/shipping address.
*   **Tax Resolution**: During billing, the system retrieves the `gstin` and `state_code` for the selected party location to determine if the transaction is Intra-state (CGST/SGST) or Inter-state (IGST).

## 3. Stock Register (`StockReg`) & Movements
Every inventory transaction (Sales, Purchase, Adjustment) creates a record in the `StockReg` collection.

### Movement Types
1.  **SALES (SLS)**: Deducts quantity, links to a `Bill`.
2.  **PURCHASE (PRS)**: Adds quantity, updates item rates/mrp, links to a `Bill`.
3.  **ADJUSTMENT**: Manual stock corrections (Stock-In/Stock-Out).
4.  **TRANSFER**: Tracks moving stock between locations/categories.
5.  **OPENING**: Initial stock entry at the beginning of a period.

### Item Narration Logic
Each `StockReg` entry can have a unique `item_narration` (separate from the document-level narration), allowing for line-level details like serial numbers or specific service notes.

## 4. Sales & Purchase Lifecycle

### Transactional Integrity
*   **Stock Lock**: The system recalculates total stock quantity from all batches whenever an update occurs to ensure the parent `Stock` document stays in sync with its `batches` array.
*   **Financial Impact**: Every bill transaction automatically triggers the `postBillToLedger` logic (see [Accounting](ACCOUNTING_EXHAUSTIVE.md)).
*   **Sequential Numbering**: Uses the `billNumberGenerator` to assign unique document numbers based on the business's fiscal year.

## 5. Analytics & Reports
*   **Stock Ledger**: A comprehensive report of all `StockReg` entries filtered by item or party.
*   **Low Stock Alerts**: (Calculated) Items where `SUM(batches.qty)` is below a defined threshold.
*   **Valuation Report**: Calculates `SUM(qty * rate)` across all active stock batches to provide a total inventory value.
