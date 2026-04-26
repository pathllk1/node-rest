# GST Engine Implementation

The GST (Goods and Services Tax) engine is a robust, logic-driven calculator that ensures all transactional taxes are correctly calculated, recorded, and reported.

## 1. Taxation Logic (Intra vs. Inter-state)
The system uses the `gstCalculator.js` utility to resolve taxes based on the geographic location of the buyer and seller.

### Intra-state Transaction (Same State)
*   **Condition**: `Seller State Code == Buyer State Code`.
*   **Result**: Split tax into **CGST** (Central GST) and **SGST** (State GST) at 50% each of the total GST rate.

### Inter-state Transaction (Different State)
*   **Condition**: `Seller State Code != Buyer State Code`.
*   **Result**: Full tax amount applied as **IGST** (Integrated GST).

## 2. Item-Level Calculations
For every line item in a bill, the following logic is applied:
1.  **Base Amount**: `rate * qty`.
2.  **Discount**: Applied to the base amount.
3.  **Amount After Discount**: `Base Amount - Discount`.
4.  **GST Amount**: `(Amount After Discount * GST Rate) / 100`.
5.  **Net Item Total**: `Amount After Discount + GST Amount`.

## 3. Bill-Level Consolidation
The engine consolidates all line items and adds additional bill-level charges.

### Other Charges (Freight, Packing, etc.)
*   **GST on Charges**: Charges can independently have their own GST rates.
*   **Total Tax Calculation**: Line-item CGST/SGST/IGST + Other-Charge CGST/SGST/IGST.

### Round-Off & Net Total
*   **Grand Total**: `Subtotal + Total GST - Additional Discounts`.
*   **Net Total**: `Math.round(Grand Total)`.
*   **Round-Off**: `Net Total - Grand Total` (stored as a separate field in the `Bill` model).

## 4. Geographic Data & Validation
*   **State Code Mapping**: The system maintains a complete mapping of Indian State Names to their 2-digit GST State Codes (e.g., `Delhi = 07`).
*   **GSTIN Validation**: Uses a strict 15-character regex to validate the format of GST identification numbers.
*   **Automatic Extraction**: Extracts the state code from the first two digits of the GSTIN to verify location-based tax eligibility.

## 5. Reverse Charge (RCM)
*   The `Bill` model supports a `reverse_charge` boolean flag.
*   When active, the tax is recorded in the ledger but not added to the bill's payable amount, as the liability is on the recipient.
