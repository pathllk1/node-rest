import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Bill, StockReg, Firm, BankAccount, FirmSettings, Settings } from '../../../models/index.js';
import PrinterModule from 'pdfmake/js/Printer.js';

const PdfPrinter = PrinterModule.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to resolve font paths properly on different platforms
const getFontPath = (fileName) => {
    // Use absolute path from project root to client/public/fonts
    return path.join(process.cwd(), 'client', 'public', 'fonts', fileName);
};

// Verify font files exist before initializing printer
const fontFiles = [
    'DejaVuSans.ttf',
    'DejaVuSans-Bold.ttf',
    'DejaVuSans-Oblique.ttf',
    'DejaVuSans-BoldOblique.ttf'
];

// Check if font files exist
fontFiles.forEach(fontFile => {
    const fontPath = getFontPath(fontFile);
    if (!fs.existsSync(fontPath)) {
        console.warn(`Warning: Font file does not exist: ${fontPath}`);
    }
});

// Font definitions
const fonts = {
    DejaVuSans: {
        normal: getFontPath('DejaVuSans.ttf'),
        bold: getFontPath('DejaVuSans-Bold.ttf'),
        italics: getFontPath('DejaVuSans-Oblique.ttf'),
        bolditalics: getFontPath('DejaVuSans-BoldOblique.ttf')
    }
};

const printer = new PdfPrinter(fonts);

// Helper functions
const formatCurrency = (amount) => {
    return '₹ ' + new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        return dateString;
    }
};


export const exportBillsToPdf = async (req, res) => {
    try {
        const firmId = req.user?.firm_id;
        if (!firmId) {
            return res.status(401).json({ error: 'Unauthorized - No firm associated' });
        }

        const { searchTerm, type, dateFrom, dateTo } = req.query;

        let query = { firm_id: firmId };

        if (type) {
            query.btype = type;
        }

        if (searchTerm) {
            const searchRegex = new RegExp(searchTerm, 'i');
            query.$or = [
                { bno: searchRegex },
                { supply: searchRegex }
            ];
        }

        if (dateFrom || dateTo) {
            query.bdate = {};
            if (dateFrom) {
                query.bdate.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                query.bdate.$lte = to;
            }
        }

        const bills = await Bill.find(query).sort({ bdate: -1, bno: -1 }).lean();

        if (!bills.length) {
            return res.status(404).json({ error: 'No bills found for the selected criteria' });
        }

        const firm = await Firm.findById(firmId).select('name address gst_number').lean();

        const C = {
            primary: '#1B3A6B',
            border: '#A0B4CC',
            borderDark: '#1B3A6B',
            textDark: '#1A1A2E',
            textMid: '#3D4D6A',
            textLight: '#6B7A99',
        };

        const docDefinition = {
            content: [
                { text: 'Bills Report', style: 'header' },
                { text: `Firm: ${firm.name}`, style: 'subheader' },
                { text: `Date Range: ${dateFrom ? formatDate(dateFrom) : 'N/A'} to ${dateTo ? formatDate(dateTo) : 'N/A'}`, style: 'subheader' },
                { text: `Generated on: ${formatDate(new Date())}`, style: 'subheader', margin: [0, 0, 0, 10] },

                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', 'auto', '*', 'auto', 'auto', 80],
                        body: [
                            ['Bill No', 'Date', 'Party', 'Type', 'Status', { text: 'Amount', alignment: 'right' }],
                            ...bills.map(bill => {
                                const isCancelled = (bill.status || 'ACTIVE') === 'CANCELLED';
                                return [
                                    bill.bno,
                                    formatDate(bill.bdate),
                                    bill.supply,
                                    bill.btype,
                                    bill.status,
                                    { text: isCancelled ? formatCurrency(0) : formatCurrency(bill.ntot), alignment: 'right' }
                                ];
                            })
                        ]
                    },
                    layout: {
						hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5,
						vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 0.5,
						hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? C.borderDark : C.border,
						vLineColor: () => C.border,
						paddingLeft: () => 5,
						paddingRight: () => 5,
						paddingTop: () => 2,
						paddingBottom: () => 2
					}
                }
            ],
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    margin: [0, 0, 0, 10]
                },
                subheader: {
                    fontSize: 10,
                    margin: [0, 0, 0, 2]
                },
            },
            defaultStyle: {
                font: 'DejaVuSans'
            }
        };

        const pdfDoc = await printer.createPdfKitDocument(docDefinition);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="bills_report.pdf"');
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (err) {
        console.error('PDF export error:', err);
        res.status(500).json({ error: 'Failed to export bills to PDF' });
    }
};
