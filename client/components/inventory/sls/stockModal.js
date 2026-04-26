/**
 * STOCK MODAL COMPONENT
 * Handles stock selection modal with search, filtering, and batch handling
 */

import { escHtml } from './utils.js';

export function openStockModal(state, callbacks) {
    const { onSelectStock, onCreateStock, onEditStock, onViewHistory } = callbacks;
    const modal   = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');

    content.innerHTML = `
        <div class="p-3 border-b border-gray-200 bg-white flex justify-between items-center gap-3">
            <h3 class="font-bold text-sm text-gray-800 shrink-0 uppercase tracking-wide">Item Selection</h3>
            <div class="flex items-center gap-2 flex-1 justify-end">
                <div class="relative flex-1 max-w-sm">
                    <input type="text" id="stock-search"
                           placeholder="Search item, batch, OEM, HSN…"
                           class="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none shadow-sm">
                    <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                </div>
                <button id="btn-create-stock"
                        class="shrink-0 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    New Item
                </button>
                <button id="close-modal"
                        class="shrink-0 text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">&times;</button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto">
            <table class="w-full text-left border-collapse">
                <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 border-b border-gray-200 z-10">
                    <tr>
                        <th class="p-2.5">Item Description</th>
                        <th class="p-2.5">Batch / Batches</th>
                        <th class="p-2.5">OEM</th>
                        <th class="p-2.5 text-right">Available</th>
                        <th class="p-2.5 text-right">Rate</th>
                        <th class="p-2.5 text-right">GST%</th>
                        <th class="p-2.5 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody class="text-xs divide-y divide-gray-100 bg-white" id="stock-list-body"></tbody>
            </table>
        </div>
    `;

    renderStockRows(state.stocks, state, callbacks);

    const searchInput = document.getElementById('stock-search');
    if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', e => {
            const term = e.target.value.toLowerCase();
            const filtered = state.stocks.filter(s =>
                (s.item  && s.item.toLowerCase().includes(term)) ||
                (s.batch && s.batch.toLowerCase().includes(term)) ||
                (s.oem   && s.oem.toLowerCase().includes(term))  ||
                (s.hsn   && s.hsn.toLowerCase().includes(term))  ||
                (Array.isArray(s.batches) && s.batches.some(b =>
                    (b.batch  && b.batch.toLowerCase().includes(term)) ||
                    (b.expiry && b.expiry.toLowerCase().includes(term))
                ))
            );
            renderStockRows(filtered, state, callbacks);
        });
    }

    document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-create-stock').onclick = () => {
        modal.classList.add('hidden');
        onCreateStock();
    };
}

function renderStockRows(data, state, callbacks) {
    const { onSelectStock, onEditStock, onViewHistory } = callbacks;
    const tbody = document.getElementById('stock-list-body');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="p-12 text-center text-gray-300 italic text-sm">
                No items match your search.
            </td></tr>`;
        return;
    }

    // FIX: Store only the stock ID in the DOM attribute.
    // Original: JSON.stringify(stock) embedded in data-stock attribute — items with
    // names containing " (e.g. '24" Monitor') produced malformed HTML attributes,
    // causing JSON.parse on click to throw and ADD+ to silently fail.
    // Fix: store only the ID, look up the full object from state.stocks on click.
    tbody.innerHTML = data.map(stock => {
        const stockId = String(stock.id || stock._id || '');

        const batchLabel = Array.isArray(stock.batches) && stock.batches.length > 0
            ? stock.batches.length === 1
                ? `<span class="font-mono">${escHtml(stock.batches[0].batch || 'No Batch')}</span>`
                : `<span class="bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded text-[10px] font-mono">${stock.batches.length} batches</span>`
            : `<span class="text-gray-400">—</span>`;

        const qtyClass = (Number(stock.qty) || 0) > 0 ? 'text-emerald-600' : 'text-red-500';

        return `
            <tr class="hover:bg-blue-50/40 transition-colors group" data-stock-id="${escHtml(stockId)}">
                <td class="p-2.5 font-semibold text-blue-900 max-w-[200px]">
                    <div class="truncate" title="${escHtml(stock.item)}">${escHtml(stock.item)}</div>
                    ${stock.pno ? `<div class="text-[10px] text-gray-400 font-normal font-mono">${escHtml(stock.pno)}</div>` : ''}
                </td>
                <td class="p-2.5">${batchLabel}</td>
                <td class="p-2.5 text-gray-400 text-[11px]">${escHtml(stock.oem || '—')}</td>
                <td class="p-2.5 text-right font-bold ${qtyClass} tabular-nums">
                    ${escHtml(String(stock.qty))} <span class="font-normal text-[10px]">${escHtml(stock.uom)}</span>
                </td>
                <td class="p-2.5 text-right font-mono tabular-nums text-gray-700">${escHtml(String(stock.rate))}</td>
                <td class="p-2.5 text-right text-gray-500">${escHtml(String(stock.grate))}%</td>
                <td class="p-2.5">
                    <div class="flex items-center justify-center gap-1">
                        <button class="btn-edit-stock px-2 py-1 border border-gray-200 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-100 transition-colors">
                            EDIT
                        </button>
                        <button class="btn-history-stock px-2 py-1 border border-amber-200 text-amber-700 rounded text-[10px] font-bold hover:bg-amber-50 transition-colors">
                            HIST
                        </button>
                        <button class="btn-select-stock px-2.5 py-1 border border-blue-200 bg-blue-50 text-blue-700 rounded text-[10px] font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors">
                            ADD +
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Helper: look up full stock object from state by the ID stored in the row
    const lookupStock = (el) => {
        const id = el.closest('tr').dataset.stockId;
        return state.stocks.find(s => String(s.id || s._id || '') === id) || null;
    };

    tbody.querySelectorAll('.btn-select-stock').forEach(btn => {
        btn.addEventListener('click', async e => {
            const stock = lookupStock(e.currentTarget);
            if (!stock) return;

            if (Array.isArray(stock.batches) && stock.batches.length > 1) {
                await onSelectStock(stock, true);
            } else if (Array.isArray(stock.batches) && stock.batches.length === 1) {
                const b = stock.batches[0];
                await onSelectStock({ ...stock, batch: b.batch, qty: b.qty, rate: b.rate }, false);
            } else {
                await onSelectStock(stock, false);
            }
            document.getElementById('modal-backdrop')?.classList.add('hidden');
        });
    });

    tbody.querySelectorAll('.btn-edit-stock').forEach(btn => {
        btn.addEventListener('click', e => {
            const stock = lookupStock(e.currentTarget);
            if (stock) onEditStock(stock);
        });
    });

    tbody.querySelectorAll('.btn-history-stock').forEach(btn => {
        btn.addEventListener('click', e => {
            const stock = lookupStock(e.currentTarget);
            if (stock) onViewHistory(stock);
        });
    });
}