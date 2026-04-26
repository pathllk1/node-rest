import { fetchWithCSRF } from '../../utils/api.js';
import { toast } from './toast.js';

export class UserCreator {
  constructor() {
    this.createModal();
  }

  createModal() {
    const modal = document.createElement('div');
    modal.id = 'user-creator-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold mb-4">Create New User</h2>
        <form id="user-creator-form" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
            <input type="text" id="uc-fullname" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Username</label>
            <input type="text" id="uc-username" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input type="email" id="uc-email" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input type="password" id="uc-password" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Role</label>
            <select id="uc-role" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
              <option value="user">User</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div class="flex gap-3 justify-end">
            <button type="button" id="uc-cancel" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create User</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    this.attachEvents();
  }

  attachEvents() {
    const form = document.getElementById('user-creator-form');
    const cancelBtn = document.getElementById('uc-cancel');
    const modal = document.getElementById('user-creator-modal');

    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      form.reset();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        form.reset();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullname = document.getElementById('uc-fullname').value;
      const username = document.getElementById('uc-username').value;
      const email = document.getElementById('uc-email').value;
      const password = document.getElementById('uc-password').value;
      const role = document.getElementById('uc-role').value;

      try {
        const res = await fetchWithCSRF('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({ fullname, username, email, password, role }),
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to create user');
        }
        const data = await res.json();
        toast.success(data.message || 'User created successfully');
        modal.classList.add('hidden');
        form.reset();
        if (window.loadFirmUsers) window.loadFirmUsers();
      } catch (err) {
        toast.error('Error: ' + err.message);
      }
    });
  }

  show() {
    const modal = document.getElementById('user-creator-modal');
    modal.classList.remove('hidden');
  }
}
