/**
 * PDF Generator Utility
 * Generates PDF documents for bills, vouchers, and reports using pdfmake.
 * No DB dependency — uses Mongoose document shapes instead of SQLite rows.
 */

import PdfPrinter from 'pdfmake';
import { formatReadableDate } from './dateFormatter.js';

// pdfmake uses standard built-in fonts
const fonts = {
  Roboto: {
    normal:      'Helvetica',
    bold:        'Helvetica-Bold',
    italics:     'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(fonts);

/* ─────────────────────────────────────────────
   INVOICE PDF
───────────────────────────────────────────── */

/**
 * Generate invoice PDF
 * @param {Object} bill  - Bill Mongoose doc (or plain object)
 * @param {Object} firm  - Firm Mongoose doc (or plain object)
 * @param {Array}  items - Array of line items
 * @returns {Promise<Buffer>}
 */
export function generateInvoicePDF(bill, firm, items) {
  const docDefinition = {
    pageSize:    'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      // ── Firm header ──
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: firm.name,                        style: 'firmName' },
              { text: firm.address || '',               style: 'firmAddress' },
              { text: `GSTIN: ${firm.gst_number || 'N/A'}`, style: 'firmDetails' },
              { text: `PAN: ${firm.pan_number || 'N/A'}`,   style: 'firmDetails' },
            ],
          },
          {
            width: 'auto',
            stack: [
              { text: bill.btype === 'SALES' ? 'TAX INVOICE' : 'PURCHASE INVOICE', style: 'invoiceTitle' },
              { text: 'Original', style: 'copyType' },
            ],
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1 }] },

      // ── Bill / Party details ──
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'Bill To:', style: 'sectionHeader' },
              { text: bill.supply || '',                        style: 'partyName' },
              { text: bill.addr || '',                          style: 'partyDetails' },
              { text: `GSTIN: ${bill.gstin || 'UNREGISTERED'}`, style: 'partyDetails' },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: `Invoice No: ${bill.bno}`,                       style: 'billDetails' },
              { text: `Date: ${formatReadableDate(bill.bdate)}`,        style: 'billDetails' },
            ],
          },
        ],
        margin: [0, 20, 0, 20],
      },

      // ── Items table ──
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'S.No',            style: 'tableHeader' },
              { text: 'Item Description', style: 'tableHeader' },
              { text: 'HSN',             style: 'tableHeader' },
              { text: 'Qty',             style: 'tableHeader' },
              { text: 'Rate',            style: 'tableHeader' },
              { text: 'GST%',            style: 'tableHeader' },
              { text: 'Amount',          style: 'tableHeader' },
            ],
            ...items.map((item, i) => [
              { text: i + 1,                                    style: 'tableCell' },
              { text: item.item,                                style: 'tableCell' },
              { text: item.hsn || '',                           style: 'tableCell' },
              { text: item.qty,     style: 'tableCell', alignment: 'right' },
              { text: item.rate.toFixed(2), style: 'tableCell', alignment: 'right' },
              { text: (item.gst_rate ?? '') + '%', style: 'tableCell', alignment: 'right' },
              { text: item.total.toFixed(2), style: 'tableCell', alignment: 'right' },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
      },

      // ── Totals ──
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            table: {
              widths: ['*', 'auto'],
              body: [
                [{ text: 'Subtotal:',  style: 'totalLabel' },    { text: bill.gtot?.toFixed(2) ?? '0.00', style: 'totalValue' }],
                ...(bill.cgst > 0 ? [[{ text: 'CGST:', style: 'totalLabel' }, { text: bill.cgst.toFixed(2), style: 'totalValue' }]] : []),
                ...(bill.sgst > 0 ? [[{ text: 'SGST:', style: 'totalLabel' }, { text: bill.sgst.toFixed(2), style: 'totalValue' }]] : []),
                ...(bill.igst > 0 ? [[{ text: 'IGST:', style: 'totalLabel' }, { text: bill.igst.toFixed(2), style: 'totalValue' }]] : []),
                ...(bill.rof  ? [[{ text: 'Round Off:', style: 'totalLabel' }, { text: bill.rof.toFixed(2), style: 'totalValue' }]] : []),
                [{ text: 'Net Total:',  style: 'totalLabelBold' }, { text: bill.ntot?.toFixed(2) ?? '0.00', style: 'totalValueBold' }],
              ],
            },
            layout: 'noBorders',
          },
        ],
        margin: [0, 20, 0, 0],
      },

      // ── Amount in words ──
      {
        text: `Amount in Words: ${numberToWords(bill.ntot ?? 0)} Only`,
        style: 'amountWords',
        margin: [0, 20, 0, 0],
      },

      // ── Signature ──
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: [
              { text: `For ${firm.name}`,       style: 'signatureLabel', margin: [0, 40, 0, 0] },
              { text: 'Authorized Signatory',   style: 'signatureLabel', margin: [0, 20, 0, 0] },
            ],
          },
        ],
        margin: [0, 40, 0, 0],
      },
    ],
    styles: {
      firmName:       { fontSize: 16, bold: true },
      firmAddress:    { fontSize: 10, margin: [0, 2, 0, 0] },
      firmDetails:    { fontSize: 9,  margin: [0, 1, 0, 0] },
      invoiceTitle:   { fontSize: 18, bold: true, alignment: 'right' },
      copyType:       { fontSize: 10, alignment: 'right', margin: [0, 2, 0, 0] },
      sectionHeader:  { fontSize: 11, bold: true, margin: [0, 0, 0, 5] },
      partyName:      { fontSize: 12, bold: true },
      partyDetails:   { fontSize: 9,  margin: [0, 2, 0, 0] },
      billDetails:    { fontSize: 10, margin: [0, 2, 0, 0] },
      tableHeader:    { fontSize: 10, bold: true, fillColor: '#eeeeee', margin: [5, 5, 5, 5] },
      tableCell:      { fontSize: 9,  margin: [5, 3, 5, 3] },
      totalLabel:     { fontSize: 10, alignment: 'right', margin: [0, 2, 10, 2] },
      totalValue:     { fontSize: 10, alignment: 'right', margin: [0, 2, 0, 2] },
      totalLabelBold: { fontSize: 11, bold: true, alignment: 'right', margin: [0, 5, 10, 2] },
      totalValueBold: { fontSize: 11, bold: true, alignment: 'right', margin: [0, 5, 0, 2] },
      amountWords:    { fontSize: 10, italics: true },
      signatureLabel: { fontSize: 10, alignment: 'right' },
    },
  };

  return _buildPDF(docDefinition);
}

/* ─────────────────────────────────────────────
   VOUCHER PDF
───────────────────────────────────────────── */

/**
 * Generate voucher PDF
 * @param {Object} voucher - Voucher Mongoose doc (or plain object)
 * @param {Object} firm    - Firm Mongoose doc (or plain object)
 * @returns {Promise<Buffer>}
 */
export function generateVoucherPDF(voucher, firm) {
  const titleMap = {
    PAYMENT: 'Payment Voucher',
    RECEIPT: 'Receipt Voucher',
    JOURNAL: 'Journal Voucher',
  };
  const voucherTitle = titleMap[voucher.voucher_type] ?? 'Voucher';

  const docDefinition = {
    pageSize:    'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      // ── Firm header ──
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: firm.name,        style: 'firmName' },
              { text: firm.address || '', style: 'firmAddress' },
            ],
          },
          { width: 'auto', text: voucherTitle, style: 'voucherTitle' },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1 }] },

      // ── Meta ──
      {
        columns: [
          { text: `Voucher No: ${voucher.voucher_no}`,                 style: 'voucherDetails' },
          { text: `Date: ${formatReadableDate(voucher.voucher_date)}`,  style: 'voucherDetails', alignment: 'right' },
        ],
        margin: [0, 20, 0, 20],
      },

      // ── Body ──
      voucher.voucher_type === 'JOURNAL'
        ? _journalContent(voucher)
        : _paymentReceiptContent(voucher),

      { text: `Narration: ${voucher.narration || ''}`, style: 'narration',    margin: [0, 20, 0, 0] },
      { text: `Amount in Words: ${numberToWords(voucher.amount ?? 0)} Only`, style: 'amountWords', margin: [0, 20, 0, 0] },

      // ── Signatures ──
      {
        columns: [
          { text: 'Prepared By',   style: 'signatureLabel' },
          { text: 'Checked By',    style: 'signatureLabel' },
          { text: 'Authorized By', style: 'signatureLabel' },
        ],
        margin: [0, 60, 0, 0],
      },
    ],
    styles: {
      firmName:       { fontSize: 16, bold: true },
      firmAddress:    { fontSize: 10, margin: [0, 2, 0, 0] },
      voucherTitle:   { fontSize: 16, bold: true, alignment: 'right' },
      voucherDetails: { fontSize: 11 },
      tableHeader:    { fontSize: 10, bold: true, fillColor: '#eeeeee', margin: [5, 5, 5, 5] },
      tableCell:      { fontSize: 10, margin: [5, 3, 5, 3] },
      narration:      { fontSize: 10, italics: true },
      amountWords:    { fontSize: 10, bold: true },
      signatureLabel: { fontSize: 10, alignment: 'center' },
    },
  };

  return _buildPDF(docDefinition);
}

/* ─────────────────────────────────────────────
   PRIVATE HELPERS
───────────────────────────────────────────── */

function _journalContent(voucher) {
  const entries = JSON.parse(voucher.journal_entries || '[]');
  return {
    table: {
      headerRows: 1,
      widths: ['*', 'auto', 'auto'],
      body: [
        [
          { text: 'Account', style: 'tableHeader' },
          { text: 'Debit',   style: 'tableHeader' },
          { text: 'Credit',  style: 'tableHeader' },
        ],
        ...entries.map(e => [
          { text: e.account_name,                                          style: 'tableCell' },
          { text: e.debit  ? e.debit.toFixed(2)  : '', style: 'tableCell', alignment: 'right' },
          { text: e.credit ? e.credit.toFixed(2) : '', style: 'tableCell', alignment: 'right' },
        ]),
      ],
    },
    layout: 'lightHorizontalLines',
  };
}

function _paymentReceiptContent(voucher) {
  const isPayment = voucher.voucher_type === 'PAYMENT';
  return {
    stack: [
      { text: isPayment ? 'Paid To:'       : 'Received From:', style: 'tableHeader', margin: [0, 0, 0, 5] },
      { text: isPayment ? voucher.paid_to_account : voucher.received_from_account, fontSize: 12, bold: true, margin: [0, 0, 0, 20] },
      { text: 'Amount:', style: 'tableHeader', margin: [0, 0, 0, 5] },
      { text: `₹ ${(voucher.amount ?? 0).toFixed(2)}`, fontSize: 16, bold: true, margin: [0, 0, 0, 20] },
      { text: isPayment ? 'Paid From:'     : 'Received In:',  style: 'tableHeader', margin: [0, 0, 0, 5] },
      { text: isPayment ? voucher.paid_from_account : voucher.received_in_account, fontSize: 11 },
    ],
  };
}

function _buildPDF(docDefinition) {
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  return new Promise((resolve, reject) => {
    pdfDoc.on('data',  chunk => chunks.push(chunk));
    pdfDoc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

/* ─────────────────────────────────────────────
   NUMBER TO WORDS (Indian numbering)
───────────────────────────────────────────── */

function numberToWords(num) {
  if (num === 0) return 'Zero';

  const ones  = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens  = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function below1000(n) {
    if (n === 0)  return '';
    if (n < 10)   return ones[n];
    if (n < 20)   return teens[n - 10];
    if (n < 100)  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below1000(n % 100) : '');
  }

  const crore    = Math.floor(num / 10_000_000);
  const lakh     = Math.floor((num % 10_000_000) / 100_000);
  const thousand = Math.floor((num % 100_000) / 1_000);
  const rem      = Math.floor(num % 1_000);
  const paise    = Math.round((num - Math.floor(num)) * 100);

  let result = '';
  if (crore)    result += below1000(crore)    + ' Crore ';
  if (lakh)     result += below1000(lakh)     + ' Lakh ';
  if (thousand) result += below1000(thousand) + ' Thousand ';
  if (rem)      result += below1000(rem);

  result = result.trim();
  if (paise) result += ' and ' + below1000(paise) + ' Paise';

  return result || 'Zero';
}
