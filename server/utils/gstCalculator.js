/**
 * GST Calculator Utility
 * Handles all GST-related calculations
 */

/**
 * State codes for GST
 */
const STATE_CODES = {
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
  'LADAKH': 37
};

/**
 * Get state code from state name
 * @param {string} stateName - State name
 * @returns {number|null} State code or null if not found
 */
function getStateCode(stateName) {
  if (!stateName) return null;
  const normalized = stateName.toUpperCase().trim();
  return STATE_CODES[normalized] || null;
}

/**
 * Get state name from state code
 * @param {number} stateCode - State code
 * @returns {string|null} State name or null if not found
 */
function getStateName(stateCode) {
  const entry = Object.entries(STATE_CODES).find(([_, code]) => code === stateCode);
  return entry ? entry[0] : null;
}

/**
 * Check if transaction is intra-state (same state)
 * @param {number|string} sellerStateCode - Seller's state code
 * @param {number|string} buyerStateCode - Buyer's state code
 * @returns {boolean} True if intra-state
 */
function isIntraState(sellerStateCode, buyerStateCode) {
  return parseInt(sellerStateCode) === parseInt(buyerStateCode);
}

/**
 * Calculate GST amounts for a line item
 * @param {Object} params - Calculation parameters
 * @param {number} params.rate - Base rate per unit
 * @param {number} params.qty - Quantity
 * @param {number} params.gstRate - GST rate percentage (e.g., 18 for 18%)
 * @param {boolean} params.isIntraState - Whether transaction is intra-state
 * @param {number} params.discount - Discount amount (optional)
 * @returns {Object} Calculated amounts
 */
function calculateItemGST({ rate, qty, gstRate, isIntraState, discount = 0 }) {
  // Calculate base amount
  const baseAmount = rate * qty;
  
  // Apply discount
  const amountAfterDiscount = baseAmount - discount;
  
  // Calculate GST
  const gstAmount = (amountAfterDiscount * gstRate) / 100;
  
  // For intra-state: CGST + SGST (split equally)
  // For inter-state: IGST (full amount)
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  
  if (isIntraState) {
    cgst = gstAmount / 2;
    sgst = gstAmount / 2;
  } else {
    igst = gstAmount;
  }
  
  // Calculate total
  const total = amountAfterDiscount + gstAmount;
  
  return {
    baseAmount: parseFloat(baseAmount.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    amountAfterDiscount: parseFloat(amountAfterDiscount.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    igst: parseFloat(igst.toFixed(2)),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

/**
 * Calculate bill totals from line items
 * @param {Array} items - Array of line items with GST calculated
 * @param {number} additionalDiscount - Additional bill-level discount
 * @param {Array} otherCharges - Other charges array [{name, amount, gstRate, isIntraState}]
 * @returns {Object} Bill totals
 */
function calculateBillTotals(items, additionalDiscount = 0, otherCharges = []) {
  // Sum up all items
  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalDiscount = additionalDiscount;
  
  items.forEach(item => {
    subtotal += item.amountAfterDiscount || 0;
    totalCGST += item.cgst || 0;
    totalSGST += item.sgst || 0;
    totalIGST += item.igst || 0;
    totalDiscount += item.discount || 0;
  });
  
  // Calculate other charges
  let otherChargesAmount = 0;
  let otherChargesGST = 0;
  
  otherCharges.forEach(charge => {
    const chargeAmount = charge.amount || 0;
    otherChargesAmount += chargeAmount;
    
    if (charge.gstRate) {
      const chargeGST = (chargeAmount * charge.gstRate) / 100;
      otherChargesGST += chargeGST;
      
      if (charge.isIntraState) {
        totalCGST += chargeGST / 2;
        totalSGST += chargeGST / 2;
      } else {
        totalIGST += chargeGST;
      }
    }
  });
  
  // Calculate grand total
  const grossTotal = subtotal + otherChargesAmount;
  const totalGST = totalCGST + totalSGST + totalIGST + otherChargesGST;
  const grandTotal = grossTotal + totalGST - additionalDiscount;
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalDiscount: parseFloat(totalDiscount.toFixed(2)),
    otherChargesAmount: parseFloat(otherChargesAmount.toFixed(2)),
    grossTotal: parseFloat(grossTotal.toFixed(2)),
    cgst: parseFloat(totalCGST.toFixed(2)),
    sgst: parseFloat(totalSGST.toFixed(2)),
    igst: parseFloat(totalIGST.toFixed(2)),
    totalGST: parseFloat(totalGST.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
    roundOff: parseFloat((Math.round(grandTotal) - grandTotal).toFixed(2)),
    netTotal: Math.round(grandTotal)
  };
}

/**
 * Validate GSTIN format
 * @param {string} gstin - GSTIN to validate
 * @returns {boolean} True if valid
 */
function validateGSTIN(gstin) {
  if (!gstin || gstin === 'UNREGISTERED') return true;
  
  // GSTIN format: 2 digits (state code) + 10 chars (PAN) + 1 char (entity) + 1 char (Z) + 1 check digit
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

/**
 * Extract state code from GSTIN
 * @param {string} gstin - GSTIN
 * @returns {number|null} State code or null
 */
function getStateCodeFromGSTIN(gstin) {
  if (!gstin || gstin === 'UNREGISTERED') return null;
  if (!validateGSTIN(gstin)) return null;
  
  return parseInt(gstin.substring(0, 2));
}

export {
  STATE_CODES,
  getStateCode,
  getStateName,
  isIntraState,
  calculateItemGST,
  calculateBillTotals,
  validateGSTIN,
  getStateCodeFromGSTIN
};
