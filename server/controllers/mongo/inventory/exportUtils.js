import ExcelJS from 'exceljs';
import { Bill, StockReg, Firm, BankAccount, FirmSettings, Settings } from '../../../models/index.js';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const formatCurrency = (amount) =>
    '₹ ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

const formatQuantity = (qty) => parseFloat(qty || 0).toFixed(2);
const formatPercentage = (percent) => parseFloat(percent || 0).toFixed(2) + '%';
const isServiceItem = (item) => (item?.item_type || 'GOODS') === 'SERVICE';
const getEffectiveQty = (item) => {
    const qty = parseFloat(item?.qty);
    if (Number.isFinite(qty) && qty > 0) return qty;
    return isServiceItem(item) ? 1 : 0;
};
const shouldShowQty = (item) => !isServiceItem(item) || item?.show_qty !== false;

const numberToWords = (num) => {
    if (!num || isNaN(num)) return 'Rupees Zero Only';
    const ones  = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens  = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convertTens = (n) => {
        const v = Math.floor(n);
        if (v < 10) return ones[v];
        if (v < 20) return teens[v - 10];
        return tens[Math.floor(v / 10)] + (v % 10 > 0 ? ' ' + ones[v % 10] : '');
    };
    const convertHundreds = (n) => {
        const v = Math.floor(n);
        return v > 99 ? ones[Math.floor(v / 100)] + ' Hundred ' + convertTens(v % 100) : convertTens(v);
    };
    const abs  = Math.abs(Number(num));
    const whole = Math.floor(abs);
    const paise = Math.round((abs - whole) * 100);
    if (whole === 0 && paise === 0) return 'Rupees Zero Only';
    let result = 'Rupees ';
    let t = whole;
    if (t >= 10000000) { result += convertHundreds(Math.floor(t / 10000000)) + ' Crore '; t %= 10000000; }
    if (t >= 100000)   { result += convertHundreds(Math.floor(t / 100000))   + ' Lakh ';  t %= 100000;   }
    if (t >= 1000)     { result += convertHundreds(Math.floor(t / 1000))     + ' Thousand '; t %= 1000;  }
    if (t > 0)         { result += convertHundreds(t); }
    if (paise > 0)     { result += ' and ' + convertTens(paise) + ' Paise'; }
    return result.trim() + ' Only';
};

const getInvoiceTypeLabel = (bill) => {
    const raw = bill.btype || bill.type || 'SALES';
    if (raw) {
        switch (raw.toUpperCase()) {
            case 'SALES':         return 'SALES INVOICE';
            case 'PURCHASE':      return 'PURCHASE INVOICE';
            case 'CREDIT NOTE':   return 'CREDIT NOTE';
            case 'DEBIT NOTE':    return 'DEBIT NOTE';
            case 'DELIVERY NOTE': return 'DELIVERY NOTE';
            default:              return raw.toUpperCase();
        }
    }
    return 'SALES INVOICE';
};

const getPartyLabels = (bill) => {
    switch ((bill.btype || bill.type || 'SALES').toUpperCase()) {
        case 'PURCHASE':      return { billTo: 'Bill From (Supplier)', shipTo: 'Bill To (Receiver)' };
        case 'CREDIT NOTE':   return { billTo: 'Bill To (Recipient)', shipTo: 'Ship To (Consignee)' };
        case 'DEBIT NOTE':    return { billTo: 'Bill From (Supplier)', shipTo: 'Bill To (Recipient)' };
        case 'DELIVERY NOTE': return { billTo: 'Deliver From (Supplier)', shipTo: 'Deliver To (Recipient)' };
        default:              return { billTo: 'Bill To (Buyer)', shipTo: 'Ship To (Consignee)' };
    }
};

const getBillType = (bill) => {
    const src = (bill.bill_subtype || bill.btype || bill.type || '').toString().toLowerCase();
    if (src.includes('intra')) return 'intra-state';
    if (src.includes('inter')) return 'inter-state';
    return (Number(bill.cgst) > 0 || Number(bill.sgst) > 0) ? 'intra-state' : 'inter-state';
};

const buildHsnSummary = (bill, items, otherCharges, gstEnabled) => {
    const hsnMap  = new Map();
    const billType = getBillType(bill);
    [...items].forEach(item => {
        const hsn = item.hsn || 'NA';
        const tv  = getEffectiveQty(item) * (item.rate || 0) * (1 - (item.disc || 0) / 100);
        const tax = tv * (item.grate || 0) / 100;
        if (!hsnMap.has(hsn)) hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
        const r = hsnMap.get(hsn);
        r.taxableValue += tv;
        if (gstEnabled) {
            r.totalTax += tax;
            if (billType === 'intra-state') { r.cgst += tax / 2; r.sgst += tax / 2; } else { r.igst += tax; }
        }
    });
    [...otherCharges].forEach(ch => {
        const hsn = ch.hsnSac || '9999';
        const tv  = ch.amount || 0;
        const tax = ch.gstAmount || 0;
        if (!hsnMap.has(hsn)) hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
        const r = hsnMap.get(hsn);
        r.taxableValue += tv;
        if (gstEnabled) {
            r.totalTax += tax;
            if (billType === 'intra-state') { r.cgst += tax / 2; r.sgst += tax / 2; } else { r.igst += tax; }
        }
    });
    return Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
};

const isGstEnabled = async (firmId) => {
    try {
        const fs = await FirmSettings.findOne({ firm_id: firmId, setting_key: 'gst_enabled' }).lean();
        if (fs) return fs.setting_value === 'true';
        const gs = await Settings.findOne({ setting_key: 'gst_enabled' }).lean();
        return gs ? gs.setting_value === 'true' : true;
    } catch { return true; }
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

/* ─────────────────────────────────────────────────────────────────────────
   exportBillsToExcel  (list view — unchanged)
───────────────────────────────────────────────────────────────────────── */
export async function exportBillsToExcel(bills) {
    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bills');
    worksheet.addRow(['Bill No', 'Date', 'Party', 'Type', 'Taxable Amount', 'Tax Amount', 'Total Amount', 'Status']);
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    headerRow.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    bills.forEach(bill => {
        const row = worksheet.addRow([
            bill.bno || '', formatDate(bill.bdate), bill.btype === 'PURCHASE' ? (bill.supply || '') : (bill.supply || ''), bill.btype || 'SALES',
            (bill.gtot || 0).toFixed(2),
            ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)).toFixed(2),
            (bill.ntot || 0).toFixed(2), bill.status || 'ACTIVE',
        ]);
        row.eachCell(cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
    });
    worksheet.columns.forEach(col => { col.width = 15; });
    return workbook.xlsx.writeBuffer();
}

/* ─────────────────────────────────────────────────────────────────────────
   generateInvoiceExcel — fixed version
   
   BUGS FIXED:
   1. alignment was set as a string ('center') not an object ({ horizontal: 'center' })
      → all text alignment silently failed causing visual overlap
   2. alignment was placed inside font property in signature cells → ignored
   3. Vehicle No label was immediately overwritten by its own value → lost label
   4. 9-col border loop set cell.font = { size: 8.5 } AFTER per-cell font was set
      → wiped bold/color on every item row cell
   5. Items table last row had thin bottom border instead of medium → table unclosed
   6. HSN table only used columns A:F, leaving G:H:I empty → broken layout
   7. HSN table last row had thin bottom border instead of medium → table unclosed
   8. Totals section was placed in columns E:F → should align with Amount col (I)
      → moved to G:H (label merged) + I (value)
   9. totalsStartRow calculation was fragile and off-by-one
      → replaced with explicit tracking variable
   10. Firm signature section right-alignment never applied → now uses .alignment
───────────────────────────────────────────────────────────────────────── */
export const generateInvoiceExcel = async (req, res) => {
    try {
        const billId = req.params.id;
        if (!billId) return res.status(400).json({ error: 'Bill ID is required' });

        const firmId = req.user?.firm_id;
        if (!firmId) return res.status(401).json({ error: 'Unauthorized - No firm associated' });

        const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();

        let otherCharges = [];
        if (bill.other_charges) {
            try { otherCharges = Array.isArray(bill.other_charges) ? bill.other_charges : []; } catch { otherCharges = []; }
        }

        const gstEnabled = await isGstEnabled(firmId);

        let firmAddress = '';
        let firmGstin   = '';
        let firmRecord  = null;
        try {
            firmRecord = await Firm.findById(firmId).select('name address gst_number bank_account_number bank_name bank_branch ifsc_code locations').lean();
            if (!firmRecord) return res.status(404).json({ error: 'Firm not found' });
            firmAddress = firmRecord.address || '';
            
            // FIX: Use the GST number that was used at the time of billing (bill.firm_gstin)
            // If not available (legacy bills), fall back to the default GST from firm
            if (bill.firm_gstin) {
                firmGstin = bill.firm_gstin;
            } else {
                // Legacy fallback: use default GST from firm
                firmGstin = firmRecord.gst_number || '';
            }
        } catch (err) {
            console.error('Error fetching firm:', err.message);
            return res.status(404).json({ error: 'Firm not found' });
        }

        const seller     = { name: bill.firm || 'Company Name', address: firmAddress, gstin: firmGstin };
        const bankDetails = await resolveDefaultBankDetails(firmId, firmRecord);
        const billType   = getBillType(bill);
        const partyLabels = getPartyLabels(bill);
        const hsnSummary = buildHsnSummary(bill, items, otherCharges, gstEnabled);

        const formattedBuyerAddress = bill.addr
            ? (bill.pin ? `${bill.addr}, PIN: ${bill.pin}` : bill.addr)
            : (bill.pin ? `PIN: ${bill.pin}` : '');
        const consAddr = bill.consignee_address || bill.addr || '';
        const consPin  = bill.consignee_pin  || bill.pin  || '';
        const formattedConsigneeAddress = consAddr
            ? (consPin ? `${consAddr}, PIN: ${consPin}` : consAddr)
            : (consPin ? `PIN: ${consPin}` : '');

        const taxableValue    = bill.gtot || 0;
        const totalTax        = gstEnabled ? ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)) : 0;
        const roundedGrandTotal = gstEnabled ? (bill.ntot || 0) : Math.round(taxableValue);
        const roundOff        = parseFloat(bill.rof || 0);

        // ── Design tokens ──────────────────────────────────────────────
        const C = {
            primary:    '1B3A6B',
            border:     'A0B4CC',
            borderDark: '1B3A6B',
            textDark:   '1A1A2E',
            textMid:    '3D4D6A',
            textLight:  '6B7A99',
            red:        '991B1B',
            hdrFill:    'EEF2F7',
        };

        // ── Shorthand border builders ──────────────────────────────────
        // FIX 1/7: border helpers — 'm' = medium (dark), 't' = thin (light), null = none
        const bSide = (style, dark) => ({
            style: style === 'm' ? 'medium' : 'thin',
            color: { argb: 'FF' + (dark ? C.borderDark : C.border) },
        });
        const mkBorder = (top, right, bottom, left) => ({
            top:    top    ? bSide(top,    top    === 'm') : undefined,
            right:  right  ? bSide(right,  right  === 'm') : undefined,
            bottom: bottom ? bSide(bottom, bottom === 'm') : undefined,
            left:   left   ? bSide(left,   left   === 'm') : undefined,
        });

        // ── Workbook / sheet ──────────────────────────────────────────
        const workbook  = new ExcelJS.Workbook();
        const ws        = workbook.addWorksheet('Invoice');

        // 9 columns: A=# B=Description C=HSN D=Qty E=UOM F=Rate G=Disc H=GST I=Amount
        ws.columns = [
            { width: 5  }, // A
            { width: 40 }, // B
            { width: 10 }, // C
            { width: 7  }, // D
            { width: 5  }, // E
            { width: 12 }, // F
            { width: 8  }, // G
            { width: 8  }, // H
            { width: 15 }, // I
        ];

        let row = 1; // current row pointer

        /* ═══════════════════════════════════════════════════════════════
           SECTION 1 — HEADER  (rows 1-5)
           Left  A:F  = Invoice type / seller info
           Right G:H  = meta labels, I = meta values
           FIX 3: vehicle_no label no longer overwrites itself
        ═══════════════════════════════════════════════════════════════ */
        const headerStartRow = row;

        // Left-side content
        const leftHeader = [
            { value: getInvoiceTypeLabel(bill), font: { size: 13, bold: true, color: { argb: 'FF' + C.primary } },
              align: { horizontal: 'center' } },
            { value: gstEnabled ? 'TAX INVOICE UNDER GST' : 'INVOICE (GST DISABLED)',
              font: { size: 7.5, color: { argb: 'FF' + C.textLight } }, align: { horizontal: 'center' } },
            { value: seller.name,    font: { size: 12, bold: true, color: { argb: 'FF' + C.textDark } } },
            { value: seller.address, font: { size: 8,  color: { argb: 'FF' + C.textMid  } } },
            { value: seller.gstin ? `GSTIN: ${seller.gstin}` : '',
              font: { size: 8, bold: true, color: { argb: 'FF' + C.textDark } } },
        ];
        leftHeader.forEach((item, i) => {
            const r = headerStartRow + i;
            ws.getCell(`A${r}`).value     = item.value;
            ws.getCell(`A${r}`).font      = item.font;
            ws.getCell(`A${r}`).alignment = item.align || {};  // FIX 1
            ws.mergeCells(`A${r}:F${r}`);
        });

        // Right-side meta table: G = label, H:I merged = value
        // FIX 3: vehicle_no properly placed in its own row (G label, H:I value)
        const metaRows = [
            { label: (bill.btype || bill.type) === 'PURCHASE' ? 'Purchase No' : 'Invoice No', value: bill.bno || '' },
            { label: 'Supplier Bill No', value: bill.supplier_bill_no || '', skip: !(bill.btype === 'PURCHASE' && bill.supplier_bill_no) },
            { label: 'Date',         value: formatDate(bill.bdate) || '' },
            { label: (bill.btype || bill.type) === 'PURCHASE' ? 'Reference / PO No' : 'PO No', value: bill.order_no || '', skip: !bill.order_no },
            { label: 'Vehicle No',   value: bill.vehicle_no   || '', skip: !bill.vehicle_no },
            { label: 'Dispatch Via', value: bill.dispatch_through || '', skip: !bill.dispatch_through },
        ];
        let metaRowIdx = headerStartRow;
        metaRows.forEach(meta => {
            if (meta.skip) return;
            if (metaRowIdx > headerStartRow + 4) return; // max 5 rows
            ws.getCell(`G${metaRowIdx}`).value     = meta.label;
            ws.getCell(`G${metaRowIdx}`).font      = { size: 8, color: { argb: 'FF' + C.textLight } };
            ws.getCell(`G${metaRowIdx}`).alignment = { horizontal: 'left' };  // FIX 1

            ws.getCell(`H${metaRowIdx}`).value     = meta.value;
            ws.getCell(`H${metaRowIdx}`).font      = { size: 8.5, bold: true, color: { argb: 'FF' + C.textDark } };
            ws.mergeCells(`H${metaRowIdx}:I${metaRowIdx}`);
            ws.getCell(`H${metaRowIdx}`).alignment = { horizontal: 'left' };  // FIX 1

            metaRowIdx++;
        });

        // Borders on meta table (G:I, rows 1-5)
        for (let r = headerStartRow; r <= headerStartRow + 4; r++) {
            const isFirst = r === headerStartRow;
            const isLast  = r === headerStartRow + 4;
            ws.getCell(`G${r}`).border = mkBorder(
                isFirst ? 'm' : 't', 't', isLast ? 'm' : 't', 'm'
            );
            ws.getCell(`H${r}`).border = mkBorder(
                isFirst ? 'm' : 't', null, isLast ? 'm' : 't', null
            );
            ws.getCell(`I${r}`).border = mkBorder(
                isFirst ? 'm' : 't', 'm', isLast ? 'm' : 't', null
            );
        }

        row = headerStartRow + 5; // past header

        /* ═══════════════════════════════════════════════════════════════
           SECTION 2 — PARTY DETAILS  (5 rows)
           Left  A:D = Bill To
           Right E:I = Ship To
        ═══════════════════════════════════════════════════════════════ */
        const partyStart = row;

        const partyLeft = [
            { value: partyLabels.billTo.toUpperCase(), font: { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } } },
            { value: bill.supply || '', font: { size: 9.5, bold: true, color: { argb: 'FF' + C.textDark } } },
            { value: formattedBuyerAddress, font: { size: 8, color: { argb: 'FF' + C.textMid } } },
            { value: bill.state ? `State: ${bill.state}` : '', font: { size: 8, color: { argb: 'FF' + C.textMid } } },
            { value: bill.gstin ? `GSTIN: ${bill.gstin}` : '', font: { size: 8, bold: true, color: { argb: 'FF' + C.textDark } } },
        ];
        const partyRight = [
            { value: partyLabels.shipTo.toUpperCase(), font: { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } } },
            { value: bill.consignee_name || bill.party_id || '', font: { size: 9.5, bold: true, color: { argb: 'FF' + C.textDark } } },
            { value: formattedConsigneeAddress, font: { size: 8, color: { argb: 'FF' + C.textMid } } },
            { value: (bill.consignee_state || bill.state) ? `State: ${bill.consignee_state || bill.state}` : '', font: { size: 8, color: { argb: 'FF' + C.textMid } } },
            { value: (bill.consignee_gstin || bill.gstin) ? `GSTIN: ${bill.consignee_gstin || bill.gstin}` : '', font: { size: 8, bold: true, color: { argb: 'FF' + C.textDark } } },
        ];

        partyLeft.forEach((item, i) => {
            const r = partyStart + i;
            ws.getCell(`A${r}`).value     = item.value;
            ws.getCell(`A${r}`).font      = item.font;
            ws.getCell(`A${r}`).alignment = { wrapText: true };
            ws.mergeCells(`A${r}:D${r}`);
        });
        partyRight.forEach((item, i) => {
            const r = partyStart + i;
            ws.getCell(`E${r}`).value     = item.value;
            ws.getCell(`E${r}`).font      = item.font;
            ws.getCell(`E${r}`).alignment = { wrapText: true };
            ws.mergeCells(`E${r}:I${r}`);
        });

        const partyEnd = partyStart + 4;
        for (let r = partyStart; r <= partyEnd; r++) {
            const isFirst = r === partyStart;
            const isLast  = r === partyEnd;
            // Left box: A-D
            for (let c = 0; c < 4; c++) {
                const col = String.fromCharCode(65 + c);
                ws.getCell(`${col}${r}`).border = mkBorder(
                    isFirst ? 'm' : 't',
                    c === 3 ? 'm' : 't',
                    isLast  ? 'm' : 't',
                    c === 0 ? 'm' : 't'
                );
            }
            // Right box: E-I
            for (let c = 4; c < 9; c++) {
                const col = String.fromCharCode(65 + c);
                ws.getCell(`${col}${r}`).border = mkBorder(
                    isFirst ? 'm' : 't',
                    c === 8 ? 'm' : 't',
                    isLast  ? 'm' : 't',
                    c === 4 ? 'm' : 't'
                );
            }
        }
        row = partyEnd + 2; // one blank spacer row

        /* ═══════════════════════════════════════════════════════════════
           SECTION 3 — ITEMS TABLE
           FIX 4: font is set once per cell in a combined pass (no overwrite)
           FIX 5: last data row gets medium bottom border
        ═══════════════════════════════════════════════════════════════ */
        const itemsHeaderRow = row;

        // Column headers
        const itemColDefs = [
            { col: 'A', label: '#',                          align: 'center' },
            { col: 'B', label: 'Description of Goods / Services', align: 'left'   },
            { col: 'C', label: 'HSN/SAC',                    align: 'center' },
            { col: 'D', label: 'Qty',                        align: 'center' },
            { col: 'E', label: 'UOM',                        align: 'center' },
            { col: 'F', label: 'Rate (₹)',                   align: 'right'  },
            { col: 'G', label: 'Disc%',                      align: 'right'  },
            { col: 'H', label: 'GST%',                       align: 'right'  },
            { col: 'I', label: 'Amount (₹)',                 align: 'right'  },
        ];
        itemColDefs.forEach(({ col, label, align }, idx) => {
            const cell = ws.getCell(`${col}${itemsHeaderRow}`);
            cell.value     = label;
            cell.font      = { size: 8, bold: true, color: { argb: 'FF' + C.primary } };
            cell.alignment = { horizontal: align };  // FIX 1
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.hdrFill } };
            cell.border    = mkBorder('m', idx === 8 ? 'm' : 't', 'm', idx === 0 ? 'm' : 't');
        });
        row++;

        // Helper: write + style a single item row
        // FIX 4: font properties set once per cell — no second loop that overwrites them
        const writeItemRow = (rowNum, cells, isLastRow) => {
            cells.forEach(({ col, value, align, bold, fontSize, color }, idx) => {
                const cell = ws.getCell(`${col}${rowNum}`);
                cell.value     = value;
                // Skip cell-level font for richText values — each run carries its own font
                if (!value || typeof value !== 'object' || !value.richText) {
                    cell.font  = {
                        size:  fontSize || 8.5,
                        bold:  bold     || false,
                        color: { argb: 'FF' + (color || C.textDark) },
                    };
                }
                cell.alignment = { horizontal: align || 'left', wrapText: col === 'B' };  // FIX 1
                cell.border    = mkBorder(
                    't',
                    idx === cells.length - 1 ? 'm' : 't',
                    isLastRow ? 'm' : 't',   // FIX 5: medium bottom on last row
                    idx === 0 ? 'm' : 't'
                );
            });
        };

        const allDataRows = [
            ...items.map((it, idx) => ({
                key: `item-${idx}`,
                cells: [
                    { col: 'A', value: idx + 1,                     align: 'center' },
                    { col: 'B', value: (() => {
                        const parts = [{ text: it.item || '', font: { bold: true, size: 8.5, color: { argb: 'FF' + C.textDark } } }];
                        if (!isServiceItem(it) && it.batch) parts.push({ text: '  Batch: ' + it.batch,    font: { size: 7.5, color: { argb: 'FF' + C.textLight } } });
                        if (it.item_narration) parts.push({ text: '  ' + it.item_narration,  font: { size: 7.5, color: { argb: 'FF' + C.textLight } } });
                        return parts.length > 1 ? { richText: parts } : (it.item || '');
                    })(), align: 'left', bold: true },
                    { col: 'C', value: it.hsn  || '',               align: 'center' },
                    { col: 'D', value: shouldShowQty(it) ? formatQuantity(it.qty) : '', align: 'center' },
                    { col: 'E', value: shouldShowQty(it) ? (it.uom || '') : '',   align: 'center' },
                    { col: 'F', value: formatCurrency(it.rate),     align: 'right'  },
                    { col: 'G', value: formatPercentage(it.disc),   align: 'right'  },
                    { col: 'H', value: gstEnabled ? formatPercentage(it.grate) : '-', align: 'right' },
                    { col: 'I', value: formatCurrency(it.total),    align: 'right', bold: true },
                ],
            })),
            ...otherCharges.map((ch, idx) => ({
                key: `charge-${idx}`,
                cells: [
                    { col: 'A', value: items.length + idx + 1,       align: 'center' },
                    { col: 'B', value: ch.name || ch.type || 'Other Charge', align: 'left', bold: true },
                    { col: 'C', value: ch.hsnSac || '',              align: 'center' },
                    { col: 'D', value: '1',                          align: 'center' },
                    { col: 'E', value: 'NOS',                        align: 'center' },
                    { col: 'F', value: formatCurrency(ch.amount),    align: 'right'  },
                    { col: 'G', value: '0.00%',                      align: 'right'  },
                    { col: 'H', value: gstEnabled ? formatPercentage(ch.gstRate) : '-', align: 'right' },
                    { col: 'I', value: formatCurrency(ch.amount),    align: 'right', bold: true },
                ],
            })),
        ];

        allDataRows.forEach(({ cells }, idx) => {
            const isLast = idx === allDataRows.length - 1;
            writeItemRow(row, cells, isLast);  // FIX 5
            row++;
        });

        /* ═══════════════════════════════════════════════════════════════
           SECTION 4 — HSN / SAC SUMMARY
           FIX 6: Table now spans all 9 columns (A-I) to match items table
           FIX 7: Last row gets medium bottom border

           Column mapping (9 cols):
             A        = HSN/SAC code
             B:C mer  = Taxable Value
             D:E mer  = CGST (₹)
             F:G mer  = SGST (₹)
             H        = IGST (₹)
             I        = Total Tax (₹)
        ═══════════════════════════════════════════════════════════════ */
        if (hsnSummary.length > 0 && gstEnabled) {
            row += 1; // one spacer row

            const hsnHdrRow = row;

            // HSN header: merge FIRST, then style master only.
            // Styling slave cells after merge proxies to master and wipes values — that was the bug.
            const hsnHdrFont = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };
            const hsnHdrFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.hdrFill } };

            const styleHsnMaster = (col, label, align, leftBorder, rightBorder) => {
                const c = ws.getCell(`${col}${hsnHdrRow}`);
                c.value     = label;
                c.font      = { ...hsnHdrFont };
                c.alignment = { horizontal: align };
                c.fill      = hsnHdrFill;
                c.border    = mkBorder('m', rightBorder, 'm', leftBorder);
            };

            // Step 1: merge all paired columns first
            ws.mergeCells(`B${hsnHdrRow}:C${hsnHdrRow}`);
            ws.mergeCells(`D${hsnHdrRow}:E${hsnHdrRow}`);
            ws.mergeCells(`F${hsnHdrRow}:G${hsnHdrRow}`);

            // Step 2: style masters only (slaves are proxies — never touch after merge)
            styleHsnMaster('A', 'HSN/SAC',       'center', 'm', 't');
            styleHsnMaster('B', 'Taxable Value',  'right',  't', 't');
            styleHsnMaster('D', 'CGST (₹)',        'right',  't', 't');
            styleHsnMaster('F', 'SGST (₹)',        'right',  't', 't');
            styleHsnMaster('H', 'IGST (₹)',        'right',  't', 't');
            styleHsnMaster('I', 'Total Tax (₹)',   'right',  't', 'm');

            // Step 3: fill + right-border on slave cells (safe: only border/fill, not value)
            ['C', 'E', 'G'].forEach(col => {
                ws.getCell(`${col}${hsnHdrRow}`).fill   = hsnHdrFill;
                ws.getCell(`${col}${hsnHdrRow}`).border = mkBorder('m', 't', 'm', null);
            });
            row++;

            hsnSummary.forEach((hsn, idx) => {
                const isLast = idx === hsnSummary.length - 1;
                const bot    = isLast ? 'm' : 't';  // FIX 7

                // A: HSN code
                ws.getCell(`A${row}`).value     = hsn.hsn;
                ws.getCell(`A${row}`).font      = { size: 8 };
                ws.getCell(`A${row}`).alignment = { horizontal: 'center' };  // FIX 1
                ws.getCell(`A${row}`).border    = mkBorder('t', 't', bot, 'm');

                // B:C merged: Taxable Value
                ws.getCell(`B${row}`).value     = formatCurrency(hsn.taxableValue);
                ws.getCell(`B${row}`).font      = { size: 8 };
                ws.getCell(`B${row}`).alignment = { horizontal: 'right' };  // FIX 1
                ws.getCell(`B${row}`).border    = mkBorder('t', 't', bot, 't');
                ws.mergeCells(`B${row}:C${row}`);
                ws.getCell(`C${row}`).border    = mkBorder('t', 't', bot, 't');

                // D:E merged: CGST
                ws.getCell(`D${row}`).value     = billType === 'intra-state' ? formatCurrency(hsn.cgst) : '—';
                ws.getCell(`D${row}`).font      = { size: 8 };
                ws.getCell(`D${row}`).alignment = { horizontal: 'right' };  // FIX 1
                ws.getCell(`D${row}`).border    = mkBorder('t', 't', bot, 't');
                ws.mergeCells(`D${row}:E${row}`);
                ws.getCell(`E${row}`).border    = mkBorder('t', 't', bot, 't');

                // F:G merged: SGST
                ws.getCell(`F${row}`).value     = billType === 'intra-state' ? formatCurrency(hsn.sgst) : '—';
                ws.getCell(`F${row}`).font      = { size: 8 };
                ws.getCell(`F${row}`).alignment = { horizontal: 'right' };  // FIX 1
                ws.getCell(`F${row}`).border    = mkBorder('t', 't', bot, 't');
                ws.mergeCells(`F${row}:G${row}`);
                ws.getCell(`G${row}`).border    = mkBorder('t', 't', bot, 't');

                // H: IGST
                ws.getCell(`H${row}`).value     = billType === 'inter-state' ? formatCurrency(hsn.igst) : '—';
                ws.getCell(`H${row}`).font      = { size: 8 };
                ws.getCell(`H${row}`).alignment = { horizontal: 'right' };  // FIX 1
                ws.getCell(`H${row}`).border    = mkBorder('t', 't', bot, 't');

                // I: Total Tax
                ws.getCell(`I${row}`).value     = formatCurrency(hsn.totalTax);
                ws.getCell(`I${row}`).font      = { size: 8, bold: true };
                ws.getCell(`I${row}`).alignment = { horizontal: 'right' };  // FIX 1
                ws.getCell(`I${row}`).border    = mkBorder('t', 'm', bot, 't');

                row++;
            });
        }

        /* ═══════════════════════════════════════════════════════════════
           SECTION 5 — FOOTER: AMOUNT IN WORDS + TOTALS
           FIX 8: Totals moved to G:I — label G:H merged, value I — 
                  so the amount column aligns with items Amount (₹)
           FIX 9: totalsRow tracked explicitly, not computed from currentRow offset
        ═══════════════════════════════════════════════════════════════ */
        row += 1; // spacer

        const footerStartRow = row; // FIX 9: explicit anchor

        // Amount in Words (left side A:F)
        ws.getCell(`A${row}`).value     = 'AMOUNT IN WORDS';
        ws.getCell(`A${row}`).font      = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };
        ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
        ws.mergeCells(`A${row}:F${row}`);
        row++;

        ws.getCell(`A${row}`).value     = numberToWords(roundedGrandTotal);
        ws.getCell(`A${row}`).font      = { size: 9, bold: true };
        ws.getCell(`A${row}`).alignment = { wrapText: true };
        ws.mergeCells(`A${row}:F${row}`);
        row++;

        if (bill.narration) {
            ws.getCell(`A${row}`).value     = 'NARRATION';
            ws.getCell(`A${row}`).font      = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };
            ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
            ws.mergeCells(`A${row}:F${row}`);
            row++;

            ws.getCell(`A${row}`).value     = bill.narration;
            ws.getCell(`A${row}`).font      = { size: 8.5, color: { argb: 'FF' + C.textMid } };
            ws.getCell(`A${row}`).alignment = { wrapText: true };
            ws.mergeCells(`A${row}:F${row}`);
            row++;
        }

        if (bankDetails) {
            ws.getCell(`A${row}`).value     = 'BANK DETAILS';
            ws.getCell(`A${row}`).font      = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };
            ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
            ws.mergeCells(`A${row}:F${row}`);
            row++;

            [
                `A/C: ${bankDetails.account_number || '-'}`,
                `Bank: ${bankDetails.bank_name || '-'}`,
                `Branch: ${bankDetails.branch_name || '-'}`,
                `IFSC: ${bankDetails.ifsc_code || '-'}`,
                ...(bankDetails.upi_id ? [`UPI: ${bankDetails.upi_id}`] : []),
            ].forEach((line) => {
                ws.getCell(`A${row}`).value     = line;
                ws.getCell(`A${row}`).font      = { size: 7.5, color: { argb: 'FF' + C.textLight } };
                ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
                ws.mergeCells(`A${row}:F${row}`);
                row++;
            });
        }

        // FIX 8/9: Totals on right (G:H=label, I=value)
        // Build the totals rows list
        const totalsLines = [];
        totalsLines.push({ label: 'Taxable Value', value: formatCurrency(taxableValue) });
        if (gstEnabled) {
            if (billType === 'intra-state') {
                totalsLines.push({ label: 'Add: CGST', value: formatCurrency(bill.cgst) });
                totalsLines.push({ label: 'Add: SGST', value: formatCurrency(bill.sgst) });
            } else {
                totalsLines.push({ label: 'Add: IGST', value: formatCurrency(bill.igst) });
            }
        }
        totalsLines.push({ label: 'Total Tax',  value: formatCurrency(totalTax) });
        totalsLines.push({ label: 'Round Off',  value: formatCurrency(roundOff) });
        totalsLines.push({ label: 'GRAND TOTAL', value: formatCurrency(roundedGrandTotal), isGrand: true });

        let totalsRow = footerStartRow; // FIX 9: start at the same row as Amount in Words

        totalsLines.forEach((line, idx) => {
            const isFirst = idx === 0;
            const isLast  = idx === totalsLines.length - 1;
            const isAboveGrand = idx === totalsLines.length - 2;

            // Label spans G:H merged.
            // IMPORTANT: set full border on G BEFORE calling mergeCells.
            // After merge, ws.getCell('H') proxies to master G — any H.border call
            // would overwrite G.border (destroying the left:'m' we set here).
            ws.getCell(`G${totalsRow}`).value     = line.label;
            ws.getCell(`G${totalsRow}`).font      = line.isGrand
                ? { size: 9.5, bold: true, color: { argb: 'FF' + C.primary } }
                : { size: 8, color: { argb: 'FF' + C.textMid } };
            ws.getCell(`G${totalsRow}`).alignment = { horizontal: 'left' };
            ws.getCell(`G${totalsRow}`).border    = mkBorder(
                isFirst || isAboveGrand ? 'm' : 't',
                't',                                    // inner right (between G and H span)
                isLast  || isAboveGrand ? 'm' : 't',
                'm'                                     // outer left — preserved because set before merge
            );
            ws.mergeCells(`G${totalsRow}:H${totalsRow}`);
            // Do NOT set H.border after merge — slave proxy would overwrite G's left border.

            // Value in I (aligned with items Amount column)
            ws.getCell(`I${totalsRow}`).value     = line.value;
            ws.getCell(`I${totalsRow}`).font      = line.isGrand
                ? { size: 10, bold: true, color: { argb: 'FF' + C.primary } }
                : { size: 8.5 };
            ws.getCell(`I${totalsRow}`).alignment = { horizontal: 'right' };  // FIX 1
            ws.getCell(`I${totalsRow}`).border    = mkBorder(
                isFirst || isAboveGrand ? 'm' : 't', 'm',
                isLast  || isAboveGrand ? 'm' : 't', 't'
            );

            totalsRow++;
        });

        if (bill.reverse_charge && gstEnabled) {
            ws.getCell(`G${totalsRow}`).value     = '* Reverse charge applicable. Tax liability on recipient.';
            ws.getCell(`G${totalsRow}`).font      = { size: 7.5, color: { argb: 'FF' + C.red } };
            ws.getCell(`G${totalsRow}`).alignment = { horizontal: 'right' };
            ws.mergeCells(`G${totalsRow}:I${totalsRow}`);
            totalsRow++;
        }

        const footerEndRow = Math.max(row, totalsRow);
        row = footerEndRow + 1;

        /* ═══════════════════════════════════════════════════════════════
           SECTION 6 — SIGNATURES
           FIX 2/10: alignment set as .alignment property, NOT inside .font
        ═══════════════════════════════════════════════════════════════ */
        // Terms & Conditions (left A:F)
        ws.getCell(`A${row}`).value     = 'TERMS & CONDITIONS';
        ws.getCell(`A${row}`).font      = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };
        ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
        ws.mergeCells(`A${row}:F${row}`);
        row++;

        const terms = [
            '1. Goods once sold will not be taken back.',
            '2. Subject to local jurisdiction only.',
            '3. E. & O.E.',
        ];
        terms.forEach(t => {
            ws.getCell(`A${row}`).value     = t;
            ws.getCell(`A${row}`).font      = { size: 7.5, color: { argb: 'FF' + C.textLight } };
            ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
            ws.mergeCells(`A${row}:F${row}`);
            row++;
        });

        row += 2; // space for signature

        ws.getCell(`A${row}`).value     = "Receiver's Signature";
        ws.getCell(`A${row}`).font      = { size: 8, color: { argb: 'FF' + C.textMid } };
        ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
        ws.mergeCells(`A${row}:F${row}`);
        row++;

        ws.getCell(`A${row}`).value     = '(Authorised Signatory)';
        ws.getCell(`A${row}`).font      = { size: 7.5, color: { argb: 'FF' + C.textLight } };
        ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
        ws.mergeCells(`A${row}:F${row}`);

        // Right signatures (G:I)  FIX 2/10: alignment is a separate property
        const sigStartRow = footerEndRow + 1;

        ws.getCell(`G${sigStartRow}`).value     = `For ${seller.name}`;
        ws.getCell(`G${sigStartRow}`).font      = { size: 9, bold: true, color: { argb: 'FF' + C.textDark } };
        ws.getCell(`G${sigStartRow}`).alignment = { horizontal: 'right' };  // FIX 2: separate from font
        ws.mergeCells(`G${sigStartRow}:I${sigStartRow}`);

        ws.getCell(`G${sigStartRow + 1}`).value     = gstEnabled ? `GSTIN: ${seller.gstin}` : '';
        ws.getCell(`G${sigStartRow + 1}`).font      = { size: 7.5, color: { argb: 'FF' + C.textLight } };
        ws.getCell(`G${sigStartRow + 1}`).alignment = { horizontal: 'right' };  // FIX 2
        ws.mergeCells(`G${sigStartRow + 1}:I${sigStartRow + 1}`);

        ws.getCell(`G${sigStartRow + 4}`).value     = 'Authorised Signatory';
        ws.getCell(`G${sigStartRow + 4}`).font      = { size: 8, color: { argb: 'FF' + C.textMid } };
        ws.getCell(`G${sigStartRow + 4}`).alignment = { horizontal: 'right' };  // FIX 2
        ws.mergeCells(`G${sigStartRow + 4}:I${sigStartRow + 4}`);

        ws.getCell(`G${sigStartRow + 5}`).value     = 'This is a computer generated invoice';
        ws.getCell(`G${sigStartRow + 5}`).font      = { size: 7, italic: true, color: { argb: 'FF' + C.textLight } };
        ws.getCell(`G${sigStartRow + 5}`).alignment = { horizontal: 'right' };  // FIX 2
        ws.mergeCells(`G${sigStartRow + 5}:I${sigStartRow + 5}`);

        // ── Page setup: A4, narrow margins, fit to 1 page wide ──────────
        ws.pageSetup.paperSize      = 9;     // 9 = A4
        ws.pageSetup.orientation    = 'portrait';
        ws.pageSetup.fitToPage      = true;
        ws.pageSetup.fitToWidth     = 1;     // force all columns into one page width
        ws.pageSetup.fitToHeight    = 0;     // unlimited height
        ws.pageSetup.scale          = 100;
        ws.pageMargins = {
            left:   0.25,   // inches — was 0.7, reduced so 9 cols fit on A4
            right:  0.25,
            top:    0.4,
            bottom: 0.4,
            header: 0.2,
            footer: 0.2,
        };

        // ── Send response ─────────────────────────────────────────────
        const safeBillNo = String(bill.bno || `BILL-${bill._id}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename   = `Invoice_${safeBillNo}.xlsx`;

        res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control',       'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma',              'no-cache');
        res.setHeader('Expires',             '0');

        const buffer = await workbook.xlsx.writeBuffer();
        res.send(buffer);
        console.log('Excel generation completed:', filename);

    } catch (err) {
        console.error('Excel export error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.end();
        }
    }
};
