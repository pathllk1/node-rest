/**
 * GST Calculator Utility
 * Pure calculation logic — no DB dependency.
 * Identical to the SQLite version.
 */

export const STATE_CODES = {
  'JAMMU AND KASHMIR': 1,
  'HIMACHAL PRADESH': 2,
  'PUNJAB': 3,
  'CHANDIGARH': 4,
  'UTTARAKHAND': 5,
  'HARYANA': 6,
  'DELHI': 7,
  'RAJASTHAN': 8,
  'UTTAR PRADESH': 9,
  'BIHAR': 10,
  'SIKKIM': 11,
  'ARUNACHAL PRADESH': 12,
  'NAGALAND': 13,
  'MANIPUR': 14,
  'MIZORAM': 15,
  'TRIPURA': 16,
  'MEGHALAYA': 17,
  'ASSAM': 18,
  'WEST BENGAL': 19,
  'JHARKHAND': 20,
  'ODISHA': 21,
  'CHHATTISGARH': 22,
  'MADHYA PRADESH': 23,
  'GUJARAT': 24,
  'DAMAN AND DIU': 25,
  'DADRA AND NAGAR HAVELI': 26,
  'MAHARASHTRA': 27,
  'ANDHRA PRADESH': 28,
  'KARNATAKA': 29,
  'GOA': 30,
  'LAKSHADWEEP': 31,
  'KERALA': 32,
  'TAMIL NADU': 33,
  'PUDUCHERRY': 34,
  'ANDAMAN AND NICOBAR ISLANDS': 35,
  'TELANGANA': 36,
  'LADAKH': 37,
};

/**
 * Get state code from state name
 * @param {string} stateName
 * @returns {number|null}
 */
export function getStateCode(stateName) {
  if (!stateName) return null;
  return STATE_CODES[stateName.toUpperCase().trim()] ?? null;
}

/**
 * Get state name from state code
 * @param {number} stateCode
 * @returns {string|null}
 */
export function getStateName(stateCode) {
  const entry = Object.entries(STATE_CODES).find(([, code]) => code === stateCode);
  return entry ? entry[0] : null;
}

/**
 * Check if transaction is intra-state (CGST + SGST) or inter-state (IGST)
 * @param {number|string} sellerStateCode
 * @param {number|string} buyerStateCode
 * @returns {boolean}
 */
export function isIntraState(sellerStateCode, buyerStateCode) {
  return parseInt(sellerStateCode) === parseInt(buyerStateCode);
}

/**
 * Calculate GST amounts for a single line item
 * @param {{ rate: number, qty: number, gstRate: number, isIntraState: boolean, discount?: number }} params
 * @returns {{ baseAmount, discount, amountAfterDiscount, cgst, sgst, igst, gstAmount, total }}
 */
export function calculateItemGST({ rate, qty, gstRate, isIntraState: intra, discount = 0 }) {
  const baseAmount          = rate * qty;
  const amountAfterDiscount = baseAmount - discount;
  const gstAmount           = (amountAfterDiscount * gstRate) / 100;

  let cgst = 0, sgst = 0, igst = 0;
  if (intra) {
    cgst = gstAmount / 2;
    sgst = gstAmount / 2;
  } else {
    igst = gstAmount;
  }

  return {
    baseAmount:          parseFloat(baseAmount.toFixed(2)),
    discount:            parseFloat(discount.toFixed(2)),
    amountAfterDiscount: parseFloat(amountAfterDiscount.toFixed(2)),
    cgst:                parseFloat(cgst.toFixed(2)),
    sgst:                parseFloat(sgst.toFixed(2)),
    igst:                parseFloat(igst.toFixed(2)),
    gstAmount:           parseFloat(gstAmount.toFixed(2)),
    total:               parseFloat((amountAfterDiscount + gstAmount).toFixed(2)),
  };
}

/**
 * Aggregate bill totals from an array of line items (already GST-calculated)
 * @param {Array}  items               - Items returned from calculateItemGST
 * @param {number} [additionalDiscount=0]
 * @param {Array}  [otherCharges=[]]   - [{ name, amount, gstRate, isIntraState }]
 * @returns {{ subtotal, totalDiscount, otherChargesAmount, grossTotal, cgst, sgst, igst, totalGST, grandTotal, roundOff, netTotal }}
 */
export function calculateBillTotals(items, additionalDiscount = 0, otherCharges = []) {
  let subtotal = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
  let totalDiscount = additionalDiscount;

  for (const item of items) {
    subtotal      += item.amountAfterDiscount ?? 0;
    totalCGST     += item.cgst     ?? 0;
    totalSGST     += item.sgst     ?? 0;
    totalIGST     += item.igst     ?? 0;
    totalDiscount += item.discount ?? 0;
  }

  let otherChargesAmount = 0;

  for (const charge of otherCharges) {
    const amt = charge.amount ?? 0;
    otherChargesAmount += amt;
    if (charge.gstRate) {
      const chargeGST = (amt * charge.gstRate) / 100;
      if (charge.isIntraState) {
        totalCGST += chargeGST / 2;
        totalSGST += chargeGST / 2;
      } else {
        totalIGST += chargeGST;
      }
    }
  }

  const grossTotal = subtotal + otherChargesAmount;
  const totalGST   = totalCGST + totalSGST + totalIGST;
  const grandTotal = grossTotal + totalGST - additionalDiscount;
  const roundOff   = Math.round(grandTotal) - grandTotal;

  return {
    subtotal:            parseFloat(subtotal.toFixed(2)),
    totalDiscount:       parseFloat(totalDiscount.toFixed(2)),
    otherChargesAmount:  parseFloat(otherChargesAmount.toFixed(2)),
    grossTotal:          parseFloat(grossTotal.toFixed(2)),
    cgst:                parseFloat(totalCGST.toFixed(2)),
    sgst:                parseFloat(totalSGST.toFixed(2)),
    igst:                parseFloat(totalIGST.toFixed(2)),
    totalGST:            parseFloat(totalGST.toFixed(2)),
    grandTotal:          parseFloat(grandTotal.toFixed(2)),
    roundOff:            parseFloat(roundOff.toFixed(2)),
    netTotal:            Math.round(grandTotal),
  };
}

/**
 * Validate GSTIN format
 * @param {string} gstin
 * @returns {boolean}
 */
export function validateGSTIN(gstin) {
  if (!gstin || gstin === 'UNREGISTERED') return true;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

/**
 * Extract state code from GSTIN
 * @param {string} gstin
 * @returns {number|null}
 */
export function getStateCodeFromGSTIN(gstin) {
  if (!gstin || gstin === 'UNREGISTERED') return null;
  if (!validateGSTIN(gstin)) return null;
  return parseInt(gstin.substring(0, 2));
}
