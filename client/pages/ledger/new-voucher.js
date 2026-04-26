import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { fetchBankAccounts, populateBankAccountSelect } from '../../utils/bankAccounts.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function showToast(message, type = 'success') {
  const existing = document.getElementById('nv-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'nv-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

const ACCOUNT_TYPES = [
  'INCOME', 'EXPENSE', 'COGS', 'GENERAL',
  'ASSET', 'LIABILITY', 'CASH', 'BANK',
  'DEBTOR', 'CREDITOR', 'CAPITAL', 'RETAINED_EARNINGS',
  'LOAN', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION',
  'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'DISCOUNT_RECEIVED', 'DISCOUNT_GIVEN'
];

export async function renderNewVoucher(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-2xl font-black tracking-tight text-gray-900">New Voucher</h1>
          <p class="text-xs text-gray-500 mt-0.5">Create a new payment or receipt voucher</p>
        </div>
        <div class="flex gap-2">
          <a href="/ledger/bank-accounts" data-navigo class="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 transition">
            Bank Accounts
          </a>
          <a href="/ledger/vouchers" data-navigo class="inline-flex items-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 transition">
            ← Back
          </a>
        </div>
      </div>

      <form id="voucher-form" class="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-4">Voucher Type *</label>
          <div class="flex gap-8">
            <label class="flex items-center cursor-pointer group">
              <input type="radio" name="voucher_type" value="RECEIPT" required class="w-5 h-5 text-emerald-600 bg-gray-100 border-gray-300 focus:ring-emerald-500">
              <span class="ml-2.5 text-sm font-bold text-gray-700 group-hover:text-emerald-600 transition">Receipt Voucher</span>
            </label>
            <label class="flex items-center cursor-pointer group">
              <input type="radio" name="voucher_type" value="PAYMENT" required class="w-5 h-5 text-red-600 bg-gray-100 border-gray-300 focus:ring-red-500">
              <span class="ml-2.5 text-sm font-bold text-gray-700 group-hover:text-red-600 transition">Payment Voucher</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Transaction Date *</label>
            <input type="date" id="transaction-date" name="transaction_date" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Account Head *</label>
            <div class="relative">
              <select id="party-select" name="party_id" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium appearance-none">
                <option value="">Select Account Head</option>
              </select>
              <div id="party-loading-spinner" class="absolute right-4 top-1/2 -translate-y-1/2">
                <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Amount *</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
              <input type="number" id="amount" name="amount" step="0.01" min="0.01" required class="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-bold" placeholder="0.00">
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Payment Mode *</label>
            <select id="payment-mode" name="payment_mode" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
              <option value="">Select Payment Mode</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <div id="bank-account-section" class="hidden">
          <label class="block text-sm font-bold text-gray-700 mb-2">Bank Account</label>
          <select id="bank-account-select" name="bank_account_id" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
            <option value="">Select Bank Account</option>
          </select>
        </div>

        <div id="account-balance-section" class="hidden bg-indigo-50 border border-indigo-200 rounded-2xl p-3 space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black uppercase tracking-widest text-indigo-600">Account Balance</h4>
            <p id="account-balance-head" class="text-xs font-bold text-indigo-900">-</p>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-white rounded-lg p-2 border border-indigo-100">
              <span class="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Type</span>
              <p id="account-balance-type" class="text-xs font-bold text-gray-900 mt-0.5">-</p>
            </div>
            <div class="bg-white rounded-lg p-2 border border-indigo-100">
              <span class="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Balance</span>
              <p id="account-balance-amount" class="text-xs font-bold text-indigo-600 mt-0.5">₹0.00</p>
            </div>
            <div class="bg-white rounded-lg p-2 border border-indigo-100">
              <span class="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Status</span>
              <p id="account-balance-status" class="text-xs font-bold text-gray-900 mt-0.5">-</p>
            </div>
          </div>
        </div>

        <div id="bank-account-balance-section" class="hidden bg-purple-50 border border-purple-200 rounded-2xl p-3 space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black uppercase tracking-widest text-purple-600">Bank Balance</h4>
            <p id="bank-account-balance-name" class="text-xs font-bold text-purple-900">-</p>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-white rounded-lg p-2 border border-purple-100">
              <span class="text-[9px] font-bold text-purple-600 uppercase tracking-wider">Bank</span>
              <p id="bank-account-balance-bank" class="text-xs font-bold text-gray-900 mt-0.5">-</p>
            </div>
            <div class="bg-white rounded-lg p-2 border border-purple-100">
              <span class="text-[9px] font-bold text-purple-600 uppercase tracking-wider">Balance</span>
              <p id="bank-account-balance-amount" class="text-xs font-bold text-purple-600 mt-0.5">₹0.00</p>
            </div>
            <div class="bg-white rounded-lg p-2 border border-purple-100">
              <span class="text-[9px] font-bold text-purple-600 uppercase tracking-wider">Status</span>
              <p id="bank-account-balance-status" class="text-xs font-bold text-gray-900 mt-0.5">-</p>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Narration</label>
          <textarea id="narration" name="narration" rows="3" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none font-medium" placeholder="Enter voucher description"></textarea>
        </div>

        <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <h4 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Transaction Summary</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</span>
              <p id="summary-type" class="text-sm font-bold text-slate-900">-</p>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Party</span>
              <p id="summary-party" class="text-sm font-bold text-slate-900 truncate">-</p>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</span>
              <p id="summary-amount" class="text-sm font-black text-emerald-600">-</p>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode</span>
              <p id="summary-mode" class="text-sm font-bold text-slate-900">-</p>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-6 border-t border-gray-100">
          <a href="/ledger/vouchers" data-navigo class="px-6 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition">Cancel</a>
          <button type="submit" id="save-btn" class="px-8 py-2.5 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition disabled:opacity-50 disabled:cursor-not-allowed">Save Voucher</button>
        </div>
      </form>
    </div>
  `;

  renderLayout(content, router);
  setTimeout(() => initVoucherForm(router), 100);
}

function initVoucherForm(router) {
  const form = document.getElementById('voucher-form');
  const transactionDateInput = document.getElementById('transaction-date');
  const partySelect = document.getElementById('party-select');
  const partySpinner = document.getElementById('party-loading-spinner');
  const amountInput = document.getElementById('amount');
  const paymentModeSelect = document.getElementById('payment-mode');
  const bankAccountSection = document.getElementById('bank-account-section');
  const bankAccountSelect = document.getElementById('bank-account-select');
  const narrationInput = document.getElementById('narration');
  const saveBtn = document.getElementById('save-btn');
  const noTransactionSection = document.getElementById('no-transaction-section');
  const accountBalanceSection = document.getElementById('account-balance-section');
  const bankAccountBalanceSection = document.getElementById('bank-account-balance-section');

  let allParties = [];
  let allAccountHeads = [];
  let allBankAccounts = [];
  let currentOpeningBalance = null;

  const today = new Date().toISOString().split('T')[0];
  transactionDateInput.value = today;

  loadAccountHeads();
  loadBankAccounts();

  const handleKeydown = (e) => {
    if (e.key === 'Escape') router.navigate('/ledger/vouchers');
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!saveBtn.disabled) handleSubmit(new Event('submit'));
    }
  };
  document.addEventListener('keydown', handleKeydown);
  const originalNavigate = router.navigate;
  router.navigate = (...args) => {
    document.removeEventListener('keydown', handleKeydown);
    return originalNavigate.apply(router, args);
  };

  document.querySelectorAll('input[name="voucher_type"]').forEach(radio => {
    radio.addEventListener('change', updateSummary);
  });

  partySelect.addEventListener('change', async () => {
    partySelect.classList.remove('border-red-500', 'ring-red-100');
    const selectedAccountHead = partySelect.value;
    if (selectedAccountHead) {
      await loadAccountBalance();
    } else {
      accountBalanceSection.classList.add('hidden');
    }
    updateSummary();
  });
  
  amountInput.addEventListener('input', () => {
    amountInput.classList.remove('border-red-500', 'ring-red-100');
    updateSummary();
  });

  paymentModeSelect.addEventListener('change', () => {
    paymentModeSelect.classList.remove('border-red-500', 'ring-red-100');
    handlePaymentModeChange();
  });

  bankAccountSelect.addEventListener('change', async () => {
    await loadBankAccountBalance();
  });

  form.addEventListener('submit', handleSubmit);

  async function loadAccountHeads() {
    try {
      // Fetch account heads from ledger
      const accountsResponse = await api.get('/api/ledger/accounts');
      const accounts = Array.isArray(accountsResponse) ? accountsResponse : (accountsResponse.data || []);
      
      // Fetch parties from inventory
      const partiesResponse = await api.get('/api/inventory/purchase/parties');
      const parties = Array.isArray(partiesResponse) ? partiesResponse : (partiesResponse.data || []);
      
      // Combine account heads and parties with duplicate prevention
      const uniqueHeads = new Map();
      
      // Add account heads first
      accounts.forEach(account => {
        if (account.account_head) {
          const key = account.account_head.toLowerCase().trim();
          if (!uniqueHeads.has(key)) {
            uniqueHeads.set(key, {
              account_head: account.account_head,
              account_type: account.account_type,
              source: 'ledger'
            });
          }
        }
      });
      
      // Add parties (will skip if already exists as account head)
      parties.forEach(party => {
        if (party.firm) {
          const key = party.firm.toLowerCase().trim();
          if (!uniqueHeads.has(key)) {
            uniqueHeads.set(key, {
              account_head: party.firm,
              account_type: 'DEBTOR', // Default type for parties
              source: 'party'
            });
          }
        }
      });
      
      allAccountHeads = Array.from(uniqueHeads.values()).sort((a, b) => 
        a.account_head.localeCompare(b.account_head)
      );
      
      partySpinner?.classList.add('hidden');
      partySelect.innerHTML = '<option value="">Select Account Head</option>' +
        allAccountHeads.map(account => `<option value="${esc(account.account_head)}">${esc(account.account_head)} (${esc(account.account_type)})</option>`).join('');
    } catch (error) {
      console.error('Failed to load account heads:', error);
      partySpinner?.classList.add('hidden');
      partySelect.innerHTML = '<option value="">Failed to load account heads</option>';
    }
  }

  async function loadBankAccounts() {
    try {
      const accounts = await fetchBankAccounts(true);
      allBankAccounts = accounts;
      const defaultAccount = accounts.find((account) => account.is_default) || accounts[0] || null;
      populateBankAccountSelect(bankAccountSelect, accounts, defaultAccount?._id || '');
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
      bankAccountSelect.innerHTML = '<option value="">Failed to load bank accounts</option>';
    }
  }

  async function loadAccountBalance() {
    const accountHead = partySelect.value;
    if (!accountHead) {
      accountBalanceSection.classList.add('hidden');
      return;
    }

    try {
      const response = await api.get(`/api/ledger/accounts`);
      const accounts = Array.isArray(response) ? response : (response.data || []);
      
      const accountData = accounts.find(a => 
        a.account_head && 
        a.account_head.toLowerCase().trim() === accountHead.toLowerCase().trim()
      );

      if (accountData) {
        displayAccountBalance(accountData);
        accountBalanceSection.classList.remove('hidden');
      } else {
        accountBalanceSection.classList.add('hidden');
      }
    } catch (error) {
      console.error('Failed to load account balance:', error);
      accountBalanceSection.classList.add('hidden');
    }
  }

  function displayAccountBalance(account) {
    const fmtINR = (n) => '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(n || 0)));
    const balance = (account.total_debit || 0) - (account.total_credit || 0);
    const status = balance >= 0 ? 'DR' : 'CR';
    
    document.getElementById('account-balance-head').textContent = esc(account.account_head);
    document.getElementById('account-balance-type').textContent = esc(account.account_type || '-');
    document.getElementById('account-balance-amount').textContent = fmtINR(balance);
    document.getElementById('account-balance-status').textContent = status;
  }

  async function loadBankAccountBalance() {
    const bankAccountId = bankAccountSelect.value;
    if (!bankAccountId) {
      bankAccountBalanceSection.classList.add('hidden');
      return;
    }

    try {
      const bankAccount = allBankAccounts.find(b => b._id === bankAccountId);
      if (!bankAccount) {
        bankAccountBalanceSection.classList.add('hidden');
        return;
      }

      const response = await api.get(`/api/ledger/accounts`);
      const accounts = Array.isArray(response) ? response : (response.data || []);
      
      // Try to find account by account_name first
      let accountData = accounts.find(a => 
        a.account_head && 
        a.account_head.toLowerCase().trim() === (bankAccount.account_name || '').toLowerCase().trim()
      );

      // If not found, try by bank_name
      if (!accountData) {
        accountData = accounts.find(a => 
          a.account_head && 
          a.account_head.toLowerCase().trim() === (bankAccount.bank_name || '').toLowerCase().trim()
        );
      }

      // If still not found, try to find any BANK type account
      if (!accountData) {
        accountData = accounts.find(a => a.account_type === 'BANK');
      }

      // Display bank account balance (with or without matching ledger account)
      displayBankAccountBalance(bankAccount, accountData);
      bankAccountBalanceSection.classList.remove('hidden');
    } catch (error) {
      console.error('Failed to load bank account balance:', error);
      bankAccountBalanceSection.classList.add('hidden');
    }
  }

  function displayBankAccountBalance(bankAccount, accountData) {
    const fmtINR = (n) => '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(n || 0)));
    const balance = accountData ? ((accountData.total_debit || 0) - (accountData.total_credit || 0)) : 0;
    const status = bankAccount.status === 'ACTIVE' ? 'Active' : 'Inactive';
    
    document.getElementById('bank-account-balance-name').textContent = esc(bankAccount.account_name || bankAccount.bank_name || '-');
    document.getElementById('bank-account-balance-bank').textContent = esc(bankAccount.bank_name || '-');
    document.getElementById('bank-account-balance-amount').textContent = fmtINR(balance);
    document.getElementById('bank-account-balance-status').textContent = status;
  }

  function handlePaymentModeChange() {
    const paymentMode = paymentModeSelect.value;
    const isBankMode = paymentMode && !paymentMode.toLowerCase().includes('cash');
    if (isBankMode) {
      bankAccountSection.classList.remove('hidden');
      bankAccountSelect.required = true;
      // Load balance for the currently selected (default) bank account
      loadBankAccountBalance();
    } else {
      bankAccountSection.classList.add('hidden');
      bankAccountBalanceSection.classList.add('hidden');
      bankAccountSelect.required = false;
      bankAccountSelect.value = '';
    }
    updateSummary();
  }

  function updateSummary() {
    const voucherType = document.querySelector('input[name="voucher_type"]:checked')?.value || '';
    const accountHead = partySelect.value || '';
    const amount = parseFloat(amountInput.value) || 0;
    const paymentMode = paymentModeSelect.value;

    document.getElementById('summary-type').textContent = voucherType ? voucherType.charAt(0).toUpperCase() + voucherType.slice(1).toLowerCase() : '-';
    document.getElementById('summary-party').textContent = accountHead || '-';
    document.getElementById('summary-amount').textContent = amount > 0 ? `₹${amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-';
    document.getElementById('summary-mode').textContent = paymentMode || '-';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(form);
    const voucherData = Object.fromEntries(formData);
    let hasError = false;

    if (!voucherData.voucher_type) {
      showToast('Please select voucher type', 'error');
      hasError = true;
    }
    if (!voucherData.party_id) {
      partySelect.classList.add('border-red-500', 'ring-red-100');
      hasError = true;
    }
    if (!voucherData.amount || parseFloat(voucherData.amount) <= 0) {
      amountInput.classList.add('border-red-500', 'ring-red-100');
      hasError = true;
    }
    if (!voucherData.payment_mode) {
      paymentModeSelect.classList.add('border-red-500', 'ring-red-100');
      hasError = true;
    }

    const isBankMode = voucherData.payment_mode && !voucherData.payment_mode.toLowerCase().includes('cash');
    if (isBankMode && !voucherData.bank_account_id) {
      bankAccountSelect.classList.add('border-red-500', 'ring-red-100');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      // Convert party_id (account head) to account_head for API
      const submitData = {
        ...voucherData,
        account_head: voucherData.party_id,
      };
      delete submitData.party_id;

      const response = await fetchWithCSRF('/api/ledger/vouchers', {
        method: 'POST',
        body: JSON.stringify(submitData),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to create voucher');
      }

      showToast('Voucher created successfully!');
      setTimeout(() => router.navigate('/ledger/vouchers'), 1000);
      
    } catch (error) {
      showToast('Error creating voucher: ' + error.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Voucher';
    }
  }

  updateSummary();
}
