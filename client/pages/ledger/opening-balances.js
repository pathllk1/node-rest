import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmtINR = (n) =>
  '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

const ACCOUNT_TYPES = [
  'INCOME', 'EXPENSE', 'COGS', 'GENERAL',
  'ASSET', 'LIABILITY', 'CASH', 'BANK',
  'DEBTOR', 'CREDITOR', 'CAPITAL', 'RETAINED_EARNINGS',
  'LOAN', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION',
  'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'DISCOUNT_RECEIVED', 'DISCOUNT_GIVEN'
];

function showToast(message, type = 'success') {
  const existing = document.getElementById('ob-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'ob-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderOpeningBalances(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">Opening Balances</h1>
          <p class="text-xs text-gray-500 mt-0.5">Set up initial account balances for the financial year</p>
        </div>
        <div class="flex gap-2">
          <a href="/accounts-dashboard" data-navigo class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
            Dashboard
          </a>
          <button id="add-ob-btn"
                  class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Add Opening Balance
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div class="relative flex-1 min-w-[240px]">
          <span class="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
          <input id="search-input" type="text" placeholder="Search account heads..."
                 class="w-full rounded-xl border border-gray-100 bg-gray-50 pl-10 pr-4 py-2 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Date:</span>
          <input id="opening-date-filter" type="date"
                 class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition">
        </div>

        <div class="flex items-center gap-2">
          <button id="apply-filter"
                  class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">
            Apply
          </button>
          <button id="clear-filter"
                  class="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">
            Reset
          </button>
        </div>
      </div>

      <!-- Table -->
      <div id="table-wrap" class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="px-6 py-10 text-center text-sm font-bold text-gray-500">Loading...</div>
      </div>

    </div>
  `;

  renderLayout(shell, router);

  const searchEl = document.getElementById('search-input');
  const dateEl = document.getElementById('opening-date-filter');
  let allRecords = [];

  async function loadData() {
    const qs = new URLSearchParams();
    if (dateEl.value) qs.set('opening_date', dateEl.value);
    if (searchEl.value) qs.set('search', searchEl.value);

    try {
      const result = await api.get(`/api/ledger/opening-balances${qs.toString() ? '?' + qs : ''}`);
      allRecords = result.records || [];
      renderTable(allRecords);
    } catch (err) {
      document.getElementById('table-wrap').innerHTML =
        `<div class="px-6 py-10 text-center text-sm font-bold text-red-600">Failed to load: ${esc(err.message)}</div>`;
    }
  }

  function renderTable(records) {
    if (!records.length) {
      document.getElementById('table-wrap').innerHTML =
        `<div class="px-6 py-12 text-center text-sm font-bold text-gray-500">No opening balances found. Create one to get started.</div>`;
      return;
    }

    const totalDebits = records.reduce((s, r) => s + (r.debit_amount || 0), 0);
    const totalCredits = records.reduce((s, r) => s + (r.credit_amount || 0), 0);

    document.getElementById('table-wrap').innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 bg-slate-50 text-left">
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Account Head</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Opening Date</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Debit</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Credit</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${records.map(r => `
              <tr class="hover:bg-slate-50/50 transition duration-200">
                <td class="px-5 py-4 font-bold text-slate-900">${esc(r.account_head)}</td>
                <td class="px-5 py-4">
                  <span class="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                    ${esc(r.account_type)}
                  </span>
                </td>
                <td class="px-5 py-4 text-sm text-gray-600">${esc(r.opening_date)}</td>
                <td class="px-5 py-4 text-right font-black text-emerald-600">${fmtINR(r.debit_amount || 0)}</td>
                <td class="px-5 py-4 text-right font-black text-rose-600">${fmtINR(r.credit_amount || 0)}</td>
                <td class="px-5 py-4">
                  <span class="rounded-lg ${r.is_locked ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-green-50 border border-green-100 text-green-700'} px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                    ${r.is_locked ? 'Locked' : 'Editable'}
                  </span>
                </td>
                <td class="px-5 py-4 flex items-center gap-2">
                  <button class="edit-ob-btn text-blue-600 hover:text-blue-700 font-bold text-sm" data-id="${esc(r._id)}">Edit</button>
                  <button class="delete-ob-btn text-red-600 hover:text-red-700 font-bold text-sm" data-id="${esc(r._id)}">Delete</button>
                </td>
              </tr>
            `).join('')}
            <tr class="border-t-2 border-slate-200 bg-slate-50/50 font-black">
              <td colspan="3" class="px-5 py-5 text-[10px] uppercase tracking-widest text-slate-700">Totals</td>
              <td class="px-5 py-5 text-right text-emerald-600">${fmtINR(totalDebits)}</td>
              <td class="px-5 py-5 text-right text-rose-600">${fmtINR(totalCredits)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Attach event listeners
    document.querySelectorAll('.edit-ob-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    document.querySelectorAll('.delete-ob-btn').forEach(btn => {
      btn.addEventListener('click', () => openDeleteConfirm(btn.dataset.id));
    });
  }

  function openAddModal() {
    const modal = document.createElement('div');
    modal.id = 'add-ob-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Add Opening Balance</h2>
        
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Account Head</label>
          <input id="add-account-head" type="text" placeholder="e.g., Cash, Bank, Capital"
                 class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Account Type</label>
          <select id="add-account-type" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
            <option value="">Select Type</option>
            ${ACCOUNT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Opening Date</label>
          <input id="add-opening-date" type="date"
                 class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Debit</label>
            <input id="add-debit" type="number" placeholder="0.00" step="0.01" min="0"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Credit</label>
            <input id="add-credit" type="number" placeholder="0.00" step="0.01" min="0"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Narration</label>
          <input id="add-narration" type="text" placeholder="Opening Balance"
                 class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>

        <div class="flex gap-3 pt-4">
          <button id="add-ob-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="add-ob-save" class="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('add-ob-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('add-ob-save').addEventListener('click', async () => {
      const accountHead = document.getElementById('add-account-head').value.trim();
      const accountType = document.getElementById('add-account-type').value.trim();
      const openingDate = document.getElementById('add-opening-date').value.trim();
      const debit = parseFloat(document.getElementById('add-debit').value) || 0;
      const credit = parseFloat(document.getElementById('add-credit').value) || 0;
      const narration = document.getElementById('add-narration').value.trim();

      if (!accountHead) return showToast('Account head is required', 'error');
      if (!accountType) return showToast('Account type is required', 'error');
      if (!openingDate) return showToast('Opening date is required', 'error');
      if (debit === 0 && credit === 0) return showToast('Either debit or credit is required', 'error');
      if (debit > 0 && credit > 0) return showToast('Cannot have both debit and credit', 'error');

      try {
        await api.post('/api/ledger/opening-balances', {
          account_head: accountHead,
          account_type: accountType,
          opening_date: openingDate,
          debit_amount: debit,
          credit_amount: credit,
          narration: narration || 'Opening Balance',
        });
        modal.remove();
        showToast('Opening balance created successfully', 'success');
        loadData();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  function openEditModal(id) {
    const record = allRecords.find(r => r._id === id);
    if (!record) return;

    if (record.is_locked) {
      showToast('This opening balance is locked and cannot be edited', 'error');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'edit-ob-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Edit Opening Balance</h2>
        
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Account Head</label>
          <input id="edit-account-head" type="text" value="${esc(record.account_head)}"
                 class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Account Type</label>
          <select id="edit-account-type" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
            ${ACCOUNT_TYPES.map(t => `<option value="${t}" ${t === record.account_type ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Opening Date</label>
          <input id="edit-opening-date" type="date" value="${esc(record.opening_date)}"
                 class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Debit</label>
            <input id="edit-debit" type="number" value="${record.debit_amount || 0}" step="0.01" min="0"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Credit</label>
            <input id="edit-credit" type="number" value="${record.credit_amount || 0}" step="0.01" min="0"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Narration</label>
          <input id="edit-narration" type="text" value="${esc(record.narration)}"
                 class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>

        <div class="flex gap-3 pt-4">
          <button id="edit-ob-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="edit-ob-save" class="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('edit-ob-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('edit-ob-save').addEventListener('click', async () => {
      const accountHead = document.getElementById('edit-account-head').value.trim();
      const accountType = document.getElementById('edit-account-type').value.trim();
      const openingDate = document.getElementById('edit-opening-date').value.trim();
      const debit = parseFloat(document.getElementById('edit-debit').value) || 0;
      const credit = parseFloat(document.getElementById('edit-credit').value) || 0;
      const narration = document.getElementById('edit-narration').value.trim();

      if (!accountHead) return showToast('Account head is required', 'error');
      if (!accountType) return showToast('Account type is required', 'error');
      if (!openingDate) return showToast('Opening date is required', 'error');
      if (debit === 0 && credit === 0) return showToast('Either debit or credit is required', 'error');
      if (debit > 0 && credit > 0) return showToast('Cannot have both debit and credit', 'error');

      try {
        await api.put(`/api/ledger/opening-balances/${id}`, {
          account_head: accountHead,
          account_type: accountType,
          opening_date: openingDate,
          debit_amount: debit,
          credit_amount: credit,
          narration,
        });
        modal.remove();
        showToast('Opening balance updated successfully', 'success');
        loadData();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  function openDeleteConfirm(id) {
    const record = allRecords.find(r => r._id === id);
    if (!record) return;

    if (record.is_locked) {
      showToast('This opening balance is locked and cannot be deleted', 'error');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'delete-ob-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Delete Opening Balance?</h2>
        <p class="text-sm text-gray-600">Are you sure you want to delete the opening balance for <strong>${esc(record.account_head)}</strong>? This action cannot be undone.</p>
        <div class="flex gap-3 pt-4">
          <button id="delete-ob-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="delete-ob-confirm" class="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('delete-ob-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('delete-ob-confirm').addEventListener('click', async () => {
      try {
        await api.delete(`/api/ledger/opening-balances/${id}`);
        modal.remove();
        showToast('Opening balance deleted successfully', 'success');
        loadData();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  document.getElementById('add-ob-btn').addEventListener('click', openAddModal);
  document.getElementById('apply-filter').addEventListener('click', loadData);
  document.getElementById('clear-filter').addEventListener('click', () => {
    searchEl.value = '';
    dateEl.value = '';
    loadData();
  });
  searchEl.addEventListener('input', loadData);

  loadData();
}
