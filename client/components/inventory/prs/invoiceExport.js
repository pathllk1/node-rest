/**
 * INVOICE EXPORT COMPONENT
 * Handles invoice export to Excel (CSV) and PDF formats
 */

// FIX: Removed unused import `getPartyId`
import { formatCurrency } from './utils.js';
import { showToast }      from './toast.js';

export function exportInvoiceToExcel(state) {
    try {
        let csv = 'PURCHASE EXPORT\n';
        csv += `Purchase No,${state.meta.billNo}\n`;
        csv += `Supplier Bill No,${state.meta.supplierBillNo || ''}\n`;
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
            const qty   = parseFloat(item.qty)   || 0;
            const rate  = parseFloat(item.rate)  || 0;
            const disc  = parseFloat(item.disc)  || 0;
            const grate = parseFloat(item.grate) || 0;
            const discAmount    = (qty * rate * disc) / 100;
            const taxableAmount = (qty * rate) - discAmount;
            const taxAmount     = (taxableAmount * grate) / 100;
            const total         = taxableAmount + taxAmount;
            csv += `"${item.item}","${item.batch || '-'}",${qty},${item.uom},${rate},${disc},${grate},${total.toFixed(2)}\n`;
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
        link.setAttribute('download', `Purchase_${state.meta.billNo}_${state.meta.billDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // FIX: alert() → showToast
        showToast('Purchase exported to Excel successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        // FIX: alert() → showToast
        showToast('Error exporting purchase: ' + err.message, 'error');
    }
}

export function exportInvoiceToPDF(state, billId) {
    if (!billId) return;
    // FIX: Use credentials:'same-origin' (cookie auth).
    // Original code used localStorage.getItem('token') in the Authorization header,
    // mixing two auth strategies and exposing the JWT to JS (defeating HttpOnly cookies).
    fetch(`/api/inventory/purchase/bills/${billId}/pdf`, {
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
            link.download      = `Purchase_${state.meta.billNo || 'Bill'}.pdf`;
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
