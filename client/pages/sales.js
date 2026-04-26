import { renderLayout } from '../components/layout.js';

export function renderSales(router) {
  const content = `
    <div id="sales-system">
      <!-- Sales system content will be rendered here -->
      <div class="p-8 text-center">
        <h2 class="text-2xl font-bold mb-4">Sales Invoice System</h2>
        <p class="text-gray-600">Loading sales system...</p>
      </div>
    </div>
  `;
  
  renderLayout(content, router);
  
  // Initialize the sales system after DOM is ready
  setTimeout(() => {
    // Import and initialize the sales system
    import('../components/inventory/sls/index.js').then(module => {
      if (module.initSalesSystem) {
        module.initSalesSystem(router);
      }
    });
  }, 100);
}
