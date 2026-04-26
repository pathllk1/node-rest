import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtINR = (n) => '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

const ACCOUNT_TYPES = [
  'INCOME', 'EXPENSE', 'COGS', 'GENERAL',
  'ASSET', 'LIABILITY', 'CASH', 'BANK',
  'DEBTOR', 'CREDITOR', 'CAPITAL', 'RETAINED_EARNINGS',
  'LOAN', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION',
  'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'DISCOUNT_RECEIVED', 'DISCOUNT_GIVEN'
];

function showToast(message, type = 'success') {
  const existing = document.getElementById('ml-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'ml-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderManualLedger(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">Manual Ledger Entries</h1>
          <p class="text-xs text-gray-500 mt-0.5">Create and manage manual accounting entries</p>
        </div>
        <div class="flex gap-2">
          <a href="/accounts-dashboard" data-navigo class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
            Dashboard
          </a>
          <button id="add-ml-btn" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            New Entry
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div class="relative flex-1 min-w-[240px]">
          <span class="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
          <input id="search-input" type="text" placeholder="Search entries..."
                 class="w-full rounded-xl border border-gray-100 bg-gray-50 pl-10 pr-4 py-2 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Period:</span>
          <input id="start-date" type="date" class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition">
          <span class="text-xs text-gray-400 font-bold">to</span>
          <input id="end-date" type="date" class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition">
        </div>
        <button id="apply-filter" class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">Apply</button>
        <button id="clear-filter" class="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Reset</button>
      </div>

      <div id="table-wrap" class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="px-6 py-10 text-center text-sm font-bold text-gray-500">Loading...</div>
      </div>
    </div>
  `;

  renderLayout(shell, router);

  const searchEl = document.getElementById('search-input');
  const startDateEl = document.getElementById('start-date');
  const endDateEl = document.getElementById('end-date');
  let allEntries = [];

  async function loadData() {
    const qs = new URLSearchParams();
    if (startDateEl.value) qs.set('start_date', startDateEl.value);
    if (endDateEl.value) qs.set('end_date', endDateEl.value);
    if (searchEl.value) qs.set('search', searchEl.value);

    try {
      const result = await api.get(`/api/ledger/manual-ledger${qs.toString() ? '?' + qs : ''}`);
      allEntries = result.entries || [];
      renderTable(allEntries);
    } catch (err) {
      document.getElementById('table-wrap').innerHTML = `<div class="px-6 py-10 text-center text-sm font-bold text-red-600">Failed to load: ${esc(err.message)}</div>`;
    }
  }

  function renderTable(entries) {
    if (!entries.length) {
      document.getElementById('table-wrap').innerHTML = `<div class="px-6 py-12 text-center text-sm font-bold text-gray-500">No manual entries found.</div>`;
      return;
    }

    document.getElementById('table-wrap').innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 bg-slate-50 text-left">
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Voucher No</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Lines</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Debit</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Credit</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${entries.map(e => `
              <tr class="hover:bg-slate-50/50 transition duration-200">
                <td class="px-5 py-4 font-bold text-slate-900">${esc(e.voucherNo)}</td>
                <td class="px-5 py-4 text-sm text-gray-600">${esc(e.transactionDate)}</td>
                <td class="px-5 py-4 text-sm text-gray-600">${e.lines.length} line(s)</td>
                <td class="px-5 py-4 text-right font-black text-emerald-600">${fmtINR(e.totalDebit)}</td>
                <td class="px-5 py-4 text-right font-black text-rose-600">${fmtINR(e.totalCredit)}</td>
                <td class="px-5 py-4">
                  <span class="rounded-lg ${e.isLocked ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-green-50 border border-green-100 text-green-700'} px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                    ${e.isLocked ? 'Locked' : 'Editable'}
                  </span>
                </td>
                <td class="px-5 py-4 flex items-center gap-2">
                  <button class="view-ml-btn text-blue-600 hover:text-blue-700 font-bold text-sm" data-id="${e.voucherId}">View</button>
                  ${!e.isLocked ? `<button class="edit-ml-btn text-amber-600 hover:text-amber-700 font-bold text-sm" data-id="${e.voucherId}">Edit</button>` : ''}
                  ${!e.isLocked ? `<button class="delete-ml-btn text-red-600 hover:text-red-700 font-bold text-sm" data-id="${e.voucherId}">Delete</button>` : ''}
                  ${!e.isLocked ? `<button class="lock-ml-btn text-gray-600 hover:text-gray-700 font-bold text-sm" data-id="${e.voucherId}">Lock</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.view-ml-btn').forEach(btn => btn.addEventListener('click', () => openViewModal(btn.dataset.id)));
    document.querySelectorAll('.edit-ml-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-ml-btn').forEach(btn => btn.addEventListener('click', () => openDeleteConfirm(btn.dataset.id)));
    document.querySelectorAll('.lock-ml-btn').forEach(btn => btn.addEventListener('click', () => lockEntry(btn.dataset.id)));
  }

  function openViewModal(voucherId) {
    const entry = allEntries.find(e => e.voucherId === parseInt(voucherId));
    if (!entry) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-black text-gray-900">Manual Ledger Entry - ${esc(entry.voucherNo)}</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><span class="font-bold text-gray-600">Date:</span> ${esc(entry.transactionDate)}</div>
          <div><span class="font-bold text-gray-600">Created By:</span> ${esc(entry.createdBy)}</div>
        </div>
        <div class="border-t pt-4">
          <h3 class="font-bold text-gray-900 mb-3">Entry Lines</h3>
          <div class="space-y-2">
            ${entry.lines.map(l => `
              <div class="border rounded-lg p-3 bg-gray-50">
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div><span class="font-bold">Account:</span> ${esc(l.accountHead)}</div>
                  <div><span class="font-bold">Type:</span> ${esc(l.accountType)}</div>
                  <div><span class="font-bold">Debit:</span> ${fmtINR(l.debitAmount)}</div>
                  <div><span class="font-bold">Credit:</span> ${fmtINR(l.creditAmount)}</div>
                </div>
                ${l.narration ? `<div class="text-xs text-gray-600 mt-2">${esc(l.narration)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="border-t pt-4 flex justify-between font-bold">
          <span>Totals:</span>
          <span>Dr: ${fmtINR(entry.totalDebit)} | Cr: ${fmtINR(entry.totalCredit)}</span>
        </div>
        <button onclick="this.closest('div').parentElement.remove()" class="w-full rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function openEditModal(voucherId) {
    const entry = allEntries.find(e => e.voucherId === parseInt(voucherId));
    if (!entry) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-black text-gray-900">Edit Manual Ledger Entry</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Transaction Date</label>
            <input id="edit-date" type="date" value="${entry.transactionDate}" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Narration</label>
            <input id="edit-narration" type="text" placeholder="Entry description" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
        </div>
        <div id="edit-lines-container" class="space-y-3 border-t pt-4"></div>
        <button id="add-line-btn" class="w-full rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">+ Add Line</button>
        <div class="flex gap-3 pt-4">
          <button id="edit-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="edit-save" class="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const linesContainer = document.getElementById('edit-lines-container');
    let lineCount = 0;

    function renderLines() {
      linesContainer.innerHTML = entry.lines.map((l, idx) => `
        <div class="border rounded-lg p-3 bg-gray-50 space-y-2" data-line-idx="${idx}">
          <div class="grid grid-cols-2 gap-2">
            <input type="text" value="${esc(l.accountHead)}" placeholder="Account Head" class="line-account rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
            <select class="line-type rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
              ${ACCOUNT_TYPES.map(t => `<option value="${t}" ${t === l.accountType ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <input type="number" value="${l.debitAmount}" placeholder="Debit" step="0.01" min="0" class="line-debit rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
            <input type="number" value="${l.creditAmount}" placeholder="Credit" step="0.01" min="0" class="line-credit rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
          </div>
          <input type="text" value="${esc(l.narration)}" placeholder="Narration" class="line-narration w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
          <button class="remove-line-btn text-red-600 hover:text-red-700 font-bold text-sm">Remove</button>
        </div>
      `).join('');

      document.querySelectorAll('.remove-line-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.closest('[data-line-idx]').remove();
        });
      });
    }

    renderLines();

    document.getElementById('add-line-btn').addEventListener('click', () => {
      const newLine = document.createElement('div');
      newLine.className = 'border rounded-lg p-3 bg-gray-50 space-y-2 new-line';
      newLine.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <input type="text" placeholder="Account Head" class="line-account rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
          <select class="line-type rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
            <option value="">Select Type</option>
            ${ACCOUNT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
          <input type="number" placeholder="Debit" step="0.01" min="0" class="line-debit rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
          <input type="number" placeholder="Credit" step="0.01" min="0" class="line-credit rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
        </div>
        <input type="text" placeholder="Narration" class="line-narration w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
        <button class="remove-line-btn text-red-600 hover:text-red-700 font-bold text-sm">Remove</button>
      `;
      linesContainer.appendChild(newLine);
      newLine.querySelector('.remove-line-btn').addEventListener('click', () => newLine.remove());
    });

    document.getElementById('edit-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('edit-save').addEventListener('click', async () => {
      const date = document.getElementById('edit-date').value;
      const narration = document.getElementById('edit-narration').value;
      const lines = [];

      document.querySelectorAll('[data-line-idx], .new-line').forEach(lineEl => {
        const account = lineEl.querySelector('.line-account').value.trim();
        const type = lineEl.querySelector('.line-type').value.trim();
        const debit = parseFloat(lineEl.querySelector('.line-debit').value) || 0;
        const credit = parseFloat(lineEl.querySelector('.line-credit').value) || 0;
        const lineNarration = lineEl.querySelector('.line-narration').value.trim();

        if (account && type) {
          lines.push({ account_head: account, account_type: type, debit_amount: debit, credit_amount: credit, narration: lineNarration });
        }
      });

      if (!lines.length) return showToast('At least one line is required', 'error');
      if (!date) return showToast('Transaction date is required', 'error');

      try {
        await api.put(`/api/ledger/manual-ledger/${voucherId}`, { entries: lines, narration, transaction_date: date });
        modal.remove();
        showToast('Entry updated successfully', 'success');
        loadData();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  function openDeleteConfirm(voucherId) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Delete Entry?</h2>
        <p class="text-sm text-gray-600">Are you sure? This action cannot be undone.</p>
        <div class="flex gap-3 pt-4">
          <button id="delete-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="delete-confirm" class="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('delete-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('delete-confirm').addEventListener('click', async () => {
      try {
        await api.delete(`/api/ledger/manual-ledger/${voucherId}`);
        modal.remove();
        showToast('Entry deleted successfully', 'success');
        loadData();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  async function lockEntry(voucherId) {
    try {
      await api.post(`/api/ledger/manual-ledger/${voucherId}/lock`);
      showToast('Entry locked successfully', 'success');
      loadData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  document.getElementById('add-ml-btn').addEventListener('click', () => {
    // Navigate to create new entry page or open modal
    router.navigate('/ledger/manual-ledger/new');
  });

  document.getElementById('apply-filter').addEventListener('click', loadData);
  document.getElementById('clear-filter').addEventListener('click', () => {
    searchEl.value = '';
    startDateEl.value = '';
    endDateEl.value = '';
    loadData();
  });
  searchEl.addEventListener('input', loadData);

  loadData();
}
