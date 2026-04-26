import { renderLayout } from '../../components/layout.js';
import { requireAuth }   from '../../middleware/authMiddleware.js';
import { api }           from '../../utils/api.js';

/* ── Helpers ────────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmtINR = (n) =>
  '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

function showToast(message, type = 'success') {
  const existing = document.getElementById('nje-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'nje-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

/* ── Account type auto-detection from name keywords ─────────────── */
function guessAccountType(name) {
  const n = (name || '').toLowerCase();
  if (/\bcash\b/.test(n))                                              return 'CASH';
  if (/bank|hdfc|sbi|icici|axis|kotak|yes bank/.test(n))               return 'BANK';
  if (/debtor|receivable|customer/.test(n))                             return 'DEBTOR';
  if (/creditor|payable|supplier|vendor/.test(n))                       return 'CREDITOR';
  if (/cogs|cost of goods/.test(n))                                     return 'COGS';
  if (/purchase|inventory|stock/.test(n))                               return 'COGS';
  if (/income|revenue|\bsales\b|turnover|interest received/.test(n))    return 'INCOME';
  if (/expense|salary|wages|rent|depreciation|\bloss\b|utility/.test(n)) return 'EXPENSE';
  if (/asset|equipment|furniture|vehicle|prepaid|deposit/.test(n))      return 'ASSET';
  if (/liability|loan|borrowing|capital|reserve|retained/.test(n))      return 'LIABILITY';
  return 'GENERAL';
}

const ACCOUNT_TYPES = [
  { value: 'INCOME',                        label: 'Income'                        },
  { value: 'EXPENSE',                       label: 'Expense'                       },
  { value: 'COGS',                          label: 'Cost of Goods (COGS)'          },
  { value: 'GENERAL',                       label: 'General'                       },
  { value: 'ASSET',                         label: 'Asset'                         },
  { value: 'LIABILITY',                     label: 'Liability'                     },
  { value: 'CASH',                          label: 'Cash'                          },
  { value: 'BANK',                          label: 'Bank'                          },
  { value: 'DEBTOR',                        label: 'Debtor'                        },
  { value: 'CREDITOR',                      label: 'Creditor'                      },
  { value: 'CAPITAL',                       label: 'Capital'                       },
  { value: 'RETAINED_EARNINGS',             label: 'Retained Earnings'             },
  { value: 'LOAN',                          label: 'Loan'                          },
  { value: 'PREPAID_EXPENSE',               label: 'Prepaid Expense'               },
  { value: 'ACCUMULATED_DEPRECIATION',      label: 'Accumulated Depreciation'      },
  { value: 'ALLOWANCE_FOR_DOUBTFUL_DEBTS',  label: 'Allowance for Doubtful Debts'  },
  { value: 'DISCOUNT_RECEIVED',             label: 'Discount Received'             },
  { value: 'DISCOUNT_GIVEN',                label: 'Discount Given'                },
];

/* ── Main render ─────────────────────────────────────────────────── */

export async function renderNewJournalEntry(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div class="max-w-5xl mx-auto px-4 py-10 space-y-6">

      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-1 text-2xl font-black tracking-tight text-gray-900">New Journal Entry</h1>
          <p class="mt-1 text-sm text-gray-500">Double-entry — total debits must equal total credits</p>
        </div>
        <a href="/ledger/journal-entries" data-navigo
           class="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-slate-50 transition">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/>
          </svg>
          Back
        </a>
      </div>

      <!-- Form card -->
      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

        <!-- Meta fields -->
        <div class="grid grid-cols-1 gap-5 border-b border-gray-100 bg-gray-50/60 px-6 py-5 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Transaction Date *</label>
            <input type="date" id="je-date" required
                   class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Overall Narration</label>
            <input type="text" id="je-narration" placeholder="e.g. Salary payment for March 2025"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
          </div>
        </div>

        <!-- Lines header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="text-sm font-bold text-gray-900">Journal Lines</h3>
            <p class="text-xs text-gray-400 mt-0.5">Minimum 2 lines required &bull; Each line is either DR or CR</p>
          </div>
          <button type="button" id="add-line-btn"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Add Line
          </button>
        </div>

        <!-- Lines list -->
        <div id="je-lines" class="divide-y divide-gray-100 px-6"></div>

        <!-- Global error -->
        <div id="je-error" class="hidden mx-6 mb-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"></div>

        <!-- Balance bar -->
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

        <!-- Submit -->
        <div class="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
          <a href="/ledger/journal-entries" data-navigo
             class="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition">
            Cancel
          </a>
          <button type="button" id="je-save-btn"
                  class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  disabled title="Ctrl+Enter to save">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
            </svg>
            Save Journal Entry
          </button>
        </div>
      </div>
    </div>
  `;

  renderLayout(content, router);
  initForm(router);
}

/* ── Form controller ─────────────────────────────────────────────── */

function initForm(router) {
  const linesEl   = document.getElementById('je-lines');
  const saveBtn   = document.getElementById('je-save-btn');
  const errorEl   = document.getElementById('je-error');
  const dateEl    = document.getElementById('je-date');
  const narrationEl = document.getElementById('je-narration');

  // Defaults
  dateEl.value = new Date().toISOString().split('T')[0];

  let lineCounter = 0;
  let accountsCache = null;
  let accountTypesCache = null;

  async function getAccounts() {
    if (accountsCache !== null) return accountsCache;
    try {
      // Fetch account heads from ledger
      const accountsRes = await api.get('/api/ledger/accounts');
      let accounts = Array.isArray(accountsRes) ? accountsRes : (accountsRes.data || accountsRes.accounts || []);
      
      // Fetch parties from inventory
      const partiesRes = await api.get('/api/inventory/purchase/parties');
      let parties = Array.isArray(partiesRes) ? partiesRes : (partiesRes.data || []);
      
      // Combine with duplicate prevention
      const uniqueHeads = new Map();
      
      // Add account heads first
      accounts.forEach(account => {
        if (account.account_head) {
          const key = account.account_head.toLowerCase().trim();
          if (!uniqueHeads.has(key)) {
            uniqueHeads.set(key, account);
          }
        }
      });
      
      // Add parties (skip if already exists as account head)
      parties.forEach(party => {
        if (party.firm) {
          const key = party.firm.toLowerCase().trim();
          if (!uniqueHeads.has(key)) {
            uniqueHeads.set(key, {
              account_head: party.firm,
              account_type: 'DEBTOR',
              total_debit: 0,
              total_credit: 0
            });
          }
        }
      });
      
      accountsCache = Array.from(uniqueHeads.values()).sort((a, b) => 
        (a.account_head || '').localeCompare(b.account_head || '')
      );
    } catch {
      accountsCache = [];
    }
    return accountsCache;
  }

  async function getAccountTypes() {
    if (accountTypesCache !== null) return accountTypesCache;
    let fromSummary = [];
    try {
      const res = await api.get('/api/ledger/account-types');
      if (Array.isArray(res)) {
        fromSummary = res;
      } else if (res && typeof res === 'object') {
        fromSummary = res.accountTypes || res.account_types || res.data || res.result || res.items || [];
        if (!Array.isArray(fromSummary)) {
          const firstArray = Object.values(res).find(v => Array.isArray(v));
          fromSummary = firstArray || [];
        }
      }
    } catch {
      fromSummary = [];
    }
    const fromDB = fromSummary
      .map((entry) => String(entry?.account_type || '').trim().toUpperCase())
      .filter(Boolean);
    if (!fromDB.length) {
      const accounts = await getAccounts();
      fromDB.push(...accounts.map((account) => String(account?.account_type || '').trim().toUpperCase()).filter(Boolean));
    }
    const hardcoded = ACCOUNT_TYPES.map((type) => type.value);
    accountTypesCache = [...new Set([...fromDB, ...hardcoded])];
    return accountTypesCache;
  }

  // Start with 2 lines
  addLine();
  addLine();

  document.getElementById('add-line-btn').addEventListener('click', addLine);

  linesEl.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-line-btn');
    if (removeBtn) { removeLine(removeBtn.dataset.id); return; }
    const typeBtn = e.target.closest('.type-btn');
    if (typeBtn) {
      const row = typeBtn.closest('.je-line');
      if (row) { setToggle(row, typeBtn.dataset.type); updateBalance(); }
    }
  });

  linesEl.addEventListener('input', (e) => {
    if (e.target.classList.contains('account-head-input')) {
      e.target.classList.remove('border-red-400', 'ring-red-200');
      const row = e.target.closest('.je-line');
      if (!row) return;
      const typeInput = row.querySelector('.account-type-input');
      if (!typeInput) return;
      const typedHead = e.target.value.trim().toLowerCase();
      getAccounts().then((accounts) => {
        const matched = accounts.find((account) => String(account?.account_head || '').trim().toLowerCase() === typedHead);
        const resolvedType = matched?.account_type || guessAccountType(e.target.value);
        setAccountTypeValue(typeInput, resolvedType);
        
        // Display account balance
        if (matched) {
          displayAccountBalance(row, matched);
        } else {
          hideAccountBalance(row);
        }
      });
    }
    if (e.target.classList.contains('amount-input')) {
      e.target.classList.remove('border-red-400', 'ring-red-200');
    }
    updateBalance();
  });

  linesEl.addEventListener('change', updateBalance);
  saveBtn.addEventListener('click', handleSubmit);

  // Keyboard navigation
  const handleKeydown = (e) => {
    if (e.key === 'Escape') router.navigate('/ledger/journal-entries');
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!saveBtn.disabled) handleSubmit();
    }
  };
  document.addEventListener('keydown', handleKeydown);
  // Clean up listener when navigating away
  const originalNavigate = router.navigate;
  router.navigate = (...args) => {
    document.removeEventListener('keydown', handleKeydown);
    return originalNavigate.apply(router, args);
  };

  function setToggle(row, activeType) {
    row.querySelector('.line-type').value = activeType;
    const isDR = activeType === 'DR';
    row.querySelectorAll('.type-btn').forEach(b => {
      const isActive = b.dataset.type === activeType;
      b.className = 'type-btn px-3 py-2 transition text-xs font-bold';
      if (isActive) {
        b.classList.add(isDR ? 'bg-emerald-500' : 'bg-red-500', 'text-white');
      } else {
        b.classList.add('bg-white', 'text-gray-400', 'hover:bg-gray-50');
      }
    });
  }

  async function addLine() {
    lineCounter++;
    const id = `ln-${lineCounter}`;
    const html = `
      <div class="je-line py-4" data-line-id="${id}">
        <div class="flex items-start gap-3">
          <div class="mt-2.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 line-num"></div>
          <div class="flex flex-col gap-1 flex-shrink-0">
            <label class="text-[10px] font-bold uppercase tracking-wide text-gray-400 text-center">DR / CR</label>
            <div class="flex overflow-hidden rounded-xl border border-gray-200 text-xs font-bold">
              <button type="button" class="type-btn px-3 py-2 transition bg-emerald-500 text-white" data-type="DR">DR</button>
              <button type="button" class="type-btn px-3 py-2 transition bg-white text-gray-500 hover:bg-gray-50" data-type="CR">CR</button>
            </div>
            <input type="hidden" class="line-type" value="DR">
          </div>
          <div class="flex-1 min-w-0">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Account Head *</label>
            <div class="relative">
              <input type="text" class="account-head-input w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                     placeholder="Start typing account name…" autocomplete="off" list="${id}-datalist" required>
              <datalist id="${id}-datalist"></datalist>
            </div>
            <div class="account-balance-display hidden mt-2 rounded-lg bg-indigo-50 border border-indigo-200 p-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Balance:</span>
                <span class="account-balance-value text-xs font-bold text-indigo-700">₹0.00</span>
              </div>
            </div>
          </div>
          <div class="w-32 flex-shrink-0">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Acct Type</label>
            <select class="account-type-input w-full rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
              <option value="GENERAL">GENERAL</option>
            </select>
          </div>
          <div class="w-36 flex-shrink-0">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Amount *</label>
            <input type="number" class="amount-input w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-right font-semibold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                   step="0.01" min="0.01" placeholder="0.00">
          </div>
          <div class="flex-1 min-w-0">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Line Narration</label>
            <input type="text" class="line-narration w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                   placeholder="Optional description…">
          </div>
          <div class="mt-6 flex-shrink-0">
            <button type="button" class="remove-line-btn flex h-8 w-8 items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-500 transition" data-id="${id}" title="Remove line">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
    linesEl.insertAdjacentHTML('beforeend', html);
    const newRow = linesEl.querySelector(`[data-line-id="${id}"]`);
    setToggle(newRow, 'DR');
    renumberLines();
    updateBalance();
    Promise.all([getAccounts(), getAccountTypes()]).then(([accounts, types]) => {
      const headDl = document.getElementById(`${id}-datalist`);
      if (headDl) {
        headDl.innerHTML = accounts.map(a => `<option value="${esc(a.account_head)}">`).join('');
      }
      const typeSelect = newRow?.querySelector('.account-type-input');
      if (typeSelect) {
        typeSelect.innerHTML = types.map((type) => `<option value="${esc(type)}">${esc(type)}</option>`).join('');
        setAccountTypeValue(typeSelect, 'GENERAL');
      }
    });
  }

  function removeLine(id) {
    if (linesEl.querySelectorAll('.je-line').length <= 2) {
      showToast('Minimum 2 lines required', 'info');
      return;
    }
    const row = linesEl.querySelector(`[data-line-id="${id}"]`);
    if (row) row.remove();
    renumberLines();
    updateBalance();
  }

  function renumberLines() {
    linesEl.querySelectorAll('.je-line').forEach((row, i) => {
      const numEl = row.querySelector('.line-num');
      if (numEl) numEl.textContent = i + 1;
    });
  }

  function displayAccountBalance(row, accountData) {
    const balanceDisplay = row.querySelector('.account-balance-display');
    if (!balanceDisplay) return;
    
    const balance = (accountData.total_debit || 0) - (accountData.total_credit || 0);
    const status = balance >= 0 ? 'DR' : 'CR';
    const balanceValue = row.querySelector('.account-balance-value');
    
    if (balanceValue) {
      balanceValue.textContent = fmtINR(Math.abs(balance)) + ` ${status}`;
    }
    balanceDisplay.classList.remove('hidden');
  }

  function hideAccountBalance(row) {
    const balanceDisplay = row.querySelector('.account-balance-display');
    if (balanceDisplay) {
      balanceDisplay.classList.add('hidden');
    }
  }

  function updateBalance() {
    let dr = 0, cr = 0;
    linesEl.querySelectorAll('.je-line').forEach(row => {
      const type = row.querySelector('.line-type')?.value;
      const amt  = parseFloat(row.querySelector('.amount-input')?.value) || 0;
      if (type === 'DR') dr += amt;
      else               cr += amt;
    });
    const diff = Math.abs(dr - cr);
    const balanced = diff < 0.01 && dr > 0;
    document.getElementById('tot-dr').textContent   = fmtINR(dr);
    document.getElementById('tot-cr').textContent   = fmtINR(cr);
    document.getElementById('tot-diff').textContent = fmtINR(diff);
    const statusEl = document.getElementById('tot-status');
    if (balanced) {
      statusEl.textContent  = 'Balanced ✓';
      statusEl.className    = 'text-[10px] font-bold mt-0.5 text-emerald-600';
      document.getElementById('tot-diff').className = 'mt-1 text-xl font-black text-gray-800';
    } else if (dr === 0 && cr === 0) {
      statusEl.textContent  = 'Enter amounts';
      statusEl.className    = 'text-[10px] font-bold mt-0.5 text-gray-400';
      document.getElementById('tot-diff').className = 'mt-1 text-xl font-black text-gray-800';
    } else {
      const side = dr > cr ? 'DR heavy' : 'CR heavy';
      statusEl.textContent  = `Imbalanced (${side})`;
      statusEl.className    = 'text-[10px] font-bold mt-0.5 text-red-500';
      document.getElementById('tot-diff').className = 'mt-1 text-xl font-black text-red-600';
    }
    saveBtn.disabled = !balanced;
    clearInlineError();
  }

  function showInlineError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearInlineError() {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  async function handleSubmit() {
    clearInlineError();
    const transactionDate = dateEl.value;
    const narration       = narrationEl.value.trim();
    if (!transactionDate) {
      dateEl.classList.add('border-red-400', 'ring-red-200');
      showInlineError('Please select a transaction date.');
      return;
    }
    dateEl.classList.remove('border-red-400', 'ring-red-200');

    const submitLines = [];
    let hasAccountError = false;
    let hasAmountError = false;

    linesEl.querySelectorAll('.je-line').forEach((row) => {
      const headInp = row.querySelector('.account-head-input');
      const amtInp = row.querySelector('.amount-input');
      const accountHead = headInp?.value?.trim();
      const accountType = (row.querySelector('.account-type-input')?.value?.trim().toUpperCase()) || 'GENERAL';
      const type        = row.querySelector('.line-type')?.value;
      const amount      = parseFloat(amtInp?.value) || 0;
      const lineNarr    = row.querySelector('.line-narration')?.value?.trim();

      if (amount > 0) {
        if (!accountHead) {
          headInp.classList.add('border-red-400', 'ring-red-200');
          hasAccountError = true;
        } else {
          headInp.classList.remove('border-red-400', 'ring-red-200');
          submitLines.push({
            account_head:  accountHead,
            account_type:  accountType,
            debit_amount:  type === 'DR' ? amount : 0,
            credit_amount: type === 'CR' ? amount : 0,
            narration:     lineNarr || narration || undefined,
          });
        }
      } else if (accountHead) {
        amtInp.classList.add('border-red-400', 'ring-red-200');
        hasAmountError = true;
      }
    });

    if (hasAccountError) { showInlineError('Please specify account head for all lines with amounts.'); return; }
    if (hasAmountError) { showInlineError('Please specify amount for all accounts.'); return; }
    if (submitLines.length < 2) { showInlineError('At least 2 lines with amounts are required.'); return; }

    const totDR = submitLines.reduce((s, l) => s + l.debit_amount,  0);
    const totCR = submitLines.reduce((s, l) => s + l.credit_amount, 0);
    if (Math.abs(totDR - totCR) >= 0.01) {
      showInlineError(`Entry is not balanced — Debits ${fmtINR(totDR)} vs Credits ${fmtINR(totCR)}.`);
      return;
    }

    try {
      saveBtn.disabled = true;
      const originalLabel = saveBtn.innerHTML;
      saveBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Saving…';

      await api.post('/api/ledger/journal-entries', {
        entries:          submitLines,
        narration:        narration || undefined,
        transaction_date: transactionDate,
      });

      showToast('Journal entry created successfully');
      setTimeout(() => router.navigate('/ledger/journal-entries'), 1000);
    } catch (err) {
      showInlineError('Error saving entry: ' + (err.message || 'Unknown error'));
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg> Save Journal Entry';
    }
  }
}

function setAccountTypeValue(selectEl, value) {
  if (!selectEl) return;
  const normalizedValue = String(value || 'GENERAL').trim().toUpperCase() || 'GENERAL';
  const hasOption = Array.from(selectEl.options || []).some((option) => option.value === normalizedValue);
  if (!hasOption) {
    const option = document.createElement('option');
    option.value = normalizedValue;
    option.textContent = normalizedValue;
    selectEl.appendChild(option);
  }
  selectEl.value = normalizedValue;
}