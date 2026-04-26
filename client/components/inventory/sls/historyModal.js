/**
 * HISTORY MODAL COMPONENT
 * Displays party item purchase history with pagination
 */

import { getPartyId, isPartySelected, getHistoryCacheKey, escHtml } from './utils.js';
import { showToast } from './toast.js';

export async function openPartyItemHistoryModal(stock, state) {
    const partyId = getPartyId(state.selectedParty);

    // FIX: alert() → showToast
    if (!isPartySelected(state.selectedParty)) {
        showToast('Please select a party first to view history.', 'error');
        return;
    }

    const modal   = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');

    // Show skeleton immediately
    content.innerHTML = `
        <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
            <div>
                <h3 class="font-bold text-base text-gray-800">${escHtml(stock.item)} — History</h3>
                <p class="text-xs text-gray-500 mt-0.5">Party: <strong>${escHtml(state.selectedParty.firm)}</strong></p>
            </div>
            <button id="close-modal" class="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-xl">&times;</button>
        </div>
        <div class="flex-1 flex items-center justify-center p-16 text-gray-400">
            <div class="flex flex-col items-center gap-3">
                <div class="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-sm">Loading history…</span>
            </div>
        </div>
    `;
    document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');

    // FIX: Use cache — original code hit the API every time the modal opened
    const cacheKey  = getHistoryCacheKey(partyId, stock.id);
    let historyData = state.historyCache[cacheKey] || null;

    if (!historyData) {
        try {
            const response = await fetch(
                `/api/inventory/sales/party-item-history?partyId=${partyId}&stockId=${stock.id}&limit=all`,
                { method: 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }
            );
            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.data?.rows)) {
                    historyData = data.data.rows.map(row => ({
                        date:  row.bdate ? new Date(row.bdate).toLocaleDateString('en-IN') : '-',
                        batch: row.batch || '-',
                        qty:   row.qty   || 0,
                        rate:  row.rate  || 0,
                        total: ((row.qty || 0) * (row.rate || 0)).toFixed(2),
                        refNo: row.bno  || '-',
                    }));
                    // Store in cache so subsequent opens are instant
                    state.historyCache[cacheKey] = historyData;
                }
            } else {
                console.warn('Failed to fetch history:', response.status);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    }

    historyData = Array.isArray(historyData) ? historyData : [];

    const pagination = { currentPage: 1, itemsPerPage: 10, data: historyData };

    function renderPage() {
        const { currentPage, itemsPerPage, data } = pagination;
        const total      = data.length;
        const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
        const startIdx   = (currentPage - 1) * itemsPerPage;
        const endIdx     = Math.min(startIdx + itemsPerPage, total);
        const pageData   = data.slice(startIdx, endIdx);

        // FIX: escHtml applied to all data in innerHTML
        const rows = pageData.length === 0
            ? `<tr><td colspan="6" class="p-10 text-center text-gray-300 italic text-sm">No purchase history found</td></tr>`
            : pageData.map(record => `
                <tr class="hover:bg-blue-50/60 transition-colors border-b border-gray-50">
                    <td class="p-2.5 text-gray-600">${escHtml(record.date)}</td>
                    <td class="p-2.5 font-mono text-gray-400 text-[11px]">${escHtml(record.batch)}</td>
                    <td class="p-2.5 text-right tabular-nums">${escHtml(String(record.qty))}</td>
                    <td class="p-2.5 text-right tabular-nums">${escHtml(String(record.rate))}</td>
                    <td class="p-2.5 text-right font-semibold tabular-nums text-gray-800">${escHtml(record.total)}</td>
                    <td class="p-2.5 text-gray-400 font-mono text-[11px]">${escHtml(record.refNo)}</td>
                </tr>`).join('');

        const pageButtons = totalPages <= 10
            ? Array.from({ length: totalPages }, (_, i) => i + 1)
            : Array.from({ length: 5 }, (_, i) =>
                Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i
              );

        const paginationBar = total > itemsPerPage ? `
            <div class="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs">
                <span class="text-gray-500">Showing ${startIdx + 1}–${endIdx} of ${total}</span>
                <div class="flex items-center gap-1">
                    <button id="prev-page" class="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            ${currentPage === 1 ? 'disabled' : ''}>‹</button>
                    ${pageButtons.map(page => `
                        <button class="page-btn px-2.5 py-1 rounded border transition-colors
                            ${page === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-100'}"
                            data-page="${page}">${page}</button>`).join('')}
                    <button id="next-page" class="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            ${currentPage === totalPages ? 'disabled' : ''}>›</button>
                </div>
            </div>` : '';

        content.innerHTML = `
            <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                <div>
                    <h3 class="font-bold text-base text-gray-800">${escHtml(stock.item)} — History</h3>
                    <p class="text-xs text-gray-500 mt-0.5">
                        Party: <strong>${escHtml(state.selectedParty.firm)}</strong>
                        ${total > 0 ? `<span class="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-mono">${total} records</span>` : ''}
                    </p>
                </div>
                <button id="close-modal"
                        class="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-xl">&times;</button>
            </div>

            <div class="flex-1 overflow-y-auto">
                <table class="w-full text-left border-collapse text-xs">
                    <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 border-b border-gray-200">
                        <tr>
                            <th class="p-2.5">Date</th>
                            <th class="p-2.5">Batch</th>
                            <th class="p-2.5 text-right">Qty</th>
                            <th class="p-2.5 text-right">Rate</th>
                            <th class="p-2.5 text-right">Total</th>
                            <th class="p-2.5">Ref No</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-50">${rows}</tbody>
                </table>
            </div>
            ${paginationBar}
        `;

        document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');
        document.getElementById('prev-page')?.addEventListener('click', () => {
            if (pagination.currentPage > 1) { pagination.currentPage--; renderPage(); }
        });
        document.getElementById('next-page')?.addEventListener('click', () => {
            if (pagination.currentPage < totalPages) { pagination.currentPage++; renderPage(); }
        });
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                pagination.currentPage = parseInt(e.currentTarget.dataset.page);
                renderPage();
            });
        });
    }

    renderPage();
}