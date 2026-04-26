import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';

/* ── Helpers ────────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function showToast(message, type = 'success') {
  const existing = document.getElementById('ba-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'ba-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

const EMPTY_FORM = {
  account_name: '',
  account_holder_name: '',
  bank_name: '',
  branch_name: '',
  account_number: '',
  ifsc_code: '',
  account_type: 'CURRENT',
  upi_id: '',
  notes: '',
  is_default: false,
  status: 'ACTIVE',
};

export async function renderBankAccounts(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  await renderPage(router);
}

async function renderPage(router) {
  try {
    const response = await api.get('/api/ledger/bank-accounts');
    const accounts = response?.data || [];

    const content = `
      <div class="max-w-7xl mx-auto px-4 py-10 space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Accounting</p>
            <h1 class="mt-1 text-3xl font-black tracking-tight text-slate-900">Bank Accounts</h1>
            <p class="mt-2 text-sm text-slate-500">Manage firm bank accounts for vouchers and invoice printing. One account stays default for each firm.</p>
          </div>
          <div class="flex gap-3">
            <a href="/accounts-dashboard" data-navigo class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md transition">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
              Dashboard
            </a>
            <button id="create-bank-account-btn" class="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition">
              Add Bank Account
            </button>
          </div>
        </div>

        <div class="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 class="text-sm font-bold text-slate-900">Accounts</h2>
                <p class="text-xs text-slate-400">Firm-scoped bank accounts used in vouchers and invoice footers</p>
              </div>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">${accounts.length} total</span>
            </div>
            <div class="divide-y divide-slate-100">
              ${accounts.length ? accounts.map((account) => `
                <article class="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                  <div class="space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-base font-bold text-slate-900">${esc(account.account_name || '-')}</h3>
                      ${account.is_default ? '<span class="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Default</span>' : ''}
                      <span class="rounded-full ${account.status === 'ACTIVE' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'} px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">${esc(account.status)}</span>
                    </div>
                    <p class="text-sm text-slate-500">${esc(account.bank_name || '-')} ${account.branch_name ? `• ${esc(account.branch_name)}` : ''}</p>
                    <div class="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                      <div>A/C No: <span class="font-semibold text-slate-900">${esc(account.account_number || '-')}</span></div>
                      <div>IFSC: <span class="font-semibold text-slate-900">${esc(account.ifsc_code || '-')}</span></div>
                      <div>Holder: <span class="font-semibold text-slate-900">${esc(account.account_holder_name || '-')}</span></div>
                      <div>Type: <span class="font-semibold text-slate-900">${esc(account.account_type || '-')}</span></div>
                    </div>
                    ${account.upi_id ? `<p class="text-sm text-slate-600">UPI: <span class="font-semibold text-slate-900">${esc(account.upi_id)}</span></p>` : ''}
                    ${account.notes ? `<p class="text-sm text-slate-500">${esc(account.notes)}</p>` : ''}
                  </div>
                  <div class="flex flex-wrap gap-2 lg:justify-end">
                    ${!account.is_default ? `<button class="set-default-btn rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition" data-id="${account._id}">Set Default</button>` : ''}
                    <button class="edit-bank-account-btn rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" data-id="${account._id}">Edit</button>
                    <button class="delete-bank-account-btn rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition" data-id="${account._id}" data-default="${account.is_default ? 'true' : 'false'}">Delete</button>
                  </div>
                </article>
              `).join('') : `
                <div class="px-6 py-16 text-center">
                  <p class="text-sm font-semibold text-slate-700">No bank accounts configured</p>
                  <p class="mt-2 text-sm text-slate-500">Add your first account to use bank-based vouchers and show bank details on invoices.</p>
                </div>
              `}
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-6 py-4">
              <h2 id="bank-account-form-title" class="text-sm font-bold text-slate-900">Create Bank Account</h2>
              <p class="text-xs text-slate-400">All records are automatically restricted to the logged-in user's firm.</p>
            </div>
            <form id="bank-account-form" class="space-y-4 px-6 py-5">
              <input type="hidden" name="id" id="bank-account-id" value="">
              <div class="grid gap-4 md:grid-cols-2">
                <label class="space-y-1.5">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Account Name *</span>
                  <input name="account_name" id="account_name" required class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                </label>
                <label class="space-y-1.5">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Holder Name</span>
                  <input name="account_holder_name" id="account_holder_name" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                </label>
                <label class="space-y-1.5">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Bank Name *</span>
                  <input name="bank_name" id="bank_name" required class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                </label>
                <label class="space-y-1.5">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Branch</span>
                  <input name="branch_name" id="branch_name" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                </label>
                <label class="space-y-1.5">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Account Number *</span>
                  <input name="account_number" id="account_number" required class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                </label>
                <label class="space-y-1.5">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">IFSC *</span>
                  <input name="ifsc_code" id="ifsc_code" required maxlength="11" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                </label>
                <label class="space-y-1.5">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Account Type</span>
                  <select name="account_type" id="account_type" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                    <option value="CURRENT">Current</option>
                    <option value="SAVINGS">Savings</option>
                    <option value="OD">OD</option>
                    <option value="CC">CC</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label class="space-y-1.5">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Status</span>
                  <select name="status" id="status" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
                <label class="space-y-1.5 md:col-span-2">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">UPI ID</span>
                  <input name="upi_id" id="upi_id" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition">
                </label>
                <label class="space-y-1.5 md:col-span-2">
                  <span class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Notes</span>
                  <textarea name="notes" id="notes" rows="3" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition"></textarea>
                </label>
              </div>

              <label class="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
                <input type="checkbox" name="is_default" id="is_default" class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500">
                <span class="text-sm font-medium text-emerald-800">Set as default bank account for this firm</span>
              </label>

              <div id="bank-account-error" class="hidden rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"></div>

              <div class="flex flex-wrap justify-end gap-3 pt-2">
                <button type="button" id="reset-bank-account-form" class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                  Reset
                </button>
                <button type="submit" id="save-bank-account-btn" class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition">
                  Save Bank Account
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    `;

    renderLayout(content, router);
    router.updatePageLinks();
    bindPageEvents(router, accounts);
  } catch (error) {
    renderLayout(`
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-4">
        <h1 class="text-3xl font-black text-slate-900">Bank Accounts</h1>
        <div class="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          Failed to load bank accounts. ${esc(error.message || 'Unknown error')}
        </div>
      </div>
    `, router);
  }
}

function bindPageEvents(router, accounts) {
  const form = document.getElementById('bank-account-form');
  const saveBtn = document.getElementById('save-bank-account-btn');
  const errorEl = document.getElementById('bank-account-error');

  document.getElementById('create-bank-account-btn')?.addEventListener('click', () => resetForm());
  document.getElementById('reset-bank-account-form')?.addEventListener('click', () => resetForm());

  document.querySelectorAll('.edit-bank-account-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const account = accounts.find((item) => String(item._id) === String(btn.dataset.id));
      if (!account) return;
      fillForm(account);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.set-default-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const response = await fetchWithCSRF(`/api/ledger/bank-accounts/${btn.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_default: true, status: 'ACTIVE' }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to set default bank account');
        showToast('Default bank account updated');
        await renderPage(router);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });

  document.querySelectorAll('.delete-bank-account-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmMessage = btn.dataset.default === 'true'
        ? 'This is the default bank account. Delete it and promote another account automatically?'
        : 'Delete this bank account?';
      if (!confirm(confirmMessage)) return;

      try {
        const response = await fetchWithCSRF(`/api/ledger/bank-accounts/${btn.dataset.id}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to delete bank account');
        showToast('Bank account deleted');
        await renderPage(router);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const formData = new FormData(form);
    const id = formData.get('id');
    const payload = {
      account_name: formData.get('account_name'),
      account_holder_name: formData.get('account_holder_name'),
      bank_name: formData.get('bank_name'),
      branch_name: formData.get('branch_name'),
      account_number: formData.get('account_number'),
      ifsc_code: formData.get('ifsc_code'),
      account_type: formData.get('account_type'),
      upi_id: formData.get('upi_id'),
      notes: formData.get('notes'),
      status: formData.get('status'),
      is_default: formData.get('is_default') === 'on',
    };

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = id ? 'Updating...' : 'Saving...';

      const response = await fetchWithCSRF(id ? `/api/ledger/bank-accounts/${id}` : '/api/ledger/bank-accounts', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save bank account');
      showToast(id ? 'Bank account updated' : 'Bank account created');
      await renderPage(router);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Bank Account';
    }
  });

  function fillForm(account) {
    document.getElementById('bank-account-form-title').textContent = 'Edit Bank Account';
    document.getElementById('bank-account-id').value = account._id || '';
    Object.entries({
      account_name: account.account_name || '',
      account_holder_name: account.account_holder_name || '',
      bank_name: account.bank_name || '',
      branch_name: account.branch_name || '',
      account_number: account.account_number || '',
      ifsc_code: account.ifsc_code || '',
      account_type: account.account_type || 'CURRENT',
      upi_id: account.upi_id || '',
      notes: account.notes || '',
      status: account.status || 'ACTIVE',
    }).forEach(([key, value]) => {
      const field = document.getElementById(key);
      if (field) field.value = value;
    });
    document.getElementById('is_default').checked = Boolean(account.is_default);
    saveBtn.textContent = 'Update Bank Account';
  }

  function resetForm() {
    document.getElementById('bank-account-form-title').textContent = 'Create Bank Account';
    document.getElementById('bank-account-id').value = '';
    Object.entries(EMPTY_FORM).forEach(([key, value]) => {
      const field = document.getElementById(key);
      if (!field) return;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else field.value = value;
    });
    saveBtn.textContent = 'Save Bank Account';
    hideError();
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function hideError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
}
