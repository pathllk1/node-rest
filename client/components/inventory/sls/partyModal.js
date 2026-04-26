/**
 * PARTY MODAL COMPONENT
 * Handles party selection
 */

import { escHtml } from './utils.js';

function openGstinSelector(party, onSelect) {
    const modal = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');

    // Use gstLocations array which should contain all GSTINs
    let allGstins = Array.isArray(party.gstLocations) ? [...party.gstLocations] : [];
    
    // If no gstLocations but party has primary GSTIN, create entry for it
    if (allGstins.length === 0 && party.gstin && party.gstin !== 'UNREGISTERED') {
        allGstins.push({
            gstin: party.gstin,
            state: party.state,
            address: party.addr,
            city: '',
            pincode: party.pin,
            contact: party.contact,
            is_primary: true,
            state_code: party.state_code,
            pan: party.pan
        });
    }

    content.innerHTML = `
        <div class="p-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center gap-3">
            <h3 class="font-bold text-base text-gray-800">Select GST Location (${allGstins.length})</h3>
            <button id="close-gstin-selector"
                    class="shrink-0 text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-xl leading-none">&times;</button>
        </div>

        <div class="flex-1 overflow-y-auto p-3 grid gap-2 bg-gray-50">
            ${allGstins.map((loc, idx) => `
                <div class="gstin-option border border-gray-200 p-3 rounded-xl hover:border-blue-400 hover:shadow-md cursor-pointer
                            flex justify-between items-center transition-all bg-white group"
                     data-gstin="${escHtml(loc.gstin || '')}">
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-blue-900 text-sm group-hover:text-blue-700">${escHtml(loc.gstin)}</div>
                        <div class="text-[10px] text-gray-500 mt-1">${escHtml(loc.state || '')}</div>
                        <div class="text-[10px] text-gray-400 mt-1">${escHtml(loc.address || '')}</div>
                        ${loc.is_primary ? '<span class="text-[9px] font-bold text-green-600 mt-1 inline-block">★ Primary</span>' : ''}
                    </div>
                    <span class="shrink-0 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full
                                 opacity-0 group-hover:opacity-100 transition-all ml-3">SELECT →</span>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('close-gstin-selector').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.querySelectorAll('.gstin-option').forEach(div => {
        div.addEventListener('click', () => {
            const gstin = div.getAttribute('data-gstin');
            modal.classList.add('hidden');
            onSelect(gstin);
        });
    });
}

export function openPartyModal(state, callbacks) {
    const { onSelectParty, onCreateParty, onPartyCardUpdate } = callbacks;
    const modal   = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');

    content.innerHTML = `
        <div class="p-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center gap-3">
            <h3 class="font-bold text-base text-gray-800 shrink-0">Select Party</h3>
            <div class="flex items-center gap-2 flex-1 justify-end">
                <div class="relative flex-1 max-w-sm">
                    <input type="text" id="party-search"
                           placeholder="Search firm name or GSTIN…"
                           class="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-400 outline-none shadow-sm">
                    <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                </div>
                <button id="btn-create-party"
                        class="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    New Party
                </button>
                <button id="close-party-modal"
                        class="shrink-0 text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-xl leading-none">&times;</button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3 grid gap-2 bg-gray-50" id="party-list-container"></div>
    `;

    const renderPartyList = (data) => {
        const container = document.getElementById('party-list-container');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-gray-300">
                    <svg class="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <p class="text-sm text-gray-400 italic">No parties found. Create a new one.</p>
                </div>`;
            return;
        }

        // FIX: escHtml applied to all party data (firm, gstin, state, addr)
        container.innerHTML = data.map(party => {
            // Check if party has multiple GST locations
            const hasMultiGst = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;
            const gstinList = hasMultiGst 
                ? party.gstLocations.map(loc => loc.gstin).join(', ')
                : party.gstin;

            return `
                <div class="party-item border border-gray-200 p-3 rounded-xl hover:border-blue-400 hover:shadow-md cursor-pointer
                            flex justify-between items-center transition-all bg-white group"
                     data-id="${escHtml(String(party._id || party.id || ''))}">
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-blue-900 text-sm group-hover:text-blue-700 truncate">${escHtml(party.firm)}</div>
                        <div class="flex items-center flex-wrap gap-1.5 mt-1">
                            ${hasMultiGst 
                                ? `<span class="text-[10px] font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-blue-600 font-bold">Multi-GST (${party.gstLocations.length})</span>`
                                : `<span class="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">${escHtml(party.gstin)}</span>`
                            }
                            <span class="text-[10px] text-gray-400">${escHtml(party.state || '')}</span>
                        </div>
                        <div class="text-[10px] text-gray-400 mt-1 truncate max-w-xs">${escHtml(party.addr || '')}</div>
                        ${hasMultiGst ? `<div class="text-[9px] text-gray-500 mt-1 font-mono">GSTINs: ${escHtml(gstinList)}</div>` : ''}
                        <div class="mt-2 flex items-center gap-2">
                            <span class="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Balance:</span>
                            <span class="party-balance-loader text-[9px] text-gray-400">Loading...</span>
                        </div>
                    </div>
                    <span class="shrink-0 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full
                                 opacity-0 group-hover:opacity-100 transition-all ml-3">SELECT →</span>
                </div>
            `;
        }).join('');

        // Fetch party balances
        data.forEach(party => {
            const partyId = party._id || party.id;
            const partyDiv = container.querySelector(`[data-id="${partyId}"]`);
            if (partyDiv) {
                fetch(`/api/inventory/sales/party-balance/${partyId}`, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' }
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        const balanceData = data.data;
                        const balanceEl = partyDiv.querySelector('.party-balance-loader');
                        if (balanceEl) {
                            const balanceColor = balanceData.balance_type === 'Debit' ? 'text-red-600' : balanceData.balance_type === 'Credit' ? 'text-green-600' : 'text-gray-600';
                            const balanceSymbol = balanceData.balance_type === 'Debit' ? '↑' : balanceData.balance_type === 'Credit' ? '↓' : '—';
                            balanceEl.innerHTML = `<span class="font-mono font-bold ${balanceColor}">₹${Math.abs(balanceData.balance).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${balanceSymbol} ${balanceData.balance_type}</span>`;
                        }
                    }
                })
                .catch(err => {
                    console.warn('Failed to load party balance:', err);
                    const balanceEl = partyDiv.querySelector('.party-balance-loader');
                    if (balanceEl) balanceEl.textContent = 'N/A';
                });
            }
        });

        container.querySelectorAll('.party-item').forEach(div => {
            div.addEventListener('click', () => {
                const id             = div.getAttribute('data-id');
                const selectedParty  = state.parties.find(p => (p._id || p.id)?.toString() === id);
                if (selectedParty) {
                    // Check if party has multiple GSTINs
                    const hasMultiGst = Array.isArray(selectedParty.gstLocations) && selectedParty.gstLocations.length > 0;
                    
                    if (hasMultiGst) {
                        // Show GSTIN selector for multi-GST party
                        openGstinSelector(selectedParty, (selectedGstin) => {
                            state.selectedParty = selectedParty;
                            state.selectedPartyGstin = selectedGstin;
                            // FIX: Store the complete selected location object for use throughout UI
                            const selectedLoc = selectedParty.gstLocations?.find(l => l.gstin === selectedGstin);
                            state.selectedPartyLocation = selectedLoc || null;
                            state.historyCache = {};
                            modal.classList.add('hidden');
                            onSelectParty(selectedParty);
                        });
                    } else {
                        // Single GSTIN party - select directly
                        state.selectedParty = selectedParty;
                        state.selectedPartyGstin = selectedParty.gstin;
                        // FIX: For single GSTIN, create location object from primary fields
                        state.selectedPartyLocation = {
                            gstin: selectedParty.gstin,
                            state: selectedParty.state,
                            state_code: selectedParty.state_code,
                            address: selectedParty.addr,
                            pincode: selectedParty.pin,
                            contact: selectedParty.contact,
                            is_primary: true
                        };
                        state.historyCache = {};
                        modal.classList.add('hidden');
                        onSelectParty(selectedParty);
                    }
                }
            });
        });
    };

    renderPartyList(state.parties);

    document.getElementById('close-party-modal').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('btn-create-party').addEventListener('click', () => {
        modal.classList.add('hidden');
        onCreateParty();
    });

    const searchInput = document.getElementById('party-search');
    if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', e => {
            const term     = e.target.value.toLowerCase();
            const filtered = state.parties.filter(p =>
                p.firm.toLowerCase().includes(term) || p.gstin.toLowerCase().includes(term)
            );
            renderPartyList(filtered);
        });
    }
}