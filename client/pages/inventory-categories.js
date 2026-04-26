import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export async function renderInventoryCategories(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
  <div class="max-w-7xl mx-auto px-4 py-16 space-y-8">

    <div class="text-center space-y-4">
      <div class="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10 text-white">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
      </div>
      <h1 class="text-4xl font-bold text-gray-900">Inventory Categories</h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto">
        Organize and manage your inventory categories. This feature is coming soon!
      </p>
    </div>

    <div class="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">Coming Soon</h3>
      <p class="text-blue-700">
        The inventory categories management system is currently under development.
        Check back soon for full categorization features.
      </p>
    </div>

    <div class="flex justify-center">
      <a href="/inventory/dashboard" data-navigo class="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </a>
    </div>

  </div>
  `;

  renderLayout(content, router);
}
