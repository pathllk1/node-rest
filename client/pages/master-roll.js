import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../utils/api.js';
import { downloadAppointmentLetter } from '../utils/appointmentLetterGenerator.js';

export async function renderMasterRoll(router) {
  // Check authentication
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  // Wait for XLSX library to load
  await loadXLSX();

  const content = getMasterRollHTML();
  renderLayout(content, router);
  
  // Initialize scripts after DOM is ready
  setTimeout(() => {
    initMasterRollScripts();
  }, 100);
}

function loadXLSX() {
  return new Promise((resolve) => {
    if (window.XLSX) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = '/public/cdns/xlsx.full.min.js';
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

function getMasterRollHTML() {
  return `
<div class="space-y-4">
  <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
    <div>
      <h1 class="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        Master Roll Dashboard
      </h1>
      <p class="text-sm text-gray-600 mt-1">Manage your employee records efficiently</p>
    </div>
    
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative">
        <input type="text" id="search-input" placeholder="Search employees..." 
               class="pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition w-64 bg-white shadow-sm" />
        <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>

      <button id="filters-btn" class="relative bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl shadow-sm transition duration-200 flex items-center gap-2 text-sm font-medium border border-gray-300">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
        </svg>
        Filters
        <span id="filter-badge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
      </button>

      <button id="columns-btn" class="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl shadow-sm transition duration-200 flex items-center gap-2 text-sm font-medium border border-gray-300">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
        </svg>
        Columns
      </button>

      <div class="relative">
        <button id="bulk-actions-btn" disabled class="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl shadow-sm transition duration-200 flex items-center gap-2 text-sm font-medium border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
          Actions
          <span id="selected-count" class="hidden bg-indigo-600 text-white text-xs rounded-full px-2 py-0.5">0</span>
        </button>
        <div id="bulk-actions-menu" class="hidden absolute top-full right-0 min-w-[180px] bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <button class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2" data-action="export-selected">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export Selected
          </button>
          <button class="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2" data-action="delete-selected">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Delete Selected
          </button>
        </div>
      </div>

      <button id="import-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl shadow-sm transition duration-200 flex items-center gap-2 text-sm font-medium">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
        Import Excel
      </button>
      <input type="file" id="import-file-input" accept=".xlsx, .xls, .csv" class="hidden" />

      <button id="export-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-sm transition duration-200 flex items-center gap-2 text-sm font-medium">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Export All
      </button>

      <button id="open-modal-btn" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition duration-200 flex items-center gap-2 text-sm font-semibold">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Employee
      </button>
    </div>
  </div>

  <div id="filters-panel" class="hidden bg-white shadow-lg rounded-xl p-4 border border-gray-200 animate-slide-in">
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-semibold text-gray-900 flex items-center gap-2">
        <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
        </svg>
        Advanced Filters
      </h3>
      <button id="clear-filters-btn" class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Clear All</button>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1.5">Joining Date From</label>
        <input type="date" id="filter-date-from" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1.5">Joining Date To</label>
        <input type="date" id="filter-date-to" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
      </div>

      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1.5">Min Daily Wage</label>
        <input type="number" id="filter-wage-min" placeholder="₹ 0" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1.5">Max Daily Wage</label>
        <input type="number" id="filter-wage-max" placeholder="₹ 9999" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
      </div>

      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
        <select id="filter-status" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="On Leave">On Leave</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
        <select id="filter-category" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          <option value="">All Categories</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1.5">Project</label>
        <select id="filter-project" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          <option value="">All Projects</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1.5">Site</label>
        <select id="filter-site" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          <option value="">All Sites</option>
        </select>
      </div>
      
      <div class="flex items-end">
        <button id="apply-filters-btn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition text-sm font-semibold">
          Apply Filters
        </button>
      </div>
    </div>
  </div>

  <div id="columns-panel" class="hidden bg-white shadow-lg rounded-xl p-4 border border-gray-200 animate-slide-in">
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-semibold text-gray-900">Toggle Columns</h3>
      <div class="flex gap-2">
        <button id="show-all-columns" class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Show All</button>
        <button id="hide-all-columns" class="text-sm text-gray-600 hover:text-gray-800 font-medium">Hide All</button>
      </div>
    </div>
    <div id="columns-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"></div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Total Employees</p>
          <p id="stat-total" class="text-2xl font-bold text-gray-900">0</p>
        </div>
        <div class="bg-indigo-100 p-3 rounded-lg">
          <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Active Employees</p>
          <p id="stat-active" class="text-2xl font-bold text-emerald-600">0</p>
        </div>
        <div class="bg-emerald-100 p-3 rounded-lg">
          <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Avg Daily Wage</p>
          <p id="stat-avg-wage" class="text-2xl font-bold text-purple-600">₹0</p>
        </div>
        <div class="bg-purple-100 p-3 rounded-lg">
          <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Showing</p>
          <p id="stat-filtered" class="text-2xl font-bold text-gray-900">0</p>
        </div>
        <div class="bg-gray-100 p-3 rounded-lg">
          <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
      </div>
    </div>
  </div>

  <div class="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm divide-y divide-gray-200" id="masterroll-table">
        <thead class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <tr id="table-header">
            <th class="px-4 py-3 text-center w-12">
              <input type="checkbox" id="select-all" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
            </th>
          </tr>
        </thead>
        <tbody id="table-body" class="bg-white divide-y divide-gray-100"></tbody>
      </table>
    </div>
    
    <div class="px-4 py-3 bg-gray-50 border-t border-gray-200" id="pagination"></div>
  </div>
</div>

<div id="modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
  <div class="flex items-center justify-center min-h-screen p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in">
      <div class="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center rounded-t-xl z-10">
        <h2 id="modal-title" class="text-xl font-bold">Add New Employee</h2>
        <button id="close-modal-btn" class="text-white hover:text-gray-200 transition text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20">
          &times;
        </button>
      </div>

      <form id="create-form" class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div class="flex flex-col">
             <label class="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <span class="text-sm">🚦</span> Status <span class="text-red-500">*</span>
             </label>
             <select name="status" required
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
                <option value="Suspended">Suspended</option>
             </select>
          </div>

          ${getFormFields()}
          
          <div class="flex flex-col md:col-span-2 lg:col-span-3">
            <label class="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
              <span class="text-sm">📝</span> Remarks
            </label>
            <textarea name="doe_rem" rows="3" 
                      class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                      placeholder="Enter any additional remarks"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button type="button" id="cancel-btn" 
                  class="px-5 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition duration-200 text-sm font-semibold">
            Cancel
          </button>
          <button type="button" id="generate-letter-btn" 
                  class="px-5 py-2.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition duration-200 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Download Letter
          </button>
          <button type="submit" 
                  class="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition duration-200 text-sm font-semibold shadow-sm">
            Save Employee
          </button>
        </div>

        <div id="wages-history-section" class="hidden mt-6 pt-4 border-t border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Wages History
            </div>
            <button id="export-wages-history-btn" type="button" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg shadow-sm transition duration-200 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Export
            </button>
          </h3>
          <div id="wages-history-content" class="space-y-3 max-h-80 overflow-y-auto">
            <!-- Wages history will be populated here -->
            <div class="text-center text-gray-500 py-8">
              <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p class="text-sm">Loading wages history...</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</div>
`;
}

function getFormFields() {
  const fields = [
    { label: "Employee Name", name: "employee_name", type: "text", required: true, icon: "👤" },
    { label: "Father/Husband Name", name: "father_husband_name", type: "text", required: true, icon: "👨" },
    { label: "Aadhar", name: "aadhar", type: "text", required: true, icon: "🆔", maxlength: 12 },
    { label: "PAN", name: "pan", type: "text", icon: "💳", maxlength: 10 },
    { label: "Phone", name: "phone_no", type: "tel", required: true, icon: "📱", maxlength: 10 },
    { label: "Address", name: "address", type: "text", icon: "🏠", colSpan: 2 },
    { label: "Bank", name: "bank", type: "text", icon: "🏦" },
    { label: "Account No", name: "account_no", type: "text", icon: "💰" },
    { label: "IFSC", name: "ifsc", type: "text", icon: "🔢", maxlength: 11 },
    { label: "BRANCH", name: "branch", type: "text", icon: "🏠", maxlength: 11 },
    { label: "UAN", name: "uan", type: "text", icon: "🔐" },
    { label: "ESIC No", name: "esic_no", type: "text", icon: "🏥" },
    { label: "S Kalyan No", name: "s_kalyan_no", type: "text", icon: "📋" },
    { label: "Category", name: "category", type: "text", icon: "📂", datalist: true },
    { label: "Per Day Wage", name: "p_day_wage", type: "number", step: "0.01", icon: "💵" },
    { label: "Project", name: "project", type: "text", icon: "🏗️", datalist: true },
    { label: "Site", name: "site", type: "text", icon: "📍", datalist: true },
    { label: "Date of Birth", name: "date_of_birth", type: "date", required: true, icon: "🎂" },
    { label: "Date of Joining", name: "date_of_joining", type: "date", required: true, icon: "📅" },
    { label: "Date of Exit", name: "date_of_exit", type: "date", icon: "🚪" },
  ];

  return fields.map(f => `
    <div class="flex flex-col ${f.colSpan ? `md:col-span-${f.colSpan} lg:col-span-${f.colSpan}` : ""}">
      <label class="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
        <span class="text-sm">${f.icon || ""}</span> ${f.label}${f.required ? ' <span class="text-red-500">*</span>' : ''}
      </label>
      <input class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
             name="${f.name}"
             type="${f.type || "text"}"
             step="${f.step || ""}"
             maxlength="${f.maxlength || ""}"
             ${f.datalist ? `list="${f.name}-list"` : ''}
             ${f.required ? "required" : ""}
             placeholder="Enter ${f.label.toLowerCase()}" />
      ${f.datalist ? `<datalist id="${f.name}-list"></datalist>` : ''}
    </div>
  `).join('');
}

function initMasterRollScripts() {
  // Initialize the Master Roll Dashboard logic
  const masterRollManager = new MasterRollManager();
  masterRollManager.init();
}

class MasterRollManager {
  constructor() {
    this.masterRolls = [];
    this.filteredRolls = [];
    this.editingId = null;
    this.currentPage = 1;
    this.rowsPerPage = 10;
    this.currentSort = { column: null, asc: true };
    this.selectedRows = new Set();
    this.columnVisibility = {
      employee_name: true,
      status: true,
      father_husband_name: false,
      aadhar: true,
      pan: false,
      phone_no: true,
      address: false,
      bank: true,
      account_no: false,
      ifsc: false,
      uan: false,
      esic_no: false,
      s_kalyan_no: false,
      category: false,
      p_day_wage: false,
      project: false,
      site: false,
      date_of_birth: false,
      date_of_joining: true,
      date_of_exit: false,
      doe_rem: false
    };
    this.advancedFilters = {
      dateRange: { from: '', to: '' },
      wage: { min: '', max: '' },
      category: '',
      project: '',
      site: '',
      status: ''
    };

    this.allColumns = [
      { key: 'employee_name', label: 'Employee Name', sortable: true },
      { key: 'status', label: 'Status', sortable: true },
      { key: 'father_husband_name', label: 'Father/Husband', sortable: true },
      { key: 'aadhar', label: 'Aadhar', sortable: false },
      { key: 'pan', label: 'PAN', sortable: false },
      { key: 'phone_no', label: 'Phone', sortable: true },
      { key: 'address', label: 'Address', sortable: false },
      { key: 'bank', label: 'Bank', sortable: true },
      { key: 'account_no', label: 'Account No', sortable: false },
      { key: 'ifsc', label: 'IFSC', sortable: true },
      { key: 'uan', label: 'UAN', sortable: false },
      { key: 'esic_no', label: 'ESIC No', sortable: false },
      { key: 's_kalyan_no', label: 'S Kalyan No', sortable: false },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'p_day_wage', label: 'Daily Wage', sortable: true },
      { key: 'project', label: 'Project', sortable: true },
      { key: 'site', label: 'Site', sortable: true },
      { key: 'date_of_birth', label: 'DOB', sortable: true },
      { key: 'date_of_joining', label: 'Joining Date', sortable: true },
      { key: 'date_of_exit', label: 'Exit Date', sortable: true },
      { key: 'doe_rem', label: 'Remarks', sortable: false }
    ];

    this.excelHeaderMap = {
      "Employee Name": "employee_name",
      "Status": "status",
      "Father/Husband": "father_husband_name",
      "Father Name": "father_husband_name",
      "Aadhar": "aadhar",
      "PAN": "pan",
      "Phone": "phone_no",
      "Mobile": "phone_no",
      "Address": "address",
      "Bank": "bank",
      "Account No": "account_no",
      "IFSC": "ifsc",
      "BRANCH": "branch",
      "UAN": "uan",
      "ESIC": "esic_no",
      "ESIC No": "esic_no",
      "S Kalyan": "s_kalyan_no",
      "Category": "category",
      "Wage": "p_day_wage",
      "Daily Wage": "p_day_wage",
      "Per Day Wage": "p_day_wage",
      "Project": "project",
      "Site": "site",
      "DOB": "date_of_birth",
      "Date of Birth": "date_of_birth",
      "DOJ": "date_of_joining",
      "Date of Joining": "date_of_joining",
      "Joining Date": "date_of_joining",
      "Join Date": "date_of_joining",
      "DOE": "date_of_exit",
      "Date of Exit": "date_of_exit",
      "Date_of_Exit": "date_of_exit",
      "Remarks": "doe_rem"
    };

    // Wages history data for export
    this.currentWagesHistory = null;
    this.currentEmployeeName = '';
  }

  init() {
    this.cacheElements();
    this.attachEventListeners();
    this.renderColumnToggles();
    this.fetchMasterRolls();
  }

  cacheElements() {
    this.elements = {
      tableBody: document.getElementById("table-body"),
      tableHeader: document.getElementById("table-header"),
      modal: document.getElementById("modal"),
      openModalBtn: document.getElementById("open-modal-btn"),
      closeModalBtn: document.getElementById("close-modal-btn"),
      cancelBtn: document.getElementById("cancel-btn"),
      form: document.getElementById("create-form"),
      modalTitle: document.getElementById("modal-title"),
      searchInput: document.getElementById("search-input"),
      generateLetterBtn: document.getElementById("generate-letter-btn"),
      exportBtn: document.getElementById("export-btn"),
      paginationContainer: document.getElementById("pagination"),
      selectAllCheckbox: document.getElementById("select-all"),
      bulkActionsBtn: document.getElementById("bulk-actions-btn"),
      bulkActionsMenu: document.getElementById("bulk-actions-menu"),
      selectedCountSpan: document.getElementById("selected-count"),
      filtersBtn: document.getElementById("filters-btn"),
      filtersPanel: document.getElementById("filters-panel"),
      columnsBtn: document.getElementById("columns-btn"),
      columnsPanel: document.getElementById("columns-panel"),
      columnsList: document.getElementById("columns-list"),
      importBtn: document.getElementById("import-btn"),
      fileInput: document.getElementById("import-file-input")
    };
  }

  attachEventListeners() {
    const { 
      openModalBtn, closeModalBtn, cancelBtn, modal, form, 
      searchInput, generateLetterBtn, exportBtn, filtersBtn, filtersPanel,
      columnsBtn, columnsPanel, bulkActionsBtn, bulkActionsMenu,
      importBtn, fileInput
    } = this.elements;

    // Modal
    openModalBtn.addEventListener("click", () => this.openModal());
    closeModalBtn.addEventListener("click", () => this.closeModal());
    cancelBtn.addEventListener("click", () => this.closeModal());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.closeModal();
    });

    // Form
    form.addEventListener("submit", (e) => this.handleFormSubmit(e));

    // Generate Appointment Letter
    generateLetterBtn.addEventListener("click", () => this.handleGenerateAppointmentLetter());

    // IFSC Lookup - automatically fetch bank and branch details
    this.setupIFSCLookup();

    // Search
    searchInput.addEventListener("input", () => {
      this.applyAdvancedFilters();
      this.renderTable();
    });

    // Export
    exportBtn.addEventListener("click", () => this.exportToExcel(this.filteredRolls, `MasterRoll_${new Date().toISOString().split('T')[0]}.xlsx`));

    // Filters
    filtersBtn.addEventListener("click", () => {
      filtersPanel.classList.toggle("hidden");
      columnsPanel.classList.add("hidden");
    });

    document.getElementById("apply-filters-btn").addEventListener("click", () => this.applyFilters());
    document.getElementById("clear-filters-btn").addEventListener("click", () => this.clearFilters());

    // Columns
    columnsBtn.addEventListener("click", () => {
      columnsPanel.classList.toggle("hidden");
      filtersPanel.classList.add("hidden");
    });

    document.getElementById("show-all-columns").addEventListener("click", () => this.showAllColumns());
    document.getElementById("hide-all-columns").addEventListener("click", () => this.hideAllColumns());

    // Bulk Actions
    bulkActionsBtn.addEventListener("click", () => {
      bulkActionsMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!bulkActionsBtn.contains(e.target) && !bulkActionsMenu.contains(e.target)) {
        bulkActionsMenu.classList.add("hidden");
      }
    });

    bulkActionsMenu.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "export-selected") this.exportSelected();
        if (action === "delete-selected") this.bulkDeleteSelected();
        bulkActionsMenu.classList.add("hidden");
      });
    });

    // Import
    importBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => this.handleFileImport(e));

    // Close modal on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.elements.modal.classList.contains("hidden")) {
        this.closeModal();
      }
    });
  }

  getAuthHeaders() {
    const token = localStorage.getItem("accessToken");
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  IFSC AUTO-LOOKUP
  //  Wires an input listener to the IFSC field in the modal form.
  //  When the user types a complete 11-character IFSC code, it calls the server
  //  API and automatically populates the Bank and Branch fields.
  //
  //  Features:
  //  • Debounced lookup (500ms after user stops typing)
  //  • Only triggers when exactly 11 characters are entered
  //  • Visual feedback with loading state
  //  • Error handling with user-friendly messages
  //  • Preserves manually entered bank/branch if API fails
  // ═══════════════════════════════════════════════════════════════════════════
  setupIFSCLookup() {
    const ifscInput = this.elements.form.querySelector('[name="ifsc"]');
    const bankInput = this.elements.form.querySelector('[name="bank"]');
    const branchInput = this.elements.form.querySelector('[name="branch"]');

    // Safety guard: if any of the required fields are missing, bail out
    if (!ifscInput || !bankInput || !branchInput) {
      console.warn('[IFSC] Could not find ifsc/bank/branch inputs — lookup disabled.');
      return;
    }

    let debounceTimer = null;
    let lastLookedUpIFSC = '';

    // Helper: visual state management for the IFSC input
    const setIFSCState = (state) => {
      // Remove all state classes first
      ifscInput.classList.remove(
        'border-gray-300', 'border-green-500', 'border-red-400',
        'ring-2', 'ring-green-200', 'ring-red-200'
      );

      // Remove any existing status badge
      const existingBadge = ifscInput.parentElement.querySelector('.ifsc-status');
      if (existingBadge) existingBadge.remove();

      if (state === 'loading') {
        ifscInput.disabled = true;
        const badge = document.createElement('span');
        badge.className = 'ifsc-status absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400';
        badge.textContent = '⏳';
        ifscInput.parentElement.classList.add('relative');
        ifscInput.parentElement.appendChild(badge);
      } else if (state === 'success') {
        ifscInput.disabled = false;
        ifscInput.classList.add('border-green-500', 'ring-2', 'ring-green-200');
        const badge = document.createElement('span');
        badge.className = 'ifsc-status absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600';
        badge.textContent = '✓';
        ifscInput.parentElement.classList.add('relative');
        ifscInput.parentElement.appendChild(badge);
      } else if (state === 'error') {
        ifscInput.disabled = false;
        ifscInput.classList.add('border-red-400', 'ring-2', 'ring-red-200');
        const badge = document.createElement('span');
        badge.className = 'ifsc-status absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-500';
        badge.textContent = '✗';
        ifscInput.parentElement.classList.add('relative');
        ifscInput.parentElement.appendChild(badge);
      } else {
        // 'idle' — back to default styling
        ifscInput.disabled = false;
        ifscInput.classList.add('border-gray-300');
      }
    };

    // Main lookup function
    const lookupIFSC = async (ifscCode) => {
      const normalizedIFSC = ifscCode.toUpperCase();

      // Skip if same IFSC was already looked up successfully
      if (normalizedIFSC === lastLookedUpIFSC) return;

      setIFSCState('loading');

      try {
        const response = await fetch(`/api/master-rolls/lookup-ifsc/${normalizedIFSC}`, {
          method: 'GET',
          headers: this.getAuthHeaders()
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

          if (response.status === 404) {
            this.showToast(`IFSC "${normalizedIFSC}" not found. Please check the code.`, 'error');
          } else {
            this.showToast(`IFSC lookup failed: ${errorData.error || 'Unknown error'}`, 'error');
          }

          setIFSCState('error');
          lastLookedUpIFSC = ''; // allow retry after correction
          return;
        }

        const data = await response.json();

        if (data.success && data.data) {
          // Only populate if the API returned values (never overwrite with empty strings)
          if (data.data.bank) bankInput.value = data.data.bank;
          if (data.data.branch) branchInput.value = data.data.branch;

          lastLookedUpIFSC = normalizedIFSC;
          setIFSCState('success');
          this.showToast(`✓ Bank details filled for IFSC ${normalizedIFSC}`, 'success');
        } else {
          throw new Error(data.error || 'Invalid response from server');
        }

      } catch (error) {
        console.error('[IFSC lookup] Error:', error);
        this.showToast('Could not reach IFSC lookup service. Please enter Bank/Branch manually.', 'error');
        setIFSCState('error');
        lastLookedUpIFSC = '';
      }
    };

    // Input listener with debounce
    ifscInput.addEventListener('input', () => {
      // Reset visual state and last lookup guard when user starts editing
      setIFSCState('idle');
      lastLookedUpIFSC = '';

      // Clear any pending debounce timer
      clearTimeout(debounceTimer);

      const value = ifscInput.value.trim();

      // Only fire when we have exactly 11 characters (complete IFSC)
      if (value.length !== 11) return;

      // Debounce: wait 500ms after user stops typing before calling API
      debounceTimer = setTimeout(() => {
        lookupIFSC(value);
      }, 500);
    });

    // Reset state when modal is closed/reset
    this.elements.form.addEventListener('reset', () => {
      clearTimeout(debounceTimer);
      lastLookedUpIFSC = '';
      setIFSCState('idle');
    });
  }

  showToast(message, type = "success") {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: type === "success" ? "#10b981"
                      : type === "warning" ? "#f59e0b"
                      : "#ef4444",
      close: true,
    }).showToast();
  }

  maskAadhar(aadhar) {
    if (!aadhar) return "";
    return "XXXX-XXXX-" + aadhar.slice(-4);
  }

  async fetchMasterRolls() {
    try {
      const res = await fetch("/api/master-rolls", {
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const json = await res.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch master rolls');
      }
      
      this.masterRolls = json.data || [];
      this.filteredRolls = [...this.masterRolls];
      this.currentPage = 1;
      this.selectedRows.clear();
      
      this.populateFilterDropdowns();
      this.updateStats();
      this.renderTableHeader();
      this.renderTable();
    } catch (err) {
      this.showToast("Failed to fetch data: " + err.message, "error");
      console.error("Fetch error:", err);
    }
  }

  async createMasterRoll(data) {
    try {
      const res = await fetchWithCSRF("/api/master-rolls", {
        method: "POST",
        body: JSON.stringify(data),
      });
      
      // Check HTTP status first
      if (!res.ok) {
        const json = await res.json();
        this.showToast(json.error || `Failed to add employee (${res.status})`, "error");
        console.error(`[CREATE] HTTP ${res.status}:`, json);
        return;
      }
      
      const json = await res.json();
      if (json.success) {
        this.showToast(`Employee "${data.employee_name}" added successfully!`);
        await this.fetchMasterRolls();
      } else {
        this.showToast(json.error || "Failed to add employee", "error");
      }
    } catch (err) {
      this.showToast("Error adding employee", "error");
      console.error(err);
    }
  }

  async updateMasterRoll(id, data) {
    try {
      const res = await fetchWithCSRF(`/api/master-rolls/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      
      // Check HTTP status first
      if (!res.ok) {
        const json = await res.json();
        this.showToast(json.error || `Failed to update employee (${res.status})`, "error");
        console.error(`[UPDATE] HTTP ${res.status}:`, json);
        return;
      }
      
      const json = await res.json();
      if (json.success) {
        this.showToast(`Employee "${data.employee_name}" updated successfully!`);
        await this.fetchMasterRolls();
      } else {
        this.showToast(json.error || "Failed to update employee", "error");
      }
    } catch (err) {
      this.showToast("Error updating employee", "error");
      console.error(err);
    }
  }

  async deleteMasterRoll(id) {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      const row = this.masterRolls.find(r => r.id == id);
      const res = await fetchWithCSRF(`/api/master-rolls/${id}`, { 
        method: "DELETE"
      });
      
      // Check HTTP status first
      if (!res.ok) {
        const json = await res.json();
        this.showToast(json.error || `Failed to delete employee (${res.status})`, "error");
        console.error(`[DELETE] HTTP ${res.status}:`, json);
        return;
      }
      
      const json = await res.json();
      if (json.success) {
        this.showToast(`Employee "${row.employee_name}" deleted successfully!`);
        await this.fetchMasterRolls();
      } else {
        this.showToast(json.error || "Failed to delete employee", "error");
      }
    } catch (err) {
      this.showToast("Error deleting employee", "error");
      console.error(err);
    }
  }

  async bulkDeleteSelected() {
    if (!confirm(`Are you sure you want to delete ${this.selectedRows.size} employees?`)) return;

    try {
      const ids = Array.from(this.selectedRows);
      const res = await fetchWithCSRF("/api/master-rolls/bulk-delete", {
        method: "DELETE",
        body: JSON.stringify({ ids })
      });
      
      // Check HTTP status first
      if (!res.ok) {
        const json = await res.json();
        this.showToast(json.error || `Failed to delete employees (${res.status})`, "error");
        console.error(`[BULK DELETE] HTTP ${res.status}:`, json);
        return;
      }
      
      const json = await res.json();
      if (json.success) {
        this.showToast(`${ids.length} employees deleted successfully!`);
        this.selectedRows.clear();
        await this.fetchMasterRolls();
      } else {
        this.showToast(json.error || "Failed to delete employees", "error");
      }
    } catch (err) {
      this.showToast("Error deleting employees", "error");
      console.error(err);
    }
  }

  exportSelected() {
    const selected = this.masterRolls.filter(r => this.selectedRows.has(r.id));
    this.exportToExcel(selected, `MasterRoll_Selected_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  exportToExcel(data, filename) {
    if (data.length === 0) {
      this.showToast("No data to export", "error");
      return;
    }

    const XLSX = window.XLSX;
    if (!XLSX) {
      this.showToast("Excel library not loaded", "error");
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws_data = [
      this.allColumns.map(col => col.label),
      ...data.map(r => this.allColumns.map(col => r[col.key] ?? ''))
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    const colWidths = ws_data[0].map((_, i) => ({
      wch: Math.max(...ws_data.map(row => String(row[i] || "").length)) + 2
    }));
    ws['!cols'] = colWidths;

    // Add styling: header color and borders
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Style header row (bold, gold background)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_ref = XLSX.utils.encode_cell({ c: C, r: 0 });
      if (ws[cell_ref]) {
        ws[cell_ref].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "FFD700" } }, // Gold color
          border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
        };
      }
    }
    
    // Add borders to all cells
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
        if (ws[cell_ref]) {
          if (!ws[cell_ref].s) ws[cell_ref].s = {};
          ws[cell_ref].s.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Master Roll");
    XLSX.writeFile(wb, filename);
    this.showToast(`Excel file exported successfully! (${data.length} records)`);
  }

  async handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = window.XLSX.read(data, { type: 'binary' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = window.XLSX.utils.sheet_to_json(worksheet);

        if (rawData.length === 0) {
          this.showToast("The selected Excel file is empty", "error");
          return;
        }

        const mappedData = rawData.map(row => {
          const newRow = {};
          Object.keys(row).forEach(oldKey => {
            const cleanKey = oldKey.trim();
            const dbKey = this.excelHeaderMap[cleanKey];

            if (dbKey) {
              let value = row[oldKey];
              if ((dbKey.includes('date') || dbKey === 'dob') && typeof value === 'number') {
                const date = new Date(Math.round((value - 25569) * 86400 * 1000));
                value = date.toISOString().split('T')[0];
              }
              newRow[dbKey] = value;
            }
          });
          return newRow;
        });

        await this.uploadBulkData(mappedData);

      } catch (err) {
        console.error("Error processing Excel:", err);
        this.showToast("Failed to process Excel file. Please ensure valid format", "error");
      }
    };

    reader.readAsBinaryString(file);
  }

  async uploadBulkData(jsonData) {
    const originalText = this.elements.importBtn.innerHTML;
    this.elements.importBtn.innerHTML = `<span>⏳ Uploading...</span>`;
    this.elements.importBtn.disabled = true;

    try {
      const res = await fetchWithCSRF("/api/master-rolls/bulk", {
        method: "POST",
        body: JSON.stringify(jsonData)
      });

      // Check HTTP status first
      if (!res.ok) {
        const json = await res.json();
        this.showToast(json.error || `Upload failed (${res.status})`, "error");
        console.error(`[BULK UPLOAD] HTTP ${res.status}:`, json);
        return;
      }

      const result = await res.json();

      if (result.success) {
        let msg = `✅ Imported: ${result.imported}`;
        if (result.failed > 0) {
          msg += ` | ❌ Failed: ${result.failed}`;
          console.warn("Import Failures:", result.errors);
          this.showToast(`${msg} - Check console for details`, result.failed > 0 ? "warning" : "success");
        } else {
          this.showToast("Excel uploaded successfully!", "success");
        }

        this.fetchMasterRolls();
      } else {
        this.showToast("Upload failed: " + result.error, "error");
      }

    } catch (err) {
      console.error("Upload error:", err);
      this.showToast("Server error during upload", "error");
    } finally {
      this.elements.importBtn.innerHTML = originalText;
      this.elements.importBtn.disabled = false;
    }
  }

  updateStats() {
    document.getElementById("stat-total").textContent = this.masterRolls.length;
    const active = this.masterRolls.filter(r => !r.date_of_exit).length;
    document.getElementById("stat-active").textContent = active;

    const wages = this.masterRolls.filter(r => r.p_day_wage).map(r => parseFloat(r.p_day_wage));
    const avgWage = wages.length ? (wages.reduce((a, b) => a + b, 0) / wages.length).toFixed(2) : 0;
    document.getElementById("stat-avg-wage").textContent = `₹${avgWage}`;

    document.getElementById("stat-filtered").textContent = this.filteredRolls.length;
  }

  updateFilterBadge() {
    let activeFilters = 0;
    if (this.advancedFilters.dateRange.from || this.advancedFilters.dateRange.to) activeFilters++;
    if (this.advancedFilters.wage.min || this.advancedFilters.wage.max) activeFilters++;
    if (this.advancedFilters.category) activeFilters++;
    if (this.advancedFilters.project) activeFilters++;
    if (this.advancedFilters.site) activeFilters++;

    const badge = document.getElementById("filter-badge");
    if (activeFilters > 0) {
      badge.textContent = activeFilters;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  populateFilterDropdowns() {
    try {
      const categories = [...new Set(this.masterRolls.map(r => r.category).filter(Boolean))];
      const projects = [...new Set(this.masterRolls.map(r => r.project).filter(Boolean))];
      const sites = [...new Set(this.masterRolls.map(r => r.site).filter(Boolean))];

      const categorySelect = document.getElementById("filter-category");
      if (categorySelect) {
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
          categories.map(c => `<option value="${c}">${c}</option>`).join('');
      }

      const projectSelect = document.getElementById("filter-project");
      if (projectSelect) {
        projectSelect.innerHTML = '<option value="">All Projects</option>' +
          projects.map(p => `<option value="${p}">${p}</option>`).join('');
      }

      const siteSelect = document.getElementById("filter-site");
      if (siteSelect) {
        siteSelect.innerHTML = '<option value="">All Sites</option>' +
          sites.map(s => `<option value="${s}">${s}</option>`).join('');
      }

      // Populate modal datalists
      const categoryDatalist = document.getElementById("category-list");
      if (categoryDatalist) {
        categoryDatalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
      }

      const projectDatalist = document.getElementById("project-list");
      if (projectDatalist) {
        projectDatalist.innerHTML = projects.map(p => `<option value="${p}">`).join('');
      }

      const siteDatalist = document.getElementById("site-list");
      if (siteDatalist) {
        siteDatalist.innerHTML = sites.map(s => `<option value="${s}">`).join('');
      }
    } catch (err) {
      console.error('Error populating filter dropdowns:', err);
    }
  }

  renderColumnToggles() {
    if (!this.elements.columnsList) {
      console.error('columnsList element not found!');
      return;
    }
    
    this.elements.columnsList.innerHTML = this.allColumns.map(col => `
      <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
        <input type="checkbox" 
               class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
               data-column="${col.key}" 
               ${this.columnVisibility[col.key] ? 'checked' : ''}>
        <span class="text-sm text-gray-700">${col.label}</span>
      </label>
    `).join('');

    this.elements.columnsList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.columnVisibility[checkbox.dataset.column] = checkbox.checked;
        this.renderTableHeader();
        this.renderTable();
      });
    });
  }

  renderTableHeader() {
    if (!this.elements.tableHeader) {
      console.error('tableHeader element not found!');
      return;
    }
    
    const visibleColumns = this.allColumns.filter(col => this.columnVisibility[col.key]);
    const headerCells = visibleColumns.map(col => `
      <th ${col.sortable ? `data-col="${col.key}"` : ''} 
          class="px-4 py-3 text-left font-semibold ${col.sortable ? 'cursor-pointer hover:bg-purple-700 transition' : ''}">
        <div class="flex items-center gap-2">
          ${col.label}
          ${col.sortable ? '<span class="text-xs opacity-70">⇅</span>' : ''}
          ${this.currentSort.column === col.key ? (this.currentSort.asc ? ' ▲' : ' ▼') : ''}
        </div>
      </th>
    `).join('');

    this.elements.tableHeader.innerHTML = `
      <th class="px-4 py-3 text-center w-12">
        <input type="checkbox" id="select-all" class="w-4 h-4 rounded border-gray-300 text-white focus:ring-white cursor-pointer">
      </th>
      ${headerCells}
      <th class="px-4 py-3 text-right font-semibold">Actions</th>
    `;

    // Re-attach event listeners
    document.getElementById("select-all")?.addEventListener("change", (e) => this.handleSelectAll(e));
    document.querySelectorAll("#masterroll-table th[data-col]").forEach(th => {
      th.addEventListener("click", () => {
        this.sortData(th.dataset.col);
        this.renderTable();
      });
    });
  }

  paginate(array, page = 1, rows = 10) {
    const start = (page - 1) * rows;
    const end = start + rows;
    return array.slice(start, end);
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredRolls.length / this.rowsPerPage) || 1;
    let pages = [];

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    const startRecord = this.filteredRolls.length > 0 ? (this.currentPage - 1) * this.rowsPerPage + 1 : 0;
    const endRecord = Math.min(this.currentPage * this.rowsPerPage, this.filteredRolls.length);

    this.elements.paginationContainer.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex flex-col sm:flex-row items-center gap-3 text-sm">
          <span class="text-gray-600">
            Showing <span class="font-semibold text-gray-900">${startRecord}-${endRecord}</span> of 
            <span class="font-semibold text-gray-900">${this.filteredRolls.length}</span> entries
          </span>
          <div class="flex items-center gap-2">
            <label for="rows-per-page" class="text-gray-600">Rows:</label>
            <select id="rows-per-page" class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              ${[5, 10, 25, 50, 100].map(r => `<option value="${r}" ${r === this.rowsPerPage ? "selected" : ""}>${r}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button data-action="prev" ${this.currentPage === 1 ? "disabled" : ""} 
                  class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium text-gray-700">
            ← Prev
          </button>

          ${startPage > 1 ? `<span class="px-2 text-gray-400 text-sm">...</span>` : ""}

          ${pages.map(p => `
            <button data-page="${p}" class="px-3 py-1.5 rounded-lg text-sm font-medium transition ${p === this.currentPage
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'border border-gray-300 hover:bg-indigo-50 text-gray-700'}">
              ${p}
            </button>
          `).join('')}

          ${endPage < totalPages ? `<span class="px-2 text-gray-400 text-sm">...</span>` : ""}

          <button data-action="next" ${this.currentPage === totalPages ? "disabled" : ""} 
                  class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium text-gray-700">
            Next →
          </button>
        </div>
      </div>
    `;

    this.elements.paginationContainer.querySelectorAll("button[data-page]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.renderTable();
      });
    });

    this.elements.paginationContainer.querySelector("button[data-action='prev']")?.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderTable();
      }
    });

    this.elements.paginationContainer.querySelector("button[data-action='next']")?.addEventListener("click", () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderTable();
      }
    });

    document.getElementById("rows-per-page")?.addEventListener("change", (e) => {
      this.rowsPerPage = parseInt(e.target.value);
      this.currentPage = 1;
      this.renderTable();
    });
  }

  sortData(column) {
    if (this.currentSort.column === column) {
      this.currentSort.asc = !this.currentSort.asc;
    } else {
      this.currentSort.column = column;
      this.currentSort.asc = true;
    }

    this.filteredRolls.sort((a, b) => {
      const valA = a[column] ?? "";
      const valB = b[column] ?? "";
      if (valA < valB) return this.currentSort.asc ? -1 : 1;
      if (valA > valB) return this.currentSort.asc ? 1 : -1;
      return 0;
    });

    this.renderTableHeader();
  }

  applyAdvancedFilters() {
    let filtered = [...this.masterRolls];

    const searchTerm = this.elements.searchInput.value.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(r =>
        Object.values(r).some(v => String(v).toLowerCase().includes(searchTerm))
      );
    }

    if (this.advancedFilters.dateRange.from) {
      filtered = filtered.filter(r => r.date_of_joining >= this.advancedFilters.dateRange.from);
    }
    if (this.advancedFilters.dateRange.to) {
      filtered = filtered.filter(r => r.date_of_joining <= this.advancedFilters.dateRange.to);
    }

    if (this.advancedFilters.wage.min) {
      filtered = filtered.filter(r => parseFloat(r.p_day_wage || 0) >= parseFloat(this.advancedFilters.wage.min));
    }
    if (this.advancedFilters.wage.max) {
      filtered = filtered.filter(r => parseFloat(r.p_day_wage || 0) <= parseFloat(this.advancedFilters.wage.max));
    }

    if (this.advancedFilters.category) {
      filtered = filtered.filter(r => r.category === this.advancedFilters.category);
    }
    if (this.advancedFilters.project) {
      filtered = filtered.filter(r => r.project === this.advancedFilters.project);
    }
    if (this.advancedFilters.site) {
      filtered = filtered.filter(r => r.site === this.advancedFilters.site);
    }
    if (this.advancedFilters.status) {
      filtered = filtered.filter(r => r.status === this.advancedFilters.status);
    }

    this.filteredRolls = filtered;
    this.currentPage = 1;
    this.updateFilterBadge();
  }

  handleSelectAll(e) {
    const checked = e.target.checked;
    const pageData = this.paginate(this.filteredRolls, this.currentPage, this.rowsPerPage);

    pageData.forEach(row => {
      if (checked) {
        this.selectedRows.add(row.id);
      } else {
        this.selectedRows.delete(row.id);
      }
    });

    this.updateBulkActionsUI();
    this.renderTable();
  }

  updateBulkActionsUI() {
    const count = this.selectedRows.size;
    this.elements.bulkActionsBtn.disabled = count === 0;

    if (count > 0) {
      this.elements.selectedCountSpan.textContent = count;
      this.elements.selectedCountSpan.classList.remove("hidden");
    } else {
      this.elements.selectedCountSpan.classList.add("hidden");
    }
  }

  renderTable() {
    if (!this.elements.tableBody) {
      console.error('tableBody element not found!');
      return;
    }
    
    const pageData = this.paginate(this.filteredRolls, this.currentPage, this.rowsPerPage);
    const visibleColumns = this.allColumns.filter(col => this.columnVisibility[col.key]);

    if (pageData.length === 0) {
      this.elements.tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleColumns.length + 2}" class="p-12 text-center text-gray-500">
            <div class="flex flex-col items-center gap-3">
              <svg class="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
              </svg>
              <span class="text-xl font-semibold text-gray-400">No employees found</span>
              <span class="text-sm text-gray-400">Try adjusting your filters or search criteria</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      this.elements.tableBody.innerHTML = pageData.map((row, idx) => {
        const isSelected = this.selectedRows.has(row.id);
        const cells = visibleColumns.map(col => {
          let value = row[col.key] ?? '-';
          if (col.key === 'aadhar') value = this.maskAadhar(value);
          if (col.key === 'p_day_wage' && value !== '-') value = `₹${value}`;
          return `<td class="px-4 py-3 text-gray-700">${value}</td>`;
        }).join('');

        return `
          <tr class="hover:bg-indigo-50 transition duration-150 ${isSelected ? 'table-row-selected' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}">
            <td class="px-4 py-3 text-center">
              <input type="checkbox" 
                     class="row-checkbox w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                     data-id="${row.id}"
                     ${isSelected ? 'checked' : ''}>
            </td>
            ${cells}
            <td class="px-2 py-2">
              <div class="flex items-center justify-center gap-2">
                <button
                  data-id="${row.id}"
                  class="edit-btn text-emerald-600 hover:text-emerald-800 transition"
                  title="Edit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                       viewBox="0 0 24 24" stroke-width="1.5"
                       stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                  </svg>
                </button>

                <button
                  data-id="${row.id}"
                  class="delete-btn text-red-600 hover:text-red-800 transition"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                       viewBox="0 0 24 24" stroke-width="1.5"
                       stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");

      // Row checkbox handlers
      document.querySelectorAll(".row-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
          const id = checkbox.dataset.id;
          if (e.target.checked) {
            this.selectedRows.add(id);
          } else {
            this.selectedRows.delete(id);
          }
          this.updateBulkActionsUI();
          this.renderTable();
        });
      });

      // Edit button handlers
      document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const row = this.masterRolls.find(r => r.id == id);
          if (!row) return;
          for (const key in row) {
            const input = this.elements.form.querySelector(`[name=${key}]`);
            if (input) input.value = row[key] ?? "";
          }
          this.editingId = id;
          this.elements.modalTitle.textContent = "Edit Employee";
          this.elements.generateLetterBtn.disabled = false;
          
          // Show wages history section
          document.getElementById("wages-history-section").classList.remove("hidden");
          
          // Fetch and display wages history
          await this.loadWagesHistory(id);
          
          this.elements.modal.classList.remove("hidden");
        });
      });

      // Delete button handlers
      document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => this.deleteMasterRoll(btn.dataset.id));
      });
    }

    this.renderPagination();
    this.updateStats();
  }

  openModal() {
    this.elements.modalTitle.textContent = "Add New Employee";
    this.elements.form.reset();
    this.editingId = null;
    this.elements.generateLetterBtn.disabled = true;
    document.getElementById("wages-history-section").classList.add("hidden");
    this.elements.modal.classList.remove("hidden");
  }

  closeModal() {
    this.elements.modal.classList.add("hidden");
    this.elements.form.reset();
    this.editingId = null;
    this.elements.generateLetterBtn.disabled = true;
    document.getElementById("wages-history-section").classList.add("hidden");
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(this.elements.form).entries());

    if (!/^\d{12}$/.test(data.aadhar)) {
      this.showToast("Aadhar must be exactly 12 digits", "error");
      return;
    }

    if (data.phone_no && !/^\d{10}$/.test(data.phone_no)) {
      this.showToast("Phone must be exactly 10 digits", "error");
      return;
    }

    if (data.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(data.pan.toUpperCase())) {
      this.showToast("Invalid PAN format (e.g., ABCDE1234F)", "error");
      return;
    }

    if (this.editingId) await this.updateMasterRoll(this.editingId, data);
    else await this.createMasterRoll(data);
    
    this.elements.form.reset();
    this.editingId = null;
    this.closeModal();
  }

  applyFilters() {
    this.advancedFilters.dateRange.from = document.getElementById("filter-date-from").value;
    this.advancedFilters.dateRange.to = document.getElementById("filter-date-to").value;
    this.advancedFilters.wage.min = document.getElementById("filter-wage-min").value;
    this.advancedFilters.wage.max = document.getElementById("filter-wage-max").value;
    this.advancedFilters.category = document.getElementById("filter-category").value;
    this.advancedFilters.project = document.getElementById("filter-project").value;
    this.advancedFilters.site = document.getElementById("filter-site").value;
    this.advancedFilters.status = document.getElementById("filter-status").value;

    this.applyAdvancedFilters();
    this.renderTable();
  }

  clearFilters() {
    document.getElementById("filter-date-from").value = '';
    document.getElementById("filter-date-to").value = '';
    document.getElementById("filter-wage-min").value = '';
    document.getElementById("filter-wage-max").value = '';
    document.getElementById("filter-category").value = '';
    document.getElementById("filter-project").value = '';
    document.getElementById("filter-site").value = '';
    document.getElementById("filter-status").value = '';

    this.advancedFilters = { 
      dateRange: { from: '', to: '' }, 
      wage: { min: '', max: '' }, 
      category: '', 
      project: '', 
      site: '',
      status: ''
    };
    this.applyAdvancedFilters();
    this.renderTable();
  }

  showAllColumns() {
    Object.keys(this.columnVisibility).forEach(key => this.columnVisibility[key] = true);
    this.renderColumnToggles();
    this.renderTableHeader();
    this.renderTable();
  }

  hideAllColumns() {
    Object.keys(this.columnVisibility).forEach(key => this.columnVisibility[key] = false);
    // Keep essential columns visible
    this.columnVisibility.employee_name = true;
    this.columnVisibility.phone_no = true;
    this.renderColumnToggles();
    this.renderTableHeader();
    this.renderTable();
  }

  async loadWagesHistory(masterRollId) {
    const contentDiv = document.getElementById("wages-history-content");
    if (!contentDiv) return;

    // Show loading
    contentDiv.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        <p class="text-sm">Loading wages history...</p>
      </div>
    `;

    try {
      const response = await fetch(`/api/wages/history/${masterRollId}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to load wages history');
      }

      const history = data.data.history || [];

      if (history.length === 0) {
        contentDiv.innerHTML = `
          <div class="text-center text-gray-500 py-8">
            <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p class="text-sm">No wages history found for this employee.</p>
          </div>
        `;
        // Store data for export
        this.currentWagesHistory = history;
        this.currentEmployeeName = data.data.employee.name;
        return;
      }

      // Store data for export
      this.currentWagesHistory = history;
      this.currentEmployeeName = data.data.employee.name;

      // Render wages history as a table
      const wagesHTML = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm border border-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left font-semibold text-gray-900 border-b">Month</th>
                <th class="px-4 py-2 text-center font-semibold text-gray-900 border-b">Days</th>
                <th class="px-4 py-2 text-right font-semibold text-gray-900 border-b">Gross</th>
                <th class="px-4 py-2 text-right font-semibold text-gray-900 border-b">Net</th>
                <th class="px-4 py-2 text-right font-semibold text-gray-900 border-b">EPF</th>
                <th class="px-4 py-2 text-right font-semibold text-gray-900 border-b">ESIC</th>
                <th class="px-4 py-2 text-right font-semibold text-gray-900 border-b">Other Ded.</th>
                <th class="px-4 py-2 text-right font-semibold text-gray-900 border-b">Other Ben.</th>
                <th class="px-4 py-2 text-left font-semibold text-gray-900 border-b">Paid Date</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${history.map(wage => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">${wage.month}</td>
                  <td class="px-4 py-3 text-center text-gray-700">${wage.wage_days}</td>
                  <td class="px-4 py-3 text-right font-semibold text-gray-900">₹${parseFloat(wage.gross_salary).toLocaleString()}</td>
                  <td class="px-4 py-3 text-right font-semibold text-green-600">₹${parseFloat(wage.net_salary).toLocaleString()}</td>
                  <td class="px-4 py-3 text-right text-red-600">-₹${parseFloat(wage.epf_deduction || 0).toLocaleString()}</td>
                  <td class="px-4 py-3 text-right text-red-600">-₹${parseFloat(wage.esic_deduction || 0).toLocaleString()}</td>
                  <td class="px-4 py-3 text-right text-red-600">-₹${parseFloat(wage.other_deduction || 0).toLocaleString()}</td>
                  <td class="px-4 py-3 text-right text-green-600">+₹${parseFloat(wage.other_benefit || 0).toLocaleString()}</td>
                  <td class="px-4 py-3 text-gray-700">${wage.paid_date ? new Date(wage.paid_date).toLocaleDateString() : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      contentDiv.innerHTML = wagesHTML;

      // Attach export button handler
      const exportBtn = document.getElementById("export-wages-history-btn");
      if (exportBtn) {
        exportBtn.onclick = () => this.exportWagesHistory(this.currentEmployeeName, this.currentWagesHistory);
      }

    } catch (error) {
      console.error('Error loading wages history:', error);
      contentDiv.innerHTML = `
        <div class="text-center text-red-500 py-8">
          <svg class="w-12 h-12 mx-auto mb-3 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-sm">Failed to load wages history.</p>
          <p class="text-xs text-gray-500 mt-1">${error.message}</p>
        </div>
      `;
    }
  }

  async exportWagesHistory(employeeName, history) {
    if (!history || history.length === 0) {
      this.showToast('No wages history to export', 'warning');
      return;
    }

    const XLSX = window.XLSX;
    if (!XLSX) {
      this.showToast('Excel library not loaded', 'error');
      return;
    }

    try {
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([]);

      // Add headers
      const headers = [
        'Month', 'Working Days', 'Gross Salary', 'Net Salary', 
        'EPF Deduction', 'ESIC Deduction', 'Other Deduction', 'Other Benefit', 'Paid Date'
      ];

      // Prepare data
      const data = history.map(wage => ({
        'Month': wage.month,
        'Working Days': wage.wage_days,
        'Gross Salary': parseFloat(wage.gross_salary),
        'Net Salary': parseFloat(wage.net_salary),
        'EPF Deduction': parseFloat(wage.epf_deduction || 0),
        'ESIC Deduction': parseFloat(wage.esic_deduction || 0),
        'Other Deduction': parseFloat(wage.other_deduction || 0),
        'Other Benefit': parseFloat(wage.other_benefit || 0),
        'Paid Date': wage.paid_date ? new Date(wage.paid_date).toLocaleDateString() : ''
      }));

      // Create worksheet with data
      XLSX.utils.sheet_add_json(ws, data, { header: headers, skipHeader: false });

      // Set column widths
      const colWidths = [
        { wch: 10 }, // Month
        { wch: 12 }, // Working Days
        { wch: 12 }, // Gross Salary
        { wch: 12 }, // Net Salary
        { wch: 12 }, // EPF Deduction
        { wch: 12 }, // ESIC Deduction
        { wch: 14 }, // Other Deduction
        { wch: 12 }, // Other Benefit
        { wch: 12 }  // Paid Date
      ];
      ws['!cols'] = colWidths;

      // Add to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Wages History');

      // Generate filename
      const filename = `Wages_History_${employeeName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      this.showToast('Wages history exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting wages history:', error);
      this.showToast('Failed to export wages history', 'error');
    }
  }

  /**
   * Handle appointment letter generation
   */
  async handleGenerateAppointmentLetter() {
    if (!this.editingId) {
      this.showToast('Please select an employee to generate appointment letter', 'warning');
      return;
    }

    const employeeData = this.masterRolls.find(r => r.id == this.editingId);
    if (!employeeData) {
      this.showToast('Employee data not found', 'error');
      return;
    }

    try {
      this.elements.generateLetterBtn.disabled = true;
      this.elements.generateLetterBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Generating...';

      // Call server endpoint to generate letter
      await downloadAppointmentLetter(this.editingId, employeeData.employee_name);
      
      this.showToast(`Appointment letter generated for ${employeeData.employee_name}`, 'success');
    } catch (error) {
      console.error('Error generating appointment letter:', error);
      this.showToast(`Failed to generate appointment letter: ${error.message}`, 'error');
    } finally {
      this.elements.generateLetterBtn.disabled = !this.editingId;
      this.elements.generateLetterBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Download Letter';
    }
  }
}