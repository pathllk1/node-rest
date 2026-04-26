import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

/* ── Helpers ────────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmtINR = (n) =>
  '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

function showToast(message, type = 'success') {
  const existing = document.getElementById('ad-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'ad-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderAccountDetails(router, params) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const accountHead = decodeURIComponent(params.account_head);

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Ledger</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">${esc(accountHead)}</h1>
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
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Date Range:</span>
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

  const startEl = document.getElementById('start-date');
  const endEl   = document.getElementById('end-date');

  async function loadData() {
    const startDate = startEl.value;
    const endDate   = endEl.value;

    const qs = new URLSearchParams();
    if (startDate) qs.set('start_date', startDate);
    if (endDate)   qs.set('end_date', endDate);
    const url = `/api/ledger/account/${encodeURIComponent(accountHead)}${qs.toString() ? '?' + qs : ''}`;

    try {
      const response = (await api.get(url)) || {};
      
      // FIX: API now returns { opening_balance, records } structure
      const openingBalance = response.opening_balance || 0;
      const records = Array.isArray(response.records) ? response.records : (Array.isArray(response) ? response : []);

      // Calculate running balance starting from opening balance
      let runningBalance = openingBalance;
      const processed = records.map(r => {
        runningBalance += (r.debit_amount || 0) - (r.credit_amount || 0);
        return { ...r, running_balance: runningBalance };
      });

      const totalDebits  = records.reduce((s, r) => s + (r.debit_amount  || 0), 0);
      const totalCredits = records.reduce((s, r) => s + (r.credit_amount || 0), 0);
      const closing      = runningBalance;

      document.getElementById('summary-cards').innerHTML = `
        <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">${startDate ? 'Opening Balance' : 'Total Debits'}</p>
          <p class="mt-2 text-2xl font-black ${startDate ? (openingBalance >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-emerald-600'} tracking-tight">
            ${startDate ? `${fmtINR(Math.abs(openingBalance))} <span class="text-xs font-bold opacity-60 ml-1">${openingBalance >= 0 ? 'DR' : 'CR'}</span>` : fmtINR(totalDebits)}
          </p>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Credits</p>
          <p class="mt-2 text-2xl font-black text-rose-600 tracking-tight">${fmtINR(totalCredits)}</p>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Closing Balance</p>
          <p class="mt-2 text-2xl font-black ${closing >= 0 ? 'text-emerald-600' : 'text-rose-600'} tracking-tight">
            ${fmtINR(Math.abs(closing))} <span class="text-xs font-bold opacity-60 ml-1">${closing >= 0 ? 'DR' : 'CR'}</span>
          </p>
        </div>
      `;

      document.getElementById('table-wrap').innerHTML = processed.length
        ? `<div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-100 bg-slate-50 text-left">
                  <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
                  <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Voucher No</th>
                  <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
                  <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Narration</th>
                  <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Debit</th>
                  <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Credit</th>
                  <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Balance</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                ${processed.map(r => `
                  <tr class="hover:bg-slate-50/50 transition duration-200">
                    <td class="px-5 py-4 text-slate-500 font-medium whitespace-nowrap">${fmtDate(r.transaction_date)}</td>
                    <td class="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">${esc(r.voucher_no)}</td>
                    <td class="px-5 py-4">
                      <span class="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                        ${esc(r.voucher_type)}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-slate-500 max-w-[180px] truncate">${esc(r.narration || '—')}</td>
                    <td class="px-5 py-4 text-right font-black text-emerald-600">${r.debit_amount > 0 ? fmtINR(r.debit_amount) : '—'}</td>
                    <td class="px-5 py-4 text-right font-black text-rose-600">${r.credit_amount > 0 ? fmtINR(r.credit_amount) : '—'}</td>
                    <td class="px-5 py-4 text-right font-black whitespace-nowrap ${r.running_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                      ${fmtINR(Math.abs(r.running_balance))} <span class="text-[10px] opacity-60 ml-0.5">${r.running_balance >= 0 ? 'DR' : 'CR'}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
        : `<div class="px-6 py-12 text-center text-sm font-bold text-gray-500">No transactions found for the selected period.</div>`;

    } catch (err) {
      document.getElementById('table-wrap').innerHTML =
        `<div class="px-6 py-10 text-center text-sm font-bold text-rose-600">Failed to load: ${esc(err.message)}</div>`;
    }
  }

  document.getElementById('apply-filter').addEventListener('click', loadData);

  document.getElementById('clear-filter').addEventListener('click', () => {
    startEl.value = '';
    endEl.value   = '';
    loadData();
    showToast('Filters reset', 'info');
  });

  document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    try {
      showToast('Generating PDF...', 'info');
      const qs = new URLSearchParams();
      if (startEl.value) qs.set('start_date', startEl.value);
      if (endEl.value)   qs.set('end_date',   endEl.value);
      const url = `/api/ledger/export/account-ledger/${encodeURIComponent(accountHead)}${qs.toString() ? '?' + qs : ''}`;
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
      const blob = await res.blob();
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `Ledger_${accountHead.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`,
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
      <div class="grid grid-cols-7 gap-4 px-5 py-4 bg-slate-50">
        ${Array.from({ length: 7 }, () => '<div class="h-2 w-12 animate-pulse rounded-full bg-gray-200"></div>').join('')}
      </div>
      ${Array.from({ length: 5 }, () => `
        <div class="grid grid-cols-7 gap-4 px-5 py-5">
          ${Array.from({ length: 7 }, () => '<div class="h-2 w-20 animate-pulse rounded-full bg-gray-100"></div>').join('')}
        </div>
      `).join('')}
    </div>`;
}
