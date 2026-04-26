import { authManager } from '../utils/auth.js';

export function renderNavbar(router) {
  const isAuthenticated = authManager.isLoggedIn();
  const user = authManager.getUser();

  const publicLinks = `
    <li>
      <a href="/" data-navigo class="nav-link">Home</a>
    </li>
    <li>
      <a href="/about" data-navigo class="nav-link">About</a>
    </li>
  `;

  const authLinks = isAuthenticated ? `
    <li>
      <a href="/dashboard" data-navigo class="nav-link">Dashboard</a>
    </li>
    <li>
      <a href="/profile" data-navigo class="nav-link">Profile</a>
    </li>
    <li>
      <div class="flex items-center gap-2 px-3 py-2">
        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold">
          ${user.username.charAt(0).toUpperCase()}
        </div>
        <span class="text-gray-700 font-medium">${user.username}</span>
        <span id="nav-timer-display" class="text-sm text-white ml-2">Loading...</span>
      </div>
    </li>
  ` : `
    <li>
      <a href="/login" data-navigo class="nav-link">Login</a>
    </li>
  `;

  const navbarHTML = `
    <nav class="fixed top-0 left-0 w-full h-12 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md flex items-center px-6 z-20">
      <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          
          <!-- Brand -->
          <a href="/" data-navigo class="text-xl font-bold text-white hover:text-gray-100 transition">
            🔐 SecureApp
          </a>

          <!-- Menu -->
          <ul class="flex items-center gap-6">
            ${publicLinks}
            ${authLinks}
          </ul>

        </div>
      </div>
    </nav>
  `;

  const navbarContainer = document.getElementById('navbar');
  if (navbarContainer) {
    navbarContainer.innerHTML = navbarHTML;

    if (isAuthenticated) {
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await authManager.logout();
          router.navigate('/login');
        });
      }
    }

    // Highlight active link
    const currentPath = window.location.pathname;
    const links = navbarContainer.querySelectorAll('a[data-navigo]');
    links.forEach(link => {
      const baseClasses =
        "text-white hover:text-gray-100 transition font-medium";

      link.className = baseClasses;

      if (link.getAttribute('href') === currentPath) {
        link.className =
          "text-white font-semibold border-b-2 border-white pb-1";
      }
    });

    // Start the token expiry timer if authenticated
    if (isAuthenticated) {
      startTokenTimer();
    }
  }
}

// Helper function to get a specific cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Start the token expiry timer
function startTokenTimer() {
  setInterval(() => {
    const expiryStr = getCookie('tokenExpiry');
    const timerDisplay = document.getElementById('nav-timer-display');

    if (!timerDisplay) return;

    if (expiryStr) {
      const expiresAt = parseInt(expiryStr, 10);
      const timeRemaining = expiresAt - Date.now();

      if (timeRemaining > 0) {
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        timerDisplay.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      } else {
        timerDisplay.innerText = "0:00 (Refreshing soon...)";
      }
    } else {
      timerDisplay.innerText = "Logged Out";
    }
  }, 1000);
}
