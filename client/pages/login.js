import { renderLayout } from '../components/layout.js';
import { authManager } from '../utils/auth.js';
import { guestOnly } from '../middleware/authMiddleware.js';

export async function renderLogin(router) {
  const canAccess = await guestOnly(router);
  if (!canAccess) return;

  const content = `
    <div class="min-h-[70vh] flex items-center justify-center px-4">
      <div class="w-full max-w-md space-y-8">

        <!-- Header -->
        <div class="text-center space-y-2">
          <h1 class="text-3xl font-bold text-gray-900">Login</h1>
          <p class="text-gray-600">
            Please enter your credentials to access your account.
          </p>
        </div>

        <!-- Messages -->
        <div id="login-message"></div>

        <!-- Form -->
        <form id="login-form" class="space-y-6">

          <div class="space-y-2">
            <label for="username" class="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              autocomplete="username"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     outline-none transition"
            />
          </div>

          <div class="space-y-2">
            <label for="password" class="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              autocomplete="current-password"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     outline-none transition"
            />
          </div>

          <button
            type="submit"
            class="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold
                   hover:bg-blue-700 transition shadow-sm"
          >
            Login
          </button>

        </form>

      </div>
    </div>
  `;

  renderLayout(content, router);

  const form = document.getElementById('login-form');
  const messageDiv = document.getElementById('login-message');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      try {
        messageDiv.innerHTML = `
          <div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
            Logging in...
          </div>
        `;

        await authManager.login(username, password);

        messageDiv.innerHTML = `
          <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            Login successful! Redirecting...
          </div>
        `;

        setTimeout(() => {
          router.navigate('/dashboard');
        }, 1000);

      } catch (error) {
        messageDiv.innerHTML = `
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            ${error.message || 'Login failed'}
          </div>
        `;
      }
    });
  }
}
