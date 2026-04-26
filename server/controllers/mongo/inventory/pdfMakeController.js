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
    // \u00A0 = NON-BREAKING SPACE: prevents line-break between ₹ and digits
    return '\u20B9\u00A0' + new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
};

const formatQuantity = (qty) => {
    return parseFloat(qty || 0).toFixed(2);
};

const isServiceItem = (item) => (item?.item_type || 'GOODS') === 'SERVICE';
const getEffectiveQty = (item) => {
    const qty = parseFloat(item?.qty);
    if (Number.isFinite(qty) && qty > 0) return qty;
    return isServiceItem(item) ? 1 : 0;
};
const shouldShowQty = (item) => !isServiceItem(item) || item?.show_qty !== false;

const formatPercentage = (percent) => {
    return parseFloat(percent || 0).toFixed(2) + '%';
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const dateStr = String(dateString).includes('T') ? dateString : dateString + 'T00:00:00';
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        return dateString;
    }
};

const numberToWords = (num) => {
    if (!num || isNaN(num)) return "Rupees Zero Only";

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertHundreds = (n) => {
        let str = '';
        const numVal = Math.floor(n);
        if (numVal > 99) {
            str += ones[Math.floor(numVal / 100)] + ' Hundred ';
            return str + convertTens(numVal % 100);
        }
        return convertTens(numVal);
    };

    const convertTens = (n) => {
        let str = '';
        const numVal = Math.floor(n);
        if (numVal < 20) {
            return ones[numVal] || teens[numVal - 10] || '';
        }
        str += tens[Math.floor(numVal / 10)];
        if (numVal % 10 > 0) {
            str += ' ' + ones[numVal % 10];
        }
        return str;
    };

    const absNum = Math.abs(Number(num));
    const wholePart = Math.floor(absNum);
    const decimalPart = Math.round((absNum - wholePart) * 100);

    if (wholePart === 0 && decimalPart === 0) return "Rupees Zero Only";

    let result = "Rupees ";
    let tempWhole = wholePart;

    if (tempWhole >= 10000000) {
        const crores = Math.floor(tempWhole / 10000000);
        result += convertHundreds(crores) + ' Crore ';
        tempWhole %= 10000000;
    }

    if (tempWhole >= 100000) {
        const lakhs = Math.floor(tempWhole / 100000);
        result += convertHundreds(lakhs) + ' Lakh ';
        tempWhole %= 100000;
    }

    if (tempWhole >= 1000) {
        const thousands = Math.floor(tempWhole / 1000);
        result += convertHundreds(thousands) + ' Thousand ';
        tempWhole %= 1000;
    }

    if (tempWhole > 0) {
        result += convertHundreds(tempWhole);
    }

    if (decimalPart > 0) {
        result += " and " + convertTens(decimalPart) + " Paise ";
    }

    return result.trim() + " Only";
};

const getInvoiceTypeLabel = (bill) => {
    // btype is the canonical field in the Bill model (not 'type')
    const raw = bill.btype || bill.type || 'SALES';
    switch (raw.toUpperCase()) {
        case 'SALES':         return 'SALES INVOICE';
        case 'PURCHASE':      return 'PURCHASE INVOICE';
        case 'CREDIT NOTE':   return 'CREDIT NOTE';
        case 'DEBIT NOTE':    return 'DEBIT NOTE';
        case 'DELIVERY NOTE': return 'DELIVERY NOTE';
        default:              return raw.toUpperCase();
    }
};

const getPartyLabels = (bill) => {
    // btype is the canonical field in the Bill model (not 'type')
    const type = (bill.btype || bill.type || 'SALES').toUpperCase();
    switch (type) {
        case 'SALES':         return { billTo: 'Bill To (Buyer)',            shipTo: 'Ship To (Consignee)' };
        case 'PURCHASE':      return { billTo: 'Bill From (Supplier)',       shipTo: 'Bill To (Receiver)' };
        case 'CREDIT NOTE':   return { billTo: 'Bill To (Recipient)',        shipTo: 'Ship To (Consignee)' };
        case 'DEBIT NOTE':    return { billTo: 'Bill From (Supplier)',       shipTo: 'Bill To (Recipient)' };
        case 'DELIVERY NOTE': return { billTo: 'Deliver From (Supplier)',    shipTo: 'Deliver To (Recipient)' };
        default:              return { billTo: 'Bill To (Buyer)',            shipTo: 'Ship To (Consignee)' };
    }
};

const getBillType = (bill) => {
    // bill_subtype stores 'INTRA-STATE' or 'INTER-STATE' for purchase bills
    // (purchase bills set btype='PURCHASE', so we cannot rely on btype here)
    // For sales bills, btype itself may contain 'INTRA-STATE'/'INTER-STATE'.
    // Fall back to reading cgst/sgst stored amounts as a reliable last resort.
    const src = (bill.bill_subtype || bill.btype || '').toLowerCase();
    if (src.includes('intra')) return 'intra-state';
    if (src.includes('inter')) return 'inter-state';
    // Authoritative fallback: if we actually stored CGST/SGST the bill is intra-state
    return (Number(bill.cgst) > 0 || Number(bill.sgst) > 0) ? 'intra-state' : 'inter-state';
};

const buildHsnSummary = (bill, items, otherCharges, gstEnabled) => {
    const hsnMap = new Map();
    const billType = getBillType(bill);

    items.forEach(item => {
        const hsn = item.hsn || 'NA';
        const taxableValue = getEffectiveQty(item) * (item.rate || 0) * (1 - (item.disc || 0) / 100);
        const taxAmount = taxableValue * (item.grate || 0) / 100;

        if (!hsnMap.has(hsn)) {
            hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
        }

        const row = hsnMap.get(hsn);
        row.taxableValue += taxableValue;
        if (gstEnabled) {
            row.totalTax += taxAmount;
            if (billType === 'intra-state') {
                row.cgst += taxAmount / 2;
                row.sgst += taxAmount / 2;
            } else {
                row.igst += taxAmount;
            }
        }
    });

    otherCharges.forEach(charge => {
        const hsn = charge.hsnSac || '9999';
        const taxableValue = charge.amount || 0;
        const taxAmount = charge.gstAmount || 0;

        if (!hsnMap.has(hsn)) {
            hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
        }

        const row = hsnMap.get(hsn);
        row.taxableValue += taxableValue;
        if (gstEnabled) {
            row.totalTax += taxAmount;
            if (billType === 'intra-state') {
                row.cgst += taxAmount / 2;
                row.sgst += taxAmount / 2;
            } else {
                row.igst += taxAmount;
            }
        }
    });

    return Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
};

// GST setting helper for MongoDB
const isGstEnabled = async (firmId) => {
    try {
        const firmSetting = await FirmSettings.findOne({ firm_id: firmId, setting_key: 'gst_enabled' }).lean();
        if (firmSetting) return firmSetting.setting_value === 'true';
        const globalSetting = await Settings.findOne({ setting_key: 'gst_enabled' }).lean();
        return globalSetting ? globalSetting.setting_value === 'true' : true;
    } catch {
        return true; // default to enabled on error
    }
};

const resolveDefaultBankDetails = async (firmId, firm) => {
    const defaultBank = await BankAccount.findOne({
        firm_id: firmId,
        is_default: true,
        status: 'ACTIVE',
    }).select('account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id').lean();

    if (defaultBank) return defaultBank;

    if (firm?.bank_account_number || firm?.bank_name || firm?.ifsc_code || firm?.bank_branch) {
        return {
            account_name: firm.bank_name || 'Default Bank Account',
            account_holder_name: firm.name || '',
            bank_name: firm.bank_name || '',
            branch_name: firm.bank_branch || '',
            account_number: firm.bank_account_number || '',
            ifsc_code: firm.ifsc_code || '',
            upi_id: null,
        };
    }

    return null;
};

export const generateInvoicePDF = async (req, res) => {
    try {
        const billId = req.params.id;
        if (!billId) return res.status(400).json({ error: 'Bill ID is required' });

        const firmId = req.user?.firm_id;
        if (!firmId) return res.status(401).json({ error: 'Unauthorized - No firm associated' });

        const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        // Fetch original bill metadata if this is a return (Credit/Debit Note)
        let refBill = null;
        if (bill.ref_bill_id) {
            refBill = await Bill.findOne({ _id: bill.ref_bill_id }).select('bno bdate').lean();
        }

        const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();

        let otherCharges = [];
        if (bill.other_charges) {
            try { otherCharges = Array.isArray(bill.other_charges) ? bill.other_charges : []; } catch (e) { otherCharges = []; }
        }

        // Check GST setting from MongoDB
        const gstEnabled = await isGstEnabled(firmId);

        // Seller info - fetch from MongoDB
        // 'firm' must be declared outside the try block so it's in scope below
        let firm = null;
        let firmAddress = '';
        let firmGstin = '';

        try {
            firm = await Firm.findById(firmId).select('name address gst_number bank_account_number bank_name bank_branch ifsc_code locations').lean();
            if (!firm) return res.status(404).json({ error: 'Firm not found' });
            firmAddress = firm.address || '';
            
            // FIX: Use the GST number that was used at the time of billing (bill.firm_gstin)
            // If not available (legacy bills), fall back to the default GST from firm
            if (bill.firm_gstin) {
                firmGstin = bill.firm_gstin;
            } else {
                // Legacy fallback: use default GST from firm
                firmGstin = firm.gst_number || '';
            }
        } catch (err) {
            console.error('Error fetching firm:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }

        const seller = { name: bill.firm || firm?.name || 'Company Name', address: firmAddress, gstin: firmGstin || '' };
        const bankDetails = await resolveDefaultBankDetails(firmId, firm);

        const billType    = getBillType(bill);
        const partyLabels = getPartyLabels(bill);
        const hsnSummary  = buildHsnSummary(bill, items, otherCharges, gstEnabled);

        // ── Purchase-vs-Sales derived values ──────────────────────────────────
        // isPurchase drives every label, party-box, and terms that differs by type.
        const isPurchase = (bill.btype || bill.type || '').toUpperCase() === 'PURCHASE';

        const formattedBuyerAddress =
            bill.addr && bill.pin  ? `${bill.addr}, PIN: ${bill.pin}` :
            bill.addr              ? bill.addr :
            bill.pin               ? `PIN: ${bill.pin}` : '';

        // For sales: right box = consignee (ship-to).
        // For purchase: right box = our own firm (receiver / buyer).
        const rightBoxName  = isPurchase
            ? (bill.firm || seller.name || '')
            : (bill.consignee_name || '');
        const rightBoxAddr  = isPurchase
            ? seller.address
            : (bill.consignee_address && (bill.consignee_pin || bill.pin)
                ? `${bill.consignee_address}, PIN: ${bill.consignee_pin || bill.pin}`
                : (bill.consignee_address || (bill.consignee_pin ? `PIN: ${bill.consignee_pin}` : '')
                    || (bill.addr && bill.pin ? `${bill.addr}, PIN: ${bill.pin}` : (bill.addr || ''))));
        const rightBoxState = isPurchase ? '' : (bill.consignee_state || bill.state || '');
        const rightBoxGstin = isPurchase ? seller.gstin : (bill.consignee_gstin || bill.gstin || '');

        const taxableValue = bill.gtot || 0;
        const totalTax = gstEnabled ? ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)) : 0;
        // bill.ntot is already the rounded grand total (rounded in calcBillTotals before saving).
        // bill.rof is the stored round-off amount (string from .toFixed(2)) — read it directly.
        // Recalculating Math.round(bill.ntot) - bill.ntot always gives 0 because ntot is already an integer.
        const roundedGrandTotal = gstEnabled ? (bill.ntot || 0) : Math.round(taxableValue);
        const roundOff = parseFloat(bill.rof || 0);

        // ── Design Tokens ─────────────────────────────────────────────────────
        // Ink-efficient: no filled backgrounds. Borders + bold typography only.
        // Looks structured on screen AND prints cleanly in black & white.
        const C = {
            primary:    '#1B3A6B',   // navy — text accents & borders only, no area fills
            border:     '#A0B4CC',   // medium grey border — visible in B&W print
            borderDark: '#1B3A6B',   // navy border for outer frames & thick rules
            textDark:   '#1A1A2E',   // near-black body text
            textMid:    '#3D4D6A',   // mid-grey secondary text
            textLight:  '#6B7A99',   // light grey hints / labels
            red:        '#991B1B',   // error / reverse-charge notice
        };

        // Build Doc Definition
        const docDefinition = {
            defaultStyle: {
                font: 'DejaVuSans',
                fontSize: 8.5,
                color: C.textDark,
                lineHeight: 1.1
            },
            content: [
                // ── Header: company info (left) + invoice meta (right) ────────────
                {
                    table: {
                        widths: ['*', 185],
                        body: [[
                            // LEFT: invoice type + company details — white, no fill
                            {
                                stack: [
                                    { text: getInvoiceTypeLabel(bill), style: 'invoiceTypeLabel' },
                                    { text: gstEnabled ? 'TAX INVOICE UNDER GST' : 'INVOICE (GST DISABLED)', style: 'invoiceSubTag' },
                                    {
                                        // thin navy rule separating title from company block
                                        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 330, y2: 0, lineWidth: 1, lineColor: C.borderDark }],
                                        margin: [0, 6, 0, 6]
                                    },
                                    { text: seller.name, style: 'companyName' },
                                    { text: seller.address, style: 'companyMeta' },
                                    { text: seller.gstin ? `GSTIN: ${seller.gstin}` : '', style: 'companyMeta' }
                                ],
                                margin: [0, 0, 8, 0]
                            },
                            // RIGHT: invoice details — white, thin outer border box
                            {
                                stack: [
                                    {
                                        table: {
                                            widths: ['auto', '*'],
                                            body: [
                                                [
                                                    { text: isPurchase ? 'Purchase No' : 'Invoice No', style: 'metaLabel' },
                                                    { text: bill.bno || '', style: 'metaValue' }
                                                ],
                                                ...(refBill ? [
                                                    [
                                                        { text: 'Orig Bill No', style: 'metaLabel' },
                                                        { text: refBill.bno || '', style: 'metaValue' }
                                                    ],
                                                    [
                                                        { text: 'Orig Date', style: 'metaLabel' },
                                                        { text: formatDate(refBill.bdate) || '', style: 'metaValue' }
                                                    ]
                                                ] : []),
                                                ...(isPurchase && bill.supplier_bill_no ? [[
                                                    { text: 'Supplier Bill No', style: 'metaLabel' },
                                                    { text: bill.supplier_bill_no, style: 'metaValue' }
                                                ]] : []),
                                                [
                                                    { text: 'Date', style: 'metaLabel' },
                                                    { text: formatDate(bill.bdate) || '', style: 'metaValue' }
                                                ],
                                                ...(bill.order_no ? [[
                                                    { text: isPurchase ? 'Reference / PO No' : 'PO No', style: 'metaLabel' },
                                                    { text: bill.order_no, style: 'metaValue' }
                                                ]] : []),
                                                ...(bill.vehicle_no ? [[
                                                    { text: 'Vehicle No', style: 'metaLabel' },
                                                    { text: bill.vehicle_no, style: 'metaValue' }
                                                ]] : []),
                                                ...(bill.dispatch_through ? [[
                                                    { text: 'Dispatch Via', style: 'metaLabel' },
                                                    { text: bill.dispatch_through, style: 'metaValue' }
                                                ]] : [])
                                            ]
                                        },
                                        layout: {
                                            // inner meta table: thin borders all around each row
                                            hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
                                            vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
                                            hLineColor: () => C.border,
                                            vLineColor: () => C.border,
                                            paddingLeft: () => 5,
                                            paddingRight: () => 5,
                                            paddingTop: () => 3,
                                            paddingBottom: () => 3
                                        }
                                    }
                                ],
                                margin: [0, 0, 0, 0]
                            }
                        ]]
                    },
                    layout: {
                        // outer header table: no side borders, thick navy bottom rule
                        hLineWidth: (i, node) => i === node.table.body.length ? 2 : 0,
                        vLineWidth: () => 0,
                        hLineColor: () => C.borderDark,
                        paddingLeft: () => 0,
                        paddingRight: () => 0,
                        paddingTop: () => 0,
                        paddingBottom: () => 10
                    },
                    margin: [0, 0, 0, 0]
                },

                // ── Party Details ─────────────────────────────────────────────
                {
                    table: {
                        widths: ['*', '*'],
                        body: [[
                            // Bill To / Bill From — no fill, bordered box
                            {
                                stack: [
                                    { text: partyLabels.billTo.toUpperCase(), style: 'partyBoxTitle' },
                                    { text: bill.supply || '', style: 'partyName', margin: [0, 3, 0, 1] },
                                    { text: formattedBuyerAddress, style: 'partyMeta' },
                                    { text: bill.state ? `State: ${bill.state}` : '', style: 'partyMeta' },
                                    { text: bill.gstin ? `GSTIN: ${bill.gstin}` : '', style: 'partyGstin' },
                                ],
                                margin: [8, 7, 8, 7]
                            },
                            // Ship To / Bill To (Receiver) — no fill, bordered box
                            // For purchase: shows our own firm (we are the receiver).
                            // For sales: shows consignee details.
                            {
                                stack: [
                                    { text: partyLabels.shipTo.toUpperCase(), style: 'partyBoxTitle' },
                                    { text: rightBoxName,  style: 'partyName', margin: [0, 3, 0, 1] },
                                    { text: rightBoxAddr,  style: 'partyMeta' },
                                    { text: rightBoxState ? `State: ${rightBoxState}` : '', style: 'partyMeta' },
                                    { text: rightBoxGstin ? `GSTIN: ${rightBoxGstin}` : '', style: 'partyGstin' },
                                ],
                                margin: [8, 7, 8, 7]
                            }
                        ]]
                    },
                    layout: {
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
                        hLineColor: () => C.borderDark,
                        vLineColor: (i) => i === 1 ? C.border : C.borderDark,
                        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0
                    },
                    margin: [0, 8, 0, 8]
                },

                // ── Items Table ───────────────────────────────────────────────
                {
                    table: {
                        headerRows: 1,
                        widths: [15, '*', 52, 33, 26, 65, 38, 40, 80],
                        body: [
                            // Header row
                            [
                                { text: '#', style: 'tblHdr', alignment: 'center' },
                                { text: 'Description of Goods / Services', style: 'tblHdr' },
                                { text: 'HSN/SAC', style: 'tblHdr', alignment: 'center' },
                                { text: 'Qty', style: 'tblHdr', alignment: 'center' },
                                { text: 'UOM', style: 'tblHdr', alignment: 'center' },
                                { text: 'Rate (₹)', style: 'tblHdr', alignment: 'right' },
                                { text: 'Disc%', style: 'tblHdr', alignment: 'right' },
                                { text: 'GST%', style: 'tblHdr', alignment: 'right' },
                                { text: 'Amount (₹)', style: 'tblHdr', alignment: 'right' }
                            ],
                            // Item rows — no fills, clean white rows
                            ...items.map((it, idx) => [
                                { text: idx + 1, alignment: 'center', style: 'tblCell' },
                                {
                                    stack: [
                                        { text: it.item || '', bold: true, fontSize: 8.5 },
                                        ...(!isServiceItem(it) && it.batch ? [{ text: `Batch: ${it.batch}`, fontSize: 7.5, color: C.textLight }] : []),
                                        ...(it.item_narration ? [{ text: it.item_narration, fontSize: 7.5, color: C.textLight }] : [])
                                    ],
                                    style: 'tblCell'
                                },
                                { text: it.hsn || '', alignment: 'center', style: 'tblCell' },
                                { text: shouldShowQty(it) ? formatQuantity(it.qty) : '', alignment: 'center', style: 'tblCell' },
                                { text: shouldShowQty(it) ? (it.uom || '') : '', alignment: 'center', style: 'tblCell' },
                                { text: formatCurrency(it.rate), alignment: 'right', noWrap: true, style: 'tblCell' },
                                { text: formatPercentage(it.disc), alignment: 'right', style: 'tblCell' },
                                { text: gstEnabled ? formatPercentage(it.grate) : '-', alignment: 'right', style: 'tblCell' },
                                { text: formatCurrency(it.total), alignment: 'right', bold: true, noWrap: true, style: 'tblCell' }
                            ]),
                            // Other charges rows — no fills
                            ...otherCharges.map((ch, idx) => [
                                { text: items.length + idx + 1, alignment: 'center', style: 'tblCell' },
                                {
                                    stack: [
                                        { text: ch.name || ch.type || 'Other Charge', bold: true, fontSize: 8.5 },
                                        { text: `HSN/SAC: ${ch.hsnSac || ''}`, fontSize: 7.5, color: C.textLight }
                                    ],
                                    style: 'tblCell'
                                },
                                { text: ch.hsnSac || '', alignment: 'center', style: 'tblCell' },
                                { text: '1', alignment: 'center', style: 'tblCell' },
                                { text: 'NOS', alignment: 'center', style: 'tblCell' },
                                { text: formatCurrency(ch.amount), alignment: 'right', noWrap: true, style: 'tblCell' },
                                { text: '0.00%', alignment: 'right', style: 'tblCell' },
                                { text: gstEnabled ? formatPercentage(ch.gstRate) : '-', alignment: 'right', style: 'tblCell' },
                                { text: formatCurrency(ch.amount), alignment: 'right', bold: true, noWrap: true, style: 'tblCell' }
                            ])
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
                },

                // ── HSN / SAC Summary ─────────────────────────────────────────
                ...(hsnSummary.length > 0 && gstEnabled ? [
                    {
                        stack: [
                            {
                                table: {
                                    headerRows: 1,
                                    widths: [60, '*', 78, 78, 78, 90],
                                    body: [
                                        [
                                            { text: 'HSN/SAC', style: 'hsnHdr', alignment: 'center' },
                                            { text: 'Taxable Value', style: 'hsnHdr', alignment: 'right' },
                                            { text: 'CGST (₹)', style: 'hsnHdr', alignment: 'right' },
                                            { text: 'SGST (₹)', style: 'hsnHdr', alignment: 'right' },
                                            { text: 'IGST (₹)', style: 'hsnHdr', alignment: 'right' },
                                            { text: 'Total Tax (₹)', style: 'hsnHdr', alignment: 'right' }
                                        ],
                                        ...hsnSummary.map((row, idx) => [
                                            { text: row.hsn, alignment: 'center', style: 'hsnCell' },
                                            { text: formatCurrency(row.taxableValue), alignment: 'right', noWrap: true, style: 'hsnCell' },
                                            { text: billType === 'intra-state' ? formatCurrency(row.cgst) : '—', alignment: 'right', noWrap: true, style: 'hsnCell' },
                                            { text: billType === 'intra-state' ? formatCurrency(row.sgst) : '—', alignment: 'right', noWrap: true, style: 'hsnCell' },
                                            { text: billType === 'inter-state' ? formatCurrency(row.igst) : '—', alignment: 'right', noWrap: true, style: 'hsnCell' },
                                            { text: formatCurrency(row.totalTax), alignment: 'right', noWrap: true, style: 'hsnCell', bold: true }
                                        ])
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
                        margin: [0, 8, 0, 0]
                    }
                ] : []),

                // ── Footer: Amount Words + Totals ─────────────────────────────
                {
                    table: {
                        widths: ['*', 200],
                        body: [[
                            // LEFT: amount in words + narration
                            {
                                stack: [
                                    { text: 'AMOUNT IN WORDS', style: 'footerSectionTitle' },
                                    { text: numberToWords(roundedGrandTotal), bold: true, fontSize: 9, margin: [0, 3, 0, 0] },
                                    ...(bill.narration ? [
                                        { text: 'NARRATION', style: 'footerSectionTitle', margin: [0, 8, 0, 2] },
                                        { text: bill.narration, fontSize: 8.5, color: C.textMid }
                                    ] : []),
                                    ...(bankDetails ? [
                                        { text: 'BANK DETAILS', style: 'footerSectionTitle', margin: [0, 8, 0, 2] },
                                        { text: `A/C: ${bankDetails.account_number || '-'}`, fontSize: 7.5, color: C.textLight },
                                        { text: `Bank: ${bankDetails.bank_name || '-'}`, fontSize: 7.5, color: C.textLight },
                                        { text: `Branch: ${bankDetails.branch_name || '-'}`, fontSize: 7.5, color: C.textLight },
                                        { text: `IFSC: ${bankDetails.ifsc_code || '-'}`, fontSize: 7.5, color: C.textLight },
                                        ...(bankDetails.upi_id ? [{ text: `UPI: ${bankDetails.upi_id}`, fontSize: 7.5, color: C.textLight }] : []),
                                    ] : [])
                                ],
                                margin: [8, 8, 8, 8]
                            },
                            // RIGHT: tax summary
                            {
                                stack: [
                                    {
                                        table: {
                                            widths: ['*', 95],
                                            body: [
                                                [
                                                    { text: 'Taxable Value', style: 'totLabel' },
                                                    { text: formatCurrency(taxableValue), alignment: 'right', noWrap: true, style: 'totValue' }
                                                ],
                                                ...(gstEnabled ? (
                                                    billType === 'intra-state' ? [
                                                        [{ text: 'Add: CGST', style: 'totLabel' }, { text: formatCurrency(bill.cgst), alignment: 'right', noWrap: true, style: 'totValue' }],
                                                        [{ text: 'Add: SGST', style: 'totLabel' }, { text: formatCurrency(bill.sgst), alignment: 'right', noWrap: true, style: 'totValue' }]
                                                    ] : [
                                                        [{ text: 'Add: IGST', style: 'totLabel' }, { text: formatCurrency(bill.igst), alignment: 'right', noWrap: true, style: 'totValue' }]
                                                    ]
                                                ) : []),
                                                [{ text: 'Total Tax', style: 'totLabel' }, { text: formatCurrency(totalTax), alignment: 'right', noWrap: true, style: 'totValue' }],
                                                [{ text: 'Round Off', style: 'totLabel' }, { text: formatCurrency(roundOff), alignment: 'right', noWrap: true, style: 'totValue' }],
                                                [
                                                    // Grand Total: bold navy text + thick top border (set in layout), no fill
                                                    { text: 'GRAND TOTAL', style: 'grandTotLabel' },
                                                    { text: formatCurrency(roundedGrandTotal), alignment: 'right', noWrap: true, style: 'grandTotValue' }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            // thick navy top & bottom borders; thick double-weight line above Grand Total row
                                            hLineWidth: (i, node) => {
                                                if (i === 0 || i === node.table.body.length) return 1.5;
                                                if (i === node.table.body.length - 1) return 1.5; // above Grand Total
                                                return 0.5;
                                            },
                                            vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
                                            hLineColor: (i, node) => {
                                                if (i === 0 || i === node.table.body.length) return C.borderDark;
                                                if (i === node.table.body.length - 1) return C.borderDark; // above Grand Total
                                                return C.border;
                                            },
                                            vLineColor: () => C.border,
                                            paddingLeft: () => 6,
                                            paddingRight: () => 6,
                                            paddingTop: () => 3,
                                            paddingBottom: () => 3
                                        }
                                    },
                                    ...(bill.reverse_charge && gstEnabled ? [
                                        { text: '* Reverse charge applicable. Tax liability on recipient.', fontSize: 7.5, color: C.red, margin: [0, 5, 0, 0], alignment: 'right' }
                                    ] : [])
                                ],
                                margin: [0, 0, 0, 0]
                            }
                        ]]
                    },
                    layout: {
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
                        hLineColor: () => C.borderDark,
                        vLineColor: (i) => i === 1 ? C.border : C.borderDark,
                        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0
                    },
                    margin: [0, 10, 0, 0]
                },

                // ── Signatures ────────────────────────────────────────────────
                {
                    table: {
                        widths: ['*', '*'],
                        body: [[
                            {
                                stack: [
                                    { text: 'TERMS & CONDITIONS', style: 'footerSectionTitle', margin: [0, 0, 0, 4] },
                                    { text: isPurchase
                                        ? '1. Subject to mutually agreed payment terms.'
                                        : '1. Goods once sold will not be taken back.',
                                      fontSize: 7.5, color: C.textLight },
                                    { text: '2. Subject to local jurisdiction only.', fontSize: 7.5, color: C.textLight },
                                    { text: '3. E. & O.E.', fontSize: 7.5, color: C.textLight },
                                    {
                                        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 130, y2: 0, lineWidth: 0.75, lineColor: C.border }],
                                        margin: [0, 28, 0, 4]
                                    },
                                    { text: isPurchase ? 'Authorised Signatory' : "Receiver's Signature", style: 'sigLabel' },
                                    { text: '(Authorised Signatory)', fontSize: 7.5, color: C.textLight }
                                ],
                                margin: [8, 8, 8, 8]
                            },
                            {
                                stack: [
                                    { text: `For ${seller.name}`, bold: true, fontSize: 9, alignment: 'right', margin: [0, 0, 0, 4] },
                                    { text: gstEnabled ? `GSTIN: ${seller.gstin}` : '', fontSize: 7.5, color: C.textLight, alignment: 'right' },
                                    {
                                        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 130, y2: 0, lineWidth: 0.75, lineColor: C.border }],
                                        margin: [85, 30, 0, 4]
                                    },
                                    { text: 'Authorised Signatory', style: 'sigLabel', alignment: 'right' },
                                    { text: 'This is a computer generated invoice', fontSize: 7, color: C.textLight, alignment: 'right', margin: [0, 10, 0, 0], italics: true }
                                ],
                                margin: [8, 8, 8, 8]
                            }
                        ]]
                    },
                    layout: {
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
                        hLineColor: () => C.borderDark,
                        vLineColor: (i) => i === 1 ? C.border : C.borderDark,
                        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0
                    },
                    margin: [0, 8, 0, 0]
                }
            ],
            styles: {
                // ── Header ────────────────────────────────────────────────────
                // No fills. Dark text on white. Navy used only for invoice type title.
                invoiceTypeLabel:  { fontSize: 17, bold: true, color: C.primary },
                invoiceSubTag:     { fontSize: 7.5, color: C.textLight },
                companyName:       { fontSize: 12, bold: true, color: C.textDark },
                companyMeta:       { fontSize: 8, color: C.textMid, margin: [0, 1, 0, 0] },
                metaLabel:         { fontSize: 8, color: C.textLight },
                metaValue:         { fontSize: 8.5, bold: true, color: C.textDark },
                // ── Party boxes ───────────────────────────────────────────────
                partyBoxTitle:     { fontSize: 7.5, bold: true, color: C.primary },
                partyName:         { fontSize: 9.5, bold: true, color: C.textDark },
                partyMeta:         { fontSize: 8, color: C.textMid, margin: [0, 1, 0, 0] },
                partyGstin:        { fontSize: 8, bold: true, color: C.textDark, margin: [0, 2, 0, 0] },
                // ── Items table ───────────────────────────────────────────────
                // Header: no fill, navy bold text. Thick bottom border distinguishes header.
                // Compact margins so more rows fit per page.
                tblHdr:            { fontSize: 8, bold: true, color: C.primary, margin: [0, 2, 0, 2] },
                tblCell:           { fontSize: 8.5, margin: [0, 2, 0, 2] },
                // ── HSN / SAC table ───────────────────────────────────────────
                // Header: no fill, navy bold text.
                hsnHdr:            { fontSize: 7.5, bold: true, color: C.primary, margin: [0, 1, 0, 1] },
                hsnCell:           { fontSize: 8, margin: [0, 1, 0, 1] },
                sectionTitle:      { fontSize: 8.5, bold: true, color: C.primary, margin: [0, 0, 0, 3] },
                // ── Footer totals ─────────────────────────────────────────────
                footerSectionTitle:{ fontSize: 7.5, bold: true, color: C.primary, margin: [0, 0, 0, 2] },
                totLabel:          { fontSize: 8.5, color: C.textMid },
                totValue:          { fontSize: 8.5, bold: true, color: C.textDark },
                // Grand Total: no fill. Bold navy text + thick border above (set in layout).
                grandTotLabel:     { fontSize: 10, bold: true, color: C.primary },
                grandTotValue:     { fontSize: 11, bold: true, color: C.primary },
                // ── Signatures ────────────────────────────────────────────────
                sigLabel:          { fontSize: 8, color: C.textMid },
                // ── Legacy (kept for safety — do not remove) ──────────────────
                label:             { fontSize: 8.5, color: C.textLight },
                value:             { fontSize: 8.5, bold: true, color: C.textDark },
                boxTitle:          { fontSize: 9, bold: true, color: C.primary },
                grandLabel:        { fontSize: 10, bold: true, color: C.primary },
                grandValue:        { fontSize: 12, bold: true, color: C.primary }
            },
            pageMargins: [30, 30, 30, 30]
        };

        const pdfDoc = await printer.createPdfKitDocument(docDefinition);

        const safeBillNo = String(bill.bno || `BILL-${bill._id}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `Invoice_${safeBillNo}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        pdfDoc.pipe(res);
        pdfDoc.on('error', (err) => { console.error('[PDF] generation error:', err); });
        pdfDoc.end();

    } catch (err) {
        console.error('pdfmake export error:', err);
        console.error('Error stack:', err.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.end();
        }
    }
};