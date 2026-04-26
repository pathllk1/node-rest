import { toast } from './toast.js';

export class FirmDetails {
  constructor(containerId) {
    // FIX: containerId may not exist on construction – we resolve it lazily in showFirmDetails
    this._containerId = containerId;
    this.firmId   = null;
    this.firmData = null;
  }

  get container() {
    return document.getElementById(this._containerId);
  }

  async showFirmDetails(firmId) {
    this.firmId   = firmId;
    this.firmData = null;
    await this.loadFirmData();
    this.render();
  }

  async loadFirmData() {
    try {
      const response = await fetch(`/api/admin/firms/${this.firmId}`, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.firm) throw new Error(data.error || 'Failed to load firm data');
      this.firmData = data.firm;
    } catch (error) {
      console.error('Error loading firm details:', error);
      toast.error('Failed to load firm details: ' + error.message);
    }
  }

  render() {
    const el = this.container;
    if (!el) return;

    if (!this.firmData) {
      el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg class="w-14 h-14 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-.98-5.5-2.5"/>
          </svg>
          <p class="text-lg font-semibold text-gray-600">Firm not found</p>
          <button id="back-btn-empty" class="mt-4 text-sm text-blue-600 hover:text-blue-800 underline">← Back to list</button>
        </div>
      `;
      el.querySelector('#back-btn-empty')?.addEventListener('click', () => this._goBack());
      return;
    }

    const f = this.firmData;

    const statusClass = {
      approved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
      pending:  'bg-amber-100  text-amber-800  ring-amber-200',
      rejected: 'bg-red-100    text-red-800    ring-red-200',
    }[f.status] || 'bg-gray-100 text-gray-700 ring-gray-200';

    const field = (label, value) =>
      value ? `<div>
        <dt class="text-xs font-medium text-gray-500 uppercase tracking-wide">${label}</dt>
        <dd class="mt-0.5 text-sm text-gray-900">${value}</dd>
      </div>` : '';

    el.innerHTML = `
      <div class="firm-details space-y-6 max-w-5xl">

        <!-- Top bar -->
        <div class="flex items-center gap-3">
          <button id="back-to-list-btn"
                  class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Firm Management
          </button>
          <span class="text-gray-300">/</span>
          <span class="text-sm text-gray-900 font-medium">${f.name}</span>
        </div>

        <!-- Hero Card -->
        <div class="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600
                          flex items-center justify-center shadow-sm flex-shrink-0">
                <span class="text-white font-black text-2xl">${f.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h1 class="text-2xl font-bold text-gray-900">${f.name}</h1>
                ${f.legal_name ? `<p class="text-sm text-gray-500 mt-0.5">${f.legal_name}</p>` : ''}
                <div class="flex items-center gap-3 mt-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${statusClass}">
                    ${f.status || 'N/A'}
                  </span>
                  ${f.createdAt ? `<span class="text-xs text-gray-400">Created ${new Date(f.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>` : ''}
                </div>
              </div>
            </div>
            <button id="edit-firm-btn"
                    class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit Firm
            </button>
          </div>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <!-- Basic Info -->
          <div class="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
              <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Basic Information
            </h3>
            <dl class="grid grid-cols-1 gap-3">
              ${field('Email', f.email ? `<a href="mailto:${f.email}" class="text-blue-600 hover:underline">${f.email}</a>` : null)}
              ${field('Phone', f.phone_number)}
              ${field('Secondary Phone', f.secondary_phone)}
              ${field('Website', f.website ? `<a href="${f.website}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">${f.website}</a>` : null)}
              ${field('Business Type', f.business_type)}
              ${field('Industry', f.industry_type)}
              ${field('Established', f.establishment_year)}
              ${field('Employees', f.employee_count)}
            </dl>
          </div>

          <!-- Address -->
          <div class="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Address & Location
            </h3>
            <dl class="grid grid-cols-1 gap-3">
              ${field('Street', f.address)}
              ${field('City', f.city)}
              ${field('State', f.state)}
              ${field('Country', f.country)}
              ${field('Pincode', f.pincode)}
            </dl>
          </div>

          <!-- Compliance -->
          <div class="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
              <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              Compliance & Registration
            </h3>
            <dl class="grid grid-cols-1 gap-3">
              ${field('GST Number', f.gst_number)}
              ${field('PAN Number', f.pan_number)}
              ${field('CIN Number', f.cin_number)}
              ${field('Tax ID', f.tax_id)}
              ${field('VAT Number', f.vat_number)}
              ${field('Registration No.', f.registration_number)}
              ${field('Registration Date', f.registration_date)}
            </dl>
          </div>

          <!-- Banking -->
          <div class="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
              Banking & Finance
            </h3>
            <dl class="grid grid-cols-1 gap-3">
              ${field('Bank', f.bank_name)}
              ${field('Account Number', f.bank_account_number)}
              ${field('Branch', f.bank_branch)}
              ${field('IFSC Code', f.ifsc_code)}
              ${field('Payment Terms', f.payment_terms)}
              ${field('Currency', f.currency || 'INR')}
              ${field('Timezone', f.timezone || 'Asia/Kolkata')}
              ${field('Fiscal Year Start', f.fiscal_year_start || 'April')}
              <div>
                <dt class="text-xs font-medium text-gray-500 uppercase tracking-wide">E-Invoicing</dt>
                <dd class="mt-0.5">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                               ${f.enable_e_invoice ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}">
                    ${f.enable_e_invoice ? 'Enabled' : 'Disabled'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

        </div>

        <!-- Templates (conditional) -->
        ${(f.invoice_prefix || f.quote_prefix || f.po_prefix) ? `
          <div class="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
              <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Prefixes & Templates
            </h3>
            <dl class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              ${field('Invoice Prefix', f.invoice_prefix)}
              ${field('Quote Prefix', f.quote_prefix)}
              ${field('PO Prefix', f.po_prefix)}
              ${field('Invoice Template', f.invoice_template)}
            </dl>
          </div>
        ` : ''}

      </div>
    `;

    this.container.querySelector('#edit-firm-btn')?.addEventListener('click', () => {
      if (window.firmModal) window.firmModal.showEditMode(this.firmId);
    });

    this.container.querySelector('#back-to-list-btn')?.addEventListener('click', () => this._goBack());
  }

  _goBack() {
    if (window.firmManager) window.firmManager.render();
  }
}