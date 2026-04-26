import { renderLayout } from '../components/layout.js';
import { api } from '../utils/api.js';

export async function renderHome(router) {
  try {
    const response = await api.get('/api/pages/public');
    
    const content = `
      <div class="max-w-6xl mx-auto px-4 py-16 space-y-12">

        <!-- Hero Section -->
        <div class="text-center space-y-6">
          <h1 class="text-4xl md:text-5xl font-bold text-gray-900">
            Welcome to SecureApp
          </h1>
          <p class="text-lg text-gray-600 max-w-2xl mx-auto">
            ${response.data.description}
          </p>
          

          <div class="pt-4">
            <a href="/login" data-navigo
              class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold
                     hover:bg-blue-700 transition shadow-sm">
              Get Started
            </a>
          </div>
        </div>

        <!-- Features -->
        <div class="space-y-6">
          <h2 class="text-2xl font-semibold text-gray-800 text-center">
            Features
          </h2>

          <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
            <ul class="space-y-3 list-disc list-inside text-gray-700">
              ${response.data.features
                .map(feature => `<li>${feature}</li>`)
                .join('')}
            </ul>
          </div>
        </div>

        <!-- About Section -->
        <div class="space-y-6">
          <h2 class="text-2xl font-semibold text-gray-800 text-center">
            About This Application
          </h2>

          <div class="bg-gray-50 border border-gray-200 rounded-xl p-8">
            <p class="text-gray-700 mb-4">
              This is a Single Page Application (SPA) built with:
            </p>

            <ul class="space-y-2 list-disc list-inside text-gray-700">
              <li>Node.js & Express backend</li>
              <li>Navigo.js for client-side routing</li>
              <li>JWT-based dual token authentication</li>
              <li>Automatic token refresh mechanism</li>
              <li>HTTP-only cookies with SameSite protection</li>
              <li>CSP and XSS security headers</li>
            </ul>
          </div>
        </div>

      </div>
    `;
    
    renderLayout(content, router);

  } catch (error) {
    const content = `
      <div class="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <h1 class="text-4xl font-bold text-gray-900">
          Welcome to SecureApp
        </h1>

        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load page data. Please try again.
        </div>
      </div>
    `;

    renderLayout(content, router);
  }
}
