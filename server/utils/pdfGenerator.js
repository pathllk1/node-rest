/**
 * PDF Generator Utility
 * Generates PDF documents for bills, vouchers, and reports using pdfmake
 */

import PdfPrinter from 'pdfmake';
import { formatDate, formatReadableDate } from './dateFormatter.js';

// Define fonts (using standard fonts available in pdfmake)
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);

/**
 * Generate invoice PDF
 * @param {Object} bill - Bill object with all details
 * @param {Object} firm - Firm details
 * @param {Array} items - Bill items
 * @returns {Buffer} PDF buffer
 */
function generateInvoicePDF(bill, firm, items) {
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      // Header
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: firm.name, style: 'firmName' },
              { text: firm.address || '', style: 'firmAddress' },
              { text: `GSTIN: ${firm.gstin || 'N/A'}`, style: 'firmDetails' },
              { text: `PAN: ${firm.pan || 'N/A'}`, style: 'firmDetails' }
            ]
          },
          {
            width: 'auto',
            stack: [
              { text: bill.bill_type === 'SALES' ? 'TAX INVOICE' : 'PURCHASE INVOICE', style: 'invoiceTitle' },
              { text: `Original`, style: 'copyType' }
            ]
          }
        ]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1 }] },
      
      // Bill details
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'Bill To:', style: 'sectionHeader' },
              { text: bill.party_name, style: 'partyName' },
              { text: bill.party_address || '', style: 'partyDetails' },
              { text: `GSTIN: ${bill.party_gstin || 'UNREGISTERED'}`, style: 'partyDetails' }
            ]
          },
          {
            width: '50%',
            stack: [
              { text: `Invoice No: ${bill.bill_no}`, style: 'billDetails' },
              { text: `Date: ${formatReadableDate(bill.bill_date)}`, style: 'billDetails' },
              { text: `Due Date: ${formatReadableDate(bill.due_date)}`, style: 'billDetails' }
            ]
          }
        ],
        margin: [0, 20, 0, 20]
      },
      
      // Items table
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'S.No', style: 'tableHeader' },
              { text: 'Item Description', style: 'tableHeader' },
              { text: 'HSN', style: 'tableHeader' },
              { text: 'Qty', style: 'tableHeader' },
              { text: 'Rate', style: 'tableHeader' },
              { text: 'GST%', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader' }
            ],
            ...items.map((item, index) => [
              { text: index + 1, style: 'tableCell' },
              { text: item.item_name, style: 'tableCell' },
              { text: item.hsn_code || '', style: 'tableCell' },
              { text: item.qty, style: 'tableCell', alignment: 'right' },
              { text: item.rate.toFixed(2), style: 'tableCell', alignment: 'right' },
              { text: item.gst_rate + '%', style: 'tableCell', alignment: 'right' },
              { text: item.total.toFixed(2), style: 'tableCell', alignment: 'right' }
            ])
          ]
        },
        layout: 'lightHorizontalLines'
      },
      
      // Totals
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            table: {
              widths: ['*', 'auto'],
              body: [
                [{ text: 'Subtotal:', style: 'totalLabel' }, { text: bill.gross_total.toFixed(2), style: 'totalValue' }],
                bill.cgst > 0 ? [{ text: 'CGST:', style: 'totalLabel' }, { text: bill.cgst.toFixed(2), style: 'totalValue' }] : null,
                bill.sgst > 0 ? [{ text: 'SGST:', style: 'totalLabel' }, { text: bill.sgst.toFixed(2), style: 'totalValue' }] : null,
                bill.igst > 0 ? [{ text: 'IGST:', style: 'totalLabel' }, { text: bill.igst.toFixed(2), style: 'totalValue' }] : null,
                bill.discount > 0 ? [{ text: 'Discount:', style: 'totalLabel' }, { text: `(${bill.discount.toFixed(2)})`, style: 'totalValue' }] : null,
                [{ text: 'Round Off:', style: 'totalLabel' }, { text: bill.round_off.toFixed(2), style: 'totalValue' }],
                [{ text: 'Net Total:', style: 'totalLabelBold' }, { text: bill.net_total.toFixed(2), style: 'totalValueBold' }]
              ].filter(Boolean)
            },
            layout: 'noBorders'
          }
        ],
        margin: [0, 20, 0, 0]
      },
      
      // Amount in words
      {
        text: `Amount in Words: ${numberToWords(bill.net_total)} Only`,
        style: 'amountWords',
        margin: [0, 20, 0, 0]
      },
      
      // Footer
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: [
              { text: 'For ' + firm.name, style: 'signatureLabel', margin: [0, 40, 0, 0] },
              { text: 'Authorized Signatory', style: 'signatureLabel', margin: [0, 20, 0, 0] }
            ]
          }
        ],
        margin: [0, 40, 0, 0]
      }
    ],
    styles: {
      firmName: { fontSize: 16, bold: true },
      firmAddress: { fontSize: 10, margin: [0, 2, 0, 0] },
      firmDetails: { fontSize: 9, margin: [0, 1, 0, 0] },
      invoiceTitle: { fontSize: 18, bold: true, alignment: 'right' },
      copyType: { fontSize: 10, alignment: 'right', margin: [0, 2, 0, 0] },
      sectionHeader: { fontSize: 11, bold: true, margin: [0, 0, 0, 5] },
      partyName: { fontSize: 12, bold: true },
      partyDetails: { fontSize: 9, margin: [0, 2, 0, 0] },
      billDetails: { fontSize: 10, margin: [0, 2, 0, 0] },
      tableHeader: { fontSize: 10, bold: true, fillColor: '#eeeeee', margin: [5, 5, 5, 5] },
      tableCell: { fontSize: 9, margin: [5, 3, 5, 3] },
      totalLabel: { fontSize: 10, alignment: 'right', margin: [0, 2, 10, 2] },
      totalValue: { fontSize: 10, alignment: 'right', margin: [0, 2, 0, 2] },
      totalLabelBold: { fontSize: 11, bold: true, alignment: 'right', margin: [0, 5, 10, 2] },
      totalValueBold: { fontSize: 11, bold: true, alignment: 'right', margin: [0, 5, 0, 2] },
      amountWords: { fontSize: 10, italics: true },
      signatureLabel: { fontSize: 10, alignment: 'right' }
    }
  };
  
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

/**
 * Generate voucher PDF
 * @param {Object} voucher - Voucher object
 * @param {Object} firm - Firm details
 * @returns {Buffer} PDF buffer
 */
function generateVoucherPDF(voucher, firm) {
  const voucherTitle = voucher.voucher_type === 'PAYMENT' ? 'Payment Voucher' :
                       voucher.voucher_type === 'RECEIPT' ? 'Receipt Voucher' : 'Journal Voucher';
  
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      // Header
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: firm.name, style: 'firmName' },
              { text: firm.address || '', style: 'firmAddress' }
            ]
          },
          {
            width: 'auto',
            text: voucherTitle,
            style: 'voucherTitle'
          }
        ]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1 }] },
      
      // Voucher details
      {
        columns: [
          { text: `Voucher No: ${voucher.voucher_no}`, style: 'voucherDetails' },
          { text: `Date: ${formatReadableDate(voucher.voucher_date)}`, style: 'voucherDetails', alignment: 'right' }
        ],
        margin: [0, 20, 0, 20]
      },
      
      // Voucher content based on type
      voucher.voucher_type === 'JOURNAL' ? 
        generateJournalContent(voucher) : 
        generatePaymentReceiptContent(voucher),
      
      // Narration
      {
        text: `Narration: ${voucher.narration || ''}`,
        style: 'narration',
        margin: [0, 20, 0, 0]
      },
      
      // Amount in words
      {
        text: `Amount in Words: ${numberToWords(voucher.amount)} Only`,
        style: 'amountWords',
        margin: [0, 20, 0, 0]
      },
      
      // Signatures
      {
        columns: [
          { text: 'Prepared By', style: 'signatureLabel' },
          { text: 'Checked By', style: 'signatureLabel' },
          { text: 'Authorized By', style: 'signatureLabel' }
        ],
        margin: [0, 60, 0, 0]
      }
    ],
    styles: {
      firmName: { fontSize: 16, bold: true },
      firmAddress: { fontSize: 10, margin: [0, 2, 0, 0] },
      voucherTitle: { fontSize: 16, bold: true, alignment: 'right' },
      voucherDetails: { fontSize: 11 },
      tableHeader: { fontSize: 10, bold: true, fillColor: '#eeeeee', margin: [5, 5, 5, 5] },
      tableCell: { fontSize: 10, margin: [5, 3, 5, 3] },
      narration: { fontSize: 10, italics: true },
      amountWords: { fontSize: 10, bold: true },
      signatureLabel: { fontSize: 10, alignment: 'center' }
    }
  };
  
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

/**
 * Generate journal voucher content
 */
function generateJournalContent(voucher) {
  const entries = JSON.parse(voucher.journal_entries || '[]');
  
  return {
    table: {
      headerRows: 1,
      widths: ['*', 'auto', 'auto'],
      body: [
        [
          { text: 'Account', style: 'tableHeader' },
          { text: 'Debit', style: 'tableHeader' },
          { text: 'Credit', style: 'tableHeader' }
        ],
        ...entries.map(entry => [
          { text: entry.account_name, style: 'tableCell' },
          { text: entry.debit ? entry.debit.toFixed(2) : '', style: 'tableCell', alignment: 'right' },
          { text: entry.credit ? entry.credit.toFixed(2) : '', style: 'tableCell', alignment: 'right' }
        ])
      ]
    },
    layout: 'lightHorizontalLines'
  };
}

/**
 * Generate payment/receipt voucher content
 */
function generatePaymentReceiptContent(voucher) {
  const isPayment = voucher.voucher_type === 'PAYMENT';
  
  return {
    stack: [
      {
        text: isPayment ? 'Paid To:' : 'Received From:',
        style: 'tableHeader',
        margin: [0, 0, 0, 5]
      },
      {
        text: isPayment ? voucher.paid_to_account : voucher.received_from_account,
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 20]
      },
      {
        text: 'Amount:',
        style: 'tableHeader',
        margin: [0, 0, 0, 5]
      },
      {
        text: `₹ ${voucher.amount.toFixed(2)}`,
        fontSize: 16,
        bold: true,
        margin: [0, 0, 0, 20]
      },
      {
        text: isPayment ? 'Paid From:' : 'Received In:',
        style: 'tableHeader',
        margin: [0, 0, 0, 5]
      },
      {
        text: isPayment ? voucher.paid_from_account : voucher.received_in_account,
        fontSize: 11,
        margin: [0, 0, 0, 0]
      }
    ]
  };
}

/**
 * Convert number to words (Indian numbering system)
 */
function numberToWords(num) {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  function convertLessThanThousand(n) {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertLessThanThousand(n % 100) : '');
  }
  
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = Math.floor(num % 1000);
  const paise = Math.round((num - Math.floor(num)) * 100);
  
  let result = '';
  
  if (crore) result += convertLessThanThousand(crore) + ' Crore ';
  if (lakh) result += convertLessThanThousand(lakh) + ' Lakh ';
  if (thousand) result += convertLessThanThousand(thousand) + ' Thousand ';
  if (remainder) result += convertLessThanThousand(remainder);
  
  result = result.trim();
  
  if (paise) {
    result += ' and ' + convertLessThanThousand(paise) + ' Paise';
  }
  
  return result || 'Zero';
}

export {
  generateInvoicePDF,
  generateVoucherPDF
};
