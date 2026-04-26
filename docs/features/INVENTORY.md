# Inventory Management

The inventory system tracks the flow of goods and services, integrating with sales and purchases for real-time stock management.

## Core Features

### 1. Stock Tracking (Items & Batches)
*   **Item Profiles:** Basic item details including HSN code, Unit of Measure (UOM), and MRP.
*   **Batch Management:** Track stock by batch numbers for precise inventory control.
*   **Real-time Quantities:** Automates quantity updates on sales and purchase transactions.
*   **Costing:** Track item rates, weighted averages, and grand totals (including taxes/GST).

### 2. Purchase Module (PRS)
*   **Supplier Linkage:** Manage supplier (Party) details including GSTIN, state, and address.
*   **Inward Stocking:** Record incoming goods, update batch quantities, and generate purchase records.
*   **HSN Tracking:** Automates tax calculations based on item HSN and state-level GST rules (CGST/SGST/IGST).

### 3. Sales Module (SLS)
*   **Billing/Invoicing:** Generate sales bills with automatic numbering and sequential control.
*   **Outward Stocking:** Deduct stock quantities from inventory upon sale.
*   **Consignee Support:** Manage separate billing and shipping addresses.
*   **Tax Compliance:** Handles reverse charge, other charges (e.g., freight, packing), and rounding off.

### 4. Stock Movement & History
*   **Stock Ledger (StockReg):** A detailed history of every movement (In/Out) for every item.
*   **Historical Analysis:** Review past sales and purchases to identify trends.
*   **Valuation:** Calculate current stock value based on latest rates or weighted averages.

### 5. Reporting & Analytics
*   **Inventory Dashboard:** Visual overview of stock levels, revenue, and trends.
*   **Categorization:** Organize items into hierarchical categories for better reporting.
*   **Supplier Analysis:** Track spending and supply consistency for each partner.

## Key Implementation Files
*   `server/routes/mongo/inventory/sls.js`: Sales API endpoints.
*   `server/routes/mongo/inventory/prs.js`: Purchase API endpoints.
*   `client/pages/stocks.js`: UI for current inventory view.
*   `client/pages/stock-movement.js`: Detailed stock movement history UI.
*   `client/pages/inventory-dashboard.js`: Analytics and KPIs for inventory.
*   `server/models/Stock.model.js`: Item and quantity schema.
*   `server/models/StockReg.model.js`: Movement history schema.
*   `server/models/Bill.model.js`: Sales and Purchase document schema.
*   `server/models/Party.model.js`: Customer and Supplier data schema.
