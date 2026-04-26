import { renderLayout } from '../../components/layout.js';
import { requireAuth }   from '../../middleware/authMiddleware.js';
import { api }           from '../../utils/api.js';

/* ── XSS helper ─────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmtINR = (n) =>
  '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

/* ── Toast notification (no alert()) ──────────────────────────────── */
function showToast(message, type = 'success') {
  const existing = document.getElementById('je-toast');
  if (existing) existing.remove();

  const colors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
  };

  const toast = document.createElement('div');
  toast.id = 'je-toast';
  toast.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3.5 shadow-lg text-sm font-medium ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span>${esc(message)}</span>
    <button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">&times;</button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 4000);
}

/* ── Delete confirmation modal ──────────────────────────────────── */
function showDeleteModal(entryNo, onConfirm) {
  const overlay = document.createElement('div');
  overlay.id = 'je-delete-modal';
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <div>
          <h3 class="text-base font-bold text-gray-900">Delete journal entry?</h3>
          <p class="text-sm text-gray-500 mt-0.5">Entry <span class="font-semibold">${esc(entryNo)}</span> will be permanently removed.</p>
        </div>
      </div>
      <div class="flex gap-3 justify-end pt-2">
        <button id="je-cancel-delete" class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
        <button id="je-confirm-delete" class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('je-cancel-delete').addEventListener('click', () => overlay.remove());
  document.getElementById('je-confirm-delete').addEventListener('click', () => { overlay.remove(); onConfirm(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

/* ── Main render ─────────────────────────────────────────────────── */

export async function renderJournalEntries(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-10 space-y-6">

      <!-- Page header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-1 text-2xl font-black tracking-tight text-gray-900">Journal Entries</h1>
          <p class="mt-1 text-sm text-gray-500">General journal — double-entry ledger records</p>
        </div>
        <div class="flex gap-2">
          <a href="/accounts-dashboard" data-navigo class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
            Dashboard
          </a>
          <button id="create-journal-btn"
                  class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            New Entry
          </button>
        </div>
      </div>

      <!-- Summary cards -->
      <div id="summary-cards" class="grid gap-4 sm:grid-cols-3">
        ${summaryCardsSkeleton()}
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div class="relative flex-1 min-w-[200px]">
          <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
               fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0z"/>
          </svg>
          <input id="je-search" type="text" placeholder="Search voucher, narration, account…"
                 class="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
        </div>
        <input id="je-start-date" type="date"
               class="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
        <input id="je-end-date" type="date"
               class="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
        <button id="je-clear-filters"
                class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
          Clear
        </button>
      </div>

      <!-- Table -->
      <div id="je-table-wrap" class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        ${renderTableSkeleton()}
      </div>

      <!-- Pagination -->
      <div id="je-pagination" class="flex items-center justify-between text-sm text-gray-500 px-1"></div>
    </div>
  `;

  renderLayout(shell, router);

  document.getElementById('create-journal-btn')
    .addEventListener('click', () => router.navigate('/ledger/journal-entries/new'));

  let currentPage = 1;
  const filters = () => ({
    search:     document.getElementById('je-search').value.trim(),
    start_date: document.getElementById('je-start-date').value,
    end_date:   document.getElementById('je-end-date').value,
    page:       currentPage,
    limit:      20,
  });

  loadSummary();
  loadEntries();

  let searchTimer;
  document.getElementById('je-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentPage = 1; loadEntries(); }, 350);
  });

  document.getElementById('je-start-date').addEventListener('change', () => { currentPage = 1; loadEntries(); });
  document.getElementById('je-end-date').addEventListener('change',   () => { currentPage = 1; loadEntries(); });

  document.getElementById('je-clear-filters').addEventListener('click', () => {
    document.getElementById('je-search').value     = '';
    document.getElementById('je-start-date').value = '';
    document.getElementById('je-end-date').value   = '';
    currentPage = 1;
    loadEntries();
    showToast('Filters reset', 'info');
  });

  async function loadSummary() {
    try {
      const s = await api.get('/api/ledger/journal-entries/summary');
      document.getElementById('summary-cards').innerHTML = `
        ${summaryCard('Total Entries', s.total_journal_entries, 'All time', 'blue')}
        ${summaryCard('Last 30 Days', s.recent_journal_entries_count, 'Recent activity', 'emerald')}
        ${summaryCard('Total Volume', fmtINR(s.total_volume), 'Cumulative debit flow', 'violet')}
      `;
    } catch {
      document.getElementById('summary-cards').innerHTML = '';
    }
  }

  async function loadEntries() {
    const wrap = document.getElementById('je-table-wrap');
    wrap.innerHTML = renderTableSkeleton();

    try {
      const f   = filters();
      const qs  = new URLSearchParams(
        Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== undefined))
      ).toString();

      const data = await api.get(`/api/ledger/journal-entries?${qs}`);
      const entries = data.journalEntries || [];
      const total = data.total || 0;
      const totalPages = data.totalPages || 0;

      wrap.innerHTML = renderTable(entries);

      wrap.querySelectorAll('.delete-entry').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const no = btn.dataset.no;
          showDeleteModal(no, async () => {
            try {
              await api.delete(`/api/ledger/journal-entries/${id}`);
              showToast('Journal entry deleted', 'success');
              loadSummary();
              loadEntries();
            } catch (err) {
              showToast('Delete failed: ' + err.message, 'error');
            }
          });
        });
      });

      router.updatePageLinks?.();
      renderPagination(currentPage, totalPages, total);
    } catch (err) {
      wrap.innerHTML = `
        <div class="px-6 py-14 text-center">
          <p class="text-sm font-black text-rose-600">Failed to load entries</p>
          <p class="text-xs text-gray-400 mt-1 font-medium">${esc(err.message)}</p>
          <button id="je-retry" class="mt-4 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition">
            Retry
          </button>
        </div>`;
      document.getElementById('je-retry')?.addEventListener('click', loadEntries);
    }
  }

  function renderPagination(page, totalPages, total) {
    const el = document.getElementById('je-pagination');
    if (!totalPages || totalPages <= 1) { 
      el.innerHTML = `<span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${total} entries found</span>`; 
      return; 
    }

    const btn = (label, p, disabled = false) =>
      `<button class="px-3 py-1.5 rounded-lg border text-xs font-bold transition
        ${disabled ? 'border-gray-50 text-gray-200 cursor-not-allowed bg-gray-50/50' : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}"
        data-page="${p}" ${disabled ? 'disabled' : ''}>${label}</button>`;

    el.innerHTML = `
      <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${total} entries &bull; Page ${page} of ${totalPages}</span>
      <div class="flex gap-1.5">
        ${btn('&laquo;', 1,        page === 1)}
        ${btn('&lsaquo;', page - 1, page === 1)}
        ${btn('&rsaquo;', page + 1, page === totalPages)}
        ${btn('&raquo;', totalPages, page === totalPages)}
      </div>
    `;
    el.querySelectorAll('button[data-page]').forEach(b => {
      b.addEventListener('click', () => { 
        currentPage = parseInt(b.dataset.page); 
        loadEntries(); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }
}

/* ── Render helpers ──────────────────────────────────────────────── */

function summaryCard(label, value, sub, color) {
  const borders = { blue: 'from-blue-500 to-blue-600', emerald: 'from-emerald-500 to-emerald-600', violet: 'from-violet-500 to-violet-600' };
  return `
    <div class="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div class="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${borders[color] || borders.blue}"></div>
      <p class="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">${esc(label)}</p>
      <p class="mt-2 text-2xl font-black tracking-tight text-gray-900">${esc(String(value))}</p>
      <p class="mt-1 text-xs text-gray-500">${esc(sub)}</p>
    </div>`;
}

function summaryCardsSkeleton() {
  return [1,2,3].map(() => `
    <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div class="h-3 w-24 animate-pulse rounded-full bg-gray-200"></div>
      <div class="mt-3 h-7 w-32 animate-pulse rounded-lg bg-gray-200"></div>
      <div class="mt-2 h-2.5 w-20 animate-pulse rounded-full bg-gray-100"></div>
    </div>
  `).join('');
}

function renderTableSkeleton() {
  return `
    <div class="divide-y divide-gray-100">
      <div class="grid grid-cols-6 gap-4 px-6 py-4 bg-gray-50">
        ${[1,2,3,4,5,6].map(() => `<div class="h-3 w-20 animate-pulse rounded-full bg-gray-200"></div>`).join('')}
      </div>
      ${[1,2,3,4,5].map(() => `
        <div class="grid grid-cols-6 gap-4 px-6 py-4">
          <div class="h-3 w-24 animate-pulse rounded-full bg-gray-100"></div>
          <div class="h-3 w-20 animate-pulse rounded-full bg-gray-100"></div>
          <div class="h-3 w-32 animate-pulse rounded-full bg-gray-100"></div>
          <div class="h-3 w-20 animate-pulse rounded-full bg-gray-100 ml-auto"></div>
          <div class="h-3 w-20 animate-pulse rounded-full bg-gray-100 ml-auto"></div>
          <div class="h-3 w-16 animate-pulse rounded-full bg-gray-100 mx-auto"></div>
        </div>
      `).join('')}
    </div>`;
}

function renderTable(entries) {
  if (!entries.length) {
    return `
      <div class="px-6 py-16 text-center space-y-3">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <svg class="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
          </svg>
        </div>
        <p class="text-sm font-semibold text-gray-700">No journal entries found</p>
        <p class="text-xs text-gray-400">Adjust your filters or create a new entry to get started.</p>
      </div>`;
  }

  const rows = entries.map(entry => {
    const id = entry.id ?? entry.voucher_id;
    const balanced = Math.abs((entry.total_debit || 0) - (entry.total_credit || 0)) < 0.01;
    return `
      <tr class="hover:bg-slate-50/50 transition duration-200">
        <td class="px-5 py-4">
          <span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
            ${esc(entry.voucher_no || '—')}
          </span>
        </td>
        <td class="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">${esc(fmtDate(entry.transaction_date))}</td>
        <td class="px-5 py-4 text-sm text-gray-700 max-w-[220px]">
          <span class="block truncate font-medium" title="${esc(entry.narration || '')}">${esc(entry.narration || '—')}</span>
          <span class="text-[10px] font-bold text-gray-400 uppercase">${entry.line_count || 0} lines</span>
        </td>
        <td class="px-5 py-4 text-sm text-right font-black text-emerald-600 whitespace-nowrap">${fmtINR(entry.total_debit)}</td>
        <td class="px-5 py-4 text-sm text-right font-black text-rose-600 whitespace-nowrap">${fmtINR(entry.total_credit)}</td>
        <td class="px-5 py-4 text-center">
          <span class="inline-block w-2 h-2 rounded-full ${balanced ? 'bg-emerald-400' : 'bg-rose-400'}" title="${balanced ? 'Balanced' : 'Imbalanced'}"></span>
        </td>
        <td class="px-5 py-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <a href="/ledger/journal-entries/${id}" data-navigo
               class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition">
              View
            </a>
            <a href="/ledger/journal-entries/${id}/edit" data-navigo
               class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition">
              Edit
            </a>
            <button class="delete-entry inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition"
                    data-id="${id}" data-no="${esc(entry.voucher_no || String(id))}">
              Delete
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 bg-slate-50 text-left">
            <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Voucher No</th>
            <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
            <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Narration</th>
            <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Debits</th>
            <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Credits</th>
            <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Bal</th>
            <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">${rows}</tbody>
      </table>
    </div>`;
}
