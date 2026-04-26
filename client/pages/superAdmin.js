import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authManager } from '../utils/auth.js';
import { fetchWithCSRF } from '../utils/api.js';

export async function renderSuperAdmin(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user = authManager.getUser();

  if (user.role !== 'super_admin') {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Super Admin Panel</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl text-sm">
          Access denied. Super admin privileges required.
        </div>
      </div>
    `;
    renderLayout(content, router);
    return;
  }

  const content = `
    <div class="w-full px-3 pt-3 pb-0 space-y-2">

      <!--
        Compact top bar: title left, stat pills right.
        Replaces the old 3-block layout (title + section label + 5 tall cards)
        that consumed ~388px before the iframe even started.
        Total height here: ~44px.
      -->
      <div class="flex items-center justify-between gap-3 flex-wrap">

        <!-- Left: page identity -->
        <div class="flex items-center gap-2 min-w-0">
          <h1 class="text-base font-bold text-gray-900 tracking-tight whitespace-nowrap">Super Admin</h1>
          <span class="text-gray-300 text-sm hidden sm:inline">|</span>
          <p class="text-xs text-gray-400 hidden sm:block truncate">Manage firms, users &amp; system</p>
        </div>

        <!-- Right: inline stat pills -->
        <div id="super-admin-stats" class="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span class="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
            <span id="user-count">-</span> Users
          </span>
          <span class="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm8 8v2h1v1H4v-1h1v-2a1 1 0 011-1h8a1 1 0 011 1z" clip-rule="evenodd"/></svg>
            <span id="firm-count">-</span> Firms
          </span>
          <span class="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            <span id="approved-users">-</span> Approved
          </span>
          <span class="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
            <span id="pending-users">-</span> Pending
          </span>
          <span class="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-500 rounded-full border border-red-100">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
            <span id="rejected-users">-</span> Rejected
          </span>
        </div>

      </div>

      <div class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

        <!-- Tabs -->
        <div class="border-b border-gray-200 bg-gray-50">
          <nav class="flex px-1 overflow-x-auto">

            <button id="firms-tab"
              class="admin-tab px-5 py-3 text-sm font-semibold border-b-2 border-blue-500 text-blue-600 whitespace-nowrap">
              All Firms
            </button>

            <button id="users-tab"
              class="admin-tab px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap">
              All Users
            </button>

            <button id="assignment-tab"
              class="admin-tab px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap">
              User Assignment
            </button>

            <button id="passwords-tab"
              class="admin-tab px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap">
              Update Passwords
            </button>

            <button id="database-tab"
              class="admin-tab px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap">
              Database
            </button>

          </nav>
        </div>

        <!-- Tab Content -->
        <div>

          <!-- Tab 1: All Firms iframe -->
          <div id="firms-content" class="admin-content">
            <div id="firms-loader" class="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <svg class="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span class="text-sm font-medium">Loading firms...</span>
            </div>
            <iframe
              id="firms-iframe"
              class="admin-iframe hidden">
            </iframe>
          </div>

          <!-- Tab 2: All Users iframe -->
          <div id="users-content" class="admin-content hidden">
            <div id="users-loader" class="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <svg class="w-8 h-8 animate-spin text-teal-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span class="text-sm font-medium">Loading users...</span>
            </div>
            <iframe
              id="users-iframe"
              class="admin-iframe hidden">
            </iframe>
          </div>

          <!-- Tab 3: User Assignment iframe -->
          <div id="assignment-content" class="admin-content hidden">
            <div id="assignment-loader" class="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <svg class="w-8 h-8 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span class="text-sm font-medium">Loading user assignment…</span>
            </div>
            <iframe
              id="assignment-iframe"
              class="admin-iframe hidden">
            </iframe>
          </div>

          <!-- Tab 4: Password Management iframe -->
          <div id="passwords-content" class="admin-content hidden">
            <div id="passwords-loader" class="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <svg class="w-8 h-8 animate-spin text-red-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span class="text-sm font-medium">Loading password manager…</span>
            </div>
            <iframe
              id="passwords-iframe"
              class="admin-iframe hidden">
            </iframe>
          </div>

          <!-- Tab 5: Database Browser iframe -->
          <div id="database-content" class="admin-content hidden">
            <div id="database-loader" class="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <svg class="w-8 h-8 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span class="text-sm font-medium">Loading database browser…</span>
            </div>
            <iframe
              id="database-iframe"
              class="admin-iframe hidden">
            </iframe>
          </div>

        </div>
      </div>
    </div>
  `;

  renderLayout(content, router);

  fetch('/api/admin/super-admin/stats', { credentials: 'same-origin' })
    .then(res => res.json())
    .then(data => {
      document.getElementById('user-count').textContent     = data.userCount     || 0;
      document.getElementById('firm-count').textContent     = data.firmCount     || 0;
      document.getElementById('approved-users').textContent = data.approvedUsers || 0;
      document.getElementById('pending-users').textContent  = data.pendingUsers  || 0;
      document.getElementById('rejected-users').textContent = data.rejectedUsers || 0;
    })
    .catch(err => console.error('Stats fetch failed:', err));

  setupAdminTabs();
}



/* ════════════════════════════════════════════════════════════════
   FIRMS IFRAME LOADER — Tab 1, EAGER
   Handles full CRUD: Create, Update, Delete via postMessage.
   Zero API calls inside the iframe — all originate here.
   event.source check ensures messages are from the firms iframe only.
════════════════════════════════════════════════════════════════ */
function loadFirmsIframe() {
  const iframe = document.getElementById('firms-iframe');
  const loader = document.getElementById('firms-loader');

  /* Fetch all firms and push to iframe */
  async function fetchAndPushFirms() {
    try {
      const res  = await fetch('/api/admin/super-admin/firms', { credentials: 'same-origin' });
      const data = await res.json();
      iframe.contentWindow.postMessage({ type: 'FIRMS_DATA', firms: data.firms || [] }, '*');
    } catch (err) {
      console.error('Failed to fetch firms:', err);
      iframe.contentWindow.postMessage({ type: 'CRUD_ERROR', op: 'fetch', error: 'Failed to load firms' }, '*');
    }
  }

  /* Handle all messages from the firms iframe */
  window.addEventListener('message', async function firmsHandler(event) {
    if (event.source !== iframe.contentWindow) return;

    const msg = event.data;

    /* ── IFRAME_READY: initial data push ── */
    if (msg === 'IFRAME_READY') {
      fetchAndPushFirms();
      return;
    }

    if (!msg || !msg.type) return;

    /* ── CREATE FIRM ── */
    if (msg.type === 'CREATE_FIRM') {
      try {
        const res  = await fetchWithCSRF('/api/admin/firms', { method: 'POST', body: JSON.stringify(msg.data) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Create failed');

        iframe.contentWindow.postMessage({ type: 'CRUD_SUCCESS', op: 'create', message: data.message }, '*');
        await fetchAndPushFirms();

        // Refresh stats
        refreshStats();
      } catch (err) {
        iframe.contentWindow.postMessage({ type: 'CRUD_ERROR', op: 'create', error: err.message }, '*');
      }
      return;
    }

    /* ── UPDATE FIRM ── */
    if (msg.type === 'UPDATE_FIRM') {
      try {
        const res  = await fetchWithCSRF(`/api/admin/firms/${msg.firmId}`, { method: 'PUT', body: JSON.stringify(msg.data) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');

        iframe.contentWindow.postMessage({ type: 'CRUD_SUCCESS', op: 'update', message: data.message }, '*');
        await fetchAndPushFirms();
      } catch (err) {
        iframe.contentWindow.postMessage({ type: 'CRUD_ERROR', op: 'update', error: err.message }, '*');
      }
      return;
    }

    /* ── DELETE FIRM ── */
    if (msg.type === 'DELETE_FIRM') {
      try {
        const res  = await fetchWithCSRF(`/api/admin/firms/${msg.firmId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');

        iframe.contentWindow.postMessage({ type: 'CRUD_SUCCESS', op: 'delete', message: data.message }, '*');
        await fetchAndPushFirms();

        // Refresh stats
        refreshStats();
      } catch (err) {
        iframe.contentWindow.postMessage({ type: 'CRUD_ERROR', op: 'delete', error: err.message }, '*');
      }
      return;
    }

    /* ── FETCH GST ────────────────────────────────────────────────────────
     * Iframe sends { type: 'FETCH_GST', gstin: '...' }.
     * Parent calls the lookup API (same-origin, authenticated).
     * Result sent back as { type: 'GST_DATA', data: {...} }
     *                   or { type: 'GST_ERROR', error: '...' }.
     * Zero network calls inside the iframe — strict enforcement.
     * ─────────────────────────────────────────────────────────────────── */
    if (msg.type === 'FETCH_GST') {
      if (!msg.gstin || !msg.gstin.trim()) {
        iframe.contentWindow.postMessage({ type: 'GST_ERROR', error: 'Please enter a GST number first.' }, '*');
        return;
      }
      try {
        const res  = await fetch(
          `/api/inventory/sales/lookup-gst?gstin=${encodeURIComponent(msg.gstin.trim())}`,
          { credentials: 'same-origin' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!data.success || !data.data) throw new Error('Invalid response from GST lookup service');

        iframe.contentWindow.postMessage({ type: 'GST_DATA', data: data.data }, '*');
      } catch (err) {
        iframe.contentWindow.postMessage({ type: 'GST_ERROR', error: err.message }, '*');
      }
      return;
    }
  });

  iframe.onload = function () {
    loader.classList.add('hidden');
    iframe.classList.remove('hidden');
  };

  iframe.onerror = function () {
    loader.innerHTML = '<p class="text-red-500 text-sm">Failed to load firms panel.</p>';
  };

  iframe.src = '/iframes/firms.html';
}

/* ════════════════════════════════════════════════════════════════
   USERS IFRAME LOADER — Tab 2, LAZY
   Handles Update Role and Update Status via postMessage.
   Zero API calls inside the iframe.
════════════════════════════════════════════════════════════════ */
function loadUsersIframe() {
  const iframe = document.getElementById('users-iframe');
  const loader = document.getElementById('users-loader');

  /* Fetch all users and push to iframe */
  async function fetchAndPushUsers() {
    try {
      const res  = await fetch('/api/admin/super-admin/users', { credentials: 'same-origin' });
      const data = await res.json();
      iframe.contentWindow.postMessage({ type: 'USERS_DATA', users: data.users || [] }, '*');
    } catch (err) {
      console.error('Failed to fetch users:', err);
      iframe.contentWindow.postMessage({ type: 'CRUD_ERROR', op: 'fetch', error: 'Failed to load users' }, '*');
    }
  }

  /* Handle all messages from the users iframe */
  window.addEventListener('message', async function usersHandler(event) {
    if (event.source !== iframe.contentWindow) return;

    const msg = event.data;

    /* ── IFRAME_READY: initial data push ── */
    if (msg === 'IFRAME_READY') {
      fetchAndPushUsers();
      return;
    }

    if (!msg || !msg.type) return;

    /* ── UPDATE USER ROLE ── */
    if (msg.type === 'UPDATE_USER_ROLE') {
      try {
        const res  = await fetchWithCSRF('/api/admin/super-admin/users/role', {
          method: 'PUT',
          body:   JSON.stringify({ userId: msg.userId, newRole: msg.newRole }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Role update failed');

        iframe.contentWindow.postMessage({ type: 'CRUD_SUCCESS', op: 'update_role', message: data.message }, '*');
        await fetchAndPushUsers();
      } catch (err) {
        iframe.contentWindow.postMessage({ type: 'CRUD_ERROR', op: 'update_role', error: err.message }, '*');
      }
      return;
    }

    /* ── UPDATE USER STATUS ── */
    if (msg.type === 'UPDATE_USER_STATUS') {
      try {
        const res  = await fetchWithCSRF(`/api/admin/users/${msg.userId}/status`, {
          method: 'PATCH',
          body:   JSON.stringify({ status: msg.newStatus }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Status update failed');

        iframe.contentWindow.postMessage({ type: 'CRUD_SUCCESS', op: 'update_status', message: data.message }, '*');
        await fetchAndPushUsers();

        // Refresh stats (status changes affect approved/pending/rejected counts)
        refreshStats();
      } catch (err) {
        iframe.contentWindow.postMessage({ type: 'CRUD_ERROR', op: 'update_status', error: err.message }, '*');
      }
      return;
    }
  });

  iframe.onload = function () {
    loader.classList.add('hidden');
    iframe.classList.remove('hidden');
  };

  iframe.onerror = function () {
    loader.innerHTML = '<p class="text-red-500 text-sm">Failed to load users panel.</p>';
  };

  iframe.src = '/iframes/users.html';
}

/* ════════════════════════════════════════════════════════════════
   USER ASSIGNMENT IFRAME LOADER — Tab 3, LAZY
   Handles User-to-Firm assignment via postMessage.
   Zero API calls inside the iframe — all originate here.
   Parent manages all fetching and assignment operations.
════════════════════════════════════════════════════════════════ */
function loadAssignmentIframe() {
  const iframe = document.getElementById('assignment-iframe');
  const loader = document.getElementById('assignment-loader');

  /* Fetch users with firms and all firms, then push to iframe */
  async function fetchAndPushData() {
    try {
      const [usersRes, firmsRes] = await Promise.all([
        fetch('/api/admin/users-with-firms', { credentials: 'same-origin' }),
        fetch('/api/admin/firms', { credentials: 'same-origin' }),
      ]);

      if (!usersRes.ok || !firmsRes.ok) {
        throw new Error('Failed to fetch user and firm data');
      }

      const [usersData, firmsData] = await Promise.all([usersRes.json(), firmsRes.json()]);

      iframe.contentWindow.postMessage(
        {
          type: 'RECEIVE_DATA',
          users: usersData.users || [],
          firms: firmsData.firms || [],
        },
        '*'
      );
    } catch (err) {
      console.error('Failed to fetch user assignment data:', err);
      iframe.contentWindow.postMessage(
        {
          type: 'DATA_ERROR',
          error: 'Failed to load user and firm data',
        },
        '*'
      );
    }
  }

  /* Handle all messages from the assignment iframe */
  window.addEventListener('message', async function assignmentHandler(event) {
    if (event.source !== iframe.contentWindow) return;

    const msg = event.data;

    /* ── IFRAME_READY: initial data push ── */
    if (msg === 'IFRAME_READY') {
      fetchAndPushData();
      return;
    }

    if (!msg || !msg.type) return;

    /* ── ASSIGN_USER_TO_FIRM ────────────────────────────────────────
     * Iframe sends { type: 'ASSIGN_USER_TO_FIRM', userId: '...', firmId: '...' or null }
     * Parent calls the assignment API (same-origin, authenticated).
     * Result sent back as { type: 'ASSIGNMENT_SUCCESS', message: '...' }
     *                   or { type: 'ASSIGNMENT_ERROR', error: '...' }
     * Then parent sends { type: 'REFRESH_DATA', users: [...], firms: [...] }
     * Zero network calls inside the iframe — strict enforcement.
     * ───────────────────────────────────────────────────────────── */
    if (msg.type === 'ASSIGN_USER_TO_FIRM') {
      try {
        const res = await fetchWithCSRF('/api/admin/assign-user-to-firm', {
          method: 'POST',
          body: JSON.stringify({ userId: msg.userId, firmId: msg.firmId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        /* Send success message to iframe */
        iframe.contentWindow.postMessage(
          {
            type: 'ASSIGNMENT_SUCCESS',
            message: data.message || 'Assignment updated successfully',
          },
          '*'
        );

        /* Fetch refreshed data and send to iframe */
        await fetchAndPushData();

        /* Refresh top-level stats if assignment affected approved/pending/rejected counts */
        refreshStats();
      } catch (err) {
        iframe.contentWindow.postMessage(
          {
            type: 'ASSIGNMENT_ERROR',
            error: err.message,
          },
          '*'
        );
      }
      return;
    }
  });

  iframe.onload = function () {
    loader.classList.add('hidden');
    iframe.classList.remove('hidden');
  };

  iframe.onerror = function () {
    loader.innerHTML = '<p class="text-red-500 text-sm">Failed to load user assignment panel.</p>';
  };

  iframe.src = '/iframes/user-firm-assignment.html';
}

/* ════════════════════════════════════════════════════════════════
   PASSWORD MANAGER IFRAME LOADER — Tab 4, LAZY
   Handles User password updates via postMessage.
   Zero API calls inside the iframe — all originate here.
════════════════════════════════════════════════════════════════ */
function loadPasswordManagerIframe() {
  const iframe = document.getElementById('passwords-iframe');
  const loader = document.getElementById('passwords-loader');

  /* Fetch users for password update and audit stats, then push to iframe */
  async function fetchAndPushData() {
    try {
      const [usersRes, auditRes] = await Promise.all([
        fetch('/api/admin/super-admin/users/for-password-update', { credentials: 'same-origin' }),
        fetch('/api/admin/super-admin/password-audit-log?page=1', { credentials: 'same-origin' }),
      ]);

      if (!usersRes.ok || !auditRes.ok) {
        throw new Error('Failed to fetch password management data');
      }

      const [usersData, auditData] = await Promise.all([usersRes.json(), auditRes.json()]);

      // Calculate stats from audit log
      const auditLogs = auditData.logs || [];
      const auditStats = {
        totalUsers: usersData.users?.length || 0,
        successfulChanges: auditLogs.filter(log => log.status === 'success').length,
        failedAttempts: auditLogs.filter(log => log.status === 'failed').length,
      };

      iframe.contentWindow.postMessage(
        {
          type: 'RECEIVE_DATA',
          users: usersData.users || [],
          auditStats,
        },
        '*'
      );
    } catch (err) {
      console.error('Failed to fetch password management data:', err);
      iframe.contentWindow.postMessage(
        {
          type: 'DATA_ERROR',
          error: 'Failed to load password management data',
        },
        '*'
      );
    }
  }

  /* Handle all messages from the password manager iframe */
  window.addEventListener('message', async function passwordHandler(event) {
    if (event.source !== iframe.contentWindow) return;

    const msg = event.data;

    /* ── IFRAME_READY_PASSWORD: initial data push ── */
    if (msg === 'IFRAME_READY_PASSWORD') {
      fetchAndPushData();
      return;
    }

    if (!msg || !msg.type) return;

    /* ── UPDATE_USER_PASSWORD ──────────────────────────────────────
     * Iframe sends { type: 'UPDATE_USER_PASSWORD', userId: '...', newPassword: '...' }
     * Parent calls the password update API (same-origin, authenticated).
     * Result sent back as { type: 'UPDATE_SUCCESS', message: '...' }
     *                   or { type: 'UPDATE_ERROR', error: '...' }
     * Then parent sends { type: 'REFRESH_DATA', users: [...], auditStats: {...} }
     * Zero network calls inside the iframe — strict enforcement.
     * ────────────────────────────────────────────────────────────── */
    if (msg.type === 'UPDATE_USER_PASSWORD') {
      try {
        const res = await fetchWithCSRF('/api/admin/super-admin/users/update-password', {
          method: 'POST',
          body: JSON.stringify({ userId: msg.userId, newPassword: msg.newPassword }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        /* Send success message to iframe */
        iframe.contentWindow.postMessage(
          {
            type: 'UPDATE_SUCCESS',
            message: data.message || 'Password updated successfully',
          },
          '*'
        );

        /* Fetch refreshed data and send to iframe */
        await fetchAndPushData();

        /* Refresh top-level stats */
        refreshStats();
      } catch (err) {
        iframe.contentWindow.postMessage(
          {
            type: 'UPDATE_ERROR',
            error: err.message,
          },
          '*'
        );
      }
      return;
    }
  });

  iframe.onload = function () {
    loader.classList.add('hidden');
    iframe.classList.remove('hidden');
  };

  iframe.onerror = function () {
    loader.innerHTML = '<p class="text-red-500 text-sm">Failed to load password manager panel.</p>';
  };

  iframe.src = '/iframes/password-manager.html';
}

/* ════════════════════════════════════════════════════════════════
   STATS REFRESH — called after any CRUD that changes counts
════════════════════════════════════════════════════════════════ */
function refreshStats() {
  fetch('/api/admin/super-admin/stats', { credentials: 'same-origin' })
    .then(res => res.json())
    .then(data => {
      document.getElementById('user-count').textContent     = data.userCount     || 0;
      document.getElementById('firm-count').textContent     = data.firmCount     || 0;
      document.getElementById('approved-users').textContent = data.approvedUsers || 0;
      document.getElementById('pending-users').textContent  = data.pendingUsers  || 0;
      document.getElementById('rejected-users').textContent = data.rejectedUsers || 0;
    })
    .catch(() => {});
}

/* ════════════════════════════════════════════════════════════════
   DATABASE IFRAME LOADER — Tab 5, LAZY LOAD
   Handles database collection browsing, filtering, export
   Zero API calls inside iframe — all requests originate from parent
════════════════════════════════════════════════════════════════ */
function loadDatabaseIframe() {
  const iframe = document.getElementById('database-iframe');
  const loader = document.getElementById('database-loader');

  /* Fetch collections on demand */
  async function fetchCollections() {
    try {
      const res = await fetch('/api/admin/database/collections', { credentials: 'same-origin' });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch collections');
      }

      iframe.contentWindow.postMessage({
        type: 'COLLECTIONS_DATA',
        collections: data.collections || []
      }, '*');
    } catch (err) {
      console.error('Failed to fetch collections:', err);
      iframe.contentWindow.postMessage({
        type: 'COLLECTIONS_DATA',
        error: err.message
      }, '*');
    }
  }

  async function fetchBackupStatus() {
    try {
      const res = await fetch('/api/admin/database/backup/status', { credentials: 'same-origin' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch backup status');
      }

      iframe.contentWindow.postMessage({
        type: 'BACKUP_STATUS',
        configured: Boolean(data.configured),
        provider: data.provider || 'Infini-Cloud WebDAV',
        directory: data.directory || '/',
        format: data.format || 'json.gz',
      }, '*');
    } catch (err) {
      iframe.contentWindow.postMessage({
        type: 'BACKUP_STATUS',
        configured: false,
        error: err.message,
      }, '*');
    }
  }

  /* Fetch collection data on demand */
  async function fetchCollectionData(collection, filter = 'all', search = '', limit = 50, skip = 0) {
    try {
      const params = new URLSearchParams({
        filter,
        search,
        limit: limit.toString(),
        skip: skip.toString(),
        sort: '_id',
        order: 'asc'
      });

      const res = await fetch(
        `/api/admin/database/${collection}?${params.toString()}`,
        { credentials: 'same-origin' }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch collection data');
      }

      iframe.contentWindow.postMessage({
        type: 'COLLECTION_DATA',
        data: data.data || [],
        total: data.total || 0,
        limit: data.limit || 50,
        hasMore: data.hasMore || false
      }, '*');
    } catch (err) {
      console.error('Failed to fetch collection data:', err);
      iframe.contentWindow.postMessage({
        type: 'COLLECTION_DATA',
        error: err.message
      }, '*');
    }
  }

  /* Handle all messages from the database iframe */
  window.addEventListener('message', async function databaseHandler(event) {
    if (event.source !== iframe.contentWindow) return;

    const msg = event.data;

    /* IFRAME_READY: initial collections push */
    if (msg.type === 'IFRAME_READY') {
      fetchCollections();
      fetchBackupStatus();
      return;
    }

    if (!msg || !msg.type) return;

    /* GET_COLLECTIONS request */
    if (msg.type === 'GET_COLLECTIONS') {
      fetchCollections();
      return;
    }

    if (msg.type === 'GET_BACKUP_STATUS') {
      fetchBackupStatus();
      return;
    }

    /* GET_COLLECTION_DATA request */
    if (msg.type === 'GET_COLLECTION_DATA') {
      const { collection, filter = 'all', search = '', limit = 50, skip = 0 } = msg;
      fetchCollectionData(collection, filter, search, limit, skip);
      return;
    }

    /* BACKUP_DATABASE request */
    if (msg.type === 'BACKUP_DATABASE') {
      try {
        const res = await fetchWithCSRF('/api/admin/database/backup', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to create backup');
        }

        iframe.contentWindow.postMessage({
          type: 'BACKUP_RESULT',
          success: true,
          message: data.message,
          fileName: data.fileName,
          format: data.format,
          sizeBytes: data.sizeBytes,
          collections: data.collections,
          generatedAt: data.generatedAt,
        }, '*');
      } catch (err) {
        iframe.contentWindow.postMessage({
          type: 'BACKUP_RESULT',
          success: false,
          error: err.message,
        }, '*');
      }
      return;
    }

    /* ── EMPTY_COLLECTION ─────────────────────────────────────────────────
     * Iframe sends { type: 'EMPTY_COLLECTION', collection: '...' }.
     * Parent calls DELETE /api/admin/database/:collection/empty via fetchWithCSRF.
     * Result sent back as { type: 'EMPTY_RESULT', success, message, deletedCount }
     *                   or { type: 'EMPTY_RESULT', success: false, error }.
     * Zero API calls inside the iframe — strict enforcement.
     * ──────────────────────────────────────────────────────────────────── */
    if (msg.type === 'EMPTY_COLLECTION') {
      const collection = msg.collection;
      if (!collection || typeof collection !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
        iframe.contentWindow.postMessage({
          type: 'EMPTY_RESULT',
          success: false,
          error: 'Invalid collection name',
        }, '*');
        return;
      }
      try {
        const res  = await fetchWithCSRF(`/api/admin/database/${collection}/empty`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
        iframe.contentWindow.postMessage({
          type: 'EMPTY_RESULT',
          success: true,
          message: data.message,
          deletedCount: data.deletedCount,
        }, '*');
      } catch (err) {
        console.error('[DB] EMPTY_COLLECTION failed:', err.message);
        iframe.contentWindow.postMessage({
          type: 'EMPTY_RESULT',
          success: false,
          error: err.message,
        }, '*');
      }
      return;
    }

    /* ── DROP_COLLECTION ──────────────────────────────────────────────────
     * Iframe sends { type: 'DROP_COLLECTION', collection: '...' }.
     * Parent calls DELETE /api/admin/database/:collection/drop via fetchWithCSRF.
     * Result sent back as { type: 'DROP_RESULT', success, message }
     *                   or { type: 'DROP_RESULT', success: false, error }.
     * Zero API calls inside the iframe — strict enforcement.
     * ──────────────────────────────────────────────────────────────────── */
    if (msg.type === 'DROP_COLLECTION') {
      const collection = msg.collection;
      if (!collection || typeof collection !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
        iframe.contentWindow.postMessage({
          type: 'DROP_RESULT',
          success: false,
          error: 'Invalid collection name',
        }, '*');
        return;
      }
      try {
        const res  = await fetchWithCSRF(`/api/admin/database/${collection}/drop`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
        iframe.contentWindow.postMessage({
          type: 'DROP_RESULT',
          success: true,
          message: data.message,
        }, '*');
      } catch (err) {
        console.error('[DB] DROP_COLLECTION failed:', err.message);
        iframe.contentWindow.postMessage({
          type: 'DROP_RESULT',
          success: false,
          error: err.message,
        }, '*');
      }
      return;
    }
  });

  iframe.onload = function () {
    loader.classList.add('hidden');
    iframe.classList.remove('hidden');
  };

  iframe.onerror = function () {
    loader.innerHTML = '<p class="text-red-500 text-sm">Failed to load database browser panel.</p>';
  };

  iframe.src = '/iframes/database-browser.html';
}

/* ════════════════════════════════════════════════════════════════
   TAB SETUP
════════════════════════════════════════════════════════════════ */
function setupAdminTabs() {

  const tabs     = document.querySelectorAll('.admin-tab');
  const contents = document.querySelectorAll('.admin-content');

  let tab2Loaded = false;
  let tab3Loaded = false;
  let tab4Loaded = false;
  let tab5Loaded = false;

  /* Tab 1 (default active) — load firms iframe immediately */
  loadFirmsIframe();

  tabs.forEach(tab => {

    tab.addEventListener('click', () => {

      tabs.forEach(t => {
        t.classList.remove('border-blue-500', 'text-blue-600');
        t.classList.add('text-gray-500', 'border-transparent');
      });

      contents.forEach(c => c.classList.add('hidden'));

      tab.classList.add('border-blue-500', 'text-blue-600');
      tab.classList.remove('text-gray-500', 'border-transparent');

      const targetId = tab.id.replace('-tab', '-content');
      const target   = document.getElementById(targetId);
      if (target) target.classList.remove('hidden');

      /* LAZY LOAD TAB 2 — All Users iframe */
      if (tab.id === 'users-tab' && !tab2Loaded) {
        tab2Loaded = true;
        loadUsersIframe();
      }

      /* LAZY LOAD TAB 3 — User Assignment iframe */
      if (tab.id === 'assignment-tab' && !tab3Loaded) {
        tab3Loaded = true;
        loadAssignmentIframe();
      }

      /* LAZY LOAD TAB 4 — Password Management iframe */
      if (tab.id === 'passwords-tab' && !tab4Loaded) {
        tab4Loaded = true;
        loadPasswordManagerIframe();
      }

      /* LAZY LOAD TAB 5 — Database Browser iframe */
      if (tab.id === 'database-tab' && !tab5Loaded) {
        tab5Loaded = true;
        loadDatabaseIframe();
      }

    });

  });

}