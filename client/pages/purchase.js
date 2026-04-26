import { renderLayout } from '../components/layout.js';

export function renderPurchase(router) {
  const content = `
    <div id="purchase-system">
      <!-- Purchase system content will be rendered here -->
      <div class="p-8 text-center">
        <h2 class="text-2xl font-bold mb-4">Purchase Invoice System</h2>
        <p class="text-gray-600">Loading purchase system...</p>
      </div>
    </div>
  `;

  renderLayout(content, router);

  // Initialize the purchase system after DOM is ready
  setTimeout(() => {
    // Import and initialize the purchase system
    import('../components/inventory/prs/index.js').then(module => {
      if (module.initPurchaseSystem) {
        module.initPurchaseSystem(router);
      }
    });
  }, 100);
}
