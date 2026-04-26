import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

/* ── Helpers ────────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmtINR = (n) =>
  '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

function showToast(message, type = 'success') {
  const existing = document.getElementById('tb-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'tb-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderTrialBalance(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">Trial Balance</h1>
          <p class="text-xs text-gray-500 mt-0.5">Verify that total debits equal total credits</p>
        </div>
        <div class="flex gap-2">
          <a href="/accounts-dashboard" data-navigo class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
            Dashboard
          </a>
          <button id="export-pdf-btn"
                  class="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 shadow-lg shadow-purple-200 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export PDF
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
          <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Period:</span>
          <input id="start-date" type="date"
                 class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition">
          <span class="text-xs text-gray-400 font-bold">to</span>
          <input id="end-date" type="date"
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
        <span id="filter-label" class="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full hidden">Filtered</span>
      </div>

      <!-- Summary cards -->
      <div id="summary-cards" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${skeletonCards(3)}
      </div>

      <!-- Table -->
      <div id="table-wrap" class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        ${skeletonTable()}
      </div>

    </div>
  `;

  renderLayout(shell, router);

  const startEl  = document.getElementById('start-date');
  const endEl    = document.getElementById('end-date');
  const searchEl = document.getElementById('search-input');
  let allAccounts = [];

  async function loadData() {
    const startDate = startEl.value;
    const endDate   = endEl.value;
    const filtered  = startDate || endDate;

    document.getElementById('filter-label').classList.toggle('hidden', !filtered);

    const qs = new URLSearchParams();
    if (startDate) qs.set('start_date', startDate);
    if (endDate)   qs.set('end_date', endDate);
    const url = `/api/ledger/accounts${qs.toString() ? '?' + qs : ''}`;

    try {
      allAccounts = (await api.get(url)) || [];
      renderTable(allAccounts);
    } catch (err) {
      document.getElementById('table-wrap').innerHTML =
        `<div class="px-6 py-10 text-center text-sm font-bold text-red-600">Failed to load: ${esc(err.message)}</div>`;
    }
  }

  function renderTable(accounts) {
    const searchTerm = searchEl.value.toLowerCase();
    const filteredAccounts = accounts.filter(a => 
      a.account_head.toLowerCase().includes(searchTerm) || 
      a.account_type.toLowerCase().includes(searchTerm)
    );

    const totalDebits  = filteredAccounts.reduce((s, a) => s + (a.total_debit  || 0), 0);
    const totalCredits = filteredAccounts.reduce((s, a) => s + (a.total_credit || 0), 0);
    const diff         = Math.abs(totalDebits - totalCredits);
    const balanced     = diff < 0.01;

    document.getElementById('summary-cards').innerHTML = `
      <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Debits</p>
        <p class="mt-2 text-2xl font-black text-emerald-600 tracking-tight">${fmtINR(totalDebits)}</p>
      </div>
      <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Credits</p>
        <p class="mt-2 text-2xl font-black text-rose-600 tracking-tight">${fmtINR(totalCredits)}</p>
      </div>
      <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
        <div class="flex items-center gap-2 mt-2">
           <p class="text-2xl font-black ${balanced ? 'text-emerald-600' : 'text-rose-600'} tracking-tight">
            ${balanced ? 'Balanced' : 'Unbalanced'}
          </p>
          ${balanced ? '<svg class="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>' : ''}
        </div>
        ${!balanced ? `<p class="text-xs font-bold text-rose-500 mt-1">Diff: ${fmtINR(diff)}</p>` : ''}
      </div>
    `;

    if (!filteredAccounts.length) {
      document.getElementById('table-wrap').innerHTML =
        `<div class="px-6 py-12 text-center text-sm font-bold text-gray-500">No matching accounts found.</div>`;
      return;
    }

    document.getElementById('table-wrap').innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 bg-slate-50 text-left">
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Account Head</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Debits</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Credits</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${filteredAccounts.map(a => `
              <tr class="hover:bg-slate-50/50 transition duration-200">
                <td class="px-5 py-4 font-bold text-slate-900">${esc(a.account_head)}</td>
                <td class="px-5 py-4">
                  <span class="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                    ${esc(a.account_type)}
                  </span>
                </td>
                <td class="px-5 py-4 text-right font-black text-emerald-600">${fmtINR(a.total_debit || 0)}</td>
                <td class="px-5 py-4 text-right font-black text-rose-600">${fmtINR(a.total_credit || 0)}</td>
              </tr>
            `).join('')}
            <tr class="border-t-2 border-slate-200 bg-slate-50/50 font-black">
              <td colspan="2" class="px-5 py-5 text-[10px] uppercase tracking-widest text-slate-700">Totals</td>
              <td class="px-5 py-5 text-right text-emerald-600">${fmtINR(totalDebits)}</td>
              <td class="px-5 py-5 text-right text-rose-600">${fmtINR(totalCredits)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('apply-filter').addEventListener('click', loadData);
  searchEl.addEventListener('input', () => renderTable(allAccounts));

  document.getElementById('clear-filter').addEventListener('click', () => {
    startEl.value = '';
    endEl.value   = '';
    searchEl.value = '';
    loadData();
    showToast('Filters reset', 'info');
  });

  document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    try {
      const qs = new URLSearchParams();
      if (startEl.value) qs.set('start_date', startEl.value);
      if (endEl.value)   qs.set('end_date',   endEl.value);
      const url = `/api/ledger/export/trial-balance${qs.toString() ? '?' + qs : ''}`;
      
      showToast('Generating PDF...', 'info');
      
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
      const blob = await res.blob();
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `Trial_Balance_${new Date().toISOString().slice(0,10)}.pdf`,
      });
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      
      showToast('PDF exported successfully!', 'success');
    } catch (err) {
      showToast('Error exporting PDF: ' + err.message, 'error');
    }
  });

  loadData();
}

/* ── UI Helpers ── */

function skeletonCards(n) {
  return Array.from({ length: n }, () => `
    <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div class="h-2.5 w-20 animate-pulse rounded-full bg-gray-100"></div>
      <div class="mt-4 h-8 w-32 animate-pulse rounded-xl bg-gray-100"></div>
    </div>
  `).join('');
}

function skeletonTable() {
  return `
    <div class="divide-y divide-gray-50">
      <div class="grid grid-cols-4 gap-4 px-5 py-4 bg-slate-50">
        ${Array.from({ length: 4 }, () => '<div class="h-2 w-12 animate-pulse rounded-full bg-gray-200"></div>').join('')}
      </div>
      ${Array.from({ length: 5 }, () => `
        <div class="grid grid-cols-4 gap-4 px-5 py-5">
          ${Array.from({ length: 4 }, () => '<div class="h-2 w-20 animate-pulse rounded-full bg-gray-100"></div>').join('')}
        </div>
      `).join('')}
    </div>`;
}
