/**
 * CART MANAGEMENT MODULE
 * Handles cart operations: add, remove, update
 */

// FIX: Removed unused imports — getHistoryCacheKey and getPartyId were imported
// but never called in this module.
import { formatCurrency } from './utils.js';

export function addItemToCart(state, stockItem) {
    const inheritedHsn = stockItem.hsn || stockItem.hsnSac || '';
    const inheritedUom = stockItem.uom || stockItem.unit || 'PCS';
    const existing = state.cart.find(
        i => i.stockId === stockItem.id && i.batch === stockItem.batch && i.itemType !== 'SERVICE'
    );
    if (existing) {
        existing.qty += 1;
        if (!existing.hsn && inheritedHsn) existing.hsn = inheritedHsn;
        if (!existing.uom && inheritedUom) existing.uom = inheritedUom;
    } else {
        state.cart.push({
            stockId:   stockItem.id,
            itemType:  'GOODS',
            item:      stockItem.item,
            narration: '',
            batch:     stockItem.batch  || null,
            oem:       stockItem.oem    || '',
            hsn:       inheritedHsn,
            qty:       1,
            uom:       inheritedUom,
            rate:      parseFloat(stockItem.rate)  || 0,
            grate:     parseFloat(stockItem.grate) || 0,
            disc:      0,
        });
    }
}

export function addItemToCartWithOverrides(state, stockItem, overrides = {}) {
    const inheritedHsn = overrides.hsn !== undefined ? overrides.hsn : (stockItem.hsn || stockItem.hsnSac || '');
    const inheritedUom = overrides.uom !== undefined ? overrides.uom : (stockItem.uom || stockItem.unit || 'PCS');
    const existing     = state.cart.find(
        i => i.stockId === stockItem.id && i.batch === stockItem.batch && i.itemType !== 'SERVICE'
    );
    const resolvedRate = overrides.rate !== undefined ? parseFloat(overrides.rate) : parseFloat(stockItem.rate);
    const resolvedDisc = overrides.disc !== undefined ? parseFloat(overrides.disc) : 0;

    if (existing) {
        existing.qty += 1;
        if (!isNaN(resolvedRate)) existing.rate = resolvedRate;
        if (!isNaN(resolvedDisc)) existing.disc = resolvedDisc;
        if (!existing.hsn && inheritedHsn) existing.hsn = inheritedHsn;
        if (!existing.uom && inheritedUom) existing.uom = inheritedUom;
    } else {
        state.cart.push({
            stockId:   stockItem.id,
            itemType:  'GOODS',
            item:      stockItem.item,
            narration: '',
            batch:     stockItem.batch  || null,
            oem:       stockItem.oem    || '',
            hsn:       inheritedHsn,
            qty:       1,
            uom:       inheritedUom,
            rate:      isNaN(resolvedRate) ? (parseFloat(stockItem.rate) || 0) : resolvedRate,
            grate:     parseFloat(stockItem.grate) || 0,
            disc:      isNaN(resolvedDisc) ? 0 : resolvedDisc,
        });
    }
}

export function addServiceToCart(state) {
    state.cart.push({
        stockId:   null,
        itemType:  'SERVICE',
        item:      '',
        narration: '',
        batch:     null,
        oem:       '',
        hsn:       '',
        qty:       1,
        showQty:   false,
        uom:       '',
        rate:      0,
        costRate:  0,
        grate:     18,
        disc:      0,
    });
}

export function removeItemFromCart(state, index) {
    state.cart.splice(index, 1);
}

export function updateCartItem(state, index, field, value) {
    const item = state.cart[index];
    if (!item) return;

    if (field === 'item' || field === 'hsn' || field === 'uom') {
        item[field] = value;
        return;
    }

    if (field === 'qty' || field === 'returnQty') {
        const isReturn = field === 'returnQty';
        if (item.itemType === 'SERVICE' && !isReturn) {
            if (value === '' || value === null || value === undefined) {
                item.qty = 1;
                item.showQty = false;
                return;
            }
            const parsed = parseFloat(value);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                item.qty = 1;
                item.showQty = false;
                return;
            }
            item.qty = parsed;
            item.showQty = true;
            return;
        }
        let parsed = parseFloat(value);
        if (!Number.isFinite(parsed) || parsed < 0) parsed = 0;
        
        if (isReturn) {
            item.returnQty = parsed;
        } else {
            item.qty = parsed;
        }
        return;
    }

    let val = parseFloat(value);
    if (isNaN(val) || val < 0) val = 0;
    item[field] = val;
}

export function updateCartItemNarration(state, index, narration) {
    if (state.cart[index]) {
        state.cart[index].narration = narration;
    }
}

export function clearCart(state) {
    state.cart                  = [];
    state.selectedParty         = null;
    state.otherCharges          = [];
    state.selectedConsignee     = null;
    state.consigneeSameAsBillTo = true;
}
