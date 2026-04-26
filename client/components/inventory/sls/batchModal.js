/**
 * BATCH MODAL COMPONENT
 * Handles batch selection when a stock item has multiple batches
 */

import { escHtml } from './utils.js';

export async function showBatchSelectionModal(stock, onSelectBatch) {
    const subModal   = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');

    const batches = stock.batches || [];

    // FIX: All batch data escaped with escHtml before innerHTML interpolation
    subContent.innerHTML = `
        <div class="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center text-white">
            <div>
                <h3 class="font-bold text-sm tracking-wide">Select Batch</h3>
                <p class="text-slate-400 text-[10px] mt-0.5 truncate max-w-xs">${escHtml(stock.item)}</p>
            </div>
            <button id="close-sub-modal"
                    class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center">&times;</button>
        </div>

        <div class="p-4 space-y-2.5 max-h-96 overflow-y-auto bg-gray-50">
            ${batches.length === 0
                ? `<div class="text-center text-gray-400 py-8 italic text-sm">No batch information available.</div>`
                : batches.map((batch, idx) => `
                    <div class="batch-option p-3 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/60
                                hover:shadow-sm cursor-pointer transition-all bg-white group"
                         data-batch-idx="${idx}">
                        <div class="flex justify-between items-start gap-3">
                            <div class="min-w-0 flex-1">
                                <div class="font-bold text-gray-800 group-hover:text-blue-800">${escHtml(batch.batch || 'No Batch')}</div>
                                <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-500 mt-1.5">
                                    <span>Qty: <strong class="text-gray-700">${escHtml(String(batch.qty))} ${escHtml(stock.uom)}</strong></span>
                                    <span>Rate: <strong class="text-gray-700">₹${escHtml(String(batch.rate))}</strong></span>
                                    ${batch.expiry
                                        ? `<span>Expiry: <strong class="text-gray-700">${escHtml(batch.expiry)}</strong></span>`
                                        : ''}
                                    ${batch.mrp
                                        ? `<span>MRP: <strong class="text-gray-700">₹${escHtml(String(batch.mrp))}</strong></span>`
                                        : ''}
                                </div>
                            </div>
                            <div class="shrink-0 text-right">
                                <div class="text-[10px] text-gray-400 uppercase tracking-wide">Available</div>
                                <div class="font-bold text-lg ${Number(batch.qty) > 0 ? 'text-emerald-600' : 'text-red-500'}">${escHtml(String(batch.qty))}</div>
                            </div>
                        </div>
                    </div>`
                ).join('')
            }
        </div>
    `;

    document.getElementById('close-sub-modal').onclick = () => subModal.classList.add('hidden');

    document.querySelectorAll('.batch-option').forEach(option => {
        option.addEventListener('click', e => {
            const batchIdx      = parseInt(e.currentTarget.getAttribute('data-batch-idx'));
            const selectedBatch = batches[batchIdx];
            onSelectBatch({ ...stock, batch: selectedBatch.batch, qty: selectedBatch.qty, rate: selectedBatch.rate, expiry: selectedBatch.expiry });
            subModal.classList.add('hidden');
        });
    });
}