import { toast } from './toast.js';

export class FirmManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.firms = [];
    this.filteredFirms = [];   // FIX: initialize so getCurrentPageFirms() never crashes
    this.currentPage = 1;
    this.pageSize = 10;
    this.totalPages = 1;
    this.searchTerm = '';
    this.sortField = 'createdAt';
    this.sortOrder = 'desc';

    this.init();
  }

  async init() {
    await this.loadFirms();
  }

  async loadFirms() {
    try {
      const response = await fetch('/api/admin/firms', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.firms) throw new Error(data.error || 'Failed to load firms');

      this.firms = data.firms;
      this.applyFilters();
    } catch (error) {
      console.error('Error loading firms:', error);
      toast.error('Failed to load firms: ' + error.message);
    }

    await this.render();
  }

  applyFilters() {
    let filtered = [...this.firms];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(firm =>
        firm.name.toLowerCase().includes(term) ||
        (firm.legal_name && firm.legal_name.toLowerCase().includes(term)) ||
        (firm.city && firm.city.toLowerCase().includes(term)) ||
        (firm.email && firm.email.toLowerCase().includes(term)),
      );
    }

    filtered.sort((a, b) => {
      const aVal = a[this.sortField] ?? '';
      const bVal = b[this.sortField] ?? '';
      return this.sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    this.filteredFirms = filtered;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredFirms.length / this.pageSize);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
  }

  getCurrentPageFirms() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredFirms.slice(start, start + this.pageSize);
  }

  /* ── API CALLS ─────────────────────────────────────────────────────── */

  async createFirm(firmData) {
    try {
      const response = await fetch('/api/admin/firms', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firmData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || 'Firm created successfully');
      await this.loadFirms();
      return true;
    } catch (error) {
      console.error('Error creating firm:', error);
      toast.error('Failed to create firm: ' + error.message);
      return false;
    }
  }

  async updateFirm(id, firmData) {
    try {
      const response = await fetch(`/api/admin/firms/${id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firmData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || 'Firm updated successfully');
      await this.loadFirms();
      return true;
    } catch (error) {
      console.error('Error updating firm:', error);
      toast.error('Failed to update firm: ' + error.message);
      return false;
    }
  }

  /* ── RENDER ────────────────────────────────────────────────────────── */

  async render() {
    if (!this.container) return;

    const approved  = this.firms.filter(f => f.status === 'approved').length;
    const pending   = this.firms.filter(f => f.status === 'pending').length;
    const suspended = this.firms.filter(f => f.status === 'suspended' || f.status === 'rejected').length;

    const statusBadge = (status) => {
      const map = {
        approved:  'bg-emerald-100 text-emerald-800 ring-emerald-200',
        pending:   'bg-amber-100 text-amber-800 ring-amber-200',
        rejected:  'bg-red-100 text-red-800 ring-red-200',
        suspended: 'bg-red-100 text-red-800 ring-red-200',
      };
      return map[status] || 'bg-gray-100 text-gray-700 ring-gray-200';
    };

    this.container.innerHTML = `
      <div class="firm-management space-y-6">

        <!-- Header Row -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 tracking-tight">Firm Management</h2>
            <p class="text-sm text-gray-500 mt-0.5">${this.firms.length} firm${this.firms.length !== 1 ? 's' : ''} registered</p>
          </div>
          <button
            id="create-firm-btn"
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                   text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-none
                   focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            New Firm
          </button>
        </div>

        <!-- Stats Strip -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${[
            { label: 'Total',     value: this.firms.length, color: 'blue'   },
            { label: 'Approved',  value: approved,          color: 'emerald'},
            { label: 'Pending',   value: pending,           color: 'amber'  },
            { label: 'Suspended', value: suspended,         color: 'red'    },
          ].map(s => `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">${s.label}</p>
              <p class="text-2xl font-bold text-${s.color}-600 mt-1">${s.value}</p>
            </div>
          `).join('')}
        </div>

        <!-- Firms Grid -->
        <div class="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden p-4">
          <div id="firm-grid" style="height: 600px"></div>
        </div>

      </div>
    `;

    await this.initGrid();

    this.attachEventListeners();
  }

  async initGrid() {
    if (!window.agGrid) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = '/cdns/ag-grid-enterprise.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    window.firmManager = this;

    const columnDefs = [
      { field: 'name', headerName: 'Name' },
      { field: 'legal_name', headerName: 'Legal Name' },
      { field: 'city', headerName: 'City' },
      { field: 'state', headerName: 'State' },
      { field: 'email', headerName: 'Email' },
      { field: 'phone_number', headerName: 'Phone' },
      { field: 'business_type', headerName: 'Business Type' },
      { field: 'industry_type', headerName: 'Industry' },
      { field: 'employee_count', headerName: 'Employees' },
      { field: 'status', headerName: 'Status' },
      { field: 'createdAt', headerName: 'Created', valueFormatter: params => params.value ? new Date(params.value).toLocaleDateString() : '' },
      { headerName: 'Actions', cellRenderer: (params) => {
        return `<div class="flex gap-1">
          <button data-id="${params.data._id}" data-action="view" class="px-2 py-1 text-xs bg-blue-500 text-white rounded">View</button>
          <button data-id="${params.data._id}" data-action="edit" class="px-2 py-1 text-xs bg-indigo-500 text-white rounded">Edit</button>
          <button data-id="${params.data._id}" data-action="delete" class="px-2 py-1 text-xs bg-red-500 text-white rounded">Delete</button>
        </div>`;
      } }
    ];

    const gridOptions = {
      columnDefs,
      rowData: [],
      defaultColDef: { sortable: true, filter: true, resizable: true },
      pagination: true,
      paginationPageSize: 10,
      paginationPageSizeSelector: [10, 20, 50, 100]
    };

    const gridDiv = document.getElementById('firm-grid');
    this.gridApi = agGrid.createGrid(gridDiv, gridOptions);
    this.gridApi.setGridOption('rowData', this.firms);

    gridDiv.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn && btn.dataset.id) {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'view') this.showFirmDetails(id);
        else if (action === 'edit') this.showEditFirmModal(id);
        else if (action === 'delete') this.deleteFirm(id);
      }
    });
  }

  attachEventListeners() {
    document.getElementById('create-firm-btn')?.addEventListener('click', () => this.showCreateFirmModal());
  }

  showCreateFirmModal() {
    if (window.firmModal) window.firmModal.showCreateMode();
    else console.error('FirmModal not available');
  }

  showEditFirmModal(firmId) {
    if (window.firmModal && firmId) window.firmModal.showEditMode(firmId);
    else console.error('FirmModal not available or missing firm ID');
  }

  showFirmDetails(firmId) {
    if (window.firmDetails && firmId) window.firmDetails.showFirmDetails(firmId);
    else console.error('FirmDetails not available or missing firm ID');
  }
}