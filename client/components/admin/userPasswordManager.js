import { toast } from './toast.js';

export class UserPasswordManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.users = [];
    this.auditLogs = [];
    this.filteredUsers = [];
    this.searchTerm = '';
    this.currentPage = 1;
    this.editingUserId = null;
    this.newPasswords = new Map(); // userId -> password mapping for form

    this.BCRYPT_ROUNDS = 12;
    this.PASSWORD_MIN_LENGTH = 8;

    this.init();
  }

  async init() {
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      const [usersRes, logsRes] = await Promise.all([
        fetch('/api/admin/super-admin/users/for-password-update', { 
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch('/api/admin/super-admin/password-audit-log?page=1', {
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        }),
      ]);

      if (!usersRes.ok || !logsRes.ok) {
        throw new Error('Failed to load data');
      }

      const [usersData, logsData] = await Promise.all([
        usersRes.json(),
        logsRes.json()
      ]);

      this.users = usersData.users || [];
      this.auditLogs = logsData.logs || [];
      this.applyFilters();
    } catch (error) {
      console.error('Error loading password management data:', error);
      toast.error('Failed to load user data: ' + error.message);
    }
  }

  applyFilters() {
    let filtered = [...this.users];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.fullname.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.firm_name && u.firm_name.toLowerCase().includes(term))
      );
    }

    this.filteredUsers = filtered;
  }

  validatePassword(password) {
    const errors = [];

    if (!password) {
      errors.push('Password is required');
    }
    if (password.length < this.PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${this.PASSWORD_MIN_LENGTH} characters`);
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_\-+=\[\]{};:'",.<>?/\\|`~]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*)');
    }

    return errors;
  }

  getPasswordStrength(password) {
    if (!password) return { level: 0, text: 'No password', color: 'gray' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (password.length >= 16) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_\-+=\[\]{};:'",.<>?/\\|`~]/.test(password)) strength++;

    const levels = [
      { level: 0, text: 'Very Weak', color: 'red' },
      { level: 1, text: 'Weak', color: 'orange' },
      { level: 2, text: 'Fair', color: 'yellow' },
      { level: 3, text: 'Good', color: 'blue' },
      { level: 4, text: 'Strong', color: 'green' },
      { level: 5, text: 'Very Strong', color: 'green' },
    ];

    return levels[Math.min(strength, 5)];
  }

  async updatePassword(userId) {
    try {
      const newPassword = this.newPasswords.get(userId);

      if (!newPassword) {
        toast.error('Please enter a new password');
        return;
      }

      // Validate password strength
      const validationErrors = this.validatePassword(newPassword);
      if (validationErrors.length > 0) {
        toast.error('Password validation failed:\n' + validationErrors.join('\n'));
        return;
      }

      // Find the user for confirmation
      const user = this.users.find(u => String(u._id) === String(userId));
      if (!user) {
        toast.error('User not found');
        return;
      }

      // Show confirmation modal with strict warnings
      const confirmAction = await this.showConfirmationModal(user, newPassword);
      if (!confirmAction) {
        return;
      }

      // Send password update request
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrfToken='))
        ?.split('=')[1];

      if (!csrfToken) {
        throw new Error('CSRF token not found. Please refresh the page.');
      }

      const response = await fetch('/api/admin/super-admin/users/update-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken  // Required by CSRF middleware
        },
        body: JSON.stringify({
          userId: userId,
          newPassword: newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || 'Password updated successfully');

      // Clear the input field
      this.newPasswords.delete(userId);
      this.editingUserId = null;

      // Reload data and re-render
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password: ' + error.message);
    }
  }

  async showConfirmationModal(user, password) {
    return new Promise((resolve) => {
      const modalId = 'password-confirm-modal-' + Date.now();
      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 border-2 border-red-300">
          <!-- Header -->
          <div class="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-t-xl">
            <h3 class="text-lg font-bold flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4v2m0 4v2M7.08 6.47A9.969 9.969 0 0112 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12c0-1.395.278-2.718.808-3.93"/>
              </svg>
              Confirm Password Change
            </h3>
          </div>

          <!-- Body -->
          <div class="px-6 py-6 space-y-4">
            <!-- User Details -->
            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p class="text-sm text-gray-600 mb-1">
                <strong>User:</strong> ${user.fullname} (${user.username})
              </p>
              <p class="text-sm text-gray-600 mb-1">
                <strong>Email:</strong> ${user.email}
              </p>
              <p class="text-sm text-gray-600">
                <strong>Firm:</strong> ${user.firm_name}
              </p>
            </div>

            <!-- Warnings -->
            <div class="bg-red-50 border-l-4 border-red-500 p-3">
              <p class="text-xs font-semibold text-red-700 mb-2">⚠️ SEVERE CAUTION:</p>
              <ul class="text-xs text-red-700 space-y-1">
                <li>• This action <strong>CANNOT BE UNDONE</strong></li>
                <li>• User's current password will be <strong>PERMANENTLY DELETED</strong></li>
                <li>• User must use the new password on next login</li>
                <li>• All other sessions will be <strong>INVALIDATED</strong></li>
                <li>• Failed login attempts counter will be <strong>RESET</strong></li>
                <li>• This action will be <strong>PERMANENTLY LOGGED</strong></li>
              </ul>
            </div>

            <!-- Password Strength Indicator -->
            <div class="bg-blue-50 border-l-4 border-blue-500 p-3">
              <p class="text-xs font-semibold text-blue-700 mb-2">Password Strength:</p>
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-gray-300 rounded-full h-2">
                  <div class="bg-green-500 h-2 rounded-full" style="width: 100%"></div>
                </div>
                <span class="text-xs font-bold text-green-700">Very Strong</span>
              </div>
            </div>

            <!-- Confirmation Checkbox -->
            <div class="border-2 border-red-300 bg-red-50 rounded-lg p-3">
              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" id="confirm-checkbox-${modalId}" 
                       class="w-4 h-4 rounded border-red-300 text-red-600 mt-0.5 cursor-pointer"/>
                <span class="text-xs text-red-800">
                  I understand that this action is <strong>IRREVERSIBLE</strong> and will 
                  <strong>PERMANENTLY CHANGE</strong> the user's password. I confirm I am updating 
                  the correct user and accept all consequences.
                </span>
              </label>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
            <button id="cancel-btn-${modalId}"
                    class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 
                           font-medium hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button id="confirm-btn-${modalId}"
                    class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white 
                           font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                    disabled>
              Update Password
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const checkbox = document.getElementById(`confirm-checkbox-${modalId}`);
      const confirmBtn = document.getElementById(`confirm-btn-${modalId}`);
      const cancelBtn = document.getElementById(`cancel-btn-${modalId}`);

      // Enable/disable confirm button based on checkbox
      checkbox.addEventListener('change', () => {
        confirmBtn.disabled = !checkbox.checked;
      });

      // Handle confirm
      confirmBtn.addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      // Handle cancel
      cancelBtn.addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      // Handle outside click (cancel)
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });
  }

  getStrengthColorValue(colorName) {
    const colorMap = {
      'red': '#dc2626',
      'orange': '#ea580c',
      'yellow': '#ca8a04',
      'blue': '#2563eb',
      'green': '#16a34a',
      'gray': '#6b7280'
    };
    return colorMap[colorName] || '#6b7280';
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="user-password-manager space-y-6">

        <!-- Header -->
        <div>
          <h2 class="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
            Update User Passwords
          </h2>
          <p class="text-sm text-gray-500 mt-0.5">
            Super Admin Only - Manage and update user passwords with full audit trail
          </p>
        </div>

        <!-- Important Notice -->
        <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <p class="text-sm font-semibold text-red-800 mb-2">🔒 SECURITY NOTICE:</p>
          <ul class="text-xs text-red-700 space-y-1">
            <li>✓ All password changes are hashed with Bcrypt (12 rounds)</li>
            <li>✓ Every change is logged with operator details</li>
            <li>✓ User's all other sessions will be invalidated</li>
            <li>✓ Account lockout status will be cleared</li>
          </ul>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Users</p>
            <p class="text-2xl font-bold text-blue-600 mt-1">${this.users.length}</p>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent Changes</p>
            <p class="text-2xl font-bold text-green-600 mt-1">${this.auditLogs.filter(l => l.status === 'success').length}</p>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Failed Attempts</p>
            <p class="text-2xl font-bold text-orange-600 mt-1">${this.auditLogs.filter(l => l.status === 'failed').length}</p>
          </div>
        </div>

        <!-- Search Filter -->
        <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
            </svg>
            <input id="user-search-password"
                   type="text"
                   placeholder="Search by name, username, email, or firm…"
                   value="${this.searchTerm}"
                   class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                          focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"/>
          </div>
        </div>

        <!-- Users Table -->
        <div class="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">User Details</th>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">Contact</th>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">Firm</th>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">New Password</th>
                  <th class="px-6 py-3 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredUsers.map((user) => {
                  const password = this.newPasswords.get(user._id) || '';
                  const strength = this.getPasswordStrength(password);
                  const isEditing = this.editingUserId === user._id;
                  const roleColor = this.getRoleColor(user.role);

                  return `
                    <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <!-- User Details -->
                      <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 
                                      flex items-center justify-center text-white font-bold">
                            ${user.fullname.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p class="font-semibold text-gray-900">${user.fullname}</p>
                            <p class="text-xs text-gray-500">@${user.username}</p>
                            <span class="inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${roleColor}">
                              ${user.role.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>

                      <!-- Contact -->
                      <td class="px-6 py-4">
                        <a href="mailto:${user.email}" class="text-blue-600 hover:underline text-sm">
                          ${user.email}
                        </a>
                      </td>

                      <!-- Firm -->
                      <td class="px-6 py-4">
                        <p class="text-gray-700 font-medium">${user.firm_name}</p>
                        <p class="text-xs text-gray-500">${user.firm_code || 'N/A'}</p>
                      </td>

                      <!-- New Password Input -->
                      <td class="px-6 py-4">
                        ${isEditing ? `
                          <div class="space-y-2">
                            <input type="password"
                                   class="password-input-${user._id} w-full px-3 py-2 text-sm 
                                          border border-gray-300 rounded-lg
                                          focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                   placeholder="Enter new password"
                                   value="${password}">
                            <!-- Password Strength Indicator -->
                            ${password ? `
                              <div class="flex items-center gap-2">
                                <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                                  <div class="h-1.5 rounded-full" 
                                       style="background-color: ${this.getStrengthColorValue(strength.color)}; width: ${(strength.level / 5) * 100}%"></div>
                                </div>
                                <span class="text-xs font-semibold" style="color: ${this.getStrengthColorValue(strength.color)}">${strength.text}</span>
                              </div>
                            ` : ''}
                          </div>
                        ` : `
                          <p class="text-gray-400 text-xs italic">Click Edit to set password</p>
                        `}
                      </td>

                      <!-- Actions -->
                      <td class="px-6 py-4">
                        <div class="flex gap-2 justify-end">
                          ${isEditing ? `
                            <button class="cancel-edit-${user._id} px-3 py-1 text-xs border border-gray-300 
                                          text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors">
                              Cancel
                            </button>
                            <button class="update-password-${user._id} px-3 py-1 text-xs bg-red-600 
                                          text-white rounded-lg hover:bg-red-700 font-semibold transition-colors">
                              Update
                            </button>
                          ` : `
                            <button class="edit-password-${user._id} px-3 py-1 text-xs bg-blue-600 
                                          text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
                              Edit
                            </button>
                          `}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          ${this.filteredUsers.length === 0 ? `
            <div class="px-6 py-12 text-center">
              <p class="text-gray-500 text-sm">No users found matching your search</p>
            </div>
          ` : ''}
        </div>

        <!-- Audit Log Section -->
        <div class="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 class="font-semibold text-gray-900 flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Password Change Audit Log
            </h3>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">Super Admin</th>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">Target User</th>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">Timestamp</th>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700">IP Address</th>
                </tr>
              </thead>
              <tbody>
                ${this.auditLogs.map((log) => {
                  const statusColor = log.status === 'success' 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800';
                  const date = new Date(log.createdAt);
                  const timeStr = date.toLocaleString();

                  return `
                    <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-4">
                        <div>
                          <p class="font-medium text-gray-900">${log.admin_name || 'Unknown'}</p>
                          <p class="text-xs text-gray-500">@${log.admin_username || 'N/A'}</p>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <div>
                          <p class="font-medium text-gray-900">${log.target_fullname || 'Unknown'}</p>
                          <p class="text-xs text-gray-500">${log.target_email || 'N/A'}</p>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">
                          ${log.status.toUpperCase()}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <p class="text-gray-700 text-sm">${timeStr}</p>
                      </td>
                      <td class="px-6 py-4">
                        <p class="text-gray-600 text-sm font-mono text-xs">${log.ip_address || 'N/A'}</p>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          ${this.auditLogs.length === 0 ? `
            <div class="px-6 py-12 text-center">
              <p class="text-gray-500 text-sm">No password changes recorded yet</p>
            </div>
          ` : ''}
        </div>

      </div>
    `;

    this.attachEventListeners();
  }

  getRoleColor(role) {
    const colors = {
      'super_admin': 'bg-purple-100 text-purple-800',
      'admin': 'bg-blue-100 text-blue-800',
      'manager': 'bg-indigo-100 text-indigo-800',
      'user': 'bg-gray-100 text-gray-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  }

  attachEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('user-search-password');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        this.applyFilters();
        this.render();
      });
    }

    // Edit buttons
    this.filteredUsers.forEach(user => {
      const editBtn = document.querySelector(`.edit-password-${user._id}`);
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          this.editingUserId = user._id;
          this.render();
          setTimeout(() => {
            const input = document.querySelector(`.password-input-${user._id}`);
            if (input) input.focus();
          }, 100);
        });
      }

      // Cancel buttons
      const cancelBtn = document.querySelector(`.cancel-edit-${user._id}`);
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.newPasswords.delete(user._id);
          this.editingUserId = null;
          this.render();
        });
      }

      // Update buttons
      const updateBtn = document.querySelector(`.update-password-${user._id}`);
      if (updateBtn) {
        updateBtn.addEventListener('click', () => {
          const input = document.querySelector(`.password-input-${user._id}`);
          if (input) {
            this.newPasswords.set(user._id, input.value);
            this.updatePassword(user._id);
          }
        });
      }

      // Password input listener for strength indicator
      const passwordInput = document.querySelector(`.password-input-${user._id}`);
      if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
          this.newPasswords.set(user._id, e.target.value);
          // Re-render just this row or update strength indicator
          const strength = this.getPasswordStrength(e.target.value);
          // Update in the DOM if strength indicator exists
        });

        // Allow Enter key to submit
        passwordInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.newPasswords.set(user._id, e.target.value);
            this.updatePassword(user._id);
          }
        });
      }
    });
  }
}
