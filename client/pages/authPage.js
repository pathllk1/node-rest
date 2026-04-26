import { clearAccessTokenTimer } from "../api.js";
// Assuming renderLayout is imported from your layout component, as seen in your earlier code
import { renderLayout } from '../components/layout.js';
import { fetchWithCSRF } from '../utils/api.js'; 

export function renderAuthPage(router, onAuthSuccess, user = null) {
  const accessToken = localStorage.getItem("accessToken");
  let content = "";

  // 1. Generate the HTML Template
  if (user) {
    // User is logged in → show welcome message + firm users + settings
    content = `
      <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div class="max-w-7xl mx-auto space-y-8">
          
          <div class="bg-white rounded-xl shadow-lg overflow-hidden">
            <div class="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
              <div class="flex items-center space-x-3">
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <span class="text-white font-bold text-lg">${user.fullname.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
                <div>
                  <h1 class="text-xl font-bold text-white">Welcome back, ${user.fullname}!</h1>
                  <p class="text-purple-100 text-sm">Manage your account and access your dashboard</p>
                </div>
              </div>
            </div>
            <div class="px-6 py-4">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div class="flex items-center space-x-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                  <div>
                    <p class="text-gray-500">Firm</p>
                    <p class="font-semibold text-gray-900">${user.firm_name || 'System Admin'} ${user.firm_code ? `(${user.firm_code})` : ''}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                  <div>
                    <p class="text-gray-500">Role</p>
                    <p class="font-semibold text-gray-900">${user.role}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <div>
                    <p class="text-gray-500">Email</p>
                    <p class="font-semibold text-gray-900">${user.email}</p>
                  </div>
                </div>
              </div>
              <div class="mt-4 flex flex-wrap gap-3">
                ${user.role === 'super_admin' ? `
                <a href="/admin" data-navigo class="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg shadow hover:bg-purple-700 transition duration-150">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Admin Panel
                </a>
                ` : ''}
                <button id="auth-logout-btn" class="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg shadow hover:bg-red-700 transition duration-150">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            <div class="bg-white rounded-xl shadow-lg overflow-hidden">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div class="flex items-center space-x-2">
                  <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <h2 class="text-lg font-semibold text-gray-900">Settings</h2>
                </div>
              </div>
              <div class="p-6">
                <div class="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
                  <button class="settings-tab flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white rounded-md shadow-sm transition duration-150" data-tab="global">
                    Global Settings
                  </button>
                  <button class="settings-tab flex-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition duration-150" data-tab="gst">
                    GST Config
                  </button>
                </div>

                <div id="global-tab" class="settings-tab-content">
                  <div id="global-settings-list" class="space-y-4">
                    <div class="flex justify-center py-8">
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  </div>
                  <button id="add-global-setting-btn" class="mt-4 w-full inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow hover:bg-indigo-700 transition duration-150">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Add New Setting
                  </button>
                </div>

                <div id="gst-tab" class="settings-tab-content hidden">
                  <div class="space-y-4">
                    <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div class="flex items-center space-x-3">
                        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        </svg>
                        <div>
                          <h3 class="font-medium text-gray-900">Enable GST Calculation</h3>
                          <p class="text-sm text-gray-600">Toggle GST calculation for invoices</p>
                        </div>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="gst-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    <div id="gst-status" class="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                      Loading GST status...
                    </div>
                  </div>
                </div>
              </div>
            </div>

            ${user.role === 'admin' || user.role === 'manager' || user.role === 'super_admin' ? `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div class="flex items-center space-x-2">
                  <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                  </svg>
                  <h2 class="text-lg font-semibold text-gray-900">
                    ${user.role === 'super_admin' ? 'All Users' : 'Firm Users'}
                  </h2>
                </div>
              </div>
              <div class="p-6">
                <div id="users-list" class="text-gray-700">
                  <div class="animate-pulse space-y-4">
                    <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            </div>
            ` : ''}
            
          </div>

          ${user.role === 'super_admin' ? `
          <div class="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6 shadow-sm">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <h3 class="font-semibold text-blue-800 mb-1">Super Admin Features</h3>
                <p class="text-sm text-blue-700 mb-2">Click the "Admin Panel" button above or the gear icon in the sidebar to access:</p>
                <ul class="text-sm text-blue-700 ml-4 list-disc space-y-1">
                  <li>Create new firms and firm admins</li>
                  <li>Manage all firms (approve/reject)</li>
                  <li>Approve or reject pending user registrations</li>
                </ul>
              </div>
            </div>
          </div>
          ` : ''}
          
        </div>
      </div>

      <div id="edit-setting-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
          <h2 class="text-xl font-bold mb-4 text-gray-900">Edit Setting</h2>
          <form id="edit-setting-form" class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Setting Key</label>
              <input type="text" id="setting-key" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" readonly>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Setting Value</label>
              <textarea id="setting-value" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" rows="4"></textarea>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea id="setting-description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" rows="2"></textarea>
            </div>
            <div class="flex gap-3 justify-end">
              <button type="button" id="cancel-edit-btn" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition">
                Cancel
              </button>
              <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <div id="add-setting-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
          <h2 class="text-xl font-bold mb-4 text-gray-900">Add New Setting</h2>
          <form id="add-setting-form" class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Setting Key</label>
              <input type="text" id="new-setting-key" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., app_name">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Setting Value</label>
              <textarea id="new-setting-value" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" rows="4" placeholder="Enter the setting value"></textarea>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea id="new-setting-description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" rows="2" placeholder="Optional description"></textarea>
            </div>
            <div class="flex gap-3 justify-end">
              <button type="button" id="cancel-add-btn" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition">
                Cancel
              </button>
              <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                Add Setting
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  } else {
    // No user → show login/register forms
    content = `
      <div class="flex items-center justify-center min-h-[calc(100vh-4rem)] py-6">
        <div class="w-full max-w-4xl p-6 bg-white rounded-xl shadow-lg">
          <div class="flex justify-center mb-6 border-b-2 border-gray-200">
            <button id="tab-login" class="tab-btn px-4 py-2 text-purple-700 border-b-2 border-purple-700 font-semibold focus:outline-none">Login</button>
            <button id="tab-register-user" class="tab-btn px-4 py-2 text-gray-500 hover:text-purple-700 font-semibold focus:outline-none">Register</button>
          </div>

          <div id="login-form" class="tab-content">
            <h3 class="text-xl font-semibold text-purple-700 mb-4">Login to Your Account</h3>
            <div class="flex flex-col space-y-4">
              <div class="flex items-center border rounded px-3 py-2 shadow-sm">
                <span class="material-icons text-gray-400 mr-2">person</span>
                <input type="text" id="login-email-username" placeholder="Email or Username" class="w-full outline-none">
              </div>
              <div class="flex items-center border rounded px-3 py-2 shadow-sm">
                <span class="material-icons text-gray-400 mr-2">lock</span>
                <input type="password" id="login-password" placeholder="Password" class="w-full outline-none">
              </div>
              <button id="login-btn" class="bg-purple-600 text-white py-2 rounded shadow hover:bg-purple-700 transition">Login</button>
            </div>
            <p id="login-msg" class="mt-2 text-sm"></p>
          </div>

          <div id="register-user-form" class="tab-content hidden">
            <h3 class="text-xl font-semibold text-purple-700 mb-4">Register New Account</h3>
            <p class="text-sm text-gray-600 mb-4">Register as a user. You'll need your firm's code and admin approval.</p>
            <div class="flex flex-col space-y-4">
              <div class="flex items-center border rounded px-3 py-2 shadow-sm">
                <span class="material-icons text-gray-400 mr-2">vpn_key</span>
                <input type="text" id="register-user-firm-code" placeholder="Firm Code" class="w-full outline-none">
              </div>
              <div class="flex items-center border rounded px-3 py-2 shadow-sm">
                <span class="material-icons text-gray-400 mr-2">person</span>
                <input type="text" id="register-user-fullname" placeholder="Full Name" class="w-full outline-none">
              </div>
              <div class="flex items-center border rounded px-3 py-2 shadow-sm">
                <span class="material-icons text-gray-400 mr-2">account_circle</span>
                <input type="text" id="register-user-username" placeholder="Username" class="w-full outline-none">
              </div>
              <div class="flex items-center border rounded px-3 py-2 shadow-sm">
                <span class="material-icons text-gray-400 mr-2">email</span>
                <input type="email" id="register-user-email" placeholder="Email" class="w-full outline-none">
              </div>
              <div class="flex items-center border rounded px-3 py-2 shadow-sm">
                <span class="material-icons text-gray-400 mr-2">lock</span>
                <input type="password" id="register-user-password" placeholder="Password" class="w-full outline-none">
              </div>
              <button id="register-user-btn" class="bg-purple-600 text-white py-2 rounded shadow hover:bg-purple-700 transition">Register</button>
            </div>
            <p id="register-user-msg" class="mt-2 text-sm"></p>
          </div>
        </div>
      </div>
    `;
  }

  // 2. Inject HTML into the DOM Imperatively
  // Assuming you have a renderLayout method that attaches this HTML to your root container. 
  // If not, use: document.getElementById('app').innerHTML = content;
  renderLayout(content, router);

  // 3. Immediately bind event listeners and execute setup scripts (The Lifecycle)
  if (user) {
    // Initialize settings UI
    initAuthPageSettings();

    // Logout button
    const logoutBtn = document.getElementById("auth-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await fetchWithCSRF("/auth/logout", { method: "POST" });
        } catch (err) {
          console.error("Logout error:", err);
        }
        window.location.reload();
      });
    }

    if (user.role === 'admin' || user.role === 'manager' || user.role === 'super_admin') {
      fetchUsers(user);
    }
  } else {
    // Tab switching logic
    const loginTab = document.getElementById("tab-login");
    const registerUserTab = document.getElementById("tab-register-user");
    
    const loginForm = document.getElementById("login-form");
    const registerUserForm = document.getElementById("register-user-form");

    function switchTab(activeTab, activeForm) {
      [loginTab, registerUserTab].forEach(tab => {
        tab.classList.remove("text-purple-700", "border-b-2", "border-purple-700");
        tab.classList.add("text-gray-500");
      });
      
      [loginForm, registerUserForm].forEach(form => form.classList.add("hidden"));
      
      activeTab.classList.add("text-purple-700", "border-b-2", "border-purple-700");
      activeTab.classList.remove("text-gray-500");
      activeForm.classList.remove("hidden");
    }

    loginTab.addEventListener("click", () => switchTab(loginTab, loginForm));
    registerUserTab.addEventListener("click", () => switchTab(registerUserTab, registerUserForm));

    // Login handler
    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", async () => {
        const emailOrUsername = document.getElementById("login-email-username").value;
        const password = document.getElementById("login-password").value;
        const msg = document.getElementById("login-msg");
        
        if (!emailOrUsername || !password) {
          msg.textContent = "Please fill all fields";
          msg.className = "mt-2 text-sm text-red-500";
          return;
        }

        try {
          const res = await fetchWithCSRF("/auth/auth/login", {
            method: "POST",
            body: JSON.stringify({ emailOrUsername, password })
          });
          const data = await res.json();
          
          if (data.success) {
            onAuthSuccess(data.user);
          } else {
            msg.textContent = data.error;
            msg.className = "mt-2 text-sm text-red-500";
          }
        } catch (err) {
          msg.textContent = "Server error";
          msg.className = "mt-2 text-sm text-red-500";
        }
      });
    }

    // Register User handler
    const registerUserBtn = document.getElementById("register-user-btn");
    if (registerUserBtn) {
      registerUserBtn.addEventListener("click", async () => {
        const firmCode = document.getElementById("register-user-firm-code").value;
        const fullname = document.getElementById("register-user-fullname").value;
        const username = document.getElementById("register-user-username").value;
        const email = document.getElementById("register-user-email").value;
        const password = document.getElementById("register-user-password").value;
        const msg = document.getElementById("register-user-msg");
        
        if (!firmCode || !fullname || !username || !email || !password) {
          msg.textContent = "Please fill all fields";
          msg.className = "mt-2 text-sm text-red-500";
          return;
        }

        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firmCode, fullname, username, email, password })
          });
          const data = await res.json();
          
          if (data.success) {
            msg.textContent = "Registration successful! Your account is pending approval by an administrator.";
            msg.className = "mt-2 text-sm text-green-600";
            
            // Clear form
            document.getElementById("register-user-firm-code").value = "";
            document.getElementById("register-user-fullname").value = "";
            document.getElementById("register-user-username").value = "";
            document.getElementById("register-user-email").value = "";
            document.getElementById("register-user-password").value = "";
          } else {
            msg.textContent = data.error;
            msg.className = "mt-2 text-sm text-red-500";
          }
        } catch (err) {
          msg.textContent = "Server error";
          msg.className = "mt-2 text-sm text-red-500";
        }
      });
    }
  }
}

// ---------------------------------------------------------
// Helper Functions 
// (These remain largely identical as they already rely on standard DOM queries)
// ---------------------------------------------------------

async function fetchUsers(user) {
  try {
    const endpoint = user.role === 'super_admin' ? '/auth/auth/users' : '/auth/auth/users/firm';
    const res = await fetch(endpoint);
    
    if (!res.ok) throw new Error("Failed to fetch users");
    
    const data = await res.json();
    const usersList = document.getElementById("users-list");
    
    if (!usersList) return;
    usersList.innerHTML = "";
    
    if (data.users && data.users.length > 0) {
      const table = document.createElement("table");
      table.className = "min-w-full divide-y divide-gray-200";
      
      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
          ${user.role === 'super_admin' ? '<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Firm</th>' : ''}
        </tr>
      `;
      table.appendChild(thead);
      
      const tbody = document.createElement("tbody");
      tbody.className = "bg-white divide-y divide-gray-200";
      
      data.users.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="px-3 py-2 text-sm text-gray-900">${u.fullname}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${u.username}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${u.email}</td>
          <td class="px-3 py-2 text-sm">
            <span class="px-2 py-1 text-xs rounded ${
              u.role === 'admin' ? 'bg-red-100 text-red-800' :
              u.role === 'manager' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }">
              ${u.role}
            </span>
          </td>
          ${user.role === 'super_admin' ? `<td class="px-3 py-2 text-sm text-gray-700">${u.firm_name || 'No Firm'}</td>` : ''}
        `;
        tbody.appendChild(tr);
      });
      
      table.appendChild(tbody);
      usersList.appendChild(table);
    } else {
      const p = document.createElement("p");
      p.textContent = "No users found";
      p.className = "text-gray-500";
      usersList.appendChild(p);
    }
  } catch (err) {
    console.error(err);
    const usersList = document.getElementById("users-list");
    if (usersList) {
      usersList.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Could not load users";
      p.className = "text-red-500";
      usersList.appendChild(p);
    }
  }
}

function initAuthPageSettings() {
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      document.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.remove('border-b-2', 'border-indigo-600', 'text-indigo-600');
        t.classList.add('text-gray-600');
      });
      tab.classList.add('border-b-2', 'border-indigo-600', 'text-indigo-600');
      tab.classList.remove('text-gray-600');
      
      document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      document.getElementById(`${tabName}-tab`).classList.remove('hidden');
      
      if (tabName === 'global') {
        loadGlobalSettings();
      } else if (tabName === 'gst') {
        loadGstStatus();
      }
    });
  });

  loadGlobalSettings();
  setupAuthPageModalHandlers();
}

function setupAuthPageModalHandlers() {
  const editModal = document.getElementById('edit-setting-modal');
  const addModal = document.getElementById('add-setting-modal');
  const editForm = document.getElementById('edit-setting-form');
  const addForm = document.getElementById('add-setting-form');

  document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    editModal.classList.add('hidden');
  });

  document.getElementById('cancel-add-btn').addEventListener('click', () => {
    addModal.classList.add('hidden');
  });

  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.classList.add('hidden');
  });

  addModal.addEventListener('click', (e) => {
    if (e.target === addModal) addModal.classList.add('hidden');
  });

  document.getElementById('add-global-setting-btn').addEventListener('click', () => {
    document.getElementById('new-setting-key').value = '';
    document.getElementById('new-setting-value').value = '';
    document.getElementById('new-setting-description').value = '';
    addModal.classList.remove('hidden');
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('setting-key').value;
    const value = document.getElementById('setting-value').value;
    const description = document.getElementById('setting-description').value;

    try {
      const response = await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_value: value, description })
      });

      if (response.ok) {
        alert('Setting updated successfully');
        editModal.classList.add('hidden');
        loadGlobalSettings();
      } else {
        alert('Failed to update setting');
      }
    } catch (err) {
      console.error('Error updating setting:', err);
      alert('Error updating setting');
    }
  });

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('new-setting-key').value;
    const value = document.getElementById('new-setting-value').value;
    const description = document.getElementById('new-setting-description').value;

    if (!key || !value) {
      alert('Key and Value are required');
      return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_key: key, setting_value: value, description })
      });

      if (response.ok) {
        alert('Setting added successfully');
        addModal.classList.add('hidden');
        loadGlobalSettings();
      } else {
        alert('Failed to add setting');
      }
    } catch (err) {
      console.error('Error adding setting:', err);
      alert('Error adding setting');
    }
  });
}

async function loadGlobalSettings() {
  try {
    const response = await fetch('/api/settings');
    const data = await response.json();
    const settings = data.settings || [];

    const listContainer = document.getElementById('global-settings-list');
    
    if (settings.length === 0) {
      listContainer.innerHTML = '<p class="text-gray-600">No settings found</p>';
      return;
    }

    listContainer.innerHTML = settings.map(setting => `
      <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div class="flex-1">
          <h3 class="font-semibold text-gray-800">${escapeHtml(setting.setting_key)}</h3>
          <p class="text-sm text-gray-600 truncate">${escapeHtml(setting.setting_value || '')}</p>
          ${setting.description ? `<p class="text-xs text-gray-500 mt-1">${escapeHtml(setting.description)}</p>` : ''}
        </div>
        <button class="edit-setting-btn px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition" data-key="${escapeHtml(setting.setting_key)}">
          Edit
        </button>
      </div>
    `).join('');

    document.querySelectorAll('.edit-setting-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const setting = settings.find(s => s.setting_key === key);
        if (setting) {
          openEditModal(setting);
        }
      });
    });
  } catch (err) {
    console.error('Error loading settings:', err);
    document.getElementById('global-settings-list').innerHTML = '<p class="text-red-600">Error loading settings</p>';
  }
}

function openEditModal(setting) {
  document.getElementById('setting-key').value = setting.setting_key;
  document.getElementById('setting-value').value = setting.setting_value || '';
  document.getElementById('setting-description').value = setting.description || '';
  document.getElementById('edit-setting-modal').classList.remove('hidden');
}

async function loadGstStatus() {
  try {
    const response = await fetch('/api/settings/system-config/gst-status');
    const data = await response.json();
    
    const toggle = document.getElementById('gst-toggle');
    const status = document.getElementById('gst-status');
    
    toggle.checked = data.gst_enabled;
    status.textContent = `GST is currently ${data.gst_enabled ? 'ENABLED' : 'DISABLED'}`;
    
    toggle.addEventListener('change', async () => {
      try {
        const response = await fetch('/api/settings/system-config/gst-status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: toggle.checked })
        });

        if (response.ok) {
          status.textContent = `GST is currently ${toggle.checked ? 'ENABLED' : 'DISABLED'}`;
          
          status.classList.remove('bg-red-50', 'border-red-200', 'text-red-800');
          status.classList.remove('bg-green-50', 'border-green-200', 'text-green-800');
          
          if (toggle.checked) {
            status.classList.add('bg-green-50', 'border-green-200', 'text-green-800');
          } else {
            status.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
          }
        } else {
          toggle.checked = !toggle.checked;
          alert('Failed to update GST status');
        }
      } catch (err) {
        console.error('Error updating GST status:', err);
        toggle.checked = !toggle.checked;
        alert('Error updating GST status');
      }
    });
  } catch (err) {
    console.error('Error loading GST status:', err);
    document.getElementById('gst-status').textContent = 'Error loading GST status';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}