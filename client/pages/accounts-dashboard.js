import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { api } from '../utils/api.js';

let accountsCharts = [];
let chartScriptPromise = null;

const QUICK_ACTIONS = [
  {
    href: '/ledger/opening-balances',
    title: 'Opening Balances',
    subtitle: 'Set up initial account balances',
    tone: 'from-indigo-600 to-blue-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    `,
  },
  {
    href: '/ledger/journal-entries',
    title: 'Journal Entries',
    subtitle: 'Manual accounting adjustments',
    tone: 'from-violet-600 to-purple-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    `,
  },
  {
    href: '/ledger/vouchers',
    title: 'Vouchers',
    subtitle: 'Receipts and payments',
    tone: 'from-emerald-600 to-green-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    `,
  },
  {
    href: '/ledger/bank-accounts',
    title: 'Bank Accounts',
    subtitle: 'Firm bank masters and defaults',
    tone: 'from-cyan-600 to-sky-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6h16.5M6 4.5h12A1.5 1.5 0 0119.5 6v12A1.5 1.5 0 0118 19.5H6A1.5 1.5 0 014.5 18V6A1.5 1.5 0 016 4.5z" />
    `,
  },
  {
    href: '/ledger/trial-balance',
    title: 'Trial Balance',
    subtitle: 'Balance check and review',
    tone: 'from-amber-500 to-orange-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    `,
  },
  {
    href: '/ledger/general-ledger',
    title: 'General Ledger',
    subtitle: 'Complete ledger reporting',
    tone: 'from-rose-600 to-pink-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006.175 4.5M12 6.042A8.967 8.967 0 0118.825 4.5M12 6.042a8.968 8.968 0 016.175 1.542m-6.175-1.542a8.968 8.968 0 00-6.175 1.542m0 0A9 9 0 0112 3m0 0a9 9 0 019 9m-9 9a9 9 0 01-9-9m9 9a9 9 0 019-9" />
    `,
  },
  {
    href: '/ledger/profit-loss',
    title: 'Profit & Loss',
    subtitle: 'Income, COGS and net margin',
    tone: 'from-violet-600 to-indigo-600',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    `,
  },
];

export async function renderAccountsDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  destroyAccountsCharts();

  const content = `
    <div id="accounts-dashboard-page" class="min-h-[calc(100vh-6rem)] bg-slate-100">
      <div id="accounts-dashboard-content">${renderLoadingState()}</div>
    </div>
  `;

  renderLayout(content, router);
  await initializeAccountsDashboard(router);
}

async function initializeAccountsDashboard(router) {
  const mount = document.getElementById('accounts-dashboard-content');
  if (!mount) return;

  try {
    const raw = await loadAccountsData();
    const model = buildAccountsModel(raw);
    mount.innerHTML = renderDashboard(model);
    router.updatePageLinks();
    bindDashboardActions(router, model);
    await renderDashboardCharts(model);
  } catch (error) {
    console.error('[ACCOUNTS_DASHBOARD] Failed to initialize:', error);
    mount.innerHTML = renderErrorState(error.message);
    router.updatePageLinks();
    bindDashboardActions(router, null);
  }
}

function bindDashboardActions(router, model) {
  const refreshBtn = document.getElementById('accounts-dashboard-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const mount = document.getElementById('accounts-dashboard-content');
      if (!mount) return;
      destroyAccountsCharts();
      mount.innerHTML = renderLoadingState();
      try {
        const raw = await loadAccountsData();
        const model = buildAccountsModel(raw);
        mount.innerHTML = renderDashboard(model);
        router.updatePageLinks();
        bindDashboardActions(router, model);
        await renderDashboardCharts(model);
      } catch (error) {
        console.error('[ACCOUNTS_DASHBOARD] Refresh failed:', error);
        mount.innerHTML = renderErrorState(error.message);
        router.updatePageLinks();
        bindDashboardActions(router, null);
      }
    });
  }

  bindTableTabs();
  if (model) bindSubLedgerModal(model, router);
}

async function loadAccountsData() {
  const [accounts, accountTypes, vouchersSummary, journalSummary] = await Promise.all([
    api.get('/api/ledger/accounts'),
    api.get('/api/ledger/account-types'),
    api.get('/api/ledger/vouchers-summary'),
    api.get('/api/ledger/journal-entries-summary'),
  ]);

  return {
    accounts: Array.isArray(accounts) ? accounts : [],
    accountTypes: Array.isArray(accountTypes) ? accountTypes : [],
    vouchersSummary: vouchersSummary || {},
    journalSummary: journalSummary || {},
  };
}

function buildAccountsModel({ accounts, accountTypes, vouchersSummary, journalSummary }) {
  const normalizedAccounts = accounts.map((account) => {
    const totalDebit = toNumber(account.total_debit);
    const totalCredit = toNumber(account.total_credit);
    const balance = toNumber(account.balance);
    return {
      ...account,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance,
      absoluteBalance: Math.abs(balance),
      balanceLabel: balance >= 0 ? 'DR' : 'CR',
    };
  });

  const normalizedTypes = accountTypes.map((summary) => ({
    ...summary,
    account_count: toNumber(summary.account_count),
    total_debit: toNumber(summary.total_debit),
    total_credit: toNumber(summary.total_credit),
    total_balance: toNumber(summary.total_balance),
  }));

  const totalAccounts = normalizedAccounts.length;
  const totalDebit = normalizedAccounts.reduce((sum, account) => sum + account.total_debit, 0);
  const totalCredit = normalizedAccounts.reduce((sum, account) => sum + account.total_credit, 0);
  const netExposure = totalDebit - totalCredit;

  const largestDrAccounts = [...normalizedAccounts]
    .filter((account) => account.balance > 0)
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 6);

  const largestCrAccounts = [...normalizedAccounts]
    .filter((account) => account.balance < 0)
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 6);

  const typeLeaderboard = [...normalizedTypes]
    .sort((a, b) => Math.abs(b.total_balance) - Math.abs(a.total_balance))
    .slice(0, 6);

  const accountRows = [...normalizedAccounts]
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 12);

  return {
    accounts: normalizedAccounts,
    accountTypes: normalizedTypes,
    vouchersSummary,
    journalSummary,
    totalAccounts,
    totalDebit,
    totalCredit,
    netExposure,
    largestDrAccounts,
    largestCrAccounts,
    typeLeaderboard,
    accountRows,
    compactStats: [
      {
        label: 'Ledger Accounts',
        value: formatCompactNumber(totalAccounts),
        meta: `${formatCompactNumber(normalizedTypes.length)} account types`,
        tone: 'from-sky-500 to-blue-600',
      },
      {
        label: 'Total Debit',
        value: formatCurrency(totalDebit),
        meta: `${formatCompactNumber(largestDrAccounts.length)} major debit heads`,
        tone: 'from-emerald-500 to-green-600',
      },
      {
        label: 'Total Credit',
        value: formatCurrency(totalCredit),
        meta: `${formatCompactNumber(largestCrAccounts.length)} major credit heads`,
        tone: 'from-rose-500 to-pink-600',
      },
      {
        label: 'Net Position',
        value: `${formatCurrency(Math.abs(netExposure))} ${netExposure >= 0 ? 'DR' : 'CR'}`,
        meta: 'Ledger-wide exposure',
        tone: 'from-violet-500 to-purple-600',
      },
      {
        label: 'Receipts',
        value: formatCurrency(vouchersSummary.total_receipts || 0),
        meta: `${formatCompactNumber(vouchersSummary.recent_transactions_count || 0)} recent voucher groups`,
        tone: 'from-teal-500 to-cyan-600',
      },
      {
        label: 'Journal Entries',
        value: formatCompactNumber(journalSummary.total_journal_entries || 0),
        meta: `${formatCompactNumber(journalSummary.recent_journal_entries_count || 0)} in last 30 days`,
        tone: 'from-amber-500 to-orange-600',
      },
    ],
  };
}

function renderDashboard(model) {
  return `
    <section>

      <!-- ══ TOP COMMAND BAR ══ -->
      <header class="bg-white border-b border-slate-200 px-6 py-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4 min-w-0">
          <div class="flex items-center gap-2 shrink-0">
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <span class="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-600">Live</span>
          </div>
          <div class="w-px h-6 bg-slate-300"></div>
          <h1 class="text-base font-bold text-slate-900 tracking-tight truncate">Accounts &amp; Ledger Dashboard</h1>
          <div class="hidden md:flex items-center gap-2 ml-2">
            <span class="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">DR</span>
            <span class="text-sm font-black text-emerald-600 font-mono">${formatCurrency(model.totalDebit)}</span>
            <span class="mx-2 text-slate-400">·</span>
            <span class="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">CR</span>
            <span class="text-sm font-black text-rose-600 font-mono">${formatCurrency(model.totalCredit)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <a href="/ledger/journal-entries/new" data-navigo class="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-3 py-2 text-[11px] font-bold text-white transition shadow-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Journal
          </a>
          <a href="/ledger/vouchers/new" data-navigo class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white transition shadow-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Voucher
          </a>
          <a href="/ledger/profit-loss" data-navigo class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-300 hover:bg-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 transition">P&amp;L</a>
          <a href="/ledger/general-ledger" data-navigo class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-300 hover:bg-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 transition">Ledger</a>
          <button id="accounts-dashboard-refresh" type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-300 hover:bg-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
            Refresh
          </button>
        </div>
      </header>

      <!-- ══ KPI TICKER STRIP ══ -->
      <div class="flex divide-x divide-slate-200 border-b border-slate-200 bg-white shadow-sm overflow-x-auto">
        ${model.compactStats.map((stat, i) => renderStatCard(stat, i)).join('')}
      </div>

      <!-- ══ MAIN CONTENT GRID (3-COLUMN LAYOUT) ══ -->
      <div class="grid gap-4 bg-slate-100 p-4 lg:grid-cols-3">

        <!-- ROW 1, COL 1: Debit & Credit by Type Chart -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Account Type Mix</p>
              <h2 class="text-sm font-bold text-slate-900 mt-1">Debit &amp; Credit by Type</h2>
            </div>
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-500 inline-block"></span>DR</span>
              <span class="flex items-center gap-1.5 text-[10px] font-semibold text-rose-600"><span class="h-2.5 w-2.5 rounded-sm bg-rose-500 inline-block"></span>CR</span>
            </div>
          </div>
          <div class="h-[240px]">
            <canvas id="accounts-type-chart" class="h-full w-full"></canvas>
          </div>
        </div>

        <!-- ROW 1, COL 2: Top Account Exposure Chart -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="mb-4">
            <p class="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Balance Leaders</p>
            <h2 class="text-sm font-bold text-slate-900 mt-1">Top account exposure</h2>
          </div>
          <div class="h-[240px]">
            <canvas id="accounts-balance-chart" class="h-full w-full"></canvas>
          </div>
        </div>

        <!-- ROW 1, COL 3: Transaction Signals (Voucher Pulse) -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Voucher Pulse</p>
              <h2 class="text-sm font-bold text-slate-900 mt-1">Transaction signals</h2>
            </div>
            <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-right">
              <div class="text-[8px] text-slate-500 uppercase tracking-wide font-semibold">Net</div>
              <div class="text-xs font-black text-slate-900 font-mono leading-tight">${formatCurrency(model.vouchersSummary.net_position || 0)}</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            ${renderSignalCard('Receipts', formatCurrency(model.vouchersSummary.total_receipts || 0), 'Total in', 'emerald')}
            ${renderSignalCard('Payments', formatCurrency(model.vouchersSummary.total_payments || 0), 'Total out', 'rose')}
            ${renderSignalCard('Vouchers', formatCompactNumber(model.vouchersSummary.recent_transactions_count || 0), 'Last 30 days', 'sky')}
            ${renderSignalCard('Journals', formatCompactNumber(model.journalSummary.recent_journal_entries_count || 0), 'Last 30 days', 'amber')}
          </div>
        </div>

        <!-- ROW 2, COL 1: Type Leaderboard (By net balance) -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Type Leaderboard</p>
              <h2 class="text-sm font-bold text-slate-900 mt-1">By net balance</h2>
            </div>
            <a href="/ledger/trial-balance" data-navigo class="text-[10px] font-bold text-sky-600 hover:text-sky-700 transition">Trial →</a>
          </div>
          ${renderAccountTypes(model.typeLeaderboard)}
        </div>

        <!-- ROW 2, COL 2: Quick Actions (Accounting workflow) -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="mb-4">
            <p class="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Quick Actions</p>
            <h2 class="text-sm font-bold text-slate-900 mt-1">Accounting workflow</h2>
          </div>
          <div class="grid grid-cols-1 gap-2">
            ${QUICK_ACTIONS.slice(0, 3).map(renderQuickAction).join('')}
          </div>
        </div>

        <!-- ROW 2, COL 3: Reports & Analysis -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="mb-4">
            <p class="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Reports &amp; Analysis</p>
            <h2 class="text-sm font-bold text-slate-900 mt-1">Additional workflows</h2>
          </div>
          <div class="grid grid-cols-1 gap-2">
            ${QUICK_ACTIONS.slice(3).map(renderQuickAction).join('')}
          </div>
        </div>
      </div>

      <!-- ══ LEDGER TABLES ══ -->
      <div class="bg-white border-t border-slate-200 mx-4 mb-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex items-center justify-between px-5 pt-5 pb-4 flex-wrap gap-3 border-b border-slate-200">
          <div>
            <p class="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Ledger Tables</p>
            <h2 class="text-sm font-bold text-slate-900 mt-1">Account heads &amp; account types</h2>
          </div>
          <div class="flex items-center gap-3">
            <div class="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
              <button type="button" data-accounts-tab-button="account-heads"
                class="accounts-table-tab-button rounded-md px-4 py-2 text-[11px] font-semibold text-slate-600 transition hover:text-slate-900">
                Account Heads
              </button>
              <button type="button" data-accounts-tab-button="account-types"
                class="accounts-table-tab-button rounded-md bg-slate-900 px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition">
                Account Types
              </button>
            </div>
            <a href="/ledger/general-ledger" data-navigo class="text-[10px] font-bold text-sky-600 hover:text-sky-700 transition">Full Ledger →</a>
          </div>
        </div>

        <div data-accounts-tab-panel="account-heads" class="hidden">
          ${renderAccountsTable(model.accountRows)}
        </div>
        <div data-accounts-tab-panel="account-types">
          ${renderAccountTypesTable(model.accountTypes)}
        </div>
      </div>

      <!-- ══ SUB-LEDGER MODAL ══ -->
      <div id="subleder-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
          <div id="subleder-header" class="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-2">
                <div id="subleder-badge" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] bg-slate-100 text-slate-700"></div>
                <h2 id="subleder-title" class="text-xl font-black tracking-tight text-slate-900 leading-tight">—</h2>
              </div>
              <button id="subleder-close"
                      class="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200 hover:border-slate-300 transition text-xl leading-none">
                ×
              </button>
            </div>
          </div>
          <div id="subleder-summary" class="flex-shrink-0 grid grid-cols-3 gap-px bg-slate-100 border-b border-slate-200">
          </div>
          <div class="overflow-y-auto flex-1">
            <table class="w-full text-sm">
              <thead class="sticky top-0 z-10">
                <tr class="bg-slate-50 border-b border-slate-200">
                  <th class="px-6 py-3 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Account Head</th>
                  <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Debits</th>
                  <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Credits</th>
                  <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Balance</th>
                  <th class="px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Detail</th>
                </tr>
              </thead>
              <tbody id="subleder-body" class="divide-y divide-slate-200 bg-white"></tbody>
            </table>
          </div>
          <div id="subleder-footer" class="flex-shrink-0 rounded-b-2xl bg-gradient-to-r from-slate-50 to-white border-t border-slate-200 px-6 py-4"></div>
        </div>
      </div>
    </section>
  `;
}

function renderStatCard(stat, i) {
  const leftColors = [
    'border-sky-500', 'border-emerald-500', 'border-rose-500',
    'border-violet-500', 'border-teal-500', 'border-amber-500',
  ];
  const valColors = [
    'text-sky-600', 'text-emerald-600', 'text-rose-600',
    'text-violet-600', 'text-teal-600', 'text-amber-600',
  ];
  const border = leftColors[i % leftColors.length];
  const valColor = valColors[i % valColors.length];
  return `
    <div class="flex-1 min-w-[160px] bg-white border-l-4 ${border} px-4 py-3">
      <p class="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-500">${escapeHtml(stat.label)}</p>
      <div class="mt-1.5 text-base font-black tracking-tight font-mono ${valColor} leading-tight">${escapeHtml(stat.value)}</div>
      <div class="mt-1 text-[9px] font-semibold text-slate-500 truncate">${escapeHtml(stat.meta)}</div>
    </div>
  `;
}

function renderSignalCard(title, value, subtitle, tone) {
  const toneMap = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose:    'border-rose-200 bg-rose-50 text-rose-700',
    sky:     'border-sky-200 bg-sky-50 text-sky-700',
    amber:   'border-amber-200 bg-amber-50 text-amber-700',
  };
  const valColors = { emerald: 'text-emerald-700', rose: 'text-rose-700', sky: 'text-sky-700', amber: 'text-amber-700' };
  const classes = toneMap[tone] || toneMap.sky;
  const valClass = valColors[tone] || 'text-slate-900';
  return `
    <div class="rounded-lg border ${classes} p-3">
      <div class="text-[9px] font-bold uppercase tracking-[0.25em] opacity-75">${escapeHtml(title)}</div>
      <div class="mt-2 text-sm font-black tracking-tight font-mono ${valClass} leading-tight">${escapeHtml(value)}</div>
      <div class="mt-1 text-[9px] text-slate-500">${escapeHtml(subtitle)}</div>
    </div>
  `;
}

function renderAccountTypes(types) {
  if (!types.length) {
    return `<div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <div class="text-xs font-semibold text-slate-600">No account type summaries</div>
      <div class="mt-1 text-[10px] text-slate-500">Populate as ledger activity grows.</div>
    </div>`;
  }

  return `
    <div class="space-y-2">
      ${types.map((summary) => `
        <div class="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 transition cursor-pointer">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-bold text-slate-800">${escapeHtml(summary.account_type)}</div>
              <div class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(formatCompactNumber(summary.account_count))} accounts</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-sm font-black font-mono ${summary.total_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${escapeHtml(formatCurrency(Math.abs(summary.total_balance)))}</div>
              <div class="text-[9px] font-bold mt-0.5 ${summary.total_balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${summary.total_balance >= 0 ? 'Net DR' : 'Net CR'}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderQuickAction(action) {
  const borderColors = {
    'from-indigo-600 to-blue-500':    'border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800',
    'from-violet-600 to-purple-500':  'border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100 text-violet-700 hover:text-violet-800',
    'from-emerald-600 to-green-500':  'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800',
    'from-cyan-600 to-sky-500':       'border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-sky-100 text-sky-700 hover:text-sky-800',
    'from-amber-500 to-orange-500':   'border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100 text-amber-700 hover:text-amber-800',
    'from-rose-600 to-pink-500':      'border-rose-200 bg-rose-50 hover:border-rose-400 hover:bg-rose-100 text-rose-700 hover:text-rose-800',
    'from-violet-600 to-indigo-600':  'border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100 text-violet-700 hover:text-violet-800',
  };
  const classes = borderColors[action.tone] || 'border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-700';
  return `
    <a href="${action.href}" data-navigo
       class="group flex items-center gap-3 rounded-lg border ${classes} bg-white px-4 py-3 transition">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="h-5 w-5 shrink-0 opacity-75">
        ${action.icon}
      </svg>
      <div class="flex-1 min-w-0">
        <div class="text-[12px] font-bold truncate">${escapeHtml(action.title)}</div>
        <div class="text-[10px] text-slate-500 truncate">${escapeHtml(action.subtitle)}</div>
      </div>
      <span class="text-slate-400 group-hover:text-slate-600 transition text-xs shrink-0">→</span>
    </a>
  `;
}

function renderAccountsTable(accounts) {
  if (!accounts.length) {
    return `<div class="px-6 py-12 text-center text-xs font-semibold text-slate-600">No ledger accounts found. Create journal entries or vouchers to populate.</div>`;
  }

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50">
            <th class="px-6 py-3 text-left text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Account Head</th>
            <th class="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Type</th>
            <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Debit</th>
            <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Credit</th>
            <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Balance</th>
            <th class="px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${accounts.map((account, i) => `
            <tr class="hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}">
              <td class="px-6 py-3 text-sm font-semibold text-slate-800">${escapeHtml(account.account_head)}</td>
              <td class="px-4 py-3">
                <span class="inline-flex rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">${escapeHtml(account.account_type)}</span>
              </td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-emerald-600 font-mono">${escapeHtml(formatCurrency(account.total_debit))}</td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-rose-600 font-mono">${escapeHtml(formatCurrency(account.total_credit))}</td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <span class="text-sm font-black font-mono ${account.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${escapeHtml(formatCurrency(account.absoluteBalance))}</span>
                <span class="ml-2 rounded px-2 py-0.5 text-[8px] font-bold uppercase ${account.balance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${escapeHtml(account.balanceLabel)}</span>
              </td>
              <td class="px-4 py-3 text-center">
                <a href="/ledger/account/${encodeURIComponent(account.account_head)}" data-navigo
                   class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-sky-600 hover:border-sky-400 hover:bg-sky-50 transition">
                  View →
                </a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAccountTypesTable(types) {
  if (!types.length) {
    return `<div class="px-6 py-12 text-center text-xs font-semibold text-slate-600">No account type summaries. Create journal entries or vouchers to populate.</div>`;
  }

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50">
            <th class="px-6 py-3 text-left text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Account Type</th>
            <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Accounts</th>
            <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Total Debit</th>
            <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Total Credit</th>
            <th class="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Net Balance</th>
            <th class="px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Sub-Ledger</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${types.map((summary, i) => `
            <tr class="hover:bg-slate-50 transition-colors cursor-pointer open-subleder-btn ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}" data-type="${escapeHtml(summary.account_type)}">
              <td class="px-6 py-3 text-sm font-bold text-slate-800">${escapeHtml(summary.account_type)}</td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-slate-600 font-mono">${escapeHtml(formatCompactNumber(summary.account_count))}</td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-emerald-600 font-mono">${escapeHtml(formatCurrency(summary.total_debit))}</td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-rose-600 font-mono">${escapeHtml(formatCurrency(summary.total_credit))}</td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <span class="text-sm font-black font-mono ${summary.total_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${escapeHtml(formatCurrency(Math.abs(summary.total_balance)))}</span>
                <span class="ml-2 text-[9px] font-bold ${summary.total_balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${summary.total_balance >= 0 ? 'DR' : 'CR'}</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span class="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-sky-600 hover:border-sky-400 hover:bg-sky-50 transition">
                  Drill →
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindTableTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-accounts-tab-button]'));
  const panels = Array.from(document.querySelectorAll('[data-accounts-tab-panel]'));

  if (!buttons.length || !panels.length) return;

  const setActiveTab = (tabName) => {
    buttons.forEach((button) => {
      const active = button.dataset.accountsTabButton === tabName;
      button.classList.toggle('bg-slate-900', active);
      button.classList.toggle('text-white', active);
      button.classList.toggle('shadow-sm', active);
      button.classList.toggle('text-slate-500', !active);
      button.classList.toggle('hover:text-slate-700', !active);
    });

    panels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.accountsTabPanel !== tabName);
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.accountsTabButton);
    });
  });

  setActiveTab('account-types');
}

function bindSubLedgerModal(model, router) {
  const modal      = document.getElementById('subleder-modal');
  const closeBtn   = document.getElementById('subleder-close');
  const titleEl    = document.getElementById('subleder-title');
  const summaryEl  = document.getElementById('subleder-summary');
  const bodyEl     = document.getElementById('subleder-body');
  const footerEl   = document.getElementById('subleder-footer');
  if (!modal) return;

  const allAccounts = model.accounts || [];

  const VALID_TYPES = new Set([
    'ASSET', 'DEBTOR', 'CASH', 'BANK', 'LIABILITY',
    'CREDITOR', 'INCOME', 'EXPENSE', 'GENERAL',
  ]);

  function openModal(accountType) {
    const heads  = allAccounts.filter(a => a.account_type === accountType);
    const sorted = [...heads].sort((a, b) => b.absoluteBalance - a.absoluteBalance);

    const totDr   = heads.reduce((s, h) => s + (h.total_debit  || 0), 0);
    const totCr   = heads.reduce((s, h) => s + (h.total_credit || 0), 0);
    const netBal  = totDr - totCr;
    const netLabel = netBal >= 0 ? 'DR' : 'CR';
    const maxAbs  = sorted.length ? sorted[0].absoluteBalance : 1;

    /* ── Coloured header ── */
    const headerEl = document.getElementById('subleder-header');
    headerEl.className = headerEl.className.replace(/\bmodal-hdr--\w+\b/g, '');
    headerEl.classList.add(`modal-hdr--${VALID_TYPES.has(accountType) ? accountType : 'GENERAL'}`);

    document.getElementById('subleder-badge').textContent = accountType;

    titleEl.textContent = accountType + ' Ledger Accounts';

    /* ── Summary chips ── */
    summaryEl.innerHTML = `
      <div class="bg-white px-4 py-3 text-center">
        <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Accounts</p>
        <p class="mt-1 text-xl font-black text-slate-900">${heads.length}</p>
      </div>
      <div class="bg-emerald-50 px-4 py-3">
        <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-600">Total Debits</p>
        <p class="mt-1 text-sm font-black text-emerald-600 font-mono truncate">${formatCurrency(totDr)}</p>
        <p class="text-[9px] text-slate-400 mt-0.5">Credits: ${formatCurrency(totCr)}</p>
      </div>
      <div class="bg-white px-4 py-3">
        <p class="text-[9px] font-bold uppercase tracking-[0.2em] ${netBal >= 0 ? 'text-emerald-500' : 'text-rose-500'}">Net Balance</p>
        <p class="mt-1 text-sm font-black font-mono truncate ${netBal >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${formatCurrency(Math.abs(netBal))}</p>
        <p class="text-[9px] mt-0.5 font-bold ${netBal >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${netLabel}</p>
      </div>
    `;

    /* ── Table body ── */
    if (!sorted.length) {
      bodyEl.innerHTML = `
        <tr><td colspan="5" class="px-5 py-12 text-center text-sm font-semibold text-slate-500">No accounts in this type.</td></tr>`;
    } else {
      bodyEl.innerHTML = sorted.map((h, i) => {
        const barColor = h.balance >= 0 ? 'bg-emerald-400' : 'bg-rose-400';
        const barPct   = maxAbs > 0 ? Math.round((h.absoluteBalance / maxAbs) * 100) : 0;
        const rowBg    = i % 2 !== 0 ? 'bg-slate-50/50' : '';

        return `
          <tr class="hover:bg-slate-50 transition-colors ${rowBg}">
            <td class="px-5 py-2.5">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0 w-1 rounded-full js-bar-h ${barColor}"
                     data-bar-h="${Math.max(Math.round(barPct * 0.28), 6)}"></div>
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(h.account_head)}</p>
                  <div class="mt-1 h-1 w-24 rounded-full bg-slate-200">
                    <div class="h-1 rounded-full ${barColor} transition-all js-bar-w"
                         data-bar-w="${barPct}"></div>
                  </div>
                </div>
              </div>
            </td>
            <td class="px-4 py-2.5 text-right text-xs font-semibold text-emerald-600 font-mono whitespace-nowrap">
              ${escapeHtml(formatCurrency(h.total_debit))}
            </td>
            <td class="px-4 py-2.5 text-right text-xs font-semibold text-rose-600 font-mono whitespace-nowrap">
              ${escapeHtml(formatCurrency(h.total_credit))}
            </td>
            <td class="px-4 py-2.5 text-right whitespace-nowrap">
              <span class="text-xs font-black font-mono ${h.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${escapeHtml(formatCurrency(h.absoluteBalance))}</span>
              <span class="ml-1 rounded px-1 py-0.5 text-[8px] font-bold uppercase
                           ${h.balance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                ${escapeHtml(h.balanceLabel)}
              </span>
            </td>
            <td class="px-4 py-2.5 text-center">
              <a href="/ledger/account/${encodeURIComponent(h.account_head)}" data-navigo
                 class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-sky-600 hover:border-sky-500 hover:bg-sky-50 transition">
                Detail →
              </a>
            </td>
          </tr>`;
      }).join('');

    /* ── Apply dynamic bar dimensions via JS (CSP: no inline style="" allowed) ── */
    bodyEl.querySelectorAll('.js-bar-h').forEach(el => {
      const h = Math.min(Math.max(Number(el.dataset.barH), 6), 28);
      el.style.setProperty('height', `${h}px`);
    });
    bodyEl.querySelectorAll('.js-bar-w').forEach(el => {
      el.style.setProperty('width', `${Number(el.dataset.barW)}%`);
    });
    }

    /* ── Dark footer ── */
    footerEl.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          ${escapeHtml(accountType)} Totals
        </span>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">Debits</p>
            <p class="text-sm font-black text-emerald-600">${formatCurrency(totDr)}</p>
          </div>
          <div class="w-px h-8 bg-white/10 self-center"></div>
          <div class="text-right">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">Credits</p>
            <p class="text-sm font-black text-rose-600">${formatCurrency(totCr)}</p>
          </div>
          <div class="w-px h-8 bg-white/10 self-center"></div>
          <div class="rounded-xl px-3 py-1.5 text-right
                      ${netBal >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}">
            <p class="text-[10px] uppercase tracking-wide ${netBal >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
              Net ${netLabel}
            </p>
            <p class="text-sm font-black ${netBal >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
              ${formatCurrency(Math.abs(netBal))}
            </p>
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    router.updatePageLinks();
    modal.querySelectorAll('[data-navigo]').forEach(link => {
      link.addEventListener('click', closeModal);
    });
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  // Wire row clicks in the account-types table
  document.querySelectorAll('.open-subleder-btn').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.type));
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onKey);
    }
  });
}

function renderLoadingState() {
  return `
    <div class="space-y-px">
      <div class="bg-white border-b border-slate-200 px-4 py-3">
        <div class="h-4 w-48 animate-pulse rounded bg-slate-200"></div>
        <div class="mt-2 h-6 w-72 animate-pulse rounded bg-slate-100"></div>
      </div>
      <div class="flex gap-px overflow-hidden">
        ${Array.from({ length: 6 }).map(() => `
          <div class="flex-1 bg-white border-b border-slate-200 p-3">
            <div class="h-2.5 w-16 animate-pulse rounded bg-slate-200"></div>
            <div class="mt-2 h-5 w-20 animate-pulse rounded bg-slate-100"></div>
            <div class="mt-1.5 h-2 w-14 animate-pulse rounded bg-slate-200/50"></div>
          </div>
        `).join('')}
      </div>
      <div class="grid gap-px xl:grid-cols-[2fr_1.4fr_1.2fr]">
        <div class="bg-white p-4">
          <div class="h-[260px] animate-pulse rounded-xl bg-slate-100"></div>
        </div>
        <div class="bg-white p-4">
          <div class="h-[260px] animate-pulse rounded-xl bg-slate-100"></div>
        </div>
        <div class="bg-white p-4">
          <div class="h-[260px] animate-pulse rounded-xl bg-slate-100"></div>
        </div>
      </div>
    </div>
  `;
}

function renderErrorState(message) {
  return `
    <div class="bg-white border-b border-rose-200 px-4 py-6">
      <div class="flex items-start gap-3">
        <div class="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 border border-rose-200">
          <svg class="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[9px] font-bold uppercase tracking-[0.3em] text-rose-500">Dashboard Error</p>
          <h2 class="mt-1 text-sm font-bold text-slate-900">Unable to load ledger data</h2>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(message || 'Unexpected dashboard failure.')}</p>
          <div class="mt-3 flex gap-2">
            <button id="accounts-dashboard-refresh" type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition">
              Retry
            </button>
            <a href="/ledger/general-ledger" data-navigo class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 hover:border-slate-400 px-3 py-1.5 text-xs font-semibold text-slate-600 transition">
              Open General Ledger
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderInlineEmpty(title, description) {
  return `
    <div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <div class="text-xs font-semibold text-slate-600">${escapeHtml(title)}</div>
      <div class="mt-1 text-[10px] text-slate-500">${escapeHtml(description)}</div>
    </div>
  `;
}

async function renderDashboardCharts(model) {
  const typesRoot = document.getElementById('accounts-type-chart');
  const balancesRoot = document.getElementById('accounts-balance-chart');
  if (!typesRoot || !balancesRoot) return;

  const Chart = await loadChartLibrary();

  const types = model.accountTypes.length
    ? model.accountTypes
    : [{ account_type: 'No Activity', total_debit: 0, total_credit: 0 }];

  const typeChart = new Chart(typesRoot, {
    type: 'bar',
    data: {
      labels: types.map((entry) => truncateLabel(entry.account_type, 14)),
      datasets: [
        {
          label: 'Debit',
          data: types.map((entry) => entry.total_debit),
          backgroundColor: 'rgba(16,185,129,0.75)',
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: 'Credit',
          data: types.map((entry) => entry.total_credit),
          backgroundColor: 'rgba(244,63,94,0.75)',
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },
    options: buildChartOptions({
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: { callback: (value) => formatAxisCurrency(value), color: '#475569', font: { size: 10 } },
          grid: { color: 'rgba(15,23,42,0.07)' },
          border: { color: 'transparent' },
        },
        x: {
          ticks: { color: '#475569', font: { size: 10 } },
          grid: { display: false },
          border: { display: false },
        },
      },
    }),
  });

  const balanceLeaders = [...model.largestDrAccounts, ...model.largestCrAccounts]
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 8);

  const chartAccounts = balanceLeaders.length
    ? balanceLeaders
    : [{ account_head: 'No balances yet', absoluteBalance: 0, balance: 0 }];

  const balanceChart = new Chart(balancesRoot, {
    type: 'bar',
    data: {
      labels: chartAccounts.map((entry) => truncateLabel(entry.account_head, 18)),
      datasets: [{
        label: 'Absolute Balance',
        data: chartAccounts.map((entry) => entry.absoluteBalance),
        backgroundColor: chartAccounts.map((entry) => entry.balance >= 0 ? 'rgba(37,99,235,0.8)' : 'rgba(219,39,119,0.8)'),
        borderRadius: 6,
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
          ticks: { callback: (value) => formatAxisCurrency(value), color: '#475569', font: { size: 10 } },
          grid: { color: 'rgba(15,23,42,0.07)' },
          border: { color: 'transparent' },
        },
        y: {
          ticks: { color: '#475569', font: { size: 10 } },
          grid: { display: false },
          border: { display: false },
        },
      },
    }),
  });

  accountsCharts.push(typeChart, balanceChart);
}

function destroyAccountsCharts() {
  accountsCharts.forEach((chart) => {
    try {
      chart.destroy();
    } catch (error) {
      console.warn('[ACCOUNTS_DASHBOARD] Failed to destroy chart:', error);
    }
  });
  accountsCharts = [];
}

function buildChartOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        labels: {
          color: '#64748b',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 14,
          font: { size: 10, weight: '600' },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(2,6,23,0.96)',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
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
      const existing = document.querySelector('script[data-accounts-chart]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Chart), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load local chart library')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = '/public/cdns/chart.umd.min.js';
      script.async = true;
      script.dataset.accountsChart = 'true';
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

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Math.abs(toNumber(value)) >= 100000 ? 0 : 2,
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

function truncateLabel(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}