import PrinterModule       from 'pdfmake/js/Printer.js';
import path                from 'path';
import fs                  from 'fs';
import { fileURLToPath }   from 'url';
import mongoose            from 'mongoose';
import { Ledger, Firm, BankAccount }    from '../../../models/index.js';

const PdfPrinter = PrinterModule.default;
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ── FONT SETUP ───────────────────────────────────────────────────────────── */

const getFontPath = (f) => path.join(process.cwd(), 'client', 'public', 'fonts', f);
['DejaVuSans.ttf','DejaVuSans-Bold.ttf','DejaVuSans-Oblique.ttf','DejaVuSans-BoldOblique.ttf']
  .forEach(f => { if (!fs.existsSync(getFontPath(f))) console.warn(`Font not found: ${getFontPath(f)}`); });

const fonts = {
  DejaVuSans: {
    normal:      getFontPath('DejaVuSans.ttf'),
    bold:        getFontPath('DejaVuSans-Bold.ttf'),
    italics:     getFontPath('DejaVuSans-Oblique.ttf'),
    bolditalics: getFontPath('DejaVuSans-BoldOblique.ttf'),
  },
};
const printer = new PdfPrinter(fonts);

/* ── FORMAT HELPERS ───────────────────────────────────────────────────────── */

/**
 * BUG FIX 1 — was '₹ ' (regular breakable space U+0020).
 * pdfmake treats U+0020 as a valid line-break opportunity, so
 * '₹' and '10,25,000.00' could end up on separate lines.
 * Fix: U+00A0 (NON-BREAKING SPACE) prevents any break between the
 * rupee symbol and the digits. Combined with noWrap:true on the cell
 * this eliminates all amount-wrapping issues.
 *
 * BUG FIX 2 — ' DR' / ' CR' suffix also used a regular space.
 * Same fix: use U+00A0 before DR/CR so the label can never detach
 * from the amount on a narrow line.
 */
const formatINR = (n) =>
  '\u20B9\u00A0' +                            // ₹ + NON-BREAKING SPACE
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const drCr = (val) =>
  val > 0 ? '\u00A0DR' : val < 0 ? '\u00A0CR' : '';

/**
 * BUG FIX 3 — new Date('2024-03-15') is parsed as UTC midnight.
 * On UTC+5:30 servers this is fine, but on UTC servers the date
 * rolls back to the previous day when formatted in local time.
 * Fix: append T00:00:00 to force local-time parsing.
 */
const formatDate = (d) => {
  if (!d) return '';
  try {
    const safe = String(d).includes('T') ? d : `${d}T00:00:00`;
    return new Date(safe).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return String(d); }
};

const dateRangeText = (start, end) => {
  if (start && end) return `${start}  to  ${end}`;
  if (start)        return `From ${start}`;
  if (end)          return `Up to ${end}`;
  return 'All Periods';
};

/* ── ICONS ────────────────────────────────────────────────────────────────── */

const IC = '#374151';

const icons = {
  ledger: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="${IC}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5
    7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5
    2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621
    0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
  </svg>`,

  generalLedger: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="${IC}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.015H3.75V6.75Zm.375
    0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.015H3.75V12Zm.375
    0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.015H3.75v-.015Zm.375
    0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>
  </svg>`,

  trialBalance: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="${IC}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265
    4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5
    0c1.01.143 2.01.317 3 .52m-3-.52 2.62 4.608c.003.021.005.042.005.064 0
    1.036-1.007 1.875-2.25 1.875S8.875 11.668 8.875 10.632c0-.022.002-.043.005-.064L11.5
    4.97m5.25 0L18.75 4.97M5.25 4.97 3 9.978c-.003.021-.005.042-.005.064 0 1.036 1.007
    1.875 2.25 1.875s2.25-.84 2.25-1.875c0-.022-.002-.043-.005-.064L5.25 4.97Z"/>
  </svg>`,

  accountType: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="${IC}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5
    0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0
    0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5
    1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"/>
  </svg>`,

  // trending-up — Profit & Loss
  profitLoss: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="${IC}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.519l2.74-1.22m0
    0-5.94-2.28m5.94 2.28-2.28 5.941"/>
  </svg>`,

  // table-cells — Balance Sheet
  balanceSheet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="${IC}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621
    0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375
    2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125
    -1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125
    -1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125
    1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c-.621 0-1.125.504
    -1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h.008v.008h-.008V8.25zm.375 0a.375.375
    0 1 1-.75 0 .375.375 0 0 1 .75 0z"/>
  </svg>`,
};

/* ── TITLE BLOCK ──────────────────────────────────────────────────────────── */

const titleBlock = (label, iconSvg) => ({
  columns: [
    { svg: iconSvg, width: 22, height: 22, margin: [0, 0, 8, 0] },
    { text: label, style: 'title', alignment: 'center', margin: [0, 2, 0, 0] },
  ],
  columnGap: 0,
  alignment: 'center',
  margin:    [0, 0, 0, 16],
});

/* ── STYLES ───────────────────────────────────────────────────────────────── */

const baseStyles = {
  headerFirmName: { fontSize: 14, bold: true,  color: '#111827' },
  title:          { fontSize: 18, bold: true,  color: '#111827', decoration: 'underline' },
  accountInfo:    { fontSize: 12, bold: true,  color: '#374151' },
  dateRange:      { fontSize: 10,              color: '#4B5563' },
  generatedOn:    { fontSize: 9,  italics: true, color: '#6B7280' },
  tableHeader:    { fontSize: 9,  bold: true,  color: '#374151', fillColor: '#F9FAFB' },
  tableCell:      { fontSize: 8 },
  summaryTitle:   { fontSize: 10, bold: true,  color: '#111827', fillColor: '#F3F4F6' },
  summaryLabel:   { fontSize: 9,  bold: true,  color: '#374151', margin: [0, 5, 0, 5] },
  summaryValue:   { fontSize: 9,               color: '#111827', margin: [0, 5, 0, 5] },
  totalLabel:     { fontSize: 9,  bold: true,  color: '#111827', fillColor: '#F3F4F6' },
  totalValue:     { fontSize: 9,  bold: true,  color: '#111827', fillColor: '#F3F4F6' },
};

/* ── TABLE LAYOUTS ────────────────────────────────────────────────────────── */

const tableLayout = {
  hLineWidth:    (i, n) => i === 0 || i === n.table.body.length ? 1 : 0.5,
  vLineWidth:    ()     => 0.5,
  hLineColor:    (i, n) => i === 0 || i === n.table.body.length ? '#374151' : '#E5E7EB',
  vLineColor:    ()     => '#E5E7EB',
  paddingLeft:   ()     => 5,
  paddingRight:  ()     => 5,
  paddingTop:    ()     => 5,
  paddingBottom: ()     => 5,
};

/**
 * T-account layout for 4-column [DrParticulars, DrAmount, CrParticulars, CrAmount].
 * Vertical line index meanings:
 *   i=0  left outer border
 *   i=1  between DrPart and DrAmount
 *   i=2  CENTER DIVIDER between Dr and Cr halves  ← thick
 *   i=3  between CrPart and CrAmount
 *   i=4  right outer border
 */
const tAccountLayout = {
  hLineWidth:    (i, n) => i === 0 || i === n.table.body.length ? 1.5 : 0.5,
  vLineWidth:    (i)    => i === 2 ? 2 : 0.5,
  hLineColor:    (i, n) => i === 0 || i === n.table.body.length ? '#1E293B' : '#E2E8F0',
  vLineColor:    (i)    => i === 2 ? '#64748B' : '#E2E8F0',
  paddingLeft:   (i)    => i === 0 ? 6 : 4,
  paddingRight:  (i)    => i === 3 ? 6 : 4,
  paddingTop:    ()     => 3,
  paddingBottom: ()     => 3,
};

/* ═══════════════════════════════════════════════════════════════════════════
   FINANCIAL STATEMENT CLASSIFICATION LOGIC
   (mirrors client-side profit-loss.js exactly)
═══════════════════════════════════════════════════════════════════════════ */

const PL_TYPES = new Set(['INCOME', 'EXPENSE', 'GENERAL']);
const BS_TYPES = new Set(['ASSET', 'LIABILITY', 'DEBTOR', 'CREDITOR', 'CASH', 'BANK']);
const COGS_KW  = ['cogs', 'cost of goods', 'purchase', 'inventory'];
const STOCK_KW = ['inventory', 'stock'];
const GST_KW   = ['gst', 'cgst', 'sgst', 'igst', 'tax receivable', 'input credit', 'input tax'];

const toN    = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const kwHit  = (kws, head) => kws.some(k => head.toLowerCase().includes(k));

const normAcc = (a) => {
  const dr    = toN(a.total_debit);
  const cr    = toN(a.total_credit);
  const netCr = cr - dr;
  const netDr = dr - cr;
  return { head: String(a.account_head ?? ''), type: String(a.account_type ?? '').toUpperCase(), dr, cr, netCr, netDr };
};

function buildPLModel(accounts, startDate, endDate) {
  const pl      = accounts.filter(a => PL_TYPES.has(a.type));
  const income  = pl.filter(a => a.type === 'INCOME');
  const expense = pl.filter(a => a.type === 'EXPENSE');
  const general = pl.filter(a => a.type === 'GENERAL');
  const cogs    = expense.filter(a => kwHit(COGS_KW, a.head));
  const opex    = expense.filter(a => !kwHit(COGS_KW, a.head));

  const crIncome       = income.filter(a => a.netCr >= 0);
  const drContraIncome = income.filter(a => a.netCr <  0);
  const drCOGS         = cogs .filter(a => a.netCr <= 0);
  const crCOGS         = cogs .filter(a => a.netCr >  0);
  const drOpex         = opex .filter(a => a.netCr <= 0);
  const crOpex         = opex .filter(a => a.netCr >  0);
  const crGeneral      = general.filter(a => a.netCr >= 0);
  const drGeneral      = general.filter(a => a.netCr <  0);

  const totalRevenueCr  = crIncome.reduce((s, a) => s + a.netCr, 0);
  const totalContraInc  = drContraIncome.reduce((s, a) => s + Math.abs(a.netCr), 0);
  const totalCOGS       = drCOGS.reduce((s, a) => s + Math.abs(a.netCr), 0) - crCOGS.reduce((s, a) => s + a.netCr, 0);
  const totalOpex       = drOpex.reduce((s, a) => s + Math.abs(a.netCr), 0) - crOpex.reduce((s, a) => s + a.netCr, 0);
  const totalGeneralNet = general.reduce((s, a) => s + a.netCr, 0);
  const effectiveRev    = totalRevenueCr - totalContraInc;
  const grossProfit     = effectiveRev - totalCOGS;
  const netProfit       = grossProfit - totalOpex + totalGeneralNet;
  const gpMargin        = effectiveRev ? (grossProfit / effectiveRev) * 100 : 0;
  const npMargin        = effectiveRev ? (netProfit   / effectiveRev) * 100 : 0;

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

  const periodLabel = dateRangeText(
    startDate ? formatDate(startDate) : null,
    endDate   ? formatDate(endDate)   : null,
  );

  return {
    periodLabel, startDate, endDate,
    crIncome, drContraIncome, drCOGS, crCOGS, drOpex, crOpex, crGeneral, drGeneral,
    totalRevenueCr, totalContraInc, effectiveRev,
    totalCOGS, totalOpex, totalGeneralNet,
    grossProfit, netProfit, gpMargin, npMargin,
    drGrand, crGrand,
    isEmpty: pl.length === 0,
  };
}

function buildBSModel(accounts, netProfit) {
  const bs = accounts.filter(a => BS_TYPES.has(a.type));
  const assetAcc = bs.filter(a => a.type === 'ASSET');
  const debtorsRaw = bs.filter(a => a.type === 'DEBTOR');
  const cashBankRaw = bs.filter(a => a.type === 'CASH' || a.type === 'BANK');
  const liabilitiesRaw = bs.filter(a => a.type === 'LIABILITY');
  const creditorsRaw = bs.filter(a => a.type === 'CREDITOR');

  const stockAssets = assetAcc.filter(a => kwHit(STOCK_KW, a.head) && a.netDr > 0);
  const gstAssets = assetAcc.filter(a => !kwHit(STOCK_KW, a.head) && kwHit(GST_KW, a.head) && a.netDr > 0);
  const otherAssets = assetAcc.filter(a => !kwHit(STOCK_KW, a.head) && !kwHit(GST_KW, a.head) && a.netDr > 0);
  const assetCreditBalances = assetAcc.filter(a => a.netCr > 0);

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
  const balanced      = Math.abs(totalAssets - totalLiabSide) < 0.02;

  return {
    stockAssets, gstAssets, otherAssets, debtors, cashBank,
    liabilityDebitBalances, creditorDebitBalances,
    liabilities, creditors, assetCreditBalances, debtorCreditBalances, cashBankCreditBalances,
    totalStock, totalGST, totalOtherA, totalDebtors, totalCashBank,
    totalLiabilityDebitBalances, totalCreditorDebitBalances, totalAssets,
    totalLiab, totalCred, totalAssetCreditBalances, totalDebtorCreditBalances, totalCashBankCreditBalances, totalExtLib, capital, netProfit,
    totalLiabSide, balanced,
    isEmpty: bs.length === 0,
  };
}

/* ── T-ACCOUNT CELL BUILDER ───────────────────────────────────────────────── */

/**
 * Convert a row-item descriptor into exactly 2 pdfmake cell objects.
 * @param {object} it  — item descriptor
 * @param {string} defaultAmtColor — default amount text colour
 */
function mkCells(it, defaultAmtColor = '#374151') {
  if (!it || it.type === 'empty') return [{ text: '' }, { text: '' }];
  const ac = it.amtColor || defaultAmtColor;

  switch (it.type) {
    case 'sHdr':
      return [
        { text: it.text, bold: true, fontSize: 7.5, fillColor: it.fill, color: it.color, margin: [3,3,3,3] },
        { text: '',                                  fillColor: it.fill },
      ];
    case 'item':
      return [
        { text: it.text, fontSize: 8, margin: [10,2,3,2] },
        { text: it.amt != null ? formatINR(it.amt) : '', fontSize: 8, alignment: 'right', noWrap: true, color: ac },
      ];
    case 'sub':
      return [
        { text: it.text, bold: true, fontSize: 8, fillColor: it.fill, color: it.color, margin: [3,3,3,3] },
        { text: formatINR(it.amt), bold: true, fontSize: 8, alignment: 'right', noWrap: true, fillColor: it.fill, color: it.color },
      ];
    case 'xfer':
      return [
        { stack: [
            { text: it.text, bold: true, fontSize: 8, color: it.color },
            ...(it.sub ? [{ text: it.sub, fontSize: 7, color: '#94A3B8' }] : []),
          ], fillColor: it.fill, margin: [3,3,3,3],
        },
        { text: formatINR(it.amt), bold: true, fontSize: 8, alignment: 'right', noWrap: true, fillColor: it.fill, color: it.color },
      ];
    case 'bal':
      return [
        { stack: [
            { text: it.text, bold: true, fontSize: 9, color: it.color },
            { text: it.sub || '', fontSize: 7, color: '#94A3B8' },
          ], fillColor: it.fill, margin: [3,4,3,4],
        },
        { text: formatINR(it.amt), bold: true, fontSize: 11, alignment: 'right', noWrap: true, fillColor: it.fill, color: it.color },
      ];
    case 'nil':
      return [
        { text: it.text, fontSize: 7.5, italics: true, color: '#9CA3AF', alignment: 'center' },
        { text: '' },
      ];
    default:
      return [{ text: '' }, { text: '' }];
  }
}

/* ── ITEM CONSTRUCTORS (shorthand) ───────────────────────────────────────── */

const sHdr = (text, fill, color)              => ({ type:'sHdr', text, fill, color });
const itm  = (text, amt, amtColor)            => ({ type:'item', text, amt, amtColor });
const sub  = (text, amt, fill, color)         => ({ type:'sub',  text, amt, fill, color });
const xfer = (text, xsub, amt, fill, color)   => ({ type:'xfer', text, sub:xsub, amt, fill, color });
const bal  = (text, bsub, amt, fill, color)   => ({ type:'bal',  text, sub:bsub, amt, fill, color });
const nil  = (text)                            => ({ type:'nil',  text });

/* ── P&L ROW BUILDERS ────────────────────────────────────────────────────── */

function drTradRows(m) {
  const R = [];
  R.push(sHdr('TO COST OF GOODS SOLD', '#FEF3C7', '#78350F'));
  if (!m.drCOGS.length) R.push(nil('No COGS accounts'));
  else m.drCOGS.forEach(r => R.push(itm(r.head, Math.abs(r.netCr))));
  R.push(sub('Total COGS', m.totalCOGS, '#FEF9C3', '#92400E'));
  if (m.drContraIncome.length) {
    R.push(sHdr('TO RETURNS / CONTRA INCOME', '#FED7AA', '#7C2D12'));
    m.drContraIncome.forEach(r => R.push(itm(r.head, Math.abs(r.netCr))));
    R.push(sub('Total Contra Income', m.totalContraInc, '#FFEDD5', '#9A3412'));
  }
  if (m.grossProfit >= 0)
    R.push(xfer('To Gross Profit c/d', 'Carried to P&L', m.grossProfit, '#E0F2FE', '#0369A1'));
  return R;
}

function crTradRows(m) {
  const R = [];
  R.push(sHdr('BY REVENUE / SALES', '#D1FAE5', '#065F46'));
  if (!m.crIncome.length) R.push(nil('No income accounts'));
  else m.crIncome.forEach(r => R.push(itm(r.head, r.netCr, '#059669')));
  R.push(sub('Total Revenue', m.totalRevenueCr, '#ECFDF5', '#059669'));
  if (m.grossProfit < 0)
    R.push(xfer('To Gross Loss c/d', 'Carried to P&L', Math.abs(m.grossProfit), '#FEE2E2', '#991B1B'));
  return R;
}

function drPLRows(m) {
  const R = [];
  R.push(sHdr('TO OPERATING EXPENSES', '#FEE2E2', '#991B1B'));
  if (!m.drOpex.length) R.push(nil('No expense accounts'));
  else m.drOpex.forEach(r => R.push(itm(r.head, Math.abs(r.netCr))));
  R.push(sub('Total Expenses', m.totalOpex, '#FEF2F2', '#B91C1C'));
  if (m.drGeneral.length) {
    R.push(sHdr('TO MISCELLANEOUS', '#F1F5F9', '#475569'));
    m.drGeneral.forEach(r => R.push(itm(r.head, Math.abs(r.netCr))));
  }
  if (m.netProfit >= 0)
    R.push(bal('To Net Profit', 'Balancing figure', m.netProfit, '#EDE9FE', '#5B21B6'));
  return R;
}

function crPLRows(m) {
  const R = [];
  if (m.grossProfit >= 0)
    R.push(xfer('By Gross Profit b/d', 'From Trading Account', m.grossProfit, '#E0F2FE', '#0369A1'));
  else
    R.push(xfer('By Gross Loss b/d',   'From Trading Account', Math.abs(m.grossProfit), '#FEE2E2', '#991B1B'));
  if (m.crGeneral.length) {
    R.push(sHdr('BY MISCELLANEOUS', '#F0FDFA', '#0F766E'));
    m.crGeneral.forEach(r => R.push(itm(r.head, r.netCr, '#059669')));
    R.push(sub('Total Misc. Income', m.crGeneral.reduce((s,a)=>s+a.netCr,0), '#F0FDFA', '#0F766E'));
  }
  if (m.crCOGS.length + m.crOpex.length) {
    R.push(sHdr('BY CONTRA EXPENSE', '#F8FAFC', '#475569'));
    [...m.crCOGS,...m.crOpex].forEach(r => R.push(itm(r.head, r.netCr, '#059669')));
  }
  if (m.netProfit < 0)
    R.push(bal('By Net Loss', 'Balancing figure', Math.abs(m.netProfit), '#FEF2F2', '#991B1B'));
  return R;
}

/* ── BALANCE SHEET ROW BUILDERS ──────────────────────────────────────────── */

function liabRows(m) {
  const R = [];
  R.push(sHdr('CAPITAL ACCOUNT', '#D1FAE5', '#065F46'));
  R.push(itm('Capital / Owner\'s Equity', Math.abs(m.capital), m.capital >= 0 ? '#059669' : '#DC2626'));
  R.push(itm(m.netProfit >= 0 ? 'Add: Net Profit' : 'Less: Net Loss', Math.abs(m.netProfit), m.netProfit >= 0 ? '#7C3AED' : '#DC2626'));
  R.push(sub('Total Capital', m.capital + m.netProfit, '#ECFDF5', '#059669'));
  if (m.liabilities.length) {
    R.push(sHdr('LOANS & LIABILITIES', '#FEE2E2', '#991B1B'));
    m.liabilities.forEach(r => R.push(itm(r.head, r.netCr, '#DC2626')));
    R.push(sub('Total Liabilities', m.totalLiab, '#FEF2F2', '#B91C1C'));
  }
  if (m.creditors.length) {
    R.push(sHdr('SUNDRY CREDITORS', '#FEF3C7', '#78350F'));
    m.creditors.forEach(r => R.push(itm(r.head, r.netCr, '#D97706')));
    R.push(sub('Total Creditors', m.totalCred, '#FEF9C3', '#92400E'));
  }
  if (m.debtorCreditBalances.length) {
    R.push(sHdr('DEBTOR ACCOUNTS (CREDIT BALANCE)', '#DBEAFE', '#1D4ED8'));
    m.debtorCreditBalances.forEach(r => R.push(itm(r.head, r.netCr, '#2563EB')));
    R.push(sub('Total Debtor Credit Balances', m.totalDebtorCreditBalances, '#EFF6FF', '#1D4ED8'));
  }
  if (m.cashBankCreditBalances.length) {
    R.push(sHdr('CASH & BANK (CREDIT BALANCE)', '#D1FAE5', '#065F46'));
    m.cashBankCreditBalances.forEach(r => R.push(itm(r.head, r.netCr, '#059669')));
    R.push(sub('Total Cash & Bank Credit Balances', m.totalCashBankCreditBalances, '#ECFDF5', '#059669'));
  }
  if (m.assetCreditBalances.length) {
    R.push(sHdr('ASSET ACCOUNTS (CREDIT BALANCE)', '#EDE9FE', '#5B21B6'));
    m.assetCreditBalances.forEach(r => R.push(itm(r.head, r.netCr, '#6D28D9')));
    R.push(sub('Total Asset Credit Balances', m.totalAssetCreditBalances, '#F5F3FF', '#5B21B6'));
  }
  return R;
}

function assetRows(m) {
  const R = [];
  if (m.otherAssets.length) {
    R.push(sHdr('FIXED & OTHER ASSETS', '#DBEAFE', '#1E40AF'));
    m.otherAssets.forEach(r => R.push(itm(r.head, r.netDr, '#1D4ED8')));
    R.push(sub('Total Fixed Assets', m.totalOtherA, '#EFF6FF', '#1E40AF'));
  }
  if (m.stockAssets.length) {
    R.push(sHdr('STOCK & INVENTORY', '#CCFBF1', '#0F766E'));
    m.stockAssets.forEach(r => R.push(itm(r.head, r.netDr, '#0F766E')));
    R.push(sub('Total Stock', m.totalStock, '#F0FDFA', '#0F766E'));
  }
  if (m.gstAssets.length) {
    R.push(sHdr('TAX RECEIVABLES (GST)', '#EDE9FE', '#5B21B6'));
    m.gstAssets.forEach(r => R.push(itm(r.head, r.netDr, '#6D28D9')));
    R.push(sub('Total Tax Receivable', m.totalGST, '#F5F3FF', '#5B21B6'));
  }
  if (m.debtors.length) {
    R.push(sHdr('SUNDRY DEBTORS', '#DBEAFE', '#1D4ED8'));
    m.debtors.forEach(r => R.push(itm(r.head, r.netDr, '#2563EB')));
    R.push(sub('Total Debtors', m.totalDebtors, '#EFF6FF', '#1D4ED8'));
  }
  if (m.cashBank.length) {
    R.push(sHdr('CASH & BANK', '#D1FAE5', '#065F46'));
    m.cashBank.forEach(r => R.push(itm(r.head, r.netDr, '#059669')));
    R.push(sub('Total Cash & Bank', m.totalCashBank, '#ECFDF5', '#059669'));
  }
  if (m.liabilityDebitBalances.length) {
    R.push(sHdr('LIABILITY ACCOUNTS (DEBIT BALANCE)', '#FEE2E2', '#991B1B'));
    m.liabilityDebitBalances.forEach(r => R.push(itm(r.head, r.netDr, '#DC2626')));
    R.push(sub('Total Liability Debit Balances', m.totalLiabilityDebitBalances, '#FEF2F2', '#B91C1C'));
  }
  if (m.creditorDebitBalances.length) {
    R.push(sHdr('CREDITOR ACCOUNTS (DEBIT BALANCE)', '#FEF3C7', '#78350F'));
    m.creditorDebitBalances.forEach(r => R.push(itm(r.head, r.netDr, '#D97706')));
    R.push(sub('Total Creditor Debit Balances', m.totalCreditorDebitBalances, '#FEF9C3', '#92400E'));
  }
  if (!R.length) R.push(nil('No asset accounts found'));
  return R;
}

/* ── PAIR ROWS HELPER ────────────────────────────────────────────────────── */

function pairRows(drR, crR, drDef, crDef) {
  const len  = Math.max(drR.length, crR.length);
  const rows = [];
  for (let i = 0; i < len; i++) {
    const dr = drR[i] || { type: 'empty' };
    const cr = crR[i] || { type: 'empty' };
    rows.push([...mkCells(dr, drDef), ...mkCells(cr, crDef)]);
  }
  return rows;
}

/* ── T-ACCOUNT TABLE BODY BUILDERS ──────────────────────────────────────── */

function fullRow(text, fill, color, fontSize = 8) {
  return [
    { text, colSpan: 4, alignment: 'center', bold: true, fontSize,
      fillColor: fill, color, margin: [0,3,0,3] },
    {}, {}, {},
  ];
}

function buildPLTableBody(m) {
  const isP = m.netProfit >= 0;
  return [
    fullRow('TRADING & PROFIT & LOSS ACCOUNT', '#0F172A', '#F8FAFC', 11),
    fullRow(m.periodLabel, '#0F172A', '#94A3B8', 7.5),
    // Col headers
    [{ text:'Dr  —  Debit Side',   colSpan:2, bold:true, fontSize:8, fillColor:'#FEF3C7', color:'#78350F', margin:[4,4,4,4] }, {},
     { text:'Cr  —  Credit Side',  colSpan:2, bold:true, fontSize:8, fillColor:'#D1FAE5', color:'#065F46', alignment:'right', margin:[4,4,4,4] }, {}],
    // Trading section divider
    fullRow('TRADING ACCOUNT  ·  Revenue vs Cost of Goods Sold', '#334155', '#CBD5E1'),
    // Trading rows
    ...pairRows(drTradRows(m), crTradRows(m), '#374151', '#059669'),
    // P&L section divider
    fullRow('PROFIT & LOSS ACCOUNT  ·  Expenses vs Gross Profit & Other Income', '#334155', '#CBD5E1'),
    // P&L rows
    ...pairRows(drPLRows(m), crPLRows(m), '#374151', '#059669'),
    // Grand total
    [{ text:'Dr Grand Total',        bold:true, fontSize:9, fillColor:isP?'#4C1D95':'#7F1D1D', color:'#FFFFFF', margin:[4,5,4,5] },
     { text:formatINR(m.drGrand),    bold:true, fontSize:9, alignment:'right', noWrap:true, fillColor:isP?'#4C1D95':'#7F1D1D', color:'#FFFFFF' },
     { text:'Cr Grand Total',        bold:true, fontSize:9, fillColor:isP?'#4C1D95':'#7F1D1D', color:'#FFFFFF', margin:[4,5,4,5] },
     { text:formatINR(m.crGrand),    bold:true, fontSize:9, alignment:'right', noWrap:true, fillColor:isP?'#4C1D95':'#7F1D1D', color:'#FFFFFF' }],
  ];
}

function buildBSTableBody(m) {
  const balText = m.balanced
    ? '\u2713  Balanced  \u2014  Total Assets = Total Liabilities'
    : `\u26A0  Imbalance: ${formatINR(Math.abs(m.totalAssets - m.totalLiabSide))} difference`;
  return [
    fullRow('BALANCE SHEET', '#0F172A', '#F8FAFC', 11),
    [{ text: balText, colSpan:4, alignment:'center', fontSize:7.5, italics:true,
       fillColor: m.balanced ? '#ECFDF5' : '#FEF2F2',
       color:     m.balanced ? '#065F46' : '#991B1B', margin:[0,3,0,3] }, {},{},{}],
    // Col headers
    [{ text:'Liabilities & Capital', colSpan:2, bold:true, fontSize:8, fillColor:'#FEE2E2', color:'#991B1B', margin:[4,4,4,4] }, {},
     { text:'Assets',                colSpan:2, bold:true, fontSize:8, fillColor:'#DBEAFE', color:'#1E40AF', alignment:'right', margin:[4,4,4,4] }, {}],
    // Paired data rows
    ...pairRows(liabRows(m), assetRows(m), '#DC2626', '#1D4ED8'),
    // Grand total
    [{ text:'Total Liabilities & Capital', bold:true, fontSize:9, fillColor:'#1E293B', color:'#FFFFFF', margin:[4,5,4,5] },
     { text:formatINR(m.totalLiabSide),    bold:true, fontSize:9, alignment:'right', noWrap:true, fillColor:'#1E293B', color:'#FFFFFF' },
     { text:'Total Assets',                bold:true, fontSize:9, fillColor:'#1E293B', color:'#FFFFFF', margin:[4,5,4,5] },
     { text:formatINR(m.totalAssets),      bold:true, fontSize:9, alignment:'right', noWrap:true, fillColor:'#1E293B', color:'#FFFFFF' }],
  ];
}

/* ── SHARED DB QUERY ─────────────────────────────────────────────────────── */

async function fetchLedgerAccounts(firmId, start_date, end_date) {
  const matchStage = { firm_id: new mongoose.Types.ObjectId(firmId) };
  if (start_date) matchStage.transaction_date = { ...matchStage.transaction_date, $gte: start_date };
  if (end_date)   matchStage.transaction_date = { ...matchStage.transaction_date, $lte: end_date };
  const raw = await Ledger.aggregate([
    { $match: matchStage },
    { $group: {
        _id: {
          account_head: '$account_head',
          account_type: '$account_type',
          bank_account_id: '$bank_account_id',
        },
        total_debit:  { $sum: '$debit_amount'  },
        total_credit: { $sum: '$credit_amount' },
    }},
    { $lookup: {
        from: BankAccount.collection.name,
        localField: '_id.bank_account_id',
        foreignField: '_id',
        as: 'bank_account',
    }},
    { $project: {
        _id:          0,
        account_head: {
          $cond: [
            {
              $and: [
                { $eq: ['$_id.account_type', 'BANK'] },
                { $gt: [{ $size: '$bank_account' }, 0] },
              ],
            },
            {
              $ifNull: [
                { $arrayElemAt: ['$bank_account.bank_name', 0] },
                '$_id.account_head',
              ],
            },
            '$_id.account_head',
          ],
        },
        account_type: '$_id.account_type',
        total_debit:  1,
        total_credit: 1,
        balance:      { $subtract: ['$total_debit', '$total_credit'] },
    }},
    { $sort: { account_head: 1 } },
  ]);
  return raw.map(normAcc);
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXISTING EXPORTS — BUGS FIXED
═══════════════════════════════════════════════════════════════════════════ */

/* ── ACCOUNT LEDGER PDF ──────────────────────────────────────────────────── */

export const exportAccountLedgerPdf = async (req, res) => {
  try {
    const { account_head } = req.params;
    const { start_date, end_date } = req.query;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'Not authorized' });

    const firmId   = req.user.firm_id;
    const firm     = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    // FIX: Calculate opening balance (all transactions before start_date)
    let openingBalance = 0;
    if (start_date) {
      const openingFilter = { 
        firm_id: firmId, 
        account_head,
        transaction_date: { $lt: start_date }
      };
      const openingRecords = await Ledger.find(openingFilter).lean();
      openingBalance = openingRecords.reduce((sum, r) => {
        return sum + (r.debit_amount || 0) - (r.credit_amount || 0);
      }, 0);
    }

    const filter = { firm_id: firmId, account_head };
    if (start_date) filter.transaction_date = { ...filter.transaction_date, $gte: start_date };
    if (end_date)   filter.transaction_date = { ...filter.transaction_date, $lte: end_date };

    const rawRecords = await Ledger.find(filter).sort({ transaction_date: 1, createdAt: 1 }).lean();
    if (!rawRecords.length) return res.status(404).json({ error: 'No ledger records found for this account' });

    let runningBalance = openingBalance;
    const records = rawRecords.map(r => {
      runningBalance += (r.debit_amount || 0) - (r.credit_amount || 0);
      return { ...r, balance_after: runningBalance };
    });

    const totalDebits   = records.reduce((s, r) => s + (r.debit_amount  || 0), 0);
    const totalCredits  = records.reduce((s, r) => s + (r.credit_amount || 0), 0);
    const closingBal    = runningBalance;
    const rangeText     = dateRangeText(start_date ? formatDate(start_date) : null, end_date ? formatDate(end_date) : null);

    const docDef = {
      pageSize: 'A4', pageMargins: [20, 60, 20, 60],
      defaultStyle: { font: 'DejaVuSans' },
      header: (cp, pc) => ({ columns: [
        { text: firmName, style: 'headerFirmName', margin: [20,20,0,5] },
        { text: `Page ${cp} of ${pc}`, alignment: 'right', margin: [0,20,20,5], fontSize: 9 },
      ]}),
      content: [
        titleBlock('LEDGER REPORT', icons.ledger),
        { text: `Account: ${account_head}`, style: 'accountInfo', margin: [0,0,0,5] },
        { text: `Period: ${rangeText}`,     style: 'dateRange',   margin: [0,0,0,5] },
        { text: `Generated: ${new Date().toLocaleString('en-IN')}`, style: 'generatedOn', margin: [0,0,0,18] },
        {
          table: {
            headerRows: 1,
            // BUG FIX 4 — amount columns were 72/72/88pt; increased to 84/84/96pt.
            // At DejaVuSans 8pt, "₹ 20,80,000.00 DR" needs ~90pt including padding.
            widths: [52, 62, 68, '*', 84, 84, 96],
            body: [
              [
                { text:'Date',         style:'tableHeader', alignment:'center' },
                { text:'Voucher No',   style:'tableHeader', alignment:'center' },
                { text:'Voucher Type', style:'tableHeader', alignment:'center' },
                { text:'Narration',    style:'tableHeader', alignment:'center' },
                { text:'Debit',        style:'tableHeader', alignment:'right'  },
                { text:'Credit',       style:'tableHeader', alignment:'right'  },
                { text:'Balance',      style:'tableHeader', alignment:'right'  },
              ],
              ...records.map(r => [
                { text: formatDate(r.transaction_date), style:'tableCell', alignment:'center', noWrap:true },
                { text: r.voucher_no   || '', style:'tableCell', alignment:'center', noWrap:true },
                { text: r.voucher_type || '', style:'tableCell', alignment:'center', noWrap:true },
                { text: r.narration    || '', style:'tableCell' },
                { text: r.debit_amount  > 0 ? formatINR(r.debit_amount)  : '', style:'tableCell', alignment:'right', noWrap:true, color: r.debit_amount  > 0 ? '#059669' : undefined },
                { text: r.credit_amount > 0 ? formatINR(r.credit_amount) : '', style:'tableCell', alignment:'right', noWrap:true, color: r.credit_amount > 0 ? '#DC2626' : undefined },
                { text: formatINR(Math.abs(r.balance_after)) + drCr(r.balance_after),
                  style:'tableCell', alignment:'right', bold:true, noWrap:true,
                  color: r.balance_after > 0 ? '#059669' : r.balance_after < 0 ? '#DC2626' : undefined },
              ]),
            ],
          },
          layout: tableLayout,
        },
        // BUG FIX 5 — summary table: fixed widths (not 'auto') + noWrap on all amounts
        {
          margin: [0, 20, 0, 0],
          table: {
            widths: ['*', 130, 10],
            body: [
              [{ text:'SUMMARY', style:'summaryTitle', colSpan:3, alignment:'center' }, {}, {}],
              [{ text:'Total Debits:',    style:'summaryLabel' },
               { text:formatINR(totalDebits),  style:'summaryValue', alignment:'right', noWrap:true }, {}],
              [{ text:'Total Credits:',   style:'summaryLabel' },
               { text:formatINR(totalCredits), style:'summaryValue', alignment:'right', noWrap:true }, {}],
              [{ text:'Closing Balance:', style:'summaryLabel' },
               { text:formatINR(Math.abs(closingBal)) + drCr(closingBal), style:'summaryValue', alignment:'right', bold:true, noWrap:true,
                 color: closingBal > 0 ? '#059669' : closingBal < 0 ? '#DC2626' : undefined }, {}],
            ],
          },
          layout: 'noBorders',
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc  = await printer.createPdfKitDocument(docDef);
    const safeName = String(account_head || 'LEDGER').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Ledger_${safeName}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('[LEDGER_PDF]', err);
    res.status(500).json({ error: 'Error generating ledger PDF: ' + err.message });
  }
};

/* ── GENERAL LEDGER PDF ──────────────────────────────────────────────────── */

export const exportGeneralLedgerPdf = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'Not authorized' });

    const firmId   = req.user.firm_id;
    const firm     = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    const accounts  = await fetchLedgerAccounts(firmId, start_date, end_date);
    if (!accounts.length) return res.status(404).json({ error: 'No ledger accounts found' });

    const rangeText = dateRangeText(start_date ? formatDate(start_date) : null, end_date ? formatDate(end_date) : null);

    const docDef = {
      pageSize: 'A4', pageMargins: [20, 60, 20, 60],
      defaultStyle: { font: 'DejaVuSans' },
      header: (cp, pc) => ({ columns: [
        { text: firmName, style:'headerFirmName', margin:[20,20,0,5] },
        { text:`Page ${cp} of ${pc}`, alignment:'right', margin:[0,20,20,5], fontSize:9 },
      ]}),
      content: [
        titleBlock('GENERAL LEDGER REPORT', icons.generalLedger),
        { text:`Firm: ${firmName}`, style:'accountInfo', margin:[0,0,0,5] },
        { text:`Period: ${rangeText}`, style:'dateRange', margin:[0,0,0,5] },
        { text:`Generated: ${new Date().toLocaleString('en-IN')}`, style:'generatedOn', margin:[0,0,0,18] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 80, 84, 84, 96],
            body: [
              [
                { text:'Account Head', style:'tableHeader', alignment:'left'   },
                { text:'Type',         style:'tableHeader', alignment:'center' },
                { text:'Debits',       style:'tableHeader', alignment:'right'  },
                { text:'Credits',      style:'tableHeader', alignment:'right'  },
                { text:'Balance',      style:'tableHeader', alignment:'right'  },
              ],
              ...accounts.map(a => [
                { text: a.head, style:'tableCell' },
                { text: a.type, style:'tableCell', alignment:'center', noWrap:true },
                { text: formatINR(a.dr),              style:'tableCell', alignment:'right', noWrap:true, color: a.dr > 0 ? '#059669' : undefined },
                { text: formatINR(a.cr),              style:'tableCell', alignment:'right', noWrap:true, color: a.cr > 0 ? '#DC2626' : undefined },
                { text: formatINR(Math.abs(a.netDr)) + (a.netDr > 0 ? '\u00A0DR' : a.netDr < 0 ? '\u00A0CR' : ''),
                  style:'tableCell', alignment:'right', bold:true, noWrap:true,
                  color: a.netDr > 0 ? '#059669' : a.netDr < 0 ? '#DC2626' : undefined },
              ]),
            ],
          },
          layout: tableLayout,
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc = await printer.createPdfKitDocument(docDef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="General_Ledger_${new Date().toISOString().slice(0,10)}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('[GENERAL_LEDGER_PDF]', err);
    res.status(500).json({ error: 'Error generating general ledger PDF: ' + err.message });
  }
};

/* ── TRIAL BALANCE PDF ───────────────────────────────────────────────────── */

export const exportTrialBalancePdf = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'Not authorized' });

    const firmId   = req.user.firm_id;
    const firm     = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    const accounts     = await fetchLedgerAccounts(firmId, start_date, end_date);
    if (!accounts.length) return res.status(404).json({ error: 'No ledger accounts found' });

    const totalDebits  = accounts.reduce((s, a) => s + a.dr, 0);
    const totalCredits = accounts.reduce((s, a) => s + a.cr, 0);
    const isBalanced   = Math.abs(totalDebits - totalCredits) < 0.02;
    const rangeText    = dateRangeText(start_date ? formatDate(start_date) : null, end_date ? formatDate(end_date) : null);

    const docDef = {
      pageSize: 'A4', pageMargins: [20, 60, 20, 60],
      defaultStyle: { font: 'DejaVuSans' },
      header: (cp, pc) => ({ columns: [
        { text: firmName, style:'headerFirmName', margin:[20,20,0,5] },
        { text:`Page ${cp} of ${pc}`, alignment:'right', margin:[0,20,20,5], fontSize:9 },
      ]}),
      content: [
        titleBlock('TRIAL BALANCE', icons.trialBalance),
        { text:`Firm: ${firmName}`, style:'accountInfo', margin:[0,0,0,5] },
        { text:`Period: ${rangeText}`, style:'dateRange', margin:[0,0,0,5] },
        { text:`Generated: ${new Date().toLocaleString('en-IN')}`, style:'generatedOn', margin:[0,0,0,5] },
        // Balance status badge
        { text: isBalanced ? '\u2713  Balanced' : '\u26A0  Imbalanced',
          fontSize: 9, bold: true, margin:[0,0,0,14],
          color: isBalanced ? '#059669' : '#DC2626' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 84, 84, 96],
            body: [
              [
                { text:'Account Head', style:'tableHeader', alignment:'left'  },
                { text:'Debits',       style:'tableHeader', alignment:'right' },
                { text:'Credits',      style:'tableHeader', alignment:'right' },
                { text:'Balance',      style:'tableHeader', alignment:'right' },
              ],
              ...accounts.map(a => [
                { text: a.head, style:'tableCell' },
                { text: formatINR(a.dr), style:'tableCell', alignment:'right', noWrap:true, color: a.dr > 0 ? '#059669' : undefined },
                { text: formatINR(a.cr), style:'tableCell', alignment:'right', noWrap:true, color: a.cr > 0 ? '#DC2626' : undefined },
                { text: formatINR(Math.abs(a.netDr)) + (a.netDr > 0 ? '\u00A0DR' : a.netDr < 0 ? '\u00A0CR' : ''),
                  style:'tableCell', alignment:'right', noWrap:true, bold:true,
                  color: a.netDr > 0 ? '#059669' : a.netDr < 0 ? '#DC2626' : undefined },
              ]),
              // Totals row
              [
                { text:'TOTALS', style:'totalLabel', bold:true },
                { text:formatINR(totalDebits),  style:'totalValue', bold:true, alignment:'right', noWrap:true },
                { text:formatINR(totalCredits), style:'totalValue', bold:true, alignment:'right', noWrap:true },
                { text: isBalanced ? '\u2713  Balanced' : formatINR(Math.abs(totalDebits-totalCredits))+' diff',
                  style:'totalValue', bold:true, alignment:'right', noWrap:true,
                  color: isBalanced ? '#059669' : '#DC2626' },
              ],
            ],
          },
          layout: tableLayout,
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc = await printer.createPdfKitDocument(docDef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Trial_Balance_${new Date().toISOString().slice(0,10)}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('[TRIAL_BALANCE_PDF]', err);
    res.status(500).json({ error: 'Error generating trial balance PDF: ' + err.message });
  }
};

/* ── ACCOUNT TYPE PDF ────────────────────────────────────────────────────── */

export const exportAccountTypePdf = async (req, res) => {
  try {
    const { accounts, account_type } = req.body;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'Not authorized' });

    const firmId   = req.user.firm_id;
    const firm     = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    const parsed = typeof accounts === 'string' ? JSON.parse(accounts) : accounts;
    if (!parsed?.length) return res.status(404).json({ error: 'No account data provided' });

    const totalDebits  = parsed.reduce((s, a) => s + (a.total_debit  || 0), 0);
    const totalCredits = parsed.reduce((s, a) => s + (a.total_credit || 0), 0);
    const netBalance   = totalDebits - totalCredits;

    const docDef = {
      pageSize: 'A4', pageMargins: [20, 60, 20, 60],
      defaultStyle: { font: 'DejaVuSans' },
      header: (cp, pc) => ({ columns: [
        { text: firmName, style:'headerFirmName', margin:[20,20,0,5] },
        { text:`Page ${cp} of ${pc}`, alignment:'right', margin:[0,20,20,5], fontSize:9 },
      ]}),
      content: [
        titleBlock('ACCOUNT TYPE DETAILS', icons.accountType),
        { text:`Account Type: ${account_type}`, style:'accountInfo', margin:[0,0,0,10] },
        { text:`Generated: ${new Date().toLocaleString('en-IN')}`, style:'generatedOn', margin:[0,0,0,18] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 84, 84, 96],
            body: [
              [
                { text:'Account Head',  style:'tableHeader', alignment:'left'  },
                { text:'Debit Total',   style:'tableHeader', alignment:'right' },
                { text:'Credit Total',  style:'tableHeader', alignment:'right' },
                { text:'Balance',       style:'tableHeader', alignment:'right' },
              ],
              ...parsed.map(a => {
                const bal = a.balance || 0;
                return [
                  { text: a.account_head, style:'tableCell' },
                  { text: formatINR(a.total_debit  || 0), style:'tableCell', alignment:'right', noWrap:true, color: (a.total_debit  || 0) > 0 ? '#059669' : undefined },
                  { text: formatINR(a.total_credit || 0), style:'tableCell', alignment:'right', noWrap:true, color: (a.total_credit || 0) > 0 ? '#DC2626' : undefined },
                  { text: formatINR(Math.abs(bal)) + (bal > 0 ? '\u00A0DR' : bal < 0 ? '\u00A0CR' : ''),
                    style:'tableCell', alignment:'right', bold:true, noWrap:true,
                    color: bal > 0 ? '#059669' : bal < 0 ? '#DC2626' : undefined },
                ];
              }),
            ],
          },
          layout: tableLayout,
        },
        // BUG FIX 5 (continued) — fixed widths, noWrap on summary amounts
        {
          margin: [0, 20, 0, 0],
          table: {
            widths: ['*', 130, 10],
            body: [
              [{ text:'SUMMARY', style:'summaryTitle', colSpan:3, alignment:'center' }, {}, {}],
              [{ text:'Total Debits:',  style:'summaryLabel' }, { text:formatINR(totalDebits),  style:'summaryValue', alignment:'right', noWrap:true }, {}],
              [{ text:'Total Credits:', style:'summaryLabel' }, { text:formatINR(totalCredits), style:'summaryValue', alignment:'right', noWrap:true }, {}],
              [{ text:'Net Balance:',   style:'summaryLabel' },
               { text:formatINR(Math.abs(netBalance)) + drCr(netBalance), style:'summaryValue', alignment:'right', bold:true, noWrap:true,
                 color: netBalance > 0 ? '#059669' : netBalance < 0 ? '#DC2626' : undefined }, {}],
            ],
          },
          layout: 'noBorders',
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc   = await printer.createPdfKitDocument(docDef);
    const safeType = String(account_type || 'ACCOUNT_TYPE').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Account_Type_${safeType}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('[ACCOUNT_TYPE_PDF]', err);
    res.status(500).json({ error: 'Error generating account type PDF: ' + err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: PROFIT & LOSS PDF
═══════════════════════════════════════════════════════════════════════════ */

export const exportProfitLossPdf = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'Not authorized' });

    const firmId   = req.user.firm_id;
    const firm     = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    const accounts = await fetchLedgerAccounts(firmId, start_date, end_date);
    const model    = buildPLModel(accounts, start_date || null, end_date || null);

    if (model.isEmpty) return res.status(404).json({ error: 'No P&L data found in the ledger.' });

    const isProfit = model.netProfit >= 0;

    const docDef = {
      pageSize:    'A4',
      pageMargins: [25, 65, 25, 65],
      defaultStyle: { font: 'DejaVuSans' },

      header: (cp, pc) => ({ columns: [
        { text: firmName, style:'headerFirmName', margin:[25,20,0,5] },
        { text:`Page ${cp} of ${pc}`, alignment:'right', margin:[0,20,25,5], fontSize:9 },
      ]}),

      footer: (cp, pc) => ({ columns: [
        { text:`Generated: ${new Date().toLocaleString('en-IN')}`, style:'generatedOn', margin:[25,5,0,0] },
        { text: isProfit ? `Net Profit: ${formatINR(model.netProfit)}` : `Net Loss: ${formatINR(Math.abs(model.netProfit))}`,
          alignment:'right', margin:[0,5,25,0], fontSize:9, bold:true,
          color: isProfit ? '#5B21B6' : '#991B1B' },
      ]}),

      content: [
        titleBlock('PROFIT & LOSS STATEMENT', icons.profitLoss),
        { text:`Firm: ${firmName}`,              style:'accountInfo', margin:[0,0,0,4] },
        { text:`Period: ${model.periodLabel}`,   style:'dateRange',   margin:[0,0,0,14] },

        // The T-account table
        {
          table: {
            // headerRows:3 repeats title + period + col headers on each page
            headerRows: 3,
            widths: ['*', 90, '*', 90],
            body:   buildPLTableBody(model),
          },
          layout: tAccountLayout,
        },

        // Net result summary
        {
          margin: [0, 18, 0, 0],
          table: {
            widths: ['*', 160],
            body: [
              [
                { text: isProfit ? 'NET PROFIT FOR THE PERIOD' : 'NET LOSS FOR THE PERIOD',
                  bold:true, fontSize:11,
                  fillColor: isProfit ? '#4C1D95' : '#7F1D1D', color:'#FFFFFF', margin:[10,8,8,8] },
                { text: formatINR(Math.abs(model.netProfit)),
                  bold:true, fontSize:14, alignment:'right', noWrap:true,
                  fillColor: isProfit ? '#4C1D95' : '#7F1D1D', color:'#FFFFFF', margin:[8,8,10,8] },
              ],
              [
                { text:`Gross Margin: ${model.gpMargin.toFixed(1)}%\u2002\u00B7\u2002Net Margin: ${model.npMargin.toFixed(1)}%`,
                  colSpan:2, fontSize:8, color:'#6B7280', alignment:'center', margin:[0,5,0,5] }, {},
              ],
            ],
          },
          layout: 'noBorders',
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc = await printer.createPdfKitDocument(docDef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Profit_Loss_${new Date().toISOString().slice(0,10)}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('[P_L_PDF]', err);
    res.status(500).json({ error: 'Error generating P&L PDF: ' + err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: BALANCE SHEET PDF
═══════════════════════════════════════════════════════════════════════════ */

export const exportBalanceSheetPdf = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'Not authorized' });

    const firmId   = req.user.firm_id;
    const firm     = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    const accounts  = await fetchLedgerAccounts(firmId, start_date, end_date);
    // Build P&L first to get netProfit for Capital calculation
    const plModel   = buildPLModel(accounts, start_date || null, end_date || null);
    const bsModel   = buildBSModel(accounts, plModel.netProfit);

    if (bsModel.isEmpty) return res.status(404).json({ error: 'No Balance Sheet data found in the ledger.' });

    const periodLabel = dateRangeText(
      start_date ? formatDate(start_date) : null,
      end_date   ? formatDate(end_date)   : null,
    );

    const docDef = {
      pageSize:    'A4',
      pageMargins: [25, 65, 25, 65],
      defaultStyle: { font: 'DejaVuSans' },

      header: (cp, pc) => ({ columns: [
        { text: firmName, style:'headerFirmName', margin:[25,20,0,5] },
        { text:`Page ${cp} of ${pc}`, alignment:'right', margin:[0,20,25,5], fontSize:9 },
      ]}),

      footer: () => ({ columns: [
        { text:`Generated: ${new Date().toLocaleString('en-IN')}`, style:'generatedOn', margin:[25,5,0,0] },
        { text: bsModel.balanced ? '\u2713 Balanced' : '\u26A0 Imbalanced',
          alignment:'right', margin:[0,5,25,0], fontSize:9, bold:true,
          color: bsModel.balanced ? '#059669' : '#DC2626' },
      ]}),

      content: [
        titleBlock('BALANCE SHEET', icons.balanceSheet),
        { text:`Firm: ${firmName}`, style:'accountInfo', margin:[0,0,0,4] },
        { text:`Period: ${periodLabel}`, style:'dateRange', margin:[0,0,0,14] },

        {
          table: {
            headerRows: 3,
            widths: ['*', 90, '*', 90],
            body:   buildBSTableBody({ ...bsModel, periodLabel }),
          },
          layout: tAccountLayout,
        },

        // Summary totals box
        {
          margin: [0, 18, 0, 0],
          table: {
            widths: ['*', '*'],
            body: [
              [
                { text:`Total Liabilities & Capital\n${formatINR(bsModel.totalLiabSide)}`,
                  bold:true, fontSize:10, alignment:'center',
                  fillColor:'#1E293B', color:'#FFFFFF', margin:[8,10,8,10], noWrap:false },
                { text:`Total Assets\n${formatINR(bsModel.totalAssets)}`,
                  bold:true, fontSize:10, alignment:'center',
                  fillColor:'#1E293B', color:'#FFFFFF', margin:[8,10,8,10], noWrap:false },
              ],
              [
                { text: bsModel.balanced
                    ? '\u2713  Assets = Liabilities  \u2014  Books are balanced'
                    : `\u26A0  Imbalance of ${formatINR(Math.abs(bsModel.totalAssets - bsModel.totalLiabSide))}`,
                  colSpan:2, fontSize:8.5, bold:true, alignment:'center', margin:[0,6,0,6],
                  color: bsModel.balanced ? '#059669' : '#DC2626' }, {},
              ],
              [
                { text:`Capital: ${formatINR(bsModel.capital)}\u2002\u00B7\u2002Net Profit/(Loss): ${formatINR(bsModel.netProfit)}`,
                  colSpan:2, fontSize:7.5, color:'#6B7280', alignment:'center', margin:[0,3,0,3] }, {},
              ],
            ],
          },
          layout: 'noBorders',
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc = await printer.createPdfKitDocument(docDef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Balance_Sheet_${new Date().toISOString().slice(0,10)}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('[BS_PDF]', err);
    res.status(500).json({ error: 'Error generating Balance Sheet PDF: ' + err.message });
  }
};
