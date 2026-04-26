/**
 * LAYOUT RENDERER MODULE
 * Handles main UI layout rendering and component display
 */

// FIX: Removed unused import `getHistoryCacheKey`
// FIX: Static import instead of dynamic `await import('./utils.js')` inside renderPartyCard
import { formatCurrency, getPartyId, escHtml, populateConsigneeFromBillTo, getItemEffectiveQty, getItemDisplayQty, getItemLineTotal, isServiceItem, shouldShowItemQty, calculateBillTotals } from './utils.js';
import { renderOtherChargesList } from './otherChargesManager.js';

// Service autocomplete cache
let serviceAutocompleteCache = null;
let serviceAutocompleteTimestamp = 0;
const AUTOCOMPLETE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchServiceSuggestions() {
    const now = Date.now();
    if (serviceAutocompleteCache && (now - serviceAutocompleteTimestamp) < AUTOCOMPLETE_CACHE_TTL) {
        return serviceAutocompleteCache;
    }

    try {
        const response = await fetch('/api/inventory/sales/services', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            console.warn(`Service suggestions fetch failed with status ${response.status}`);
            return [];
        }
        const data = await response.json();
        if (!data.success) {
            console.warn('Service suggestions API returned success: false', data);
            return [];
        }
        if (!Array.isArray(data.data)) {
            console.warn('Service suggestions API returned non-array data:', data.data);
            return [];
        }
        
        serviceAutocompleteCache = data.data;
        serviceAutocompleteTimestamp = now;
        console.log(`Loaded ${serviceAutocompleteCache.length} service suggestions`);
        return serviceAutocompleteCache;
    } catch (error) {
        console.error('Error fetching service suggestions:', error);
        return [];
    }
}

function createServiceAutocompleteDropdown(suggestions, searchTerm, onSelect) {
    if (suggestions.length === 0) return '';
    
    const filtered = suggestions.filter(s =>
        s.item.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filtered.length === 0) return '';
    
    return `
        <div class="absolute top-full left-0 right-0 bg-white border border-blue-300 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
            ${filtered.slice(0, 10).map((service, idx) => `
                <div class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-100 last:border-b-0 service-suggestion" data-idx="${idx}">
                    <div class="font-medium text-gray-800">${escHtml(service.item)}</div>
                    <div class="text-[10px] text-gray-500">
                        ${service.hsn ? `SAC: ${escHtml(service.hsn)}` : ''} 
                        ${service.rate ? `| Rate: ₹${service.rate}` : ''}
                    </div>
                </div>
            `).join('')}
        </div>`;
}

export function attachServiceAutocomplete(state, itemIndex) {
    const itemInput = document.querySelector(`input[data-idx="${itemIndex}"][data-field="item"]`);
    if (!itemInput) {
        console.warn(`Service autocomplete: input field not found for index ${itemIndex}`);
        return;
    }
    
    console.log(`Attaching service autocomplete to item index ${itemIndex}`);
    
    let suggestions = [];
    let dropdownContainer = null;
    let selectedIndex = -1;
    let filteredSuggestions = [];
    
    const selectSuggestion = (service) => {
        state.cart[itemIndex].item = service.item;
        state.cart[itemIndex].hsn = service.hsn;
        state.cart[itemIndex].uom = service.uom;
        state.cart[itemIndex].rate = service.rate;
        state.cart[itemIndex].grate = service.grate;
        
        // Update UI
        itemInput.value = service.item;
        const hsnInput = document.querySelector(`input[data-idx="${itemIndex}"][data-field="hsn"]`);
        const uomInput = document.querySelector(`input[data-idx="${itemIndex}"][data-field="uom"]`);
        const rateInput = document.querySelector(`input[data-idx="${itemIndex}"][data-field="rate"]`);
        const grateInput = document.querySelector(`input[data-idx="${itemIndex}"][data-field="grate"]`);
        
        if (hsnInput) hsnInput.value = service.hsn;
        if (uomInput) uomInput.value = service.uom;
        if (rateInput) rateInput.value = service.rate;
        if (grateInput) grateInput.value = service.grate;
        
        // Recalculate row total immediately
        const itemRow = itemInput.closest('.flex.items-center');
        if (itemRow) {
            const rowTotalElement = itemRow.querySelector('.row-total');
            if (rowTotalElement) {
                const effectiveQty = getItemEffectiveQty(state.cart[itemIndex]);
                const rowTotal = effectiveQty * service.rate * (1 - (state.cart[itemIndex].disc || 0) / 100);
                rowTotalElement.textContent = formatCurrency(rowTotal);
            }
        }
        
        // Recalculate invoice totals
        const totalsSection = document.getElementById('totals-section');
        if (totalsSection) {
            totalsSection.innerHTML = renderTotals(state);
        }
        
        // Close dropdown
        if (dropdownContainer) {
            dropdownContainer.remove();
            dropdownContainer = null;
        }
        selectedIndex = -1;
    };
    
    itemInput.addEventListener('focus', async () => {
        suggestions = await fetchServiceSuggestions();
    });
    
    itemInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value;
        selectedIndex = -1;
        
        console.log(`Service input changed: "${searchTerm}"`);
        
        if (!suggestions.length) {
            console.log('Fetching service suggestions...');
            suggestions = await fetchServiceSuggestions();
            console.log(`Fetched ${suggestions.length} suggestions`);
        }
        
        // Remove existing dropdown
        if (dropdownContainer) dropdownContainer.remove();
        
        if (searchTerm.length === 0) return;
        
        filteredSuggestions = suggestions.filter(s =>
            s.item.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        console.log(`Filtered to ${filteredSuggestions.length} suggestions`);
        
        if (filteredSuggestions.length === 0) return;
        
        // Create dropdown container
        dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'absolute top-full left-0 right-0 bg-white border border-blue-300 rounded shadow-lg z-50 max-h-48 overflow-y-auto';
        dropdownContainer.style.minWidth = itemInput.offsetWidth + 'px';
        
        dropdownContainer.innerHTML = filteredSuggestions.slice(0, 10).map((service, idx) => `
            <div class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-100 last:border-b-0 service-suggestion" data-service-idx="${idx}">
                <div class="font-medium text-gray-800">${escHtml(service.item)}</div>
                <div class="text-[10px] text-gray-500">
                    ${service.hsn ? `SAC: ${escHtml(service.hsn)}` : ''} 
                    ${service.rate ? `| Rate: ₹${service.rate}` : ''}
                </div>
            </div>
        `).join('');
        
        // Position dropdown
        const rect = itemInput.getBoundingClientRect();
        dropdownContainer.style.position = 'fixed';
        dropdownContainer.style.top = (rect.bottom + 2) + 'px';
        dropdownContainer.style.left = rect.left + 'px';
        dropdownContainer.style.width = rect.width + 'px';
        
        document.body.appendChild(dropdownContainer);
        
        // Add click handlers
        dropdownContainer.querySelectorAll('.service-suggestion').forEach((el, idx) => {
            el.addEventListener('click', () => {
                selectSuggestion(filteredSuggestions[idx]);
            });
        });
    });
    
    // Keyboard navigation
    itemInput.addEventListener('keydown', (e) => {
        if (!dropdownContainer) return;
        
        const items = dropdownContainer.querySelectorAll('.service-suggestion');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateHighlight(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
                selectSuggestion(filteredSuggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (dropdownContainer) {
                dropdownContainer.remove();
                dropdownContainer = null;
            }
            selectedIndex = -1;
        }
    });
    
    const updateHighlight = (items) => {
        items.forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add('bg-blue-100');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('bg-blue-100');
            }
        });
    };
    
    // Close dropdown on blur
    itemInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (dropdownContainer) {
                dropdownContainer.remove();
                dropdownContainer = null;
            }
        }, 200);
    });
}

export function renderItemsList(state) {
    if (state.cart.length === 0) {
        return `
        <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-300 select-none pointer-events-none">
            <svg class="w-16 h-16 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <p class="text-sm font-medium text-gray-400">Your cart is empty</p>
            <p class="text-xs text-gray-400 mt-1">
                Quick Actions:
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F2</kbd> Add Items &nbsp;|&nbsp;
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F3</kbd> Select Party &nbsp;|&nbsp;
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F4</kbd> Other Charges
            </p>
        </div>`;
    }

    const isReturnMode = state.isReturnMode;

    // Update header if in return mode
    const header = document.getElementById('sales-cart-header');
    if (header) {
        if (isReturnMode) {
            header.innerHTML = `
                <div class="p-2 w-10 text-center">#</div>
                <div class="p-2 flex-1">Item Description</div>
                <div class="p-2 w-20">HSN</div>
                <div class="p-2 w-16 text-right">Orig Qty</div>
                <div class="p-2 w-16 text-right">Ret Qty</div>
                <div class="p-2 w-12 text-center">Unit</div>
                <div class="p-2 w-24 text-right">Rate</div>
                <div class="p-2 w-16 text-right">Disc %</div>
                <div class="p-2 w-16 text-right">Tax %</div>
                <div class="p-2 w-28 text-right">Total</div>
                <div class="p-2 w-10 text-center"></div>
            `;
        } else {
            header.innerHTML = `
                <div class="p-2 w-10 text-center">#</div>
                <div class="p-2 flex-1">Item Description</div>
                <div class="p-2 w-20">HSN</div>
                <div class="p-2 w-16 text-right">Qty</div>
                <div class="p-2 w-12 text-center">Unit</div>
                <div class="p-2 w-24 text-right">Rate</div>
                <div class="p-2 w-16 text-right">Disc %</div>
                <div class="p-2 w-16 text-right">Tax %</div>
                <div class="p-2 w-28 text-right">Total</div>
                <div class="p-2 w-10 text-center"></div>
            `;
        }
    }

    // FIX: escHtml applied to all user/API data in template strings
    return state.cart.map((item, index) => {
        const isService = isServiceItem(item);
        const effectiveQty = isReturnMode ? (item.returnQty || 0) : getItemEffectiveQty(item);
        const rowTotal  = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);
        const qtyValue  = isReturnMode ? (item.returnQty || 0) : getItemDisplayQty(item);
        const rowBgColor = index % 2 === 0 ? 'bg-white' : 'bg-blue-50/30';
        const rowHoverColor = 'hover:bg-blue-100/50';
        
        return `
        <div class="flex items-center border-b border-gray-200 text-xs text-gray-700 transition-colors min-h-10 group ${rowBgColor} ${rowHoverColor} ${isReturnMode ? 'bg-amber-50/20' : ''}">
            <div class="p-2 w-10 text-center text-gray-500 font-mono font-bold">${index + 1}</div>
            <div class="p-2 flex-1 font-medium truncate flex flex-col justify-center">
                ${isService
                    ? `<input type="text" data-idx="${index}" data-field="item"
                       value="${escHtml(item.item || '')}"
                       class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 font-medium text-gray-800"
                       placeholder="Service description" ${isReturnMode ? 'readonly' : ''}>`
                    : `<span class="text-gray-800 font-semibold">${escHtml(item.item)}</span>`}
                <span class="text-[10px] text-gray-500 font-normal">${isService ? '🔧 Service Line' : `📦 Batch: ${escHtml(item.batch || '-')} | OEM: ${escHtml(item.oem || '-')}`}</span>
            </div>
            <div class="p-2 w-20 text-gray-600 border-l border-gray-200 group-hover:border-blue-300">
                ${isService
                    ? `<input type="text" data-idx="${index}" data-field="hsn"
                       value="${escHtml(item.hsn || '')}"
                       class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-gray-600 font-mono"
                       placeholder="SAC" ${isReturnMode ? 'readonly' : ''}>`
                    : `<span class="font-mono text-gray-700">${escHtml(item.hsn)}</span>`}
            </div>

            ${isReturnMode ? `
            <div class="p-2 w-16 text-right text-gray-400 font-medium border-l border-transparent group-hover:border-blue-100">
                ${item.qty}
            </div>
            <div class="p-1 w-16 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" max="${item.qty}" step="0.01" data-idx="${index}" data-field="returnQty"
                       value="${qtyValue}"
                       class="tbl-input w-full text-right bg-amber-50 border-b border-amber-200 focus:bg-white focus:border-amber-500 outline-none px-1 font-bold text-amber-700 shadow-sm rounded">
            </div>
            ` : `
            <div class="p-1 w-16 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" step="0.01" data-idx="${index}" data-field="qty"
                       value="${qtyValue === '' ? '' : Number(qtyValue)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 font-semibold text-blue-700">
            </div>
            `}

            <div class="p-2 w-12 text-center text-gray-600 text-[10px] border-l border-gray-200 group-hover:border-blue-300 font-medium">
                ${isService
                    ? `<input type="text" data-idx="${index}" data-field="uom"
                       value="${escHtml(item.uom || '')}"
                       class="w-full text-[10px] text-center bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1"
                       placeholder="${shouldShowItemQty(item) ? 'UOM' : ''}" ${isReturnMode ? 'readonly' : ''}>`
                    : `<span class="font-semibold">${escHtml(item.uom)}</span>`}
            </div>

            <div class="p-1 w-24 border-l border-gray-200 group-hover:border-blue-300">
                <input type="number" min="0" step="0.01" data-idx="${index}" data-field="rate"
                       value="${Number(item.rate)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 font-mono font-semibold text-gray-800" ${isReturnMode ? 'readonly' : ''}>
            </div>

            <div class="p-1 w-16 border-l border-gray-200 group-hover:border-blue-300">
                <input type="number" min="0" max="100" step="0.01" data-idx="${index}" data-field="disc"
                       value="${Number(item.disc || 0)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 placeholder-gray-300 font-mono" placeholder="0" ${isReturnMode ? 'readonly' : ''}>
            </div>

            <div class="p-1 w-16 border-l border-gray-200 group-hover:border-blue-300">
                ${isService
                    ? `<input type="number" min="0" max="100" step="0.01" data-idx="${index}" data-field="grate"
                       value="${Number(item.grate || 0)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-gray-700 font-mono font-semibold" ${isReturnMode ? 'readonly' : ''}>`
                    : `<div class="p-1 text-right text-gray-700 font-mono font-semibold">${escHtml(String(item.grate))}%</div>`}
            </div>
            <div class="p-2 w-28 text-right font-bold text-blue-700 row-total border-l border-gray-200 group-hover:border-blue-300 bg-blue-50/50 group-hover:bg-blue-100/30 tabular-nums rounded-r">${formatCurrency(rowTotal)}</div>

            <div class="p-2 w-10 text-center border-l border-gray-200 group-hover:border-blue-300">
                ${!isReturnMode ? `<button data-idx="${index}" class="btn-remove text-gray-400 hover:text-red-600 transition-colors font-bold text-lg leading-none hover:scale-125">×</button>` : ''}
            </div>
        </div>
        <div class="flex items-start border-b border-gray-200 text-xs text-gray-700 group ${rowBgColor} pl-20 pr-2 py-1">
            <div class="flex-1 text-[10px] text-gray-600 uppercase tracking-wide pt-1 font-semibold">📝 Item Narration</div>
            <div class="flex-1 p-1 border-l border-gray-200 group-hover:border-blue-300">
                <textarea data-idx="${index}" data-field="narration"
                       class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 min-h-12 resize-y"
                       placeholder="Add narration for this item">${escHtml(item.narration || '')}</textarea>
            </div>
        </div>`;
    }).join('');
}

export function renderTotals(state) {
    const gstEnabled = state.gstEnabled !== undefined ? state.gstEnabled : true;
    const isReturnMode = state.isReturnMode;
    
    // Create a virtual cart for total calculation if in return mode
    const effectiveCart = isReturnMode 
        ? state.cart.map(item => ({ ...item, qty: item.returnQty || 0 }))
        : state.cart;

    const totals = calculateBillTotals({
        cart: effectiveCart,
        otherCharges: state.otherCharges,
        gstEnabled,
        billType: state.meta.billType,
        reverseCharge: state.meta.reverseCharge,
    });

    const totalQty = effectiveCart.reduce((sum, item) => {
        if (!shouldShowItemQty(item)) return sum;
        return sum + (isReturnMode ? (item.returnQty || 0) : getItemEffectiveQty(item));
    }, 0).toFixed(2);

    const titleLabel = isReturnMode ? 'Return Totals' : 'Invoice Totals';
    const qtyLabel = isReturnMode ? 'Ret Qty' : 'Total Quantity';

    return `
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div class="text-[11px] text-gray-400 space-y-1">
            <div class="flex gap-4">
                <span>Total Items: <b class="text-gray-600">${state.cart.length}</b></span>
                <span>${qtyLabel}: <b class="${isReturnMode ? 'text-amber-700' : 'text-gray-600'}">${totalQty}</b></span>
            </div>
            ${state.meta.reverseCharge ? '<div class="text-red-600 font-bold mt-1">REVERSE CHARGE APPLIES</div>' : ''}
            <div class="text-gray-400 italic mt-2">* Rates are inclusive of discounts before tax</div>
        </div>

        <div class="flex gap-6 text-xs">
            <div class="text-right space-y-1.5 text-gray-500 font-medium">
                <div class="mb-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">${titleLabel}</div>
                <div>Taxable Value</div>
                ${state.meta.billType === 'intra-state'
                    ? `<div>CGST Output</div><div>SGST Output</div>`
                    : `<div>IGST Output</div>`}
                ${state.otherCharges.length > 0 ? `<div>Other Charges</div>` : ''}
                <div>Round Off</div>
                <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-gray-700">Net Return Total</div>
            </div>
            <div class="text-right space-y-1.5 font-mono font-bold text-gray-800">
                <div class="mb-2 h-4"></div>
                <div class="tabular-nums">${formatCurrency(totals.itemTaxableTotal)}</div>
                ${state.meta.billType === 'intra-state'
                    ? `<div class="text-gray-600 tabular-nums">${formatCurrency(totals.cgst)}</div><div class="text-gray-600 tabular-nums">${formatCurrency(totals.sgst)}</div>`
                    : `<div class="text-gray-600 tabular-nums">${formatCurrency(totals.igst)}</div>`}
                ${state.otherCharges.length > 0
                    ? `<div class="text-gray-600 tabular-nums">${formatCurrency(totals.otherChargesTotal)}</div>` : ''}
                <div class="text-gray-600 tabular-nums">${formatCurrency(totals.rof)}</div>
                <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-lg ${isReturnMode ? 'text-amber-700' : 'text-blue-700'} leading-none tabular-nums">
                    ${formatCurrency(totals.ntot)}
                </div>
            </div>
        </div>
    </div>`;
}

export async function renderPartyCard(state) {
    if (state.selectedParty) {
        let balanceInfo = { balance: 0, balanceType: 'Credit', balanceFormatted: '₹0.00' };
        const partyId   = getPartyId(state.selectedParty);

        try {
            const response = await fetch(`/api/inventory/sales/party-balance/${partyId}`, {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const bal = data.data?.balance || 0;
                    const balanceType = data.data?.balance_type || (bal >= 0 ? 'Debit' : 'Credit');
                    const outstanding = data.data?.outstanding ?? Math.abs(bal);
                    balanceInfo = {
                        balance:          bal,
                        balanceType,
                        balanceFormatted: new Intl.NumberFormat('en-IN', {
                            style: 'currency', currency: 'INR',
                        }).format(outstanding),
                    };
                }
            }
        } catch (error) {
            console.error('Error fetching party balance:', error);
        }

        // FIX: static import instead of dynamic `await import('./utils.js')` —
        // populateConsigneeFromBillTo is now imported at the top of this file.
        if (state.consigneeSameAsBillTo) {
            populateConsigneeFromBillTo(state);
        }

        // FIX: escHtml applied to all party fields used in template
        const billTypeBadge = (() => {
            const bt = state.meta?.billType;
            if (bt === 'intra-state') {
                return `<span class="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200"
                              title="Same state — CGST + SGST applies">Local</span>`;
            }
            if (bt === 'inter-state') {
                return `<span class="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200"
                              title="Different state — IGST applies">Out of State</span>`;
            }
            return ''; // bill type not yet resolved
        })();

        return `
            <div class="group bg-blue-50 p-3 rounded border border-blue-200 shadow-sm">
                <div class="flex justify-between items-start">
                    <h3 class="font-bold text-sm text-blue-900 truncate flex-1"
                        title="${escHtml(state.selectedParty.firm)}">${escHtml(state.selectedParty.firm)}</h3>
                    <div class="flex gap-1.5 ml-2 flex-shrink-0">
                        <button id="btn-edit-party"
                                class="text-[10px] text-green-600 hover:text-green-800 font-bold bg-white p-1.5 rounded shadow-sm border border-gray-200 hover:border-green-300 whitespace-nowrap"
                                title="Edit Party" ${state.isReturnMode ? 'disabled style="display:none"' : ''}>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button id="btn-change-party"
                                class="text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-white p-1.5 rounded shadow-sm border border-gray-200 hover:border-blue-300 whitespace-nowrap"
                                title="Change Party" ${state.isReturnMode ? 'disabled style="display:none"' : ''}>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <p class="text-[11px] text-gray-600 truncate mt-1">${escHtml(state.selectedPartyLocation?.address || state.selectedParty.addr || '')}</p>
                <div class="flex items-center gap-2 mt-2">
                    <span class="bg-blue-100 text-blue-800 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-200">
                        GST: ${escHtml(state.selectedPartyGstin || state.selectedParty.gstin || '')}
                    </span>
                    ${billTypeBadge}
                </div>
                <div class="flex items-center gap-2 mt-2">
                    <span class="${balanceInfo.balance >= 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'} text-[10px] font-mono px-2 py-0.5 rounded border">
                        BAL: ${escHtml(balanceInfo.balanceType)} ${escHtml(balanceInfo.balanceFormatted)}
                    </span>
                </div>
            </div>`;
    }

    return `
        <button id="btn-select-party"
                class="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-400
                       hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all
                       flex flex-col items-center justify-center gap-2 group">
            <span class="text-2xl group-hover:scale-110 transition-transform font-light">+</span>
            <span class="text-xs font-semibold uppercase tracking-wide">Select Party</span>
        </button>`;
}
