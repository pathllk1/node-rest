import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fetchWithCSRF } from '../utils/api.js';

export async function renderInventoryReports(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const returnTypeHint = urlParams.get('type') === 'PURCHASE' ? 'Purchase (Debit Note)' : 'Sales (Credit Note)';

  const content = `
  <div class="px-3 py-3 space-y-3">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight">Bills Reports</h1>
          <p class="text-xs text-gray-500">View and analyze all bills and transactions</p>
        </div>
      </div>
      <a href="/inventory/dashboard" data-navigo class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition self-start sm:self-auto">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Dashboard
      </a>
    </div>

    ${action === 'return' ? `
    <!-- Return Action Notice -->
    <div class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded shadow-sm animate-pulse">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-amber-700 font-bold uppercase tracking-tight">Create ${returnTypeHint} Return</p>
          <p class="text-sm text-amber-600">Please locate the <strong>original bill</strong> in the list below and click the amber <span class="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">Return</span> button to proceed.</p>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-blue-600">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H8.25Z" />
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-xs text-gray-500 truncate">Total Bills</p>
          <p class="text-lg font-bold text-gray-900 leading-tight" id="total-bills">0</p>
        </div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-green-600">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-xs text-gray-500 truncate">Revenue</p>
          <p class="text-lg font-bold text-gray-900 leading-tight" id="total-revenue">&#8377;0.00</p>
        </div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-orange-600">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z" />
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-xs text-gray-500 truncate">Total Tax</p>
          <p class="text-lg font-bold text-gray-900 leading-tight" id="total-tax">&#8377;0.00</p>
        </div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-purple-600">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-xs text-gray-500 truncate">Active Bills</p>
          <p class="text-lg font-bold text-gray-900 leading-tight" id="active-bills">0</p>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="bg-white rounded-lg border border-gray-200 p-3">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col sm:flex-row gap-2">
          <div class="relative flex-1">
            <input type="text" id="search-bills"
              placeholder="Search bills... (Ctrl+F)"
              class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-gray-50 focus:bg-white transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 absolute left-2.5 top-2 text-gray-400 pointer-events-none">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <select id="filter-type" class="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-gray-50">
            <option value="">All Types</option>
            <option value="SALES">Sales</option>
            <option value="PURCHASE">Purchase</option>
            <option value="CREDIT_NOTE">Credit Note (Sales Return)</option>
            <option value="DEBIT_NOTE">Debit Note (Purchase Return)</option>
          </select>
        </div>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
          <div class="flex flex-wrap gap-2 items-center">
            <div class="flex items-center gap-1.5">
              <label class="text-xs text-gray-500 whitespace-nowrap">From</label>
              <input type="date" id="filter-date-from" class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-gray-50">
            </div>
            <div class="flex items-center gap-1.5">
              <label class="text-xs text-gray-500 whitespace-nowrap">To</label>
              <input type="date" id="filter-date-to" class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-gray-50">
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="refresh-bills" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition" title="Refresh (R)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
              <kbd class="ml-0.5 px-1 py-0.5 bg-blue-500 border border-blue-400 rounded font-mono text-blue-100 text-xs leading-none">R</kbd>
            </button>
            <button id="export-bills-pdf" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition" title="Export PDF (P)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export PDF
              <kbd class="ml-0.5 px-1 py-0.5 bg-red-500 border border-red-400 rounded font-mono text-red-100 text-xs leading-none">P</kbd>
            </button>
            <button id="export-bills" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition" title="Export Excel (E)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export
              <kbd class="ml-0.5 px-1 py-0.5 bg-green-500 border border-green-400 rounded font-mono text-green-100 text-xs leading-none">E</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bills Table -->
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600">
            <tr>
              <th class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition" data-sort="bno" data-col="bno">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1">Bill No<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 sort-icon opacity-40"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" /></svg></div>
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="bno" title="Filter Bill No" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition" data-sort="bdate" data-col="bdate">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1">Date<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 sort-icon opacity-40"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" /></svg></div>
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="bdate" title="Filter Date" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition hidden sm:table-cell" data-sort="firm" data-col="firm">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1">Party<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 sort-icon opacity-40"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" /></svg></div>
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="firm" title="Filter Party" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition" data-sort="btype" data-col="btype">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1">Type<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 sort-icon opacity-40"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" /></svg></div>
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="btype" title="Filter Type" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition hidden md:table-cell" data-sort="gtot" data-col="gtot">
                <div class="flex items-center justify-end gap-1">
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="gtot" title="Filter Taxable" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                  <div class="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 sort-icon opacity-40"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" /></svg>Taxable</div>
                </div>
              </th>
              <th class="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition hidden md:table-cell" data-sort="tax" data-col="tax">
                <div class="flex items-center justify-end gap-1">
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="tax" title="Filter Tax" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                  <div class="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 sort-icon opacity-40"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" /></svg>Tax</div>
                </div>
              </th>
              <th class="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase tracking-wider" data-col="ntot">
                <div class="flex items-center justify-end gap-1">
                  <button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="ntot" title="Filter Total" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>Total
                </div>
              </th>
              <th class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider" data-col="status">
                <div class="flex items-center justify-between gap-1">
                  Status<button class="col-filter-btn flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition relative" data-col="status" title="Filter Status" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="col-filter-icon w-3 h-3 opacity-60"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd"/></svg><span class="col-filter-badge hidden absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">!</span></button>
                </div>
              </th>
              <th class="px-3 py-2.5 text-center text-xs font-semibold text-white uppercase tracking-wider">View</th>
            </tr>
          </thead>
          <tbody id="bills-table-body" class="bg-white divide-y divide-gray-100">
            <tr>
              <td colspan="9" class="px-4 py-8 text-center text-sm text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <svg class="animate-spin h-4 w-4 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading bills...
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Column Filter Dropdown (singleton, fixed-position) ──────────── -->
      <!-- hidden = display:none  |  flex class added by JS when open          -->
      <!-- top/left set via JS element.style — JS DOM props are CSP-safe       -->
      <div id="col-filter-dropdown"
           class="hidden fixed z-50 w-64 max-h-96 flex-col overflow-hidden
                  bg-white border border-gray-200 rounded-xl
                  shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)]">
        <!-- Header -->
        <div class="flex flex-shrink-0 items-center justify-between
                    px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <span id="cfd-title"
                class="text-[11px] font-bold text-gray-700 uppercase tracking-wide"></span>
          <button id="cfd-close" type="button"
                  class="w-5 h-5 flex items-center justify-center rounded
                         text-gray-400 hover:text-gray-700 hover:bg-gray-200
                         transition border-0 bg-transparent cursor-pointer">
            <svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
            </svg>
          </button>
        </div>
        <!-- Body injected by JS per column -->
        <div id="cfd-body" class="overflow-y-auto flex-1 px-2 py-2"></div>
        <!-- Footer -->
        <div class="flex flex-shrink-0 gap-2 px-3 py-2
                    border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button id="cfd-apply" type="button"
                  class="flex-1 py-1.5 text-[11px] font-semibold
                         bg-emerald-600 hover:bg-emerald-700 text-white
                         border-0 rounded-lg cursor-pointer transition">Apply</button>
          <button id="cfd-clear" type="button"
                  class="flex-1 py-1.5 text-[11px] font-medium
                         bg-white hover:bg-gray-50 text-gray-600
                         border border-gray-300 rounded-lg cursor-pointer transition">Clear</button>
        </div>
      </div>

      <!-- Pagination -->
      <div class="px-3 py-2.5 bg-gray-50 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span id="pagination-info" class="text-xs text-gray-500">Showing 0 to 0 of 0 bills</span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button id="prev-page" class="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition" disabled>Prev</button>
            <span id="page-numbers" class="flex gap-1 flex-wrap"></span>
            <button id="next-page" class="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Keyboard hint bar -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 justify-end">
      <span class="flex items-center gap-1">
        <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-500 font-mono text-xs">Ctrl+F</kbd> search
      </span>
      <span class="flex items-center gap-1">
        <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-500 font-mono text-xs">R</kbd> refresh
      </span>
      <span class="flex items-center gap-1">
        <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-500 font-mono text-xs">E</kbd> export
      </span>
      <span class="flex items-center gap-1">
        <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-500 font-mono text-xs">Esc</kbd> close modal
      </span>
      <span class="flex items-center gap-1">
        <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-500 font-mono text-xs">&#8592; &#8594;</kbd> page
      </span>
    </div>

  </div>

  <!-- Bill Details Modal -->
  <div id="bill-modal" class="fixed inset-0 bg-gray-900 bg-opacity-60 overflow-y-auto h-full w-full hidden z-50">
    <div class="relative mx-auto my-6 w-11/12 max-w-4xl">
      <div class="bg-white rounded-xl shadow-2xl overflow-hidden">

        <!-- Modal Header -->
        <div class="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-white">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white">Bill Details</h3>
              <p class="text-xs text-slate-400">Read-only view</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="hidden sm:flex items-center gap-1 text-xs text-slate-400">
              <kbd class="px-1.5 py-0.5 bg-slate-600 border border-slate-500 rounded font-mono text-xs text-slate-300">Esc</kbd>
              close
            </span>
            <button id="close-modal" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition" title="Close (Esc)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="p-4 space-y-4 overflow-y-auto">

          <!-- Bill Meta 4-column grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bill No</p>
              <p id="modal-bill-no" class="text-sm font-bold text-gray-900 font-mono">--</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</p>
              <p id="modal-bill-date" class="text-sm font-semibold text-gray-900">--</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</p>
              <p id="modal-bill-type" class="text-sm font-semibold text-gray-900">--</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</p>
              <p id="modal-bill-status" class="text-sm font-semibold text-gray-900">--</p>
            </div>
          </div>

          <!-- Party Info -->
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Party Information</h4>
            </div>
            <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p class="text-xs text-gray-500 mb-0.5">Party Name</p>
                <p id="modal-party-name" class="text-sm font-medium text-gray-900">--</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-0.5">GSTIN</p>
                <p id="modal-party-gstin" class="text-sm font-mono text-gray-900">--</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-0.5">Address</p>
                <p id="modal-party-address" class="text-sm text-gray-900">--</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-0.5">State</p>
                <p id="modal-party-state" class="text-sm text-gray-900">--</p>
              </div>
            </div>
          </div>

          <!-- Bill Items -->
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bill Items</h4>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-100 text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Rate</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody id="modal-items-body" class="bg-white divide-y divide-gray-100"></tbody>
              </table>
            </div>
          </div>

          <!-- Financials -->
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
              <p class="text-xs text-blue-600 font-medium mb-1">Taxable</p>
              <p id="modal-taxable-amount" class="text-base font-bold text-blue-900">&#8377;0.00</p>
            </div>
            <div class="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
              <p class="text-xs text-orange-600 font-medium mb-1">Tax</p>
              <p id="modal-tax-amount" class="text-base font-bold text-orange-900">&#8377;0.00</p>
            </div>
            <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p class="text-xs text-green-600 font-medium mb-1">Grand Total</p>
              <p id="modal-grand-total" class="text-base font-bold text-green-700">&#8377;0.00</p>
            </div>
          </div>

          <!-- Tax Breakdown -->
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tax Breakdown</h4>
            </div>
            <div class="p-3 grid grid-cols-3 gap-2">
              <div class="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
                <span class="text-xs font-medium text-blue-700">CGST</span>
                <span class="text-xs font-bold text-blue-900" id="modal-cgst">&#8377;0.00</span>
              </div>
              <div class="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
                <span class="text-xs font-medium text-blue-700">SGST</span>
                <span class="text-xs font-bold text-blue-900" id="modal-sgst">&#8377;0.00</span>
              </div>
              <div class="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
                <span class="text-xs font-medium text-blue-700">IGST</span>
                <span class="text-xs font-bold text-blue-900" id="modal-igst">&#8377;0.00</span>
              </div>
            </div>
          </div>

          <!-- Other Charges -->
          <div id="other-charges-section" class="hidden border border-gray-200 rounded-lg overflow-hidden">
            <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Other Charges</h4>
            </div>
            <div id="other-charges-list" class="p-3 space-y-1.5"></div>
          </div>

          <!-- Cancel Bill Section -->
          <div id="cancel-bill-section" class="hidden">
            <div class="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
              <div class="flex items-center justify-between px-3 py-2 border-b border-red-200 bg-red-100">
                <h4 class="text-xs font-semibold text-red-800 uppercase tracking-wide">Cancel Bill</h4>
                <button id="cancel-section-toggle" class="text-red-500 hover:text-red-700 transition" title="Toggle">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
              <div id="cancel-form-content" class="p-3 space-y-3">
                <div>
                  <label class="block text-xs font-medium text-red-700 mb-1">Cancellation Reason <span class="text-red-500">*</span></label>
                  <select id="cancel-reason" class="w-full px-3 py-2 text-sm border border-red-300 rounded-md focus:ring-red-500 focus:border-red-500 bg-white" required>
                    <option value="">Select a reason...</option>
                    <option value="CUSTOMER_REQUEST">Customer Request</option>
                    <option value="DATA_ENTRY_ERROR">Data Entry Error</option>
                    <option value="DUPLICATE_BILL">Duplicate Bill</option>
                    <option value="BILLING_ERROR">Billing Error</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-red-700 mb-1">Remarks / Notes</label>
                  <textarea id="cancel-remarks" rows="2" class="w-full px-3 py-2 text-sm border border-red-300 rounded-md focus:ring-red-500 focus:border-red-500 bg-white resize-none" placeholder="Additional notes about the cancellation..."></textarea>
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <button id="confirm-cancel" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm Cancellation
                  </button>
                  <button id="cancel-cancel" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Action Buttons -->
          <div class="border-t border-gray-200 pt-3">
            <div class="flex flex-wrap items-center gap-2 justify-between">
              <div class="flex flex-wrap gap-2">
                <button id="cancel-bill" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel Bill
                </button>
                <button id="edit-bill" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-md hover:bg-orange-100 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                  Edit
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                <button id="print-bill" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.06-.48.12-.72.18m6.72-1.829c.24.06.48.12.72.18m0 0c.96.24 1.92.48 2.88.72m-3.6-.9c.96-.24 1.92-.48 2.88-.72m-2.88.72V9.36c0-.48-.24-.96-.72-1.2-.48-.24-1.08-.24-1.56 0-.48.24-.72.72-.72 1.2v4.32c0 .48.24.96.72 1.2.48.24 1.08.24 1.56 0 .24-.06.48-.12.72-.18Z" />
                  </svg>
                  Print
                </button>
                <button id="download-pdf" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  PDF
                </button>
                <button id="download-excel" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Excel
                </button>
                <button id="close-modal-bottom" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-200 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                  <kbd class="ml-0.5 px-1 py-0.5 bg-gray-200 border border-gray-300 rounded font-mono text-gray-500 text-xs leading-none">Esc</kbd>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
  `;

  renderLayout(content, router);
  initializeBillsPage(router);
}

// =============================================================================
//  Bills page logic
// =============================================================================
function initializeBillsPage(router) {
  let allBills      = [];
  let filteredBills = [];
  let sortedBills   = [];
  let currentPage   = 1;
  let itemsPerPage  = 10;
  let sortColumn    = '';
  let sortDirection = 'asc';
  let excelListenerAdded = false;

  const getBillPartyName = (bill) =>
    (bill?.btype || 'SALES').toUpperCase() === 'PURCHASE'
      ? (bill?.supply || '—')
      : (bill?.supply || '—');

  // Modal elements
  const modal               = document.getElementById('bill-modal');
  const closeModalBtn       = document.getElementById('close-modal');
  const closeModalBottomBtn = document.getElementById('close-modal-bottom');
  const printBillBtn        = document.getElementById('print-bill');
  const downloadPdfBtn      = document.getElementById('download-pdf');
  const editBillBtn         = document.getElementById('edit-bill');

  const modalBillNo         = document.getElementById('modal-bill-no');
  const modalBillDate       = document.getElementById('modal-bill-date');
  const modalBillType       = document.getElementById('modal-bill-type');
  const modalBillStatus     = document.getElementById('modal-bill-status');
  const modalPartyName      = document.getElementById('modal-party-name');
  const modalPartyGstin     = document.getElementById('modal-party-gstin');
  const modalPartyAddress   = document.getElementById('modal-party-address');
  const modalPartyState     = document.getElementById('modal-party-state');
  const modalItemsBody      = document.getElementById('modal-items-body');
  const modalTaxableAmount  = document.getElementById('modal-taxable-amount');
  const modalTaxAmount      = document.getElementById('modal-tax-amount');
  const modalGrandTotal     = document.getElementById('modal-grand-total');
  const modalCgst           = document.getElementById('modal-cgst');
  const modalSgst           = document.getElementById('modal-sgst');
  const modalIgst           = document.getElementById('modal-igst');
  const otherChargesSection = document.getElementById('other-charges-section');
  const otherChargesList    = document.getElementById('other-charges-list');

  const cancelBillBtn       = document.getElementById('cancel-bill');
  const cancelBillSection   = document.getElementById('cancel-bill-section');
  const cancelSectionToggle = document.getElementById('cancel-section-toggle');
  const cancelFormContent   = document.getElementById('cancel-form-content');
  const cancelReasonSelect  = document.getElementById('cancel-reason');
  const cancelRemarksTextarea = document.getElementById('cancel-remarks');
  const confirmCancelBtn    = document.getElementById('confirm-cancel');
  const cancelCancelBtn     = document.getElementById('cancel-cancel');

  // Page elements
  const searchInput      = document.getElementById('search-bills');
  const typeFilter       = document.getElementById('filter-type');
  const dateFromFilter   = document.getElementById('filter-date-from');
  const dateToFilter     = document.getElementById('filter-date-to');
  const refreshBtn       = document.getElementById('refresh-bills');
  const exportPdfBtn       = document.getElementById('export-bills-pdf');
  const exportBtn        = document.getElementById('export-bills');
  const tableBody        = document.getElementById('bills-table-body');
  const totalBillsEl     = document.getElementById('total-bills');
  const totalRevenueEl   = document.getElementById('total-revenue');
  const totalTaxEl       = document.getElementById('total-tax');
  const activeBillsEl    = document.getElementById('active-bills');
  const paginationInfo   = document.getElementById('pagination-info');
  const prevPageBtn      = document.getElementById('prev-page');
  const nextPageBtn      = document.getElementById('next-page');
  const pageNumbers      = document.getElementById('page-numbers');

  // Items-per-page selector injected into pagination bar
  const itemsPerPageSelect     = document.createElement('select');
  itemsPerPageSelect.id        = 'items-per-page';
  itemsPerPageSelect.className = 'px-2 py-1 text-xs border border-gray-300 rounded focus:ring-orange-400 focus:border-orange-400 bg-white';
  itemsPerPageSelect.innerHTML = `
    <option value="10">10/pg</option>
    <option value="25">25/pg</option>
    <option value="50">50/pg</option>
    <option value="100">100/pg</option>
  `;
  itemsPerPageSelect.value = itemsPerPage;
  const paginationLeft = paginationInfo?.parentElement;
  if (paginationLeft) paginationLeft.appendChild(itemsPerPageSelect);

  // ── Data loading ──────────────────────────────────────────────────────────
  async function loadBills() {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-sm text-gray-400">
          <div class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-4 w-4 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading bills...
          </div>
        </td>
      </tr>
    `;
    try {
      const response = await fetch('/api/inventory/sales/bills', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data    = await response.json();
      allBills      = data || [];
      filteredBills = [...allBills];
      sortedBills   = [...filteredBills];
      if (sortColumn) sortBills(sortColumn, sortDirection);
      currentPage = 1;
      renderBills();
      updateSummary();
      updatePagination();
    } catch (error) {
      console.error('Error loading bills:', error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="px-4 py-8 text-center text-sm text-red-500">
            <div class="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              Failed to load bills &mdash; ${error.message}
            </div>
          </td>
        </tr>
      `;
    }
  }

  // ── Render table rows ─────────────────────────────────────────────────────
  function renderBills() {
    const paginatedBills = getPaginatedBills();

    if (paginatedBills.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="px-4 py-10 text-center text-sm text-gray-400">
            <div class="flex flex-col items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-10 h-10 text-gray-300">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
              No bills found matching your criteria
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = paginatedBills.map(bill => {
      const isCancelled   = (bill.status || 'ACTIVE') === 'CANCELLED';
      const btype         = (bill.btype  || 'SALES').toUpperCase();
      const isPurchase    = btype === 'PURCHASE';
      const isCreditNote  = btype === 'CREDIT_NOTE';
      const isDebitNote   = btype === 'DEBIT_NOTE';
      
      const taxableAmount = bill.gtot || 0;
      const taxAmount     = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
      const totalAmount   = bill.ntot || 0;

      let typeBadge = '';
      if (isPurchase) {
        typeBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">PUR</span>`;
      } else if (isCreditNote) {
        typeBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">CN</span>`;
      } else if (isDebitNote) {
        typeBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">DN</span>`;
      } else {
        typeBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-700">SLS</span>`;
      }

      const statusBadge = isCancelled
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><span class="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"></span>Cancelled</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><span class="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>Active</span>`;

      // Cancelled bills: keep bill no / date / status visible, mask everything else
      const masked = `<span class="font-mono tracking-widest text-gray-300 select-none text-xs">&#9608;&#9608;&#9608;&#9608;</span>`;
      const partyCell   = isCancelled ? masked : `<span class="text-xs text-gray-900">${getBillPartyName(bill)}</span>`;
      const taxableCell = isCancelled ? masked : `<span class="text-xs font-mono text-gray-700">&#8377;${taxableAmount.toFixed(2)}</span>`;
      const taxCell     = isCancelled ? masked : `<span class="text-xs font-mono text-gray-700">&#8377;${taxAmount.toFixed(2)}</span>`;
      const totalCell   = isCancelled ? masked : `<span class="text-xs font-mono font-semibold text-gray-900">&#8377;${totalAmount.toFixed(2)}</span>`;

      const rowCls = isCancelled
        ? 'bg-red-50/60 border-l-2 border-l-red-300'
        : 'hover:bg-amber-50 transition-colors';

      const canReturn = !isCancelled && (btype === 'SALES' || btype === 'PURCHASE');

      return `
        <tr class="${rowCls}" data-bill-id="${bill._id}">
          <td class="px-3 py-2 whitespace-nowrap">
            <span class="text-xs font-bold text-gray-900 font-mono">${bill.bno || '&mdash;'}</span>
          </td>
          <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-600">${formatDate(bill.bdate)}</td>
          <td class="px-3 py-2 whitespace-nowrap hidden sm:table-cell">${partyCell}</td>
          <td class="px-3 py-2 whitespace-nowrap">${typeBadge}</td>
          <td class="px-3 py-2 whitespace-nowrap text-right hidden md:table-cell">${taxableCell}</td>
          <td class="px-3 py-2 whitespace-nowrap text-right hidden md:table-cell">${taxCell}</td>
          <td class="px-3 py-2 whitespace-nowrap text-right">${totalCell}</td>
          <td class="px-3 py-2 whitespace-nowrap">${statusBadge}</td>
          <td class="px-3 py-2 whitespace-nowrap text-center">
            <div class="flex items-center justify-center gap-1">
              <button class="bill-view-btn inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition"
                data-bill-id="${bill._id}" title="View details">
                View
              </button>
              ${canReturn ? `
              <button class="bill-return-btn inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 transition"
                data-bill-id="${bill._id}" data-btype="${btype}" title="Return Items">
                Return
              </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  function updateSummary() {
    const activeBills   = filteredBills.filter(b => b.status !== 'CANCELLED');
    const totalRevenue  = activeBills.reduce((s, b) => s + (b.ntot || 0), 0);
    const totalTax      = activeBills.reduce((s, b) => s + ((b.cgst||0)+(b.sgst||0)+(b.igst||0)), 0);
    totalBillsEl.textContent  = filteredBills.length;
    activeBillsEl.textContent = activeBills.length;
    totalRevenueEl.textContent= '\u20B9' + totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    totalTaxEl.textContent    = '\u20B9' + totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  function filterBills() {
    const searchTerm = searchInput.value.toLowerCase();
    const typeVal    = typeFilter.value;
    const dateFrom   = dateFromFilter.value;
    const dateTo     = dateToFilter.value;

    filteredBills = allBills.filter(bill => {
      const matchesSearch = !searchTerm ||
        (bill.bno  || '').toLowerCase().includes(searchTerm) ||
        getBillPartyName(bill).toLowerCase().includes(searchTerm);
      const matchesType = !typeVal || bill.btype === typeVal;
      let matchesDate   = true;
      if (dateFrom || dateTo) {
        const bd = new Date(bill.bdate);
        if (dateFrom) matchesDate = matchesDate && bd >= new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && bd <= to;
        }
      }
      // ── Column filters (Excel-style) ────────────────────────────────────
      if (!matchesColFilters(bill)) return false;
      return matchesSearch && matchesType && matchesDate;
    });

    sortedBills = [...filteredBills];
    if (sortColumn) {
      sortBills(sortColumn, sortDirection);
    } else {
      currentPage = 1;
      renderBills();
      updateSummary();
      updatePagination();
    }
  }

  // ── Sorting ───────────────────────────────────────────────────────────────
  function sortBills(column, direction) {
    sortColumn    = column;
    sortDirection = direction;
    sortedBills.sort((a, b) => {
      let vA, vB;
      switch (column) {
        case 'bno':   vA = a.bno || '';                       vB = b.bno || '';                       break;
        case 'bdate': vA = new Date(a.bdate || 0);            vB = new Date(b.bdate || 0);            break;
        case 'firm':  vA = getBillPartyName(a).toLowerCase(); vB = getBillPartyName(b).toLowerCase(); break;
        case 'btype': vA = a.btype || '';                     vB = b.btype || '';                     break;
        case 'gtot':  vA = parseFloat(a.gtot || 0);           vB = parseFloat(b.gtot || 0);           break;
        case 'tax':   vA = (a.cgst||0)+(a.sgst||0)+(a.igst||0); vB = (b.cgst||0)+(b.sgst||0)+(b.igst||0); break;
        case 'ntot':  vA = parseFloat(a.ntot || 0);           vB = parseFloat(b.ntot || 0);           break;
        default: return 0;
      }
      if (direction === 'asc') return vA > vB ? 1 : vA < vB ? -1 : 0;
      return vA < vB ? 1 : vA > vB ? -1 : 0;
    });
    updateSortIcons();
    currentPage = 1;
    renderBills();
    updatePagination();
  }

  function updateSortIcons() {
    document.querySelectorAll('th[data-sort]').forEach(h => {
      const col  = h.dataset.sort;
      const icon = h.querySelector('.sort-icon');
      if (!icon) return;
      if (col === sortColumn) {
        icon.classList.remove('opacity-40');
        icon.classList.add('opacity-100');
        icon.innerHTML = sortDirection === 'asc'
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />'
          : '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />';
      } else {
        icon.classList.remove('opacity-100');
        icon.classList.add('opacity-40');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />';
      }
    });
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  function getPaginatedBills() {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedBills.slice(start, start + itemsPerPage);
  }
  function getTotalPages() { return Math.max(1, Math.ceil(sortedBills.length / itemsPerPage)); }

  function updatePagination() {
    const total    = sortedBills.length;
    const pages    = getTotalPages();
    const startItem= total ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endItem  = Math.min(currentPage * itemsPerPage, total);
    paginationInfo.textContent = `Showing ${startItem}–${endItem} of ${total} bills`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === pages;
    renderPageNumbers();
  }

  function renderPageNumbers() {
    const totalPages = getTotalPages();
    pageNumbers.innerHTML = '';
    const range = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      range.push(1);
      if (currentPage > 4) range.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) range.push(i);
      if (currentPage < totalPages - 3) range.push('ellipsis');
      if (totalPages > 1) range.push(totalPages);
    }
    range.forEach(item => {
      if (item === 'ellipsis') {
        const s = document.createElement('span');
        s.textContent = '...';
        s.className   = 'px-1 text-xs text-gray-400 self-center';
        pageNumbers.appendChild(s);
      } else {
        const btn = document.createElement('button');
        btn.textContent = item;
        btn.className   = `px-2.5 py-1 text-xs border rounded transition ${
          item === currentPage
            ? 'bg-orange-500 text-white border-orange-500 font-semibold'
            : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
        }`;
        btn.addEventListener('click', () => goToPage(item));
        pageNumbers.appendChild(btn);
      }
    });
  }

  function goToPage(page) { currentPage = page; renderBills(); updatePagination(); }

  // ── Modal: show bill details ──────────────────────────────────────────────
  async function showBillDetails(billId) {
    modalBillNo.textContent  = '...';
    modalBillDate.textContent= '...';
    modal.classList.remove('hidden');

    try {
      const billMeta   = allBills.find(b => b._id === billId || b.id === billId);
      const btype      = (billMeta?.btype || 'SALES').toUpperCase();
      const apiSegment = btype === 'PURCHASE' ? 'purchase' : 'sales';

      const response = await fetch(`/api/inventory/${apiSegment}/bills/${billId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to load bill details');

      const billData = await response.json();
      const bill     = billData.success ? billData.data : billData;

      modalBillNo.textContent  = bill.bno || '—';
      modalBillDate.textContent= formatDate(bill.bdate);

      const btypeRaw = (bill.btype || 'SALES').toUpperCase();
      const isP = btypeRaw === 'PURCHASE';
      const isCN = btypeRaw === 'CREDIT_NOTE';
      const isDN = btypeRaw === 'DEBIT_NOTE';

      let typeBadge = '';
      if (isP) {
        typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">PURCHASE</span>`;
      } else if (isCN) {
        typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">CREDIT NOTE</span>`;
      } else if (isDN) {
        typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">DEBIT NOTE</span>`;
      } else {
        typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-700">SALES</span>`;
      }
      modalBillType.innerHTML = typeBadge;

      // Show reference bill if it exists
      if (bill.ref_bill_id) {
        const refLink = document.createElement('div');
        refLink.className = 'mt-1 text-[10px] text-blue-600 hover:underline cursor-pointer font-bold';
        refLink.textContent = `Original Bill ID: ${bill.ref_bill_id}`;
        refLink.onclick = () => showBillDetails(bill.ref_bill_id);
        modalBillType.appendChild(refLink);
      }

      const isCancelled = (bill.status || 'ACTIVE') === 'CANCELLED';
      modalBillStatus.innerHTML = isCancelled
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>CANCELLED</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>ACTIVE</span>`;

      modalPartyName.textContent    = getBillPartyName(bill);
      modalPartyGstin.textContent   = bill.gstin || 'UNREGISTERED';
      modalPartyAddress.textContent = bill.addr  || '—';
      modalPartyState.textContent   = bill.state || '—';

      modalItemsBody.innerHTML = '';
      if (bill.items && bill.items.length > 0) {
        bill.items.forEach(item => {
          const isService = (item.item_type || 'GOODS') === 'SERVICE';
          const showQty = !isService || item.show_qty !== false;
          const row = document.createElement('tr');
          row.className = 'hover:bg-gray-50';
          row.innerHTML = `
            <td class="px-3 py-2 text-xs font-medium text-gray-900">${item.item  || '—'}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${isService ? '—' : (item.batch || '—')}</td>
            <td class="px-3 py-2 text-xs text-right font-mono text-gray-700">${showQty ? (item.qty || 0) : '—'}</td>
            <td class="px-3 py-2 text-xs text-right font-mono text-gray-700">&#8377;${(item.rate  || 0).toFixed(2)}</td>
            <td class="px-3 py-2 text-xs text-right font-mono font-semibold text-gray-900">&#8377;${(item.total || 0).toFixed(2)}</td>
          `;
          modalItemsBody.appendChild(row);
        });
      } else {
        modalItemsBody.innerHTML = `<tr><td colspan="5" class="px-3 py-4 text-center text-xs text-gray-400">No items found</td></tr>`;
      }

      const taxableAmount = bill.gtot || 0;
      const taxAmount     = (bill.cgst||0) + (bill.sgst||0) + (bill.igst||0);
      const grandTotal    = bill.ntot || 0;
      modalTaxableAmount.textContent = '\u20B9' + taxableAmount.toFixed(2);
      modalTaxAmount.textContent     = '\u20B9' + taxAmount.toFixed(2);
      modalGrandTotal.textContent    = '\u20B9' + grandTotal.toFixed(2);
      modalCgst.textContent = '\u20B9' + (bill.cgst||0).toFixed(2);
      modalSgst.textContent = '\u20B9' + (bill.sgst||0).toFixed(2);
      modalIgst.textContent = '\u20B9' + (bill.igst||0).toFixed(2);

      if (bill.otherCharges && bill.otherCharges.length > 0) {
        otherChargesSection.classList.remove('hidden');
        otherChargesList.innerHTML = '';
        bill.otherCharges.forEach(charge => {
          const div = document.createElement('div');
          div.className = 'flex justify-between items-center px-3 py-2 bg-gray-50 rounded border border-gray-100 text-xs';
          div.innerHTML = `
            <span class="font-medium text-gray-700">${charge.name || charge.type}</span>
            <span class="font-bold text-gray-900 font-mono">&#8377;${(charge.amount||0).toFixed(2)}</span>
          `;
          otherChargesList.appendChild(div);
        });
      } else {
        otherChargesSection.classList.add('hidden');
      }

      modal.setAttribute('data-current-bill-id',   billId);
      modal.setAttribute('data-current-bill-type', bill.btype || 'SALES');

      if (!excelListenerAdded) {
        const dlExcelBtn = document.getElementById('download-excel');
        if (dlExcelBtn) {
          dlExcelBtn.addEventListener('click', () => {
            const id = modal.getAttribute('data-current-bill-id');
            if (id) downloadExcel(id); else alert('No bill selected.');
          });
          excelListenerAdded = true;
        }
      }

      if (isCancelled) {
        cancelBillBtn.disabled = true;
        cancelBillBtn.classList.add('opacity-40', 'cursor-not-allowed');
        cancelBillBtn.textContent = 'Already Cancelled';
      } else {
        cancelBillBtn.disabled = false;
        cancelBillBtn.classList.remove('opacity-40', 'cursor-not-allowed');
        cancelBillBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel Bill
        `;
      }

      resetCancelForm();

    } catch (error) {
      console.error('Error loading bill details:', error);
      modal.classList.add('hidden');
      alert('Failed to load bill details. Please try again.');
    }
  }

  // ── Modal: close ──────────────────────────────────────────────────────────
  function closeModal() {
    modal.classList.add('hidden');
    modal.removeAttribute('data-current-bill-id');
    modal.removeAttribute('data-current-bill-type');
    resetCancelForm();
  }

  // ── Download helpers ──────────────────────────────────────────────────────
  function downloadPdf(billId) {
    const btype      = (modal.getAttribute('data-current-bill-type') || 'SALES').toUpperCase();
    const apiSegment = btype === 'PURCHASE' ? 'purchase' : 'sales';
    const link       = document.createElement('a');
    link.rel         = 'noopener noreferrer';
    fetch(`/api/inventory/${apiSegment}/bills/${billId}/pdf`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => {
      if (!r.ok) { alert('Failed to download PDF.'); return; }
      r.blob().then(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url; link.download = `Invoice_${billId}.pdf`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
      });
    }).catch(e => alert('PDF error: ' + e.message));
  }

  function downloadExcel(billId) {
    const btype      = (modal.getAttribute('data-current-bill-type') || 'SALES').toUpperCase();
    const apiSegment = btype === 'PURCHASE' ? 'purchase' : 'sales';
    const link       = document.createElement('a');
    link.rel         = 'noopener noreferrer';
    fetch(`/api/inventory/${apiSegment}/bills/${billId}/excel`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => {
      if (!r.ok) { alert('Failed to download Excel.'); return; }
      r.blob().then(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url; link.download = `Invoice_${billId}.xlsx`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
      });
    }).catch(e => alert('Excel error: ' + e.message));
  }

  function printBill() { window.print(); }

  // ── Cancel bill ───────────────────────────────────────────────────────────
  async function cancelBill(billId) {
    const reason  = cancelReasonSelect.value;
    const remarks = cancelRemarksTextarea.value.trim();
    if (!reason) { alert('Please select a cancellation reason.'); cancelReasonSelect.focus(); return; }
    if (!confirm('Are you sure you want to cancel this bill? This cannot be undone.')) return;

    confirmCancelBtn.disabled    = true;
    confirmCancelBtn.textContent = 'Cancelling...';
    try {
      const btype      = (modal.getAttribute('data-current-bill-type') || 'SALES').toUpperCase();
      const apiSegment = btype === 'PURCHASE' ? 'purchase' : 'sales';
      const response   = await fetchWithCSRF(`/api/inventory/${apiSegment}/bills/${billId}/cancel`, {
        method: 'PUT',
        body: JSON.stringify({ reason, remarks })
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to cancel bill'); }
      modalBillStatus.innerHTML = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>CANCELLED</span>`;
      cancelBillBtn.disabled    = true;
      cancelBillBtn.classList.add('opacity-40', 'cursor-not-allowed');
      cancelBillBtn.textContent = 'Already Cancelled';
      cancelBillSection.classList.add('hidden');
      alert('Bill cancelled successfully.');
      await loadBills();
    } catch (error) {
      console.error('Error cancelling bill:', error);
      alert('Failed to cancel bill: ' + error.message);
    } finally {
      confirmCancelBtn.disabled    = false;
      confirmCancelBtn.innerHTML   = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Confirm Cancellation
      `;
    }
  }

  function toggleCancelSection() {
    const hidden = cancelFormContent.classList.contains('hidden');
    cancelFormContent.classList.toggle('hidden', !hidden);
    cancelSectionToggle.innerHTML = hidden
      ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>`;
  }

  function resetCancelForm() {
    if (cancelReasonSelect)    cancelReasonSelect.value   = '';
    if (cancelRemarksTextarea) cancelRemarksTextarea.value = '';
    if (cancelFormContent)     cancelFormContent.classList.add('hidden');
    if (cancelBillSection)     cancelBillSection.classList.add('hidden');
  }

  // ── Export (page-level) ───────────────────────────────────────────────────
  function exportToExcel() {
    const params = new URLSearchParams();
    if (typeFilter.value)     params.append('type',       typeFilter.value);
    if (searchInput.value)    params.append('searchTerm', searchInput.value);
    if (dateFromFilter.value) params.append('dateFrom',   dateFromFilter.value);
    if (dateToFilter.value)   params.append('dateTo',     dateToFilter.value);
    fetch(`/api/inventory/sales/bills/export?${params.toString()}`, {
      credentials: 'same-origin',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => {
      if (!r.ok) { alert('Export failed.'); return; }
      r.blob().then(blob => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = `bills-report-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
      });
    }).catch(e => alert('Export error: ' + e.message));
  }

  function exportToPdf() {
    const params = new URLSearchParams();
    if (typeFilter.value)     params.append('type',       typeFilter.value);
    if (searchInput.value)    params.append('searchTerm', searchInput.value);
    if (dateFromFilter.value) params.append('dateFrom',   dateFromFilter.value);
    if (dateToFilter.value)   params.append('dateTo',     dateToFilter.value);
    fetch(`/api/inventory/sales/bills/export/pdf?${params.toString()}`, {
      credentials: 'same-origin',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => {
      if (!r.ok) { alert('Export failed.'); return; }
      r.blob().then(blob => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = `bills-report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
      });
    }).catch(e => alert('Export error: ' + e.message));
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  function formatDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  EXCEL-STYLE COLUMN FILTERS
  // ═══════════════════════════════════════════════════════════════════════

  // Per-column filter state.
  // Text/choice cols: Set of allowed values (null = no filter)
  // Number cols:      { min, max } (null = no filter)
  const colFilters = {
    bno: null, bdate: null, firm: null, btype: null,
    gtot: null, tax: null, ntot: null, status: null,
  };

  // Column definitions for the dropdown builder
  const COL_CONFIG = {
    bno:    { label: 'Bill No',   type: 'text',   getValue: b => b.bno || '' },
    bdate:  { label: 'Date',      type: 'text',   getValue: b => formatDate(b.bdate) },
    firm:   { label: 'Party',     type: 'text',   getValue: b => getBillPartyName(b) },
    btype:  { label: 'Type',      type: 'choice', getValue: b => b.btype || 'SALES' },
    gtot:   { label: 'Taxable',   type: 'number', getValue: b => b.gtot || 0 },
    tax:    { label: 'Tax',       type: 'number', getValue: b => (b.cgst||0)+(b.sgst||0)+(b.igst||0) },
    ntot:   { label: 'Total',     type: 'number', getValue: b => b.ntot || 0 },
    status: { label: 'Status',    type: 'choice', getValue: b => b.status || 'ACTIVE' },
  };

  // Check a single bill against all active column filters
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

  // ── Singleton dropdown ────────────────────────────────────────────────────
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
    // Compute position BEFORE making visible (avoids layout flash).
    // element.style.top / element.style.left are JS DOM property assignments —
    // NOT inline CSS attributes — they are permitted under style-src 'self'.
    const rect = btn.getBoundingClientRect();
    const ddW  = 256;   // w-64 = 16rem = 256px
    const ddH  = 384;   // max-h-96 = 24rem = 384px
    let   top  = rect.bottom + 6;
    let   left = rect.left;

    if (top  + ddH > window.innerHeight - 16) top  = Math.max(8, rect.top - ddH - 6);
    if (left + ddW > window.innerWidth  - 16) left = Math.max(8, window.innerWidth - ddW - 16);

    // JS DOM props — CSP-safe
    cfDropdown.style.top  = top  + 'px';
    cfDropdown.style.left = left + 'px';

    // Toggle display via classList (Tailwind utility classes)
    cfDropdown.classList.remove('hidden');
    cfDropdown.classList.add('flex');
  }

  function closeColFilter() {
    cfDropdown.classList.add('hidden');
    cfDropdown.classList.remove('flex');
    cfActiveCol = null;
  }

  // Build the dropdown body.
  // Number cols  → min/max range inputs (Tailwind classes, no style="").
  // Text/choice  → search + Select All + checkbox list built with DOM APIs
  //                (className, not style.cssText — label collapse fix applied).
  function buildFilterBody(col, cfg) {
    cfBody.innerHTML = '';

    if (cfg.type === 'number') {
      // ── Number range ──────────────────────────────────────────────────────
      const cur     = colFilters[col] || { min: '', max: '' };
      const minVal  = cur.min ?? '';
      const maxVal  = cur.max ?? '';
      // innerHTML is fine here — purely Tailwind classes, zero style attributes
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
      // ── Checkbox list ─────────────────────────────────────────────────────
      // All elements built with DOM APIs. className used throughout (CSP-safe).
      // style.cssText / onmouseover are NOT used anywhere here.
      const allVals = [...new Set(allBills.map(b => String(cfg.getValue(b))).filter(Boolean))].sort();
      const curSet  = colFilters[col] instanceof Set ? colFilters[col] : null; // null = all selected

      // ── Search row (innerHTML — pure Tailwind, no style= attributes) ────
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

      // ── Select All row ──────────────────────────────────────────────────
      const saWrap = document.createElement('div');
      saWrap.className = 'border-b border-gray-100 pb-1 mb-1';

      const saLabel = document.createElement('label');
      // hover:bg-gray-50 applied via Tailwind class — no onmouseover
      saLabel.className = 'flex items-center gap-2 px-1 py-1 rounded cursor-pointer select-none hover:bg-gray-50 w-full';

      const saCb = document.createElement('input');
      saCb.type  = 'checkbox';
      saCb.id    = 'cfd-select-all';
      // accent-emerald-600 = Tailwind accent-color utility (v3)
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

      // ── Options list ────────────────────────────────────────────────────
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
        // THE FIX: min-w-0 + flex-1 + truncate — correct Tailwind approach.
        // Previous attempt used style.cssText which is blocked by CSP.
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

      // ── Search handler (show/hide via classList, not style.display) ─────
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        optsList.querySelectorAll('.cfd-option').forEach(opt => {
          opt.classList.toggle('hidden', !!(q && !opt.dataset.val.toLowerCase().includes(q)));
        });
        syncSelectAll(saCb, optsList);
      });

      // ── Select All toggle ───────────────────────────────────────────────
      saCb.addEventListener('change', () => {
        const visible = [...optsList.querySelectorAll('.cfd-option:not(.hidden)')];
        visible.forEach(o => { o.querySelector('.cfd-checkbox').checked = saCb.checked; });
      });

      // ── Individual checkbox → sync Select All ───────────────────────────
      optsList.addEventListener('change', () => syncSelectAll(saCb, optsList));
    }
  }

  // visible = not hidden by search; checked = checkbox ticked
  function syncSelectAll(saCb, optsList) {
    const visible = [...optsList.querySelectorAll('.cfd-option:not(.hidden)')];
    const total   = visible.length;
    const checked = visible.filter(o => o.querySelector('.cfd-checkbox').checked).length;
    saCb.checked       = total > 0 && checked === total;
    saCb.indeterminate = checked > 0 && checked < total;
  }

  // Read current dropdown values and return a filter state object
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
      const allVals = [...new Set(allBills.map(b => String(cfg.getValue(b))).filter(Boolean))].sort();
      const allCbs  = [...cfBody.querySelectorAll('.cfd-checkbox')];
      const checked = allCbs.filter(cb => cb.checked).map(cb => cb.value);
      // All checked = no filter
      if (checked.length === allVals.length) return null;
      return checked.length === 0 ? new Set() : new Set(checked);
    }
  }

  // Apply button
  cfApply.addEventListener('click', () => {
    if (!cfActiveCol) return;
    colFilters[cfActiveCol] = readDropdownState(cfActiveCol);
    updateFilterBadge(cfActiveCol);
    closeColFilter();
    filterBills();
  });

  // Clear button
  cfClear.addEventListener('click', () => {
    if (!cfActiveCol) return;
    colFilters[cfActiveCol] = null;
    updateFilterBadge(cfActiveCol);
    closeColFilter();
    filterBills();
  });

  // X button closes without applying
  cfClose.addEventListener('click', closeColFilter);

  // Click outside closes dropdown — check cfActiveCol (no style.display check needed)
  document.addEventListener('click', e => {
    if (!cfActiveCol) return;
    if (!cfDropdown.contains(e.target) && !e.target.closest('.col-filter-btn')) {
      closeColFilter();
    }
  }, true);

  // Escape closes dropdown
  // (handled in the existing keydown listener below — we'll hook into it)

  // Wire filter buttons (event delegation on thead to avoid re-wiring after re-renders)
  document.querySelector('thead').addEventListener('click', e => {
    const btn = e.target.closest('.col-filter-btn');
    if (!btn) return;
    e.stopPropagation();  // ← prevents sort from firing
    const col = btn.dataset.col;
    if (!col || !COL_CONFIG[col]) return;
    if (cfActiveCol === col && !cfDropdown.classList.contains('hidden')) {
      closeColFilter();
    } else {
      openColFilter(col, btn);
    }
  });

  // ── Event listeners ───────────────────────────────────────────────────────
  searchInput.addEventListener('input',     filterBills);
  typeFilter.addEventListener('change',     filterBills);
  dateFromFilter.addEventListener('change', filterBills);
  dateToFilter.addEventListener('change',   filterBills);
  refreshBtn.addEventListener('click',      loadBills);
  exportBtn.addEventListener('click',       exportToExcel);
  exportPdfBtn.addEventListener('click',      exportToPdf);

  document.querySelectorAll('th[data-sort]').forEach(h => {
    h.addEventListener('click', () => {
      sortBills(h.dataset.sort, (sortColumn === h.dataset.sort && sortDirection === 'asc') ? 'desc' : 'asc');
    });
  });

  prevPageBtn.addEventListener('click', () => { if (currentPage > 1)               goToPage(currentPage - 1); });
  nextPageBtn.addEventListener('click', () => { if (currentPage < getTotalPages())  goToPage(currentPage + 1); });

  itemsPerPageSelect.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value);
    currentPage  = 1;
    renderBills();
    updatePagination();
  });

  // Table → open modal / handle return (event delegation, CSP-safe)
  tableBody.addEventListener('click', e => {
    const viewBtn = e.target.classList.contains('bill-view-btn') ? e.target : e.target.closest('.bill-view-btn');
    const returnBtn = e.target.classList.contains('bill-return-btn') ? e.target : e.target.closest('.bill-return-btn');

    if (viewBtn) {
      const id = viewBtn.getAttribute('data-bill-id');
      if (id) showBillDetails(id);
    } else if (returnBtn) {
      const id = returnBtn.getAttribute('data-bill-id');
      const btype = returnBtn.getAttribute('data-btype');
      if (id) {
        sessionStorage.setItem('returnFromBillId', id);
        router.navigate(btype === 'PURCHASE' ? '/inventory/prs' : '/inventory/sls');
      }
    }
  });

  if (closeModalBtn)       closeModalBtn.addEventListener('click',       closeModal);
  if (closeModalBottomBtn) closeModalBottomBtn.addEventListener('click', closeModal);
  if (modal)               modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  if (printBillBtn)   printBillBtn.addEventListener('click',   () => printBill());
  if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', () => {
    const id = modal.getAttribute('data-current-bill-id');
    if (id) downloadPdf(id); else alert('No bill selected.');
  });
  if (editBillBtn) editBillBtn.addEventListener('click', () => {
    const id    = modal.getAttribute('data-current-bill-id');
    const btype = (modal.getAttribute('data-current-bill-type') || 'SALES').toUpperCase();
    if (id) {
      sessionStorage.setItem('editBillId', id);
      router.navigate(btype === 'PURCHASE' ? '/inventory/prs' : '/inventory/sls');
    } else {
      alert('No bill selected.');
    }
  });

  if (cancelBillBtn) cancelBillBtn.addEventListener('click', () => {
    const id = modal.getAttribute('data-current-bill-id');
    if (id) { cancelBillSection.classList.remove('hidden'); cancelReasonSelect.focus(); }
  });
  if (cancelSectionToggle) cancelSectionToggle.addEventListener('click', toggleCancelSection);
  if (confirmCancelBtn)    confirmCancelBtn.addEventListener('click', () => {
    const id = modal.getAttribute('data-current-bill-id');
    if (id) cancelBill(id);
  });
  if (cancelCancelBtn) cancelCancelBtn.addEventListener('click', () => {
    cancelBillSection.classList.add('hidden');
    resetCancelForm();
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    // Esc always closes modal
    if (e.key === 'Escape' && cfActiveCol) { closeColFilter(); return; }
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
      return;
    }
    // Don't fire shortcuts while typing
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (e.key === 'r' || e.key === 'R') { loadBills();       return; }
    if (e.key === 'e' || e.key === 'E') { exportToExcel();   return; }
    if (e.key === 'p' || e.key === 'P') { exportToPdf();   return; }
    if (e.key === 'ArrowLeft'  && currentPage > 1)              goToPage(currentPage - 1);
    if (e.key === 'ArrowRight' && currentPage < getTotalPages()) goToPage(currentPage + 1);
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  updateSortIcons();
  loadBills();
}