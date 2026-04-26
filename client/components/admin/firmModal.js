import { toast } from './toast.js';

export class FirmModal {
  constructor() {
    this.isOpen  = false;
    this.isEdit  = false;
    this.firmId  = null;
    this.firmData = {};
    this.currentStep = 1;

    this.createModal();
    this.attachEventListeners();
  }

  createModal() {
    // Remove existing modal if any (prevents duplicates on hot-reload)
    document.getElementById('firm-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'firm-modal';
    modal.className = 'fixed inset-0 z-50 overflow-y-auto hidden';
    modal.innerHTML = `
      <!-- Backdrop -->
      <div id="firm-modal-backdrop" class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"></div>

      <!-- Panel wrapper -->
      <div class="flex min-h-screen items-center justify-center p-4">
        <div class="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">

          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                  <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-white" id="firm-modal-title">Create New Firm</h3>
                  <p class="text-sm text-blue-100" id="firm-modal-subtitle">Fill in the details to add a new firm</p>
                </div>
              </div>
              <button id="firm-modal-close"
                      class="rounded-xl p-2 text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Step Indicator (create mode only) -->
          <div id="modal-progress" class="bg-gray-50 border-b border-gray-200 px-6 py-3 hidden">
            <div class="flex items-center gap-2">
              ${[
                { n: 1, label: 'Basic Info' },
                { n: 2, label: 'Business Details' },
                { n: 3, label: 'Admin Account' },
              ].map((s, i) => `
                <div class="flex items-center gap-2 step-item" data-step="${s.n}">
                  <div class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold step-circle-${s.n}
                               ${i === 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'} transition-all">
                    ${s.n}
                  </div>
                  <span class="text-sm font-medium step-label-${s.n}
                               ${i === 0 ? 'text-gray-900' : 'text-gray-400'} transition-colors">${s.label}</span>
                  ${i < 2 ? '<div class="flex-1 h-px bg-gray-300 mx-2 w-8"></div>' : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Form -->
          <form id="firm-form" class="max-h-[65vh] overflow-y-auto">

            <!-- ── STEP 1: Basic Info ── -->
            <div id="basic-info-step" class="p-6 space-y-6">
              <h4 class="text-base font-semibold text-gray-900 flex items-center gap-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
                Basic Information
              </h4>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Firm Name <span class="text-red-500">*</span>
                  </label>
                  <input type="text" name="name" required placeholder="Enter firm name"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>

                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    GST Number
                  </label>
                  <div class="flex gap-2">
                    <input type="text" name="gst_number" placeholder="22AAAAA0000A1Z5"
                           class="form-input flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                  focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                    <button type="button" id="gst-fetch-btn"
                            class="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700
                                   transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      Fetch
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Legal Name</label>
                  <input type="text" name="legal_name" placeholder="Legal entity name"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" name="email" placeholder="contact@firm.com"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                  <input type="tel" name="phone_number" placeholder="+91 98765 43210"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Secondary Phone</label>
                  <input type="tel" name="secondary_phone" placeholder="+91 98765 43210"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
                  <input type="url" name="website" placeholder="https://www.firm.com"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select name="status"
                          class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <!-- Address sub-section -->
              <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h5 class="text-sm font-semibold text-gray-700 mb-3">Address</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="md:col-span-2">
                    <textarea name="address" rows="2" placeholder="Street address"
                              class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"></textarea>
                  </div>
                  <div>
                    <input type="text" name="city" placeholder="City"
                           class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                  focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                  </div>
                  <div>
                    <input type="text" name="state" placeholder="State"
                           class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                  focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                  </div>
                  <div>
                    <input type="text" name="country" placeholder="Country"
                           class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                  focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                  </div>
                  <div>
                    <input type="text" name="pincode" placeholder="PIN / ZIP"
                           class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                  focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── STEP 2: Business Details ── -->
            <div id="business-details-step" class="p-6 space-y-6 hidden">
              <h4 class="text-base font-semibold text-gray-900 flex items-center gap-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">2</span>
                Business Details
              </h4>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Business Type</label>
                  <input type="text" name="business_type" placeholder="e.g. Private Limited, Partnership"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Industry Type</label>
                  <input type="text" name="industry_type" placeholder="e.g. Technology, Manufacturing"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Establishment Year</label>
                  <input type="number" name="establishment_year" placeholder="2020" min="1800" max="2099"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Employee Count</label>
                  <input type="number" name="employee_count" placeholder="50" min="1"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">PAN Number</label>
                  <input type="text" name="pan_number" placeholder="AAAAA0000A"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">CIN Number</label>
                  <input type="text" name="cin_number" placeholder="U74999DL2020PTC123456"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Registration Number</label>
                  <input type="text" name="registration_number" placeholder="REG-XXXXX"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Bank Name</label>
                  <input type="text" name="bank_name" placeholder="State Bank of India"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Bank Account Number</label>
                  <input type="text" name="bank_account_number" placeholder="XXXXXXXXXX"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">IFSC Code</label>
                  <input type="text" name="ifsc_code" placeholder="SBIN0001234"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
                  <select name="currency"
                          class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                    <option value="INR">INR – Indian Rupee</option>
                    <option value="USD">USD – US Dollar</option>
                    <option value="EUR">EUR – Euro</option>
                    <option value="GBP">GBP – British Pound</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                  <select name="timezone"
                          class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Fiscal Year Start</label>
                  <select name="fiscal_year_start"
                          class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                    <option value="April">April (Indian FY)</option>
                    <option value="January">January</option>
                    <option value="July">July</option>
                    <option value="October">October</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Invoice Prefix</label>
                  <input type="text" name="invoice_prefix" placeholder="INV-"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Quote Prefix</label>
                  <input type="text" name="quote_prefix" placeholder="QUO-"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
              </div>

              <!-- E-Invoice Toggle -->
              <div class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Enable E-Invoicing</p>
                  <p class="text-xs text-gray-500 mt-0.5">Activate GST e-invoice generation for this firm</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="enable_e_invoice" class="sr-only peer"/>
                  <div class="w-10 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full
                               peer peer-checked:after:translate-x-full peer-checked:after:border-white
                               after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white
                               after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5
                               after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <!-- ── STEP 3: Admin Account (create mode only) ── -->
            <div id="admin-account-step" class="p-6 space-y-5 hidden">
              <h4 class="text-base font-semibold text-gray-900 flex items-center gap-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">3</span>
                Admin Account
                <span class="text-xs font-normal text-gray-500 ml-1">(optional)</span>
              </h4>
              <p class="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Leave blank to skip creating an admin account. You can assign users to this firm later.
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input type="text" name="admin_fullname" placeholder="John Doe"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                  <input type="text" name="admin_username" placeholder="johndoe"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" name="admin_email" placeholder="admin@firm.com"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <input type="password" name="admin_password" placeholder="Min. 8 characters"
                         class="form-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
                </div>
              </div>
            </div>

          </form>

          <!-- Footer -->
          <div class="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between gap-3">
            <button id="firm-prev-btn"
                    class="hidden items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white
                           border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              ← Back
            </button>
            <div class="flex-1"></div>
            <button id="firm-cancel-btn"
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                           rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button id="firm-next-btn"
                    class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
                           rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:ring-offset-2">
              Next →
            </button>
            <button id="firm-submit-btn"
                    class="hidden px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
                           rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:ring-offset-2">
              Save Firm
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /* ── PUBLIC API ───────────────────────────────────────────────────── */

  showCreateMode() {
    this.isEdit = false;
    this.firmId = null;
    this.firmData = {};
    this.currentStep = 1;

    document.getElementById('firm-modal-title').textContent = 'Create New Firm';
    document.getElementById('firm-modal-subtitle').textContent = 'Fill in the details to add a new firm';
    document.getElementById('modal-progress').classList.remove('hidden');
    document.getElementById('admin-account-step').classList.remove('hidden');

    this._resetForm();
    this._setDefaults();
    this._showStep(1);
    this.open();
  }

  async showEditMode(firmId) {
    this.isEdit = true;
    this.firmId = firmId;
    this.currentStep = 1;

    document.getElementById('firm-modal-title').textContent = 'Edit Firm';
    document.getElementById('firm-modal-subtitle').textContent = 'Update firm details';
    document.getElementById('modal-progress').classList.add('hidden');
    document.getElementById('admin-account-step').classList.add('hidden');

    this._resetForm();
    this.open();

    try {
      const response = await fetch(`/api/admin/firms/${firmId}`, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.firm) throw new Error(data.error || 'Failed to load firm');

      this.firmData = data.firm;
      this._populateForm();

      // In edit mode show all steps at once (no wizard)
      document.getElementById('basic-info-step').classList.remove('hidden');
      document.getElementById('business-details-step').classList.remove('hidden');
      document.getElementById('firm-prev-btn').classList.add('hidden');
      document.getElementById('firm-next-btn').classList.add('hidden');
      document.getElementById('firm-submit-btn').classList.remove('hidden');
      document.getElementById('firm-submit-btn').textContent = 'Update Firm';
    } catch (error) {
      toast.error('Failed to load firm data: ' + error.message);
      this.close();
    }
  }

  open() {
    document.getElementById('firm-modal').classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    this.isOpen = true;
  }

  close() {
    document.getElementById('firm-modal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    this.isOpen = false;
  }

  /* ── PRIVATE HELPERS ──────────────────────────────────────────────── */

  _resetForm() {
    document.getElementById('firm-form').reset();
  }

  _setDefaults() {
    const defaults = { currency: 'INR', timezone: 'Asia/Kolkata', fiscal_year_start: 'April', status: 'approved' };
    const form = document.getElementById('firm-form');
    Object.entries(defaults).forEach(([k, v]) => {
      const el = form.elements[k];
      if (el) el.value = v;
    });
  }

  _getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  _populateForm() {
    const form = document.getElementById('firm-form');
    Object.entries(this.firmData).forEach(([key, value]) => {
      const el = form.elements[key];
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else {
        el.value = value ?? '';
      }
    });
  }

  _showStep(step) {
    this.currentStep = step;
    const steps = ['basic-info-step', 'business-details-step', 'admin-account-step'];

    steps.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', i + 1 !== step);
    });

    this._updateProgress(step);

    const prevBtn   = document.getElementById('firm-prev-btn');
    const nextBtn   = document.getElementById('firm-next-btn');
    const submitBtn = document.getElementById('firm-submit-btn');

    if (step === 1) {
      prevBtn.classList.add('hidden');
      nextBtn.classList.remove('hidden');
      submitBtn.classList.add('hidden');
    } else if (step === 2) {
      prevBtn.classList.remove('hidden');
      nextBtn.classList.remove('hidden');
      submitBtn.classList.add('hidden');
    } else {
      prevBtn.classList.remove('hidden');
      nextBtn.classList.add('hidden');
      submitBtn.classList.remove('hidden');
      submitBtn.textContent = 'Create Firm';
    }
  }

  _updateProgress(activeStep) {
    for (let i = 1; i <= 3; i++) {
      const circle = document.querySelector(`.step-circle-${i}`);
      const label  = document.querySelector(`.step-label-${i}`);
      if (circle) {
        circle.classList.toggle('bg-blue-600', i <= activeStep);
        circle.classList.toggle('text-white',  i <= activeStep);
        circle.classList.toggle('bg-gray-200', i > activeStep);
        circle.classList.toggle('text-gray-500', i > activeStep);
      }
      if (label) {
        label.classList.toggle('text-gray-900', i <= activeStep);
        label.classList.toggle('text-gray-400', i > activeStep);
      }
    }
  }

  _nextStep() {
    if (this.currentStep < 3) this._showStep(this.currentStep + 1);
  }

  _prevStep() {
    if (this.currentStep > 1) this._showStep(this.currentStep - 1);
  }

  /* ── SUBMIT ───────────────────────────────────────────────────────── */

  async _handleSubmit() {
    const form = document.getElementById('firm-form');
    const formData = new FormData(form);
    const firmData = {};

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('admin_')) continue;
      firmData[key] = value || undefined;
    }

    firmData.enable_e_invoice = form.elements.enable_e_invoice?.checked ?? false;

    // Admin account (create mode only)
    if (!this.isEdit) {
      const adminFields = ['admin_fullname', 'admin_username', 'admin_email', 'admin_password'];
      const adminData = {};
      adminFields.forEach(field => {
        const val = form.elements[field]?.value?.trim();
        if (val) adminData[field.replace('admin_', '')] = val;
      });
      if (Object.keys(adminData).length > 0) firmData.admin_account = adminData;
    }

    // Strip empty strings
    Object.keys(firmData).forEach(k => { if (firmData[k] === '') firmData[k] = undefined; });

    const submitBtn = document.getElementById('firm-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const url    = this.isEdit ? `/api/admin/firms/${this.firmId}` : '/api/admin/firms';
      const method = this.isEdit ? 'PUT' : 'POST';

      // Get CSRF token from cookie
      const csrfToken = this._getCookie('csrfToken');
      if (!csrfToken) {
        toast.error('CSRF token missing. Please refresh the page and try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
      }

      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify(firmData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || `Firm ${this.isEdit ? 'updated' : 'created'} successfully`);

      this.close();

      // FIX: call loadFirms which now also re-renders
      if (window.firmManager?.loadFirms) {
        await window.firmManager.loadFirms();
      }
    } catch (error) {
      console.error('Error saving firm:', error);
      toast.error(`Failed to ${this.isEdit ? 'update' : 'create'} firm: ` + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /* ── GST FETCH ───────────────────────────────────────────────────────── */

  async _handleGstFetch() {
    const gstInput = document.querySelector('input[name="gst_number"]');
    const gstin = gstInput?.value?.trim();
    if (!gstin) {
      toast.error('Please enter a GST Number first');
      gstInput?.focus();
      return;
    }

    const fetchBtn = document.getElementById('gst-fetch-btn');
    const originalText = fetchBtn.textContent;
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching…';

    try {
      const response = await fetch(`/api/inventory/sales/lookup-gst?gstin=${encodeURIComponent(gstin)}`, {
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.data) {
        throw new Error('Invalid response from GST lookup service');
      }

      const gstData = data.data;
      this._populateGstFields(gstData);
      toast.success('GST details fetched successfully');
    } catch (error) {
      console.error('GST fetch error:', error);
      toast.error('Failed to fetch GST details: ' + error.message);
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = originalText;
    }
  }

  _populateGstFields(gstData) {
    console.log('Populating GST fields:', gstData);

    // Map GST data to form fields
    const mappings = {
      gstin: 'input[name="gst_number"]',
      legal_name: 'input[name="legal_name"]',
      trade_name: 'input[name="name"]',
      business_constitution: 'input[name="business_type"]',
      nature: 'input[name="industry_type"]',
    };

    // Apply direct mappings
    Object.entries(mappings).forEach(([gstKey, selector]) => {
      if (gstData[gstKey]) {
        const el = document.querySelector(selector);
        if (el) {
          el.value = Array.isArray(gstData[gstKey]) ? gstData[gstKey].join(', ') : gstData[gstKey];
          console.log(`Set ${selector} to ${el.value}`);
        } else {
          console.log(`Element ${selector} not found`);
        }
      }
    });

    // Handle industry type from nature array
    if (gstData.place_of_business_principal && gstData.place_of_business_principal.nature) {
      const natureArray = gstData.place_of_business_principal.nature;
      if (Array.isArray(natureArray) && natureArray.length > 0) {
        const industryEl = document.querySelector('input[name="industry_type"]');
        if (industryEl) {
          industryEl.value = natureArray.join(', ');
          console.log('Set industry_type to:', natureArray.join(', '));
        } else {
          console.log('Industry type element not found');
        }
      }
    }

    // Handle address
    if (gstData.place_of_business_principal && gstData.place_of_business_principal.address) {
      const addr = gstData.place_of_business_principal.address;
      console.log('Address data:', addr);
      const addressParts = [
        addr.door_num,
        addr.street,
        addr.location,
        addr.building_name,
      ].filter(Boolean).join(', ');

      console.log('Address parts:', addressParts);
      if (addressParts) {
        const addrEl = document.querySelector('textarea[name="address"]');
        if (addrEl) {
          addrEl.value = addressParts;
          console.log('Set address to:', addressParts);
        } else {
          console.log('Address element not found');
        }
      }

      // City: use addr.city, or parse from location, or district
      let cityValue = addr.city;
      if (!cityValue && addr.location) {
        const locationParts = addr.location.split(' ');
        cityValue = locationParts[locationParts.length - 1]; // last word, e.g. SILIGURI
      }
      if (!cityValue && addr.district) {
        cityValue = addr.district;
      }
      console.log('City value:', cityValue);
      if (cityValue) {
        const cityEl = document.querySelector('input[name="city"]');
        if (cityEl) {
          cityEl.value = cityValue;
          console.log('Set city to:', cityValue);
        } else {
          console.log('City element not found');
        }
      }

      if (addr.state) {
        const stateEl = document.querySelector('input[name="state"]');
        if (stateEl) {
          stateEl.value = addr.state;
          console.log('Set state to:', addr.state);
        } else {
          console.log('State element not found');
        }
      }

      if (addr.pin_code) {
        const pinEl = document.querySelector('input[name="pincode"]');
        if (pinEl) {
          pinEl.value = addr.pin_code;
          console.log('Set pincode to:', addr.pin_code);
        } else {
          console.log('Pincode element not found');
        }
      }
    }

    // Registration date to establishment year
    if (gstData.registration_date) {
      const regDate = new Date(gstData.registration_date);
      if (!isNaN(regDate.getTime())) {
        const yearEl = document.querySelector('input[name="establishment_year"]');
        if (yearEl) {
          yearEl.value = regDate.getFullYear();
          console.log('Set establishment_year to:', regDate.getFullYear());
        } else {
          console.log('Establishment year element not found');
        }
      }
    }

    // Status (if Active, set to approved)
    if (gstData.status === 'Active') {
      const statusEl = document.querySelector('select[name="status"]');
      if (statusEl) {
        statusEl.value = 'approved';
        console.log('Set status to approved');
      } else {
        console.log('Status element not found');
      }
    }

    // Extract PAN from GST number
    if (gstData.gstin && typeof gstData.gstin === 'string' && gstData.gstin.length === 15) {
      const pan = gstData.gstin.substring(2, 12);
      const panEl = document.querySelector('input[name="pan_number"]');
      if (panEl) {
        panEl.value = pan;
        console.log('Set pan_number to:', pan);
      } else {
        console.log('PAN element not found');
      }
    }
  }

  /* ── EVENT LISTENERS ──────────────────────────────────────────────── */

  attachEventListeners() {
    const modal = document.getElementById('firm-modal');

    modal.addEventListener('click', (e) => {
      const id = e.target.id || e.target.closest('button')?.id;
      if (!id) return;

      if (id === 'firm-modal-close' || id === 'firm-cancel-btn') this.close();
      else if (id === 'firm-next-btn')   this._nextStep();
      else if (id === 'firm-prev-btn')   this._prevStep();
      else if (id === 'firm-submit-btn') this._handleSubmit();
      else if (id === 'gst-fetch-btn')   this._handleGstFetch();
    });

    // Close on backdrop click
    document.getElementById('firm-modal-backdrop')?.addEventListener('click', () => this.close());

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }
}