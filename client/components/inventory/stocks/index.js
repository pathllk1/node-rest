/**
 * STOCKS MANAGEMENT SYSTEM
 * Main orchestrator for stock management functionality
 */

import { fetchStocks, createStock, updateStock, deleteStock } from './stockApi.js';
import { renderStocksTable, renderStockCards, renderStockModal } from './stockRenderer.js';
import { showToast } from '../sls/toast.js';

export function initStocksSystem() {
    console.log('Stocks: Initializing Stock Management System...');

    // Load XLSX library if not already loaded
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = '/public/cdns/xlsx.full.min.js';
        script.onload = () => {
            console.log('XLSX library loaded successfully');
        };
        script.onerror = () => {
            console.error('Failed to load XLSX library');
        };
        document.head.appendChild(script);
    }

    const container = document.getElementById('stocks-system');
    if (!container) return;

    const state = {
        stocks: [],
        loading: false,
        searchQuery: '',
        filters: {
            category: '',
            lowStock: false
        },
        currentView: 'table', // 'table' or 'cards'
        selectedStock: null,
        // Sorting and pagination
        sortField: 'item',
        sortDirection: 'asc',
        currentPage: 1,
        itemsPerPage: 10
    };

    // Initialize the system
    renderMainLayout();
    loadStocksData();

    async function loadStocksData() {
        state.loading = true;
        updateDisplay(); // Show loading state immediately
        
        try {
            state.stocks = await fetchStocks();
            updateDisplay();
        } catch (error) {
            showToast('Failed to load stocks: ' + error.message, 'error');
            
            // Show error state
            const contentContainer = document.getElementById('stocks-content');
            if (contentContainer) {
                contentContainer.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-lg border border-red-200">
                        <svg class="w-16 h-16 text-red-300 mb-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                        <h3 class="text-xl font-semibold text-red-700 mb-2">Failed to Load Stocks</h3>
                        <p class="text-red-600 mb-4">${error.message}</p>
                        <button id="stocks-retry-button" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Try Again
                        </button>
                    </div>
                `;
                
                // Attach event listener to retry button
                document.getElementById('stocks-retry-button')?.addEventListener('click', () => {
                    loadStocksData();
                });
            }
        } finally {
            state.loading = false;
            updateDisplay();
        }
    }

    function renderMainLayout() {
        container.innerHTML = `
            <div class="stocks-management p-6">
                <!-- Header -->
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900">Stock Management</h1>
                        <p class="text-gray-600 mt-1">Manage your inventory and stock levels</p>
                    </div>
                    <div class="flex gap-3">
                        <button id="toggle-view-btn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>Toggle View
                        </button>
                        <button id="add-stock-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Add Stock
                        </button>
                        <button id="export-excel-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>Export to Excel
                        </button>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div id="stock-stats" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <!-- Stats will be rendered here -->
                </div>

                <!-- Controls -->
                <div class="flex flex-wrap gap-4 mb-6">
                    <div class="flex-1 min-w-[300px]">
                        <div class="relative">
                            <input type="text" id="search-input" placeholder="Search stocks..." 
                                class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" /></svg>
                        </div>
                    </div>
                    
                    <select id="category-filter" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">All Categories</option>
                        <option value="low">Low Stock</option>
                        <option value="high">High Value</option>
                    </select>
                    
                    <!-- Sort Controls -->
                    <select id="sort-field" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="item">Sort by Item</option>
                        <option value="batch">Sort by Batch</option>
                        <option value="qty">Sort by Quantity</option>
                        <option value="rate">Sort by Rate</option>
                        <option value="total">Sort by Total Value</option>
                    </select>
                    
                    <select id="sort-direction" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="asc">A-Z / Low-High</option>
                        <option value="desc">Z-A / High-Low</option>
                    </select>
                    
                    <!-- Items per page -->
                    <select id="items-per-page" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="5">5 per page</option>
                        <option value="10" selected>10 per page</option>
                        <option value="25">25 per page</option>
                        <option value="50">50 per page</option>
                    </select>
                    
                    <button id="refresh-btn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Refresh
                    </button>
                </div>

                <!-- Loading State -->
                <div id="loading-state" class="hidden text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p class="mt-2 text-gray-600">Loading stocks...</p>
                </div>

                <!-- Content Area -->
                <div id="stocks-content">
                    <!-- Stocks will be rendered here -->
                </div>
                
                <!-- Pagination -->
                <div id="pagination-controls" class="flex justify-between items-center mt-6">
                    <div class="text-sm text-gray-600">
                        Showing <span id="showing-from">1</span> to <span id="showing-to">10</span> of <span id="total-items">0</span> items
                    </div>
                    <div class="flex gap-2">
                        <button id="prev-page" class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg> Previous
                        </button>
                        <button id="next-page" class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">
                            Next <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        attachEventListeners();
        updateDisplay();
    }

    function attachEventListeners() {
        // Add stock button
        document.getElementById('add-stock-btn')?.addEventListener('click', () => {
            openStockModal();
        });

        // Toggle view button
        document.getElementById('toggle-view-btn')?.addEventListener('click', () => {
            state.currentView = state.currentView === 'table' ? 'cards' : 'table';
            updateDisplay();
        });

        // Export to Excel button
        document.getElementById('export-excel-btn')?.addEventListener('click', () => {
            exportToExcel();
        });

        // Search input
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            state.currentPage = 1; // Reset to first page
            updateDisplay();
        });

        // Category filter
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            state.filters.category = e.target.value;
            state.currentPage = 1; // Reset to first page
            state.searchQuery = ''; // Clear search query
            updateDisplay();
        });

        // Sort controls
        document.getElementById('sort-field')?.addEventListener('change', (e) => {
            state.sortField = e.target.value;
            updateDisplay();
        });

        document.getElementById('sort-direction')?.addEventListener('change', (e) => {
            state.sortDirection = e.target.value;
            updateDisplay();
        });

        // Items per page
        document.getElementById('items-per-page')?.addEventListener('change', (e) => {
            state.itemsPerPage = parseInt(e.target.value);
            state.currentPage = 1; // Reset to first page
            updateDisplay();
        });

        // Pagination buttons
        document.getElementById('prev-page')?.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                updateDisplay();
            }
        });

        document.getElementById('next-page')?.addEventListener('click', () => {
            const totalPages = Math.ceil(getFilteredAndSortedStocks().length / state.itemsPerPage);
            if (state.currentPage < totalPages) {
                state.currentPage++;
                updateDisplay();
            }
        });

        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            loadStocksData();
        });
    }

    function updateDisplay() {
        if (state.loading) {
            document.getElementById('loading-state')?.classList.remove('hidden');
            document.getElementById('stocks-content')?.classList.add('hidden');
            return;
        }

        document.getElementById('loading-state')?.classList.add('hidden');
        document.getElementById('stocks-content')?.classList.remove('hidden');

        // Update stats
        updateStats();

        // Filter and sort stocks
        const filteredAndSortedStocks = getFilteredAndSortedStocks();
        
        // Update pagination info
        updatePaginationInfo(filteredAndSortedStocks);

        // Render based on current view
        if (state.currentView === 'table') {
            renderStocksTable(filteredAndSortedStocks, container, state);
        } else {
            renderStockCards(filteredAndSortedStocks, container, state);
        }
    }

    function filterStocks() {
        return state.stocks.filter(stock => {
            // Search filter
            if (state.searchQuery) {
                const query = state.searchQuery.toLowerCase();
                const searchMatch = 
                    stock.item.toLowerCase().includes(query) ||
                    (stock.batch && stock.batch.toLowerCase().includes(query)) ||
                    (stock.hsn && stock.hsn.toLowerCase().includes(query)) ||
                    (stock.oem && stock.oem.toLowerCase().includes(query));
                if (!searchMatch) return false;
            }

            // Category filter
            if (state.filters.category === 'low' && stock.qty > 10) return false;
            if (state.filters.category === 'high' && stock.total < 10000) return false;

            return true;
        });
    }

    function getFilteredAndSortedStocks() {
        // First filter
        let stocks = filterStocks();
        
        // Then sort
        stocks.sort((a, b) => {
            let aValue = a[state.sortField];
            let bValue = b[state.sortField];
            
            // Handle null/undefined values
            if (aValue === null || aValue === undefined) aValue = '';
            if (bValue === null || bValue === undefined) bValue = '';
            
            // For numeric values, convert to numbers
            if (state.sortField === 'qty' || state.sortField === 'rate' || state.sortField === 'total') {
                aValue = parseFloat(aValue) || 0;
                bValue = parseFloat(bValue) || 0;
            } else {
                // For string values, convert to lowercase for case-insensitive sort
                aValue = String(aValue).toLowerCase();
                bValue = String(bValue).toLowerCase();
            }
            
            if (state.sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
        
        // Then paginate
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        return stocks.slice(startIndex, endIndex);
    }

    function updatePaginationInfo(allStocks) {
        const totalItems = allStocks.length;
        const totalPages = Math.ceil(totalItems / state.itemsPerPage);
        const startIndex = (state.currentPage - 1) * state.itemsPerPage + 1;
        const endIndex = Math.min(startIndex + state.itemsPerPage - 1, totalItems);
        
        // Update pagination display
        document.getElementById('showing-from').textContent = totalItems > 0 ? startIndex : 0;
        document.getElementById('showing-to').textContent = endIndex;
        document.getElementById('total-items').textContent = totalItems;
        
        // Update button states
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) {
            prevBtn.disabled = state.currentPage === 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = state.currentPage >= totalPages;
        }
        
        // Show/hide pagination controls
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) {
            paginationControls.style.display = totalItems > state.itemsPerPage ? 'flex' : 'none';
        }
    }

    function updateStats() {
        const statsContainer = document.getElementById('stock-stats');
        if (!statsContainer) return;

        const totalItems = state.stocks.length;
        const totalValue = state.stocks.reduce((sum, stock) => sum + (stock.total || 0), 0);
        const lowStockItems = state.stocks.filter(stock => stock.qty <= 10).length;
        const totalQuantity = state.stocks.reduce((sum, stock) => sum + (stock.qty || 0), 0);

        statsContainer.innerHTML = `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center">
                    <div class="p-3 bg-blue-100 rounded-lg">
                        <svg class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-600">Total Items</p>
                        <p class="text-2xl font-bold text-gray-900">${totalItems}</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center">
                    <div class="p-3 bg-green-100 rounded-lg">
                        <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 8.25H9m6 3H9m3 6l-3-3h1.5a3 3 0 100-6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-600">Total Value</p>
                        <p class="text-2xl font-bold text-gray-900">₹${totalValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center">
                    <div class="p-3 bg-yellow-100 rounded-lg">
                        <svg class="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-600">Low Stock</p>
                        <p class="text-2xl font-bold text-gray-900">${lowStockItems}</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center">
                    <div class="p-3 bg-purple-100 rounded-lg">
                        <svg class="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 4.608c.003.021.005.042.005.064 0 1.036-1.007 1.875-2.25 1.875S8.875 11.668 8.875 10.632c0-.022.002-.043.005-.064L11.5 4.97m5.25 0L18.75 4.97M5.25 4.97L3 9.978c-.003.021-.005.042-.005.064 0 1.036 1.007 1.875 2.25 1.875s2.25-.84 2.25-1.875c0-.022-.002-.043-.005-.064L5.25 4.97z" /></svg>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-600">Total Quantity</p>
                        <p class="text-2xl font-bold text-gray-900">${totalQuantity.toLocaleString('en-IN')}</p>
                    </div>
                </div>
            </div>
        `;
    }

    function openStockModal(stock = null) {
        renderStockModal(stock, state, async (stockData) => {
            try {
                if (stock) {
                    await updateStock(stock.id, stockData);
                    showToast('Stock updated successfully', 'success');
                } else {
                    await createStock(stockData);
                    showToast('Stock created successfully', 'success');
                }
                await loadStocksData(); // Reload data
            } catch (error) {
                showToast('Failed to save stock: ' + error.message, 'error');
            }
        });
    }

    function exportToExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('XLSX library not loaded yet. Please try again.', 'error');
            return;
        }

        const stocks = getFilteredAndSortedStocks();
        if (stocks.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }

        // Prepare data for export
        const data = stocks.map(stock => ({
            'Item': stock.item || '',
            'Batch': stock.batch || '',
            'HSN': stock.hsn || '',
            'OEM': stock.oem || '',
            'Quantity': stock.qty || 0,
            'UOM': stock.uom || 'PCS',
            'Rate': stock.rate || 0,
            'Total Value': stock.total || 0,
            'GST %': stock.grate || 0,
            'MRP': stock.mrp || ''
        }));

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(data);

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stocks');

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `stocks_export_${timestamp}.xlsx`;

        // Download the file
        XLSX.writeFile(wb, filename);
        showToast('Excel file exported successfully', 'success');
    }

    // Expose functions to global scope - initialize once
    if (!window.stocksSystem) {
        window.stocksSystem = {};
    }
    
    window.stocksSystem.openStockModal = (stock) => {
        renderStockModal(stock, state, async (stockData) => {
            try {
                if (stock && stock.id) {
                    await updateStock(stock.id, stockData);
                    showToast('Stock updated successfully', 'success');
                } else {
                    await createStock(stockData);
                    showToast('Stock created successfully', 'success');
                }
                await loadStocksData(); // Refresh data
            } catch (error) {
                console.error('Failed to save stock:', error);
                showToast('Failed to save stock: ' + error.message, 'error');
            }
        });
    };
    
    window.stocksSystem.loadStocksData = loadStocksData;
    window.stocksSystem.refresh = () => {
        loadStocksData();
    };
    window.stocksSystem.state = state;
}
