import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';

let dashboardCharts = [];
let chartScriptPromise = null;

const DASHBOARD_LINKS = [
  {
    href: '/inventory/stocks',
    title: 'Stock Management',
    subtitle: 'Items, batches, quantity, pricing',
    gradient: 'from-blue-600 via-cyan-500 to-sky-400',
    accent: 'text-blue-100',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    `,
  },
  {
    href: '/inventory/suppliers',
    title: 'Suppliers',
    subtitle: 'Vendor visibility and balance context',
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-400',
    accent: 'text-violet-100',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    `,
  },
  {
    href: '/inventory/reports',
    title: 'Returns / Notes',
    subtitle: 'Issue Credit & Debit Notes',
    gradient: 'from-amber-600 via-orange-500 to-amber-400',
    accent: 'text-amber-100',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    `,
  },
  {
    href: '/inventory/reports',
    title: 'Reports',
    subtitle: 'Bills, totals, cancellations, exports',
    gradient: 'from-amber-500 via-orange-500 to-rose-400',
    accent: 'text-amber-100',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    `,
  },
  {
    href: '/inventory/sls',
    title: 'Sales',
    subtitle: 'Issue invoices and reduce stock',
    gradient: 'from-pink-600 via-rose-500 to-orange-400',
    accent: 'text-pink-100',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    `,
  },
  {
    href: '/inventory/prs',
    title: 'Purchases',
    subtitle: 'Receive stock and supplier bills',
    gradient: 'from-teal-600 via-cyan-500 to-sky-400',
    accent: 'text-teal-100',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h2.25m6-3h3.75m-12 3H4.5m1.386-6.75h13.386a1.125 1.125 0 011.125 1.125v9a1.125 1.125 0 01-1.125 1.125H5.625A1.125 1.125 0 014.5 16.125v-9A1.125 1.125 0 015.625 6z" />
    `,
  },
  {
    href: '/inventory/stock-movement',
    title: 'Stock Movement',
    subtitle: 'Trace inward and outward transactions',
    gradient: 'from-green-600 via-emerald-500 to-teal-400',
    accent: 'text-green-100',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
    `,
  },
];

export async function renderInventoryDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  destroyDashboardCharts();

  const content = `
    <div id="inventory-dashboard-page" class="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-[28px] border border-slate-200/70 bg-[linear-gradient(160deg,_#f0f6ff_0%,_#f8faff_40%,_#eef4f9_100%)]">
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute -left-32 -top-10 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl"></div>
        <div class="absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"></div>
        <div class="absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-300/10 blur-3xl"></div>
      </div>
      <div class="relative p-4 md:p-5">
        <div id="inventory-dashboard-content">${renderLoadingState()}</div>
      </div>
    </div>
  `;

  renderLayout(content, router);
  await initializeInventoryDashboard(router);
}

async function initializeInventoryDashboard(router) {
  const mount = document.getElementById('inventory-dashboard-content');
  if (!mount) return;

  try {
    const raw = await loadDashboardData();
    const model = buildDashboardModel(raw);
    mount.innerHTML = renderDashboard(model);
    router.updatePageLinks();
    bindDashboardActions(router);
    await renderDashboardCharts(model);
  } catch (error) {
    console.error('[INVENTORY_DASHBOARD] Failed to initialize:', error);
    mount.innerHTML = renderErrorState(error.message);
    router.updatePageLinks();
    bindDashboardActions(router);
  }
}

function bindDashboardActions(router) {
  const refreshBtn = document.getElementById('inventory-dashboard-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const mount = document.getElementById('inventory-dashboard-content');
      if (!mount) return;
      destroyDashboardCharts();
      mount.innerHTML = renderLoadingState();
      try {
        const raw = await loadDashboardData();
        const model = buildDashboardModel(raw);
        mount.innerHTML = renderDashboard(model);
        router.updatePageLinks();
        bindDashboardActions(router);
        await renderDashboardCharts(model);
      } catch (error) {
        console.error('[INVENTORY_DASHBOARD] Refresh failed:', error);
        mount.innerHTML = renderErrorState(error.message);
        router.updatePageLinks();
        bindDashboardActions(router);
      }
    });
  }
}

async function loadDashboardData() {
  const [stocksRes, billsRes, partiesRes, movementsRes] = await Promise.all([
    fetchJson('/api/inventory/sales/stocks'),
    fetchJson('/api/inventory/sales/bills'),
    fetchJson('/api/inventory/sales/parties'),
    fetchJson('/api/inventory/purchase/stock-movements?limit=500'),
  ]);

  return {
    stocks: normalizeListPayload(stocksRes),
    bills: normalizeListPayload(billsRes),
    parties: normalizeListPayload(partiesRes),
    movements: normalizeRowsPayload(movementsRes),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`);
  }

  return response.json();
}

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeRowsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function buildDashboardModel({ stocks, bills, parties, movements }) {
  const activeBills = bills.filter((bill) => (bill.status || 'ACTIVE') !== 'CANCELLED');
  const salesBills = activeBills.filter((bill) => getBillCategory(bill) === 'SALES');
  const purchaseBills = activeBills.filter((bill) => getBillCategory(bill) === 'PURCHASE');

  const stockItems = stocks.map((stock) => {
    const qty = toNumber(stock.qty);
    const rate = toNumber(stock.rate);
    const total = toNumber(stock.total) || (qty * rate);
    return {
      ...stock,
      qty,
      rate,
      total,
      health: qty <= 0 ? 'out' : qty <= 5 ? 'low' : qty <= 20 ? 'watch' : 'healthy',
    };
  });

  const totalSkus = stockItems.length;
  const totalUnits = stockItems.reduce((sum, stock) => sum + stock.qty, 0);
  const totalValue = stockItems.reduce((sum, stock) => sum + stock.total, 0);
  const lowStockCount = stockItems.filter((stock) => stock.qty > 0 && stock.qty <= 5).length;
  const outOfStockCount = stockItems.filter((stock) => stock.qty <= 0).length;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const salesThisMonth = sumBillsForMonth(salesBills, currentMonth, currentYear);
  const purchasesThisMonth = sumBillsForMonth(purchaseBills, currentMonth, currentYear);

  const trendMonths = getLastMonths(6).map(({ key, label, month, year }) => ({
    key,
    label,
    sales: sumBillsForMonth(salesBills, month, year),
    purchases: sumBillsForMonth(purchaseBills, month, year),
  }));

  const movementCounts = movements.reduce((acc, row) => {
    const type = (row.type || 'OTHER').toUpperCase();
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const stockValueLeaders = [...stockItems]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((stock) => ({
      name: stock.item || 'Unnamed Item',
      value: stock.total,
      qty: stock.qty,
      health: stock.health,
    }));

  const recentBills = [...activeBills]
    .sort((a, b) => new Date(b.bdate || b.createdAt || 0) - new Date(a.bdate || a.createdAt || 0))
    .slice(0, 7)
    .map((bill) => ({
      id: bill._id,
      type: getBillCategory(bill),
      number: bill.bno || '—',
      party: getBillPartyName(bill),
      amount: toNumber(bill.ntot),
      date: bill.bdate || '',
      href: getBillCategory(bill) === 'PURCHASE' ? '/inventory/prs' : '/inventory/sls',
    }));

  const recentMovements = [...movements]
    .sort((a, b) => new Date(b.bdate || b.createdAt || 0) - new Date(a.bdate || a.createdAt || 0))
    .slice(0, 7)
    .map((movement) => ({
      type: (movement.type || 'OTHER').toUpperCase(),
      item: movement.item || movement.stock_item || 'Unnamed Item',
      party: movement.party_name || movement.supply || 'Internal',
      qty: toNumber(movement.qty),
      value: toNumber(movement.total),
      date: movement.bdate || movement.bill_date || '',
    }));

  const chartEmpty = trendMonths.every((row) => row.sales === 0 && row.purchases === 0)
    && Object.keys(movementCounts).length === 0
    && stockValueLeaders.every((row) => row.value === 0);

  return {
    stocks: stockItems,
    bills: activeBills,
    parties,
    movements,
    compactStats: [
      {
        label: 'SKUs',
        value: formatCompactNumber(totalSkus),
        tone: 'from-sky-500 to-blue-600',
        meta: `${formatCompactNumber(lowStockCount)} low stock`,
      },
      {
        label: 'Units On Hand',
        value: formatCompactNumber(totalUnits),
        tone: 'from-emerald-500 to-green-600',
        meta: `${formatCompactNumber(outOfStockCount)} out of stock`,
      },
      {
        label: 'Stock Value',
        value: formatCurrency(totalValue),
        tone: 'from-violet-500 to-purple-600',
        meta: `${formatCompactNumber(stockValueLeaders.length)} high-value leaders`,
      },
      {
        label: 'Parties',
        value: formatCompactNumber(parties.length),
        tone: 'from-amber-500 to-orange-600',
        meta: `${formatCompactNumber(activeBills.length)} active bills`,
      },
      {
        label: 'Sales This Month',
        value: formatCurrency(salesThisMonth),
        tone: 'from-rose-500 to-pink-600',
        meta: `${formatCompactNumber(salesBills.length)} sales bills`,
      },
      {
        label: 'Purchase This Month',
        value: formatCurrency(purchasesThisMonth),
        tone: 'from-cyan-500 to-teal-600',
        meta: `${formatCompactNumber(purchaseBills.length)} purchase bills`,
      },
    ],
    lowStockCount,
    outOfStockCount,
    totalValue,
    salesThisMonth,
    purchasesThisMonth,
    trendMonths,
    movementCounts,
    stockValueLeaders,
    recentBills,
    recentMovements,
    chartEmpty,
  };
}

function renderDashboard(model) {
  const now = new Date();
  const refreshedAt = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return `
    <section class="space-y-5">

      <!-- Header -->
      <header class="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/95 shadow-[0_4px_32px_-8px_rgba(15,23,42,0.14)] backdrop-blur-sm">
        <div class="h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500"></div>
        <div class="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-700">
                <span class="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_6px_2px_rgba(14,165,233,0.5)]"></span>
                Live
              </span>
              <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-500">${dateStr}</span>
              <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-500">Updated ${refreshedAt}</span>
            </div>
            <div>
              <h1 class="text-2xl font-black tracking-tight text-slate-900 md:text-[1.75rem]">Inventory Dashboard</h1>
              <p class="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">Stock health, bill flow, movement activity, and financial exposure at a glance.</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 lg:shrink-0">
            <div class="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50/80 p-1.5">
              <a href="/inventory/prs" data-navigo
                 class="inline-flex items-center gap-1.5 rounded-[14px] border border-teal-200 bg-white px-3.5 py-2 text-xs font-bold text-teal-700 shadow-sm transition hover:bg-teal-50 hover:border-teal-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-3 w-3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                New Purchase
              </a>
              <a href="/inventory/sls" data-navigo
                 class="inline-flex items-center gap-1.5 rounded-[14px] border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 hover:border-rose-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-3 w-3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                New Sale
              </a>
            </div>
            <a href="/inventory/reports" data-navigo
               class="inline-flex items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              Reports
            </a>
            <button id="inventory-dashboard-refresh" type="button"
                    class="inline-flex items-center gap-2 rounded-[16px] bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <!-- KPI stat cards -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        ${model.compactStats.map(renderStatCard).join('')}
      </section>

      <!-- Main body: charts left, feeds right -->
      <section class="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div class="space-y-5">

          <!-- Trend chart -->
          <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.10)]">
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">6-Month Trend</p>
                <h2 class="mt-0.5 text-base font-bold text-slate-900">Sales vs Purchase Value</h2>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <span class="h-2 w-5 rounded-full bg-rose-400 opacity-80"></span>Sales
                </div>
                <div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <span class="h-2 w-5 rounded-full bg-cyan-400 opacity-80"></span>Purchase
                </div>
              </div>
            </div>
            <div class="px-4 pb-4 pt-3">
              <div class="h-[230px]"><canvas id="inventory-trend-chart" class="h-full w-full"></canvas></div>
            </div>
          </div>

          <!-- Value + Movement row -->
          <div class="grid gap-5 lg:grid-cols-2">
            <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.10)]">
              <div class="border-b border-slate-100 px-5 py-4">
                <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Value Leaders</p>
                <h2 class="mt-0.5 text-base font-bold text-slate-900">Top stock by value</h2>
              </div>
              <div class="px-4 pb-4 pt-3">
                <div class="h-[220px]"><canvas id="inventory-value-chart" class="h-full w-full"></canvas></div>
              </div>
            </div>
            <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.10)]">
              <div class="border-b border-slate-100 px-5 py-4">
                <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Movement Mix</p>
                <h2 class="mt-0.5 text-base font-bold text-slate-900">Transaction composition</h2>
              </div>
              <div class="px-4 pb-4 pt-3">
                <div class="h-[220px]"><canvas id="inventory-movement-chart" class="h-full w-full"></canvas></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="space-y-5">

          <!-- Dark signals card -->
          <div class="overflow-hidden rounded-[22px] bg-slate-900 shadow-[0_8px_32px_-8px_rgba(2,6,23,0.55)]">
            <div class="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">Stock Signals</p>
                <h2 class="mt-0.5 text-base font-bold text-white">Priority inventory alerts</h2>
              </div>
              <div class="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-right">
                <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total value</p>
                <p class="mt-0.5 text-sm font-black text-white">${formatCurrency(model.totalValue)}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 p-4">
              ${renderSignalCard('Low Stock', formatCompactNumber(model.lowStockCount), '1–5 units remaining', 'amber')}
              ${renderSignalCard('Out of Stock', formatCompactNumber(model.outOfStockCount), 'Zero quantity', 'rose')}
              ${renderSignalCard('Active Bills', formatCompactNumber(model.bills.length), 'In register', 'sky')}
              ${renderSignalCard('Movements', formatCompactNumber(model.movements.length), 'Recent rows loaded', 'emerald')}
            </div>
          </div>

          <!-- Recent bills -->
          <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.10)]">
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Latest Bills</p>
                <h2 class="mt-0.5 text-base font-bold text-slate-900">Recent transactions</h2>
              </div>
              <a href="/inventory/reports" data-navigo
                 class="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700 transition hover:bg-sky-100">
                View all
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-3 w-3"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </a>
            </div>
            <div class="p-3">${renderRecentBills(model.recentBills)}</div>
          </div>

          <!-- Recent movements -->
          <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.10)]">
            <div class="border-b border-slate-100 px-5 py-4">
              <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Movement Feed</p>
              <h2 class="mt-0.5 text-base font-bold text-slate-900">Stock in &amp; out</h2>
            </div>
            <div class="p-3">${renderRecentMovements(model.recentMovements)}</div>
          </div>

        </div>
      </section>

      <!-- Quick-access link cards -->
      <section class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/90 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]">
        <div class="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Quick Access</p>
            <h2 class="mt-0.5 text-base font-bold text-slate-900">Inventory modules</h2>
          </div>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
            ${model.chartEmpty ? 'Charts will populate as transactions accumulate' : 'Reflecting live activity'}
          </span>
        </div>
        <div class="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          ${DASHBOARD_LINKS.map(renderLinkCard).join('')}
        </div>
      </section>

    </section>
  `;
}

function renderStatCard(stat) {
  return `
    <article class="group relative overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/95 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.10)] transition hover:shadow-[0_4px_24px_-6px_rgba(15,23,42,0.16)] hover:-translate-y-px">
      <div class="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${stat.tone}"></div>
      <div class="px-5 pb-5 pt-5">
        <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">${escapeHtml(stat.label)}</p>
        <div class="mt-2 text-[1.6rem] font-black tracking-tight text-slate-900 leading-none">${escapeHtml(stat.value)}</div>
        <div class="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
          <span class="h-1.5 w-1.5 rounded-full bg-gradient-to-br ${stat.tone} opacity-80"></span>
          <span class="text-[11px] font-semibold text-slate-500">${escapeHtml(stat.meta)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderSignalCard(title, value, subtitle, tone) {
  const toneMap = {
    amber:   { card: 'border-amber-400/20 bg-amber-500/10',   dot: 'bg-amber-400',   text: 'text-amber-300'   },
    rose:    { card: 'border-rose-400/20 bg-rose-500/10',     dot: 'bg-rose-400',     text: 'text-rose-300'    },
    sky:     { card: 'border-sky-400/20 bg-sky-500/10',       dot: 'bg-sky-400',      text: 'text-sky-300'     },
    emerald: { card: 'border-emerald-400/20 bg-emerald-500/10', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  };
  const t = toneMap[tone] || toneMap.sky;

  return `
    <div class="rounded-[18px] border ${t.card} p-4">
      <div class="flex items-center gap-1.5 mb-2.5">
        <span class="h-1.5 w-1.5 rounded-full ${t.dot}"></span>
        <span class="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">${escapeHtml(title)}</span>
      </div>
      <div class="text-[1.8rem] font-black tracking-tight text-white leading-none">${escapeHtml(value)}</div>
      <div class="mt-2 text-[11px] font-semibold ${t.text}">${escapeHtml(subtitle)}</div>
    </div>
  `;
}

function renderRecentBills(bills) {
  if (!bills.length) {
    return renderInlineEmpty('No bills yet', 'Create a sales or purchase bill to start populating the dashboard.');
  }

  return `
    <div class="space-y-1.5">
      ${bills.map((bill) => {
        const isPurchase = bill.type === 'PURCHASE';
        return `
        <a href="${bill.href}" data-navigo
           class="group flex items-center gap-3 rounded-[16px] border border-transparent px-3.5 py-2.5 transition hover:border-slate-200 hover:bg-slate-50/80">
          <!-- type badge -->
          <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[10px] font-black ${isPurchase ? 'bg-teal-100 text-teal-700' : 'bg-rose-100 text-rose-700'}">
            ${isPurchase ? 'PUR' : 'SLS'}
          </span>
          <!-- details -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-bold text-slate-800">${escapeHtml(bill.number)}</span>
            </div>
            <div class="truncate text-[11px] text-slate-500">${escapeHtml(bill.party)}</div>
          </div>
          <!-- amount + date -->
          <div class="shrink-0 text-right">
            <div class="text-sm font-black text-slate-900">${escapeHtml(formatCurrency(bill.amount))}</div>
            <div class="text-[10px] text-slate-400">${escapeHtml(formatDate(bill.date))}</div>
          </div>
        </a>
        `;
      }).join('')}
    </div>
  `;
}

function renderRecentMovements(movements) {
  if (!movements.length) {
    return renderInlineEmpty('No movement history yet', 'Stock movements will appear here once purchases, sales, or internal receipts are posted.');
  }

  return `
    <div class="space-y-1.5">
      ${movements.map((movement) => {
        const isPurchase = movement.type === 'PURCHASE';
        const isSale = movement.type === 'SALE';
        const badgeClass = isPurchase ? 'bg-emerald-100 text-emerald-700' : isSale ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700';
        const arrowPath = isPurchase
          ? 'M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3'
          : isSale
          ? 'M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18'
          : 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5';
        const arrowColor = isPurchase ? 'text-emerald-600' : isSale ? 'text-rose-600' : 'text-sky-600';
        return `
        <div class="flex items-center gap-3 rounded-[16px] border border-slate-100/80 bg-slate-50/60 px-3.5 py-2.5">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${badgeClass}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-3.5 w-3.5 ${arrowColor}">
              <path stroke-linecap="round" stroke-linejoin="round" d="${arrowPath}" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-bold text-slate-800">${escapeHtml(movement.item)}</div>
            <div class="flex items-center gap-1.5">
              <span class="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">${escapeHtml(movement.type)}</span>
              <span class="truncate text-[11px] text-slate-500">${escapeHtml(movement.party)}</span>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div class="text-sm font-black text-slate-900">${escapeHtml(formatCompactNumber(movement.qty))}</div>
            <div class="text-[10px] text-slate-400">${escapeHtml(formatDate(movement.date))}</div>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderLinkCard(link) {
  return `
    <a href="${link.href}" data-navigo
       class="group relative overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)]">
      <!-- gradient header -->
      <div class="relative bg-gradient-to-br ${link.gradient} p-4 text-white">
        <!-- subtle noise texture overlay removed due to CSP restrictions -->
        <div class="relative flex items-start justify-between gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"
               class="h-7 w-7 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-4deg]">
            ${link.icon}
          </svg>
          <div class="rounded-full bg-white/20 p-1.5 transition group-hover:bg-white/30">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-3 w-3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
        </div>
        <div class="relative mt-3">
          <div class="text-sm font-bold leading-snug">${escapeHtml(link.title)}</div>
          <div class="mt-0.5 text-[11px] ${link.accent} leading-relaxed">${escapeHtml(link.subtitle)}</div>
        </div>
      </div>
      <!-- footer -->
      <div class="flex items-center justify-between px-4 py-2.5">
        <span class="text-xs font-bold text-slate-500 transition group-hover:text-slate-800">Open module</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"
             class="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </a>
  `;
}

function renderLoadingState() {
  const skeletonCard = `
    <div class="overflow-hidden rounded-[20px] border border-slate-200 bg-white/90">
      <div class="h-[3px] animate-pulse bg-slate-200"></div>
      <div class="px-5 pb-5 pt-5">
        <div class="h-2.5 w-16 animate-pulse rounded-full bg-slate-200"></div>
        <div class="mt-3 h-7 w-20 animate-pulse rounded-lg bg-slate-200"></div>
        <div class="mt-4 border-t border-slate-100 pt-3">
          <div class="h-2 w-28 animate-pulse rounded-full bg-slate-100"></div>
        </div>
      </div>
    </div>`;

  return `
    <div class="space-y-5">
      <!-- header skeleton -->
      <div class="overflow-hidden rounded-[24px] border border-slate-200 bg-white/95">
        <div class="h-[3px] animate-pulse bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200"></div>
        <div class="p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="h-5 w-12 animate-pulse rounded-full bg-slate-200"></div>
            <div class="h-5 w-28 animate-pulse rounded-full bg-slate-100"></div>
          </div>
          <div class="h-7 w-64 animate-pulse rounded-lg bg-slate-200"></div>
          <div class="mt-2 h-3.5 w-80 animate-pulse rounded-full bg-slate-100"></div>
        </div>
      </div>
      <!-- stat card skeletons -->
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        ${Array.from({ length: 6 }).map(() => skeletonCard).join('')}
      </div>
      <!-- chart skeletons -->
      <div class="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div class="space-y-5">
          <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/90">
            <div class="border-b border-slate-100 px-5 py-4">
              <div class="h-2.5 w-20 animate-pulse rounded-full bg-slate-200"></div>
              <div class="mt-2 h-5 w-44 animate-pulse rounded-lg bg-slate-200"></div>
            </div>
            <div class="p-4"><div class="h-[220px] animate-pulse rounded-[14px] bg-slate-100"></div></div>
          </div>
          <div class="grid gap-5 lg:grid-cols-2">
            <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/90">
              <div class="border-b border-slate-100 px-5 py-4"><div class="h-2.5 w-24 animate-pulse rounded-full bg-slate-200"></div></div>
              <div class="p-4"><div class="h-[200px] animate-pulse rounded-[14px] bg-slate-100"></div></div>
            </div>
            <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/90">
              <div class="border-b border-slate-100 px-5 py-4"><div class="h-2.5 w-24 animate-pulse rounded-full bg-slate-200"></div></div>
              <div class="p-4"><div class="h-[200px] animate-pulse rounded-[14px] bg-slate-100"></div></div>
            </div>
          </div>
        </div>
        <div class="space-y-5">
          <div class="overflow-hidden rounded-[22px] bg-slate-800">
            <div class="border-b border-white/10 px-5 py-4"><div class="h-2.5 w-24 animate-pulse rounded-full bg-white/10"></div></div>
            <div class="grid grid-cols-2 gap-3 p-4">
              ${Array.from({ length: 4 }).map(() => `<div class="h-20 animate-pulse rounded-[18px] bg-white/5"></div>`).join('')}
            </div>
          </div>
          <div class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/90">
            <div class="border-b border-slate-100 px-5 py-4"><div class="h-2.5 w-28 animate-pulse rounded-full bg-slate-200"></div></div>
            <div class="p-3 space-y-1.5">
              ${Array.from({ length: 4 }).map(() => `<div class="h-12 animate-pulse rounded-[16px] bg-slate-100"></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderErrorState(message) {
  return `
    <div class="overflow-hidden rounded-[22px] border border-rose-200/80 bg-white/95 shadow-[0_4px_24px_-8px_rgba(244,63,94,0.12)]">
      <div class="h-[3px] bg-gradient-to-r from-rose-500 to-orange-400"></div>
      <div class="p-6">
        <div class="flex items-start gap-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-rose-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5 text-rose-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-rose-500">Load Error</p>
            <h2 class="mt-0.5 text-xl font-black tracking-tight text-slate-900">Unable to load inventory data</h2>
            <p class="mt-2 max-w-xl text-sm leading-6 text-slate-500">${escapeHtml(message || 'Unexpected dashboard failure. Please retry or check the server logs.')}</p>
          </div>
        </div>
        <div class="mt-5 flex flex-wrap gap-2.5 border-t border-slate-100 pt-5">
          <button id="inventory-dashboard-refresh" type="button"
                  class="inline-flex items-center gap-2 rounded-[14px] bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Retry
          </button>
          <a href="/inventory/reports" data-navigo
             class="inline-flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            Open Reports
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderInlineEmpty(title, description) {
  return `
    <div class="rounded-[16px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center">
      <div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-100">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="h-5 w-5 text-slate-400">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
      </div>
      <div class="text-sm font-bold text-slate-700">${escapeHtml(title)}</div>
      <div class="mt-1 text-xs leading-relaxed text-slate-500">${escapeHtml(description)}</div>
    </div>
  `;
}

async function renderDashboardCharts(model) {
  const trendRoot = document.getElementById('inventory-trend-chart');
  const movementRoot = document.getElementById('inventory-movement-chart');
  const valueRoot = document.getElementById('inventory-value-chart');

  if (!trendRoot || !movementRoot || !valueRoot) return;

  const Chart = await loadChartLibrary();

  const trendChart = new Chart(trendRoot, {
    type: 'line',
    data: {
      labels: model.trendMonths.map((row) => row.label),
      datasets: [
        {
          label: 'Sales',
          data: model.trendMonths.map((row) => row.sales),
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.10)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 4,
        },
        {
          label: 'Purchases',
          data: model.trendMonths.map((row) => row.purchases),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.10)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 4,
        },
      ],
    },
    options: buildChartOptions({
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          ticks: { callback: (value) => formatAxisCurrency(value) },
          grid: { color: 'rgba(148,163,184,0.12)' },
        },
        x: { grid: { display: false } },
      },
    }),
  });

  const movementEntries = Object.entries(model.movementCounts);
  const movementChart = new Chart(movementRoot, {
    type: 'doughnut',
    data: {
      labels: movementEntries.length ? movementEntries.map(([label]) => label) : ['No Activity'],
      datasets: [{
        data: movementEntries.length ? movementEntries.map(([, value]) => value) : [1],
        backgroundColor: movementEntries.length
          ? ['#10b981', '#f43f5e', '#0ea5e9', '#f59e0b', '#8b5cf6', '#14b8a6']
          : ['#cbd5e1'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: buildChartOptions({
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 16,
            color: '#475569',
            font: { size: 11, weight: '600' },
          },
        },
      },
    }),
  });

  const leaders = model.stockValueLeaders.length
    ? model.stockValueLeaders
    : [{ name: 'No stock value yet', value: 0 }];

  const valueChart = new Chart(valueRoot, {
    type: 'bar',
    data: {
      labels: leaders.map((row) => truncateLabel(row.name, 14)),
      datasets: [{
        label: 'Stock Value',
        data: leaders.map((row) => row.value),
        borderRadius: 10,
        backgroundColor: ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#059669', '#f59e0b'],
        borderSkipped: false,
      }],
    },
    options: buildChartOptions({
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { callback: (value) => formatAxisCurrency(value) },
          grid: { color: 'rgba(148,163,184,0.12)' },
        },
        y: { grid: { display: false } },
      },
    }),
  });

  dashboardCharts.push(trendChart, movementChart, valueChart);
}

function destroyDashboardCharts() {
  dashboardCharts.forEach((chart) => {
    try {
      chart.destroy();
    } catch (error) {
      console.warn('[INVENTORY_DASHBOARD] Failed to destroy chart:', error);
    }
  });
  dashboardCharts = [];
}

function buildChartOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        labels: {
          color: '#475569',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 18,
          font: { size: 11, weight: '600' },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 12,
        displayColors: true,
      },
    },
    scales: {},
    ...overrides,
  };
}

async function loadChartLibrary() {
  if (window.Chart) return window.Chart;
  if (!chartScriptPromise) {
    chartScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-inventory-chart]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Chart), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load local chart library')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = '/public/cdns/chart.umd.min.js';
      script.async = true;
      script.dataset.inventoryChart = 'true';
      script.onload = () => {
        if (window.Chart) resolve(window.Chart);
        else reject(new Error('Local chart library loaded without Chart global'));
      };
      script.onerror = () => reject(new Error('Failed to load local chart library'));
      document.head.appendChild(script);
    });
  }
  return chartScriptPromise;
}

function getBillPartyName(bill) {
  return getBillCategory(bill) === 'PURCHASE'
    ? (bill?.supply || 'Supplier')
    : (bill?.supply || 'Customer');
}

function getBillCategory(bill) {
  const rawType = String(bill?.btype || '').toUpperCase();
  const billNo = String(bill?.bno || '').toUpperCase();

  if (rawType === 'PURCHASE' || billNo.startsWith('PUR/')) return 'PURCHASE';
  return 'SALES';
}

function sumBillsForMonth(bills, month, year) {
  return bills.reduce((sum, bill) => {
    const dt = parseBillDate(bill.bdate || bill.createdAt);
    if (!dt) return sum;
    return dt.getMonth() === month && dt.getFullYear() === year
      ? sum + toNumber(bill.ntot)
      : sum;
  }, 0);
}

function getLastMonths(count) {
  const months = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push({
      key: `${dt.getFullYear()}-${dt.getMonth() + 1}`,
      label: dt.toLocaleDateString('en-IN', { month: 'short' }),
      month: dt.getMonth(),
      year: dt.getFullYear(),
    });
  }
  return months;
}

function parseBillDate(value) {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: value >= 100000 ? 0 : 2,
  }).format(toNumber(value));
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

function formatAxisCurrency(value) {
  const amount = toNumber(value);
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toFixed(0)}`;
}

function formatDate(value) {
  const dt = parseBillDate(value);
  if (!dt) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function truncateLabel(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
