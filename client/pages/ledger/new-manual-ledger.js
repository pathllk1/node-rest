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
  const existing = document.getElementById('nml-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'nml-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderNewManualLedger(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div class="flex items-center gap-3">
        <button id="back-btn" class="text-blue-600 hover:text-blue-700 font-bold">← Back</button>
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">New Manual Ledger Entry</h1>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Transaction Date *</label>
            <input id="trans-date" type="date" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Narration</label>
            <input id="narration" type="text" placeholder="Entry description" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
        </div>

        <div class="border-t pt-6">
          <h2 class="font-bold text-gray-900 mb-4">Entry Lines</h2>
          <div id="lines-container" class="space-y-3"></div>
          <button id="add-line-btn" class="w-full rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition mt-4">+ Add Line</button>
        </div>

        <div class="border-t pt-6">
          <div class="grid grid-cols-2 gap-4 text-sm font-bold">
            <div>Total Debits: <span id="total-dr" class="text-emerald-600">${fmtINR(0)}</span></div>
            <div>Total Credits: <span id="total-cr" class="text-rose-600">${fmtINR(0)}</span></div>
          </div>
          <div id="balance-status" class="mt-2 text-sm font-bold text-gray-600"></div>
        </div>

        <div class="flex gap-3 pt-4">
          <button id="cancel-btn" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="save-btn" class="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">Save Entry</button>
        </div>
      </div>
    </div>
  `;

  renderLayout(shell, router);

  const linesContainer = document.getElementById('lines-container');
  const transDateEl = document.getElementById('trans-date');
  const narrationEl = document.getElementById('narration');
  const totalDrEl = document.getElementById('total-dr');
  const totalCrEl = document.getElementById('total-cr');
  const balanceStatusEl = document.getElementById('balance-status');

  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  transDateEl.value = today;

  function updateTotals() {
    let totalDr = 0, totalCr = 0;
    document.querySelectorAll('[data-line]').forEach(lineEl => {
      const dr = parseFloat(lineEl.querySelector('.line-debit').value) || 0;
      const cr = parseFloat(lineEl.querySelector('.line-credit').value) || 0;
      totalDr += dr;
      totalCr += cr;
    });

    totalDrEl.textContent = fmtINR(totalDr);
    totalCrEl.textContent = fmtINR(totalCr);

    const diff = Math.abs(totalDr - totalCr);
    if (diff < 0.01) {
      balanceStatusEl.innerHTML = '<span class="text-emerald-600">✓ Entry is balanced</span>';
    } else {
      balanceStatusEl.innerHTML = `<span class="text-rose-600">✗ Unbalanced by ${fmtINR(diff)}</span>`;
    }
  }

  function addLine() {
    const lineEl = document.createElement('div');
    lineEl.className = 'border rounded-lg p-4 bg-gray-50 space-y-3';
    lineEl.setAttribute('data-line', '1');
    lineEl.innerHTML = `
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-bold text-gray-600 mb-1 block">Account Head *</label>
          <input type="text" placeholder="e.g., Cash, Bank, Sales" class="line-account w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
        </div>
        <div>
          <label class="text-xs font-bold text-gray-600 mb-1 block">Account Type *</label>
          <select class="line-type w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
            <option value="">Select Type</option>
            ${ACCOUNT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-bold text-gray-600 mb-1 block">Debit</label>
          <input type="number" placeholder="0.00" step="0.01" min="0" class="line-debit w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
        </div>
        <div>
          <label class="text-xs font-bold text-gray-600 mb-1 block">Credit</label>
          <input type="number" placeholder="0.00" step="0.01" min="0" class="line-credit w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
        </div>
      </div>
      <div>
        <label class="text-xs font-bold text-gray-600 mb-1 block">Narration</label>
        <input type="text" placeholder="Line description" class="line-narration w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10">
      </div>
      <button class="remove-line-btn text-red-600 hover:text-red-700 font-bold text-sm">Remove Line</button>
    `;

    linesContainer.appendChild(lineEl);

    lineEl.querySelector('.remove-line-btn').addEventListener('click', () => {
      lineEl.remove();
      updateTotals();
    });

    lineEl.querySelectorAll('.line-debit, .line-credit').forEach(input => {
      input.addEventListener('input', updateTotals);
    });

    updateTotals();
  }

  // Add initial line
  addLine();

  document.getElementById('add-line-btn').addEventListener('click', addLine);

  document.getElementById('back-btn').addEventListener('click', () => router.navigate('/ledger/manual-ledger'));
  document.getElementById('cancel-btn').addEventListener('click', () => router.navigate('/ledger/manual-ledger'));

  document.getElementById('save-btn').addEventListener('click', async () => {
    const transDate = transDateEl.value.trim();
    const narration = narrationEl.value.trim();
    const lines = [];

    if (!transDate) return showToast('Transaction date is required', 'error');

    document.querySelectorAll('[data-line]').forEach(lineEl => {
      const account = lineEl.querySelector('.line-account').value.trim();
      const type = lineEl.querySelector('.line-type').value.trim();
      const debit = parseFloat(lineEl.querySelector('.line-debit').value) || 0;
      const credit = parseFloat(lineEl.querySelector('.line-credit').value) || 0;
      const lineNarration = lineEl.querySelector('.line-narration').value.trim();

      if (account && type) {
        lines.push({
          account_head: account,
          account_type: type,
          debit_amount: debit,
          credit_amount: credit,
          narration: lineNarration,
        });
      }
    });

    if (!lines.length) return showToast('At least one line is required', 'error');

    const totalDr = lines.reduce((s, l) => s + l.debit_amount, 0);
    const totalCr = lines.reduce((s, l) => s + l.credit_amount, 0);

    if (Math.abs(totalDr - totalCr) > 0.01) {
      return showToast(`Entry must be balanced (Dr: ${fmtINR(totalDr)}, Cr: ${fmtINR(totalCr)})`, 'error');
    }

    try {
      const result = await api.post('/api/ledger/manual-ledger', {
        entries: lines,
        narration,
        transaction_date: transDate,
      });
      showToast('Entry created successfully', 'success');
      setTimeout(() => router.navigate('/ledger/manual-ledger'), 1000);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}
