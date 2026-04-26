/**
 * CHARGES MODAL COMPONENT
 * Handles other charges management (add, remove)
 */

import { showToast } from './toast.js';
import { escHtml }   from './utils.js';

export function openOtherChargesModal(state, callbacks) {
    const { onAddCharge, onRemoveCharge, formatCurrency } = callbacks;
    // NOTE: onUpdateCharge is accepted in callbacks but edit-in-place isn't
    // implemented yet — remove charges and re-add to change them for now.

    const modal   = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');

    const renderChargesList = () => {
        if (state.otherCharges.length === 0) {
            return `<tr><td colspan="7" class="p-8 text-center text-gray-300 italic text-sm">No charges added yet</td></tr>`;
        }
        return state.otherCharges.map((charge, idx) => {
            const amt     = parseFloat(charge.amount)  || 0;
            const gstRate = parseFloat(charge.gstRate) || 0;
            const gstAmt  = (amt * gstRate) / 100;
            const total   = amt + gstAmt;
            // FIX: escHtml on charge.name, charge.type, charge.hsnSac
            return `
                <tr class="hover:bg-blue-50/60 transition-colors border-b border-gray-50 text-xs">
                    <td class="p-2.5 font-semibold text-gray-800">${escHtml(charge.name)}</td>
                    <td class="p-2.5 text-gray-500">${escHtml(charge.type || '-')}</td>
                    <td class="p-2.5 text-gray-400 font-mono text-[11px]">${escHtml(charge.hsnSac || '-')}</td>
                    <td class="p-2.5 text-right font-mono tabular-nums">${formatCurrency(amt)}</td>
                    <td class="p-2.5 text-right text-gray-500">${gstRate}%</td>
                    <td class="p-2.5 text-right font-bold tabular-nums text-gray-800">${formatCurrency(total)}</td>
                    <td class="p-2.5 text-center">
                        <button class="btn-remove-charge bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-red-100 transition-colors"
                                data-idx="${idx}">REMOVE</button>
                    </td>
                </tr>`;
        }).join('');
    };

    content.innerHTML = `
        <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
            <div>
                <h3 class="font-bold text-base text-gray-800">Other Charges</h3>
                <p class="text-xs text-gray-400 mt-0.5">Add freight, packing, insurance, etc.</p>
            </div>
            <button id="close-modal" class="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-xl">&times;</button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 bg-white space-y-4">

            <!-- Add Form -->
            <div class="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div class="col-span-2 grid grid-cols-2 gap-3">
                    <div class="relative">
                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Charge Name *</label>
                        <input type="text" id="charge-name" autocomplete="off"
                               class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white"
                               placeholder="e.g. Freight, Packing">
                        <div id="charge-name-suggestions"
                             class="hidden absolute z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-0.5 w-full max-h-40 overflow-y-auto">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Type</label>
                        <div class="relative">
                            <input type="text" id="charge-type" autocomplete="off"
                                   class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white"
                                   placeholder="Select or type custom type"
                                   list="charge-type-list">
                            <datalist id="charge-type-list">
                                <option value="Freight">
                                <option value="Packing">
                                <option value="Insurance">
                                <option value="Handling">
                                <option value="Labour">
                                <option value="Commission">
                                <option value="Discount">
                                <option value="Other">
                            </datalist>
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">HSN/SAC Code</label>
                    <input type="text" id="charge-hsn"
                           class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white"
                           placeholder="e.g. 9965">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Amount (₹) *</label>
                    <input type="number" step="0.01" id="charge-amount"
                           class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white"
                           placeholder="0.00">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">GST %</label>
                    <select id="charge-gst"
                            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                    </select>
                </div>
                <div class="flex items-end">
                    <button id="add-charge-btn"
                            class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors">
                        + Add Charge
                    </button>
                </div>
            </div>

            <!-- Charges list -->
            <div>
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-bold text-sm text-gray-700">Charges Added</h4>
                    <span class="text-xs text-gray-500">
                        Total: <span id="total-other-charges" class="font-bold text-blue-600">${formatCurrency(0)}</span>
                    </span>
                </div>
                <div class="overflow-x-auto rounded-xl border border-gray-200">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                            <tr>
                                <th class="p-2.5">Name</th><th class="p-2.5">Type</th><th class="p-2.5">HSN/SAC</th>
                                <th class="p-2.5 text-right">Amount</th><th class="p-2.5 text-right">GST%</th>
                                <th class="p-2.5 text-right">Total</th><th class="p-2.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white" id="other-charges-list">${renderChargesList()}</tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="p-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button id="cancel-other-charges"
                    class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
            </button>
            <button id="save-other-charges"
                    class="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
                Save &amp; Close
            </button>
        </div>
    `;

    // ── Autocomplete ──────────────────────────────────────────────────────────
    let existingCharges = [];
    let chargesLoaded   = false;

    const chargeNameInput      = document.getElementById('charge-name');
    const suggestionsContainer = document.getElementById('charge-name-suggestions');

    // FIX: load data first, then attach input handler — prevents race condition
    // where user types before fetch completes and sees no suggestions.
    (async () => {
        try {
            const response = await fetch('/api/inventory/purchase/other-charges-types', {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) existingCharges = data.data || [];
            }
        } catch (e) {
            console.warn('Could not load charge types:', e.message);
        } finally {
            chargesLoaded = true;
        }
    })();

    chargeNameInput.addEventListener('input', function () {
        const query = this.value.toLowerCase().trim();
        if (!query || !chargesLoaded) { suggestionsContainer.classList.add('hidden'); return; }

        const filtered = existingCharges.filter(c =>
            c.name?.toLowerCase().includes(query) || c.type?.toLowerCase().includes(query)
        );
        if (!filtered.length) { suggestionsContainer.classList.add('hidden'); return; }

        // FIX: escHtml on suggestion data
        suggestionsContainer.innerHTML = filtered.map(charge => `
            <div class="charge-suggestion-item px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                 data-name="${escHtml(charge.name || '')}"
                 data-type="${escHtml(charge.type || 'other')}"
                 data-hsnsac="${escHtml(charge.hsnSac || '')}"
                 data-gstrate="${escHtml(String(charge.gstRate || 0))}">
                <div class="text-sm font-medium text-gray-800">${escHtml(charge.name || charge.type)}</div>
                <div class="text-[10px] text-gray-400">${escHtml(charge.type)} · HSN: ${escHtml(charge.hsnSac || 'N/A')} · GST ${charge.gstRate || 0}%</div>
            </div>`).join('');

        suggestionsContainer.querySelectorAll('.charge-suggestion-item').forEach(item => {
            item.addEventListener('click', function () {
                document.getElementById('charge-name').value   = this.dataset.name    || '';
                document.getElementById('charge-type').value   = this.dataset.type    || 'Other';
                document.getElementById('charge-hsn').value    = this.dataset.hsnsac  || '';
                document.getElementById('charge-gst').value    = this.dataset.gstrate || '0';
                suggestionsContainer.classList.add('hidden');
                document.getElementById('charge-amount').focus();
            });
        });
        suggestionsContainer.classList.remove('hidden');
    });

    document.addEventListener('click', function hideSuggestions(e) {
        if (!suggestionsContainer.contains(e.target) && e.target !== chargeNameInput) {
            suggestionsContainer.classList.add('hidden');
        }
    });

    // ── Total display ─────────────────────────────────────────────────────────
    const updateTotal = () => {
        const total = state.otherCharges.reduce((sum, c) => {
            const amt = parseFloat(c.amount) || 0;
            return sum + amt + (amt * (parseFloat(c.gstRate) || 0)) / 100;
        }, 0);
        const el = document.getElementById('total-other-charges');
        if (el) el.textContent = formatCurrency(total);
    };

    const refreshList = () => {
        const el = document.getElementById('other-charges-list');
        if (el) el.innerHTML = renderChargesList();
        updateTotal();
        attachRemoveListeners();
    };

    // ── Add charge ────────────────────────────────────────────────────────────
    document.getElementById('add-charge-btn').onclick = () => {
        const name    = document.getElementById('charge-name').value.trim();
        const hsnSac  = document.getElementById('charge-hsn').value.trim();
        const amount  = parseFloat(document.getElementById('charge-amount').value);
        const gstRate = parseFloat(document.getElementById('charge-gst').value) || 0;
        const type    = document.getElementById('charge-type').value;

        if (!name)                 { showToast('Please enter a charge name', 'error');  return; }
        if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }

        onAddCharge({ name, hsnSac, amount, gstRate, type });

        document.getElementById('charge-name').value   = '';
        document.getElementById('charge-hsn').value    = '';
        document.getElementById('charge-amount').value = '';
        document.getElementById('charge-type').value   = '';
        document.getElementById('charge-gst').selectedIndex = 0;

        refreshList();
        chargeNameInput.focus();
    };

    // ── Remove charge ─────────────────────────────────────────────────────────
    const attachRemoveListeners = () => {
        document.querySelectorAll('.btn-remove-charge').forEach(btn => {
            btn.addEventListener('click', e => {
                onRemoveCharge(parseInt(e.currentTarget.dataset.idx));
                refreshList();
            });
        });
    };
    attachRemoveListeners();

    // ── Close / Save ──────────────────────────────────────────────────────────
    const closeModal = () => modal.classList.add('hidden');
    document.getElementById('close-modal').onclick             = closeModal;
    document.getElementById('cancel-other-charges').onclick    = closeModal;
    document.getElementById('save-other-charges').onclick      = () => {
        closeModal();
        if (callbacks.onSave) callbacks.onSave();
    };

    updateTotal();
}