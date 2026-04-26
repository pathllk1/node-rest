import { renderTabs } from "../components/wages/renderTabs.js";
import { renderCreateMode } from "../components/wages/renderCreateMode.js";
import { renderManageMode } from "../components/wages/renderManageMode.js";
import { createAdvanceModal } from "../components/wages/advanceModal.js";
import { requireAuth } from '../middleware/authMiddleware.js';
import { renderLayout } from '../components/layout.js';
import { api, fetchWithCSRF } from '../utils/api.js';

export async function renderWagesDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  // State initialization
  let firmBankAccounts = [];
  const advanceModal = createAdvanceModal();
  let employeeAdvances = {}; // Map of master_roll_id -> outstanding balance

  // Load XLSX library dynamically like master-roll.js
  await loadXLSX();
  const XLSX = window.XLSX;
  
  // Load firm bank accounts
  await loadFirmBankAccounts();

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

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  
  // Tab state
  let activeTab = 'create'; // 'create' or 'manage'
  
  // Create mode state
  let selectedMonth = '';
  let employees = [];
  let wageData = {};
  let isLoading = false;
  let selectedEmployeeIds = new Set(); // ✅ CHECKBOXES for CREATE mode
  
  // Manage mode state
  let manageMonth = '';
  let existingWages = [];
  let editedWages = {}; // Track edited wages by ID
  let selectedWageIds = new Set(); // For bulk operations
  let isManageLoading = false;
  
  // Bulk edit mode
  let isBulkEditMode = false;
  let bulkEditData = {
    wage_days: '',
    epf_deduction: '',
    esic_deduction: '',
    other_deduction: '',
    other_benefit: '',
    paid_date: '',
    cheque_no: '',
    paid_from_bank_ac: '',
    remarks: ''
  };
  
  // Common payment fields (Create mode)
  let commonPaymentData = {
    paid_date: '',
    cheque_no: '',
    paid_from_bank_ac: '',
    remarks: ''
  };
  
  // Filter state (for both Create and Manage)
  let createFilters = {
    searchTerm: '',
    bankFilter: 'all',
    projectFilter: 'all',
    siteFilter: 'all'
  };
  
  let manageFilters = {
    searchTerm: '',
    bankFilter: 'all',
    projectFilter: 'all',
    siteFilter: 'all',
    paidFilter: 'all'
  };

  // Debounce timers for search filters
  let createSearchDebounceTimer = null;
  let manageSearchDebounceTimer = null;

  // Sort state for tables
  let createSort = { column: null, asc: true };
  let manageSort = { column: null, asc: true };

  // Event delegation flag - attach listeners only once
  let listenersAttached = false;

  let manageRenderDebounceTimer = null;
let createRenderDebounceTimer = null;

  /* --------------------------------------------------
     UTILITY FUNCTIONS
  -------------------------------------------------- */

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN');
    } catch (e) {
      return dateStr;
    }
  }

  function formatMonthDisplay(yearMonth) {
    if (!yearMonth) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month] = yearMonth.split('-');
    return `${months[parseInt(month) - 1]} ${year}`;
  }

  function inputValue(value) {
    if (value === null || value === undefined) return '';
    return value;
  }

  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function toInt(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0;
    const parsed = parseInt(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₹0.00';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function calculateNetSalary(gross, epf, esic, otherDed, otherBen, advDed = 0) {
    const totalDeductions = (epf || 0) + (esic || 0) + (otherDed || 0) + (advDed || 0);
    const totalBenefits = otherBen || 0;
    return parseFloat((gross - totalDeductions + totalBenefits).toFixed(2));
  }

  function showToast(message, type = 'success') {
    const bgColor = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
    Toastify({ 
      text: message, 
      backgroundColor: bgColor, 
      duration: 3000,
      gravity: 'top',
      position: 'right'
    }).showToast();
  }

  /* --------------------------------------------------
     CREATE MODE - WAGE CALCULATION FUNCTIONS
  -------------------------------------------------- */

  function calculateAllWagesForEmployee(empId) {
    const emp = employees.find(e => e.master_roll_id === empId);
    const wage = wageData[empId];
    if (!emp || !wage) return;

    const dailyRate = wage.p_day_wage || emp.p_day_wage || 0;
    const wageDays = wage.wage_days || 26;

    // Calculate gross salary = Daily Rate * days
    wage.gross_salary = parseFloat((dailyRate * wageDays).toFixed(2));

    // Calculate EPF: round(gross_salary * 12%), max 1800
    wage.epf_deduction = Math.min(Math.round(wage.gross_salary * 0.12), 1800);

    // Calculate ESIC: round up(gross_salary * 0.75%)
    wage.esic_deduction = Math.ceil(wage.gross_salary * 0.0075);

    // Update UI immediately
    updateWageRowDisplay(empId);
  }

  function updateWageRowDisplay(empId) {
    const wage = wageData[empId];
    if (!wage) return;

    const netSalary = calculateNetSalary(
      wage.gross_salary,
      wage.epf_deduction,
      wage.esic_deduction,
      wage.other_deduction,
      wage.other_benefit,
      wage.advance_deduction
    );

    // Update all readonly/auto-calculated fields
    const fields = ['gross_salary', 'epf_deduction', 'esic_deduction', 'net_salary'];
    fields.forEach(field => {
      const input = document.querySelector(`input[data-emp-id="${empId}"][data-field="${field}"]`);
      const span = document.querySelector(`span[data-emp-id="${empId}"][data-field="${field}"]`);
      
      if (input) {
        input.value = field === 'net_salary' ? netSalary.toFixed(2) : (wage[field] || 0);
      }
      if (span) {
        span.textContent = field === 'net_salary' ? netSalary.toFixed(2) : (wage[field] || 0);
      }
    });
  }


  /* --------------------------------------------------
     SURGICAL DOM UPDATE HELPERS
     These patch only changed elements instead of calling
     render() + renderLayout() on every micro-interaction
     (checkbox, month change, payment field, etc.)
  -------------------------------------------------- */

  // ── Create mode helpers ───────────────────────────

  /**
   * Update only selection-related DOM in the Create tab.
   * @param {string|null} toggledEmpId  Row just toggled, or null for select-all.
   */
  function updateCreateSelectionUI(toggledEmpId) {
    const filteredEmps = getFilteredCreateEmployees();
    const allSelected  = filteredEmps.length > 0
      && filteredEmps.every(e => selectedEmployeeIds.has(e.master_roll_id));

    if (toggledEmpId != null) {
      // Single toggle: paint only that one row
      const row = document.querySelector(`tr[data-emp-row="${toggledEmpId}"]`);
      if (row) row.style.background = selectedEmployeeIds.has(toggledEmpId) ? '#eff6ff' : 'white';
    } else {
      // Select-all / deselect-all: update every visible row + checkbox
      filteredEmps.forEach(emp => {
        const id  = emp.master_roll_id;
        const row = document.querySelector(`tr[data-emp-row="${id}"]`);
        const cb  = document.querySelector(`input[data-action="toggle-employee"][data-emp-id="${id}"]`);
        if (row) row.style.background = selectedEmployeeIds.has(id) ? '#eff6ff' : 'white';
        if (cb)  cb.checked = selectedEmployeeIds.has(id);
      });
    }

    // Header select-all checkbox
    const selectAllCb = document.getElementById('select-all-create');
    if (selectAllCb) selectAllCb.checked = allSelected;

    // Save Wages button — label + enabled state
    const saveBtn = document.getElementById('save-wages-btn');
    if (saveBtn) {
      const has = selectedEmployeeIds.size > 0;
      saveBtn.disabled = !has;
      saveBtn.style.background = has ? '#059669' : '#9ca3af';
      saveBtn.style.cursor = has ? 'pointer' : 'not-allowed';
      saveBtn.textContent = has
        ? `💾 Save Wages (${selectedEmployeeIds.size})`
        : '💾 Save Wages';
    }

    updateCreateSummaryTotals();
  }

  /** Recalculate and repaint the Create-mode summary totals panel. */
  function updateCreateSummaryTotals() {
    const header  = document.getElementById('create-summary-header');
    const grossEl = document.getElementById('create-summary-gross');
    const epfEl   = document.getElementById('create-summary-epf');
    const esicEl  = document.getElementById('create-summary-esic');
    const advEl   = document.getElementById('create-summary-advance');
    const netEl   = document.getElementById('create-summary-net');
    if (!grossEl) return; // panel not in DOM yet (no employees loaded)

    let tGross = 0, tEpf = 0, tEsic = 0, tAdv = 0, tNet = 0;
    selectedEmployeeIds.forEach(id => {
      const w = wageData[id];
      if (!w) return;
      tGross += w.gross_salary   || 0;
      tEpf   += w.epf_deduction  || 0;
      tEsic  += w.esic_deduction || 0;
      tAdv   += w.advance_deduction || 0;
      tNet   += calculateNetSalary(
        w.gross_salary, w.epf_deduction, w.esic_deduction,
        w.other_deduction, w.other_benefit, w.advance_deduction
      );
    });

    if (header)  header.textContent  = `📊 Summary (${selectedEmployeeIds.size} selected / ${employees.length} total)`;
    if (grossEl) grossEl.textContent = formatCurrency(tGross);
    if (epfEl)   epfEl.textContent   = formatCurrency(tEpf);
    if (esicEl)  esicEl.textContent  = formatCurrency(tEsic);
    if (advEl)   advEl.textContent   = formatCurrency(tAdv);
    if (netEl)   netEl.textContent   = formatCurrency(tNet);
  }

  // ── Manage mode helpers ───────────────────────────

  /**
   * Update only selection-related DOM in the Manage tab.
   * @param {string|null} toggledWageId  Row just toggled, or null for select-all.
   */
  function updateManageSelectionUI(toggledWageId) {
    const filteredWages = getFilteredManageWages();
    const allSelected   = filteredWages.length > 0
      && filteredWages.every(w => selectedWageIds.has(w.id));

    if (toggledWageId != null) {
      const row = document.querySelector(`tr[data-wage-row="${toggledWageId}"]`);
      if (row) row.style.background = selectedWageIds.has(toggledWageId) ? '#eff6ff' : 'white';
    } else {
      filteredWages.forEach(wage => {
        const row = document.querySelector(`tr[data-wage-row="${wage.id}"]`);
        const cb  = document.querySelector(`input[data-action="toggle-wage"][data-wage-id="${wage.id}"]`);
        if (row) row.style.background = selectedWageIds.has(wage.id) ? '#eff6ff' : 'white';
        if (cb)  cb.checked = selectedWageIds.has(wage.id);
      });
    }

    // Header select-all checkbox
    const selectAllCb = document.getElementById('select-all-manage');
    if (selectAllCb) selectAllCb.checked = allSelected;

    // Bulk-action container — show/hide
    const actionArea = document.getElementById('manage-selection-actions');
    if (actionArea) actionArea.style.display = selectedWageIds.size > 0 ? 'flex' : 'none';

    // Button label counts
    const bulkBtn = document.getElementById('bulk-edit-btn');
    if (bulkBtn && !isBulkEditMode) {
      bulkBtn.textContent = `✏️ Bulk Edit (${selectedWageIds.size})`;
    }
    const delBtn = document.getElementById('delete-selected-btn');
    if (delBtn) delBtn.textContent = `🗑️ Delete Selected (${selectedWageIds.size})`;

    // Summary panel — show/hide and refresh counts
    const panel = document.getElementById('manage-summary-panel');
    if (panel) {
      panel.style.display = selectedWageIds.size > 0 ? 'block' : 'none';
      if (selectedWageIds.size > 0) {
        const hdr = document.getElementById('manage-summary-header');
        if (hdr) hdr.textContent = `📊 Summary (${selectedWageIds.size} selected)`;
        updateSummaryPanel(); // existing fn — updates the 4 total <span>s
      }
    }
  }

  /**
   * Show the Save Changes button and unsaved-changes badge without re-rendering.
   * Called by handleManageFieldChange every time a field is edited.
   */
  function showSaveEditedButton(count) {
    const container = document.getElementById('save-edited-btn-container');
    const badge     = document.getElementById('unsaved-changes-badge');
    const countEl   = document.getElementById('unsaved-count');
    const btn       = document.getElementById('save-edited-btn');
    if (container) container.style.display = 'block';
    if (badge)     badge.style.display     = 'inline';
    if (countEl)   countEl.textContent     = count;
    if (btn)       btn.textContent         = `💾 Save Changes (${count})`;
  }

  function calculateBulkForAllEmployees() {
    employees.forEach(emp => {
      if (!wageData[emp.master_roll_id]) {
        wageData[emp.master_roll_id] = {
          p_day_wage: emp.p_day_wage || 0,
          wage_days: emp.last_wage_days || 26,
          gross_salary: 0,
          epf_deduction: 0,
          esic_deduction: 0,
          other_deduction: 0,
          other_benefit: 0,
          advance_deduction: 0
        };
      }
      calculateAllWagesForEmployee(emp.master_roll_id);
    });
    // updateWageRowDisplay() already patched each row — just refresh summary
    updateCreateSummaryTotals();
  }

function handleCreateFieldChange(empId, field, value) {
  if (!wageData[empId]) {
    wageData[empId] = {
      p_day_wage: 0,
      wage_days: 26,
      gross_salary: 0,
      epf_deduction: 0,
      esic_deduction: 0,
      other_deduction: 0,
      other_benefit: 0,
      advance_deduction: 0
    };
  }
  
  // Parse value based on field type
  let parsedValue;
  if (field === 'wage_days') {
    parsedValue = parseInt(value) || 0;
  } else {
    parsedValue = parseFloat(value) || 0;
  }
  
  // ✅ FIX: Validation - No negative values
  if (parsedValue < 0) {
    showToast('Value cannot be negative', 'error');
    parsedValue = 0;
  }
  
  // ✅ FIX: Validation - Wage days max 31
  if (field === 'wage_days' && parsedValue > 31) {
    showToast('Wage days cannot exceed 31', 'warning');
    parsedValue = 31;
  }
  
  // ✅ FIX: Validation - EPF max 1800
  if (field === 'epf_deduction' && parsedValue > 1800) {
    showToast('EPF deduction cannot exceed ₹1800', 'warning');
    parsedValue = 1800;
  }
  
  // Update the field value
  wageData[empId][field] = parsedValue;
  
  // ✅ AUTO-CALCULATE when p_day_wage or wage_days changes
  if (field === 'p_day_wage' || field === 'wage_days') {
    const dailyRate = wageData[empId].p_day_wage || 0;
    const wageDays = wageData[empId].wage_days || 26;
    
    // Calculate gross
    wageData[empId].gross_salary = parseFloat((dailyRate * wageDays).toFixed(2));
    
    // Calculate EPF (12%, max 1800)
    wageData[empId].epf_deduction = Math.min(
      Math.round(wageData[empId].gross_salary * 0.12), 
      1800
    );
    
    // Calculate ESIC (0.75%, round up)
    wageData[empId].esic_deduction = Math.ceil(
      wageData[empId].gross_salary * 0.0075
    );
    
    updateWageRowDisplay(empId);
  }
  
  // ✅ FIX BUG #2: AUTO-UPDATE net when ANY field changes
  if (field === 'gross_salary') {
    // Recalculate per-day wage
    const wage = wageData[empId];
    wage.p_day_wage = wage.wage_days > 0 
      ? parseFloat((wage.gross_salary / wage.wage_days).toFixed(2)) 
      : 0;
    
    // Recalculate EPF/ESIC based on new gross
    wage.epf_deduction = Math.min(Math.round(wage.gross_salary * 0.12), 1800);
    wage.esic_deduction = Math.ceil(wage.gross_salary * 0.0075);
    
    updateWageRowDisplay(empId);
  }
  
  // ✅ FIX BUG #2: Update net salary when ANY deduction/benefit/advance changes
  if (field === 'epf_deduction' || field === 'esic_deduction' || 
      field === 'other_deduction' || field === 'other_benefit' || 
      field === 'advance_deduction') {
    updateWageRowDisplay(empId);
  }

  // Always update global summary
  updateCreateSummaryTotals();
}

  /* --------------------------------------------------
     CREATE MODE - API FUNCTIONS
  -------------------------------------------------- */

  async function loadAdvanceBalance(masterRollId) {
    try {
      const res = await api.get(`/api/advances/balance/${masterRollId}`);
      if (res.success) {
        employeeAdvances[masterRollId] = res.balance;
      }
    } catch (e) {
      console.error('Failed to load advance balance', e);
    }
  }

  async function loadEmployeesForWages() {
    if (!selectedMonth) {
      showToast('Please select a month', 'error');
      return;
    }

    isLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const result = await api.post('/api/wages/employees', { month: selectedMonth });

      if (result.success) {
        employees = result.data;
        wageData = {};
        selectedEmployeeIds = new Set(); // Clear selections

        // Fetch balances for all loaded employees
        await Promise.all(employees.map(emp => loadAdvanceBalance(emp.master_roll_id)));

        // Initialize wage data with last values
        employees.forEach(emp => {
          wageData[emp.master_roll_id] = {
            p_day_wage: emp.p_day_wage || 0,
            wage_days: emp.last_wage_days || 26,
            gross_salary: 0,
            epf_deduction: 0,
            esic_deduction: 0,
            other_deduction: 0,
            other_benefit: 0,
            advance_deduction: 0
          };
        });

        // ✅ AUTO-CALCULATE ALL on load
        calculateBulkForAllEmployees();

        showToast(`Loaded ${employees.length} employees (${result.meta.already_paid} already paid)`, 'success');
      } else {
        showToast(result.message || 'Failed to load employees', 'error');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      showToast('Error loading employees', 'error');
    } finally {
      isLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  async function saveWages() {
    if (!selectedMonth) {
      showToast('Please select a month', 'error');
      return;
    }

    // ✅ Only create wages for SELECTED employees
    if (selectedEmployeeIds.size === 0) {
      showToast('Please select at least one employee', 'warning');
      return;
    }

    const wageRecords = Array.from(selectedEmployeeIds).map(empId => {
      const emp = employees.find(e => e.master_roll_id.toString() === empId.toString());

      if (!emp) {
        console.warn(`Employee with ID ${empId} not found in employees list, skipping`);
        return null;
      }

      const wage = wageData[empId] || {};
      return {
        master_roll_id: empId,
        p_day_wage: wage.p_day_wage || emp.p_day_wage || 0,
        wage_days: wage.wage_days || 26,
        gross_salary: wage.gross_salary || 0,
        epf_deduction: wage.epf_deduction || 0,
        esic_deduction: wage.esic_deduction || 0,
        other_deduction: wage.other_deduction || 0,
        other_benefit: wage.other_benefit || 0,
        paid_date: commonPaymentData.paid_date || null,
        cheque_no: commonPaymentData.cheque_no || null,
        paid_from_bank_ac: commonPaymentData.paid_from_bank_ac || null
      };
    }).filter(record => record !== null);

    // Server requires non-empty wages array - align with server validation
    if (wageRecords.length === 0) {
      showToast('No valid employees selected. Please select employees from the current list.', 'error');
      return;
    }

    isLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const result = await api.post('/api/wages/create', { month: selectedMonth, wages: wageRecords });

      if (result.success) {
        showToast(result.message, 'success');
        // Clear form after successful save
        employees = [];
        wageData = {};
        selectedMonth = '';
        selectedEmployeeIds = new Set();
      } else {
        showToast(result.message || 'Failed to save wages', 'error');
      }
    } catch (error) {
      console.error('Error saving wages:', error);
      showToast('Error saving wages', 'error');
    } finally {
      isLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  /* --------------------------------------------------
     MANAGE MODE - API FUNCTIONS
  -------------------------------------------------- */

  async function loadExistingWages() {
    if (!manageMonth) {
      showToast('Please select a month', 'error');
      return;
    }

    isManageLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const result = await api.get(`/api/wages/manage?month=${manageMonth}`);

      if (result.success) {
        existingWages = result.data;
        editedWages = {};
        selectedWageIds = new Set();
        isBulkEditMode = false;

        // Fetch balances for all employees in existing wages
        const masterRollIds = [...new Set(existingWages.map(w => w.master_roll_id?._id).filter(id => id))];
        await Promise.all(masterRollIds.map(id => loadAdvanceBalance(id)));
        
        showToast(`Loaded ${existingWages.length} wage records for ${formatMonthDisplay(manageMonth)}`, 'success');
      } else {
        showToast(result.message || 'Failed to load wages', 'error');
      }
    } catch (error) {
      console.error('Error loading wages:', error);
      showToast('Error loading wages', 'error');
    } finally {
      isManageLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  async function loadFirmBankAccounts() {
    try {
      const result = await api.get('/api/ledger/bank-accounts?activeOnly=true');
      if (result.success) {
        firmBankAccounts = result.data;
      }
    } catch (error) {
      console.error('Error loading firm bank accounts:', error);
    }
  }

  async function saveEditedWages() {
    const wagesToUpdate = Object.keys(editedWages).map(id => {
      const edited = editedWages[id];
      return {
        id: id, // MongoDB ObjectId string — do NOT parseInt, it produces NaN
        ...edited,
        wage_days: toInt(edited.wage_days),
        p_day_wage: toNumber(edited.p_day_wage),
        gross_salary: toNumber(edited.gross_salary),
        epf_deduction: toNumber(edited.epf_deduction),
        esic_deduction: toNumber(edited.esic_deduction),
        other_deduction: toNumber(edited.other_deduction),
        other_benefit: toNumber(edited.other_benefit),
        paid_date: edited.paid_date || null,
        cheque_no: edited.cheque_no || null,
        paid_from_bank_ac: edited.paid_from_bank_ac || null
      };
    });

    if (wagesToUpdate.length === 0) {
      showToast('No changes to save', 'warning');
      return;
    }

    isManageLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const result = await api.put('/api/wages/bulk-update', { wages: wagesToUpdate });

      if (result.success) {
        showToast(result.message, 'success');
        editedWages = {};
        await loadExistingWages(); // Reload to get fresh data
      } else {
        showToast(result.message || 'Failed to update wages', 'error');
      }
    } catch (error) {
      console.error('Error updating wages:', error);
      showToast('Error updating wages', 'error');
    } finally {
      isManageLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  async function deleteSelectedWages() {
    if (selectedWageIds.size === 0) {
      showToast('Please select wages to delete', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedWageIds.size} wage record(s)?`)) {
      return;
    }

    isManageLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const response = await fetchWithCSRF('/api/wages/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ ids: Array.from(selectedWageIds) })
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message, 'success');
        selectedWageIds = new Set();
        await loadExistingWages(); // Reload to get fresh data
      } else {
        showToast(result.message || 'Failed to delete wages', 'error');
      }
    } catch (error) {
      console.error('Error deleting wages:', error);
      showToast('Error deleting wages', 'error');
    } finally {
      isManageLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  /* --------------------------------------------------
     MANAGE MODE - BULK EDIT FUNCTIONS
  -------------------------------------------------- */

  function applyBulkEdit() {
    if (selectedWageIds.size === 0) {
      showToast('Please select wages to edit', 'warning');
      return;
    }

    selectedWageIds.forEach(wageId => {
      const wage = existingWages.find(w => w.id === wageId);
      if (!wage) return;

      if (!editedWages[wageId]) {
        editedWages[wageId] = { ...wage };
      }

      // Apply bulk edit fields that are not empty
      if (bulkEditData.wage_days !== '') {
        editedWages[wageId].wage_days = parseInt(bulkEditData.wage_days);
        // Recalculate gross
        const perDayWage = wage.p_day_wage || 0;
        editedWages[wageId].gross_salary = parseFloat((perDayWage * editedWages[wageId].wage_days).toFixed(2));
      }

      if (bulkEditData.epf_deduction !== '') {
        editedWages[wageId].epf_deduction = parseFloat(bulkEditData.epf_deduction);
      }

      if (bulkEditData.esic_deduction !== '') {
        editedWages[wageId].esic_deduction = parseFloat(bulkEditData.esic_deduction);
      }

      if (bulkEditData.other_deduction !== '') {
        editedWages[wageId].other_deduction = parseFloat(bulkEditData.other_deduction);
      }

      if (bulkEditData.other_benefit !== '') {
        editedWages[wageId].other_benefit = parseFloat(bulkEditData.other_benefit);
      }

      if (bulkEditData.advance_deduction !== '') {
        editedWages[wageId].advance_deduction = parseFloat(bulkEditData.advance_deduction);
      }

      if (bulkEditData.paid_date !== '') {
        editedWages[wageId].paid_date = bulkEditData.paid_date;
      }

      if (bulkEditData.cheque_no !== '') {
        editedWages[wageId].cheque_no = bulkEditData.cheque_no;
      }

      if (bulkEditData.paid_from_bank_ac !== '') {
        editedWages[wageId].paid_from_bank_ac = bulkEditData.paid_from_bank_ac;
      }

      if (bulkEditData.remarks !== '') {
        editedWages[wageId].remarks = bulkEditData.remarks;
      }
    });

    // Clear bulk edit data
    bulkEditData = {
      wage_days: '',
      epf_deduction: '',
      esic_deduction: '',
      other_deduction: '',
      other_benefit: '',
      advance_deduction: '',
      paid_date: '',
      cheque_no: '',
      paid_from_bank_ac: '',
      remarks: ''
    };

    isBulkEditMode = false;
    showToast(`Bulk edit applied to ${selectedWageIds.size} records`, 'success');
    const content = render();
    renderLayout(content, window.wagesDashboard.router);
  }

function handleManageFieldChange(wageId, field, value) {
    const wage = existingWages.find(w => w.id === wageId);
    if (!wage) return;

    if (!editedWages[wageId]) {
      editedWages[wageId] = { ...wage };
    }

    // Preserve raw input so we don't break cursor position during edits
    editedWages[wageId][field] = value;

    // 1. Auto-recalculate Gross Salary + EPF/ESIC if wage_days changes
    if (field === 'wage_days') {
      const perDayWage = wage.p_day_wage || 0;
      const wageDaysNumber = toInt(value);
      const newGross = parseFloat((perDayWage * wageDaysNumber).toFixed(2));
      editedWages[wageId].gross_salary = newGross;

      // Auto-recalculate EPF (12%, max ₹1800) and ESIC (0.75%, round up)
      const newEpf = Math.min(Math.round(newGross * 0.12), 1800);
      const newEsic = Math.ceil(newGross * 0.0075);
      editedWages[wageId].epf_deduction = newEpf;
      editedWages[wageId].esic_deduction = newEsic;

      // Direct DOM Update: Gross display span
      const grossEl = document.getElementById(`wage-${wageId}-gross-display`);
      if (grossEl) grossEl.innerText = formatCurrency(newGross);

      // Direct DOM Update: EPF and ESIC input values
      const epfInput = document.getElementById(`wage-${wageId}-epf_deduction`);
      if (epfInput) epfInput.value = newEpf;
      const esicInput = document.getElementById(`wage-${wageId}-esic_deduction`);
      if (esicInput) esicInput.value = newEsic;
    }

    // 2. Recalculate Net Salary (affected by ANY field change)
    const currentData = editedWages[wageId];
    const newNetSalary = calculateNetSalary(
      toNumber(currentData.gross_salary),
      toNumber(currentData.epf_deduction),
      toNumber(currentData.esic_deduction),
      toNumber(currentData.other_deduction),
      toNumber(currentData.other_benefit),
      toNumber(currentData.advance_deduction)
    );

    // Direct DOM Update: Net Salary display span
    const netEl = document.getElementById(`wage-${wageId}-net-display`);
    if (netEl) netEl.innerText = formatCurrency(newNetSalary);

    updateSummaryPanel();
    // Show Save Changes button + unsaved badge without a full re-render
    showSaveEditedButton(Object.keys(editedWages).length);
  }

  /* --------------------------------------------------
     EXPORT FUNCTIONS
  -------------------------------------------------- */

  async function exportToExcel() {
    const month = activeTab === 'create' ? selectedMonth : manageMonth;
    if (!month) {
      showToast('Please select a month first', 'error');
      return;
    }

    // Determine which rows to export
    let rowsToExport = [];
    if (activeTab === 'create') {
      const filtered = getFilteredCreateEmployees();
      rowsToExport = selectedEmployeeIds.size > 0 
        ? filtered.filter(e => selectedEmployeeIds.has(e.master_roll_id))
        : filtered;
    } else {
      const filtered = getFilteredManageWages();
      rowsToExport = selectedWageIds.size > 0 
        ? filtered.filter(w => selectedWageIds.has(w.id))
        : filtered;
    }

    if (rowsToExport.length === 0) {
      showToast('No data available to export', 'warning');
      return;
    }

    // Map UI data to a format the server can use
    const exportData = rowsToExport.map(item => {
      if (activeTab === 'create') {
        const wage = wageData[item.master_roll_id] || {};
        return {
          employee_name: item.employee_name,
          project: item.project || 'General',
          site: item.site || 'N/A',
          bank: item.bank || 'N/A',
          account_no: item.account_no || 'N/A',
          p_day_wage: wage.p_day_wage || item.p_day_wage || 0,
          wage_days: wage.wage_days || 0,
          gross_salary: wage.gross_salary || 0,
          epf_deduction: wage.epf_deduction || 0,
          esic_deduction: wage.esic_deduction || 0,
          other_deduction: wage.other_deduction || 0,
          other_benefit: wage.other_benefit || 0,
          advance_deduction: wage.advance_deduction || 0,
          net_salary: calculateNetSalary(wage.gross_salary, wage.epf_deduction, wage.esic_deduction, wage.other_deduction, wage.other_benefit, wage.advance_deduction)
        };
      } else {
        const edited = editedWages[item.id] || item;
        const mr = item.master_roll_id || {};
        return {
          employee_name: mr.employee_name || 'N/A',
          project: mr.project || 'General',
          site: mr.site || 'N/A',
          bank: mr.bank || 'N/A',
          account_no: mr.account_no || 'N/A',
          p_day_wage: edited.p_day_wage || 0,
          wage_days: edited.wage_days || 0,
          gross_salary: edited.gross_salary || 0,
          epf_deduction: edited.epf_deduction || 0,
          esic_deduction: edited.esic_deduction || 0,
          other_deduction: edited.other_deduction || 0,
          other_benefit: edited.other_benefit || 0,
          advance_deduction: edited.advance_deduction || 0,
          net_salary: calculateNetSalary(toNumber(edited.gross_salary), toNumber(edited.epf_deduction), toNumber(edited.esic_deduction), toNumber(edited.other_deduction), toNumber(edited.other_benefit), toNumber(edited.advance_deduction))
        };
      }
    });

    showToast('Generating enterprise report...', 'info');

    try {
      const response = await fetchWithCSRF('/api/wages/export', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        body: JSON.stringify({ 
          month, 
          data: exportData
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Wages_${activeTab}_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Report downloaded successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Failed to generate report', 'error');
    }
  }     /* --------------------------------------------------
     FILTERING AND SORTING
  -------------------------------------------------- */

  function sortArray(data, column, asc) {
    if (!column) return data;
    
    return [...data].sort((a, b) => {
      let aVal, bVal;
      
      // Handle nested access for manage mode employee data
      if (column === 'employee_name' && a.master_roll_id) {
        aVal = a.master_roll_id.employee_name;
        bVal = b.master_roll_id.employee_name;
      } else {
        aVal = a[column];
        bVal = b[column];
      }
      
      // Handle undefined/null
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      
      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return asc ? aVal - bVal : bVal - aVal;
      }
      
      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (asc) {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }

  function getFilteredCreateEmployees() {
    return employees.filter(emp => {
      // Search filter
      const searchMatch = !createFilters.searchTerm || 
        emp.employee_name.toLowerCase().includes(createFilters.searchTerm.toLowerCase()) ||
        emp.aadhar.includes(createFilters.searchTerm) ||
        emp.account_no.includes(createFilters.searchTerm);

      // Bank filter
      const bankMatch = createFilters.bankFilter === 'all' || 
        emp.bank === createFilters.bankFilter;

      // Project filter
      const projectMatch = createFilters.projectFilter === 'all' || 
        emp.project === createFilters.projectFilter;

      // Site filter
      const siteMatch = createFilters.siteFilter === 'all' || 
        emp.site === createFilters.siteFilter;

      return searchMatch && bankMatch && projectMatch && siteMatch;
    });
  }

  function getFilteredManageWages() {
    return existingWages.filter(wage => {
      // Search filter
      const searchMatch = !manageFilters.searchTerm || 
        wage.master_roll_id?.employee_name?.toLowerCase().includes(manageFilters.searchTerm.toLowerCase()) ||
        wage.master_roll_id?.aadhar?.includes(manageFilters.searchTerm) ||
        wage.master_roll_id?.account_no?.includes(manageFilters.searchTerm);

      // Bank filter
      const bankMatch = manageFilters.bankFilter === 'all' || 
        wage.master_roll_id?.bank === manageFilters.bankFilter;

      // Project filter
      const projectMatch = manageFilters.projectFilter === 'all' || 
        wage.master_roll_id?.project === manageFilters.projectFilter;

      // Site filter
      const siteMatch = manageFilters.siteFilter === 'all' || 
        wage.master_roll_id?.site === manageFilters.siteFilter;

      // Paid filter
      const paidMatch = manageFilters.paidFilter === 'all' ||
        (manageFilters.paidFilter === 'paid' && wage.paid_date) ||
        (manageFilters.paidFilter === 'unpaid' && !wage.paid_date);

      return searchMatch && bankMatch && projectMatch && siteMatch && paidMatch;
    });
  }

  function getUniqueValues(array, key) {
    return [...new Set(array.map(item => item[key]).filter(Boolean))].sort();
  }

  /* --------------------------------------------------
     RENDER FUNCTIONS
  -------------------------------------------------- */

  function attachEventDelegation(container) {
    if (!container) return;
    
    // Delegate input changes for edit handlers
    container.addEventListener('input', (e) => {
      const action = e.target.dataset.action;
      if (action === 'edit-wage' || action === 'edit-employee') {
        const wageId = e.target.dataset.wageId;
        const empId = e.target.dataset.empId;
        const field = e.target.dataset.field;
        const value = e.target.value;
        
        if (wageId) window.wagesDashboard.handleManageEdit(wageId, field, value);
        if (empId) window.wagesDashboard.handleCreateFieldChange(empId, field, value);
      } else if (action === 'search-filter') {
        const mode = e.target.dataset.mode;
        const field = e.target.dataset.field;
        if (mode === 'create') {
          window.wagesDashboard.setCreateFilterDebounced(field, e.target.value);
        } else if (mode === 'manage') {
          window.wagesDashboard.setManageFilterDebounced(field, e.target.value);
        }
      } else if (action === 'set-bulk-edit') {
        const field = e.target.dataset.field;
        window.wagesDashboard.setBulkEdit(field, e.target.value);
      }
    });
    
    // Delegate checkbox and select changes
    container.addEventListener('change', (e) => {
      const action = e.target.dataset.action;
      if (action === 'toggle-wage') {
        const wageId = e.target.dataset.wageId;
        window.wagesDashboard.toggleWageSelection(wageId, e.target.checked);
      } else if (action === 'toggle-employee') {
        const empId = e.target.dataset.empId;
        window.wagesDashboard.toggleEmployeeSelection(empId, e.target.checked);
      } else if (action === 'select-all') {
        const mode = e.target.dataset.mode;
        if (mode === 'create') {
          window.wagesDashboard.toggleSelectAllCreate(e.target.checked);
        } else if (mode === 'manage') {
          window.wagesDashboard.toggleSelectAll(e.target.checked);
        }
      } else if (action === 'set-month' || (action === 'month-change' && e.target.dataset.mode === 'create')) {
        window.wagesDashboard.setMonth(e.target.value);
      } else if (action === 'set-manage-month' || (action === 'month-change' && e.target.dataset.mode === 'manage')) {
        window.wagesDashboard.setManageMonth(e.target.value);
      } else if (action === 'filter-select') {
        const mode = e.target.dataset.mode;
        const field = e.target.dataset.field;
        if (mode === 'create') {
          window.wagesDashboard.setCreateFilter(field, e.target.value);
        } else if (mode === 'manage') {
          window.wagesDashboard.setManageFilter(field, e.target.value);
        }
      } else if (action === 'common-payment') {
        const field = e.target.dataset.field;
        window.wagesDashboard.setCommonPayment(field, e.target.value);
      }
    });
    
    // Delegate click events
    container.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'switch-tab') {
        const tab = e.target.dataset.tab;
        window.wagesDashboard.switchTab(tab);
      } else if (action === 'sort') {
        const column = e.target.dataset.column;
        const mode = e.target.dataset.mode;
        if (mode === 'create') {
          window.wagesDashboard.toggleCreateSort(column);
        } else if (mode === 'manage') {
          window.wagesDashboard.toggleManageSort(column);
        }
      } else if (action === 'load-employees') {
        window.wagesDashboard.loadEmployees();
      } else if (action === 'load-manage-wages' || action === 'load-wages') {
        window.wagesDashboard.loadManageWages();
      } else if (action === 'calculate-bulk') {
        window.wagesDashboard.calculateBulk();
      } else if (action === 'save-wages') {
        window.wagesDashboard.saveWages();
      } else if (action === 'export-excel' || action === 'export-wages') {
        window.wagesDashboard.exportToExcel();
      } else if (action === 'reset-filters') {
        const mode = e.target.dataset.mode;
        if (mode === 'create') {
          window.wagesDashboard.resetCreateFilters();
        } else if (mode === 'manage') {
          window.wagesDashboard.resetManageFilters();
        }
      } else if (action === 'toggle-bulk-edit') {
        window.wagesDashboard.toggleBulkEdit();
      } else if (action === 'delete-selected') {
        window.wagesDashboard.deleteSelected();
      } else if (action === 'save-edited') {
        window.wagesDashboard.saveEdited();
      } else if (action === 'apply-bulk-edit') {
        window.wagesDashboard.applyBulkEdit();
      } else if (action === 'clear-bulk-edit') {
        window.wagesDashboard.clearBulkEdit();
      } else if (action === 'open-advance-modal') {
        const empId = e.target.dataset.empId || null;
        window.wagesDashboard.openAdvanceModal(empId);
      }
    });
  }

  function render() {
    // Reset listeners flag when rendering (so they get re-attached)
    listenersAttached = false;
    
    // Capture currently focused element before re-render
    const activeElement = document.activeElement;
    const focusedWageId = activeElement?.dataset?.wageId;
    const focusedField = activeElement?.dataset?.field;
    const focusedEmpId = activeElement?.dataset?.empId;
    const focusedMode = activeElement?.dataset?.mode;
    const focusedSelectionStart = activeElement?.selectionStart;
    const focusedSelectionEnd = activeElement?.selectionEnd;
    const focusedSelectionDirection = activeElement?.selectionDirection;

    const html = `
      <div id="wages-dashboard" class="w-full px-4 -mt-6 pb-8 animate-in fade-in duration-500">
        <!-- Dashboard Header -->
        <div class="flex justify-between items-center bg-white px-6 h-14 rounded-2xl shadow-sm border border-slate-100 mb-4 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg shadow-slate-200">💰</div>
            <div>
              <h2 class="text-sm font-black text-slate-900 uppercase tracking-tighter italic">Wages Management</h2>
              <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Enterprise Payroll Console</p>
            </div>
          </div>
          <div class="flex items-center gap-6">
            <button 
              data-action="open-advance-modal" 
              class="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-2"
            >
              <span class="w-5 h-5 bg-indigo-50 rounded flex items-center justify-center text-xs">💸</span>
              Advance Ledger
            </button>
            <div class="w-64">
              ${renderTabs({ activeTab })}
            </div>
          </div>
        </div>
        
        ${activeTab === 'create' ? renderCreateMode({
          selectedMonth,
          employees,
          wageData,
          selectedEmployeeIds,
          isLoading,
          createFilters,
          createSort,
          commonPaymentData,
          firmBankAccounts,
          employeeAdvances,
          openAdvanceModal: window.wagesDashboard.openAdvanceModal,
          formatMonthDisplay,
          formatCurrency,
          calculateNetSalary,
          getFilteredCreateEmployees,
          getUniqueValues,
          sortArray
        }) : renderManageMode({
          manageMonth,
          existingWages,
          editedWages,
          selectedWageIds,
          isManageLoading,
          isBulkEditMode,
          bulkEditData,
          manageFilters,
          manageSort,
          firmBankAccounts,
          employeeAdvances,
          openAdvanceModal: window.wagesDashboard.openAdvanceModal,
          formatMonthDisplay,
          formatDateDisplay,
          formatCurrency,
          calculateNetSalary,
          getFilteredManageWages,
          getUniqueValues,
          sortArray,
          inputValue,
          toNumber
        })}
      </div>
    `;
    
    // Attach event delegation for CSP compliance
    setTimeout(() => {
      const container = document.getElementById('wages-dashboard');
      if (container && !listenersAttached) {
        attachEventDelegation(container);
        listenersAttached = true;
      }

      // Restore focus to previously focused field
      if (focusedWageId && focusedField) {
        const focusedInput = document.querySelector(`input[data-wage-id="${focusedWageId}"][data-field="${focusedField}"]`);
        if (focusedInput) {
          focusedInput.focus();
          try {
            if (focusedSelectionStart !== null && focusedSelectionStart !== undefined &&
                focusedSelectionEnd !== null && focusedSelectionEnd !== undefined) {
              focusedInput.setSelectionRange(
                focusedSelectionStart,
                focusedSelectionEnd,
                focusedSelectionDirection || 'none'
              );
            } else {
              const length = focusedInput.value.length;
              focusedInput.setSelectionRange(length, length);
            }
          } catch (e) {
            // Some input types don't support selection ranges
          }
        }
      } else if (focusedEmpId && focusedField) {
        const focusedInput = document.querySelector(`input[data-emp-id="${focusedEmpId}"][data-field="${focusedField}"]`);
        if (focusedInput) {
          focusedInput.focus();
          try {
            if (focusedSelectionStart !== null && focusedSelectionStart !== undefined &&
                focusedSelectionEnd !== null && focusedSelectionEnd !== undefined) {
              focusedInput.setSelectionRange(
                focusedSelectionStart,
                focusedSelectionEnd,
                focusedSelectionDirection || 'none'
              );
            } else {
              const length = focusedInput.value.length;
              focusedInput.setSelectionRange(length, length);
            }
          } catch (e) {
            // Some input types don't support selection ranges
          }
        }
      }
      else if (focusedMode && focusedField) { // <--- ADD THIS BLOCK
        const focusedInput = document.querySelector(`input[data-mode="${focusedMode}"][data-field="${focusedField}"], select[data-mode="${focusedMode}"][data-field="${focusedField}"]`);
        if (focusedInput) {
          focusedInput.focus();
          try {
             if (focusedSelectionStart !== null && focusedSelectionStart !== undefined) {
               focusedInput.setSelectionRange(focusedSelectionStart, focusedSelectionEnd);
             } else {
               const length = focusedInput.value.length;
               focusedInput.setSelectionRange(length, length);
             }
          } catch (e) {}
        }
      }
    }, 0);

    return html;
  }

  function updateSummaryPanel() {
    // If no summary panel is visible (no selection), stop
    if (selectedWageIds.size === 0) return;

    let totalGross = 0;
    let totalEpf = 0;
    let totalEsic = 0;
    let totalAdvance = 0;
    let totalNet = 0;

    // Loop through ALL selected wages to recalculate totals
    selectedWageIds.forEach(wageId => {
      const wage = existingWages.find(w => w.id === wageId);
      if (!wage) return;

      // Use the edited value if it exists, otherwise use the original value
      const data = editedWages[wageId] || wage;

      totalGross += toNumber(data.gross_salary);
      totalEpf += toNumber(data.epf_deduction);
      totalEsic += toNumber(data.esic_deduction);
      totalAdvance += toNumber(data.advance_deduction);
      
      totalNet += calculateNetSalary(
        toNumber(data.gross_salary),
        toNumber(data.epf_deduction),
        toNumber(data.esic_deduction),
        toNumber(data.other_deduction),
        toNumber(data.other_benefit),
        toNumber(data.advance_deduction)
      );
    });

    // Update the DOM elements directly
    const elGross = document.getElementById('summary-total-gross');
    const elEpf = document.getElementById('summary-total-epf');
    const elEsic = document.getElementById('summary-total-esic');
    const elAdvance = document.getElementById('summary-total-advance');
    const elNet = document.getElementById('summary-total-net');

    if (elGross) elGross.innerText = formatCurrency(totalGross);
    if (elEpf) elEpf.innerText = formatCurrency(totalEpf);
    if (elEsic) elEsic.innerText = formatCurrency(totalEsic);
    if (elAdvance) elAdvance.innerText = formatCurrency(totalAdvance);
    if (elNet) elNet.innerText = formatCurrency(totalNet);
  }

  /* --------------------------------------------------
     PUBLIC API (exposed to window for onclick handlers)
  -------------------------------------------------- */

  window.wagesDashboard = {
    router: router,
    openAdvanceModal: (empId) => {
      let empData = null;

      if (empId) {
        const emp = activeTab === 'create' 
          ? employees.find(e => e.master_roll_id?.toString() === empId.toString())
          : existingWages.find(w => w.master_roll_id?._id?.toString() === empId.toString())?.master_roll_id;

        if (emp) {
          empData = activeTab === 'create' ? emp : {
            master_roll_id: emp._id,
            employee_name: emp.employee_name
          };
        }
      }

      advanceModal.open(empId, firmBankAccounts, async (affectedEmpId) => {
        // Refresh balance and UI when modal records changes
        // Use affectedEmpId from callback if provided, otherwise the original empId
        const idToRefresh = affectedEmpId || empId;
        if (idToRefresh) {
          await loadAdvanceBalance(idToRefresh);
        }
        const content = render();
        renderLayout(content, window.wagesDashboard.router);
      });
    },
    // Tab switching
    switchTab: (tab) => {
      activeTab = tab;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },

     // Create mode - Data loading
     setMonth: (month) => {
       selectedMonth = month;
       // Sync both possible inputs in the DOM
       const createInput = document.getElementById('create-month-input');
       const manageInput = document.getElementById('manage-month-input');
       if (createInput) createInput.value = month;
       if (manageInput) manageInput.value = month;
     },
    loadEmployees: loadEmployeesForWages,
    
    // Create mode - Calculations (auto-calculate on field change)
    calculateBulk: calculateBulkForAllEmployees,
    handleCreateFieldChange: handleCreateFieldChange,
    
    // Create mode - Selection
    toggleEmployeeSelection: (empId, checked) => {
      if (checked) {
        selectedEmployeeIds.add(empId);
      } else {
        selectedEmployeeIds.delete(empId);
      }
      updateCreateSelectionUI(empId); // surgical patch — no full re-render
    },
    toggleSelectAllCreate: (checked) => {
      const filteredEmployees = getFilteredCreateEmployees();
      if (checked) {
        filteredEmployees.forEach(emp => selectedEmployeeIds.add(emp.master_roll_id));
      } else {
        filteredEmployees.forEach(emp => selectedEmployeeIds.delete(emp.master_roll_id));
      }
      updateCreateSelectionUI(null); // null = select-all path
    },
    
    // Create mode - Filters
    setCreateFilter: (field, value) => {
      createFilters[field] = value;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    setCreateFilterDebounced: (field, value) => {
      createFilters[field] = value;
      clearTimeout(createSearchDebounceTimer);
      createSearchDebounceTimer = setTimeout(() => {
        const content = render();
        renderLayout(content, window.wagesDashboard.router);
      }, 300);
    },
    
    resetCreateFilters: () => {
      createFilters = {
        searchTerm: '',
        bankFilter: 'all',
        projectFilter: 'all',
        siteFilter: 'all'
      };
      selectedEmployeeIds.clear();
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Create mode - Sorting
    toggleCreateSort: (column) => {
      if (createSort.column === column) {
        createSort.asc = !createSort.asc;
      } else {
        createSort.column = column;
        createSort.asc = true;
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Create mode - Save & Payment
    saveWages: saveWages,
    setCommonPayment: (field, value) => {
      commonPaymentData[field] = value;
      // Browser already updated the input — no re-render needed
    },

    // Manage mode - Data loading
    setManageMonth: (month) => {
      manageMonth = month;
      // Browser already updated the input — no re-render needed
    },
    loadManageWages: loadExistingWages,
    
    // Manage mode - Editing
    handleManageEdit: handleManageFieldChange,
    saveEdited: saveEditedWages,
    deleteSelected: deleteSelectedWages,
    
    // Manage mode - Filters
    setManageFilter: (field, value) => {
      manageFilters[field] = value;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    setManageFilterDebounced: (field, value) => {
      manageFilters[field] = value;
      clearTimeout(manageSearchDebounceTimer);
      manageSearchDebounceTimer = setTimeout(() => {
        const content = render();
        renderLayout(content, window.wagesDashboard.router);
      }, 300);
    },
    
    resetManageFilters: () => {
      manageFilters = {
        searchTerm: '',
        bankFilter: 'all',
        projectFilter: 'all',
        siteFilter: 'all',
        paidFilter: 'all'
      };
      selectedWageIds.clear();
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Manage mode - Sorting
    toggleManageSort: (column) => {
      if (manageSort.column === column) {
        manageSort.asc = !manageSort.asc;
      } else {
        manageSort.column = column;
        manageSort.asc = true;
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Manage mode - Bulk edit
    toggleBulkEdit: () => {
      isBulkEditMode = !isBulkEditMode;
      if (!isBulkEditMode) {
        bulkEditData = {
          wage_days: '',
          epf_deduction: '',
          esic_deduction: '',
          other_deduction: '',
          other_benefit: '',
          paid_date: '',
          cheque_no: '',
          paid_from_bank_ac: '',
          remarks: ''
        };
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    setBulkEdit: (field, value) => {
      bulkEditData[field] = value;
    },
    applyBulkEdit: applyBulkEdit,
    clearBulkEdit: () => {
      bulkEditData = {
        wage_days: '',
        epf_deduction: '',
        esic_deduction: '',
        other_deduction: '',
        other_benefit: '',
        paid_date: '',
        cheque_no: '',
        paid_from_bank_ac: '',
        remarks: ''
      };
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Manage mode - Selection
    toggleWageSelection: (wageId, checked) => {
      if (checked) {
        selectedWageIds.add(wageId);
      } else {
        selectedWageIds.delete(wageId);
      }
      updateManageSelectionUI(wageId); // surgical patch — no full re-render
    },
    toggleSelectAll: (checked) => {
      const filteredWages = getFilteredManageWages();
      if (checked) {
        filteredWages.forEach(wage => selectedWageIds.add(wage.id));
      } else {
        filteredWages.forEach(wage => selectedWageIds.delete(wage.id));
      }
      updateManageSelectionUI(null); // null = select-all path
    },

    // Export
    exportToExcel: exportToExcel
  };

  // Initial render
  const content = render();
  renderLayout(content, router);
}