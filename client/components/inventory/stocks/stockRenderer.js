/**
 * STOCK RENDERER MODULE
 * Handles all UI rendering for stock management
 */

import { deleteStock } from './stockApi.js';
import { showToast } from '../sls/toast.js';

export function renderStocksTable(stocks, container, state) {
    const contentContainer = document.getElementById('stocks-content');
    if (!contentContainer) return;

    if (stocks.length === 0) {
        contentContainer.innerHTML = `
            <div class="text-center py-12 bg-white rounded-lg border border-gray-200">
                <i class="fas fa-box-open text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">No Stocks Found</h3>
                <p class="text-gray-500 mb-4">Get started by adding your first stock item</p>
                <button id="stocks-add-first-button" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-plus mr-2"></i>Add Stock
                </button>
            </div>
        `;
        
        // Attach event listener to add first stock button
        document.getElementById('stocks-add-first-button')?.addEventListener('click', () => {
            if (window.stocksSystem && window.stocksSystem.openStockModal) {
                window.stocksSystem.openStockModal();
            }
        });
        return;
    }

    contentContainer.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200" id="stocks-table">
                    <thead class="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white">
                        <tr>
                            <th class="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider w-16">Actions</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Item</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Batch</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">HSN</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Quantity</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Rate</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Total Value</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${stocks.map(stock => renderStockTableRow(stock, state)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Attach event listeners to table action buttons
    setTimeout(() => {
        attachTableEventListeners(state);
    }, 0);
}

function attachTableEventListeners(state) {
    // Store state reference globally for modal functions
    window.stocksSystem.state = state;
    
    // Add event listeners to all action buttons
    document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const action = button.dataset.action;
            const stockId = button.dataset.stockId; // Use ObjectId string directly
            
            // Find the stock data from the current state's stocks array
            const stockData = window.stocksSystem.state.stocks.find(s => s.id === stockId);

            switch (action) {
                case 'edit':
                    if (window.stocksSystem && window.stocksSystem.openStockModal) {
                        window.stocksSystem.openStockModal(stockData);
                    }
                    break;
                case 'view':
                    if (window.stocksSystem && window.stocksSystem.viewStockDetails) {
                        window.stocksSystem.viewStockDetails(stockId);
                    }
                    break;
                case 'delete':
                    if (window.stocksSystem && window.stocksSystem.deleteStockItem) {
                        window.stocksSystem.deleteStockItem(stockId);
                    }
                    break;
            }
        });
    });

    // Add event listeners for expand/collapse buttons
    document.querySelectorAll('.expand-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const stockId = button.dataset.stockId;
            
            const nestedRow = document.querySelector(`.nested-row[data-stock-id="${stockId}"]`);
            const icon = button.querySelector('svg');
            
            if (nestedRow) {
                const isHidden = nestedRow.classList.contains('hidden');
                
                if (isHidden) {
                    nestedRow.classList.remove('hidden');
                    if (icon) icon.classList.add('rotate-180');
                } else {
                    nestedRow.classList.add('hidden');
                    if (icon) icon.classList.remove('rotate-180');
                }
            }
        });
    });
}

function renderBatchNestedRow(stock, batches) {
    return `
        <tr class="nested-row hidden bg-gray-50" data-stock-id="${stock.id}">
            <td colspan="9" class="px-6 py-4">
                <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div class="px-4 py-3 bg-gray-100 border-b border-gray-200">
                        <h4 class="text-sm font-medium text-gray-700">Batch Details</h4>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 text-white">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">Batch No</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">Quantity</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">Rate</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">Total Value</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">MRP</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">Expiry Date</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${batches.map(batch => `
                                    <tr class="hover:bg-gray-50">
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${batch.batch || '-'}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${batch.qty || 0} ${stock.uom || 'PCS'}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">₹${(batch.rate || 0).toFixed(2)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">₹${((batch.qty || 0) * (batch.rate || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${batch.mrp ? '₹' + parseFloat(batch.mrp).toFixed(2) : '-'}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${batch.expiry ? new Date(batch.expiry).toLocaleDateString('en-IN') : '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function renderStockTableRow(stock, state) {
    const isLowStock = stock.qty <= 10;
    const statusColor = isLowStock ? 'yellow' : 'green';
    const statusText = isLowStock ? 'Low Stock' : 'In Stock';
    
    // Handle batches - could be object or string
    let batches = [];
    if (stock.batches) {
        if (typeof stock.batches === 'string') {
            try {
                batches = JSON.parse(stock.batches);
            } catch (e) {
                batches = [];
            }
        } else if (Array.isArray(stock.batches)) {
            batches = stock.batches;
        }
    }

    const hasBatches = batches.length > 0;
    const expandButton = hasBatches ? 
        `<button class="expand-btn bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 p-2 rounded border border-blue-200 hover:border-blue-300 transition-all" data-stock-id="${stock.id}" title="Expand to view batch details">
            <svg class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
         </button>` : '';

    return `
        <tr class="hover:bg-gray-50 main-row" data-stock-id="${stock.id}">
            <td class="px-3 py-4 whitespace-nowrap text-center">
                ${expandButton}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div>
                    <div class="text-sm font-medium text-gray-900">${stock.item}</div>
                    ${stock.oem ? `<div class="text-xs text-gray-500">${stock.oem}</div>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                    ${stock.batch || '-'}
                    ${batches.length > 0 ? `<span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${batches.length} batches</span>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${stock.hsn || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${stock.qty || 0} ${stock.uom || 'PCS'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹${(stock.rate || 0).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">₹${(stock.total || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${statusColor}-100 text-${statusColor}-800">
                    ${statusText}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex gap-2">
                    <button data-action="edit" data-stock-id="${stock.id}" 
                        class="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition-colors" title="Edit stock">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button data-action="view" data-stock-id="${stock.id}" 
                        class="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition-colors" title="View details">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                    </button>
                    <button data-action="delete" data-stock-id="${stock.id}" 
                        class="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-colors" title="Delete stock">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
        ${hasBatches ? renderBatchNestedRow(stock, batches) : ''}
    `;
}

export function renderStockCards(stocks, container, state) {
    const contentContainer = document.getElementById('stocks-content');
    if (!contentContainer) return;

    if (stocks.length === 0) {
        contentContainer.innerHTML = `
            <div class="text-center py-12 bg-white rounded-lg border border-gray-200">
                <i class="fas fa-box-open text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">No Stocks Found</h3>
                <p class="text-gray-500 mb-4">Get started by adding your first stock item</p>
                <button id="stocks-add-card-button" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-plus mr-2"></i>Add Stock
                </button>
            </div>
        `;
        
        // Attach event listener to add stock button in card view
        document.getElementById('stocks-add-card-button')?.addEventListener('click', () => {
            if (window.stocksSystem && window.stocksSystem.openStockModal) {
                window.stocksSystem.openStockModal();
            }
        });
        return;
    }

    contentContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            ${stocks.map(stock => renderStockCard(stock, state)).join('')}
        </div>
    `;

    // Attach event listeners to card action buttons
    attachCardEventListeners(state);
}

function attachCardEventListeners(state) {
    // Store state reference globally for modal functions
    window.stocksSystem.state = state;
    
    // Add event listeners to all card action buttons
    document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const action = button.dataset.action;
            const stockId = parseInt(button.dataset.stockId);
            
            // Find the stock data from the current state's stocks array
            const stockData = window.stocksSystem.state.stocks.find(s => s.id === stockId);

            switch (action) {
                case 'edit':
                    if (window.stocksSystem && window.stocksSystem.openStockModal) {
                        window.stocksSystem.openStockModal(stockData);
                    }
                    break;
                case 'view':
                    if (window.stocksSystem && window.stocksSystem.viewStockDetails) {
                        window.stocksSystem.viewStockDetails(stockId);
                    }
                    break;
                case 'delete':
                    if (window.stocksSystem && window.stocksSystem.deleteStockItem) {
                        window.stocksSystem.deleteStockItem(stockId);
                    }
                    break;
            }
        });
    });
}

function renderStockCard(stock, state) {
    const isLowStock = stock.qty <= 10;
    const statusColor = isLowStock ? 'yellow' : 'green';
    const statusText = isLowStock ? 'Low Stock' : 'In Stock';
    
    // Handle batches - could be object or string
    let batches = [];
    if (stock.batches) {
        if (typeof stock.batches === 'string') {
            try {
                batches = JSON.parse(stock.batches);
            } catch (e) {
                batches = [];
            }
        } else if (Array.isArray(stock.batches)) {
            batches = stock.batches;
        }
    }

    return `
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                    <h3 class="font-semibold text-gray-900 text-sm mb-1">${stock.item}</h3>
                    ${stock.oem ? `<p class="text-xs text-gray-500">${stock.oem}</p>` : ''}
                </div>
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${statusColor}-100 text-${statusColor}-800">
                    ${statusText}
                </span>
            </div>
            
            <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-500">Batch:</span>
                    <span class="text-gray-900">${stock.batch || '-'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500">HSN:</span>
                    <span class="text-gray-900">${stock.hsn || '-'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500">Quantity:</span>
                    <span class="font-medium text-gray-900">${stock.qty || 0} ${stock.uom || 'PCS'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500">Rate:</span>
                    <span class="text-gray-900">₹${(stock.rate || 0).toFixed(2)}</span>
                </div>
                <div class="flex justify-between font-semibold">
                    <span class="text-gray-700">Total Value:</span>
                    <span class="text-gray-900">₹${(stock.total || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
            </div>
            
            ${batches.length > 0 ? `
                <div class="mt-3 pt-3 border-t border-gray-100">
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        ${batches.length} batch${batches.length > 1 ? 'es' : ''}
                    </span>
                </div>
            ` : ''}
            
            <div class="mt-4 flex gap-2">
                <button data-action="view" data-stock-id="${stock.id}" 
                    class="flex-1 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                    <i class="fas fa-eye mr-1"></i>View
                </button>
                <button data-action="edit" data-stock-id="${stock.id}" 
                    class="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                    <i class="fas fa-edit mr-1"></i>Edit
                </button>
                <button data-action="delete" data-stock-id="${stock.id}" 
                    class="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// Expose modal functions to global scope
window.stocksSystem = window.stocksSystem || {};
window.stocksSystem.closeStockModal = () => {
    const modal = document.getElementById('stock-modal');
    if (modal) {
        modal.remove();
    }
};

export function renderStockModal(stock, state, onSave) {
    const isEdit = !!stock;
    const modalHtml = `
        <div id="stock-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="relative bg-white rounded-lg shadow-xl w-full max-w-[95vw] lg:max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="flex items-center justify-between p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
                    <div>
                        <h3 class="text-base font-bold text-gray-900">
                            ${isEdit ? 'Edit Stock Item' : 'Add New Stock Item'}
                        </h3>
                        <p class="text-xs text-gray-600 mt-1">
                            ${isEdit ? 'Update stock details' : 'Add stock with batches'}
                        </p>
                    </div>
                    <button id="stock-modal-close" class="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Form Content -->
                <div class="p-3 overflow-y-auto flex-1">
                    <form id="stock-form" class="space-y-3">
                        <!-- Common Item Information -->
                        <div class="bg-gray-50 p-2 rounded border border-gray-200">
                            <h4 class="text-xs font-semibold text-gray-900 mb-2 flex items-center">
                                <i class="fas fa-info-circle text-blue-600 mr-1"></i>
                                Item Info
                            </h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <!-- Item Description -->
                                <div class="md:col-span-2">
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">
                                        Item Description <span class="text-red-500">*</span>
                                    </label>
                                    <input type="text" name="item" required
                                        value="${stock?.item || ''}"
                                        placeholder="Item description"
                                        class="w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm">
                                </div>

                                <!-- Part No -->
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">Part No</label>
                                    <input type="text" name="pno"
                                        value="${stock?.pno || ''}"
                                        placeholder="Part number"
                                        class="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm">
                                </div>

                                <!-- OEM / Brand -->
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">OEM/Brand</label>
                                    <input type="text" name="oem"
                                        value="${stock?.oem || ''}"
                                        placeholder="OEM or brand"
                                        class="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm">
                                </div>

                                <!-- HSN/SAC Code -->
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">
                                        HSN Code <span class="text-red-500">*</span>
                                    </label>
                                    <input type="text" name="hsn" required
                                        value="${stock?.hsn || ''}"
                                        placeholder="HSN/SAC code"
                                        class="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm">
                                </div>
                            </div>
                        </div>

                        <!-- Batch Management Section -->
                        <div class="bg-blue-50 p-2 rounded border border-blue-200">
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="text-xs font-semibold text-gray-900 flex items-center">
                                    <i class="fas fa-boxes text-blue-600 mr-1"></i>
                                    Batch Management
                                    <span class="ml-1 text-xs font-normal text-orange-600 font-medium">(Required)</span>
                                </h4>
                                <div class="flex items-center gap-1">
                                    <span class="text-xs text-gray-600">Total Qty:</span>
                                    <span id="total-quantity-display" class="font-semibold text-blue-600 text-xs">0</span>
                                </div>
                            </div>

                            <div class="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                                <div class="flex items-start gap-2">
                                    <i class="fas fa-info-circle text-yellow-600 text-xs mt-0.5"></i>
                                    <div class="text-xs text-yellow-800">
                                        <p class="font-medium">Required: At least one batch must be added</p>
                                        <p class="text-xs mt-1">• Enter quantity, rate, and GST for each batch</p>
                                        <p class="text-xs">• Batch number is optional - leave empty if no batch tracking</p>
                                        <p class="text-xs">• MRP and expiry date are optional</p>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white border border-gray-200 rounded overflow-hidden">
                                <div class="overflow-x-auto">
                                    <table class="min-w-full divide-y divide-gray-200 text-xs" id="batches-table">
                                        <thead class="bg-gray-100">
                                            <tr>
                                                <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase w-[120px]">Batch (Optional)</th>
                                                <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase w-[80px]">Qty *</th>
                                                <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase w-[70px]">UOM *</th>
                                                <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase w-[100px]">Rate *</th>
                                                <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase w-[80px]">GST *</th>
                                                <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase w-[100px]">MRP</th>
                                                <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase w-[120px]">Expiry</th>
                                                <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase w-[100px]">Total</th>
                                                <th class="px-3 py-2 text-center font-medium text-gray-500 uppercase w-[60px]">Del</th>
                                            </tr>
                                        </thead>
                                        <tbody class="bg-white divide-y divide-gray-200" id="batches-tbody">
                                            <!-- Batch rows will be added here -->
                                        </tbody>
                                    </table>
                                </div>

                                <!-- Add Batch Button -->
                                <div class="p-2 bg-gray-50 border-t border-gray-200">
                                    <button type="button" id="add-batch-btn"
                                        class="w-full px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs">
                                        <i class="fas fa-plus mr-1"></i>Add First Batch
                                    </button>
                                    <p class="text-xs text-gray-500 mt-1 text-center">
                                        Start by adding your first batch (required)
                                    </p>
                                </div>

                                <!-- Empty state -->
                                <div id="batches-empty-state" class="text-center py-4 text-gray-500">
                                    <i class="fas fa-boxes text-2xl mb-1 text-gray-300"></i>
                                    <p class="text-xs font-medium">No batches added yet</p>
                                    <p class="text-xs">Click "Add First Batch" to start</p>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Footer -->
                <div class="flex justify-end gap-2 p-3 border-t border-gray-200 bg-gray-50">
                    <button type="button" id="stock-modal-cancel"
                        class="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded">
                        Cancel
                    </button>
                    <button type="submit" form="stock-form"
                        class="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded">
                        ${isEdit ? 'Update' : 'Add'}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Initialize batches array
    let batches = [];

    // If editing, load existing batches or create from legacy data
    if (stock) {
        if (stock.batches && Array.isArray(stock.batches) && stock.batches.length > 0) {
            // Use existing batches with migration for missing fields
            batches = stock.batches.map((batch, idx) => {
                // Migrate batch to include missing fields
                const migratedBatch = {
                    _id: batch._id,
                    batch: batch.batch || '',
                    qty: parseFloat(batch.qty) || 0,
                    uom: batch.uom || stock.uom || 'PCS', // Fallback to main stock UOM
                    rate: parseFloat(batch.rate) || 0,
                    grate: batch.grate !== undefined ? parseFloat(batch.grate) : (stock.grate || 18), // Fallback to main stock GST
                    expiry: batch.expiry || null,
                    mrp: batch.mrp ? parseFloat(batch.mrp) : null
                };
                return migratedBatch;
            });
        } else if (stock.qty && stock.rate) {
            // Convert legacy single-item data to batch format
            batches = [{
                batch: stock.batch || '',
                qty: parseFloat(stock.qty) || 0,
                uom: stock.uom || 'PCS',
                rate: parseFloat(stock.rate) || 0,
                grate: parseFloat(stock.grate) || 0,
                mrp: stock.mrp ? parseFloat(stock.mrp) : null,
                expiry: stock.expiry || null
            }];
        }
    }

    // If no batches exist (new item), start with one empty batch
    if (batches.length === 0) {
        batches = [{
            batch: '',
            qty: 0,
            uom: 'PCS',
            rate: 0,
            grate: 18, // Default GST
            mrp: null,
            expiry: null
        }];
    }

    // Function to render a batch row
    function renderBatchRow(batch, index) {
        const total = (batch.qty || 0) * (batch.rate || 0);
        
        return `
            <tr class="batch-row hover:bg-gray-50" data-index="${index}">
                <td class="px-3 py-2 whitespace-nowrap">
                    <input type="text" value="${batch.batch || ''}"
                        class="batch-input w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                        placeholder="Optional: Leave empty if no batch" data-field="batch">
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <input type="number" step="0.01" value="${batch.qty || ''}" required
                        class="batch-input w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                        placeholder="Qty" data-field="qty">
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <select class="batch-input w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs" required data-field="uom">
                        <option value="">UOM</option>
                        <option value="NOS" ${batch.uom == 'NOS' ? 'selected' : ''}>NOS</option>
                        <option value="PCS" ${batch.uom == 'PCS' ? 'selected' : ''}>PCS</option>
                        <option value="SET" ${batch.uom == 'SET' ? 'selected' : ''}>SET</option>
                        <option value="BOX" ${batch.uom == 'BOX' ? 'selected' : ''}>BOX</option>
                        <option value="MTR" ${batch.uom == 'MTR' ? 'selected' : ''}>MTR</option>
                        <option value="KGS" ${batch.uom == 'KGS' ? 'selected' : ''}>KGS</option>
                    </select>
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <input type="number" step="0.01" value="${batch.rate || ''}" required
                        class="batch-input w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                        placeholder="Rate" data-field="rate">
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <select class="batch-input w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs" required data-field="grate">
                        <option value="">GST%</option>
                        <option value="18" ${batch.grate == 18 ? 'selected' : ''}>18%</option>
                        <option value="12" ${batch.grate == 12 ? 'selected' : ''}>12%</option>
                        <option value="5" ${batch.grate == 5 ? 'selected' : ''}>5%</option>
                        <option value="28" ${batch.grate == 28 ? 'selected' : ''}>28%</option>
                        <option value="0" ${batch.grate == 0 ? 'selected' : ''}>0%</option>
                    </select>
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <input type="number" step="0.01" value="${batch.mrp || ''}"
                        class="batch-input w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                        placeholder="MRP" data-field="mrp">
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <input type="date" value="${batch.expiry ? new Date(batch.expiry).toISOString().split('T')[0] : ''}"
                        class="batch-input w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                        data-field="expiry">
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                    ₹${total.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-center">
                    <button type="button" class="delete-batch-btn text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                        data-index="${index}" title="Delete batch">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }

    // Function to update batches display
    function updateBatchesDisplay() {
        const tbody = document.getElementById('batches-tbody');
        const emptyState = document.getElementById('batches-empty-state');

        if (batches.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            updateTotalQuantity(0);
        } else {
            emptyState.classList.add('hidden');
            tbody.innerHTML = batches.map((batch, index) => renderBatchRow(batch, index)).join('');

            // Attach input event listeners for real-time total calculation
            document.querySelectorAll('.batch-input').forEach(input => {
                // Handle both input and change events for comprehensive coverage
                const handleFieldChange = (e) => {
                    const row = e.target.closest('.batch-row');
                    const index = parseInt(row.dataset.index);
                    const field = e.target.dataset.field;

                    // Update batch data with strict consistency
                    if (field === 'qty' || field === 'rate' || field === 'mrp') {
                        // Numeric fields: parse as float, fallback to 0
                        batches[index][field] = parseFloat(e.target.value) || 0;
                    } else if (field === 'grate') {
                        // GST rate: parse as float, fallback to 0
                        batches[index][field] = parseFloat(e.target.value) || 0;
                    } else if (field === 'uom') {
                        // UOM: handle as string value, ensure it's not empty
                        batches[index][field] = e.target.value || 'PCS';
                    } else {
                        // Other fields: handle as string values
                        batches[index][field] = e.target.value;
                    }

                    // Recalculate total for this batch
                    const qty = parseFloat(batches[index].qty) || 0;
                    const rate = parseFloat(batches[index].rate) || 0;
                    const total = qty * rate;

                    // Update total display
                    const totalCell = row.querySelector('td:nth-child(8)');
                    totalCell.textContent = `₹${total.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

                    // Update overall total quantity
                    updateTotalQuantity();
                };

                // Add both input and change event listeners
                input.addEventListener('input', handleFieldChange);
                input.addEventListener('change', handleFieldChange);
            });

            // Attach delete button listeners
            document.querySelectorAll('.delete-batch-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.closest('button').dataset.index);

                    // Add confirmation dialog
                    if (confirm('Are you sure you want to remove this batch?')) {
                        batches.splice(index, 1);
                        updateBatchesDisplay();
                    }
                });
            });

            // Update total quantity display
            updateTotalQuantity();
        }
    }

    // Function to update total quantity display
    function updateTotalQuantity() {
        const totalQty = batches.reduce((sum, batch) => sum + (parseFloat(batch.qty) || 0), 0);
        const display = document.getElementById('total-quantity-display');
        if (display) {
            display.textContent = totalQty.toLocaleString('en-IN');
        }
    }

    // Initialize batches display
    updateBatchesDisplay();

    // Add batch button event listener
    document.getElementById('add-batch-btn')?.addEventListener('click', () => {
        batches.push({
            batch: '',
            qty: 0,
            uom: 'PCS',
            rate: 0,
            grate: 18, // Default GST
            mrp: null,
            expiry: null
        });
        updateBatchesDisplay();
        
        // Update button text after first batch is added
        const addBtn = document.getElementById('add-batch-btn');
        if (batches.length > 1) {
            addBtn.innerHTML = '<i class="fas fa-plus mr-1"></i>Add Another Batch';
            addBtn.nextElementSibling.textContent = 'Add more batches if needed';
        }
    });

    // Attach event listeners to modal buttons
    document.getElementById('stock-modal-close')?.addEventListener('click', () => {
        const modal = document.getElementById('stock-modal');
        if (modal) {
            modal.remove();
        }
    });

    document.getElementById('stock-modal-cancel')?.addEventListener('click', () => {
        const modal = document.getElementById('stock-modal');
        if (modal) {
            modal.remove();
        }
    });

    // Handle form submission
    const form = document.getElementById('stock-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate that at least one batch exists
        if (batches.length === 0) {
            alert('Please add at least one batch to create a stock item. Click "Add First Batch" to begin.');
            return;
        }

        // Validate that all batches have required fields
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`Validating batch ${i + 1}:`, batch);
            
            if (!batch.qty || batch.qty <= 0) {
                alert(`Batch ${i + 1}: Quantity is required and must be greater than 0.`);
                return;
            }
            if (!batch.uom || batch.uom === '') {
                alert(`Batch ${i + 1}: UOM is required.`);
                return;
            }
            if (!batch.rate || batch.rate < 0) {
                alert(`Batch ${i + 1}: Rate is required and must be >= 0.`);
                return;
            }
            if (batch.grate === undefined || batch.grate === null || batch.grate === '') {
                alert(`Batch ${i + 1}: GST % is required.`);
                return;
            }
        }

        // Log final batch data before submission
        console.log('Final batch data for submission:', batches);

        const formData = new FormData(form);
        const stockData = {
            item: formData.get('item'),
            pno: formData.get('pno'),
            oem: formData.get('oem'),
            hsn: formData.get('hsn'),
            // Calculate aggregated values from batches for backward compatibility
            qty: batches.reduce((sum, batch) => sum + (parseFloat(batch.qty) || 0), 0),
            uom: batches[0]?.uom || 'PCS', // Use first batch's UOM as primary
            rate: batches.length > 0 ? batches.reduce((sum, batch) => sum + (parseFloat(batch.rate) || 0), 0) / batches.length : 0, // Average rate
            grate: batches[0]?.grate || 0, // Use first batch's GST
            total: batches.reduce((sum, batch) => sum + ((parseFloat(batch.qty) || 0) * (parseFloat(batch.rate) || 0)), 0),
            mrp: batches.length > 0 ? Math.max(...batches.map(b => parseFloat(b.mrp) || 0).filter(m => m > 0)) : null, // Max MRP from batches
            batches: batches.length > 0 ? batches : null
        };

        // Log complete submission data for debugging
        console.log('=== FORM SUBMISSION DEBUG ===');
        console.log('Form data:', Object.fromEntries(formData.entries()));
        console.log('Batches array:', batches);
        console.log('Final stock data:', stockData);
        console.log('==========================');

        await onSave(stockData);
        const modal = document.getElementById('stock-modal');
        if (modal) {
            modal.remove();
        }
    });

    // Close modal on backdrop click
    document.getElementById('stock-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'stock-modal') {
            const modal = document.getElementById('stock-modal');
            if (modal) {
                modal.remove();
            }
        }
    });
}

// Expose modal functions to global scope
window.stocksSystem = window.stocksSystem || {};
window.stocksSystem.closeStockModal = () => {
    const modal = document.getElementById('stock-modal');
    if (modal) {
        modal.remove();
    }
};

window.stocksSystem.viewStockDetails = (stockId) => {
    const stock = window.stocksSystem?.state?.stocks?.find(s => s.id === stockId);
    if (!stock) return;
    
    // Handle batches - could be object or string
    let batches = [];
    if (stock.batches) {
        if (typeof stock.batches === 'string') {
            try {
                batches = JSON.parse(stock.batches);
            } catch (e) {
                batches = [];
            }
        } else if (Array.isArray(stock.batches)) {
            batches = stock.batches;
        }
    }
    
    // Create a simple details modal
    const detailsModal = `
        <div id="stock-details-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div class="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 class="text-xl font-bold text-gray-900">Stock Details</h3>
                    <button id="details-close-btn" class="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="p-6 overflow-y-auto flex-1">
                    <div class="space-y-6">
                        <!-- Basic Stock Information -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <span class="text-sm font-semibold text-gray-500">Item:</span>
                                <p class="text-gray-900 font-medium">${stock.item}</p>
                            </div>
                            <div>
                                <span class="text-sm font-semibold text-gray-500">Batch:</span>
                                <p class="text-gray-900">${stock.batch || '-'}</p>
                            </div>
                            <div>
                                <span class="text-sm font-semibold text-gray-500">HSN:</span>
                                <p class="text-gray-900">${stock.hsn || '-'}</p>
                            </div>
                            <div>
                                <span class="text-sm font-semibold text-gray-500">Quantity:</span>
                                <p class="text-gray-900 font-medium">${stock.qty} ${stock.uom || 'PCS'}</p>
                            </div>
                            <div>
                                <span class="text-sm font-semibold text-gray-500">Rate:</span>
                                <p class="text-gray-900">₹${stock.rate?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div>
                                <span class="text-sm font-semibold text-gray-500">Total Value:</span>
                                <p class="text-gray-900 font-semibold">₹${stock.total?.toLocaleString('en-IN', {minimumFractionDigits: 2}) || '0.00'}</p>
                            </div>
                        </div>
                        ${stock.oem ? `
                        <div>
                            <span class="text-sm font-semibold text-gray-500">OEM/Brand:</span>
                            <p class="text-gray-900">${stock.oem}</p>
                        </div>
                        ` : ''}
                        ${stock.mrp ? `
                        <div>
                            <span class="text-sm font-semibold text-gray-500">MRP:</span>
                            <p class="text-gray-900">₹${stock.mrp?.toFixed(2) || '0.00'}</p>
                        </div>
                        ` : ''}
                        ${stock.grate ? `
                        <div>
                            <span class="text-sm font-semibold text-gray-500">GST Rate:</span>
                            <p class="text-gray-900">${stock.grate}%</p>
                        </div>
                        ` : ''}
                        
                        <!-- Batch Information -->
                        ${batches.length > 0 ? `
                        <div class="mt-8">
                            <h4 class="text-lg font-semibold text-gray-900 mb-4">Batch Details (${batches.length} batch${batches.length > 1 ? 'es' : ''})</h4>
                            <div class="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                                <div class="overflow-x-auto">
                                    <table class="min-w-full divide-y divide-gray-200">
                                        <thead class="bg-gray-100">
                                            <tr>
                                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch No</th>
                                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate (₹)</th>
                                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP (₹)</th>
                                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (₹)</th>
                                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                                            </tr>
                                        </thead>
                                        <tbody class="bg-white divide-y divide-gray-200">
                                            ${batches.map(batch => `
                                                <tr class="hover:bg-gray-50">
                                                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${batch.batch || '-'}</td>
                                                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${batch.qty || 0} ${stock.uom || 'PCS'}</td>
                                                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">₹${(batch.rate || 0).toFixed(2)}</td>
                                                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${batch.mrp ? '₹' + parseFloat(batch.mrp).toFixed(2) : '-'}</td>
                                                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">₹${((batch.qty || 0) * (batch.rate || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${batch.expiry ? new Date(batch.expiry).toLocaleDateString('en-IN') : '-'}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="flex justify-end p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <button id="details-close-action" class="px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', detailsModal);
    
    // Attach event listeners
    const modal = document.getElementById('stock-details-modal');
    const closeBtn = document.getElementById('details-close-btn');
    const closeAction = document.getElementById('details-close-action');
    
    const removeModal = () => {
        if (modal) modal.remove();
    };
    
    closeBtn?.addEventListener('click', removeModal);
    closeAction?.addEventListener('click', removeModal);
    
    // Close on backdrop click
    modal?.addEventListener('click', (e) => {
        if (e.target.id === 'stock-details-modal') {
            removeModal();
        }
    });
};

window.stocksSystem.openStockModal = (stock, onSave) => {
    // Get the current state from the stocks system
    const state = window.stocksSystem.state;
    renderStockModal(stock, state, onSave);
};

window.stocksSystem.refresh = () => {
    // Trigger a refresh by calling the loadStocksData function
    if (window.stocksSystem && window.stocksSystem.loadStocksData) {
        window.stocksSystem.loadStocksData();
    }
};

window.stocksSystem.deleteStockItem = async (stockId) => {
    if (!confirm('Are you sure you want to delete this stock item?')) {
        return;
    }

    try {
        await deleteStock(stockId);
        showToast('Stock deleted successfully', 'success');
        window.stocksSystem.refresh();
    } catch (error) {
        showToast('Failed to delete stock: ' + error.message, 'error');
    }
};
