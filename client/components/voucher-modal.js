/**
 * Voucher Edit Modal Component
 * Handles the editable voucher modal for viewing/editing voucher details
 */

import { api, fetchWithCSRF } from '../utils/api.js';
import { fetchBankAccounts, populateBankAccountSelect } from '../utils/bankAccounts.js';

/* ── Helpers ────────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function showToast(message, type = 'success') {
  const existing = document.getElementById('vm-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'vm-toast';
  el.className = `fixed bottom-6 right-6 z-[60] flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export function openVoucherModal(voucher, callbacks) {
  const { onUpdate } = callbacks;

  // Create modal HTML
  const modalHTML = `
    <div id="voucher-modal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <h2 class="text-xl font-bold">Edit Voucher</h2>
          <button id="close-voucher-modal" class="text-white hover:text-gray-200 text-2xl leading-none focus:outline-none">&times;</button>
        </div>

        <form id="voucher-edit-form" class="p-6 space-y-6">
          <!-- Voucher Type -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-4">Voucher Type *</label>
            <div class="flex gap-6">
              <label class="flex items-center cursor-pointer">
                <input type="radio" name="voucher_type" value="RECEIPT" ${voucher.voucher_type === 'RECEIPT' ? 'checked' : ''}
                       class="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 focus:ring-green-500" required>
                <span class="ml-2 text-sm font-medium text-gray-900">Receipt Voucher</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input type="radio" name="voucher_type" value="PAYMENT" ${voucher.voucher_type === 'PAYMENT' ? 'checked' : ''}
                       class="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 focus:ring-red-500" required>
                <span class="ml-2 text-sm font-medium text-gray-900">Payment Voucher</span>
              </label>
            </div>
          </div>

          <!-- Basic Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Transaction Date *</label>
              <input type="date" id="transaction-date" name="transaction_date"
                     value="${voucher.transaction_date ? new Date(voucher.transaction_date).toISOString().split('T')[0] : ''}"
                     required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Party *</label>
              <div class="relative">
                <select id="party-select" name="party_id" required
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition appearance-none">
                  <option value="">Loading parties...</option>
                </select>
                <div id="party-loading-spinner" class="absolute right-8 top-1/2 -translate-y-1/2">
                   <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Amount and Payment Mode -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Amount *</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input type="number" id="amount" name="amount" step="0.01" min="0.01"
                       value="${voucher.amount || ''}" required
                       class="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" placeholder="0.00">
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Payment Mode *</label>
              <select id="payment-mode" name="payment_mode" required
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
                <option value="">Select Payment Mode</option>
                <option value="Cash" ${voucher.payment_mode === 'Cash' ? 'selected' : ''}>Cash</option>
                <option value="Cheque" ${voucher.payment_mode === 'Cheque' ? 'selected' : ''}>Cheque</option>
                <option value="NEFT" ${voucher.payment_mode === 'NEFT' ? 'selected' : ''}>NEFT</option>
                <option value="RTGS" ${voucher.payment_mode === 'RTGS' ? 'selected' : ''}>RTGS</option>
                <option value="UPI" ${voucher.payment_mode === 'UPI' ? 'selected' : ''}>UPI</option>
                <option value="Bank Transfer" ${voucher.payment_mode === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
              </select>
            </div>
          </div>

          <!-- Bank Account (conditional) -->
          <div id="bank-account-section" class="hidden">
            <label class="block text-sm font-semibold text-gray-700 mb-2">Bank Account</label>
            <select id="bank-account-select" name="bank_account_id"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
              <option value="">Select Bank Account</option>
            </select>
          </div>

          <!-- Narration -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Narration</label>
            <textarea id="narration" name="narration" rows="3"
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
                      placeholder="Enter voucher description">${esc(voucher.narration || '')}</textarea>
          </div>

          <!-- Transaction Summary -->
          <div class="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Transaction Summary</h4>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500 uppercase font-bold tracking-wider">Type:</span>
                <span id="summary-type" class="text-sm font-medium text-gray-900">${esc(voucher.voucher_type || '-')}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500 uppercase font-bold tracking-wider">Party:</span>
                <span id="summary-party" class="text-sm font-medium text-gray-900">${esc(voucher.party_name || '-')}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500 uppercase font-bold tracking-wider">Amount:</span>
                <span id="summary-amount" class="text-sm font-medium text-gray-900">${voucher.amount ? `₹${parseFloat(voucher.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-'}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500 uppercase font-bold tracking-wider">Payment Mode:</span>
                <span id="summary-mode" class="text-sm font-medium text-gray-900">${esc(voucher.payment_mode || '-')}</span>
              </div>
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <button type="button" id="cancel-edit-btn" class="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition">
              Cancel
            </button>
            <button type="submit" id="save-btn" class="px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition disabled:opacity-50 disabled:cursor-not-allowed">
              Update Voucher
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Remove existing modal if present
  const existingModal = document.getElementById('voucher-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Get modal elements
  const modal = document.getElementById('voucher-modal');
  const form = document.getElementById('voucher-edit-form');
  const closeBtn = document.getElementById('close-voucher-modal');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const saveBtn = document.getElementById('save-btn');

  // Form elements
  const transactionDateInput = document.getElementById('transaction-date');
  const partySelect = document.getElementById('party-select');
  const partySpinner = document.getElementById('party-loading-spinner');
  const amountInput = document.getElementById('amount');
  const paymentModeSelect = document.getElementById('payment-mode');
  const bankAccountSection = document.getElementById('bank-account-section');
  const bankAccountSelect = document.getElementById('bank-account-select');
  const narrationInput = document.getElementById('narration');

  // Initialize modal
  initializeModal();

  async function initializeModal() {
    try {
      // Load parties and pre-select current party
      await loadParties(voucher.party_id);

      // Load bank accounts
      await loadBankAccounts();

      // Set up event listeners
      setupEventListeners();

      // Initialize UI state
      handlePaymentModeChange();
      updateSummary();

    } catch (error) {
      console.error('Error initializing modal:', error);
      showToast('Error loading modal data', 'error');
    }
  }

  async function loadParties(selectedPartyId) {
    try {
      const data = await api.get('/api/inventory/sales/parties');
      const parties = data.data || [];

      partySpinner?.classList.add('hidden');
      partySelect.innerHTML = '<option value="">Select Party</option>' +
        parties.map(party => `<option value="${party._id || party.id}" ${(party._id || party.id) == selectedPartyId ? 'selected' : ''}>${esc(party.firm)} (${esc(party.contact_person || 'N/A')})</option>`).join('');

    } catch (error) {
      console.error('Failed to load parties:', error);
      partySpinner?.classList.add('hidden');
      partySelect.innerHTML = '<option value="">Failed to load parties</option>';
    }
  }

  async function loadBankAccounts() {
    try {
      const accounts = await fetchBankAccounts(true);
      const defaultAccount = accounts.find((account) => account.is_default) || accounts[0] || null;
      populateBankAccountSelect(bankAccountSelect, accounts, voucher.bank_account_id || defaultAccount?._id || '');
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
      bankAccountSelect.innerHTML = '<option value="">Failed to load bank accounts</option>';
    }
  }

  function setupEventListeners() {
    // Close modal
    closeBtn.addEventListener('click', () => closeModal());
    cancelBtn.addEventListener('click', () => closeModal());

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Keyboard support
    const handleKeydown = (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit(new Event('submit'));
      }
    };
    document.addEventListener('keydown', handleKeydown);
    modal._keydownHandler = handleKeydown;

    // Form interactions
    document.querySelectorAll('input[name="voucher_type"]').forEach(radio => {
      radio.addEventListener('change', updateSummary);
    });

    partySelect.addEventListener('change', () => {
      partySelect.classList.remove('border-red-500', 'ring-red-200');
      updateSummary();
    });
    
    amountInput.addEventListener('input', () => {
      amountInput.classList.remove('border-red-500', 'ring-red-200');
      updateSummary();
    });

    paymentModeSelect.addEventListener('change', () => {
      paymentModeSelect.classList.remove('border-red-500', 'ring-red-200');
      handlePaymentModeChange();
    });

    form.addEventListener('submit', handleSubmit);
  }

  function handlePaymentModeChange() {
    const paymentMode = paymentModeSelect.value;
    const isBankMode = paymentMode && !paymentMode.toLowerCase().includes('cash');

    if (isBankMode) {
      bankAccountSection.classList.remove('hidden');
      bankAccountSelect.required = true;
    } else {
      bankAccountSection.classList.add('hidden');
      bankAccountSelect.required = false;
      bankAccountSelect.value = '';
    }

    updateSummary();
  }

  function updateSummary() {
    const voucherType = document.querySelector('input[name="voucher_type"]:checked')?.value || '';
    const partyOption = partySelect.options[partySelect.selectedIndex];
    const partyText = partyOption && partyOption.value ? partyOption.text.split(' (')[0] : '';
    const amount = parseFloat(amountInput.value) || 0;
    const paymentMode = paymentModeSelect.value;

    document.getElementById('summary-type').textContent = voucherType ? voucherType.charAt(0).toUpperCase() + voucherType.slice(1).toLowerCase() : '-';
    document.getElementById('summary-party').textContent = partyText || '-';
    document.getElementById('summary-amount').textContent = amount > 0 ? `₹${amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-';
    document.getElementById('summary-mode').textContent = paymentMode || '-';
  }

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const formData = new FormData(form);
    const voucherData = Object.fromEntries(formData);

    // Validate required fields
    let hasError = false;

    if (!voucherData.party_id) {
      partySelect.classList.add('border-red-500', 'ring-red-200');
      hasError = true;
    }

    if (!voucherData.amount || parseFloat(voucherData.amount) <= 0) {
      amountInput.classList.add('border-red-500', 'ring-red-200');
      hasError = true;
    }

    if (!voucherData.payment_mode) {
      paymentModeSelect.classList.add('border-red-500', 'ring-red-200');
      hasError = true;
    }

    // Check if bank account is required
    const isBankMode = voucherData.payment_mode && !voucherData.payment_mode.toLowerCase().includes('cash');
    if (isBankMode && !voucherData.bank_account_id) {
      bankAccountSelect.classList.add('border-red-500', 'ring-red-200');
      hasError = true;
    }

    if (hasError) {
      showToast('Please correct the highlighted fields', 'error');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Updating...';

      // Make the actual API call to update the voucher
      const response = await fetchWithCSRF(`/api/ledger/vouchers/${voucher.voucher_id}`, {
        method: 'PUT',
        body: JSON.stringify(voucherData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update voucher');
      }

      // Call the update callback if provided
      if (onUpdate) {
        await onUpdate(voucher.voucher_id, voucherData);
      }

      showToast('Voucher updated successfully!');
      setTimeout(() => closeModal(), 1000);

    } catch (error) {
      showToast('Error updating voucher: ' + error.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Update Voucher';
    }
  }

  function closeModal() {
    if (modal._keydownHandler) {
      document.removeEventListener('keydown', modal._keydownHandler);
    }
    modal.remove();
  }

  // Return modal control functions
  return {
    close: closeModal
  };
}
