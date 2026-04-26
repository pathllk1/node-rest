import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fetchWithCSRF } from '../utils/api.js';
import { authManager } from '../utils/auth.js';

export async function renderProfile(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user = authManager.getUser();

  try {
    const workspaceData = await loadProfileWorkspaceData(user);
    renderLayout(renderProfileWorkspace(workspaceData), router);

    const gstToggle = document.getElementById('gst-toggle');
    const gstMessage = document.getElementById('gst-message');

    gstToggle?.addEventListener('change', async () => {
      gstMessage.innerHTML = statusMsg('blue', 'Updating GST setting...');
      try {
        const res = await fetchWithCSRF('/api/settings/system-config/gst-status', {
          method: 'PUT',
          body: JSON.stringify({ enabled: gstToggle.checked }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || `Failed (${res.status})`);
        gstMessage.innerHTML = statusMsg('green', 'GST setting updated successfully.');
        setTimeout(() => { gstMessage.innerHTML = ''; }, 2500);
      } catch (err) {
        gstToggle.checked = !gstToggle.checked;
        gstMessage.innerHTML = statusMsg('red', err.message || 'Failed to update GST setting');
      }
    });

    const refreshBtn = document.getElementById('manual-refresh-btn');
    const refreshMessage = document.getElementById('refresh-message');

    refreshBtn?.addEventListener('click', async () => {
      refreshMessage.innerHTML = statusMsg('blue', 'Refreshing token...');
      try {
        await authManager.refreshToken();
        refreshMessage.innerHTML = statusMsg('green', 'Token refreshed successfully.');
        setTimeout(() => { refreshMessage.innerHTML = ''; }, 2500);
      } catch {
        refreshMessage.innerHTML = statusMsg('red', 'Token refresh failed.');
      }
    });

    if (workspaceData.canManageFirmUsers) {
      setupFirmUsersWorkspace(workspaceData);
    }
  } catch (error) {
    renderLayout(`
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Profile</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl text-sm">
          Failed to load profile data: ${escapeHtml(error.message)}
        </div>
      </div>
    `, router);
  }
}

async function loadProfileWorkspaceData(user) {
  const [profileRes, settingsRes] = await Promise.all([
    fetch('/api/pages/profile', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
    fetch('/api/settings/system-config/gst-status', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
  ]);

  if (!profileRes.ok) throw new Error(`HTTP ${profileRes.status}`);
  const profilePayload = await profileRes.json();
  if (!profilePayload.success) throw new Error(profilePayload.error || 'Failed to fetch profile data');

  let gstEnabled = true;
  if (settingsRes.ok) {
    const settingsPayload = await settingsRes.json();
    if (settingsPayload.success) gstEnabled = settingsPayload.data?.gst_enabled ?? true;
  }

  let firmSummary = null;
  if (user.firm_id) {
    try {
      const firmRes = await fetch('/api/inventory/sales/current-firm', {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (firmRes.ok) {
        const firmPayload = await firmRes.json();
        if (firmPayload.success) {
          firmSummary = {
            name: user.firm_name || firmPayload.data?.name || 'Assigned Firm',
            code: user.firm_code || 'N/A',
            locations: Array.isArray(firmPayload.data?.locations) ? firmPayload.data.locations : [],
          };
        }
      }
    } catch {
      firmSummary = null;
    }
  }

  const canManageFirmUsers = user.role === 'admin' && !!user.firm_id;
  let firmUsers = [];
  let firmUsersError = '';

  if (canManageFirmUsers) {
    try {
      const usersRes = await fetch('/api/admin/users-with-firms', {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!usersRes.ok) throw new Error(`HTTP ${usersRes.status}`);
      const usersPayload = await usersRes.json();
      firmUsers = Array.isArray(usersPayload.users) ? usersPayload.users : [];
    } catch (err) {
      firmUsersError = err.message || 'Failed to load firm users';
    }
  }

  return {
    user,
    profileData: profilePayload.data || {},
    gstEnabled,
    firmSummary,
    canManageFirmUsers,
    firmUsers,
    firmUsersError,
  };
}

function renderProfileWorkspace(data) {
  const { user, profileData, gstEnabled, firmSummary, canManageFirmUsers, firmUsers, firmUsersError } = data;
  const preferences = profileData.preferences || {};
  const accountInfo = profileData.accountInfo || {};
  const teamStats = getTeamStats(firmUsers);

  return `
    <div class="profile-shell">
      <section class="profile-hero">
        <div class="profile-hero__main">
          <div class="profile-eyebrow">Account Workspace</div>
          <h1 class="profile-hero__title">Profile & Operational Controls</h1>
          <p class="profile-hero__subtitle">
            Review account status, system settings, and${canManageFirmUsers ? ' manage your firm team in one place.' : ' keep your workspace secure and current.'}
          </p>
          <div class="profile-badges">
            <span class="profile-pill profile-pill--neutral">${escapeHtml(user.role)}</span>
            ${firmSummary ? `<span class="profile-pill profile-pill--accent">${escapeHtml(firmSummary.name)}</span>` : ''}
            <span class="profile-pill ${gstEnabled ? 'profile-pill--success' : 'profile-pill--danger'}">GST ${gstEnabled ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div class="profile-hero__stats">
          ${statCard('User ID', user.id)}
          ${statCard('Firm Code', firmSummary?.code || user.firm_code || 'N/A')}
          ${statCard('Team Size', canManageFirmUsers ? String(teamStats.total) : 'N/A')}
          ${statCard('Locations', firmSummary ? String(firmSummary.locations.length || 0) : '0')}
        </div>
      </section>

      <section class="profile-grid">
        <article class="profile-card">
          <div class="profile-card__header">
            <div>
              <h2 class="profile-card__title">Account Snapshot</h2>
              <p class="profile-card__subtitle">Compact identity and access overview.</p>
            </div>
          </div>
          <div class="profile-data-grid">
            ${dataField('Full Name', user.fullname || 'N/A')}
            ${dataField('Username', user.username || 'N/A')}
            ${dataField('Email', user.email || 'N/A')}
            ${dataField('Role', user.role || 'N/A')}
            ${dataField('Member Since', accountInfo.memberSince || 'N/A')}
            ${dataField('Last Login', formatDateTime(user.last_login))}
          </div>
        </article>

        <article class="profile-card">
          <div class="profile-card__header">
            <div>
              <h2 class="profile-card__title">Firm Context</h2>
              <p class="profile-card__subtitle">Operational identity tied to this account.</p>
            </div>
          </div>
          <div class="profile-data-grid">
            ${dataField('Firm Name', firmSummary?.name || user.firm_name || 'Not Assigned')}
            ${dataField('Firm Code', firmSummary?.code || user.firm_code || 'N/A')}
            ${dataField('GST Locations', firmSummary ? String(firmSummary.locations.length || 0) : '0')}
            ${dataField('2FA', accountInfo.twoFactorEnabled ? 'Enabled' : 'Disabled')}
            ${dataField('Language', preferences.language || 'en')}
            ${dataField('Notifications', preferences.notifications ? 'Enabled' : 'Disabled')}
          </div>
        </article>

        <article class="profile-card">
          <div class="profile-card__header">
            <div>
              <h2 class="profile-card__title">System Settings</h2>
              <p class="profile-card__subtitle">Business controls used across invoices and billing.</p>
            </div>
          </div>
          <div class="profile-control-row">
            <div>
              <div class="profile-control__title">GST Calculation</div>
              <div class="profile-control__meta">Enable or disable GST in invoice workflows.</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="gst-toggle" ${gstEnabled ? 'checked' : ''} class="sr-only peer"/>
              <div class="toggle-track"></div>
            </label>
          </div>
          <div class="profile-control-row">
            <div>
              <div class="profile-control__title">Theme Preference</div>
              <div class="profile-control__meta">Current preference stored in profile settings.</div>
            </div>
            <span class="profile-tag">${escapeHtml(preferences.theme || 'light')}</span>
          </div>
          <div id="gst-message" class="profile-inline-message"></div>
        </article>

        <article class="profile-card">
          <div class="profile-card__header">
            <div>
              <h2 class="profile-card__title">Security Session</h2>
              <p class="profile-card__subtitle">Token health and manual session maintenance.</p>
            </div>
          </div>
          <div class="profile-security-list">
            <div class="profile-security-item"><span>Access Token</span><strong>Active · 15 min</strong></div>
            <div class="profile-security-item"><span>Refresh Token</span><strong>Active · 30 days</strong></div>
            <div class="profile-security-item"><span>Auto Refresh</span><strong>Enabled</strong></div>
            <div class="profile-security-item"><span>Last Password Change</span><strong>${escapeHtml(accountInfo.lastPasswordChange || 'N/A')}</strong></div>
          </div>
          <div class="profile-card__actions">
            <button id="manual-refresh-btn" class="profile-btn profile-btn--primary">Refresh Token</button>
          </div>
          <div id="refresh-message" class="profile-inline-message"></div>
        </article>
      </section>

      ${canManageFirmUsers ? `
        <section class="profile-team">
          <div class="profile-team__header">
            <div>
              <div class="profile-eyebrow">Firm Users</div>
              <h2 class="profile-team__title">Team Access Management</h2>
              <p class="profile-team__subtitle">View and edit users assigned to ${escapeHtml(firmSummary?.name || user.firm_name || 'your firm')}.</p>
            </div>
            <div class="profile-team__stats">
              ${miniStat('Total', teamStats.total)}
              ${miniStat('Approved', teamStats.approved)}
              ${miniStat('Managers', teamStats.managers)}
              ${miniStat('Admins', teamStats.admins)}
            </div>
          </div>

          <div class="profile-card profile-card--team">
            <div class="profile-toolbar">
              <div class="profile-toolbar__search">
                <input type="search" id="firm-users-search" class="profile-search" placeholder="Search by name, username, email, role, or status">
              </div>
              <div class="profile-toolbar__actions">
                <button id="firm-users-refresh" class="profile-btn profile-btn--secondary">Refresh</button>
                <button id="firm-users-add" class="profile-btn profile-btn--primary">Add User</button>
              </div>
            </div>
            <div id="firm-users-message" class="profile-inline-message">${firmUsersError ? statusMsg('red', firmUsersError) : ''}</div>
            <div id="firm-users-table-wrap" class="profile-table-wrap">
              ${renderFirmUsersTable(firmUsers, user.id, '')}
            </div>
          </div>
        </section>

        ${renderUserModal()}
      ` : ''}
    </div>
  `;
}

function setupFirmUsersWorkspace(initialData) {
  const currentUserId = String(initialData.user.id || '');
  let users = Array.isArray(initialData.firmUsers) ? [...initialData.firmUsers] : [];
  let query = '';

  const tableWrap = document.getElementById('firm-users-table-wrap');
  const messageEl = document.getElementById('firm-users-message');
  const searchEl = document.getElementById('firm-users-search');
  const refreshEl = document.getElementById('firm-users-refresh');
  const addEl = document.getElementById('firm-users-add');
  const modalEl = document.getElementById('firm-user-modal');
  const modalTitleEl = document.getElementById('firm-user-modal-title');
  const modalFormEl = document.getElementById('firm-user-form');
  const cancelEl = document.getElementById('firm-user-cancel');
  const closeEl = document.getElementById('firm-user-close');
  const passwordRowEl = document.getElementById('firm-user-password-row');
  const submitEl = document.getElementById('firm-user-submit');
  const hintEl = document.getElementById('firm-user-self-hint');

  const renderTable = () => {
    if (!tableWrap) return;
    tableWrap.innerHTML = renderFirmUsersTable(users, currentUserId, query);
    bindRowActions();
  };

  const setMessage = (color, text) => {
    if (!messageEl) return;
    messageEl.innerHTML = color && text ? statusMsg(color, text) : '';
  };

  const loadUsers = async () => {
    setMessage('blue', 'Refreshing firm users...');
    try {
      const res = await fetch('/api/admin/users-with-firms', {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      const payload = await res.json();
      users = Array.isArray(payload.users) ? payload.users : [];
      renderTable();
      setMessage('green', 'Firm users refreshed.');
      setTimeout(() => setMessage('', ''), 2000);
    } catch (err) {
      setMessage('red', err.message || 'Failed to refresh users');
    }
  };

  const openModal = (mode, userRecord = null) => {
    if (!modalEl || !modalFormEl) return;

    const isEdit = mode === 'edit';
    const isSelf = isEdit && String(userRecord?._id || '') === currentUserId;

    modalFormEl.dataset.mode = mode;
    modalFormEl.dataset.userId = userRecord?._id || '';
    modalTitleEl.textContent = isEdit ? 'Edit Firm User' : 'Create Firm User';
    submitEl.textContent = isEdit ? 'Save Changes' : 'Create User';
    passwordRowEl.classList.toggle('hidden', isEdit);
    hintEl.classList.toggle('hidden', !isSelf);

    document.getElementById('firm-user-fullname').value = userRecord?.fullname || '';
    document.getElementById('firm-user-username').value = userRecord?.username || '';
    document.getElementById('firm-user-email').value = userRecord?.email || '';
    document.getElementById('firm-user-password').value = '';
    document.getElementById('firm-user-password').required = !isEdit;
    document.getElementById('firm-user-role').value = userRecord?.role || 'user';
    document.getElementById('firm-user-status').value = userRecord?.status || 'approved';
    document.getElementById('firm-user-role').disabled = isSelf;
    document.getElementById('firm-user-status').disabled = isSelf;

    modalEl.classList.remove('hidden');
  };

  const closeModal = () => {
    if (!modalEl || !modalFormEl) return;
    modalFormEl.reset();
    modalFormEl.dataset.mode = '';
    modalFormEl.dataset.userId = '';
    modalEl.classList.add('hidden');
  };

  const bindRowActions = () => {
    document.querySelectorAll('[data-firm-user-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-firm-user-edit');
        const targetUser = users.find((entry) => String(entry._id) === String(userId));
        if (targetUser) openModal('edit', targetUser);
      });
    });
  };

  searchEl?.addEventListener('input', (event) => {
    query = event.target.value || '';
    renderTable();
  });

  refreshEl?.addEventListener('click', loadUsers);
  addEl?.addEventListener('click', () => openModal('create'));
  cancelEl?.addEventListener('click', closeModal);
  closeEl?.addEventListener('click', closeModal);
  modalEl?.addEventListener('click', (event) => {
    if (event.target === modalEl) closeModal();
  });

  modalFormEl?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const mode = modalFormEl.dataset.mode;
    const userId = modalFormEl.dataset.userId;
    const payload = {
      fullname: document.getElementById('firm-user-fullname').value.trim(),
      username: document.getElementById('firm-user-username').value.trim(),
      email: document.getElementById('firm-user-email').value.trim(),
      role: document.getElementById('firm-user-role').value,
      status: document.getElementById('firm-user-status').value,
    };
    const password = document.getElementById('firm-user-password').value;

    if (mode !== 'edit' && !password.trim()) {
      setMessage('red', 'Password is required when creating a user.');
      return;
    }

    try {
      submitEl.disabled = true;
      submitEl.textContent = mode === 'edit' ? 'Saving...' : 'Creating...';

      let response;
      if (mode === 'edit') {
        response = await fetchWithCSRF(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetchWithCSRF('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({ ...payload, password }),
        });
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || 'Operation failed');

      closeModal();
      await loadUsers();
      setMessage('green', result.message || (mode === 'edit' ? 'User updated successfully.' : 'User created successfully.'));
      setTimeout(() => setMessage('', ''), 2500);
    } catch (err) {
      setMessage('red', err.message || 'Unable to save user');
    } finally {
      submitEl.disabled = false;
      submitEl.textContent = mode === 'edit' ? 'Save Changes' : 'Create User';
    }
  });

  renderTable();
}

function renderFirmUsersTable(users, currentUserId, query) {
  const filteredUsers = filterFirmUsers(users, query);
  if (!filteredUsers.length) {
    return `
      <div class="profile-empty-state">
        <div class="profile-empty-state__title">No firm users found</div>
        <div class="profile-empty-state__text">Try a different search or create a new user for this firm.</div>
      </div>
    `;
  }

  return `
    <table class="profile-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Username</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th class="text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        ${filteredUsers.map((entry) => {
          const isSelf = String(entry._id || '') === String(currentUserId || '');
          return `
            <tr>
              <td>
                <div class="profile-table__identity">
                  <div class="profile-table__name">${escapeHtml(entry.fullname || 'N/A')}</div>
                  <div class="profile-table__meta">${escapeHtml(entry.firm_name || 'Assigned Firm')}</div>
                </div>
              </td>
              <td class="profile-table__mono">${escapeHtml(entry.username || 'N/A')}</td>
              <td>${escapeHtml(entry.email || 'N/A')}</td>
              <td>${roleBadge(entry.role)}</td>
              <td>${statusBadge(entry.status)}</td>
              <td class="text-right">
                <div class="profile-table__actions">
                  ${isSelf ? '<span class="profile-tag">You</span>' : ''}
                  <button type="button" class="profile-btn profile-btn--ghost" data-firm-user-edit="${escapeHtml(entry._id)}">Edit</button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderUserModal() {
  return `
    <div id="firm-user-modal" class="profile-modal hidden">
      <div class="profile-modal__dialog">
        <div class="profile-modal__header">
          <div>
            <h3 id="firm-user-modal-title" class="profile-modal__title">Create Firm User</h3>
            <p class="profile-modal__subtitle">Maintain firm access without changing the existing authorization model.</p>
          </div>
          <button type="button" id="firm-user-close" class="profile-modal__close" aria-label="Close dialog">×</button>
        </div>
        <form id="firm-user-form" class="profile-form">
          <div class="profile-form__grid">
            <label class="profile-form__field">
              <span>Full Name</span>
              <input id="firm-user-fullname" type="text" required>
            </label>
            <label class="profile-form__field">
              <span>Username</span>
              <input id="firm-user-username" type="text" required>
            </label>
            <label class="profile-form__field">
              <span>Email</span>
              <input id="firm-user-email" type="email" required>
            </label>
            <label id="firm-user-password-row" class="profile-form__field">
              <span>Password</span>
              <input id="firm-user-password" type="password" minlength="8">
            </label>
            <label class="profile-form__field">
              <span>Role</span>
              <select id="firm-user-role" required>
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label class="profile-form__field">
              <span>Status</span>
              <select id="firm-user-status" required>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
          <div id="firm-user-self-hint" class="profile-form__hint hidden">
            Your own role and status stay locked here to avoid accidental access loss.
          </div>
          <div class="profile-modal__actions">
            <button type="button" id="firm-user-cancel" class="profile-btn profile-btn--secondary">Cancel</button>
            <button type="submit" id="firm-user-submit" class="profile-btn profile-btn--primary">Create User</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function getTeamStats(users) {
  return users.reduce((stats, user) => {
    stats.total += 1;
    if (user.status === 'approved') stats.approved += 1;
    if (user.role === 'manager') stats.managers += 1;
    if (user.role === 'admin') stats.admins += 1;
    return stats;
  }, { total: 0, approved: 0, managers: 0, admins: 0 });
}

function filterFirmUsers(users, query) {
  const term = String(query || '').trim().toLowerCase();
  const sorted = [...users].sort((a, b) => String(a.fullname || '').localeCompare(String(b.fullname || '')));
  if (!term) return sorted;

  return sorted.filter((entry) => (
    [entry.fullname, entry.username, entry.email, entry.role, entry.status, entry.firm_name]
      .some((value) => String(value || '').toLowerCase().includes(term))
  ));
}

function statCard(label, value) {
  return `
    <div class="profile-stat">
      <div class="profile-stat__label">${escapeHtml(label)}</div>
      <div class="profile-stat__value">${escapeHtml(value)}</div>
    </div>
  `;
}

function miniStat(label, value) {
  return `
    <div class="profile-mini-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function dataField(label, value) {
  return `
    <div class="profile-field">
      <div class="profile-field__label">${escapeHtml(label)}</div>
      <div class="profile-field__value">${escapeHtml(String(value ?? ''))}</div>
    </div>
  `;
}

function roleBadge(role) {
  const normalized = String(role || '').toLowerCase();
  return `<span class="profile-badge profile-badge--role-${escapeHtml(normalized)}">${escapeHtml(normalized || 'unknown')}</span>`;
}

function statusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  return `<span class="profile-badge profile-badge--status-${escapeHtml(normalized)}">${escapeHtml(normalized || 'unknown')}</span>`;
}

function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusMsg(color, text) {
  return `<div class="status-msg status-msg--${escapeHtml(color)}">${escapeHtml(text)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

