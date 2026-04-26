/**
 * OTHER CHARGES MANAGEMENT MODULE
 */

import { formatCurrency, escHtml } from './utils.js';

export function addOtherCharge(state, charge) {
    if (charge.gstRate === undefined) charge.gstRate = 0;
    charge.gstAmount = state.gstEnabled !== false
        ? (charge.amount * charge.gstRate) / 100
        : 0;
    state.otherCharges.push(charge);
}

export function removeOtherCharge(state, index) {
    state.otherCharges.splice(index, 1);
}

export function updateOtherCharge(state, index, charge) {
    charge.gstAmount = state.gstEnabled !== false
        ? (charge.amount * (charge.gstRate || 0)) / 100
        : 0;
    state.otherCharges[index] = charge;
}

export function getTotalOtherCharges(state) {
    return state.otherCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
}

export function renderOtherChargesList(state) {
    if (state.otherCharges.length === 0) {
        return `<tr><td colspan="6" class="p-3 text-center text-gray-400 italic">No other charges added</td></tr>`;
    }
    const gstEnabled = state.gstEnabled !== undefined ? state.gstEnabled : true;
    return state.otherCharges.map((charge, index) => {
        const gstAmt   = gstEnabled ? (charge.amount * (charge.gstRate || 0)) / 100 : 0;
        const total    = charge.amount + gstAmt;
        return `
            <tr class="hover:bg-blue-50 transition-colors">
                <td class="p-3 font-medium">${escHtml(charge.name)}</td>
                <td class="p-3 text-gray-500">${escHtml(charge.hsnSac || '')}</td>
                <td class="p-3 text-gray-500">${escHtml(charge.type)}</td>
                <td class="p-3 text-right font-bold text-gray-800">${formatCurrency(charge.amount)}</td>
                <td class="p-3 text-right font-bold text-gray-800">${charge.gstRate || 0}%</td>
                <td class="p-3 text-center">
                    <button class="btn-remove-charge text-red-500 hover:text-red-700 transition-colors font-bold text-lg leading-none" data-index="${index}">&times;</button>
                </td>
            </tr>
            <tr class="bg-gray-50">
                <td class="px-3 py-1 text-right text-gray-400 text-xs" colspan="3">GST (${charge.gstRate || 0}%):</td>
                <td class="px-3 py-1 text-right text-gray-400 text-xs">${formatCurrency(gstAmt)}</td>
                <td class="px-3 py-1 text-right text-gray-500 text-xs font-bold">Total:</td>
                <td class="px-3 py-1 text-right text-gray-700 text-xs font-bold">${formatCurrency(total)}</td>
            </tr>`;
    }).join('');
}