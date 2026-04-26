/**
 * PURCHASE SYSTEM (PRS) - MAIN ORCHESTRATOR
 * Coordinates all components and manages the application lifecycle
 */

import { createInitialState, fetchCurrentUserFirmName, fetchData, loadExistingBillData, determineGstBillType } from './stateManager.js';
import { formatCurrency, populateConsigneeFromBillTo, getPartyId, escHtml } from './utils.js';
import { addOtherCharge, removeOtherCharge, updateOtherCharge } from './otherChargesManager.js';
import { addItemToCart, removeItemFromCart, updateCartItem, updateCartItemNarration, clearCart } from './cartManager.js';
import { renderItemsList, renderTotals, renderPartyCard, renderAttachmentBadge } from './layoutRenderer.js';
import { openStockModal } from './stockModal.js';
import { showBatchSelectionModal } from './batchModal.js';
import { openPartyItemHistoryModal } from './historyModal.js';
import { openCreateStockModal, openEditStockModal } from './stockCrud.js';
import { openOtherChargesModal } from './chargesModal.js';
import { openPartyModal } from './partyModal.js';
import { openCreatePartyModal } from './partyCreate.js';
import { showToast } from './toast.js';
import { exportInvoiceToPDF } from './invoiceExport.js';
import { fetchWithCSRF } from '../../../utils/api.js';

export function initPurchaseSystem(router) {
    const container = document.getElementById('purchase-system');
    if (!container) return;

    const urlParams       = new URLSearchParams(window.location.search);
    const editBillIdParam = urlParams.get('edit');
    const sessionEditId   = sessionStorage.getItem('editBillId');
    const finalEditParam  = editBillIdParam || sessionEditId;

    const returnFromBillId = sessionStorage.getItem('returnFromBillId');

    let editBillId = null;
    let isEditMode = false;
    let isReturnMode = false;

    if (finalEditParam) {
        const isValidObjectId = /^[a-f\d]{24}$/i.test(finalEditParam);
        if (isValidObjectId) {
            editBillId = finalEditParam;
            isEditMode = true;
        } else {
            console.warn('Invalid edit bill ID:', finalEditParam);
            sessionStorage.removeItem('editBillId');
            window.location.href = '/inventory/prs';
            return;
        }
    } else if (returnFromBillId) {
        isReturnMode = true;
    }

    const state = createInitialState();
    state.isReturnMode = isReturnMode;

    // Sorting state for cart table
    let cartSortConfig = {
        column: null,
        direction: 'asc' // 'asc' or 'desc'
    };

    // fetchCurrentUserFirmName now also populates state.firmLocations
    fetchCurrentUserFirmName(state);

    if (isEditMode) {
        loadExistingBillData(state, editBillId).then(() => {
            sessionStorage.removeItem('editBillId');
            fetchData(state).then(() => {
                renderMainLayout(isEditMode);
            }).catch(err => {
                console.error('Failed to load data for edit mode:', err);
                showEditError(container, err.message, editBillId);
            });
        }).catch(err => {
            console.error('Failed to load bill data:', err);
            sessionStorage.removeItem('editBillId');
            showEditError(container, err.message, editBillId);
        });
    } else if (isReturnMode) {
        loadExistingBillData(state, returnFromBillId).then(() => {
            sessionStorage.removeItem('returnFromBillId');
            const origBillNo = state.meta.billNo;
            state.ref_bill_id = returnFromBillId;
            state.meta.billNo = 'New Debit Note';
            state.meta.supplierBillNo = `Return of ${origBillNo || ''}`;
            state.meta.billDate = new Date().toISOString().split('T')[0];
            
            // Initialize return quantities to 0
            state.cart.forEach(item => {
                item.returnQty = 0;
            });

            fetchData(state).then(() => {
                renderMainLayout(false);
            }).catch(err => {
                console.error('Failed to load data for return mode:', err);
                showEditError(container, err.message, returnFromBillId);
            });
        }).catch(err => {
            console.error('Failed to load original bill for return:', err);
            sessionStorage.removeItem('returnFromBillId');
            showEditError(container, err.message, returnFromBillId);
        });
    } else {
        fetchData(state).then(() => {
            renderMainLayout(isEditMode);
        }).catch(err => {
            console.error('Failed to load data:', err);
            container.innerHTML = `
                <div class="p-8 text-center text-red-600 border border-red-200 bg-red-50 rounded">
                    <h3 class="font-bold text-lg">System Error</h3>
                    <p>${escHtml(err.message)}</p>
                    <button class="reload-system-btn mt-4 px-4 py-2 bg-red-600 text-white rounded shadow">Reload System</button>
                </div>`;
            const reloadBtn = container.querySelector('.reload-system-btn');
            if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());
        });
    }

    function showEditError(container, errorMessage, billId) {
        container.innerHTML = `
            <div class="p-8 text-center text-red-600 border border-red-200 bg-red-50 rounded">
                <h3 class="font-bold text-lg">Edit/Return Bill Error</h3>
                <p class="mb-4">Unable to load bill ${escHtml(String(billId))}:</p>
                <p class="mb-6 font-mono text-sm">${escHtml(errorMessage)}</p>
                <div class="flex gap-3 justify-center">
                    <button onclick="window.location.href='/inventory/reports'"
                            class="px-4 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700 transition">
                        Back to Bills Report
                    </button>
                    <button onclick="window.location.href='/inventory/prs'"
                            class="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition">
                        Create New Purchase
                    </button>
                </div>
            </div>`;
    }

    /* ── Auto-determine GST bill type from firm location vs supplier state ─────
     *
     * FIX: Same logic as the sales system. When the user selects a supplier or
     * changes the active firm GSTIN, we compare state codes and automatically
     * set the bill type dropdown.  The backend also validates before saving.
     *
     * For purchases the "recipient" is our firm (activeFirmLocation) and the
     * "supplier" is the party (selectedParty).  The intra/inter-state rule is
     * identical to sales — only the ITC implication differs.
     */
    function autoSetBillType() {
        const detectedType = determineGstBillType(state.activeFirmLocation, state.selectedParty, state.selectedPartyLocation);
        if (!detectedType) return;

        state.meta.billType = detectedType;

        refreshBillTypeUi();
    }

    function refreshBillTypeUi() {
        const detectedType = state.meta.billType;

        const sel = document.getElementById('billTypeSelector');
        if (sel) sel.value = detectedType;

        const totals = document.getElementById('totals-section');
        if (totals) totals.innerHTML = renderTotals(state);

        const partyContainer = document.getElementById('party-display');
        if (partyContainer && state.selectedParty) {
            renderPartyCard(state).then(html => {
                partyContainer.innerHTML = html;

                const changePartyBtn = document.getElementById('btn-change-party');
                const editPartyBtn = document.getElementById('btn-edit-party');
                if (changePartyBtn) changePartyBtn.onclick = () => {
                    if (isReturnMode) return;
                    openPartyModal(state, {
                        onSelectParty: async (party) => {
                            state.selectedParty = party;
                            state.historyCache  = {};
                            autoSetBillType();
                            renderMainLayout(isEditMode);
                        },
                        onCreateParty: () => {
                            openCreatePartyModal(state, async (newParty) => {
                                state.parties.push(newParty);
                                state.selectedParty = newParty;
                                state.historyCache  = {};
                                autoSetBillType();
                                renderMainLayout(isEditMode);
                            });
                        },
                        onPartyCardUpdate: () => renderPartyCard(state),
                    });
                };
                if (editPartyBtn) {
                    editPartyBtn.onclick = () => {
                        window.open('/inventory/suppliers', '_blank');
                    };
                }
            }).catch(err => {
                console.error('Failed to refresh supplier card after GST change:', err);
            });
        }
    }

    /* ── Firm GSTIN selector ───────────────────────────────────────────────────
     *
     * FIX: Shown only when the firm has more than one GST registration.
     * For purchases this tells the system which of our GSTINs is *receiving*
     * these goods — the ITC (Input Tax Credit) accrues to that specific GSTIN.
     */
    function renderFirmGstinSelector() {
        const locs = state.firmLocations;
        if (!locs || locs.length <= 1) return '';

        const options = locs.map(l => {
            const label    = `${l.gst_number || 'No GSTIN'} — ${l.state || l.state_code || ''}${l.is_default ? ' (Default)' : ''}`;
            const selected = state.activeFirmLocation?.gst_number === l.gst_number ? 'selected' : '';
            return `<option value="${escHtml(l.gst_number || '')}" ${selected}>${escHtml(label)}</option>`;
        }).join('');

        return `
            <div class="flex flex-col">
                <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Receiving GSTIN</label>
                <select id="firmGstinSelector"
                        class="border border-orange-300 bg-orange-50 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-400 outline-none text-slate-700 font-medium"
                        title="Select which firm GSTIN is receiving these goods (ITC will accrue to this GSTIN)"
                        ${state.isReturnMode ? 'disabled' : ''}>
                    ${options}
                </select>
            </div>`;
    }

    function sortCart(column) {
        if (cartSortConfig.column === column) {
            // Toggle direction if same column clicked
            cartSortConfig.direction = cartSortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            cartSortConfig.column = column;
            cartSortConfig.direction = 'asc';
        }

        const sortFunctions = {
            'item': (a, b) => (a.item || '').localeCompare(b.item || ''),
            'qty': (a, b) => (parseFloat(a.qty) || 0) - (parseFloat(b.qty) || 0),
            'rate': (a, b) => (parseFloat(a.rate) || 0) - (parseFloat(b.rate) || 0),
            'disc': (a, b) => (parseFloat(a.disc) || 0) - (parseFloat(b.disc) || 0),
            'grate': (a, b) => (parseFloat(a.grate) || 0) - (parseFloat(b.grate) || 0),
            'total': (a, b) => {
                const aQty = parseFloat(a.qty) || 0;
                const bQty = parseFloat(b.qty) || 0;
                const aTotal = aQty * (parseFloat(a.rate) || 0) * (1 - (parseFloat(a.disc) || 0) / 100);
                const bTotal = bQty * (parseFloat(b.rate) || 0) * (1 - (parseFloat(b.disc) || 0) / 100);
                return aTotal - bTotal;
            }
        };

        const sortFn = sortFunctions[column];
        if (sortFn) {
            state.cart.sort(sortFn);
            if (cartSortConfig.direction === 'desc') {
                state.cart.reverse();
            }
        }

        renderMainLayout(isEditMode);
    }

    function renderMainLayout(isEditMode = false) {
        const isReturnMode = state.isReturnMode;
        const themeClass = isReturnMode ? 'bg-amber-50/50' : 'bg-gray-50';
        const headerClass = isReturnMode ? 'border-amber-200' : 'border-gray-200';
        const titleText = isReturnMode ? 'Purchase Return (Debit Note)' : 'Purchase Invoice';

        container.innerHTML = `
        <div class="h-[calc(100vh-140px)] flex flex-col ${themeClass} text-slate-800 font-sans text-sm border ${isReturnMode ? 'border-amber-300' : 'border-gray-300'} rounded-lg shadow-sm overflow-hidden transition-colors duration-300">

            <!-- Header -->
            <div class="bg-white border-b ${headerClass} p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm z-20">
                <div class="flex flex-col sm:flex-row flex-wrap gap-2">
                    <div class="flex items-center gap-2">
                        <h1 class="text-lg font-bold ${isReturnMode ? 'text-amber-800' : 'text-gray-800'}">${titleText}</h1>
                        ${isEditMode ? '<span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full border border-orange-200">EDIT MODE</span>' : ''}
                        ${isReturnMode ? '<span class="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200 animate-pulse">RETURN MODE</span>' : ''}
                    </div>
                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Supplier Bill No</label>
                        <input type="text" id="supplier-bill-no" value="${escHtml(state.meta.supplierBillNo || '')}"
                               class="border ${isReturnMode ? 'border-amber-400 bg-amber-50' : 'border-amber-300 bg-amber-50'} rounded px-2 py-1 text-xs font-bold w-40 text-slate-700 focus:ring-1 focus:ring-amber-500 outline-none"
                               placeholder="Enter supplier bill no"
                               title="Enter the supplier's actual bill or invoice number">
                    </div>
                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Date</label>
                        <input type="date" id="bill-date-input" value="${escHtml(state.meta.billDate)}"
                               class="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-700">
                    </div>

                    <!-- Existing attachment display during edit mode -->
                    ${isEditMode && state.currentBillFileUrl ? `
                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">Attachment</label>
                        <div id="main-attachment-display" class="flex items-center gap-1"></div>
                    </div>
                    ` : ''}

                    <!-- FIX: Receiving GSTIN selector — only shown when firm has multiple GST registrations -->
                    ${renderFirmGstinSelector()}

                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Transaction Type</label>
                        <select id="billTypeSelector" class="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 font-medium" ${isReturnMode ? 'disabled' : ''}>
                            <option value="intra-state" ${state.meta.billType === 'intra-state' ? 'selected' : ''}>Intra-State (CGST + SGST)</option>
                            <option value="inter-state" ${state.meta.billType === 'inter-state' ? 'selected' : ''}>Inter-State (IGST)</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-2 pt-4">
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox" id="reverse-charge-toggle" ${state.meta.reverseCharge ? 'checked' : ''} class="form-checkbox h-4 w-4 text-blue-600 rounded" ${isReturnMode ? 'disabled' : ''}>
                            <span class="ml-2 text-[10px] uppercase text-gray-500 font-bold tracking-wider whitespace-nowrap">Reverse Charge</span>
                        </label>
                        <div class="text-[10px] font-bold px-2 py-1 rounded ${state.gstEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            GST: ${state.gstEnabled ? 'ON' : 'OFF'}
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    ${!isReturnMode ? `
                    <button id="btn-other-charges" class="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded hover:bg-blue-100 transition-colors whitespace-nowrap">Other Charges</button>
                    <button id="btn-add-item"      class="px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors whitespace-nowrap">Add Items (F2)</button>
                    <button id="btn-reset"         class="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 rounded hover:bg-red-100 transition-colors whitespace-nowrap">Reset</button>
                    ` : ''}
                    <button id="btn-save"          class="px-4 py-1.5 ${isReturnMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-800 hover:bg-slate-900'} text-white text-xs rounded shadow font-medium flex items-center gap-2 transition-colors whitespace-nowrap">
                        <span id="save-icon">💾</span>
                        <span id="save-text">${isReturnMode ? 'Save Debit Note' : (isEditMode ? 'Update Purchase Bill' : 'Save Purchase Invoice')}</span>
                        <div id="save-spinner" class="hidden w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
                    </button>
                </div>
            </div>

            <!-- Main Content -->
            <div class="flex-1 overflow-hidden flex flex-col md:flex-row">

                <!-- Sidebar -->
                <div class="w-full md:w-64 ${isReturnMode ? 'bg-amber-50/30' : 'bg-slate-50'} border-r border-gray-200 flex flex-col overflow-y-auto z-10">
                    <div class="p-3 border-b border-gray-200 bg-white">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Supplier (Bill From)</label>
                        <div id="party-display">
                            <div class="group bg-blue-50 p-3 rounded border border-blue-200 shadow-sm">
                                <h3 class="font-bold text-sm text-blue-900 truncate">Loading…</h3>
                                <p class="text-[11px] text-gray-600 truncate mt-1">Please wait</p>
                            </div>
                        </div>
                    </div>

                    <!-- Consignee Section -->
                    <div class="p-3 border-b border-gray-200 bg-white mt-3">
                        <div class="flex justify-between items-center mb-2">
                            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Consignee Details</label>
                            <label class="flex items-center cursor-pointer text-[10px] text-blue-600 font-medium">
                                <input type="checkbox" id="consignee-same-as-bill-to" ${state.consigneeSameAsBillTo ? 'checked' : ''} class="form-checkbox h-3 w-3 text-blue-600 rounded mr-1" ${isReturnMode ? 'disabled' : ''}>
                                Same as Bill To
                            </label>
                        </div>
                        <div id="consignee-display">
                            <div class="space-y-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Consignee Name *</label>
                                    <input type="text" id="consignee-name" value="${escHtml(state.selectedConsignee?.name || '')}"
                                           class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter consignee name" ${isReturnMode ? 'readonly' : ''}>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Address *</label>
                                    <textarea id="consignee-address" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-16 resize-none" placeholder="Enter delivery address" ${isReturnMode ? 'readonly' : ''}>${escHtml(state.selectedConsignee?.address || '')}</textarea>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-[10px] text-gray-500 font-bold mb-1 block">GSTIN</label>
                                        <input type="text" id="consignee-gstin" value="${escHtml(state.selectedConsignee?.gstin || '')}"
                                               class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none uppercase" placeholder="27ABCDE1234F1Z5" maxlength="15" ${isReturnMode ? 'readonly' : ''}>
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-500 font-bold mb-1 block">State *</label>
                                        <input type="text" id="consignee-state" value="${escHtml(state.selectedConsignee?.state || '')}"
                                               class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter state" ${isReturnMode ? 'readonly' : ''}>
                                    </div>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">PIN Code</label>
                                    <input type="text" id="consignee-pin" value="${escHtml(state.selectedConsignee?.pin || '')}"
                                           class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter PIN code" maxlength="6" ${isReturnMode ? 'readonly' : ''}>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Contact</label>
                                    <input type="text" id="consignee-contact" value="${escHtml(state.selectedConsignee?.contact || '')}"
                                           class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Phone/Email" ${isReturnMode ? 'readonly' : ''}>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Delivery Instructions</label>
                                    <textarea id="consignee-delivery-instructions" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-12 resize-none" placeholder="Special delivery instructions" ${isReturnMode ? 'readonly' : ''}>${escHtml(state.selectedConsignee?.deliveryInstructions || '')}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Meta Fields -->
                    <div class="p-3 space-y-3">
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">System Purchase No</label>
                            <input type="text" value="${escHtml(state.meta.billNo)}" readonly
                                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs font-bold bg-gray-100 text-slate-500 cursor-not-allowed"
                                   title="${isEditMode ? 'Internal purchase number cannot be changed in edit mode' : 'Internal purchase number is auto-generated on save'}">
                            <p class="mt-1 text-[10px] text-gray-400">Internal auto number used by the system.</p>
                        </div>
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Reference / PO No</label>
                            <input type="text" id="reference-no" value="${escHtml(state.meta.referenceNo)}"
                                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="e.g. PO-2025-001" ${isReturnMode ? 'readonly' : ''}>
                        </div>
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Vehicle No</label>
                            <input type="text" id="vehicle-no" value="${escHtml(state.meta.vehicleNo)}"
                                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="e.g. KA01AB1234">
                        </div>
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Narration</label>
                            <textarea id="narration" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-20 resize-none" placeholder="Additional notes…">${escHtml(state.meta.narration)}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Items Section -->
                <div class="flex-1 bg-white flex flex-col relative min-w-0">
                    <div class="${isReturnMode
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 border-b border-amber-300 text-[11px] font-bold text-white uppercase tracking-wider flex pr-2 shrink-0 shadow-sm'
                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 border-b border-emerald-300 text-[11px] font-bold text-white uppercase tracking-wider flex pr-2 shrink-0 shadow-sm'}">
                        <div class="p-2 w-10 text-center">#</div>
                        <div class="p-2 flex-1">Item Description</div>
                        <div class="p-2 w-20">HSN</div>
                        <div class="p-2 w-16 text-right">${isReturnMode ? 'Orig Qty' : 'Qty'}</div>
                        ${isReturnMode ? '<div class="p-2 w-16 text-right">Ret Qty</div>' : ''}
                        <div class="p-2 w-12 text-center">Unit</div>
                        <div class="p-2 w-24 text-right">Rate</div>
                        <div class="p-2 w-16 text-right">Disc %</div>
                        <div class="p-2 w-16 text-right">Tax %</div>
                        <div class="p-2 w-28 text-right">Total</div>
                        <div class="p-2 w-10 text-center"></div>
                    </div>

                    <div class="flex-1 overflow-y-auto custom-scrollbar relative" id="items-container">
                        ${renderItemsList(state)}
                    </div>

                    ${!isReturnMode ? `
                    <div class="p-2 border-t border-dashed border-gray-200 bg-gray-50 shrink-0">
                        <button id="btn-add-item-bottom" class="w-full py-2 border border-dashed border-blue-300 text-blue-600 rounded hover:bg-blue-50 text-xs font-bold transition-colors uppercase tracking-wide">
                            + Add Items (F2) &nbsp;|&nbsp; Select Supplier (F3) &nbsp;|&nbsp; Charges (F4) &nbsp;|&nbsp; Save (F8) &nbsp;|&nbsp; Reset (F9)
                        </button>
                    </div>
                    ` : `
                    <div class="p-3 border-t border-amber-200 bg-amber-50 shrink-0 text-amber-800 text-xs flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <div>
                            <p class="font-bold uppercase tracking-tight">Return Mode Active</p>
                            <p class="opacity-80">Adjust the <strong>Ret Qty</strong> column for items being returned. Items with 0 return quantity will be ignored. Rates and discounts are locked to original bill values.</p>
                        </div>
                    </div>
                    `}

                    <div class="bg-slate-50 border-t border-slate-300 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]" id="totals-section">
                        ${renderTotals(state)}
                    </div>
                </div>
            </div>
        </div>

        <!-- Modals -->
        <div id="modal-backdrop" class="fixed inset-0 bg-black/50 hidden z-40 flex items-center justify-center backdrop-blur-sm transition-opacity">
            <div id="modal-content" class="bg-white rounded shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-down"></div>
        </div>

        <div id="sub-modal-backdrop" class="fixed inset-0 bg-black/60 hidden z-50 flex items-center justify-center backdrop-blur-sm transition-opacity">
            <div id="sub-modal-content" class="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-300 animate-scale-in"></div>
        </div>

        <!-- Save Confirmation Modal -->
        <div id="save-confirmation-modal" class="fixed inset-0 bg-black/50 hidden z-50 flex items-center justify-center backdrop-blur-sm">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                <div class="${isReturnMode ? 'bg-gradient-to-r from-amber-600 to-orange-500' : 'bg-gradient-to-r from-green-600 to-emerald-500'} px-6 py-5 text-white text-center">
                    <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold tracking-wide">${isReturnMode ? 'Debit Note Saved!' : 'Purchase Saved!'}</h3>
                    <p class="text-white/80 text-sm mt-1">${isReturnMode ? 'Debit Note' : 'Purchase'} No: <span id="modal-bill-no-display" class="font-bold text-white"></span></p>
                </div>
                <div class="p-5 flex flex-col gap-2">
                    <button id="download-pdf-btn"
                            class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2">
                        Download PDF
                    </button>
                    <button id="download-excel-btn"
                            class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2">
                        Download Excel
                    </button>

                    <!-- Upload scanned bill section -->
                    <div class="border-t border-gray-100 pt-3 mt-1 ${isReturnMode ? 'hidden' : ''}">
                        <!-- Existing attachment display -->
                        <div id="existing-attachment-section" class="hidden mb-3">
                            <p class="text-[11px] text-gray-500 font-bold uppercase tracking-wide mb-2">Attached Document</p>
                            <div id="existing-attachment-badge" class="mb-2"></div>
                        </div>

                        <p class="text-[11px] text-gray-500 font-bold uppercase tracking-wide mb-2">Attach Scanned Bill <span class="font-normal text-gray-400">(Optional)</span></p>
                        <input type="file" id="bill-file-input" accept=".pdf,.jpg,.jpeg"
                               class="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5
                                      file:mr-2 file:py-1 file:px-2 file:rounded file:border-0
                                      file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200
                                      cursor-pointer">
                        <p class="text-[10px] text-gray-400 mt-1">PDF or JPEG · Max 200 KB</p>
                        <div id="upload-success" class="hidden items-center gap-2 mt-2 text-green-700 text-xs font-bold">
                            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            Bill attached successfully
                        </div>
                        <p id="upload-error" class="hidden text-[10px] text-red-600 mt-1 font-medium"></p>
                        <button id="upload-bill-btn" disabled
                                class="w-full mt-2 py-2 bg-slate-600 hover:bg-slate-700
                                       disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
                                       text-white text-sm font-bold rounded-lg shadow transition-colors
                                       flex items-center justify-center gap-2">
                            <div id="upload-spinner" class="hidden w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span id="upload-text">Upload Scanned Bill</span>
                        </button>
                    </div>

                    <button id="close-modal-btn"
                            class="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
        `;

        // Party display
        const partyContainer = document.getElementById('party-display');
        if (partyContainer) {
            renderPartyCard(state).then(html => {
                partyContainer.innerHTML = html;

                const handlePartySelection = () => {
                    if (isReturnMode) return; // Cannot change party in return mode
                    openPartyModal(state, {
                        onSelectParty: async (party) => {
                            state.selectedParty = party;
                            state.historyCache  = {};
                            // FIX: Auto-detect bill type after supplier is selected
                            autoSetBillType();
                            renderMainLayout(isEditMode);
                        },
                        onCreateParty: () => {
                            openCreatePartyModal(state, async (newParty) => {
                                state.parties.push(newParty);
                                state.selectedParty = newParty;
                                state.historyCache  = {};
                                // FIX: Auto-detect bill type after new supplier is created
                                autoSetBillType();
                                renderMainLayout(isEditMode);
                            });
                        },
                        onPartyCardUpdate: () => renderPartyCard(state),
                    });
                };

                const selectPartyBtn = document.getElementById('btn-select-party');
                const changePartyBtn = document.getElementById('btn-change-party');
                const editPartyBtn = document.getElementById('btn-edit-party');
                if (selectPartyBtn) selectPartyBtn.onclick = handlePartySelection;
                if (changePartyBtn) changePartyBtn.onclick = handlePartySelection;
                if (editPartyBtn) {
                    editPartyBtn.onclick = () => {
                        window.open('/inventory/suppliers', '_blank');
                    };
                }
            });
        }

        // Main attachment display (edit mode)
        const mainAttachmentDisplay = document.getElementById('main-attachment-display');
        if (mainAttachmentDisplay && isEditMode && state.currentBillFileUrl && editBillId) {
            const badgeHtml = renderAttachmentBadge(state.currentBillFileUrl, editBillId);
            if (badgeHtml) {
                mainAttachmentDisplay.innerHTML = badgeHtml;
            }
        }

        attachEventListeners(isEditMode, editBillId || null);
    }

    async function refreshStocks() {
        try {
            const response = await fetch('/api/inventory/purchase/stocks', {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) state.stocks = Array.isArray(data.data) ? data.data : [];
            }
        } catch (err) {
            console.error('Failed to refresh stocks:', err);
        }
    }

    function buildStockModalCallbacks(isEditMode) {
        return {
            onSelectStock: async (stock, showBatchModal) => {
                if (showBatchModal) {
                    await showBatchSelectionModal(stock, (stockWithBatch) => {
                        addItemToCart(state, stockWithBatch);
                        renderMainLayout(isEditMode);
                    });
                } else {
                    addItemToCart(state, stock);
                    renderMainLayout(isEditMode);
                }
            },
            onCreateStock: () => {
                openCreateStockModal(state, async () => {
                    await refreshStocks();
                    openStockModal(state, buildStockModalCallbacks(isEditMode));
                });
            },
            onEditStock: (stock) => {
                openEditStockModal(stock, state, async () => {
                    await refreshStocks();
                    renderMainLayout(isEditMode);
                });
            },
            onViewHistory: (stock) => {
                openPartyItemHistoryModal(stock, state);
            },
        };
    }

    function attachEventListeners(isEditMode = false, editBillId = null) {
        const isReturnMode = state.isReturnMode;

        const showSaveSpinner = () => {
            document.getElementById('btn-save')?.setAttribute('disabled', 'true');
            document.getElementById('save-icon')?.classList.add('hidden');
            document.getElementById('save-text')?.classList.add('hidden');
            document.getElementById('save-spinner')?.classList.remove('hidden');
        };
        const hideSaveSpinner = () => {
            document.getElementById('btn-save')?.removeAttribute('disabled');
            document.getElementById('save-icon')?.classList.remove('hidden');
            document.getElementById('save-text')?.classList.remove('hidden');
            document.getElementById('save-spinner')?.classList.add('hidden');
        };

        // Add item
        const addBtn = document.getElementById('btn-add-item');
        if (addBtn) addBtn.onclick = () => openStockModal(state, buildStockModalCallbacks(isEditMode));
        
        const addBtnBottom = document.getElementById('btn-add-item-bottom');
        if (addBtnBottom) addBtnBottom.onclick = () => openStockModal(state, buildStockModalCallbacks(isEditMode));

        // Other charges
        const chargesBtn = document.getElementById('btn-other-charges');
        if (chargesBtn) {
            chargesBtn.onclick = () => {
                openOtherChargesModal(state, {
                    onAddCharge:    (charge)     => addOtherCharge(state, charge),
                    onRemoveCharge: (idx)         => removeOtherCharge(state, idx),
                    onUpdateCharge: (idx, charge) => updateOtherCharge(state, idx, charge),
                    formatCurrency,
                    onSave: () => {
                        const totals = document.getElementById('totals-section');
                        if (totals) totals.innerHTML = renderTotals(state);
                    },
                });
            };
        }

        // Reset
        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('Clear current invoice details?')) {
                    // Clear cart and party/consignee
                    clearCart(state);
                    
                    // Reset party and consignee
                    state.selectedParty = null;
                    state.selectedConsignee = null;
                    state.consigneeSameAsBillTo = true;
                    state.selectedPartyGstin = null;
                    state.selectedPartyLocation = null;
                    
                    // Reset meta fields to initial values
                    state.meta.billNo = '';
                    state.meta.supplierBillNo = '';
                    state.meta.billDate = new Date().toISOString().split('T')[0];
                    state.meta.billType = 'intra-state';
                    state.meta.reverseCharge = false;
                    state.meta.referenceNo = '';
                    state.meta.vehicleNo = '';
                    state.meta.dispatchThrough = '';
                    state.meta.narration = '';
                    
                    // Reset other charges
                    state.otherCharges = [];
                    
                    // Reset file URL
                    state.currentBillFileUrl = null;
                    
                    // Re-render the entire layout
                    renderMainLayout(isEditMode);
                }
            };
        }

        // FIX: Receiving GSTIN selector — update activeFirmLocation and re-derive bill type
        const firmGstinSelector = document.getElementById('firmGstinSelector');
        if (firmGstinSelector) {
            firmGstinSelector.onchange = (e) => {
                const selectedGstin = e.target.value;
                state.activeFirmLocation = state.firmLocations.find(l => l.gst_number === selectedGstin) || null;
                autoSetBillType();
            };
        }

        // Save
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                // VALIDATE FIRST - before showing spinner
                if (state.cart.length === 0) {
                    showToast('Cannot save an empty invoice. Please add items.', 'error');
                    return;
                }
                if (!state.selectedParty) {
                    showToast('Please select a supplier before saving.', 'error');
                    return;
                }

                if (isReturnMode) {
                    const hasReturnItems = state.cart.some(item => (item.returnQty || 0) > 0);
                    if (!hasReturnItems) {
                        showToast('Please specify return quantity for at least one item.', 'error');
                        return;
                    }
                }

                if (isEditMode) {
                    const confirmed = confirm(
                        '⚠️ Edit Bill Confirmation\n\n' +
                        'Editing this bill will:\n' +
                        '• Update stock quantities\n' +
                        '• Recalculate GST and totals\n' +
                        '• Update accounting ledger entries\n\n' +
                        'This action cannot be undone. Continue?'
                    );
                    if (!confirmed) return;
                }

                // THEN show spinner for actual save operation
                showSaveSpinner();

                try {
                    const partyId  = getPartyId(state.selectedParty);
                    
                    let response;
                    if (isReturnMode) {
                        // DEBIT NOTE DATA STRUCTURE
                        const returnData = {
                            originalBillId: state.ref_bill_id,
                            returnCart: state.cart
                                .filter(item => (item.returnQty || 0) > 0)
                                .map(item => ({
                                    stockId: item.stockId,
                                    returnQty: item.returnQty,
                                    rate: item.rate,
                                    grate: item.grate,
                                    disc: item.disc,
                                    item: item.item,
                                    gstRate: item.grate, // Backend expectation
                                })),
                            narration: state.meta.narration,
                        };

                        response = await fetchWithCSRF('/api/inventory/purchase/create-debit-note', {
                            method: 'POST',
                            body: JSON.stringify(returnData),
                        });
                    } else {
                        // REGULAR BILL DATA STRUCTURE
                        const billData = {
                            meta: {
                                ...state.meta,
                                // FIX: send the active firm GSTIN so the backend can
                                // validate the bill type and record it on the bill document.
                                // For purchases this is the *receiving* GSTIN — ITC accrues here.
                                firmGstin: state.activeFirmLocation?.gst_number || null,
                                partyGstin: state.selectedPartyGstin || null,
                            },
                            party:        partyId,
                            cart:         state.cart,
                            otherCharges: state.otherCharges,
                            consignee:    state.selectedConsignee,
                        };

                        const method = isEditMode ? 'PUT' : 'POST';
                        const url    = isEditMode
                            ? `/api/inventory/purchase/bills/${editBillId}`
                            : '/api/inventory/purchase/bills';

                        response = await fetchWithCSRF(url, {
                            method,
                            body: JSON.stringify(billData),
                        });
                    }

                    if (!response.ok) {
                        const error = await response.json();
                        showToast(error.error || `Failed (${response.status})`, 'error');
                        return;
                    }

                    const result = await response.json();
                    if (!result.success) {
                        showToast(result.error || 'Failed to save bill', 'error');
                        return;
                    }

                    const successMsg = isReturnMode 
                        ? `Debit Note saved! No: ${result.billNo}`
                        : (isEditMode
                            ? `Purchase bill updated! Purchase No: ${result.billNo || state.meta.billNo}`
                            : `Purchase saved! Purchase No: ${result.billNo}`);
                    showToast(successMsg, 'success');
                    showSaveConfirmationModal(result.id, result.billNo, isEditMode, state.currentBillFileUrl);

                } catch (err) {
                    console.error('Error saving bill:', err);
                    showToast((isEditMode ? 'Error updating purchase bill: ' : 'Error saving purchase: ') + err.message, 'error');
                } finally {
                    hideSaveSpinner();
                }
            };
        }

        // Table inputs (qty / rate / disc)
        document.querySelectorAll('.tbl-input').forEach(input => {
            input.oninput = (e) => {
                const idx   = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                updateCartItem(state, idx, field, e.target.value);

                const totalsSection = document.getElementById('totals-section');
                if (totalsSection) totalsSection.innerHTML = renderTotals(state);

                const rowContainer = e.target.closest('.flex');
                const rowTotalEl = rowContainer?.querySelector('.row-total');
                if (rowTotalEl) {
                    const item     = state.cart[idx];
                    const effectiveQty = isReturnMode ? (item.returnQty || 0) : (item.qty || 0);
                    const rowTotal = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);
                    rowTotalEl.textContent = formatCurrency(rowTotal);
                }
            };
        });

        // Narration inputs (delegated)
        const itemsContainer = document.getElementById('items-container');
        if (itemsContainer) {
            itemsContainer.addEventListener('input', (e) => {
                if (e.target.matches('input[data-field="narration"]')) {
                    updateCartItemNarration(state, parseInt(e.target.dataset.idx), e.target.value);
                }
            });
        }

        // Sort button handlers
        document.getElementById('sort-item')?.addEventListener('click', () => sortCart('item'));
        document.getElementById('sort-qty')?.addEventListener('click', () => sortCart('qty'));
        document.getElementById('sort-rate')?.addEventListener('click', () => sortCart('rate'));
        document.getElementById('sort-disc')?.addEventListener('click', () => sortCart('disc'));
        document.getElementById('sort-grate')?.addEventListener('click', () => sortCart('grate'));
        document.getElementById('sort-total')?.addEventListener('click', () => sortCart('total'));

        // Remove row buttons
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.onclick = (e) => {
                removeItemFromCart(state, parseInt(e.target.dataset.idx));
                renderMainLayout(isEditMode);
            };
        });

        // Bill type
        const billTypeSelector = document.getElementById('billTypeSelector');
        if (billTypeSelector) {
            billTypeSelector.onchange = (e) => {
                state.meta.billType = e.target.value;
                refreshBillTypeUi();
            };
        }

        // Reverse charge
        const rcToggle = document.getElementById('reverse-charge-toggle');
        if (rcToggle) {
            rcToggle.onchange = (e) => {
                state.meta.reverseCharge = e.target.checked;
                const totals = document.getElementById('totals-section');
                if (totals) totals.innerHTML = renderTotals(state);
            };
        }

        // Consignee same-as-bill-to toggle
        const consigneeToggle = document.getElementById('consignee-same-as-bill-to');
        if (consigneeToggle) {
            consigneeToggle.onchange = (e) => {
                state.consigneeSameAsBillTo = e.target.checked;
                if (e.target.checked) populateConsigneeFromBillTo(state);
                renderMainLayout(isEditMode);
            };
        }

        // Scalar inputs
        const bindInput = (id, setter) => {
            const el = document.getElementById(id);
            if (el) el.oninput = (e) => setter(e.target.value);
        };
        bindInput('supplier-bill-no',                v => { state.meta.supplierBillNo   = v; });
        bindInput('reference-no',                    v => { state.meta.referenceNo      = v; });
        bindInput('vehicle-no',                      v => { state.meta.vehicleNo        = v; });
        bindInput('narration',                       v => { state.meta.narration        = v; });
        bindInput('dispatch-through',                v => { state.meta.dispatchThrough  = v; });
        bindInput('consignee-name',                  v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.name = v; });
        bindInput('consignee-gstin',                 v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.gstin = v; });
        bindInput('consignee-state',                 v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.state = v; });
        bindInput('consignee-pin',                   v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.pin = v; });
        bindInput('consignee-contact',               v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.contact = v; });
        bindInput('consignee-delivery-instructions', v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.deliveryInstructions = v; });
        bindInput('consignee-address',               v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.address = v; });

        // Bill date
        const billDateInput = document.getElementById('bill-date-input');
        if (billDateInput) {
            billDateInput.oninput = (e) => { state.meta.billDate = e.target.value; };
        }
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!container || container.classList.contains('hidden')) return;
        if (e.key === 'F2') { e.preventDefault(); document.getElementById('btn-add-item')?.click(); }
        else if (e.key === 'F3') {
            e.preventDefault();
            (document.getElementById('btn-select-party') || document.getElementById('btn-change-party'))?.click();
        } else if (e.key === 'F4') { e.preventDefault(); document.getElementById('btn-other-charges')?.click(); }
        else if (e.key === 'F8') { e.preventDefault(); document.getElementById('btn-save')?.click(); }
        else if (e.key === 'F9') { e.preventDefault(); document.getElementById('btn-reset')?.click(); }
    });

    function showSaveConfirmationModal(billId, billNo, isEditMode, fileUrl) {
        const modal    = document.getElementById('save-confirmation-modal');
        const billNoEl = document.getElementById('modal-bill-no-display');
        if (billNoEl) billNoEl.textContent = billNo;
        modal.classList.remove('hidden');

        // Display existing attachment if present
        const existingAttachmentSection = document.getElementById('existing-attachment-section');
        const existingAttachmentBadge = document.getElementById('existing-attachment-badge');
        if (fileUrl && existingAttachmentSection && existingAttachmentBadge) {
                const badgeHtml = renderAttachmentBadge(fileUrl, billId);
            if (badgeHtml) {
                existingAttachmentSection.classList.remove('hidden');
                existingAttachmentBadge.innerHTML = badgeHtml;
            }
        } else if (existingAttachmentSection) {
            existingAttachmentSection.classList.add('hidden');
        }

        // Reset upload section state on every open
        const fileInput     = document.getElementById('bill-file-input');
        const uploadBtn     = document.getElementById('upload-bill-btn');
        const uploadSuccess = document.getElementById('upload-success');
        const uploadError   = document.getElementById('upload-error');
        if (fileInput)     { fileInput.value = ''; fileInput.classList.remove('hidden'); }
        if (uploadBtn)     { uploadBtn.disabled = true; uploadBtn.classList.remove('hidden'); }
        if (uploadSuccess) uploadSuccess.classList.replace('flex', 'hidden');
        if (uploadError)   { uploadError.textContent = ''; uploadError.classList.add('hidden'); }

        // Enable upload button only once a file is chosen
        if (fileInput) {
            fileInput.onchange = () => {
                if (uploadBtn) uploadBtn.disabled = !(fileInput.files?.length > 0);
            };
        }
        if (uploadBtn) {
            uploadBtn.onclick = () => handleFileUpload(billId, state);
        }

        const handleAfterModal = () => {
            if (isEditMode || state.isReturnMode) {
                setTimeout(() => router.navigate('/inventory/reports'), 500);
            } else {
                clearCart(state);
                state.currentBillFileUrl = null;
                fetchData(state).then(() => renderMainLayout(isEditMode));
            }
        };

        document.getElementById('download-pdf-btn').onclick = () => {
            downloadFile(`/api/inventory/purchase/bills/${billId}/pdf`, `Purchase_${billId}.pdf`, 'application/pdf', billId, handleAfterModal);
        };
        document.getElementById('download-excel-btn').onclick = () => {
            downloadFile(`/api/inventory/purchase/bills/${billId}/excel`, `Purchase_${billId}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', billId, handleAfterModal);
        };
        document.getElementById('close-modal-btn').onclick = () => {
            closeConfirmModal();
            handleAfterModal();
        };
    }

    /**
     * Upload a scanned bill file (PDF or JPEG, ≤200 KB) for the saved bill.
     *
     * Uses fetchWithCSRF to ensure proper security while allowing the browser
     * to set the correct multipart/form-data boundary for FormData uploads.
     */
    async function handleFileUpload(billId, state) {
        const fileInput     = document.getElementById('bill-file-input');
        const uploadBtn     = document.getElementById('upload-bill-btn');
        const uploadSpinner = document.getElementById('upload-spinner');
        const uploadText    = document.getElementById('upload-text');
        const uploadSuccess = document.getElementById('upload-success');
        const uploadError   = document.getElementById('upload-error');

        const file = fileInput?.files?.[0];
        if (!file) return;

        // Client-side guard
        const allowedTypes = ['application/pdf', 'image/jpeg'];
        if (!allowedTypes.includes(file.type)) {
            uploadError.textContent = 'Only PDF and JPEG/JPG files are allowed.';
            uploadError.classList.remove('hidden');
            return;
        }
        if (file.size > 200 * 1024) {
            uploadError.textContent = `File too large (${(file.size / 1024).toFixed(0)} KB). Maximum is 200 KB.`;
            uploadError.classList.remove('hidden');
            return;
        }

        // Show spinner, clear previous error
        uploadBtn.disabled = true;
        if (uploadSpinner) uploadSpinner.classList.remove('hidden');
        if (uploadText)    uploadText.classList.add('hidden');
        if (uploadError)   uploadError.classList.add('hidden');

        try {
            const formData = new FormData();
            formData.append('billFile', file);

            const response = await fetchWithCSRF(`/api/inventory/purchase/bills/${billId}/upload`, {
                method:  'POST',
                body:    formData,
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || `Upload failed (${response.status})`);
            }

            // Update state with the uploaded file URL
            if (result.fileUrl && state) {
                state.currentBillFileUrl = result.fileUrl;
            }

            // Success — hide file input + button, show checkmark
            if (fileInput) fileInput.classList.add('hidden');
            if (uploadBtn) uploadBtn.classList.add('hidden');
            if (uploadSuccess) uploadSuccess.classList.replace('hidden', 'flex');
            showToast('Scanned bill attached successfully!', 'success');

        } catch (err) {
            if (uploadError) {
                uploadError.textContent = err.message;
                uploadError.classList.remove('hidden');
            }
            if (uploadBtn) uploadBtn.disabled = false;
        } finally {
            if (uploadSpinner) uploadSpinner.classList.add('hidden');
            if (uploadText)    uploadText.classList.remove('hidden');
        }
    }

    function closeConfirmModal() {
        document.getElementById('save-confirmation-modal')?.classList.add('hidden');
    }

    function downloadFile(url, filename, _mimeType, billId, handleAfterModal) {
        fetch(url, { method: 'GET', credentials: 'same-origin' })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.blob();
            })
            .then(blob => {
                const objectUrl = URL.createObjectURL(blob);
                const link      = document.createElement('a');
                link.href       = objectUrl;
                link.download   = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(objectUrl);
                closeConfirmModal();
                handleAfterModal();
            })
            .catch(error => {
                console.error('Download error:', error);
                showToast('Failed to download. Please try again.', 'error');
            });
    }
}
