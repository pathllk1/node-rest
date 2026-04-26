/**
 * UTILITY FUNCTIONS MODULE
 * Common helper functions used across the SLS system
 */

export const formatCurrency = (num) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num || 0);

export const isServiceItem = (item) => (item?.itemType || item?.item_type || 'GOODS') === 'SERVICE';

export const getItemEffectiveQty = (item) => {
    const qty = Number(item?.qty);
    if (Number.isFinite(qty) && qty > 0) return qty;
    return isServiceItem(item) ? 1 : 0;
};

export const shouldShowItemQty = (item) => {
    if (!isServiceItem(item)) return true;
    return item?.showQty !== false;
};

export const getItemDisplayQty = (item) => {
    if (!shouldShowItemQty(item)) return '';
    const qty = Number(item?.qty);
    return Number.isFinite(qty) ? qty : '';
};

export const getItemLineTotal = (item) => {
    const qty  = getItemEffectiveQty(item);
    const rate = Number(item?.rate) || 0;
    const disc = Number(item?.disc) || 0;
    
    // For services with qty=0 (flat-rate services), line total is just rate * (1 - disc/100)
    // For all other items, line total is qty * rate * (1 - disc/100)
    if (isServiceItem(item) && qty === 0) {
        return rate * (1 - disc / 100);
    }
    
    return qty * rate * (1 - disc / 100);
};

export const calculateBillTotals = ({
    cart = [],
    otherCharges = [],
    gstEnabled = true,
    billType = 'intra-state',
    reverseCharge = false,
}) => {
    let itemTaxableTotal   = 0;
    let totalTaxAmount     = 0;
    let otherChargesTotal  = 0;
    let otherChargesGstTotal = 0;

    cart.forEach(item => {
        const lineValue = getItemLineTotal(item);
        itemTaxableTotal += lineValue;
        if (gstEnabled) totalTaxAmount += lineValue * ((Number(item?.grate) || 0) / 100);
    });

    otherCharges.forEach(charge => {
        const amt = Number(charge?.amount) || 0;
        otherChargesTotal += amt;
        if (gstEnabled) {
            otherChargesGstTotal += amt * ((Number(charge?.gstRate) || 0) / 100);
        }
    });

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gstEnabled && billType === 'intra-state') {
        cgst = (totalTaxAmount / 2) + (otherChargesGstTotal / 2);
        sgst = (totalTaxAmount / 2) + (otherChargesGstTotal / 2);
    } else if (gstEnabled) {
        igst = totalTaxAmount + otherChargesGstTotal;
    }

    const grossBeforeRound = itemTaxableTotal
        + otherChargesTotal
        + (gstEnabled && !reverseCharge ? totalTaxAmount + otherChargesGstTotal : 0);

    const ntot = Math.round(grossBeforeRound);
    const rof  = ntot - grossBeforeRound;

    return {
        itemTaxableTotal,
        totalTaxAmount,
        otherChargesTotal,
        otherChargesGstTotal,
        cgst: reverseCharge && gstEnabled ? 0 : cgst,
        sgst: reverseCharge && gstEnabled ? 0 : sgst,
        igst: reverseCharge && gstEnabled ? 0 : igst,
        grossBeforeRound,
        ntot,
        rof,
    };
};

export const getHistoryCacheKey = (partyId, stockId) => `${partyId}:${stockId}`;

/**
 * HTML-escape a value for safe insertion into innerHTML.
 * Covers all 5 critical characters: & < > " '
 * MUST be used on ALL user/API data in template literals that go into innerHTML.
 * @param {*} val - Any value (will be coerced to string)
 * @returns {string} Safe escaped string
 */
export const escHtml = (val) => {
    const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(val ?? '').replace(/[&<>"']/g, c => MAP[c]);
};

/**
 * Get consistent party ID from party object (handles both id and _id)
 */
export const getPartyId = (party) => {
    if (!party) return null;
    return party._id || party.id || null;
};

/**
 * Check if a party is selected with a valid ID
 */
export const isPartySelected = (party) => {
    return party != null && getPartyId(party) != null;
};

export function populateConsigneeFromBillTo(state) {
    if (state.selectedParty) {
        // FIX: Use selected location data if available, otherwise fall back to primary party data
        const location = state.selectedPartyLocation || {
            address: state.selectedParty.addr,
            gstin: state.selectedParty.gstin,
            state: state.selectedParty.state,
            pincode: state.selectedParty.pin,
            contact: state.selectedParty.contact
        };
        
        state.selectedConsignee = {
            name:                 state.selectedParty.firm,
            address:              location.address,
            gstin:                location.gstin,
            state:                location.state,
            pin:                  location.pincode || '',
            contact:              location.contact || '',
            deliveryInstructions: '',
        };
        updateConsigneeDisplay(state);
    }
}

export function updateConsigneeDisplay(state) {
    const fields = [
        ['consignee-name',                  'name'],
        ['consignee-address',               'address'],
        ['consignee-gstin',                 'gstin'],
        ['consignee-state',                 'state'],
        ['consignee-pin',                   'pin'],
        ['consignee-contact',               'contact'],
        ['consignee-delivery-instructions', 'deliveryInstructions'],
    ];
    fields.forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.value = state.selectedConsignee?.[key] || '';
    });
}

export function numToIndianRupees(num) {
    const ones  = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
                   'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens  = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Lakh', 'Crore'];

    function convertGroup(n) {
        if (n === 0)   return '';
        if (n < 10)    return ones[n];
        if (n < 20)    return teens[n - 10];
        if (n < 100)   return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertGroup(n % 100) : '');
    }

    if (num === 0) return 'Zero';
    let result = '', scaleIndex = 0;
    while (num > 0) {
        const group = num % (scaleIndex === 1 ? 100 : 1000);
        if (group !== 0) {
            result = convertGroup(group)
                + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '')
                + (result ? ' ' + result : '');
        }
        num = Math.floor(num / (scaleIndex === 1 ? 100 : 1000));
        scaleIndex++;
    }
    return result + ' Rupees Only';
}
