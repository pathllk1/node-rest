import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { openVoucherModal } from '../../components/voucher-modal.js';

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
  const existing = document.getElementById('v-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'v-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderVouchers(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">Vouchers</h1>
          <p class="text-xs text-gray-500 mt-0.5">Payment and receipt vouchers</p>
        </div>
        <div class="flex gap-2">
          <a href="/accounts-dashboard" data-navigo class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
            Dashboard
          </a>
          <a href="/ledger/bank-accounts" data-navigo
             class="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition">
            Bank Accounts
          </a>
          <button id="create-voucher-btn"
                  class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            New
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <!-- Search -->
        <div class="relative min-w-[160px]">
          <svg class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
               fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0z"/>
          </svg>
          <input id="v-search" type="text" placeholder="Search vouchers…"
                 class="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition font-medium">
        </div>

        <!-- Type filter -->
        <select id="v-type"
                class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition font-medium">
          <option value="">All Types</option>
          <option value="RECEIPT">Receipt</option>
          <option value="PAYMENT">Payment</option>
        </select>

        <span class="text-xs text-gray-400 hidden sm:inline">|</span>

        <!-- Date range -->
        <input id="v-start-date" type="date"
               class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition font-medium">
        <span class="text-xs text-gray-400 font-bold">to</span>
        <input id="v-end-date" type="date"
               class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition font-medium">

        <button id="v-apply"
                class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition">
          Apply
        </button>
        <button id="v-clear"
                class="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition">
          Reset
        </button>
      </div>

      <!-- Summary cards -->
      <div id="v-summary" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${skeletonCards(4)}
      </div>

      <!-- Table -->
      <div id="v-table-wrap" class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        ${skeletonTable()}
      </div>

      <!-- Pagination -->
      <div id="v-pagination" class="flex items-center justify-between text-sm text-gray-500 px-1 py-2"></div>

    </div>
    <div id="modal-container"></div>
  `;

  renderLayout(shell, router);

  let currentPage = 1;
  const LIMIT = 15;

  const searchEl    = document.getElementById('v-search');
  const typeEl      = document.getElementById('v-type');
  const startEl     = document.getElementById('v-start-date');
  const endEl       = document.getElementById('v-end-date');

  function buildQs() {
    const qs = new URLSearchParams();
    const s = searchEl.value.trim();
    const t = typeEl.value;
    const sd = startEl.value;
    const ed = endEl.value;
    if (s)  qs.set('search',      s);
    if (t)  qs.set('voucher_type', t);
    if (sd) qs.set('start_date',  sd);
    if (ed) qs.set('end_date',    ed);
    qs.set('page',  String(currentPage));
    qs.set('limit', String(LIMIT));
    return qs;
  }

  async function loadSummary() {
    try {
      const data = await api.get('/api/ledger/vouchers-summary');
      document.getElementById('v-summary').innerHTML = `
        <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Receipts</p>
          <p class="mt-1 text-xl font-black text-emerald-600">${fmtINR(data.total_receipts || 0)}</p>
        </div>
        <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Payments</p>
          <p class="mt-1 text-xl font-black text-rose-600">${fmtINR(data.total_payments || 0)}</p>
        </div>
        <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Position</p>
          <p class="mt-1 text-xl font-black ${(data.net_position || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
            ${fmtINR(Math.abs(data.net_position || 0))}
          </p>
        </div>
        <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Last 30d Txns</p>
          <p class="mt-1 text-xl font-black text-slate-900">${data.recent_transactions_count ?? 0}</p>
        </div>
      `;
    } catch {
      document.getElementById('v-summary').innerHTML = '';
    }
  }

  async function loadVouchers() {
    const wrap = document.getElementById('v-table-wrap');
    wrap.innerHTML = skeletonTable();

    try {
      const data = await api.get('/api/ledger/vouchers?' + buildQs());
      const vouchers   = data.vouchers || [];
      const total      = data.total ?? 0;
      const totalPages = data.totalPages ?? 1;

      if (!vouchers.length) {
        wrap.innerHTML = `
          <div class="px-6 py-14 text-center space-y-2">
            <p class="text-sm font-bold text-gray-600">No vouchers found</p>
            <p class="text-xs text-gray-400 font-medium">Adjust filters or create a new voucher.</p>
          </div>`;
        renderPagination(currentPage, totalPages, total);
        return;
      }

      wrap.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 bg-slate-50 text-left font-black uppercase tracking-widest text-slate-500">
                <th class="px-5 py-4 text-[10px]">Voucher No</th>
                <th class="px-5 py-4 text-[10px]">Type</th>
                <th class="px-5 py-4 text-[10px]">Date</th>
                <th class="px-5 py-4 text-[10px]">Party</th>
                <th class="px-5 py-4 text-[10px] text-right">Amount</th>
                <th class="px-5 py-4 text-[10px]">Mode</th>
                <th class="px-5 py-4 text-[10px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${vouchers.map(v => {
                const isReceipt = v.voucher_type === 'RECEIPT';
                return `
                  <tr class="hover:bg-slate-50/50 transition duration-200">
                    <td class="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">${esc(v.voucher_no)}</td>
                    <td class="px-5 py-4">
                      <span class="rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border
                        ${isReceipt ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}">
                        ${esc(v.voucher_type)}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-slate-500 font-medium whitespace-nowrap">${fmtDate(v.transaction_date)}</td>
                    <td class="px-5 py-4 text-slate-700 font-bold max-w-[140px] truncate">${esc(v.party_name || '—')}</td>
                    <td class="px-5 py-4 text-right font-black text-slate-900 whitespace-nowrap">${fmtINR(v.amount || 0)}</td>
                    <td class="px-5 py-4 text-slate-500 font-medium whitespace-nowrap">${esc(v.payment_mode || '—')}</td>
                    <td class="px-5 py-4 text-center">
                      <div class="flex justify-center gap-2">
                        <button class="view-voucher rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition"
                                data-id="${v.voucher_id}">View</button>
                        <button class="delete-voucher rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition"
                                data-id="${v.voucher_id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // View handlers
      wrap.querySelectorAll('.view-voucher').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const voucher = await api.get(`/api/ledger/vouchers/${btn.dataset.id}`);
            openVoucherModal(voucher, {
              onUpdate: async () => {
                await loadSummary();
                await loadVouchers();
              },
            });
          } catch (err) {
            showToast('Error loading voucher: ' + err.message, 'error');
          }
        });
      });

      // Delete handlers
      wrap.querySelectorAll('.delete-voucher').forEach(btn => {
        btn.addEventListener('click', () => {
          showDeleteConfirm(btn.dataset.id);
        });
      });

      renderPagination(currentPage, totalPages, total);
    } catch (err) {
      wrap.innerHTML = `
        <div class="px-6 py-10 text-center">
          <p class="text-sm font-bold text-rose-600">Failed to load vouchers</p>
          <p class="text-xs text-gray-400 mt-1 font-medium">${esc(err.message)}</p>
          <button id="v-retry" class="mt-4 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition">
            Retry
          </button>
        </div>`;
      document.getElementById('v-retry')?.addEventListener('click', loadVouchers);
    }
  }

  function showDeleteConfirm(id) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in duration-200">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-black text-slate-900">Delete Voucher?</h3>
          <p class="text-sm text-slate-500 font-medium mt-1">This action cannot be undone. The transaction will be reversed in all ledgers.</p>
        </div>
        <div class="flex gap-3 pt-2">
          <button id="cancel-del" class="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition">Cancel</button>
          <button id="confirm-del" class="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 shadow-lg shadow-rose-200 transition">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => { overlay.remove(); document.removeEventListener('keydown', handleEsc); };
    const handleEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handleEsc);

    overlay.querySelector('#cancel-del').onclick = close;
    overlay.querySelector('#confirm-del').onclick = async () => {
      try {
        const res = await fetchWithCSRF(`/api/ledger/vouchers/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to delete');
        showToast('Voucher deleted successfully');
        await loadSummary();
        await loadVouchers();
        close();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
        close();
      }
    };
  }

  function renderPagination(page, totalPages, total) {
    const el = document.getElementById('v-pagination');
    if (!totalPages || totalPages <= 1) {
      el.innerHTML = `<span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${total} voucher${total !== 1 ? 's' : ''} found</span>`;
      return;
    }
    const btn = (label, p, disabled) =>
      `<button class="px-3 py-1.5 rounded-lg border text-xs font-bold transition
        ${disabled ? 'border-gray-50 text-gray-200 cursor-not-allowed bg-gray-50/50' : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}"
        data-page="${p}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    el.innerHTML = `
      <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${total} vouchers &bull; Page ${page} of ${totalPages}</span>
      <div class="flex gap-1.5">
        ${btn('&laquo;', 1,         page === 1)}
        ${btn('&lsaquo;', page - 1, page === 1)}
        ${btn('&rsaquo;', page + 1, page === totalPages)}
        ${btn('&raquo;', totalPages, page === totalPages)}
      </div>`;
    el.querySelectorAll('button[data-page]').forEach(b => {
      b.addEventListener('click', () => { 
        currentPage = parseInt(b.dataset.page); 
        loadVouchers(); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // Wire events
  document.getElementById('create-voucher-btn').addEventListener('click', () => {
    router.navigate('/ledger/vouchers/new');
  });

  document.getElementById('v-apply').addEventListener('click', () => {
    currentPage = 1;
    loadVouchers();
  });

  document.getElementById('v-clear').addEventListener('click', () => {
    searchEl.value = '';
    typeEl.value   = '';
    startEl.value  = '';
    endEl.value    = '';
    currentPage    = 1;
    loadVouchers();
    showToast('Filters reset', 'info');
  });

  // Search on Enter
  searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { currentPage = 1; loadVouchers(); }
  });

  // Initial load
  loadSummary();
  loadVouchers();
}

/* ── skeleton helpers ── */

function skeletonCards(n) {
  return Array.from({ length: n }, () => `
    <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div class="h-2 w-16 animate-pulse rounded-full bg-gray-100"></div>
      <div class="mt-3 h-6 w-28 animate-pulse rounded-lg bg-gray-100"></div>
    </div>
  `);
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
