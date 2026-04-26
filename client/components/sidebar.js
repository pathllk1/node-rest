import { authManager } from '../utils/auth.js';

export function renderSidebar(router) {
  const currentUser = authManager.getUser();
  const isSuperAdmin = currentUser && currentUser.role === 'super_admin';

  const sidebarContainer = document.getElementById('sidebar');
  if (!sidebarContainer) return;

  const sidebarHTML = `
    <div class="fixed top-12 left-0 h-[calc(100vh-5rem)] w-16 bg-gradient-to-b from-purple-700 via-purple-600 to-indigo-700 text-white z-10 flex flex-col justify-between transition-all duration-300" id="sidebar-menu" data-collapsed="true">
      <!-- Sidebar menu items -->
      <ul class="flex flex-col mt-4 space-y-1 relative pb-20 px-0">
        <li>
          <a href="/" data-navigo title="Home" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-purple-500 rounded transition" data-tooltip="Home">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">Home</span>
          </a>
        </li>

        <li>
          <a href="/about" data-navigo title="About" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-purple-500 rounded transition" data-tooltip="About">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">About</span>
          </a>
        </li>

        ${isSuperAdmin ? `
        <li class="bg-gradient-to-r from-yellow-500 to-orange-500 rounded mx-1 my-1">
          <a href="/super-admin" data-navigo title="Admin Panel" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-orange-600 rounded transition" data-tooltip="Admin Panel">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span class="ml-3 sidebar-text hidden font-bold whitespace-nowrap">Admin Panel</span>
          </a>
        </li>
        ` : ''}

        ${currentUser && currentUser.firm_id ? `
        <li>
          <a href="/master-roll" data-navigo title="Master Roll" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-purple-500 rounded transition" data-tooltip="Master Roll">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">Master Roll</span>
          </a>
        </li>

        <li>
          <a href="/wages-dashboard" data-navigo title="Wages Dashboard" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-purple-500 rounded transition" data-tooltip="Wages Dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">Wages</span>
          </a>
        </li>

        <li>
          <a href="/inventory/dashboard" data-navigo title="Inventory Dashboard" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-purple-500 rounded transition" data-tooltip="Inventory Dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">Inventory</span>
          </a>
        </li>

        <li>
          <a href="/accounts-dashboard" data-navigo title="Accounts Dashboard" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-purple-500 rounded transition" data-tooltip="Accounts Dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">Accounts</span>
          </a>
        </li>
        ` : ''}

        <li>
          <a href="/profile" data-navigo title="Profile" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-purple-500 rounded transition" data-tooltip="Profile">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">Profile</span>
          </a>
        </li>

        ${currentUser ? `
        <li>
          <a href="/dashboard" data-navigo title="Dashboard" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-purple-500 rounded transition" data-tooltip="Dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">Dashboard</span>
          </a>
        </li>
        ` : ''}

        ${currentUser ? `
        <li class="mt-auto">
          <button id="sidebar-logout-btn" title="Logout" class="sidebar-item flex items-center py-3 px-3 cursor-pointer hover:bg-red-500 rounded w-full text-left transition" data-tooltip="Logout">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 flex-shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            <span class="ml-3 sidebar-text hidden whitespace-nowrap">Logout</span>
          </button>
        </li>
        ` : ''}
      </ul>

      <!-- Sidebar toggle button -->
      <button id="sidebar-toggle" class="absolute top-1/2 right-[-12px] transform -translate-y-1/2 w-6 h-6 bg-white text-black rounded-full flex items-center justify-center shadow-md cursor-pointer z-20 hover:bg-gray-100 transition text-xs font-bold">
        &gt;
      </button>
    </div>
  `;

  sidebarContainer.innerHTML = sidebarHTML;

  // Initialize sidebar interactions
  initSidebar(currentUser, router);
}

function initSidebar(currentUser, router) {
  const sidebar = document.getElementById('sidebar-menu');
  const toggle = document.getElementById('sidebar-toggle');
  const logoutBtn = document.getElementById('sidebar-logout-btn');

  // Guard against null sidebar
  if (!sidebar) {
    console.error('Sidebar element not found');
    return;
  }

  const sidebarItems = sidebar.querySelectorAll('.sidebar-text');

  // Handle logout button
  if (logoutBtn && currentUser) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await authManager.logout();
      router.navigate('/login');
    });
  }

  // Update sidebar layout based on collapsed state
  function updateSidebar(collapsed) {
    const mainContent = document.getElementById('main-content');
    
    if (collapsed) {
      // Sidebar collapsed to 64px (w-16)
      sidebar.classList.remove('w-48');
      sidebar.classList.add('w-16');
      if (mainContent) {
        mainContent.classList.add('ml-16');
        mainContent.classList.remove('ml-48');
      }
      toggle.textContent = '>';
      sidebarItems.forEach(item => item.classList.add('hidden'));
    } else {
      // Sidebar expanded to 192px (w-48)
      sidebar.classList.remove('w-16');
      sidebar.classList.add('w-48');
      if (mainContent) {
        mainContent.classList.add('ml-48');
        mainContent.classList.remove('ml-16');
      }
      toggle.textContent = '<';
      sidebarItems.forEach(item => item.classList.remove('hidden'));
    }
  }

  // Sidebar toggle button
  if (sidebar && toggle) {
    toggle.addEventListener('click', () => {
      const collapsed = sidebar.dataset.collapsed === 'true';
      const newCollapsedState = !collapsed;
      sidebar.dataset.collapsed = String(newCollapsedState);
      updateSidebar(newCollapsedState);
    });

    // Initialize sidebar in collapsed state
    updateSidebar(true);
  }
}