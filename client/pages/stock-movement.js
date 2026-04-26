import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export async function renderStockMovement(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
  <div class="px-4 py-4 space-y-4">

    <!-- Header -->
    <div class="text-center space-y-2">
      <div class="w-12 h-12 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-6 h-6 text-white">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-900">Stock Movement</h1>
      <p class="text-base text-gray-600 max-w-2xl mx-auto">
        View and analyze all stock movements and inventory transactions.
      </p>
    </div>

    <!-- Controls -->
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-4 items-center">
          <div class="relative">
            <input type="text" id="search-movements" placeholder="Search movements..." class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 absolute left-3 top-2.5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <select id="filter-type" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
            <option value="">All Types</option>
            <option value="SALE">Sale</option>
            <option value="PURCHASE">Purchase</option>
            <option value="RECEIPT">Receipt</option>
            <option value="TRANSFER">Transfer</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="OPENING">Opening</option>
          </select>
          <input type="date" id="filter-date-from" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
          <input type="date" id="filter-date-to" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
        </div>
        <div class="flex gap-2">
          <button id="refresh-movements" class="px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
          <button id="export-movements" class="px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Excel
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white rounded-xl shadow-lg p-4">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-green-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total In</p>
            <p class="text-2xl font-bold text-gray-900" id="total-in">0</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg p-4">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-red-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Out</p>
            <p class="text-2xl font-bold text-gray-900" id="total-out">0</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg p-4">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-blue-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Net Movement</p>
            <p class="text-2xl font-bold text-gray-900" id="net-movement">0</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg p-4">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-purple-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-purple-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Records</p>
            <p class="text-2xl font-bold text-gray-900" id="total-records">0</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Movements Table -->
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gradient-to-r from-red-500 via-blue-500 to-yellow-500 text-white">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="bdate" data-col="bdate">
                <div class="flex items-center justify-between">
                  Date
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="bdate" title="Filter Date" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="type" data-col="type">
                <div class="flex items-center justify-between">
                  Type
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="type" title="Filter Type" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="bno" data-col="bno">
                <div class="flex items-center justify-between">
                  Bill No
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="bno" title="Filter Bill No" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="item" data-col="item">
                <div class="flex items-center justify-between">
                  Item
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="item" title="Filter Item" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Batch</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="qty" data-col="qty">
                <div class="flex items-center justify-end">
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="qty" title="Filter Quantity" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                  Quantity
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">UOM</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="rate" data-col="rate">
                <div class="flex items-center justify-end">
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="rate" title="Filter Rate" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                  Rate
                </div>
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="total" data-col="total">
                <div class="flex items-center justify-end">
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="total" title="Filter Total" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                  Total
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider" data-col="party">
                <div class="flex items-center justify-between">
                  Party
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="party" title="Filter Party" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody id="movements-table-body" class="bg-white divide-y divide-gray-200">
            <tr>
              <td colspan="10" class="px-6 py-4 text-center text-gray-500">
                <div class="flex items-center justify-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading movements...
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Column Filter Dropdown (singleton, fixed-position) ──────────── -->
      <div id="col-filter-dropdown" class="hidden fixed z-50 w-64 max-h-96 flex-col overflow-hidden bg-white border border-gray-200 rounded-xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)]">
        <!-- Header -->
        <div class="flex flex-shrink-0 items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <span id="cfd-title" class="text-[11px] font-bold text-gray-700 uppercase tracking-wide"></span>
          <button id="cfd-close" type="button" class="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition border-0 bg-transparent cursor-pointer">
            <svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
            </svg>
          </button>
        </div>
        <!-- Body injected by JS per column -->
        <div id="cfd-body" class="overflow-y-auto flex-1 px-2 py-2"></div>
        <!-- Footer -->
        <div class="flex flex-shrink-0 gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button id="cfd-apply" type="button" class="flex-1 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-0 rounded-lg cursor-pointer transition">Apply</button>
          <button id="cfd-clear" type="button" class="flex-1 py-1.5 text-[11px] font-medium bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 rounded-lg cursor-pointer transition">Clear</button>
        </div>
      </div>

      <!-- Pagination -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-700">
            <span id="pagination-info">Showing 0 to 0 of 0 movements</span>
          </div>
          <div class="flex items-center space-x-2">
            <button id="prev-page" class="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Previous
            </button>
            <div class="flex space-x-1">
              <span id="page-numbers" class="flex space-x-1"></span>
            </div>
            <button id="next-page" class="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex justify-center">
      <a href="/inventory/dashboard" data-navigo class="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </a>
    </div>

  </div>
  `;

  // FIX 1: content was defined but renderLayout was never called with it.
  renderLayout(content, router);

  // FIX 2: initializeMovementsPage was defined but never called.
  initializeMovementsPage(router);
}

  // FIX 3: Moved outside renderStockMovement and removed the shadowing `router`
// parameter — the function never used it, and it shadowed the outer parameter.
function initializeMovementsPage(router) {
  let allMovements = [];
  let filteredMovements = [];
  let sortedMovements = [];
  let currentPage = 1;
  let itemsPerPage = 10;
  let sortColumn = '';
  let sortDirection = 'asc'; // 'asc' or 'desc'

  // DOM elements
  const searchInput = document.getElementById('search-movements');
  const typeFilter = document.getElementById('filter-type');
  const dateFromFilter = document.getElementById('filter-date-from');
  const dateToFilter = document.getElementById('filter-date-to');
  const refreshBtn = document.getElementById('refresh-movements');
  const exportBtn = document.getElementById('export-movements');
  const tableBody = document.getElementById('movements-table-body');
  const movementsCount = document.getElementById('movements-count');
  const totalInEl = document.getElementById('total-in');
  const totalOutEl = document.getElementById('total-out');
  const netMovementEl = document.getElementById('net-movement');
  const totalRecordsEl = document.getElementById('total-records');
  const paginationInfo = document.getElementById('pagination-info');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageNumbers = document.getElementById('page-numbers');
  const itemsPerPageSelect = document.createElement('select');
  itemsPerPageSelect.id = 'items-per-page';
  itemsPerPageSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500';
  itemsPerPageSelect.innerHTML = `
    <option value="10">10 per page</option>
    <option value="25">25 per page</option>
    <option value="50">50 per page</option>
    <option value="100">100 per page</option>
  `;
  itemsPerPageSelect.value = itemsPerPage;

  // Insert items per page selector
  const controlsDiv = document.querySelector('.flex.flex-col.sm\\:flex-row.gap-4.items-center.justify-between');
  if (controlsDiv) {
    const leftControls = controlsDiv.querySelector('.flex.flex-col.sm\\:flex-row.gap-4.items-center');
    if (leftControls) {
      leftControls.appendChild(itemsPerPageSelect);
    }
  }

  // Load movements data
  async function loadMovements() {
    try {
      console.log('Loading movements from API...');
      // FIX 4: Corrected API path from /api/inventory/stock-movements
      // to /api/inventory/sales/stock-movements (matches sls.js route).
      // FIX 5: Removed Authorization: Bearer header — this app uses
      // httpOnly cookie auth (set by authMiddleware), not localStorage tokens.
      const response = await fetch('/api/inventory/sales/stock-movements', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to load movements: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Movements data received:', data);
      allMovements = data.data.rows || [];
      filteredMovements = [...allMovements];
      sortedMovements = [...filteredMovements];

      // Apply current sorting
      if (sortColumn) {
        sortMovements(sortColumn, sortDirection);
      }

      currentPage = 1; // Reset to first page
      renderMovements();
      updateSummary();
      updatePagination();
    } catch (error) {
      console.error('Error loading movements:', error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="px-6 py-4 text-center text-red-500">
            <div class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Error loading movements. Please check console for details.
            </div>
          </td>
        </tr>
      `;
    }
  }

  // Sort movements function
  function sortMovements(column, direction) {
    sortColumn = column;
    sortDirection = direction;

    sortedMovements.sort((a, b) => {
      let valueA, valueB;

      switch (column) {
        case 'bno':
          valueA = a.bno || '';
          valueB = b.bno || '';
          break;
        case 'bdate':
          valueA = new Date(a.bdate || 0);
          valueB = new Date(b.bdate || 0);
          break;
        case 'type':
          valueA = a.type || '';
          valueB = b.type || '';
          break;
        case 'item':
          valueA = a.item || '';
          valueB = b.item || '';
          break;
        case 'qty':
          valueA = parseFloat(a.qty || 0);
          valueB = parseFloat(b.qty || 0);
          break;
        case 'rate':
          valueA = parseFloat(a.rate || 0);
          valueB = parseFloat(b.rate || 0);
          break;
        case 'total':
          valueA = parseFloat(a.total || 0);
          valueB = parseFloat(b.total || 0);
          break;
        default:
          return 0;
      }

      if (direction === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });

    // Update sort icons
    updateSortIcons();

    currentPage = 1; // Reset to first page when sorting
    renderMovements();
    updatePagination();
  }

  // Update sort icons
  function updateSortIcons() {
    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
      const column = header.dataset.sort;
      const icon = header.querySelector('.sort-icon');

      if (icon) {
        if (column === sortColumn) {
          icon.classList.remove('opacity-30');
          icon.classList.add('opacity-100');
          if (sortDirection === 'asc') {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />';
          } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />';
          }
        } else {
          icon.classList.remove('opacity-100');
          icon.classList.add('opacity-30');
          icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />';
        }
      }
    });
  }

  // Pagination functions
  function getPaginatedMovements() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedMovements.slice(startIndex, endIndex);
  }

  function getTotalPages() {
    return Math.ceil(sortedMovements.length / itemsPerPage);
  }

  function updatePagination() {
    const totalItems = sortedMovements.length;
    const totalPages = getTotalPages();
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Update pagination info
    paginationInfo.textContent = `Showing ${startItem} to ${endItem} of ${totalItems} movements`;

    // Update buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    // Update page numbers
    renderPageNumbers();
  }

  function renderPageNumbers() {
    const totalPages = getTotalPages();
    pageNumbers.innerHTML = '';

    if (totalPages <= 7) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        createPageButton(i);
      }
    } else {
      // Show first page
      createPageButton(1);

      if (currentPage > 4) {
        pageNumbers.innerHTML += '<span class="px-2">...</span>';
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        createPageButton(i);
      }

      if (currentPage < totalPages - 3) {
        pageNumbers.innerHTML += '<span class="px-2">...</span>';
      }

      // Show last page
      if (totalPages > 1) {
        createPageButton(totalPages);
      }
    }
  }

  function createPageButton(pageNum) {
    const button = document.createElement('button');
    button.textContent = pageNum;
    button.className = `px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 ${
      pageNum === currentPage ? 'bg-green-500 text-white border-green-500' : 'bg-white'
    }`;
    button.addEventListener('click', () => goToPage(pageNum));
    pageNumbers.appendChild(button);
  }

  function goToPage(page) {
    currentPage = page;
    renderMovements();
    updatePagination();
  }

  // Render movements table
  function renderMovements() {
    const paginatedMovements = getPaginatedMovements();

    if (paginatedMovements.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="px-6 py-4 text-center text-gray-500">
            <div class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
              </svg>
              No movements found matching your criteria.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = paginatedMovements.map(movement => {
      const qty = parseFloat(movement.qty || 0);
      const rate = parseFloat(movement.rate || 0);
      const total = parseFloat(movement.total || 0);
      const type = movement.type || '';
      const isOutward = ['SALE', 'TRANSFER', 'ADJUSTMENT'].includes(type.toUpperCase());

      return `
        <tr class="bg-gradient-to-r from-white to-gray-50 hover:from-lime-100 hover:to-lime-200">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(movement.bdate)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              isOutward ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }">
              ${type}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${movement.bno || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${movement.item || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${movement.batch || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right ${isOutward ? 'text-red-600' : 'text-green-600'}">${qty.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${movement.uom || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₹${rate.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">₹${total.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${movement.party_name || ''}</td>
        </tr>
      `;
    }).join('');
  }

  // Update summary statistics
  function updateSummary() {
    const totalRecords = allMovements.length;
    let totalIn = 0;
    let totalOut = 0;

    allMovements.forEach(movement => {
      const qty = parseFloat(movement.qty || 0);
      const type = movement.type || '';

      if (['RECEIPT', 'PURCHASE', 'OPENING'].includes(type.toUpperCase())) {
        totalIn += qty;
      } else if (['SALE', 'TRANSFER', 'ADJUSTMENT'].includes(type.toUpperCase())) {
        totalOut += qty;
      }
    });

    const netMovement = totalIn - totalOut;

    totalInEl.textContent = totalIn.toFixed(2);
    totalOutEl.textContent = totalOut.toFixed(2);
    netMovementEl.textContent = netMovement.toFixed(2);
    totalRecordsEl.textContent = totalRecords;
  }

  // Filter movements
  function filterMovements() {
    const searchTerm = searchInput.value.toLowerCase();
    const typeFilterValue = typeFilter.value;
    const dateFrom = dateFromFilter.value;
    const dateTo = dateToFilter.value;

    filteredMovements = allMovements.filter(movement => {
      // Search filter
      const matchesSearch = !searchTerm ||
        (movement.item || '').toLowerCase().includes(searchTerm) ||
        (movement.bno || '').toLowerCase().includes(searchTerm) ||
        (movement.party_name || '').toLowerCase().includes(searchTerm);

      // Type filter
      const matchesType = !typeFilterValue || movement.type === typeFilterValue;

      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const movementDate = new Date(movement.bdate);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          matchesDate = matchesDate && movementDate >= fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // End of day
          matchesDate = matchesDate && movementDate <= toDate;
        }
      }
      
      if (!matchesColFilters(movement)) return false;

      return matchesSearch && matchesType && matchesDate;
    });

    sortedMovements = [...filteredMovements];

    // Apply current sorting
    if (sortColumn) {
      sortMovements(sortColumn, sortDirection);
    } else {
      currentPage = 1;
      renderMovements();
      updateSummary();
      updatePagination();
    }
  }

  // Export to Excel
  async function exportToExcel() {
    try {
      const params = new URLSearchParams();
      
      if (typeFilter.value) params.append('type', typeFilter.value);
      if (searchInput.value) params.append('searchTerm', searchInput.value);
      if (dateFromFilter.value) params.append('dateFrom', dateFromFilter.value);
      if (dateToFilter.value) params.append('dateTo', dateToFilter.value);
      
      const url = `/api/inventory/sales/stock-movements/export?${params.toString()}`;
      
      const response = await fetch(url, {
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `stock-movements-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error exporting to Excel: ' + err.message);
    }
  }

  // Utility functions
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
    const colFilters = {
    bno: null, bdate: null, firm: null, btype: null,
    gtot: null, tax: null, ntot: null, status: null,
  };

  // Column definitions for the dropdown builder
  const COL_CONFIG = {
    bno:    { label: 'Bill No',   type: 'text',   getValue: b => b.bno || '' },
    bdate:  { label: 'Date',      type: 'text',   getValue: b => formatDate(b.bdate) },
    item:   { label: 'Item',     type: 'text',   getValue: b => b.item || '' },
    type:  { label: 'Type',     type: 'choice', getValue: b => b.type || 'SALE' },
    qty:   { label: 'Quantity',   type: 'number', getValue: b => b.qty || 0 },
    rate:   { label: 'Rate',       type: 'number', getValue: b => (b.rate||0) },
    total:  { label: 'Total',     type: 'number', getValue: b => b.total || 0 },
    party: { label: 'Party',    type: 'text', getValue: b => b.party_name || '' },
  };
  
  function matchesColFilters(bill) {
    for (const [col, state] of Object.entries(colFilters)) {
      if (!state) continue;
      const cfg = COL_CONFIG[col];
      if (!cfg) continue;
      const val = cfg.getValue(bill);
      if (cfg.type === 'number') {
        const n = Number(val);
        if (state.min !== '' && state.min !== null && !isNaN(state.min) && n < Number(state.min)) return false;
        if (state.max !== '' && state.max !== null && !isNaN(state.max) && n > Number(state.max)) return false;
      } else {
        if (state.size > 0 && !state.has(String(val))) return false;
      }
    }
    return true;
  }

  // Update the funnel badge on a column header (amber dot when filter active)
  function updateFilterBadge(col) {
    const btn = document.querySelector(`.col-filter-btn[data-col="${col}"]`);
    if (!btn) return;
    const badge = btn.querySelector('.col-filter-badge');
    const icon  = btn.querySelector('.col-filter-icon');
    const active = !!colFilters[col] && (
      colFilters[col] instanceof Set
        ? colFilters[col].size > 0
        : (colFilters[col].min !== '' || colFilters[col].max !== '')
    );
    if (badge) badge.classList.toggle('hidden', !active);
    if (icon)  icon.classList.toggle('opacity-60', !active);
    if (icon)  icon.classList.toggle('opacity-100', active);
    // Colour the icon amber when active
    btn.classList.toggle('text-amber-300', active);
    btn.classList.toggle('text-white',     !active);
  }
  
  const cfDropdown = document.getElementById('col-filter-dropdown');
  const cfTitle    = document.getElementById('cfd-title');
  const cfBody     = document.getElementById('cfd-body');
  const cfApply    = document.getElementById('cfd-apply');
  const cfClear    = document.getElementById('cfd-clear');
  const cfClose    = document.getElementById('cfd-close');
  let   cfActiveCol = null;  // which column is currently open

  function openColFilter(col, anchorBtn) {
    cfActiveCol = col;
    const cfg   = COL_CONFIG[col];
    if (!cfg) return;

    cfTitle.textContent = cfg.label;
    buildFilterBody(col, cfg);
    showDropdownNear(anchorBtn);
  }

  function showDropdownNear(btn) {
    const rect = btn.getBoundingClientRect();
    const ddW  = 256;
    const ddH  = 384;
    let   top  = rect.bottom + 6;
    let   left = rect.left;

    if (top  + ddH > window.innerHeight - 16) top  = Math.max(8, rect.top - ddH - 6);
    if (left + ddW > window.innerWidth  - 16) left = Math.max(8, window.innerWidth - ddW - 16);

    cfDropdown.style.top  = top  + 'px';
    cfDropdown.style.left = left + 'px';

    cfDropdown.classList.remove('hidden');
    cfDropdown.classList.add('flex');
  }

  function closeColFilter() {
    cfDropdown.classList.add('hidden');
    cfDropdown.classList.remove('flex');
    cfActiveCol = null;
  }
  
  function buildFilterBody(col, cfg) {
    cfBody.innerHTML = '';

    if (cfg.type === 'number') {
      const cur     = colFilters[col] || { min: '', max: '' };
      const minVal  = cur.min ?? '';
      const maxVal  = cur.max ?? '';
      cfBody.innerHTML = `
        <p class="text-[10px] text-gray-400 uppercase tracking-wide px-0.5 mb-1.5">Filter by range</p>
        <div class="flex gap-2">
          <div class="flex-1 min-w-0">
            <label class="block text-[10px] text-gray-500 mb-0.5" for="cfd-num-min">Min</label>
            <input id="cfd-num-min" type="number" placeholder="0" value="${minVal}"
              class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white
                     focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition">
          </div>
          <div class="flex-1 min-w-0">
            <label class="block text-[10px] text-gray-500 mb-0.5" for="cfd-num-max">Max</label>
            <input id="cfd-num-max" type="number" placeholder="Any" value="${maxVal}"
              class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white
                     focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition">
          </div>
        </div>
      `;

    } else {
      const allVals = [...new Set(allMovements.map(b => String(cfg.getValue(b))).filter(Boolean))].sort();
      const curSet  = colFilters[col] instanceof Set ? colFilters[col] : null; 

      const searchWrap = document.createElement('div');
      searchWrap.className = 'relative mb-1.5';
      searchWrap.innerHTML = `
        <input id="cfd-search" type="text" placeholder="Search ${cfg.label}..."
          class="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white
                 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             stroke-width="2" stroke="currentColor"
             class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
        </svg>
      `;
      cfBody.appendChild(searchWrap);
      const searchInput = searchWrap.querySelector('#cfd-search');

      const saWrap = document.createElement('div');
      saWrap.className = 'border-b border-gray-100 pb-1 mb-1';

      const saLabel = document.createElement('label');
      saLabel.className = 'flex items-center gap-2 px-1 py-1 rounded cursor-pointer select-none hover:bg-gray-50 w-full';

      const saCb = document.createElement('input');
      saCb.type  = 'checkbox';
      saCb.id    = 'cfd-select-all';
      saCb.className     = 'w-3.5 h-3.5 flex-shrink-0 cursor-pointer accent-emerald-600';
      saCb.checked       = !curSet || (curSet && curSet.size === allVals.length);
      saCb.indeterminate = !!(curSet && curSet.size > 0 && curSet.size < allVals.length);

      const saText = document.createElement('span');
      saText.textContent = 'Select All';
      saText.className   = 'text-xs font-semibold text-gray-700';

      const saCount = document.createElement('span');
      saCount.textContent = allVals.length;
      saCount.className   = 'ml-auto text-[10px] text-gray-400';

      saLabel.appendChild(saCb);
      saLabel.appendChild(saText);
      saLabel.appendChild(saCount);
      saWrap.appendChild(saLabel);
      cfBody.appendChild(saWrap);

      const optsList = document.createElement('div');
      optsList.id        = 'cfd-options';
      optsList.className = 'flex flex-col gap-px';

      allVals.forEach(v => {
        const lbl       = document.createElement('label');
        lbl.dataset.val = v;
        lbl.className   = 'cfd-option flex items-center gap-2 px-1 py-1 rounded cursor-pointer select-none hover:bg-gray-50 w-full';

        const cb       = document.createElement('input');
        cb.type        = 'checkbox';
        cb.value       = v;
        cb.className   = 'cfd-checkbox w-3.5 h-3.5 flex-shrink-0 cursor-pointer accent-emerald-600';
        cb.checked     = !curSet || curSet.has(v);

        const txt      = document.createElement('span');
        txt.textContent = v;
        txt.title       = v;
        txt.className  = 'text-xs text-gray-800 min-w-0 flex-1 truncate';

        lbl.appendChild(cb);
        lbl.appendChild(txt);
        optsList.appendChild(lbl);
      });

      cfBody.appendChild(optsList);

      if (!allVals.length) {
        const empty     = document.createElement('p');
        empty.textContent = 'No values found';
        empty.className   = 'text-[11px] text-gray-400 text-center py-3';
        cfBody.appendChild(empty);
      }

      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        optsList.querySelectorAll('.cfd-option').forEach(opt => {
          opt.classList.toggle('hidden', !!(q && !opt.dataset.val.toLowerCase().includes(q)));
        });
        syncSelectAll(saCb, optsList);
      });

      saCb.addEventListener('change', () => {
        const visible = [...optsList.querySelectorAll('.cfd-option:not(.hidden)')];
        visible.forEach(o => { o.querySelector('.cfd-checkbox').checked = saCb.checked; });
      });

      optsList.addEventListener('change', () => syncSelectAll(saCb, optsList));
    }
  }

  function syncSelectAll(saCb, optsList) {
    const visible = [...optsList.querySelectorAll('.cfd-option:not(.hidden)')];
    const total   = visible.length;
    const checked = visible.filter(o => o.querySelector('.cfd-checkbox').checked).length;
    saCb.checked       = total > 0 && checked === total;
    saCb.indeterminate = checked > 0 && checked < total;
  }

  function readDropdownState(col) {
    const cfg = COL_CONFIG[col];
    if (!cfg) return null;

    if (cfg.type === 'number') {
      const minEl = document.getElementById('cfd-num-min');
      const maxEl = document.getElementById('cfd-num-max');
      const min   = minEl ? minEl.value.trim() : '';
      const max   = maxEl ? maxEl.value.trim() : '';
      return (min === '' && max === '') ? null : { min, max };
    } else {
      const allVals = [...new Set(allMovements.map(b => String(cfg.getValue(b))).filter(Boolean))].sort();
      const allCbs  = [...cfBody.querySelectorAll('.cfd-checkbox')];
      const checked = allCbs.filter(cb => cb.checked).map(cb => cb.value);
      if (checked.length === allVals.length) return null;
      return checked.length === 0 ? new Set() : new Set(checked);
    }
  }

  // Event listeners
  searchInput.addEventListener('input', filterMovements);
  typeFilter.addEventListener('change', filterMovements);
  dateFromFilter.addEventListener('change', filterMovements);
  dateToFilter.addEventListener('change', filterMovements);
  refreshBtn.addEventListener('click', loadMovements);
  exportBtn.addEventListener('click', exportToExcel);

  // Sorting event listeners
  document.querySelectorAll('th[data-sort]').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;
      const newDirection = (sortColumn === column && sortDirection === 'asc') ? 'desc' : 'asc';
      sortMovements(column, newDirection);
    });
  });

  // Pagination event listeners
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < getTotalPages()) {
      goToPage(currentPage + 1);
    }
  });

  // Items per page selector
  itemsPerPageSelect.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value);
    currentPage = 1; // Reset to first page
    renderMovements();
    updatePagination();
  });
  
  cfApply.addEventListener('click', () => {
    if (!cfActiveCol) return;
    colFilters[cfActiveCol] = readDropdownState(cfActiveCol);
    updateFilterBadge(cfActiveCol);
    closeColFilter();
    filterMovements();
  });

  cfClear.addEventListener('click', () => {
    if (!cfActiveCol) return;
    colFilters[cfActiveCol] = null;
    updateFilterBadge(cfActiveCol);
    closeColFilter();
    filterMovements();
  });

  cfClose.addEventListener('click', closeColFilter);

  document.addEventListener('click', e => {
    if (!cfActiveCol) return;
    if (!cfDropdown.contains(e.target) && !e.target.closest('.col-filter-btn')) {
      closeColFilter();
    }
  }, true);

  document.querySelector('thead').addEventListener('click', e => {
    const btn = e.target.closest('.col-filter-btn');
    if (!btn) return;
    e.stopPropagation();
    const col = btn.dataset.col;
    if (!col || !COL_CONFIG[col]) return;
    if (cfActiveCol === col && !cfDropdown.classList.contains('hidden')) {
      closeColFilter();
    } else {
      openColFilter(col, btn);
    }
  });

  // Initialize sort icons
  updateSortIcons();

  // Initial load
  loadMovements();
}