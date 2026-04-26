import { renderLayout } from '../components/layout.js';

export function renderStocks(router) {
  const content = `
    <div id="stocks-system">
      <!-- Stocks system content will be rendered here -->
      <div class="p-8 text-center">
        <h2 class="text-2xl font-bold mb-4">Stock Management System</h2>
        <p class="text-gray-600">Loading stocks system...</p>
      </div>
    </div>
  `;
  
  renderLayout(content, router);
  
  // Initialize the stocks system after DOM is ready
  setTimeout(() => {
    // Import and initialize the stocks system
    import('../components/inventory/stocks/index.js').then(module => {
      if (module.initStocksSystem) {
        module.initStocksSystem();
      }
    });
  }, 100);
}
