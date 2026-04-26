/**
 * admin-users-grid.js
 * Served from: /public/tools/admin-users-grid.js
 *
 * CSP contract:
 *   - No inline code (this file is loaded via <script src="...">)
 *   - No external CDN calls
 *   - Communicates with parent via postMessage only
 */

(function () {

  /* ── Status-bar component: Refresh button ── */
  class CustomFooter {
    init() {
      this.eGui = document.createElement('div');
      this.eGui.className = 'admin-footer';
      this.eGui.innerHTML =
        '<button id="refreshBtn" class="refresh-button">' +
          '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
              ' d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9' +
              'm11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>' +
          '</svg>' +
          'Refresh' +
        '</button>';

      this.eGui.querySelector('#refreshBtn').addEventListener('click', function () {
        window.parent.postMessage('IFRAME_READY', '*');
      });
    }
    getGui() { return this.eGui; }
    destroy() {}
  }

  /* ── Cell renderers ── */
  function statusBadge(params) {
    var classMap = {
      approved : 'status-approved',
      pending  : 'status-pending',
      rejected : 'status-rejected',
    };
    var val = (params.value || '').toLowerCase();
    var statusClass = classMap[val] || 'status-badge';
    return '<span class="status-badge ' + statusClass + '">' + (params.value || '-') + '</span>';
  }

  function roleBadge(params) {
    var classMap = {
      super_admin : 'role-super_admin',
      admin       : 'role-admin',
      user        : 'role-user',
    };
    var val = (params.value || '').toLowerCase();
    var roleClass = classMap[val] || 'role-user';
    return '<span class="role-badge ' + roleClass + '">' + (params.value || '-') + '</span>';
  }

  /* ── Column definitions ── */
  var columnDefs = [
    {
      field: 'username',
      headerName: 'Username',
      minWidth: 160,
      filter: 'agTextColumnFilter',
      pinned: 'left',
      cellStyle: { fontWeight: '500', color: '#1e1b4b' }
    },
    {
      field: 'name',
      headerName: 'Full Name',
      minWidth: 180,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
      filter: 'agTextColumnFilter',
      cellRenderer: roleBadge,
      cellStyle: { display: 'flex', alignItems: 'center' }
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      filter: 'agTextColumnFilter',
      cellRenderer: statusBadge,
      cellStyle: { display: 'flex', alignItems: 'center' }
    },
    {
      field: 'firm',
      headerName: 'Assigned Firm',
      minWidth: 200,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'email',
      headerName: 'Email',
      minWidth: 200,
      filter: 'agTextColumnFilter',
      cellStyle: { color: '#6b7280' }
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      filter: 'agDateColumnFilter',
      valueFormatter: function (p) {
        return p.value ? new Date(p.value).toLocaleDateString('en-IN') : '-';
      }
    }
  ];

  /* ── Receive data array from parent and (re-)render grid ── */
  window.addEventListener('message', function (event) {
    var rowData = event.data;
    if (!Array.isArray(rowData)) return;

    if (window.currentGridApi) {
      window.currentGridApi.destroy();
    }

    var eGridDiv = document.getElementById('myGrid');

    window.currentGridApi = agGrid.createGrid(eGridDiv, {
      theme: agGrid.themeQuartz,
      columnDefs: columnDefs,
      rowData: rowData,
      defaultColDef: {
        flex: 1,
        minWidth: 100,
        resizable: true,
        sortable: true,
        filter: true
      },
      animateRows: true,
      pagination: true,
      paginationPageSize: 20,
      paginationPageSizeSelector: [10, 20, 50, 100],
      components: { customFooter: CustomFooter },
      statusBar: {
        statusPanels: [
          { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
          { statusPanel: 'customFooter', align: 'right' }
        ]
      }
    });
  });

  /* ── Signal parent that iframe is ready to receive data ── */
  window.parent.postMessage('IFRAME_READY', '*');

})();