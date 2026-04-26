import { toast } from './toast.js';

export class UserFirmAssignment {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.users = [];
    this.firms = [];
    this.filteredUsers = [];
    this.searchTerm = '';
    this.selectedFirmFilter = '';

    this.init();
  }

  async init() {
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      const [usersRes, firmsRes] = await Promise.all([
        fetch('/api/admin/users-with-firms', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
        fetch('/api/admin/firms',             { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
      ]);

      if (!usersRes.ok || !firmsRes.ok) throw new Error('Failed to load data');

      const [usersData, firmsData] = await Promise.all([usersRes.json(), firmsRes.json()]);

      this.users = usersData.users || [];
      this.firms = firmsData.firms || [];
      this.applyFilters();
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load user and firm data: ' + error.message);
    }
  }

  applyFilters() {
    let filtered = [...this.users];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.fullname.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term),
      );
    }

    if (this.selectedFirmFilter === 'unassigned') {
      filtered = filtered.filter(u => !u.firm_id);
    } else if (this.selectedFirmFilter) {
      filtered = filtered.filter(u => String(u.firm_id) === this.selectedFirmFilter);
    }

    this.filteredUsers = filtered;
  }

  async assignUserToFirm(userId, firmId) {
    try {
      const response = await fetch('/api/admin/assign-user-to-firm', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, firmId }),   // firmId can be null to unassign
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || 'Assignment updated successfully');

      await this.loadData();
      await this.render();
    } catch (error) {
      console.error('Error assigning user to firm:', error);
      toast.error('Failed to update assignment: ' + error.message);
    }
  }

  /* ── RENDER ─────────────────────────────────────────────────────── */

  async render() {
    if (!this.container) return;

    const assigned   = this.users.filter(u => u.firm_id).length;
    const unassigned = this.users.filter(u => !u.firm_id).length;

    const roleBadge = (role) => {
      const map = {
        super_admin: 'bg-purple-100 text-purple-800',
        admin:       'bg-blue-100   text-blue-800',
        manager:     'bg-indigo-100 text-indigo-800',
        user:        'bg-gray-100   text-gray-700',
      };
      return map[role] || 'bg-gray-100 text-gray-700';
    };

    this.container.innerHTML = `
      <div class="user-firm-assignment space-y-6">

        <!-- Header -->
        <div>
          <h2 class="text-2xl font-bold text-gray-900 tracking-tight">User–Firm Assignment</h2>
          <p class="text-sm text-gray-500 mt-0.5">Assign or reassign users to firms</p>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-3">
          ${[
            { label: 'Total Users',  value: this.users.length, color: 'blue'   },
            { label: 'Assigned',     value: assigned,          color: 'emerald'},
            { label: 'Unassigned',   value: unassigned,        color: 'amber'  },
          ].map(s => `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">${s.label}</p>
              <p class="text-2xl font-bold text-${s.color}-600 mt-1">${s.value}</p>
            </div>
          `).join('')}
        </div>

        <!-- Filters -->
        <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
            </svg>
            <input id="user-search" type="text"
                   placeholder="Search by name, username, or email…"
                   value="${this.searchTerm}"
                   class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                          focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
          </div>
          <select id="firm-filter"
                  class="text-sm border border-gray-300 rounded-lg px-3 py-2
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
            <option value="">All Users</option>
            <option value="unassigned" ${this.selectedFirmFilter === 'unassigned' ? 'selected' : ''}>Unassigned Only</option>
            ${this.firms.map(f => `
              <option value="${f._id}" ${this.selectedFirmFilter === String(f._id) ? 'selected' : ''}>${f.name}</option>
            `).join('')}
          </select>
        </div>

        <!-- Users Grid -->
        <div class="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden p-4">
          <div id="user-grid" style="height: 600px"></div>
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

    window.userFirmAssignment = this;
    const firms = this.firms;

    const columnDefs = [
      { field: 'fullname', headerName: 'Full Name' },
      { field: 'username', headerName: 'Username' },
      { field: 'email', headerName: 'Email' },
      { field: 'role', headerName: 'Role' },
      { field: 'firm_name', headerName: 'Firm' },
      { headerName: 'Assign', cellRenderer: (params) => {
        return `<select data-user-id="${params.data._id}" class="text-sm border rounded px-2 py-1">
          <option value="">— Select —</option>
          <option value="unassign">Remove from Firm</option>
          ${firms.map(f => `<option value="${f._id}" ${String(params.data.firm_id) === String(f._id) ? 'selected' : ''}>${f.name}</option>`).join('')}
        </select>`;
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

    const gridDiv = document.getElementById('user-grid');
    this.gridApi = agGrid.createGrid(gridDiv, gridOptions);
    this.gridApi.setGridOption('rowData', this.users);

    gridDiv.addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT' && e.target.dataset.userId) {
        const userId = e.target.dataset.userId;
        const firmId = e.target.value === 'unassign' ? null : e.target.value;
        this.assignUserToFirm(userId, firmId);
      }
    });
  }

  /* ── EVENT LISTENERS ────────────────────────────────────────────── */

  attachEventListeners() {
    document.getElementById('user-search')?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value;
      this.applyFilters();
      this.gridApi.setGridOption('rowData', this.filteredUsers);
    });

    document.getElementById('firm-filter')?.addEventListener('change', (e) => {
      this.selectedFirmFilter = e.target.value;
      this.applyFilters();
      this.gridApi.setGridOption('rowData', this.filteredUsers);
    });

    window.addEventListener('message', (e) => {
      if (e.data.type === 'setData') {
        this.gridApi.setGridOption('rowData', e.data.users);
        this.firms.length = 0;
        this.firms.push(...e.data.firms);
      }
    });
  }
}