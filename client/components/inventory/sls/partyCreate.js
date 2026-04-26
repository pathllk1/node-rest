/**
 * PARTY CREATE COMPONENT
 * Handles party creation modal
 */

import { fetchPartyByGST } from './partyManager.js';
import { showToast }       from './toast.js';
import { fetchWithCSRF }   from '../../../utils/api.js';
import { escHtml }         from './utils.js';
import { INDIA_STATE_CODES } from './stateManager.js';

/* ── Shared form element class strings ────────────────────────────── */
const LBL    = 'block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1';
const INP    = 'block w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition bg-white';
const INP_MONO = INP + ' font-mono uppercase';
const INP_SM   = 'w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition bg-white';

export function openCreatePartyModal(state, onPartySaved) {
    const subModal   = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');
    subContent.classList.add('flex', 'flex-col', 'max-h-[90vh]');

    subContent.innerHTML = `
        <!-- Header -->
        <header class="bg-slate-900 px-5 py-3 flex justify-between items-center rounded-t-xl flex-shrink-0">
            <div>
                <h3 class="font-bold text-sm text-white">Add New Party</h3>
                <p class="text-[10px] text-slate-400 mt-0.5">Fill in the details for the new party.</p>
            </div>
            <button id="close-sub-modal-party" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none">&times;</button>
        </header>

        <form id="create-party-form" class="flex-1 overflow-y-auto p-4 space-y-3">

            <div>
                <label for="new-party-firm" class="${LBL}">Firm Name *</label>
                <input type="text" name="firm" id="new-party-firm" required
                       class="${INP}" placeholder="e.g. M/S Global Enterprises">
            </div>

            <div>
                <label for="new-party-gstin" class="${LBL}">GSTIN</label>
                <div class="flex gap-1">
                    <input type="text" name="gstin" id="new-party-gstin"
                           class="flex-1 border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition bg-white"
                           placeholder="27ABCDE1234F1Z5" maxlength="15">
                    <button type="button" id="btn-fetch-gst"
                            class="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
                        Fetch
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
                <div>
                    <label for="new-party-contact" class="${LBL}">Contact</label>
                    <input type="text" name="contact" id="new-party-contact" class="${INP}">
                </div>
                <div>
                    <label for="new-party-pan" class="${LBL}">PAN</label>
                    <input type="text" name="pan" id="new-party-pan" class="${INP_MONO}" maxlength="10">
                </div>
            </div>

            <div>
                <label for="new-party-addr" class="${LBL}">Address</label>
                <textarea name="addr" id="new-party-addr" rows="2"
                          class="block w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition resize-none bg-white"></textarea>
            </div>

            <div class="grid grid-cols-3 gap-2.5">
                <div class="col-span-2">
                    <label for="new-party-state" class="${LBL}">State *</label>
                    <input type="text" name="state" id="new-party-state" required class="${INP}">
                </div>
                <div>
                    <label for="new-party-pin" class="${LBL}">Pincode</label>
                    <input type="text" name="pin" id="new-party-pin" class="${INP}">
                </div>
            </div>

            <input type="hidden" name="state_code" id="new-party-state-code">

            <!-- Additional GST Locations -->
            <div class="pt-3 border-t border-slate-100">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Additional GST Locations</h4>
                    <button type="button" id="btn-add-gst-location"
                            class="text-[10px] font-bold text-indigo-600 border border-indigo-200 rounded px-2 py-0.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                        + Add
                    </button>
                </div>
                <div id="gst-locations-container" class="space-y-2"></div>
            </div>

        </form>

        <footer class="bg-slate-50 px-4 py-2.5 flex justify-end gap-2 border-t border-slate-200 rounded-b-xl flex-shrink-0">
            <button type="button" id="cancel-create-party"
                    class="py-1.5 px-3 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 transition">
                Cancel
            </button>
            <button type="submit" form="create-party-form"
                    class="py-1.5 px-4 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 transition">
                Save Party
            </button>
        </footer>
    `;

    const closeFunc = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal-party').addEventListener('click', closeFunc);
    document.getElementById('cancel-create-party').addEventListener('click', closeFunc);

    // Auto-detect State Code + PAN from GSTIN
    document.getElementById('new-party-gstin').addEventListener('input', e => {
        const val = e.target.value.toUpperCase();
        e.target.value = val;
        if (val.length >= 2 && /^\d{2}/.test(val)) {
            document.getElementById('new-party-state-code').value = val.substring(0, 2);
        } else if (val.length < 2) {
            document.getElementById('new-party-state-code').value = '';
        }
        if (val.length >= 12) {
            document.getElementById('new-party-pan').value = val.substring(2, 12);
        }
    });

    // Auto-detect State Code from State name for unregistered parties
    document.getElementById('new-party-state').addEventListener('input', e => {
        const gstinVal = document.getElementById('new-party-gstin').value.trim();
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
            container.innerHTML = '<p class="text-[10px] text-slate-400 italic text-center py-2">No additional GST locations.</p>';
            return;
        }

        container.innerHTML = gstLocations.map((loc, idx) => `
            <div class="border border-slate-200 rounded-lg p-3 bg-slate-50 relative">
                <button type="button" class="btn-remove-location absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors text-sm leading-none" data-loc-idx="${idx}">&times;</button>
                <div class="space-y-2 pr-6">

                    <div class="flex gap-1">
                        <div class="flex-1 min-w-0">
                            <label class="${LBL}">GSTIN</label>
                            <input type="text" value="${escHtml(loc.gstin || '')}" maxlength="15"
                                   class="${INP_SM} font-mono uppercase"
                                   data-loc-idx="${idx}" data-loc-field="gstin">
                        </div>
                        <div class="flex-shrink-0 self-end">
                            <button type="button" class="btn-fetch-location px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-[10px] font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors" data-loc-idx="${idx}">
                                Fetch
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="${LBL}">State</label>
                            <input type="text" value="${escHtml(loc.state || '')}"
                                   class="${INP_SM}" data-loc-idx="${idx}" data-loc-field="state">
                        </div>
                        <div>
                            <label class="${LBL}">Pincode</label>
                            <input type="text" value="${escHtml(loc.pin || '')}"
                                   class="${INP_SM}" data-loc-idx="${idx}" data-loc-field="pin">
                        </div>
                    </div>

                    <div>
                        <label class="${LBL}">Address</label>
                        <input type="text" value="${escHtml(loc.address || '')}"
                               class="${INP_SM}" data-loc-idx="${idx}" data-loc-field="address">
                    </div>

                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" ${loc.is_primary ? 'checked' : ''}
                               class="location-primary-checkbox w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-400 cursor-pointer"
                               data-loc-idx="${idx}">
                        <span class="text-[10px] font-medium text-slate-600">Primary location</span>
                    </label>

                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-loc-field]').forEach(input => {
            input.addEventListener('change', (e) => {
                gstLocations[parseInt(e.target.dataset.locIdx)][e.target.dataset.locField] = e.target.value;
            });
        });

        container.querySelectorAll('.btn-fetch-location').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const idx        = parseInt(e.target.dataset.locIdx);
                const gstinInput = container.querySelector(`input[data-loc-idx="${idx}"][data-loc-field="gstin"]`);
                const gstin      = gstinInput.value.trim().toUpperCase();

                if (!gstin || gstin.length !== 15) {
                    showToast('Please enter a valid 15-character GSTIN', 'error');
                    return;
                }

                const originalText = btn.innerHTML;
                btn.innerHTML = '⏳';
                btn.disabled  = true;

                try {
                    const response = await fetchWithCSRF('/api/inventory/sales/gst-lookup', {
                        method: 'POST',
                        body: JSON.stringify({ gstin }),
                    });
                    if (!response.ok) { const error = await response.json(); showToast(error.error || `Failed (${response.status})`, 'error'); return; }
                    const gstData = await response.json();
                    if (!gstData.success) { showToast(gstData.error || 'Failed to fetch GST details', 'error'); return; }

                    const data = gstData.data || gstData;
                    gstLocations[idx].state = data.place_of_business_principal?.address?.state
                                            || data.state_jurisdiction || '';
                    gstLocations[idx].address = [
                        data.place_of_business_principal?.address?.door_num,
                        data.place_of_business_principal?.address?.building_name,
                        data.place_of_business_principal?.address?.floor_num,
                        data.place_of_business_principal?.address?.street,
                        data.place_of_business_principal?.address?.location,
                        data.place_of_business_principal?.address?.city,
                        data.place_of_business_principal?.address?.district,
                    ].filter(p => p && String(p).trim()).join(', ') || '';
                    const pinCode = data.place_of_business_principal?.address?.pin_code || '';
                    gstLocations[idx].pin = /^\d{6}$/.test(String(pinCode).trim()) ? pinCode : '';

                    renderGstLocations();
                    btn.innerHTML = '✔';
                    setTimeout(() => { btn.innerHTML = originalText; }, 1500);
                    showToast('GST details fetched!', 'success');
                } catch (err) {
                    console.error('Error fetching GST data:', err);
                    showToast('Failed to fetch details. ' + (err.message || 'Server error'), 'error');
                    btn.innerHTML = originalText;
                } finally {
                    btn.disabled = false;
                }
            });
        });

        container.querySelectorAll('.location-primary-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.locIdx);
                gstLocations.forEach((loc, i) => { loc.is_primary = (i === idx) ? e.target.checked : false; });
                renderGstLocations();
            });
        });

        container.querySelectorAll('.btn-remove-location').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                gstLocations.splice(parseInt(e.target.dataset.locIdx), 1);
                renderGstLocations();
            });
        });
    };

    document.getElementById('btn-add-gst-location').addEventListener('click', (e) => {
        e.preventDefault();
        gstLocations.push({ gstin: '', state: '', address: '', is_primary: false });
        renderGstLocations();
    });

    renderGstLocations();

    document.getElementById('create-party-form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data     = Object.fromEntries(formData.entries());

        data.supply       = data.state;
        data.gstin        = data.gstin || 'UNREGISTERED';
        data.state_code   = data.state_code ? data.state_code.toString().padStart(2, '0') : null;
        data.gstLocations = gstLocations;

        try {
            const response = await fetchWithCSRF('/api/inventory/sales/parties', {
                method: 'POST',
                body:   JSON.stringify(data),
            });
            if (!response.ok) throw new Error(await response.text());
            const result = await response.json();
            closeFunc();
            showToast('Party created successfully!', 'success');
            await onPartySaved(result.data || result);
        } catch (err) {
            console.error('Error creating party:', err);
            showToast('Error creating party: ' + err.message, 'error');
        }
    });
}