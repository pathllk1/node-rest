import { renderLayout } from '../components/layout.js';

export function renderAbout(router) {
  const content = `
    <div class="max-w-6xl mx-auto px-4 py-12 space-y-12">

      <!-- Header -->
      <div>
        <h1 class="text-4xl font-bold text-gray-900 mb-4">
          About SecureApp
        </h1>
        <p class="text-gray-600 text-lg">
          Built with modern security standards and best practices.
        </p>
      </div>

      <!-- Security Features -->
      <div class="space-y-6">
        <h2 class="text-2xl font-semibold text-gray-800">
          Security Features
        </h2>

        <div class="grid md:grid-cols-2 gap-6">

          <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold mb-2">🔒 Dual Token Authentication</h3>
            <p class="text-gray-600">
              We use a sophisticated dual-token system with access tokens (15 minutes)
              and refresh tokens (30 days) to keep your session secure.
            </p>
          </div>

          <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold mb-2">🔄 Automatic Token Refresh</h3>
            <p class="text-gray-600">
              Our system automatically refreshes your access token in the background,
              so you never get logged out while actively using the app.
            </p>
          </div>

          <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold mb-2">🍪 Secure Cookies</h3>
            <p class="text-gray-600">
              All tokens are stored in HTTP-only cookies with SameSite protection,
              making them immune to XSS attacks.
            </p>
          </div>

          <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold mb-2">🛡️ Content Security Policy</h3>
            <p class="text-gray-600">
              Strict CSP headers protect against code injection attacks by only
              allowing resources from trusted sources.
            </p>
          </div>

        </div>
      </div>

      <!-- Technology Stack -->
      <div class="space-y-6">
        <h2 class="text-2xl font-semibold text-gray-800">
          Technology Stack
        </h2>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">

          <div class="bg-gray-50 p-6 rounded-xl text-center border border-gray-200">
            <div class="text-sm text-gray-500 mb-1">Backend</div>
            <div class="text-lg font-semibold text-gray-800">Node.js</div>
          </div>

          <div class="bg-gray-50 p-6 rounded-xl text-center border border-gray-200">
            <div class="text-sm text-gray-500 mb-1">Framework</div>
            <div class="text-lg font-semibold text-gray-800">Express</div>
          </div>

          <div class="bg-gray-50 p-6 rounded-xl text-center border border-gray-200">
            <div class="text-sm text-gray-500 mb-1">Router</div>
            <div class="text-lg font-semibold text-gray-800">Navigo.js</div>
          </div>

          <div class="bg-gray-50 p-6 rounded-xl text-center border border-gray-200">
            <div class="text-sm text-gray-500 mb-1">Auth</div>
            <div class="text-lg font-semibold text-gray-800">JWT</div>
          </div>

        </div>
      </div>

    </div>
  `;
  
  renderLayout(content, router);
}
