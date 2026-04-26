/**
 * PARTY CREATE COMPONENT
 * Handles party creation modal
 */

import { fetchPartyByGST } from './partyManager.js';
import { showToast }       from './toast.js';
import { fetchWithCSRF }   from '../../../utils/api.js';
import { escHtml }         from './utils.js';
import { INDIA_STATE_CODES } from './stateManager.js';

export function openCreatePartyModal(state, onPartySaved) {
    const subModal   = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');

    subContent.innerHTML = `
        <div class="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center text-white">
            <div>
                <h3 class="font-bold text-sm tracking-wide">ADD NEW PARTY</h3>
                <p class="text-slate-400 text-[10px] mt-0.5">Fill in party details below</p>
            </div>
            <button id="close-sub-modal-party" class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center">&times;</button>
        </div>

        <form id="create-party-form" class="p-5 grid grid-cols-2 gap-x-5 gap-y-3.5 overflow-y-auto max-h-[72vh]">

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Firm Name *</label>
                <input type="text" name="firm" id="new-party-firm" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none"
                       placeholder="e.g. M/S Global Enterprises">
            </div>

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">GSTIN</label>
                <div class="flex gap-2">
                    <input type="text" name="gstin" id="new-party-gstin"
                           class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none font-mono uppercase"
                           placeholder="27ABCDE1234F1Z5" maxlength="15">
                    <button type="button" id="btn-fetch-gst"
                            class="shrink-0 bg-orange-500 hover:bg-orange-600 text-white px-3 rounded-lg text-xs font-bold shadow transition-colors min-w-[60px]">
                        FETCH
                    </button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">Click Fetch to auto-fill details from GST portal</p>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Contact No</label>
                <input type="text" name="contact"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">State *</label>
                <input type="text" name="state" id="new-party-state" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">State Code</label>
                <input type="text" name="state_code" id="new-party-state-code" inputmode="numeric" maxlength="2"
                       class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 outline-none text-gray-400 cursor-not-allowed" readonly>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">PAN</label>
                <input type="text" name="pan" id="new-party-pan"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none uppercase font-mono"
                       maxlength="10">
            </div>

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Address</label>
                <textarea name="addr" id="new-party-addr" rows="2"
                          class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none resize-none"></textarea>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Pincode</label>
                <input type="number" name="pin" id="new-party-pin"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div class="col-span-2 pt-4 border-t border-gray-100">
                <div class="flex items-center justify-between mb-3">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Additional GST Locations</label>
                    <button type="button" id="btn-add-gst-location"
                            class="text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded font-bold transition-colors">
                        + Add Location
                    </button>
                </div>
                <div id="gst-locations-container" class="space-y-3 mb-4 max-h-48 overflow-y-auto"></div>
            </div>

            <div class="col-span-2 pt-4 border-t border-gray-100 flex justify-end gap-2 mt-1">
                <button type="button" id="cancel-create-party"
                        class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                </button>
                <button type="submit"
                        class="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
                    Save Party
                </button>
            </div>
        </form>
    `;

    const closeFunc = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal-party').addEventListener('click', closeFunc);
    document.getElementById('cancel-create-party').addEventListener('click', closeFunc);

    // Auto-detect State Code + PAN from GSTIN
    document.getElementById('new-party-gstin').addEventListener('input', e => {
        const val = e.target.value.toUpperCase();
        e.target.value = val;
        // BUG FIX: was !isNaN(val.substring(0,2)) which passes for '', ' ', etc.
        // Use regex to confirm first two chars are digits before writing state_code.
        if (val.length >= 2 && /^\d{2}/.test(val)) {
            document.getElementById('new-party-state-code').value = val.substring(0, 2);
        } else if (val.length < 2) {
            // BUG FIX: clear stale state_code when GSTIN is erased
            document.getElementById('new-party-state-code').value = '';
        }
        if (val.length >= 12) {
            document.getElementById('new-party-pan').value = val.substring(2, 12);
        }
    });

    // Auto-detect State Code from State name for unregistered suppliers
    // (GSTIN is absent so the GSTIN listener above never fires; use the name→code map)
    document.getElementById('new-party-state').addEventListener('input', e => {
        const gstinVal = document.getElementById('new-party-gstin').value.trim();
        // Only update from state name when GSTIN is not already providing the code
        if (gstinVal.length >= 2) return;
        const code = INDIA_STATE_CODES[e.target.value.trim().toLowerCase()];
        document.getElementById('new-party-state-code').value = code ?? '';
    });

    document.getElementById('btn-fetch-gst').addEventListener('click', function () {
        fetchPartyByGST(this);
    });

    // Multi-GSTIN Location Management
    let gstLocations = [];

    const renderGstLocations = () => {
        const container = document.getElementById('gst-locations-container');
        if (!container) return;

        if (gstLocations.length === 0) {
            container.innerHTML = '<p class="text-[10px] text-gray-400 italic">No additional locations added yet</p>';
            return;
        }

        container.innerHTML = gstLocations.map((loc, idx) => `
            <div class="border border-gray-200 rounded-lg p-2.5 bg-gray-50 space-y-2">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex-1 grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-[9px] font-bold text-gray-500 uppercase">GSTIN</label>
                            <div class="flex gap-1">
                                <input type="text" value="${escHtml(loc.gstin || '')}" maxlength="15"
                                       class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono uppercase"
                                       data-loc-idx="${idx}" data-loc-field="gstin">
                                <button type="button" class="btn-fetch-location-gst text-xs bg-orange-500 hover:bg-orange-600 text-white px-1.5 rounded font-bold transition-colors"
                                        data-loc-idx="${idx}" title="Fetch GST details">F</button>
                            </div>
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-gray-500 uppercase">State</label>
                            <input type="text" value="${escHtml(loc.state || '')}"
                                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                   data-loc-idx="${idx}" data-loc-field="state">
                        </div>
                    </div>
                    <button type="button" class="btn-remove-location text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                            data-loc-idx="${idx}">×</button>
                </div>
                <div>
                    <label class="text-[9px] font-bold text-gray-500 uppercase">Address</label>
                    <input type="text" value="${escHtml(loc.address || '')}"
                           class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                           data-loc-idx="${idx}" data-loc-field="address">
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <div>
                        <label class="text-[9px] font-bold text-gray-500 uppercase">City</label>
                        <input type="text" value="${escHtml(loc.city || '')}"
                               class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                               data-loc-idx="${idx}" data-loc-field="city">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-gray-500 uppercase">Pincode</label>
                        <input type="text" value="${escHtml(loc.pincode || '')}"
                               class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                               data-loc-idx="${idx}" data-loc-field="pincode">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-gray-500 uppercase">Contact</label>
                        <input type="text" value="${escHtml(loc.contact || '')}"
                               class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                               data-loc-idx="${idx}" data-loc-field="contact">
                    </div>
                </div>
                <div>
                    <label class="text-[9px] font-bold text-gray-500 uppercase">PAN</label>
                    <input type="text" value="${escHtml(loc.pan || '')}" maxlength="10"
                           class="w-full border border-gray-300 rounded px-2 py-1 text-xs uppercase font-mono"
                           data-loc-idx="${idx}" data-loc-field="pan">
                </div>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" ${loc.is_primary ? 'checked' : ''} class="location-primary-checkbox"
                           data-loc-idx="${idx}">
                    <span class="text-[9px] font-bold text-gray-600">Mark as Primary</span>
                </label>
            </div>
        `).join('');

        // Attach event listeners for location fields
        container.querySelectorAll('[data-loc-field]').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.locIdx);
                const field = e.target.dataset.locField;
                gstLocations[idx][field] = e.target.value;
            });
        });

        // Use event delegation for GST fetch buttons
        container.addEventListener('click', async (e) => {
            if (!e.target.classList.contains('btn-fetch-location-gst')) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const btn = e.target;
            const idx = parseInt(btn.dataset.locIdx);
            const gstinInput = container.querySelector(`input[data-loc-idx="${idx}"][data-loc-field="gstin"]`);
            const gstin = gstinInput?.value?.trim();

            if (!gstin || gstin.length !== 15) {
                showToast('Please enter a valid 15-character GSTIN', 'error');
                return;
            }

            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳';
            btn.disabled = true;

            try {
                const response = await fetchWithCSRF('/api/inventory/purchase/gst-lookup', {
                    method: 'POST',
                    body: JSON.stringify({ gstin }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    showToast(error.error || `Failed (${response.status})`, 'error');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    return;
                }

                const data = await response.json();
                if (!data.success) {
                    showToast(data.error || 'Failed to fetch GST details', 'error');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    return;
                }

                const partyData = data.data || data;
                const displayName = partyData.trade_name || partyData.legal_name || '';
                const addr = partyData.place_of_business_principal?.address || {};
                const address = [addr.door_num, addr.building_name, addr.floor_num, addr.street, addr.location, addr.city, addr.district]
                    .filter(p => p && String(p).trim())
                    .join(', ');
                const pinCode = addr.pin_code ? String(addr.pin_code).trim() : '';
                let stateName = partyData.place_of_business_principal?.address?.state || partyData.state_jurisdiction || '';
                stateName = String(stateName).trim();
                if (stateName.includes(' - ')) stateName = stateName.split(' - ')[0].trim();

                gstLocations[idx].state = stateName;
                gstLocations[idx].address = address;
                gstLocations[idx].pincode = pinCode;
                gstLocations[idx].state_code = gstin.substring(0, 2);
                if (gstin.length >= 12) {
                    gstLocations[idx].pan = gstin.substring(2, 12);
                }

                renderGstLocations();
                btn.innerHTML = '✔';
                setTimeout(() => { btn.innerHTML = originalText; }, 1500);

            } catch (error) {
                console.error('GST Lookup Error:', error);
                showToast('Failed to fetch details. ' + (error.message || 'Server error'), 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        // Attach event listeners for primary checkbox
        container.querySelectorAll('.location-primary-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.locIdx);
                gstLocations.forEach((loc, i) => {
                    loc.is_primary = (i === idx);
                });
                renderGstLocations();
            });
        });

        // Attach event listeners for remove buttons
        container.querySelectorAll('.btn-remove-location').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.locIdx);
                gstLocations.splice(idx, 1);
                renderGstLocations();
            });
        });
    };

    document.getElementById('btn-add-gst-location').addEventListener('click', (e) => {
        e.preventDefault();
        gstLocations.push({
            gstin: '',
            state_code: '',
            state: '',
            address: '',
            city: '',
            pincode: '',
            contact: '',
            is_primary: gstLocations.length === 0,
        });
        renderGstLocations();
    });

    renderGstLocations();

    document.getElementById('create-party-form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data     = Object.fromEntries(formData.entries());

        data.supply     = data.state;
        data.gstin      = data.gstin   || 'UNREGISTERED';
        // BUG FIX: state_code is now type="text" to preserve leading zeros (e.g. "07").
        // Zero-pad as a safety net in case the value arrived as a bare digit (e.g. "7").
        data.state_code = data.state_code
            ? data.state_code.toString().padStart(2, '0')
            : null;
        data.contact    = data.contact || null;
        data.addr       = data.addr    || null;
        data.pin        = data.pin     || null;
        data.pan        = data.pan     || null;

        // Include multi-GSTIN locations if any
        if (gstLocations.length > 0) {
            data.gstLocations = gstLocations.map(loc => ({
                gstin: loc.gstin || '',
                state: loc.state || '',
                address: loc.address || '',
                city: loc.city || '',
                pincode: loc.pincode || '',
                contact: loc.contact || '',
                is_primary: loc.is_primary || false,
            }));
        }

        try {
            const response = await fetchWithCSRF('/api/inventory/purchase/parties', {
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
                showToast(result.error || 'Failed to create party', 'error');
                return;
            }

            closeFunc();
            showToast('Party created successfully!', 'success');
            await onPartySaved(result.data || result);

        } catch (err) {
            console.error('Error creating party:', err);
            showToast('Error creating party: ' + err.message, 'error');
        }
    });
}