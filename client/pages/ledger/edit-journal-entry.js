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
  const existing = document.getElementById('eje-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'eje-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderEditJournalEntry(router, params) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const { id } = params;

  const shell = `
    <div class="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-1 text-2xl font-black tracking-tight text-gray-900">Edit Journal Entry</h1>
          <p class="mt-1 text-sm text-gray-500">Modify double-entry ledger record</p>
        </div>
        <a href="/ledger/journal-entries" data-navigo class="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-slate-50 transition">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>
          Back
        </a>
      </div>

      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="grid grid-cols-1 gap-5 border-b border-gray-100 bg-gray-50/60 px-6 py-5 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Transaction Date *</label>
            <input type="date" id="je-date" required class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Overall Narration</label>
            <input type="text" id="je-narration" placeholder="e.g. Salary payment for March 2025" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
          </div>
        </div>

        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="text-sm font-bold text-gray-900">Journal Lines</h3>
            <p class="text-xs text-gray-400 mt-0.5">Minimum 2 lines required &bull; Each line is either DR or CR</p>
          </div>
          <button type="button" id="add-line-btn" class="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Add Line
          </button>
        </div>

        <div id="je-lines" class="divide-y divide-gray-100 px-6"></div>

        <div id="je-error" class="hidden mx-6 mb-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"></div>

        <div class="mx-6 mb-4 mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Debits</p>
              <p id="tot-dr" class="mt-1 text-xl font-black text-emerald-600">₹\u202f0.00</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Difference</p>
              <p id="tot-diff" class="mt-1 text-xl font-black text-gray-800">₹\u202f0.00</p>
              <p id="tot-status" class="text-[10px] font-bold mt-0.5 text-emerald-500">Balanced ✓</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Credits</p>
              <p id="tot-cr" class="mt-1 text-xl font-black text-red-600">₹\u202f0.00</p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
          <a href="/ledger/journal-entries" data-navigo class="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition">Cancel</a>
          <button type="button" id="je-save-btn" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition" disabled>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  `;

  renderLayout(shell, router);

  const dateEl = document.getElementById('je-date');
  const narrationEl = document.getElementById('je-narration');
  const linesContainer = document.getElementById('je-lines');
  const totDrEl = document.getElementById('tot-dr');
  const totCrEl = document.getElementById('tot-cr');
  const totDiffEl = document.getElementById('tot-diff');
  const totStatusEl = document.getElementById('tot-status');
  const saveBtn = document.getElementById('je-save-btn');

  let entry = null;

  async function loadEntry() {
    try {
      entry = await api.get(`/api/ledger/journal-entries/${id}`);
      dateEl.value = entry.transaction_date || '';
      narrationEl.value = entry.narration || '';
      
      linesContainer.innerHTML = '';
      (entry.lines || []).forEach(line => addLineUI(line));
      updateTotals();
      saveBtn.disabled = false;
    } catch (err) {
      showToast('Failed to load entry: ' + err.message, 'error');
    }
  }

  function addLineUI(data = {}) {
    const lineEl = document.createElement('div');
    lineEl.className = 'py-4 space-y-3 border-b border-gray-100 last:border-b-0';
    lineEl.innerHTML = `
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <label class="text-xs font-bold text-gray-600 mb-1 block">Account Head *</label>
          <input type="text" value="${esc(data.account_head || '')}" placeholder="Account name" class="line-account w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
        </div>
        <div>
          <label class="text-xs font-bold text-gray-600 mb-1 block">Type *</label>
          <select class="line-type w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
            <option value="">Select</option>
            ${ACCOUNT_TYPES.map(t => `<option value="${t}" ${t === data.account_type ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-bold text-gray-600 mb-1 block">Debit</label>
          <input type="number" value="${data.debit_amount || 0}" step="0.01" min="0" class="line-debit w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
        </div>
        <div>
          <label class="text-xs font-bold text-gray-600 mb-1 block">Credit</label>
          <input type="number" value="${data.credit_amount || 0}" step="0.01" min="0" class="line-credit w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
        </div>
        <div class="flex items-end">
          <button type="button" class="remove-line w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition">Remove</button>
        </div>
      </div>
      <div>
        <label class="text-xs font-bold text-gray-600 mb-1 block">Narration</label>
        <input type="text" value="${esc(data.narration || '')}" placeholder="Line description" class="line-narration w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
      </div>
    `;

    lineEl.querySelector('.remove-line').addEventListener('click', () => {
      lineEl.remove();
      updateTotals();
    });

    lineEl.querySelectorAll('.line-debit, .line-credit').forEach(input => {
      input.addEventListener('input', updateTotals);
    });

    linesContainer.appendChild(lineEl);
  }

  function updateTotals() {
    let dr = 0, cr = 0;
    document.querySelectorAll('[class*="line-"]').forEach(el => {
      const parent = el.closest('[class*="py-4"]');
      if (parent) {
        dr += parseFloat(parent.querySelector('.line-debit')?.value) || 0;
        cr += parseFloat(parent.querySelector('.line-credit')?.value) || 0;
      }
    });

    totDrEl.textContent = fmtINR(dr);
    totCrEl.textContent = fmtINR(cr);
    const diff = Math.abs(dr - cr);
    totDiffEl.textContent = fmtINR(diff);
    totStatusEl.textContent = diff < 0.01 ? 'Balanced ✓' : 'Unbalanced ✗';
    totStatusEl.className = diff < 0.01 ? 'text-[10px] font-bold mt-0.5 text-emerald-500' : 'text-[10px] font-bold mt-0.5 text-red-500';
  }

  document.getElementById('add-line-btn').addEventListener('click', () => addLineUI());

  document.getElementById('je-save-btn').addEventListener('click', async () => {
    const date = dateEl.value.trim();
    const narration = narrationEl.value.trim();
    const lines = [];

    if (!date) return showToast('Transaction date is required', 'error');

    document.querySelectorAll('[class*="py-4"]').forEach(lineEl => {
      const account = lineEl.querySelector('.line-account')?.value.trim();
      const type = lineEl.querySelector('.line-type')?.value.trim();
      const dr = parseFloat(lineEl.querySelector('.line-debit')?.value) || 0;
      const cr = parseFloat(lineEl.querySelector('.line-credit')?.value) || 0;
      const lineNarration = lineEl.querySelector('.line-narration')?.value.trim();

      if (account && type) {
        lines.push({ account_head: account, account_type: type, debit_amount: dr, credit_amount: cr, narration: lineNarration });
      }
    });

    if (lines.length < 2) return showToast('Minimum 2 lines required', 'error');

    const totalDr = lines.reduce((s, l) => s + l.debit_amount, 0);
    const totalCr = lines.reduce((s, l) => s + l.credit_amount, 0);

    if (Math.abs(totalDr - totalCr) > 0.01) {
      return showToast(`Entry must be balanced (Dr: ${fmtINR(totalDr)}, Cr: ${fmtINR(totalCr)})`, 'error');
    }

    try {
      await api.put(`/api/ledger/journal-entries/${id}`, { entries: lines, narration, transaction_date: date });
      showToast('Entry updated successfully', 'success');
      setTimeout(() => router.navigate('/ledger/journal-entries'), 1000);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  loadEntry();
}
