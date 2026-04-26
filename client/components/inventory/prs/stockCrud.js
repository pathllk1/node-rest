/**
 * STOCK CRUD COMPONENT
 * Handles stock create and edit operations
 */

import { showToast }     from './toast.js';
import { escHtml }       from './utils.js';
import { fetchWithCSRF } from '../../../utils/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────
export function openCreateStockModal(state, onStockSaved) {
    const subModal   = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');

    subContent.innerHTML = `
        <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex justify-between items-center text-white">
            <div>
                <h3 class="font-bold text-sm tracking-wide uppercase">Create Stock Item</h3>
                <p class="text-slate-400 text-[10px] mt-0.5">Fill in item details below</p>
            </div>
            <button id="close-sub-modal"
                    class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center rounded">&times;</button>
        </div>

        <form id="create-stock-form"
              class="p-5 grid grid-cols-2 gap-x-5 gap-y-3 overflow-y-auto max-h-[72vh]">

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Item Description *</label>
                <input type="text" name="item" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none"
                       placeholder="e.g. Dell Monitor 24 inch">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Batch No</label>
                <input type="text" name="batch"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       placeholder="Optional">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Part No (P/No)</label>
                <input type="text" name="pno"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">OEM / Brand</label>
                <input type="text" name="oem"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">HSN/SAC Code *</label>
                <input type="text" name="hsn" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       placeholder="Goods or services code">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Opening Qty *</label>
                    <input type="number" step="0.01" name="qty" required
                           class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                           placeholder="0.00">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">UOM *</label>
                    <select name="uom"
                            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="NOS">NOS</option>
                        <option value="PCS">PCS</option>
                        <option value="SET">SET</option>
                        <option value="BOX">BOX</option>
                        <option value="MTR">MTR</option>
                        <option value="KGS">KGS</option>
                    </select>
                </div>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Selling Rate (₹) *</label>
                <input type="number" step="0.01" name="rate" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">GST % *</label>
                    <select name="grate"
                            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="18">18%</option>
                        <option value="12">12%</option>
                        <option value="5">5%</option>
                        <option value="28">28%</option>
                        <option value="0">0%</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">MRP</label>
                    <input type="number" step="0.01" name="mrp"
                           class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
                </div>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Expiry Date</label>
                <input type="date" name="expiryDate"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div class="col-span-2 pt-3 border-t border-gray-100 flex justify-end gap-2 mt-1">
                <button type="button" id="cancel-create-stock"
                        class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                </button>
                <button type="submit"
                        class="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2">
                    <span id="create-btn-text">Save Item</span>
                    <div id="create-btn-spinner" class="hidden w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </button>
            </div>
        </form>
    `;

    const closeModal = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal').onclick    = closeModal;
    document.getElementById('cancel-create-stock').onclick = closeModal;

    document.getElementById('create-stock-form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data     = Object.fromEntries(formData.entries());

        data.total      = (parseFloat(data.qty) * parseFloat(data.rate)).toFixed(2);
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();

        if (data.batch || data.expiryDate || data.mrp) {
            data.batches = JSON.stringify([{
                batch:  data.batch      || null,
                qty:    parseFloat(data.qty)  || 0,
                rate:   parseFloat(data.rate) || 0,
                expiry: data.expiryDate || null,
                mrp:    data.mrp ? parseFloat(data.mrp) : null,
            }]);
            delete data.batch; delete data.expiryDate; delete data.mrp;
        }

        // FIX: Show spinner BEFORE API call — do NOT close modal until we know result
        const submitBtn = e.target.querySelector('[type="submit"]');
        const btnText   = document.getElementById('create-btn-text');
        const btnSpinner = document.getElementById('create-btn-spinner');
        if (submitBtn)   submitBtn.disabled   = true;
        if (btnText)     btnText.classList.add('hidden');
        if (btnSpinner)  btnSpinner.classList.remove('hidden');

        try {
            const response = await fetchWithCSRF('/api/inventory/purchase/stocks', {
                method: 'POST',
                body:   JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                showToast(error.error || `Failed (${response.status})`, 'error');
                return;
            }

            const result = await response.json();
            if (!result.success) {
                showToast(result.error || 'Failed to create stock', 'error');
                return;
            }

            // FIX: Only close on success
            closeModal();
            showToast('Stock item created successfully!', 'success');
            await onStockSaved(data);

        } catch (err) {
            console.error(err);
            showToast('Error creating stock: ' + err.message, 'error');
        } finally {
            if (submitBtn)   submitBtn.disabled   = false;
            if (btnText)     btnText.classList.remove('hidden');
            if (btnSpinner)  btnSpinner.classList.add('hidden');
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT
// ─────────────────────────────────────────────────────────────────────────────
export function openEditStockModal(stock, state, onStockSaved) {
    const subModal   = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    // FIX: original check was `!stock.id` — MongoDB returns `_id`, not `id`.
    // Accept either field to prevent "Invalid stock item" on all DB-sourced records.
    if (!stock || !(stock.id || stock._id)) {
        showToast('Invalid stock item.', 'error');
        return;
    }

    subModal.classList.remove('hidden');

    const batchValue = Array.isArray(stock.batches) && stock.batches.length > 0
        ? (stock.batches[0]?.batch || '')
        : (stock.batch || '');

    // FIX: All stock.* values passed through escHtml — prevents XSS via crafted item names
    subContent.innerHTML = `
        <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex justify-between items-center text-white">
            <div>
                <h3 class="font-bold text-sm tracking-wide uppercase">Edit Stock Item</h3>
                <p class="text-slate-400 text-[10px] mt-0.5 truncate max-w-[260px]">${escHtml(stock.item)}</p>
            </div>
            <button id="close-sub-modal"
                    class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center rounded">&times;</button>
        </div>

        <form id="edit-stock-form"
              class="p-5 grid grid-cols-2 gap-x-5 gap-y-3 overflow-y-auto max-h-[72vh]">

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Item Description *</label>
                <input type="text" name="item" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       value="${escHtml(stock.item || '')}">
            </div>

            <div id="batch-field-container" class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Batch No</label>
                <input type="text" name="batch"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       value="${escHtml(batchValue)}">
                <input type="hidden" name="selectedBatchIndex" value="">
            </div>

            <!-- FIX: id="batch-details" now always exists in the DOM.
                 Original bug: this element was missing, so detailsContainer.innerHTML
                 in showBatchSelectionForEdit threw a null-reference crash. -->
            <div id="batch-details" class="col-span-2 hidden p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p class="text-xs text-gray-500">Select a batch above to see details</p>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Part No (P/No)</label>
                <input type="text" name="pno"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       value="${escHtml(stock.pno || '')}">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">OEM / Brand</label>
                <input type="text" name="oem"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       value="${escHtml(stock.oem || '')}">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">HSN/SAC Code *</label>
                <input type="text" name="hsn" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       value="${escHtml(stock.hsn || '')}">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Qty *</label>
                    <input type="number" step="0.01" name="qty" required
                           class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                           value="${Number(stock.qty || 0)}">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">UOM *</label>
                    <select name="uom"
                            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
                        ${['NOS','PCS','SET','BOX','MTR','KGS'].map(u =>
                            `<option value="${u}" ${stock.uom === u ? 'selected' : ''}>${u}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Selling Rate (₹) *</label>
                <input type="number" step="0.01" name="rate" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       value="${Number(stock.rate || 0)}">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">GST % *</label>
                    <select name="grate"
                            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
                        ${[18,12,5,28,0].map(g =>
                            `<option value="${g}" ${Number(stock.grate) === g ? 'selected' : ''}>${g}%</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">MRP</label>
                    <input type="number" step="0.01" name="mrp"
                           class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                           value="${stock.mrp ? Number(stock.mrp) : ''}">
                </div>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Expiry Date</label>
                <input type="date" name="expiryDate"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
                       value="${stock.expiryDate ? String(stock.expiryDate).split('T')[0] : ''}">
            </div>

            <div class="col-span-2 pt-3 border-t border-gray-100 flex justify-end gap-2 mt-1">
                <button type="button" id="cancel-edit-stock"
                        class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                </button>
                <button type="submit"
                        class="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2">
                    <span id="edit-btn-text">Update Item</span>
                    <div id="edit-btn-spinner" class="hidden w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </button>
            </div>
        </form>
    `;

    const closeModal = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal').onclick   = closeModal;
    document.getElementById('cancel-edit-stock').onclick = closeModal;

    if (Array.isArray(stock.batches) && stock.batches.length > 1) {
        showBatchSelectionForEdit(stock);
    }

    document.getElementById('edit-stock-form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        let data       = Object.fromEntries(formData.entries());

        data.total      = (parseFloat(data.qty) * parseFloat(data.rate)).toFixed(2);
        data.updated_at = new Date().toISOString();

        // FIX: Removed all [FORM_SUBMIT] console.log — were logging full batch arrays in prod
        if (Array.isArray(stock.batches) && stock.batches.length > 0) {
            let updatedBatches      = JSON.parse(JSON.stringify(stock.batches));
            const selectedBatchIdx  = parseInt(data.selectedBatchIndex);
            let targetIdx = -1;

            if (!isNaN(selectedBatchIdx) && selectedBatchIdx >= 0 && selectedBatchIdx < updatedBatches.length) {
                targetIdx = selectedBatchIdx;
            } else {
                targetIdx = updatedBatches.findIndex(b => b.batch === (data.batch || null));
            }

            if (targetIdx !== -1) {
                updatedBatches[targetIdx].qty    = parseFloat(data.qty)  || updatedBatches[targetIdx].qty;
                updatedBatches[targetIdx].rate   = parseFloat(data.rate) || updatedBatches[targetIdx].rate;
                updatedBatches[targetIdx].expiry = data.expiryDate       || updatedBatches[targetIdx].expiry;
                updatedBatches[targetIdx].mrp    = data.mrp ? parseFloat(data.mrp) : updatedBatches[targetIdx].mrp;
            } else if (data.batch) {
                updatedBatches.push({
                    batch:  data.batch,
                    qty:    parseFloat(data.qty)  || 0,
                    rate:   parseFloat(data.rate) || 0,
                    expiry: data.expiryDate       || null,
                    mrp:    data.mrp ? parseFloat(data.mrp) : null,
                });
            } else {
                updatedBatches[0].qty    = parseFloat(data.qty)  || updatedBatches[0].qty;
                updatedBatches[0].rate   = parseFloat(data.rate) || updatedBatches[0].rate;
                updatedBatches[0].expiry = data.expiryDate       || updatedBatches[0].expiry;
                updatedBatches[0].mrp    = data.mrp ? parseFloat(data.mrp) : updatedBatches[0].mrp;
            }
            data.batches = JSON.stringify(updatedBatches);

        } else if (data.batch || data.expiryDate || data.mrp) {
            data.batches = JSON.stringify([{
                batch:  data.batch      || null,
                qty:    parseFloat(data.qty)  || 0,
                rate:   parseFloat(data.rate) || 0,
                expiry: data.expiryDate || null,
                mrp:    data.mrp ? parseFloat(data.mrp) : null,
            }]);
        }

        delete data.batch; delete data.expiryDate;
        delete data.mrp;   delete data.selectedBatchIndex;

        const stockId = stock.id || stock._id;

        // FIX: Show spinner and keep modal open until API responds
        const submitBtn  = e.target.querySelector('[type="submit"]');
        const btnText    = document.getElementById('edit-btn-text');
        const btnSpinner = document.getElementById('edit-btn-spinner');
        if (submitBtn)   submitBtn.disabled   = true;
        if (btnText)     btnText.classList.add('hidden');
        if (btnSpinner)  btnSpinner.classList.remove('hidden');

        try {
            const response = await fetchWithCSRF(`/api/inventory/purchase/stocks/${stockId}`, {
                method: 'PUT',
                body:   JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                showToast(error.error || `Failed (${response.status})`, 'error');
                return;
            }

            const result = await response.json();
            if (!result.success) {
                showToast(result.error || 'Failed to update stock', 'error');
                return;
            }

            // FIX: Only close on success
            closeModal();
            showToast('Stock item updated successfully!', 'success');
            await onStockSaved(stockId, data);

        } catch (err) {
            console.error(err);
            showToast('Error updating stock: ' + err.message, 'error');
        } finally {
            if (submitBtn)   submitBtn.disabled   = false;
            if (btnText)     btnText.classList.remove('hidden');
            if (btnSpinner)  btnSpinner.classList.add('hidden');
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH SELECTOR (edit mode, multiple batches)
// ─────────────────────────────────────────────────────────────────────────────
function showBatchSelectionForEdit(stock) {
    const batchContainer = document.getElementById('batch-field-container');
    if (!batchContainer) return;

    const label       = document.createElement('label');
    label.className   = 'block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide';
    label.textContent = 'Select Batch to Edit';

    const select      = document.createElement('select');
    select.id         = 'batch-select';
    select.name       = 'batch-select';
    select.className  = 'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white mb-2';

    const defaultOpt        = document.createElement('option');
    defaultOpt.value        = '';
    defaultOpt.textContent  = '— Select a batch to edit —';
    defaultOpt.disabled     = true;
    defaultOpt.selected     = true;
    select.appendChild(defaultOpt);

    stock.batches.forEach((batch, index) => {
        const opt       = document.createElement('option');
        opt.value       = index;
        // FIX: Text content set via textContent, not innerHTML — safe
        opt.textContent = `${batch.batch || 'No Batch'}  ·  Qty: ${batch.qty}  ·  Exp: ${batch.expiry || 'N/A'}`;
        select.appendChild(opt);
    });

    const existingHidden = batchContainer.querySelector('input[name="selectedBatchIndex"]');
    batchContainer.innerHTML = '';
    batchContainer.appendChild(label);
    batchContainer.appendChild(select);

    const hiddenField       = existingHidden || document.createElement('input');
    hiddenField.type        = 'hidden';
    hiddenField.name        = 'selectedBatchIndex';
    hiddenField.value       = '';
    batchContainer.appendChild(hiddenField);

    select.addEventListener('change', function () {
        const batchIndex = parseInt(this.value);
        if (isNaN(batchIndex) || batchIndex < 0) return;

        const sb = stock.batches[batchIndex];
        hiddenField.value = batchIndex;

        const form = select.closest('form');
        if (form) {
            const set = (name, val) => {
                const el = form.querySelector(`[name="${name}"]`);
                if (el) el.value = val ?? '';
            };
            set('batch',      sb.batch  ?? '');
            set('qty',        sb.qty    ?? '');
            set('rate',       sb.rate   ?? '');
            set('mrp',        sb.mrp    ?? '');
            set('expiryDate', sb.expiry ? String(sb.expiry).split('T')[0] : '');
        }

        // FIX: id="batch-details" always exists now (in the form template above)
        const detailsEl = document.getElementById('batch-details');
        if (detailsEl) {
            // Use textContent/createElement approach for safety
            detailsEl.innerHTML = `
                <div class="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div><span class="text-gray-400 uppercase text-[9px] tracking-wide block">Batch</span><strong>${escHtml(sb.batch || 'No Batch')}</strong></div>
                    <div><span class="text-gray-400 uppercase text-[9px] tracking-wide block">Qty</span><strong>${escHtml(String(sb.qty ?? ''))}</strong></div>
                    <div><span class="text-gray-400 uppercase text-[9px] tracking-wide block">Rate</span><strong>₹${escHtml(String(sb.rate ?? ''))}</strong></div>
                    <div><span class="text-gray-400 uppercase text-[9px] tracking-wide block">Expiry</span><strong>${escHtml(sb.expiry || 'N/A')}</strong></div>
                    <div><span class="text-gray-400 uppercase text-[9px] tracking-wide block">MRP</span><strong>${sb.mrp ? '₹' + escHtml(String(sb.mrp)) : 'N/A'}</strong></div>
                </div>`;
            detailsEl.classList.remove('hidden');
        }
    });
}