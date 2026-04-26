export function renderManageMode(ctx) {
  const {
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
    openAdvanceModal,
    formatMonthDisplay,
    formatDateDisplay,
    formatCurrency,
    calculateNetSalary,
    getFilteredManageWages,
    getUniqueValues,
    sortArray,
    toNumber
  } = ctx;

  const filteredWages = getFilteredManageWages();
  const uniqueBanks = getUniqueValues(existingWages.map(w => w.master_roll_id).filter(Boolean), 'bank');
  const uniqueProjects = getUniqueValues(existingWages.map(w => w.master_roll_id).filter(Boolean), 'project');
  const uniqueSites = getUniqueValues(existingWages.map(w => w.master_roll_id).filter(Boolean), 'site');

  function getBankAccountOptionLabel(account) {
    const parts = [
      account.account_name || account.bank_name || 'Bank Account',
      account.bank_name || null,
      account.account_number ? `A/C ${account.account_number}` : null,
    ].filter(Boolean);
    return parts.join(' • ');
  }

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  return `
      <div class="w-full flex flex-col gap-2">
        <!-- 1. TOOLBAR -->
        <div class="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">History</label>
              <input type="month" id="manage-month-input" value="${manageMonth}" data-action="month-change" data-mode="manage"
                class="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-black text-slate-700 outline-none focus:ring-1 focus:ring-slate-900/10" />
            </div>
            <button data-action="load-wages" class="px-3 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1.5" ${isManageLoading ? 'disabled' : ''}>
              ${isManageLoading ? 'Syncing...' : '🔄 Fetch Records'}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button data-action="toggle-bulk-edit" class="px-3 py-1.5 ${isBulkEditMode ? 'bg-rose-600 text-white' : 'bg-indigo-50 text-indigo-600'} text-[9px] font-black uppercase tracking-widest rounded-lg transition-all" ${selectedWageIds.size === 0 ? 'disabled' : ''}>
              ${isBulkEditMode ? '✖ Cancel Bulk' : '✏️ Bulk Edit'}
            </button>
            <div id="manage-selection-actions" class="${selectedWageIds.size > 0 ? 'flex' : 'hidden'} items-center gap-2 border-l border-slate-100 pl-4 ml-2 animate-in slide-in-from-right-4">
               <button data-action="delete-selected" class="px-3 py-1.5 bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-100 transition-all">🗑 Delete (${selectedWageIds.size})</button>
            </div>
            <div id="save-edited-btn-container" class="${Object.keys(editedWages).length > 0 ? 'block' : 'hidden'} animate-in zoom-in">
               <button data-action="save-edited" class="px-3 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-emerald-900/10">💾 Push Changes (${Object.keys(editedWages).length})</button>
            </div>
            <button data-action="export-wages" class="px-3 py-1.5 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-all">📥 Export</button>
          </div>
        </div>

        <!-- 2. BULK EDIT -->
        ${isBulkEditMode ? `
          <div class="bg-indigo-900/5 border-2 border-indigo-100 p-4 rounded-2xl animate-in slide-in-from-top-4 duration-300">
             <div class="grid grid-cols-5 gap-4">
                <div class="space-y-1"><label class="text-[8px] font-black text-indigo-400 uppercase">Wage Days</label><input type="number" value="${bulkEditData.wage_days}" data-action="set-bulk-edit" data-field="wage_days" class="w-full px-2 py-1.5 rounded-lg border-none bg-white text-xs font-bold" /></div>
                <div class="space-y-1"><label class="text-[8px] font-black text-indigo-400 uppercase">Paid Date</label><input type="date" value="${bulkEditData.paid_date}" data-action="set-bulk-edit" data-field="paid_date" class="w-full px-2 py-1.5 rounded-lg border-none bg-white text-xs font-bold" /></div>
                <div class="space-y-1"><label class="text-[8px] font-black text-indigo-400 uppercase">Funding Account</label><select data-action="set-bulk-edit" data-field="paid_from_bank_ac" class="w-full px-2 py-1.5 rounded-lg border-none bg-white text-[10px] font-bold">
                    <option value="">Skip</option>
                    ${firmBankAccounts.map(a => `<option value="${getBankAccountOptionLabel(a)}" ${bulkEditData.paid_from_bank_ac === getBankAccountOptionLabel(a) ? 'selected' : ''}>${getBankAccountOptionLabel(a)}</option>`).join('')}
                </select></div>
                <div class="space-y-1"><label class="text-[8px] font-black text-indigo-400 uppercase">Reference</label><input type="text" value="${bulkEditData.cheque_no}" data-action="set-bulk-edit" data-field="cheque_no" class="w-full px-2 py-1.5 rounded-lg border-none bg-white text-xs font-bold" /></div>
                <div class="flex items-end gap-2">
                   <button data-action="apply-bulk-edit" class="flex-1 py-1.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-lg">Apply</button>
                   <button data-action="clear-bulk-edit" class="flex-1 py-1.5 bg-white text-slate-400 text-[9px] font-black uppercase rounded-lg border border-indigo-100">Clear</button>
                </div>
             </div>
          </div>
        ` : ''}

        <!-- 3. FILTERS -->
        <div class="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 overflow-x-auto">
          <input type="text" placeholder="Search entries..." data-action="search-filter" data-mode="manage" data-field="searchTerm" value="${manageFilters.searchTerm || ''}"
            class="min-w-[140px] px-2 py-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold outline-none" />
          <select data-action="search-filter" data-mode="manage" data-field="projectFilter" class="px-2 py-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold outline-none">
            <option value="all">All Projects</option>
            ${uniqueProjects.map(p => `<option value="${p}" ${manageFilters.projectFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <select data-action="search-filter" data-mode="manage" data-field="siteFilter" class="px-2 py-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold outline-none">
            <option value="all">All Sites</option>
            ${uniqueSites.map(s => `<option value="${s}" ${manageFilters.siteFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <div class="w-px h-4 bg-slate-100"></div>
          <select data-action="search-filter" data-mode="manage" data-field="paidFilter" class="px-2 py-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold outline-none">
            <option value="all" ${manageFilters.paidFilter === 'all' ? 'selected' : ''}>All Status</option>
            <option value="paid" ${manageFilters.paidFilter === 'paid' ? 'selected' : ''}>Settled</option>
            <option value="unpaid" ${manageFilters.paidFilter === 'unpaid' ? 'selected' : ''}>Pending</option>
          </select>
        </div>

        <!-- 4. SUMMARY STRIP -->
        <div class="bg-slate-900 rounded-xl p-2 px-6 flex items-center gap-8 border border-slate-800 h-11 shrink-0 ${selectedWageIds.size > 0 ? 'flex' : 'hidden'}">
             <div class="flex flex-col"><span class="text-[7px] font-black text-slate-500 uppercase">Gross</span><span id="summary-total-gross" class="text-[11px] font-black text-white font-mono leading-none">₹0</span></div>
             <div class="flex flex-col"><span class="text-[7px] font-black text-slate-500 uppercase">EPF</span><span id="summary-total-epf" class="text-[11px] font-black text-amber-500 font-mono leading-none">₹0</span></div>
             <div class="flex flex-col"><span class="text-[7px] font-black text-slate-500 uppercase">ESIC</span><span id="summary-total-esic" class="text-[11px] font-black text-amber-500 font-mono leading-none">₹0</span></div>
             <div class="flex flex-col"><span class="text-[7px] font-black text-slate-500 uppercase">Advance</span><span id="summary-total-advance" class="text-[11px] font-black text-rose-400 font-mono leading-none">₹0</span></div>
             <div class="w-px h-6 bg-slate-800"></div>
             <div class="flex flex-col"><span class="text-[7px] font-black text-emerald-500 uppercase">Net Settled</span><span id="summary-total-net" class="text-sm font-black text-emerald-400 font-mono italic">₹0</span></div>
             <div id="unsaved-changes-badge" class="hidden px-2 py-0.5 bg-amber-500 text-slate-900 text-[8px] font-black rounded uppercase ml-auto">Unpushed Changes</div>
        </div>

        <!-- 5. DATA TABLE -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-1">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse table-fixed">
              <thead class="sticky top-0 z-10">
                <tr class="bg-slate-900 border-b border-white/5">
                  <th class="p-2 w-10 text-center shrink-0"><input type="checkbox" id="select-all-manage" data-action="select-all" data-mode="manage" class="w-3 h-3 rounded accent-indigo-600" ${filteredWages.length > 0 && filteredWages.every(w => selectedWageIds.has(w.id)) ? 'checked' : ''} /></th>
                  <th class="px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase w-48 shrink-0">Employee</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-16 shrink-0">Days</th>
                  <th class="px-3 py-2 text-right text-[9px] font-black text-slate-500 uppercase w-24 shrink-0">Gross</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-20 shrink-0">EPF</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-20 shrink-0">ESIC</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-20 shrink-0">Other Ded</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-20 shrink-0">Adv Pay</th>
                  <th class="px-4 py-2 text-right text-[9px] font-black text-emerald-400 uppercase bg-white/5 italic w-28 shrink-0">Net</th>
                  <th class="px-4 py-2 text-left text-[9px] font-black text-slate-500 uppercase w-64 shrink-0">Settlement Details</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                ${filteredWages.map(wage => {
                  const edited = editedWages[wage.id] || wage;
                  const isSelected = selectedWageIds.has(wage.id);
                  const mr = wage.master_roll_id || {};
                  const outstanding = employeeAdvances[mr._id] || 0;
                  const netSalary = calculateNetSalary(toNumber(edited.gross_salary), toNumber(edited.epf_deduction), toNumber(edited.esic_deduction), toNumber(edited.other_deduction), toNumber(edited.other_benefit), toNumber(edited.advance_deduction));

                  return `
                    <tr data-wage-row="${String(wage.id)}" class="hover:bg-slate-50/50 group ${isSelected ? 'bg-indigo-50/20' : ''}">
                      <td class="p-2 text-center border-r border-slate-50"><input type="checkbox" data-action="toggle-wage" data-wage-id="${String(wage.id)}" ${isSelected ? 'checked' : ''} class="w-3 h-3 rounded accent-indigo-600" /></td>
                      <td class="px-3 py-1.5 border-r border-slate-50"><div class="flex items-center gap-1.5"><span class="text-[10px] font-black text-slate-800">${esc(mr.employee_name)}</span>${outstanding > 0 ? `<span class="px-1 py-0.5 bg-rose-50 text-rose-600 text-[6px] font-black rounded">ADV</span>` : ''}</div><p class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">${esc(mr.project)} • ${esc(mr.site)}</p></td>
                      <td class="px-2 py-1.5 text-center border-r border-slate-50"><input type="number" value="${edited.wage_days}" data-action="edit-wage" data-wage-id="${String(wage.id)}" data-field="wage_days" class="w-full px-1 py-0.5 bg-slate-50 border-none rounded text-center text-xs font-black text-indigo-600" /></td>
                      <td class="px-3 py-1.5 text-right border-r border-slate-50"><span data-wage-id="${String(wage.id)}" data-field="gross_salary" class="text-[10px] font-black text-slate-900 font-mono">${Math.round(edited.gross_salary)}</span></td>
                      <td class="px-2 py-1.5 border-r border-slate-50"><input type="number" value="${edited.epf_deduction}" data-action="edit-wage" data-wage-id="${String(wage.id)}" data-field="epf_deduction" class="w-full px-1 py-0.5 bg-transparent border-none text-center text-[10px] font-bold text-amber-700" id="wage-${String(wage.id)}-epf_deduction" /></td>
                      <td class="px-2 py-1.5 border-r border-slate-50"><input type="number" value="${edited.esic_deduction}" data-action="edit-wage" data-wage-id="${String(wage.id)}" data-field="esic_deduction" class="w-full px-1 py-0.5 bg-transparent border-none text-center text-[10px] font-bold text-amber-700" id="wage-${String(wage.id)}-esic_deduction" /></td>
                      <td class="px-2 py-1.5 border-r border-slate-50"><input type="number" value="${edited.other_deduction}" data-action="edit-wage" data-wage-id="${String(wage.id)}" data-field="other_deduction" class="w-full px-1 py-0.5 bg-transparent border-none text-center text-[10px] font-bold text-amber-600" /></td>
                      <td class="px-2 py-1.5 border-r border-slate-50"><input type="number" value="${edited.advance_deduction}" data-action="edit-wage" data-wage-id="${String(wage.id)}" data-field="advance_deduction" placeholder="${outstanding > 0 ? '₹' + Math.round(outstanding) : '0'}" class="w-full px-1 py-0.5 rounded text-center text-[10px] font-black transition-all ${outstanding > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-transparent border-none focus:ring-1 focus:ring-slate-100 text-slate-400'}" id="wage-${String(wage.id)}-advance_deduction" /></td>
                      <td class="px-4 py-1.5 text-right border-r border-slate-50 font-black text-emerald-600 font-mono text-xs italic"><span id="wage-${String(wage.id)}-net-display" data-wage-id="${String(wage.id)}" data-field="net_salary">${formatCurrency(netSalary)}</span></td>
                      <td class="px-4 py-1.5">
                        <div class="flex items-center gap-2">
                           <input type="date" value="${edited.paid_date || ''}" data-action="edit-wage" data-wage-id="${String(wage.id)}" data-field="paid_date" class="px-1 py-0.5 bg-slate-50 border-none rounded text-[9px] font-bold" />
                           <select data-action="edit-wage" data-wage-id="${String(wage.id)}" data-field="paid_from_bank_ac" class="px-1 py-0.5 bg-slate-50 border-none rounded text-[9px] font-bold max-w-[110px]">
                              <option value="">Choose Bank</option>
                              ${firmBankAccounts.map(a => `<option value="${getBankAccountOptionLabel(a)}" ${edited.paid_from_bank_ac === getBankAccountOptionLabel(a) ? 'selected' : ''}>${getBankAccountOptionLabel(a)}</option>`).join('')}
                           </select>
                           <input type="text" value="${edited.cheque_no || ''}" data-action="edit-wage" data-wage-id="${String(wage.id)}" data-field="cheque_no" placeholder="Ref" class="w-16 px-1 py-0.5 bg-slate-50 border-none rounded text-[9px] font-bold" />
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${filteredWages.length === 0 ? `<div class="p-12 text-center text-[10px] font-black uppercase text-slate-300">No matching wage records found</div>` : ''}
        </div>
      </div>
    `;
}
