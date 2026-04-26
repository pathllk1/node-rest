import { api } from './api.js';

export async function fetchBankAccounts(activeOnly = false) {
  const query = activeOnly ? '?activeOnly=true' : '';
  const response = await api.get(`/api/ledger/bank-accounts${query}`);
  return response?.data || [];
}

export function getBankAccountOptionLabel(account) {
  const parts = [
    account.account_name || account.bank_name || 'Bank Account',
    account.bank_name || null,
    account.account_number ? `A/C ${account.account_number}` : null,
  ].filter(Boolean);
  return parts.join(' • ');
}

export function populateBankAccountSelect(selectEl, accounts, selectedId = '') {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Select Bank Account</option>' +
    accounts.map((account) => `
      <option value="${account._id}" ${String(account._id) === String(selectedId) ? 'selected' : ''}>
        ${getBankAccountOptionLabel(account)}${account.is_default ? ' (Default)' : ''}
      </option>
    `).join('');
}
