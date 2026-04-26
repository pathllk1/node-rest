import { renderLayout } from '../../components/layout.js';
import { requireAuth }   from '../../middleware/authMiddleware.js';
import { api }           from '../../utils/api.js';

/* ── Helpers ────────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmtINR = (n) => {
  const frac = Math.abs(Number(n || 0)) >= 100000 ? 0 : 2;
  return '₹\u202f' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(Number(n || 0));
};

const fmtDate = (s) => {
  try { return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s || ''; }
};

function showToast(message, type = 'success') {
  const existing = document.getElementById('pl-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'pl-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

const PL_TYPES = new Set(['INCOME', 'EXPENSE', 'COGS', 'GENERAL', 'DISCOUNT_GIVEN', 'DISCOUNT_RECEIVED']);
const BS_TYPES = new Set(['ASSET', 'LIABILITY', 'DEBTOR', 'CREDITOR', 'CASH', 'BANK', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION', 'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'PROVISION']);

const COGS_KW  = ['cogs', 'cost of goods', 'purchase', 'inventory'];
const STOCK_KW = ['inventory', 'stock'];
const GST_KW   = ['gst', 'cgst', 'sgst', 'igst', 'tax receivable', 'input credit', 'input tax'];

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function renderProfitLoss(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  renderLayout(`
    <div id="pl-page" class="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-[28px]
         border border-slate-200 bg-[linear-gradient(180deg,#f9f8ff_0%,#eef3ff_100%)]">
      <div class="pointer-events-none absolute inset-0 opacity-40">
        <div class="absolute -left-12 top-4 h-48 w-48 rounded-full bg-violet-300/20 blur-3xl"></div>
        <div class="absolute right-0 top-0 h-48 w-48 rounded-full bg-sky-200/15 blur-3xl"></div>
      </div>
      <div class="relative p-3 md:p-4">
        <div id="pl-content">${skeletonHTML()}</div>
      </div>
    </div>
  `, router);

  await initPage(router, null, null);
}

// ─── Init / reload ────────────────────────────────────────────────────────────

async function initPage(router, startDate, endDate) {
  const mount = document.getElementById('pl-content');
  if (!mount) return;
  try {
    const qs       = buildQS(startDate, endDate);
    const raw      = await api.get(`/api/ledger/accounts${qs}`);
    const accounts = (Array.isArray(raw) ? raw : []).map(normalise);
    const plModel  = buildPLModel(accounts, startDate, endDate);
    const bsModel  = buildBSModel(accounts, plModel.netProfit, startDate, endDate);
    mount.innerHTML = renderPage(plModel, bsModel);
    router.updatePageLinks();
    bindActions(router);
  } catch (err) {
    console.error('[FIN_STMT]', err);
    mount.innerHTML = errorHTML(err.message);
    router.updatePageLinks();
    bindActions(router);
  }
}

function buildQS(s, e) {
  const p = new URLSearchParams();
  if (s) p.set('start_date', s);
  if (e) p.set('end_date',   e);
  return p.toString() ? `?${p}` : '';
}

// ─── Normalise ────────────────────────────────────────────────────────────────

function normalise(a) {
  const dr   = Number(a.total_debit || 0);
  const cr   = Number(a.total_credit || 0);
  const netCr = cr - dr;  // +ve = net credit, -ve = net debit
  const netDr = dr - cr;  // +ve = net debit
  return {
    head: String(a.account_head ?? ''),
    type: String(a.account_type  ?? '').toUpperCase(),
    dr, cr, netCr, netDr,
  };
}

function isCOGS(a)  { if (a.type === 'COGS') return true; const h = a.head.toLowerCase(); return COGS_KW .some(k => h.includes(k)); }
function isStock(a) { const h = a.head.toLowerCase(); return STOCK_KW.some(k => h.includes(k)); }
function isGSTRec(a){ const h = a.head.toLowerCase(); return GST_KW  .some(k => h.includes(k)); }

// ─── P&L model ────────────────────────────────────────────────────────────────

function buildPLModel(allAccounts, startDate, endDate) {
  const pl      = allAccounts.filter(a => PL_TYPES.has(a.type));
  const income  = pl.filter(a => a.type === 'INCOME');
  const expense = pl.filter(a => a.type === 'EXPENSE' || a.type === 'COGS');
  const general = pl.filter(a => a.type === 'GENERAL');
  const cogs    = expense.filter(isCOGS);
  const opex    = expense.filter(a => !isCOGS(a));

  const crIncome       = income.filter(a => a.netCr >= 0);
  const drContraIncome = income.filter(a => a.netCr <  0);
  const drCOGS         = cogs.filter(a => a.netCr <= 0);
  const crCOGS         = cogs.filter(a => a.netCr >  0);
  const drOpex         = opex.filter(a => a.netCr <= 0);
  const crOpex         = opex.filter(a => a.netCr >  0);
  const crGeneral      = general.filter(a => a.netCr >= 0);
  const drGeneral      = general.filter(a => a.netCr <  0);

  const totalRevenueCr   = crIncome .reduce((s, a) => s + a.netCr,  0);
  const totalContraInc   = drContraIncome.reduce((s, a) => s + Math.abs(a.netCr), 0);
  const totalCOGS        = drCOGS.reduce((s, a) => s + Math.abs(a.netCr), 0)
                         - crCOGS.reduce((s, a) => s + a.netCr, 0);
  const totalOpex        = drOpex.reduce((s, a) => s + Math.abs(a.netCr), 0)
                         - crOpex.reduce((s, a) => s + a.netCr, 0);
  const totalGeneralNet  = general.reduce((s, a) => s + a.netCr, 0);

  const effectiveRevenue = totalRevenueCr - totalContraInc;
  const grossProfit      = effectiveRevenue - totalCOGS;
  const netProfit        = grossProfit - totalOpex + totalGeneralNet;
  const gpMargin         = effectiveRevenue ? (grossProfit / effectiveRevenue) * 100 : 0;
  const npMargin         = effectiveRevenue ? (netProfit   / effectiveRevenue) * 100 : 0;

  const drItems = totalCOGS + totalContraInc + totalOpex
                + drGeneral.reduce((s, a) => s + Math.abs(a.netCr), 0)
                - crCOGS.reduce((s, a) => s + a.netCr, 0)
                - crOpex.reduce((s, a) => s + a.netCr, 0);
  const crItems = totalRevenueCr
                + crGeneral.reduce((s, a) => s + a.netCr, 0)
                + crCOGS.reduce((s, a) => s + a.netCr, 0)
                + crOpex.reduce((s, a) => s + a.netCr, 0);
  const drGrand = drItems + Math.max(netProfit,  0);
  const crGrand = crItems + Math.max(-netProfit, 0);

  const periodLabel = periodStr(startDate, endDate);

  return {
    startDate, endDate, periodLabel,
    crIncome, drContraIncome, drCOGS, crCOGS, drOpex, crOpex, crGeneral, drGeneral,
    totalRevenueCr, totalContraInc, effectiveRevenue,
    totalCOGS, totalOpex, totalGeneralNet,
    grossProfit, netProfit, gpMargin, npMargin,
    drGrand, crGrand,
    isEmpty: pl.length === 0,
  };
}

// ─── Balance Sheet model ──────────────────────────────────────────────────────

function buildBSModel(allAccounts, netProfit, startDate, endDate) {
  const bs = allAccounts.filter(a => BS_TYPES.has(a.type));

  const assetAccounts = bs.filter(a => a.type === 'ASSET');
  const debtorsRaw = bs.filter(a => a.type === 'DEBTOR');
  const cashBankRaw = bs.filter(a => a.type === 'CASH' || a.type === 'BANK');
  const liabilitiesRaw = bs.filter(a => a.type === 'LIABILITY');
  const creditorsRaw = bs.filter(a => a.type === 'CREDITOR');

  const stockAssets = assetAccounts.filter(a => isStock(a) && a.netDr > 0);
  const gstAssets = assetAccounts.filter(a => !isStock(a) && isGSTRec(a) && a.netDr > 0);
  const otherAssets = assetAccounts.filter(a => !isStock(a) && !isGSTRec(a) && a.netDr > 0);
  const assetCreditBalances = assetAccounts.filter(a => a.netCr > 0);

  const debtors = debtorsRaw.filter(a => a.netDr > 0);
  const debtorCreditBalances = debtorsRaw.filter(a => a.netCr > 0);

  const cashBank = cashBankRaw.filter(a => a.netDr > 0);
  const cashBankCreditBalances = cashBankRaw.filter(a => a.netCr > 0);

  const liabilities = liabilitiesRaw.filter(a => a.netCr > 0);
  const liabilityDebitBalances = liabilitiesRaw.filter(a => a.netDr > 0);

  const creditors = creditorsRaw.filter(a => a.netCr > 0);
  const creditorDebitBalances = creditorsRaw.filter(a => a.netDr > 0);

  const totalStock = stockAssets.reduce((s, a) => s + a.netDr, 0);
  const totalGST = gstAssets.reduce((s, a) => s + a.netDr, 0);
  const totalOtherA = otherAssets.reduce((s, a) => s + a.netDr, 0);
  const totalDebtors = debtors.reduce((s, a) => s + a.netDr, 0);
  const totalCashBank = cashBank.reduce((s, a) => s + a.netDr, 0);
  const totalLiabilityDebitBalances = liabilityDebitBalances.reduce((s, a) => s + a.netDr, 0);
  const totalCreditorDebitBalances = creditorDebitBalances.reduce((s, a) => s + a.netDr, 0);
  const totalAssets = totalStock + totalGST + totalOtherA + totalDebtors + totalCashBank
                    + totalLiabilityDebitBalances + totalCreditorDebitBalances;

  const totalLiab = liabilities.reduce((s, a) => s + a.netCr, 0);
  const totalCred = creditors.reduce((s, a) => s + a.netCr, 0);
  const totalAssetCreditBalances = assetCreditBalances.reduce((s, a) => s + a.netCr, 0);
  const totalDebtorCreditBalances = debtorCreditBalances.reduce((s, a) => s + a.netCr, 0);
  const totalCashBankCreditBalances = cashBankCreditBalances.reduce((s, a) => s + a.netCr, 0);
  const totalExtLib = totalLiab + totalCred + totalAssetCreditBalances
                    + totalDebtorCreditBalances + totalCashBankCreditBalances;

  const capital = totalAssets - totalExtLib - netProfit;
  const totalLiabSide = totalExtLib + capital + netProfit;

  const balanced     = Math.abs(totalAssets - totalLiabSide) < 0.02;
  const periodLabel  = periodStr(startDate, endDate);
  const assetSideCount = stockAssets.length + gstAssets.length + otherAssets.length + debtors.length
                       + cashBank.length + liabilityDebitBalances.length + creditorDebitBalances.length;
  const liabilitySideCount = liabilities.length + creditors.length + assetCreditBalances.length
                           + debtorCreditBalances.length + cashBankCreditBalances.length;

  return {
    startDate, endDate, periodLabel,
    stockAssets, gstAssets, otherAssets, debtors, cashBank,
    liabilityDebitBalances, creditorDebitBalances,
    totalStock, totalGST, totalOtherA, totalDebtors, totalCashBank,
    totalLiabilityDebitBalances, totalCreditorDebitBalances, totalAssets,
    liabilities, creditors, assetCreditBalances, debtorCreditBalances, cashBankCreditBalances,
    totalLiab, totalCred, totalAssetCreditBalances, totalDebtorCreditBalances, totalCashBankCreditBalances, totalExtLib,
    capital, netProfit,
    assetSideCount, liabilitySideCount,
    totalLiabSide, balanced,
    isEmpty: bs.length === 0,
  };
}

// ─── Render page (tabs) ───────────────────────────────────────────────────────

function renderPage(pl, bs) {
  return `
    <div class="space-y-3">

      <!-- ── Compact top bar ───────────────────────────────────────────────── -->
      <div class="flex flex-col gap-2 rounded-[18px] border border-slate-200/80 bg-white/85
                  px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">

        <!-- Left: icon + title + tabs -->
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center
                      rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <h1 class="text-sm font-black text-slate-900">Financial Statements</h1>
            <p class="text-[10px] text-slate-400">${esc(pl.periodLabel)}</p>
          </div>

          <!-- Tabs -->
          <div class="ml-2 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button id="tab-pl" data-tab="pl"
                    class="fin-tab rounded-[10px] bg-white px-3 py-1.5 text-xs font-bold text-slate-900
                           shadow-sm transition">P&amp;L</button>
            <button id="tab-bs" data-tab="bs"
                    class="fin-tab rounded-[10px] px-3 py-1.5 text-xs font-semibold text-slate-500
                           transition hover:text-slate-700">Balance Sheet</button>
          </div>
        </div>

        <!-- Right: filters + actions -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <input id="pl-start-date" type="date" value="${esc(pl.startDate || '')}"
                   class="w-28 bg-transparent text-xs text-slate-700 outline-none focus:ring-0"/>
            <span class="text-[10px] text-slate-400">–</span>
            <input id="pl-end-date" type="date" value="${esc(pl.endDate || '')}"
                   class="w-28 bg-transparent text-xs text-slate-700 outline-none focus:ring-0"/>
          </div>
          <button id="pl-apply"
                  class="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white
                         transition hover:bg-violet-700">Apply</button>
          <button id="pl-clear"
                  class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold
                         text-slate-600 transition hover:bg-slate-50">Reset</button>
          <button id="pl-refresh" title="Refresh"
                  class="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600
                         transition hover:bg-slate-50">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/>
            </svg>
          </button>
          <button id="pl-export-pdf" title="Export PDF"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50
                         px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
            </svg>
            PDF
          </button>
          <a href="/accounts-dashboard" data-navigo
             class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:shadow-md">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
            Dashboard
          </a>
        </div>
      </div>

      <!-- Tab panels -->
      <div id="fin-tab-pl">${renderPL(pl)}</div>
      <div id="fin-tab-bs" class="hidden">${renderBS(bs)}</div>

    </div>
  `;
}

// ─── Tab 1: P&L ───────────────────────────────────────────────────────────────

function renderPL(m) {
  const isProfit = m.netProfit >= 0;
  const isGP     = m.grossProfit >= 0;

  if (m.isEmpty) return emptyHTML('No P&L data. Only INCOME, EXPENSE, COGS and GENERAL account types appear here.');

  return `
    <div class="space-y-3">

      <!-- KPI strip -->
      <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
        ${kpi('Revenue',      fmtINR(m.totalRevenueCr),        `${m.crIncome.length} income account${m.crIncome.length !== 1 ? 's' : ''}`,       'from-emerald-500 to-green-600')}
        ${kpi('Gross Profit', fmtINR(Math.abs(m.grossProfit)), `${fmtP(m.gpMargin)} margin · ${isGP ? 'profit' : 'loss'}`,                       isGP  ? 'from-sky-500 to-blue-600'    : 'from-rose-500 to-pink-700')}
        ${kpi('Total OpEx',   fmtINR(m.totalOpex),             `${m.drOpex.length} expense account${m.drOpex.length !== 1 ? 's' : ''}`,           'from-amber-500 to-orange-600')}
        ${kpi('Net Profit',   fmtINR(Math.abs(m.netProfit)),   `${fmtP(m.npMargin)} net margin · ${isProfit ? 'profit' : 'loss'}`,                isProfit ? 'from-violet-600 to-indigo-600' : 'from-rose-500 to-pink-700')}
      </div>

      <!-- 2-column statement -->
      <div class="overflow-hidden rounded-[20px] border border-slate-200 bg-white
                  shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)]">

        <!-- Title bar -->
        <div class="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-5 py-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              Trading &amp; Profit &amp; Loss Account
            </p>
            <p class="mt-0.5 text-xs font-semibold text-white">${esc(m.periodLabel)}</p>
          </div>
          <div class="flex items-center gap-5">
            <div class="text-right">
              <p class="text-[10px] uppercase tracking-wide text-slate-500">Dr</p>
              <p class="text-sm font-black text-rose-300">${fmtINR(m.drGrand)}</p>
            </div>
            <div class="h-8 w-px bg-white/10"></div>
            <div class="text-right">
              <p class="text-[10px] uppercase tracking-wide text-slate-500">Cr</p>
              <p class="text-sm font-black text-emerald-300">${fmtINR(m.crGrand)}</p>
            </div>
          </div>
        </div>

        <!-- Column headers -->
        <div class="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-200 bg-slate-50">
          <div class="flex items-center gap-2 px-4 py-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full
                         bg-rose-100 text-[10px] font-black text-rose-700">Dr</span>
            <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Debit Side</span>
          </div>
          <div class="flex items-center gap-2 px-4 py-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full
                         bg-emerald-100 text-[10px] font-black text-emerald-700">Cr</span>
            <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Credit Side</span>
          </div>
        </div>

        <!-- Trading Account section -->
        <div class="flex items-center gap-2 border-b bg-slate-800 px-5 py-1.5">
          <span class="text-[9px] font-black uppercase tracking-[0.28em] text-slate-400">Trading Account</span>
          <div class="flex-1 h-px bg-slate-700"></div>
          <span class="text-[9px] text-slate-500">Revenue vs Cost of Sales</span>
        </div>
        <div class="grid grid-cols-2 divide-x divide-slate-100">
          <div class="flex flex-col">
            <div class="border-b border-slate-100">
              ${secHdr('To Cost of Goods Sold', m.drCOGS.length, 'amber')}
              ${m.drCOGS.length === 0 ? nilRow('No COGS accounts')
                : m.drCOGS.map(r => lineRow(r.head, Math.abs(r.netCr), 'slate')).join('')}
              ${subtotal('Total COGS', m.totalCOGS, 'amber')}
            </div>
            ${m.drContraIncome.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('To Returns / Contra Income', m.drContraIncome.length, 'orange')}
                ${m.drContraIncome.map(r => lineRow(r.head, Math.abs(r.netCr), 'slate')).join('')}
                ${subtotal('Total Contra Income', m.totalContraInc, 'orange')}
              </div>` : ''}
            ${isGP ? transferRow('To Gross Profit c/d', m.grossProfit, 'sky', 'Closes trading — carried to P&L') : ''}
          </div>
          <div class="flex flex-col">
            <div class="border-b border-slate-100">
              ${secHdr('By Revenue / Sales', m.crIncome.length, 'emerald')}
              ${m.crIncome.length === 0 ? nilRow('No income accounts')
                : m.crIncome.map(r => lineRow(r.head, r.netCr, 'emerald')).join('')}
              ${subtotal('Total Revenue', m.totalRevenueCr, 'emerald')}
            </div>
            ${!isGP ? transferRow('To Gross Loss c/d', Math.abs(m.grossProfit), 'rose', 'Closes trading — carried to P&L') : ''}
          </div>
        </div>

        <!-- P&L Account section -->
        <div class="flex items-center gap-2 border-b border-t border-slate-700 bg-slate-800 px-5 py-1.5">
          <span class="text-[9px] font-black uppercase tracking-[0.28em] text-slate-400">Profit &amp; Loss Account</span>
          <div class="flex-1 h-px bg-slate-700"></div>
          <span class="text-[9px] text-slate-500">Expenses vs Gross Profit &amp; other income</span>
        </div>
        <div class="grid grid-cols-2 divide-x divide-slate-100">
          <div class="flex flex-col">
            <div class="border-b border-slate-100">
              ${secHdr('To Operating Expenses', m.drOpex.length, 'rose')}
              ${m.drOpex.length === 0 ? nilRow('No operating expense accounts')
                : m.drOpex.map(r => lineRow(r.head, Math.abs(r.netCr), 'slate')).join('')}
              ${subtotal('Total Expenses', m.totalOpex, 'rose')}
            </div>
            ${m.drGeneral.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('To Miscellaneous', m.drGeneral.length, 'slate')}
                ${m.drGeneral.map(r => lineRow(r.head, Math.abs(r.netCr), 'slate')).join('')}
              </div>` : ''}
            ${isProfit ? balancingRow('To Net Profit', m.netProfit, 'violet', 'Balancing figure') : ''}
          </div>
          <div class="flex flex-col">
            ${isGP  ? transferRow('By Gross Profit b/d', m.grossProfit,          'sky',  'Brought from Trading Account') : ''}
            ${!isGP ? transferRow('By Gross Loss b/d',   Math.abs(m.grossProfit),'rose', 'Brought from Trading Account') : ''}
            ${m.crGeneral.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('By Miscellaneous', m.crGeneral.length, 'teal')}
                ${m.crGeneral.map(r => lineRow(r.head, r.netCr, 'teal')).join('')}
                ${subtotal('Total Misc. Income', m.crGeneral.reduce((s,a)=>s+a.netCr,0), 'teal')}
              </div>` : ''}
            ${m.crCOGS.length + m.crOpex.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('By Contra Expense', m.crCOGS.length + m.crOpex.length, 'slate')}
                ${[...m.crCOGS,...m.crOpex].map(r => lineRow(r.head, r.netCr, 'teal')).join('')}
              </div>` : ''}
            ${!isProfit ? balancingRow('By Net Loss', Math.abs(m.netProfit), 'rose', 'Balancing figure') : ''}
            <div class="flex-1 min-h-[24px]"></div>
          </div>
        </div>

        <!-- Grand total footer -->
        <div class="grid grid-cols-2 divide-x divide-white/10 border-t border-slate-200
                    ${isProfit ? 'bg-gradient-to-br from-violet-600 to-indigo-700'
                               : 'bg-gradient-to-br from-rose-600 to-pink-800'}">
          <div class="flex items-center justify-between gap-2 px-5 py-3">
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Dr Total</span>
            <span class="text-base font-black text-white tabular-nums">${fmtINR(m.drGrand)}</span>
          </div>
          <div class="flex items-center justify-between gap-2 px-5 py-3">
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Cr Total</span>
            <span class="text-base font-black text-white tabular-nums">${fmtINR(m.crGrand)}</span>
          </div>
        </div>
      </div>

      <!-- Net result banner -->
      <div class="rounded-[16px] border px-5 py-3
                  ${isProfit ? 'border-violet-200 bg-violet-50' : 'border-rose-200 bg-rose-50'}">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.22em]
                      ${isProfit ? 'text-violet-500' : 'text-rose-500'}">
              ${isProfit ? 'Net Profit for the period' : 'Net Loss for the period'}
            </p>
            <p class="mt-0.5 text-xs text-slate-500">
              Net margin ${fmtP(m.npMargin)} · Gross margin ${fmtP(m.gpMargin)}
              ${m.totalContraInc > 0 ? ` · ${fmtINR(m.totalContraInc)} contra income` : ''}
              ${m.totalGeneralNet !== 0 ? ` · ${m.totalGeneralNet > 0 ? '+' : ''}${fmtINR(m.totalGeneralNet)} misc` : ''}
            </p>
          </div>
          <p class="text-2xl font-black ${isProfit ? 'text-violet-700' : 'text-rose-700'}">
            ${fmtINR(Math.abs(m.netProfit))}
          </p>
        </div>
      </div>
    </div>
  `;
}

// ─── Tab 2: Balance Sheet ─────────────────────────────────────────────────────

function renderBS(m) {
  if (m.isEmpty) return emptyHTML('No Balance Sheet data. ASSET, LIABILITY, DEBTOR, CREDITOR, CASH and BANK account types appear here.');

  const isCapPos  = m.capital >= 0;
  const isProfit  = m.netProfit >= 0;

  return `
    <div class="space-y-3">

      <!-- BS KPI strip -->
      <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
        ${kpi('Total Assets',       fmtINR(m.totalAssets),   `${m.assetSideCount} accounts`,       'from-sky-500 to-blue-600')}
        ${kpi('Total Liabilities',  fmtINR(m.totalExtLib),   `${m.liabilitySideCount} accounts`,   'from-rose-500 to-pink-600')}
        ${kpi('Capital',            fmtINR(Math.abs(m.capital)), isCapPos ? 'Owner equity' : 'Capital deficit',                                                                       isCapPos ? 'from-emerald-500 to-green-600' : 'from-amber-500 to-orange-600')}
        ${kpi('Net Profit / (Loss)',fmtINR(Math.abs(m.netProfit)), `${fmtP(isProfit ? 1 : -1)} · ${isProfit ? 'Profit' : 'Loss'}`,                                                   isProfit ? 'from-violet-600 to-indigo-600' : 'from-rose-500 to-pink-700')}
      </div>

      <!-- Balance check badge -->
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold
                     ${m.balanced
                       ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                       : 'border border-rose-200 bg-rose-50 text-rose-700'}">
          ${m.balanced
            ? `<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Balanced`
            : `<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg> Imbalanced — ${fmtINR(Math.abs(m.totalAssets - m.totalLiabSide))} difference`}
        </span>
        <span class="text-[10px] text-slate-400">Capital is computed as: Total Assets − External Liabilities − Net Profit</span>
      </div>

      <!-- 2-column Balance Sheet -->
      <div class="overflow-hidden rounded-[20px] border border-slate-200 bg-white
                  shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)]">

        <!-- Title bar -->
        <div class="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-5 py-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Balance Sheet</p>
            <p class="mt-0.5 text-xs font-semibold text-white">${esc(m.periodLabel)}</p>
          </div>
          <div class="flex items-center gap-5">
            <div class="text-right">
              <p class="text-[10px] uppercase tracking-wide text-slate-500">Liabilities</p>
              <p class="text-sm font-black text-rose-300">${fmtINR(m.totalLiabSide)}</p>
            </div>
            <div class="h-8 w-px bg-white/10"></div>
            <div class="text-right">
              <p class="text-[10px] uppercase tracking-wide text-slate-500">Assets</p>
              <p class="text-sm font-black text-emerald-300">${fmtINR(m.totalAssets)}</p>
            </div>
          </div>
        </div>

        <!-- Column headers -->
        <div class="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-200 bg-slate-50">
          <div class="flex items-center gap-2 px-4 py-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full
                         bg-rose-100 text-[10px] font-black text-rose-700">L</span>
            <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Liabilities &amp; Capital
            </span>
          </div>
          <div class="flex items-center gap-2 px-4 py-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full
                         bg-sky-100 text-[10px] font-black text-sky-700">A</span>
            <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Assets</span>
          </div>
        </div>

        <!-- Two columns -->
        <div class="grid grid-cols-2 divide-x divide-slate-100">

          <!-- ── LIABILITIES column ─────────────────────────────────────── -->
          <div class="flex flex-col">

            <!-- Capital A/c -->
            <div class="border-b border-slate-100">
              <div class="flex items-center justify-between px-4 py-2 bg-emerald-50/70 border-b border-emerald-100/60">
                <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Capital Account</span>
                <span class="text-[10px] text-emerald-400">Computed</span>
              </div>
              <div class="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50/60">
                <div>
                  <p class="text-xs font-semibold text-slate-700">Capital / Owner's Equity</p>
                  <p class="text-[10px] text-slate-400">Assets − Liabilities − Net Profit</p>
                </div>
                <span class="w-24 text-right text-xs font-bold tabular-nums
                             ${isCapPos ? 'text-emerald-700' : 'text-rose-600'}">${fmtINR(Math.abs(m.capital))}</span>
              </div>
              <div class="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50/60">
                <div>
                  <p class="text-xs font-semibold text-slate-700">
                    ${isProfit ? 'Add: Net Profit' : 'Less: Net Loss'}
                  </p>
                  <p class="text-[10px] text-slate-400">From P&amp;L statement</p>
                </div>
                <span class="w-24 text-right text-xs font-bold tabular-nums
                             ${isProfit ? 'text-violet-700' : 'text-rose-600'}">${fmtINR(Math.abs(m.netProfit))}</span>
              </div>
              <div class="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 bg-slate-50/60">
                <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Total Capital</span>
                <span class="text-sm font-black tabular-nums text-emerald-700">${fmtINR(m.capital + m.netProfit)}</span>
              </div>
            </div>

            <!-- Loans & Liabilities -->
            ${m.liabilities.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Loans &amp; Liabilities', m.liabilities.length, 'rose')}
                ${m.liabilities.map(r => bsRow(r.head, r.netCr, 'slate')).join('')}
                ${subtotal('Total Liabilities', m.totalLiab, 'rose')}
              </div>` : ''}

            <!-- Creditors -->
            ${m.creditors.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Sundry Creditors', m.creditors.length, 'amber')}
                ${m.creditors.map(r => bsRow(r.head, r.netCr, 'slate')).join('')}
                ${subtotal('Total Creditors', m.totalCred, 'amber')}
              </div>` : ''}

            ${m.debtorCreditBalances.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Debtor Accounts (Credit Balance)', m.debtorCreditBalances.length, 'blue')}
                ${m.debtorCreditBalances.map(r => bsRow(r.head, r.netCr, 'slate')).join('')}
                ${subtotal('Total Debtor Credit Balances', m.totalDebtorCreditBalances, 'blue')}
              </div>` : ''}

            ${m.cashBankCreditBalances.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Cash &amp; Bank (Credit Balance)', m.cashBankCreditBalances.length, 'emerald')}
                ${m.cashBankCreditBalances.map(r => bsRow(r.head, r.netCr, 'emerald')).join('')}
                ${subtotal('Total Cash &amp; Bank Credit Balances', m.totalCashBankCreditBalances, 'emerald')}
              </div>` : ''}

            ${m.assetCreditBalances.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Asset Accounts (Credit Balance)', m.assetCreditBalances.length, 'violet')}
                ${m.assetCreditBalances.map(r => bsRow(r.head, r.netCr, 'violet')).join('')}
                ${subtotal('Total Asset Credit Balances', m.totalAssetCreditBalances, 'violet')}
              </div>` : ''}

            <div class="flex-1 min-h-[12px]"></div>
          </div>

          <!-- ── ASSETS column ──────────────────────────────────────────── -->
          <div class="flex flex-col">

            <!-- Other / Fixed Assets -->
            ${m.otherAssets.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Fixed &amp; Other Assets', m.otherAssets.length, 'sky')}
                ${m.otherAssets.map(r => bsRow(r.head, r.netDr, 'sky')).join('')}
                ${subtotal('Total Fixed Assets', m.totalOtherA, 'sky')}
              </div>` : ''}

            <!-- Stock / Inventory -->
            ${m.stockAssets.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Stock &amp; Inventory', m.stockAssets.length, 'teal')}
                ${m.stockAssets.map(r => bsRow(r.head, r.netDr, 'teal')).join('')}
                ${subtotal('Total Stock', m.totalStock, 'teal')}
              </div>` : ''}

            <!-- GST / Tax Receivables -->
            ${m.gstAssets.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Tax Receivables', m.gstAssets.length, 'violet')}
                ${m.gstAssets.map(r => bsRow(r.head, r.netDr, 'violet')).join('')}
                ${subtotal('Total Tax Receivable', m.totalGST, 'violet')}
              </div>` : ''}

            <!-- Debtors -->
            ${m.debtors.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Sundry Debtors', m.debtors.length, 'blue')}
                ${m.debtors.map(r => bsRow(r.head, r.netDr, 'slate')).join('')}
                ${subtotal('Total Debtors', m.totalDebtors, 'blue')}
              </div>` : ''}

            <!-- Cash & Bank -->
            ${m.cashBank.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Cash &amp; Bank', m.cashBank.length, 'emerald')}
                ${m.cashBank.map(r => bsRow(r.head, r.netDr, 'emerald')).join('')}
                ${subtotal('Total Cash & Bank', m.totalCashBank, 'emerald')}
              </div>` : ''}

            ${m.liabilityDebitBalances.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Liability Accounts (Debit Balance)', m.liabilityDebitBalances.length, 'rose')}
                ${m.liabilityDebitBalances.map(r => bsRow(r.head, r.netDr, 'slate')).join('')}
                ${subtotal('Total Liability Debit Balances', m.totalLiabilityDebitBalances, 'rose')}
              </div>` : ''}

            ${m.creditorDebitBalances.length > 0 ? `
              <div class="border-b border-slate-100">
                ${secHdr('Creditor Accounts (Debit Balance)', m.creditorDebitBalances.length, 'amber')}
                ${m.creditorDebitBalances.map(r => bsRow(r.head, r.netDr, 'slate')).join('')}
                ${subtotal('Total Creditor Debit Balances', m.totalCreditorDebitBalances, 'amber')}
              </div>` : ''}

            <div class="flex-1 min-h-[12px]"></div>
          </div>
        </div>

        <!-- Grand total footer -->
        <div class="grid grid-cols-2 divide-x divide-white/10 border-t border-slate-200
                    ${m.balanced ? 'bg-gradient-to-br from-slate-700 to-slate-900'
                                 : 'bg-gradient-to-br from-rose-600 to-pink-800'}">
          <div class="flex items-center justify-between gap-2 px-5 py-3">
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Total Liabilities</span>
            <span class="text-base font-black text-white tabular-nums">${fmtINR(m.totalLiabSide)}</span>
          </div>
          <div class="flex items-center justify-between gap-2 px-5 py-3">
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Total Assets</span>
            <span class="text-base font-black text-white tabular-nums">${fmtINR(m.totalAssets)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Row helpers ──────────────────────────────────────────────────────────────

const C = {
  emerald: { hdr: 'bg-emerald-50/70 border-b border-emerald-100/60', lbl: 'text-emerald-700', sub: 'bg-emerald-50/60 text-emerald-700', val: 'text-emerald-700', badge: 'text-emerald-400' },
  amber:   { hdr: 'bg-amber-50/70   border-b border-amber-100/60',   lbl: 'text-amber-700',   sub: 'bg-amber-50/60   text-amber-700',   val: 'text-amber-700',   badge: 'text-amber-400'   },
  orange:  { hdr: 'bg-orange-50/70  border-b border-orange-100/60',  lbl: 'text-orange-700',  sub: 'bg-orange-50/60  text-orange-700',  val: 'text-orange-700',  badge: 'text-orange-400'  },
  rose:    { hdr: 'bg-rose-50/70    border-b border-rose-100/60',    lbl: 'text-rose-700',    sub: 'bg-rose-50/60    text-rose-700',    val: 'text-rose-700',    badge: 'text-rose-400'    },
  sky:     { hdr: 'bg-sky-50/70     border-b border-sky-100/60',     lbl: 'text-sky-700',     sub: 'bg-sky-50/60     text-sky-700',     val: 'text-sky-700',     badge: 'text-sky-400'     },
  blue:    { hdr: 'bg-blue-50/70    border-b border-blue-100/60',    lbl: 'text-blue-700',    sub: 'bg-blue-50/60    text-blue-700',    val: 'text-blue-700',    badge: 'text-blue-400'    },
  violet:  { hdr: 'bg-violet-50/70  border-b border-violet-100/60',  lbl: 'text-violet-700',  sub: 'bg-violet-50/60  text-violet-700',  val: 'text-violet-700',  badge: 'text-violet-400'  },
  teal:    { hdr: 'bg-teal-50/70    border-b border-teal-100/60',    lbl: 'text-teal-700',    sub: 'bg-teal-50/60    text-teal-700',    val: 'text-teal-700',    badge: 'text-teal-400'    },
  slate:   { hdr: 'bg-slate-50      border-b border-slate-100',      lbl: 'text-slate-700',   sub: 'bg-slate-50      text-slate-700',   val: 'text-slate-900',   badge: 'text-slate-400'   },
};

function secHdr(label, count, color) {
  const c = C[color] || C.slate;
  return `<div class="flex items-center justify-between px-4 py-2 ${c.hdr}">
    <span class="text-[10px] font-bold uppercase tracking-[0.18em] ${c.lbl}">${label}</span>
    <span class="text-[10px] ${c.badge}">${count}</span>
  </div>`;
}

function lineRow(head, amount, color) {
  const c = C[color] || C.slate;
  return `<div class="group flex items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50/60 transition">
    <p class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700" title="${esc(head)}">${esc(head)}</p>
    <div class="flex flex-shrink-0 items-center gap-1.5">
      <a href="/ledger/account/${encodeURIComponent(head)}" data-navigo
         class="hidden group-hover:inline-flex items-center rounded-md border border-blue-100 bg-blue-50
                px-1.5 py-0.5 text-[9px] font-bold text-blue-600 hover:bg-blue-100 transition">↗</a>
      <span class="w-24 text-right text-xs font-bold tabular-nums ${c.val}">${fmtINR(amount)}</span>
    </div>
  </div>`;
}

// BS row — same as lineRow but no link (BS accounts don't navigate to P&L detail)
function bsRow(head, amount, color) {
  const c = C[color] || C.slate;
  return `<div class="group flex items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50/60 transition">
    <p class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700" title="${esc(head)}">${esc(head)}</p>
    <div class="flex flex-shrink-0 items-center gap-1.5">
      <a href="/ledger/account/${encodeURIComponent(head)}" data-navigo
         class="hidden group-hover:inline-flex items-center rounded-md border border-blue-100 bg-blue-50
                px-1.5 py-0.5 text-[9px] font-bold text-blue-600 hover:bg-blue-100 transition">↗</a>
      <span class="w-24 text-right text-xs font-bold tabular-nums ${c.val}">${fmtINR(amount)}</span>
    </div>
  </div>`;
}

function subtotal(label, amount, color) {
  const c = C[color] || C.slate;
  return `<div class="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 ${c.sub}">
    <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">${label}</span>
    <span class="text-sm font-black tabular-nums ${c.lbl}">${fmtINR(amount)}</span>
  </div>`;
}

function transferRow(label, amount, color, sub) {
  const c = C[color] || C.slate;
  return `<div class="flex items-center justify-between gap-2 border-b border-t px-4 py-2.5 ${c.hdr}">
    <div>
      <p class="text-xs font-bold ${c.lbl}">${label}</p>
      <p class="text-[10px] text-slate-400">${sub}</p>
    </div>
    <span class="text-sm font-black tabular-nums ${c.lbl}">${fmtINR(amount)}</span>
  </div>`;
}

function balancingRow(label, amount, color, sub) {
  const c = C[color] || C.slate;
  return `<div class="flex items-center justify-between gap-2 border-t px-4 py-2.5 ${c.sub}">
    <div>
      <p class="text-xs font-bold ${c.lbl}">${label}</p>
      <p class="text-[10px] text-slate-400">${sub}</p>
    </div>
    <span class="text-base font-black tabular-nums ${c.lbl}">${fmtINR(amount)}</span>
  </div>`;
}

function nilRow(msg) {
  return `<div class="px-4 py-4 text-center text-xs text-slate-400">${esc(msg)}</div>`;
}

// ─── Bind actions ─────────────────────────────────────────────────────────────

function bindActions(router) {
  // Tab switching
  document.querySelectorAll('.fin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.fin-tab').forEach(b => {
        const active = b.dataset.tab === tab;
        b.classList.toggle('bg-white',      active);
        b.classList.toggle('text-slate-900', active);
        b.classList.toggle('font-bold',      active);
        b.classList.toggle('shadow-sm',      active);
        b.classList.toggle('text-slate-500', !active);
        b.classList.toggle('font-semibold',  !active);
      });
      document.getElementById('fin-tab-pl')?.classList.toggle('hidden', tab !== 'pl');
      document.getElementById('fin-tab-bs')?.classList.toggle('hidden', tab !== 'bs');
      router.updatePageLinks();
    });
  });

  // Date filters
  const val = id => document.getElementById(id)?.value || null;
  const reload = async () => {
    const mount = document.getElementById('pl-content');
    if (!mount) return;
    mount.innerHTML = skeletonHTML();
    await initPage(router, val('pl-start-date'), val('pl-end-date'));
  };

  document.getElementById('pl-refresh')?.addEventListener('click', reload);
  document.getElementById('pl-apply')  ?.addEventListener('click', reload);
  document.getElementById('pl-clear')  ?.addEventListener('click', async () => {
    const startInput = document.getElementById('pl-start-date');
    const endInput   = document.getElementById('pl-end-date');
    if (startInput) startInput.value = '';
    if (endInput)   endInput.value = '';
    await reload();
    showToast('Filters reset', 'info');
  });

  // PDF export — detects which tab is active and hits the correct endpoint
  document.getElementById('pl-export-pdf')?.addEventListener('click', () => {
    const bsVisible = !document.getElementById('fin-tab-bs')?.classList.contains('hidden');
    const endpoint  = bsVisible ? '/api/ledger/export/balance-sheet' : '/api/ledger/export/profit-loss';
    const qs        = buildQS(val('pl-start-date'), val('pl-end-date'));
    showToast('Generating PDF...', 'info');
    window.location.href = endpoint + qs;
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function kpi(label, value, meta, tone) {
  return `<article class="overflow-hidden rounded-[16px] border border-white/70 bg-white/90
                           shadow-[0_8px_22px_-18px_rgba(15,23,42,0.5)]">
    <div class="h-1 bg-gradient-to-r ${tone}"></div>
    <div class="px-3 py-2.5">
      <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">${esc(label)}</p>
      <p class="mt-1 text-base font-black text-slate-900">${esc(value)}</p>
      <p class="mt-0.5 text-[10px] text-slate-400">${esc(meta)}</p>
    </div>
  </article>`;
}

function periodStr(s, e) {
  return s && e ? `${fmtDate(s)} – ${fmtDate(e)}`
       : s ? `From ${fmtDate(s)}`
       : e ? `Up to ${fmtDate(e)}`
       : 'All periods';
}

function fmtP(v) { 
  const n = Number(v);
  return `${(Number.isFinite(n) ? Math.abs(n) : 0).toFixed(1)}%`; 
}

function emptyHTML(msg) {
  return `<div class="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
    <p class="text-sm font-bold text-slate-700">No data</p>
    <p class="mt-1 text-xs text-slate-400">${esc(msg)}</p>
  </div>`;
}

function errorHTML(msg) {
  return `<div class="rounded-[18px] border border-rose-200 bg-white/90 p-5 shadow-sm">
    <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">Error</p>
    <h2 class="mt-1 text-base font-black text-slate-900">Unable to load financial statements</h2>
    <p class="mt-1 text-sm text-slate-600">${esc(msg || 'Unexpected error.')}</p>
    <button id="pl-refresh"
            class="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white
                   transition hover:bg-slate-800">Retry</button>
  </div>`;
}

function skeletonHTML() {
  return `<div class="space-y-3 animate-pulse">
    <div class="h-14 rounded-[18px] border border-slate-200 bg-white/80"></div>
    <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
      ${Array.from({length:4}).map(()=>`<div class="h-16 rounded-[16px] border border-slate-200 bg-white/80"></div>`).join('')}
    </div>
    <div class="h-[500px] rounded-[20px] border border-slate-200 bg-white/80"></div>
  </div>`;
}