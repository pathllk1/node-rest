import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fetchWithCSRF } from '../utils/api.js';

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) { console.error('Toast container not found!'); return; }

  const typeClasses = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-slate-700' };
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>',
    error:   '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>',
    info:    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01"/>',
  };

  const toast = document.createElement('div');
  toast.className = `flex items-center gap-2.5 pl-3 pr-2 py-2 text-white text-xs font-medium ${typeClasses[type] || typeClasses.info} rounded-lg shadow-lg opacity-100 transition-opacity duration-300`;
  toast.innerHTML = `
    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icons[type] || icons.info}</svg>
    <span class="flex-1">${escapeHtml(message)}</span>
    <button type="button" class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-70 hover:opacity-100 transition-opacity" aria-label="Close">
      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
    </button>
  `;

  const dismiss = () => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  };
  toast.querySelector('button').addEventListener('click', dismiss);
  toastContainer.appendChild(toast);
  setTimeout(dismiss, 5000);
}


function formatPowerfulGSTINAddress(partyData) {
  if (!partyData?.place_of_business_principal) return '';
  const addr = partyData.place_of_business_principal.address;
  if (!addr) return '';
  return [addr.door_num, addr.building_name, addr.floor_num,
          addr.street, addr.location, addr.city, addr.district]
      .filter(p => p && String(p).trim()).join(', ');
}

function extractPowerfulGSTINPinCode(partyData) {
  if (!partyData?.place_of_business_principal) return '';
  const addr = partyData.place_of_business_principal.address;
  if (!addr?.pin_code) return '';
  const pinStr = addr.pin_code.toString().trim();
  return /^\d{6}$/.test(pinStr) ? pinStr : '';
}

function populatePartyFromGSTData(partyData, gstin) {
  const displayName = partyData.trade_name || partyData.legal_name || '';
  if (!displayName) { showToast('No valid company name found in API response.', 'error'); return; }
  const address   = formatPowerfulGSTINAddress(partyData) || '';
  const pinCode   = extractPowerfulGSTINPinCode(partyData) || '';
  let   stateName = partyData.place_of_business_principal?.address?.state || partyData.state_jurisdiction || '';
  stateName = String(stateName).trim();
  if (stateName.includes(' - ')) stateName = stateName.split(' - ')[0].trim();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('edit-party-firm',  displayName);
  set('edit-party-addr',  address);
  set('edit-party-state', stateName);
  set('edit-party-pin',   pinCode);
  if (gstin?.length >= 2)  set('edit-party-state-code', gstin.substring(0, 2));
  if (gstin?.length >= 12) set('edit-party-pan',         gstin.substring(2, 12));
}

async function fetchPartyByGSTEdit(buttonElement) {
  const gstinInput = document.getElementById('edit-party-gstin');
  const gstin      = gstinInput?.value?.trim();
  if (!gstin || gstin.length !== 15) { showToast('Please enter a valid 15-character GSTIN', 'error'); return; }
  const originalText      = buttonElement.innerHTML;
  buttonElement.innerHTML = '<svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>';
  buttonElement.disabled  = true;
  try {
    const response = await fetchWithCSRF('/api/inventory/sales/gst-lookup', { method: 'POST', body: JSON.stringify({ gstin }) });
    if (!response.ok) { const error = await response.json(); showToast(error.error || `Failed (${response.status})`, 'error'); return; }
    const data = await response.json();
    if (!data.success) { showToast(data.error || 'Failed to fetch GST details', 'error'); return; }
    populatePartyFromGSTData(data.data || data, gstin);
    buttonElement.innerHTML = '✔';
    setTimeout(() => { buttonElement.innerHTML = originalText; }, 1500);
  } catch (error) {
    console.error('GST Lookup Error:', error);
    showToast('Failed to fetch details. ' + (error.message || 'Server error'), 'error');
    buttonElement.innerHTML = originalText;
  } finally {
    buttonElement.disabled = false;
  }
}

/* ── Avatar color cycling ──────────────────────────────────────────── */
const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',     'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',       'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];
function avatarColor(firm) { return AVATAR_COLORS[(firm.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }

/* ── Shared grid layout — header + row must match exactly ──────────── */
const COL_GRID = 'grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_88px]';

/* ── Shared form element class strings ─────────────────────────────── */
const LBL     = 'block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1';
const INP     = 'block w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition bg-white';
const INP_MONO = INP + ' font-mono uppercase';
const INP_SM   = 'w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition bg-white';

export async function renderInventorySuppliers(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div id="toast-container" class="fixed top-4 right-4 z-[60] flex flex-col gap-1.5 w-72"></div>

    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">

      <!-- ── Header with gradient ──────────────────────────────────── -->
      <div class="bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 border-b border-indigo-700/30 shadow-lg">
        <div class="px-4 lg:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl font-black text-white">Parties Hub</h1>
            <p class="text-sm text-indigo-200 mt-1">Manage suppliers, customers, and business partners</p>
          </div>
          <div id="party-stats" class="hidden sm:flex items-center gap-2 flex-wrap"></div>
          <button id="btn-create-new-party"
                  class="flex-shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all hover:scale-105">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Create Party
          </button>
        </div>
      </div>

      <!-- ── Filter & Search Bar ═══════════════════════════════════════ -->
      <div class="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div class="px-4 lg:px-6 py-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div class="relative flex-1">
            <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input type="text" id="party-search-input" 
                   placeholder="🔍 Search by firm name, GSTIN, or PAN…"
                   class="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-500 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300 focus:outline-none transition">
          </div>
          <select id="party-type-filter"
                  class="px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300 focus:outline-none transition">
            <option value="">📊 All Types</option>
            <option value="single">📌 Single GSTIN</option>
            <option value="multi">🏢 Multi-GSTIN</option>
            <option value="unregistered">⚠️ Unregistered</option>
          </select>
        </div>
      </div>

      <!-- ── Card Grid Layout ══════════════════════════════════════════ -->
      <div class="px-4 lg:px-6 py-6">
        <div id="parties-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
          <!-- Loading state -->
          <div class="col-span-full flex items-center justify-center py-16">
            <div class="flex flex-col items-center gap-3">
              <svg class="animate-spin w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              <p class="text-sm text-slate-500 font-medium">Loading parties…</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Edit modal ───────────────────────────────────────────────── -->
    <div id="edit-party-modal-backdrop" class="hidden fixed inset-0 bg-black/60 z-40 transition-opacity"></div>
    <div id="edit-party-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 transition-transform transform scale-95">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div id="edit-party-modal-content"></div>
      </div>
    </div>

    <!-- ── Delete confirm modal ─────────────────────────────────────── -->
    <div id="delete-confirm-modal-backdrop" class="hidden fixed inset-0 bg-black/60 z-40 transition-opacity"></div>
    <div id="delete-confirm-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 transition-transform transform scale-95">
      <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div id="delete-confirm-modal-content"></div>
      </div>
    </div>

    <!-- ── Create party sub-modal ───────────────────────────────────── -->
    <div id="sub-modal-backdrop" class="fixed inset-0 bg-black/60 hidden z-50 flex items-center justify-center backdrop-blur-md transition-opacity">
      <div id="sub-modal-content" class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200"></div>
    </div>
  `;

  renderLayout(content, router);
  await initPartyManagement();
}

async function initPartyManagement() {
  let allParties = [];

  await loadParties();

  document.getElementById('btn-create-new-party')?.addEventListener('click', openCreatePartyModal);
  document.getElementById('party-search-input')?.addEventListener('input', filterAndRenderParties);
  document.getElementById('party-type-filter')?.addEventListener('change', filterAndRenderParties);

  async function loadParties() {
    try {
      const response = await fetchWithCSRF('/api/inventory/sales/parties', { method: 'GET' });
      if (!response.ok) throw new Error('Failed to load parties');
      const data = await response.json();
      allParties = Array.isArray(data) ? data : (data.data || []);
      updateStats();
      filterAndRenderParties();
    } catch (err) {
      console.error('Error loading parties:', err);
      const container = document.getElementById('parties-container');
      if (container) container.innerHTML = `<div class="px-4 py-8 text-center text-xs font-semibold text-rose-600">${escapeHtml(err.message)}</div>`;
    }
  }

  function updateStats() {
    const el = document.getElementById('party-stats');
    if (!el) return;
    const multi  = allParties.filter(p => Array.isArray(p.gstLocations) && p.gstLocations.length > 0).length;
    const unreg  = allParties.filter(p => !p.gstin && !(Array.isArray(p.gstLocations) && p.gstLocations.length > 0)).length;
    const single = allParties.length - multi - unreg;
    el.innerHTML = [
      `<span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-bold text-white"><span class="w-2 h-2 rounded-full bg-white/60"></span>${allParties.length} Total</span>`,
      single > 0 ? `<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-200"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>${single} GST</span>` : '',
      multi  > 0 ? `<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 text-xs font-bold text-blue-200"><span class="w-2 h-2 rounded-full bg-blue-400"></span>${multi} Multi</span>` : '',
      unreg  > 0 ? `<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-200"><span class="w-2 h-2 rounded-full bg-amber-400"></span>${unreg} Unreg</span>` : '',
    ].filter(Boolean).join('');
    el.classList.remove('hidden');
  }

  function filterAndRenderParties() {
    const searchTerm = document.getElementById('party-search-input')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('party-type-filter')?.value || '';

    const filtered = allParties.filter(party => {
      const matchesSearch = !searchTerm ||
        party.firm.toLowerCase().includes(searchTerm) ||
        (party.gstin && party.gstin.toLowerCase().includes(searchTerm)) ||
        (party.pan && party.pan.toLowerCase().includes(searchTerm));
      const isMultiGst    = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;
      const isUnregistered = !party.gstin && !isMultiGst;
      const matchesType = !typeFilter ||
        (typeFilter === 'multi'        && isMultiGst) ||
        (typeFilter === 'single'       && !isMultiGst && !isUnregistered) ||
        (typeFilter === 'unregistered' && isUnregistered);
      return matchesSearch && matchesType;
    });

    renderPartyList(filtered);
  }

  function renderPartyList(parties) {
    const container = document.getElementById('parties-container');
    if (!container) return;

    if (parties.length === 0) {
      container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-20">
          <svg class="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
          </svg>
          <p class="text-lg font-bold text-slate-700">No parties found</p>
          <p class="text-sm text-slate-500 mt-1">Try adjusting your search filters or create a new party.</p>
        </div>`;
      return;
    }

    container.innerHTML = parties.map(party => {
      const isMultiGst    = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;
      const isUnregistered = !party.gstin && !isMultiGst;
      const initial        = (party.firm[0] || '?').toUpperCase();
      const color          = avatarColor(party.firm);

      // Status badge
      let statusBadge;
      let statusColor;
      if (isMultiGst) {
        statusBadge = `Multi-GST (${party.gstLocations.length})`;
        statusColor = 'from-blue-100 to-blue-50 border-blue-200 text-blue-700';
      } else if (isUnregistered) {
        statusBadge = 'Unregistered';
        statusColor = 'from-amber-100 to-amber-50 border-amber-200 text-amber-700';
      } else {
        statusBadge = 'Registered';
        statusColor = 'from-emerald-100 to-emerald-50 border-emerald-200 text-emerald-700';
      }

      return `
        <div class="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 shadow-md hover:shadow-xl transition-all hover:scale-105 overflow-hidden flex flex-col group">
          <!-- Card Header with gradient -->
          <div class="bg-gradient-to-r ${color === AVATAR_COLORS[0] ? 'from-indigo-500 to-indigo-600' : color === AVATAR_COLORS[1] ? 'from-emerald-500 to-emerald-600' : color === AVATAR_COLORS[2] ? 'from-rose-500 to-rose-600' : color === AVATAR_COLORS[3] ? 'from-amber-500 to-amber-600' : color === AVATAR_COLORS[4] ? 'from-sky-500 to-sky-600' : color === AVATAR_COLORS[5] ? 'from-violet-500 to-violet-600' : 'from-teal-500 to-teal-600'} p-4 text-white">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 font-bold text-lg">${initial}</div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-sm truncate" title="${escapeHtml(party.firm)}">${escapeHtml(party.firm)}</h3>
                <p class="text-xs text-white/70 truncate mt-0.5" title="${escapeHtml(party.addr || '')}">${escapeHtml(party.addr || 'No address')}</p>
              </div>
            </div>
          </div>

          <!-- Card Body -->
          <div class="p-4 flex-1 space-y-3">
            <!-- GSTIN Info -->
            <div class="space-y-1.5">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">GSTIN / Status</p>
              <div class="bg-gradient-to-r ${statusColor} border rounded-lg px-3 py-2">
                <p class="text-xs font-bold">${statusBadge}</p>
                ${!isUnregistered ? `<p class="text-[11px] font-mono mt-1 opacity-80">${escapeHtml(isMultiGst ? party.gstLocations.map(l => l.gstin).join(', ') : party.gstin)}</p>` : ''}
              </div>
            </div>

            <!-- Details Grid -->
            <div class="grid grid-cols-2 gap-2.5">
              <div class="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">State</p>
                <p class="text-sm font-bold text-slate-700">${escapeHtml(party.state || '—')}</p>
              </div>
              <div class="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">PAN</p>
                <p class="text-sm font-mono text-slate-600">${party.pan ? escapeHtml(party.pan) : '—'}</p>
              </div>
            </div>

            <!-- Contact Info -->
            ${party.contact ? `
              <div class="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-blue-600 mb-1">Contact</p>
                <p class="text-sm text-blue-700">${escapeHtml(party.contact)}</p>
              </div>
            ` : ''}
          </div>

          <!-- Card Footer with Actions -->
          <div class="bg-slate-50 border-t border-slate-100 px-4 py-3 flex gap-2">
            <button class="btn-edit-party flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm" data-party-id="${party._id}">
              <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit
            </button>
            <button class="btn-delete-party px-3 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition-colors" data-party-id="${party._id}">
              <svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-edit-party').forEach(btn => {
      btn.addEventListener('click', () => {
        const party = allParties.find(p => p._id === btn.dataset.partyId);
        if (party) openEditPartyModal(party, loadParties);
      });
    });

    container.querySelectorAll('.btn-delete-party').forEach(btn => {
      btn.addEventListener('click', () => {
        const party = allParties.find(p => p._id === btn.dataset.partyId);
        if (party) openDeleteConfirmModal(party, loadParties);
      });
    });
  }
}

import { openCreatePartyModal as openCreateModal } from '../components/inventory/sls/partyCreate.js';
function openCreatePartyModal() { openCreateModal({}, async () => { location.reload(); }); }

async function openEditPartyModal(party, onSave) {
  const modal    = document.getElementById('edit-party-modal');
  const backdrop = document.getElementById('edit-party-modal-backdrop');
  const content  = document.getElementById('edit-party-modal-content');
  if (!modal || !backdrop || !content) return;

  const isMultiGst = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;
  content.classList.add('flex', 'flex-col', 'max-h-[90vh]');

  content.innerHTML = `
    <header class="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 px-6 py-4 flex justify-between items-center rounded-t-2xl flex-shrink-0 shadow-lg">
      <div>
        <h3 class="text-lg font-bold text-white">Edit Party Details</h3>
        <p class="text-sm text-indigo-100 mt-0.5">${escapeHtml(party.firm)}</p>
      </div>
      <button id="close-edit-modal" class="w-8 h-8 flex items-center justify-center rounded-lg text-indigo-100 hover:text-white hover:bg-white/20 transition-colors text-xl leading-none">&times;</button>
    </header>

    <form id="edit-party-form" class="flex-1 overflow-y-auto p-5 space-y-4">

      <div>
        <label for="edit-party-firm" class="${LBL}">Firm Name *</label>
        <input type="text" name="firm" id="edit-party-firm" value="${escapeHtml(party.firm)}" required class="${INP}">
      </div>

      <div>
        <label for="edit-party-gstin" class="${LBL}">Primary GSTIN</label>
        <div class="flex gap-1">
          <input type="text" name="gstin" id="edit-party-gstin" value="${escapeHtml(party.gstin || '')}" maxlength="15"
                 class="flex-1 border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition bg-white"
                 placeholder="27ABCDE1234F1Z5">
          <button type="button" id="btn-fetch-gst-edit"
                  class="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
            Fetch
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label for="edit-party-contact" class="${LBL}">Contact</label>
          <input type="text" name="contact" id="edit-party-contact" value="${escapeHtml(party.contact || '')}" class="${INP}">
        </div>
        <div>
          <label for="edit-party-pan" class="${LBL}">PAN</label>
          <input type="text" name="pan" id="edit-party-pan" value="${escapeHtml(party.pan || '')}" maxlength="10" class="${INP_MONO}">
        </div>
      </div>

      <div>
        <label for="edit-party-addr" class="${LBL}">Address</label>
        <textarea name="addr" id="edit-party-addr" rows="2"
                  class="block w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition resize-none bg-white">${escapeHtml(party.addr || '')}</textarea>
      </div>

      <div class="grid grid-cols-3 gap-2.5">
        <div class="col-span-2">
          <label for="edit-party-state" class="${LBL}">State *</label>
          <input type="text" name="state" id="edit-party-state" value="${escapeHtml(party.state || '')}" required class="${INP}">
        </div>
        <div>
          <label for="edit-party-pin" class="${LBL}">Pincode</label>
          <input type="text" name="pin" id="edit-party-pin" value="${escapeHtml(party.pin || '')}" class="${INP}">
        </div>
      </div>

      <input type="hidden" name="state_code" id="edit-party-state-code" value="${escapeHtml(party.state_code || '')}">

      <div class="pt-4 mt-4 border-t border-slate-200">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-bold text-slate-900 uppercase tracking-wider">Additional GST Locations</h4>
          <button type="button" id="btn-add-gst-location"
                  class="text-xs font-bold text-emerald-600 border border-emerald-300 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
            + Add Location
          </button>
        </div>
        <div id="gst-locations-container" class="space-y-3"></div>
      </div>

    </form>

    <footer class="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200 rounded-b-2xl flex-shrink-0">
      <button type="button" id="cancel-edit-party"
              class="py-2.5 px-4 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all">
        Cancel
      </button>
      <button type="submit" form="edit-party-form"
              class="py-2.5 px-5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all shadow-lg hover:shadow-xl">
        Save Changes
      </button>
    </footer>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('scale-100');
  backdrop.classList.remove('hidden');
  backdrop.classList.add('opacity-100');

  const closeModal = () => {
    modal.classList.remove('scale-100');
    backdrop.classList.remove('opacity-100');
    setTimeout(() => { modal.classList.add('hidden'); backdrop.classList.add('hidden'); }, 150);
  };
  document.getElementById('close-edit-modal')?.addEventListener('click', closeModal);
  document.getElementById('cancel-edit-party')?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.getElementById('btn-fetch-gst-edit')?.addEventListener('click', (e) => {
    e.preventDefault();
    fetchPartyByGSTEdit(e.currentTarget);
  });

  const gstinInput    = document.getElementById('edit-party-gstin');
  const stateCodeInput = document.getElementById('edit-party-state-code');
  gstinInput?.addEventListener('input', (e) => {
    const val = e.target.value.toUpperCase();
    e.target.value = val;
    if (val.length >= 2 && /^\d{2}/.test(val)) stateCodeInput.value = val.substring(0, 2);
    else if (val.length < 2) stateCodeInput.value = '';
  });

  let gstLocations = isMultiGst
    ? JSON.parse(JSON.stringify(party.gstLocations)).map(loc => ({ ...loc, pin: loc.pin || loc.pincode || '' }))
    : [];

  const renderGstLocations = () => {
    const container = document.getElementById('gst-locations-container');
    if (!container) return;
    if (gstLocations.length === 0) {
      container.innerHTML = '<p class="text-[10px] text-slate-400 italic text-center py-2">No additional GST locations.</p>';
      return;
    }
    container.innerHTML = gstLocations.map((loc, idx) => `
      <div class="border-2 border-indigo-200 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-blue-50 relative hover:border-indigo-400 hover:shadow-md transition-all group">
        <button type="button" class="btn-remove-location absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-slate-400 group-hover:text-rose-600 group-hover:bg-rose-50 rounded-lg transition-colors text-lg leading-none" data-loc-idx="${idx}">&times;</button>
        
        <div class="space-y-3 pr-8">
          <!-- GSTIN Input with Fetch Button -->
          <div>
            <label class="${LBL}">GSTIN</label>
            <div class="flex gap-1.5">
              <input type="text" value="${escapeHtml(loc.gstin || '')}" maxlength="15"
                     class="${INP} flex-1 font-mono uppercase"
                     data-loc-idx="${idx}" data-loc-field="gstin">
              <button type="button" class="btn-fetch-location flex-shrink-0 px-3 py-1.5 border-2 border-indigo-300 rounded-lg bg-white text-xs font-bold text-indigo-600 hover:bg-indigo-100 hover:border-indigo-400 transition-all shadow-sm" data-loc-idx="${idx}">
                Fetch
              </button>
            </div>
          </div>

          <!-- State & Pincode Grid -->
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="${LBL}">State</label>
              <input type="text" value="${escapeHtml(loc.state || '')}" class="${INP}" data-loc-idx="${idx}" data-loc-field="state">
            </div>
            <div>
              <label class="${LBL}">Pincode</label>
              <input type="text" value="${escapeHtml(loc.pin || '')}" class="${INP}" data-loc-idx="${idx}" data-loc-field="pin">
            </div>
          </div>

          <!-- Address -->
          <div>
            <label class="${LBL}">Address</label>
            <input type="text" value="${escapeHtml(loc.address || '')}" class="${INP}" data-loc-idx="${idx}" data-loc-field="address">
          </div>

          <!-- Primary Checkbox -->
          <label class="flex items-center gap-2.5 cursor-pointer p-2.5 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors">
            <input type="checkbox" ${loc.is_primary ? 'checked' : ''}
                   class="location-primary-checkbox w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-400 cursor-pointer"
                   data-loc-idx="${idx}">
            <span class="text-xs font-semibold text-slate-700">Set as Primary Location</span>
            ${loc.is_primary ? '<span class="ml-auto text-xs font-bold text-emerald-600">✓ Primary</span>' : ''}
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
        if (!gstin || gstin.length !== 15) { showToast('Please enter a valid 15-character GSTIN', 'error'); return; }
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        btn.disabled  = true;
        try {
          const response = await fetchWithCSRF('/api/inventory/sales/gst-lookup', { method: 'POST', body: JSON.stringify({ gstin }) });
          if (!response.ok) { const error = await response.json(); showToast(error.error || `Failed (${response.status})`, 'error'); return; }
          const gstData = await response.json();
          if (!gstData.success) { showToast(gstData.error || 'Failed to fetch GST details', 'error'); return; }
          const data = gstData.data || gstData;
          gstLocations[idx].state = data.place_of_business_principal?.address?.state || data.state_jurisdiction || '';
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
        } finally { btn.disabled = false; }
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

  document.getElementById('btn-add-gst-location')?.addEventListener('click', (e) => {
    e.preventDefault();
    gstLocations.push({ gstin: '', state: '', address: '', is_primary: false });
    renderGstLocations();
  });

  renderGstLocations();

  document.getElementById('edit-party-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.supply = data.state;
    data.gstLocations = gstLocations;
    try {
      const response = await fetchWithCSRF(`/api/inventory/sales/parties/${party._id}`, { method: 'PUT', body: JSON.stringify(data) });
      if (!response.ok) throw new Error(await response.text());
      showToast('Party updated successfully!', 'success');
      closeModal();
      await onSave();
    } catch (err) {
      console.error('Update Error:', err);
      showToast('Failed to update party. ' + err.message, 'error');
    }
  });
}

async function openDeleteConfirmModal(party, onDelete) {
  const modal    = document.getElementById('delete-confirm-modal');
  const backdrop = document.getElementById('delete-confirm-modal-backdrop');
  const content  = document.getElementById('delete-confirm-modal-content');
  if (!modal || !backdrop || !content) return;

  content.innerHTML = `
    <div class="p-6 text-center">
      <div class="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center mb-4 shadow-lg">
        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h3 class="text-xl font-bold text-slate-900">Confirm Deletion</h3>
      <p class="mt-2 text-base text-slate-600">
        Are you sure you want to delete <strong class="font-bold text-slate-900">${escapeHtml(party.firm)}</strong>?
      </p>
      <p class="mt-2 text-sm text-rose-600 font-semibold">This action cannot be undone.</p>
    </div>
    <div class="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
      <button id="cancel-delete" type="button"
              class="py-2.5 px-4 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all">
        Keep Party
      </button>
      <button id="confirm-delete" type="button"
              class="py-2.5 px-5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-lg hover:shadow-xl transition-all">
        Delete Party
      </button>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('scale-100');
  backdrop.classList.remove('hidden');
  backdrop.classList.add('opacity-100');

  const closeModal = () => {
    modal.classList.remove('scale-100');
    backdrop.classList.remove('opacity-100');
    setTimeout(() => { modal.classList.add('hidden'); backdrop.classList.add('hidden'); }, 150);
  };
  document.getElementById('cancel-delete')?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.getElementById('confirm-delete')?.addEventListener('click', async () => {
    try {
      const response = await fetchWithCSRF(`/api/inventory/sales/parties/${party._id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      showToast('Party deleted successfully.', 'success');
      closeModal();
      await onDelete();
    } catch (err) {
      showToast('Error deleting party: ' + err.message, 'error');
    }
  });
}