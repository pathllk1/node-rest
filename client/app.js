// ─────────────────────────────────────────────
//  Lazy page loaders
//  Each function dynamically imports the module
//  only when the route is first visited.
// ─────────────────────────────────────────────

import { initGlobalToolModal } from './components/tools/globalToolModal.js';

const loadHome = () => import('./pages/home.js').then(m => m.renderHome);
const loadAbout = () => import('./pages/about.js').then(m => m.renderAbout);
const loadLogin = () => import('./pages/login.js').then(m => m.renderLogin);
const loadDashboard = () => import('./pages/dashboard.js').then(m => m.renderDashboard);
const loadProfile = () => import('./pages/profile.js').then(m => m.renderProfile);
const loadSuperAdmin = () => import('./pages/superAdmin.js').then(m => m.renderSuperAdmin);
const loadMasterRoll = () => import('./pages/master-roll.js').then(m => m.renderMasterRoll);
const loadWagesDashboard = () => import('./pages/WagesDashboard.js').then(m => m.renderWagesDashboard);
const loadSales = () => import('./pages/sales.js').then(m => m.renderSales);
const loadPurchase = () => import('./pages/purchase.js').then(m => m.renderPurchase);
const loadStocks = () => import('./pages/stocks.js').then(m => m.renderStocks);
const loadInventoryDashboard = () => import('./pages/inventory-dashboard.js').then(m => m.renderInventoryDashboard);
const loadInventoryCategories = () => import('./pages/inventory-categories.js').then(m => m.renderInventoryCategories);
const loadInventorySuppliers = () => import('./pages/inventory-suppliers.js').then(m => m.renderInventorySuppliers);
const loadInventoryReports = () => import('./pages/inventory-reports.js').then(m => m.renderInventoryReports);
const loadStockMovement = () => import('./pages/stock-movement.js').then(m => m.renderStockMovement);
const loadAccountsDashboard = () => import('./pages/accounts-dashboard.js').then(m => m.renderAccountsDashboard);
const loadJournalEntries = () => import('./pages/ledger/journal-entries.js').then(m => m.renderJournalEntries);
const loadVouchers = () => import('./pages/ledger/vouchers.js').then(m => m.renderVouchers);
const loadTrialBalance = () => import('./pages/ledger/trial-balance.js').then(m => m.renderTrialBalance);
const loadGeneralLedger = () => import('./pages/ledger/general-ledger.js').then(m => m.renderGeneralLedger);
const loadAccountDetails = () => import('./pages/ledger/account-details.js').then(m => m.renderAccountDetails);
const loadNewJournalEntry = () => import('./pages/ledger/new-journal-entry.js').then(m => m.renderNewJournalEntry);
const loadEditJournalEntry = () => import('./pages/ledger/edit-journal-entry.js').then(m => m.renderEditJournalEntry);
const loadNewVoucher = () => import('./pages/ledger/new-voucher.js').then(m => m.renderNewVoucher);
const loadBankAccounts = () => import('./pages/ledger/bank-accounts.js').then(m => m.renderBankAccounts);
const loadProfitLoss = () => import('./pages/ledger/profit-loss.js').then(m => m.renderProfitLoss);
const loadOpeningBalances = () => import('./pages/ledger/opening-balances.js').then(m => m.renderOpeningBalances);
const loadManualLedger = () => import('./pages/ledger/manual-ledger.js').then(m => m.renderManualLedger);
const loadNewManualLedger = () => import('./pages/ledger/new-manual-ledger.js').then(m => m.renderNewManualLedger);

// ─────────────────────────────────────────────
//  Loading spinner
// ─────────────────────────────────────────────

const showLoading = () => {
  let loadingEl = document.getElementById('page-loading');
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.id = 'page-loading';
    loadingEl.innerHTML = `
      <div class="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="flex flex-col items-center gap-4">
          <!-- Spinner -->
          <div class="relative w-12 h-12">
            <div class="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 border-r-indigo-600 animate-spin"></div>
          </div>
          <!-- Loading text -->
          <p class="text-gray-600 font-medium text-sm">Loading...</p>
        </div>
      </div>
    `;
    document.body.appendChild(loadingEl);
  }
  loadingEl.style.display = 'block';
};

const hideLoading = () => {
  const loadingEl = document.getElementById('page-loading');
  if (loadingEl) loadingEl.style.display = 'none';
};

// ─────────────────────────────────────────────
//  Navigation helper
//
//  Wraps every route handler with:
//    1. showLoading() before the import
//    2. try/catch  — shows an error message if
//       the import or render function throws
//    3. finally    — hideLoading() is ALWAYS
//       called, even on error, so the spinner
//       never gets stuck on screen
//
//  Usage:  .on('/path', navigate(loadFn))
//          .on('/path/:id', navigate(loadFn))   ← match.data is forwarded automatically
// ─────────────────────────────────────────────

const navigate = (loadFn) => async (match) => {
  showLoading();
  try {
    const renderFn = await loadFn();
    // Pass router + route params (if any) to the page render function
    await renderFn(router, match?.data);
  } catch (err) {
    console.error('[Router] Failed to load page:', err);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error-container">
          <h2 class="error-heading">Failed to load page</h2>
          <p class="error-message">${err.message || 'An unexpected error occurred.'}</p>
          <a href="/" data-navigo class="error-link">
            Go Home
          </a>
        </div>
      `;
      router.updatePageLinks();
    }
  } finally {
    hideLoading();
  }
};

// ─────────────────────────────────────────────
//  Router
// ─────────────────────────────────────────────

const router = new Navigo('/', { hash: false });

initGlobalToolModal();

router
  // General
  .on('/',                          navigate(loadHome))
  .on('/about',                     navigate(loadAbout))
  .on('/login',                     navigate(loadLogin))
  .on('/dashboard',                 navigate(loadDashboard))
  .on('/profile',                   navigate(loadProfile))
  .on('/super-admin',               navigate(loadSuperAdmin))

  // HR
  .on('/master-roll',               navigate(loadMasterRoll))
  .on('/wages-dashboard',           navigate(loadWagesDashboard))

  // Inventory
  .on('/inventory/sls',             navigate(loadSales))
  .on('/inventory/prs',             navigate(loadPurchase))
  .on('/inventory/stocks',          navigate(loadStocks))
  .on('/inventory/dashboard',       navigate(loadInventoryDashboard))
  .on('/inventory/categories',      navigate(loadInventoryCategories))
  .on('/inventory/suppliers',       navigate(loadInventorySuppliers))
  .on('/inventory/reports',         navigate(loadInventoryReports))
  .on('/inventory/stock-movement',  navigate(loadStockMovement))

  // Accounts
  .on('/accounts-dashboard',        navigate(loadAccountsDashboard))

  // Ledger
  .on('/ledger/journal-entries',    navigate(loadJournalEntries))
  .on('/ledger/journal-entries/new', navigate(loadNewJournalEntry))
  .on('/ledger/journal-entries/:id/edit', navigate(loadEditJournalEntry))
  .on('/ledger/vouchers',           navigate(loadVouchers))
  .on('/ledger/vouchers/new',       navigate(loadNewVoucher))
  .on('/ledger/bank-accounts',      navigate(loadBankAccounts))
  .on('/ledger/opening-balances',   navigate(loadOpeningBalances))
  .on('/ledger/manual-ledger',      navigate(loadManualLedger))
  .on('/ledger/manual-ledger/new',  navigate(loadNewManualLedger))
  .on('/ledger/profit-loss',        navigate(loadProfitLoss))
  .on('/ledger/trial-balance',      navigate(loadTrialBalance))
  .on('/ledger/general-ledger',     navigate(loadGeneralLedger))
  .on('/ledger/account/:account_head', navigate(loadAccountDetails))

  // 404
  .notFound(() => {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error-container">
          <h1 class="error-heading">404 — Page Not Found</h1>
          <p class="error-message">The page you're looking for doesn't exist.</p>
          <a href="/" data-navigo class="error-link">
            Go Home
          </a>
        </div>
      `;
      router.updatePageLinks();
    }
    hideLoading();
  });

// Resolve the initial route on page load
router.resolve();
