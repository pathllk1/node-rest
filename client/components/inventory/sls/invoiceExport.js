/**
 * INVOICE EXPORT COMPONENT
 * Handles invoice export to Excel (CSV) and PDF formats
 */

// FIX: Removed unused import `getPartyId`
import { formatCurrency } from './utils.js';
import { showToast }      from './toast.js';

export function exportInvoiceToExcel(state) {
    try {
        let csv = 'INVOICE EXPORT\n';
        csv += `Bill No,${state.meta.billNo}\n`;
        csv += `Date,${state.meta.billDate}\n`;
        csv += `Bill Type,${state.meta.billType}\n`;
        csv += `Reverse Charge,${state.meta.reverseCharge ? 'Yes' : 'No'}\n\n`;

        if (state.selectedParty) {
            csv += 'BILL TO\n';
            csv += `Party,"${state.selectedParty.firm}"\n`;
            csv += `GSTIN,${state.selectedParty.gstin}\n`;
            csv += `Address,"${state.selectedParty.addr}"\n\n`;
        }

        if (state.selectedConsignee) {
            csv += 'CONSIGNEE\n';
            csv += `Name,"${state.selectedConsignee.name}"\n`;
            csv += `Address,"${state.selectedConsignee.address}"\n\n`;
        }

        csv += 'ITEMS\n';
        csv += 'Item,Batch,Qty,Unit,Rate,Disc %,Tax %,Total\n';
        state.cart.forEach(item => {
            const qty   = item.itemType === 'SERVICE' && (parseFloat(item.qty) || 0) === 0 ? '' : (parseFloat(item.qty) || 0);
            const qtyForCalc = parseFloat(item.qty) || 0;
            const rate  = parseFloat(item.rate)  || 0;
            const disc  = parseFloat(item.disc)  || 0;
            const grate = parseFloat(item.grate) || 0;
            
            // For services with qty=0 (flat-rate services), use rate directly
            // For all other items, use qty * rate
            let taxableAmount;
            if (item.itemType === 'SERVICE' && qtyForCalc === 0) {
                taxableAmount = rate * (1 - disc / 100);
            } else {
                const discAmount = (qtyForCalc * rate * disc) / 100;
                taxableAmount = (qtyForCalc * rate) - discAmount;
            }
            
            const taxAmount     = (taxableAmount * grate) / 100;
            const total         = taxableAmount + taxAmount;
            csv += `"${item.item}","${item.itemType === 'SERVICE' ? '' : (item.batch || '-')}","${qty}","${item.itemType === 'SERVICE' ? (item.uom || '') : item.uom}",${rate},${disc},${grate},${total.toFixed(2)}\n`;
        });

        csv += '\nOTHER CHARGES\n';
        csv += 'Charge,Amount,GST %,Total\n';
        state.otherCharges.forEach(charge => {
            const amount    = parseFloat(charge.amount)  || 0;
            const gstRate   = parseFloat(charge.gstRate) || 0;
            const gstAmount = (amount * gstRate) / 100;
            csv += `"${charge.name}",${amount},${gstRate},${(amount + gstAmount).toFixed(2)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url  = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Invoice_${state.meta.billNo}_${state.meta.billDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // FIX: alert() → showToast
        showToast('Invoice exported to Excel successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        // FIX: alert() → showToast
        showToast('Error exporting invoice: ' + err.message, 'error');
    }
}

export function exportInvoiceToPDF(state, billId) {
    if (!billId) return;
    // FIX: Use credentials:'same-origin' (cookie auth).
    // Original code used localStorage.getItem('token') in the Authorization header,
    // mixing two auth strategies and exposing the JWT to JS (defeating HttpOnly cookies).
    fetch(`/api/inventory/sales/bills/${billId}/pdf`, {
        method:      'GET',
        credentials: 'same-origin',
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.blob();
        })
        .then(blob => {
            const url  = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href          = url;
            link.download      = `Invoice_${state.meta.billNo || 'Bill'}.pdf`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        })
        .catch(err => {
            console.error('PDF download error:', err);
            // FIX: alert() → showToast
            showToast('Error downloading PDF: ' + err.message, 'error');
        });
}

// FIX: Removed calculateGrandTotal() — defined, never called, never exported.
// Grand total calculation is handled by renderTotals() in layoutRenderer.js.
