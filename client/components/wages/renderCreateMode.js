export function renderCreateMode(ctx) {
  const {
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
    openAdvanceModal,
    formatMonthDisplay,
    formatCurrency,
    calculateNetSalary,
    getFilteredCreateEmployees,
    getUniqueValues,
    sortArray
  } = ctx;

  const filteredEmployees = getFilteredCreateEmployees();
  const uniqueBanks = getUniqueValues(employees, 'bank');
  const uniqueProjects = getUniqueValues(employees, 'project');
  const uniqueSites = getUniqueValues(employees, 'site');

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
        <div class="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Month</label>
              <input type="month" id="create-month-input" value="${selectedMonth}" data-action="month-change" data-mode="create"
                class="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-black text-slate-700 outline-none focus:ring-1 focus:ring-slate-900/10" />
            </div>
            <button data-action="load-employees" class="px-3 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1.5" ${isLoading ? 'disabled' : ''}>
              ${isLoading ? 'Syncing...' : '🔄 Load Staff'}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button data-action="calculate-bulk" class="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-100 transition-all">🧮 Auto-Calc</button>
            <button id="save-wages-btn" data-action="save-wages" class="px-3 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" ${selectedEmployeeIds.size === 0 ? 'disabled' : ''}>
              💾 Save Payroll (${selectedEmployeeIds.size})
            </button>
            <button data-action="export-wages" class="px-3 py-1.5 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-all">📥 Export</button>
          </div>
        </div>

        <!-- 2. FILTERS -->
        <div class="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 overflow-x-auto shrink-0">
          <input type="text" placeholder="Search staff..." data-action="search-filter" data-mode="create" data-field="searchTerm" value="${createFilters.searchTerm || ''}"
            class="min-w-[140px] px-2 py-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-slate-900/5 transition-all" />
          <select data-action="search-filter" data-mode="create" data-field="bankFilter" class="px-2 py-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold outline-none">
            <option value="all">All Banks</option>
            ${uniqueBanks.map(b => `<option value="${b}" ${createFilters.bankFilter === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
          <select data-action="search-filter" data-mode="create" data-field="projectFilter" class="px-2 py-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold outline-none">
            <option value="all">All Projects</option>
            ${uniqueProjects.map(p => `<option value="${p}" ${createFilters.projectFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <select data-action="search-filter" data-mode="create" data-field="siteFilter" class="px-2 py-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold outline-none">
            <option value="all">All Sites</option>
            ${uniqueSites.map(s => `<option value="${s}" ${createFilters.siteFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>

        <!-- 3. COMMON & SUMMARY -->
        <div class="flex gap-2 h-11 shrink-0">
          <div class="bg-indigo-900/5 border border-indigo-100 px-3 rounded-xl flex items-center gap-4 flex-1">
             <span class="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none border-r border-indigo-100 pr-3">Bulk<br>Pay</span>
             <div class="flex items-center gap-3">
               <div class="flex items-center gap-1.5">
                  <label class="text-[8px] font-black text-indigo-300 uppercase">Date</label>
                  <input type="date" value="${commonPaymentData.paid_date}" data-action="common-payment" data-field="paid_date" class="px-1 py-0.5 bg-white border border-indigo-50 rounded text-[9px] font-bold outline-none" />
               </div>
               <div class="flex items-center gap-1.5">
                  <label class="text-[8px] font-black text-indigo-300 uppercase">Bank</label>
                  <select data-action="common-payment" data-field="paid_from_bank_ac" class="px-1 py-0.5 bg-white border border-indigo-50 rounded text-[9px] font-bold outline-none max-w-[100px]">
                    <option value="">Choose</option>
                    ${firmBankAccounts.map(a => `<option value="${getBankAccountOptionLabel(a)}" ${commonPaymentData.paid_from_bank_ac === getBankAccountOptionLabel(a) ? 'selected' : ''}>${getBankAccountOptionLabel(a)}</option>`).join('')}
                  </select>
               </div>
               <div class="flex items-center gap-1.5">
                  <label class="text-[8px] font-black text-indigo-300 uppercase">Ref</label>
                  <input type="text" value="${commonPaymentData.cheque_no}" data-action="common-payment" data-field="cheque_no" class="px-1 py-0.5 bg-white border border-indigo-50 rounded text-[10px] font-bold outline-none w-16" />
               </div>
             </div>
          </div>

          <div class="bg-slate-900 rounded-xl px-4 flex items-center gap-4 border border-slate-800">
             <div class="flex flex-col"><span class="text-[7px] font-black text-slate-500 uppercase tracking-widest">Gross</span><span id="create-summary-gross" class="text-[11px] font-black text-white font-mono">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, id) => sum + (wageData[id]?.gross_salary || 0), 0))}</span></div>
             <div class="flex flex-col"><span class="text-[7px] font-black text-slate-500 uppercase tracking-widest">EPF</span><span id="create-summary-epf" class="text-[11px] font-black text-amber-500 font-mono">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, id) => sum + (wageData[id]?.epf_deduction || 0), 0))}</span></div>
             <div class="flex flex-col"><span class="text-[7px] font-black text-slate-500 uppercase tracking-widest">ESIC</span><span id="create-summary-esic" class="text-[11px] font-black text-amber-500 font-mono">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, id) => sum + (wageData[id]?.esic_deduction || 0), 0))}</span></div>
             <div class="flex flex-col"><span class="text-[7px] font-black text-slate-500 uppercase tracking-widest">Advance</span><span id="create-summary-advance" class="text-[11px] font-black text-rose-400 font-mono">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, id) => sum + (wageData[id]?.advance_deduction || 0), 0))}</span></div>
             <div class="w-px h-4 bg-slate-800 mx-1"></div>
             <div class="flex flex-col"><span class="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Net</span><span id="create-summary-net" class="text-xs font-black text-emerald-400 font-mono italic">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, id) => { const w = wageData[id]; return sum + (w ? calculateNetSalary(w.gross_salary, w.epf_deduction, w.esic_deduction, w.other_deduction, w.other_benefit, w.advance_deduction) : 0); }, 0))}</span></div>
          </div>
        </div>

        <!-- 4. TABLE -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-1 min-h-0">
          <div class="overflow-y-auto max-h-full scrollbar-thin scrollbar-thumb-slate-200">
            <table class="w-full border-collapse table-fixed">
              <thead class="sticky top-0 z-10">
                <tr class="bg-slate-900 border-b border-white/5">
                  <th class="p-2 w-10 text-center shrink-0"><input type="checkbox" id="select-all-create" data-action="select-all" data-mode="create" class="w-3 h-3 rounded accent-indigo-600" ${filteredEmployees.length > 0 && filteredEmployees.every(e => selectedEmployeeIds.has(e.master_roll_id)) ? 'checked' : ''} /></th>
                  <th class="px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase w-48 shrink-0">Employee</th>
                  <th class="px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase w-40 shrink-0">Bank</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-16 shrink-0">Rate</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-12 shrink-0">Days</th>
                  <th class="px-3 py-2 text-right text-[9px] font-black text-slate-500 uppercase w-20 shrink-0">Gross</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-16 shrink-0">EPF</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-16 shrink-0">ESIC</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-16 shrink-0">Other</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-16 shrink-0">Ben</th>
                  <th class="px-2 py-2 text-center text-[9px] font-black text-slate-500 uppercase w-16 shrink-0">Adv</th>
                  <th class="px-4 py-2 text-right text-[9px] font-black text-emerald-400 uppercase bg-white/5 italic w-24 shrink-0">Net</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                ${sortArray(filteredEmployees, createSort.column, createSort.asc).map(emp => {
                  const wage = wageData[emp.master_roll_id] || {};
                  const isSelected = selectedEmployeeIds.has(emp.master_roll_id);
                  const outstanding = employeeAdvances[emp.master_roll_id] || 0;
                  const netSalary = calculateNetSalary(wage.gross_salary, wage.epf_deduction, wage.esic_deduction, wage.other_deduction, wage.other_benefit, wage.advance_deduction);
                  return `
                    <tr data-emp-row="${emp.master_roll_id}" class="hover:bg-slate-50/50 group ${isSelected ? 'bg-indigo-50/20' : ''}">
                      <td class="p-2 text-center border-r border-slate-50"><input type="checkbox" data-action="toggle-employee" data-emp-id="${emp.master_roll_id}" ${isSelected ? 'checked' : ''} class="w-3 h-3 rounded accent-indigo-600" /></td>
                      <td class="px-3 py-1 border-r border-slate-50">
                        <div class="flex items-center gap-1.5">
                          <span class="text-[10px] font-black text-slate-800">${esc(emp.employee_name)}</span>
                          ${outstanding > 0 ? `<span class="px-1 py-0.5 bg-rose-50 text-rose-600 text-[6px] font-black rounded border border-rose-100">ADV</span>` : ''}
                        </div>
                        <p class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">${esc(emp.project)}</p>
                      </td>
                      <td class="px-3 py-1 border-r border-slate-50">
                        <div class="text-[9px] font-bold text-slate-500 truncate max-w-[100px]">${esc(emp.bank)}</div>
                        <div class="text-[8px] font-mono text-slate-300 italic">${esc(emp.account_no)}</div>
                      </td>
                      <td class="px-2 py-1 border-r border-slate-50">
                        <input type="number" step="0.01" value="${wage.p_day_wage}" data-action="edit-employee" data-emp-id="${emp.master_roll_id}" data-field="p_day_wage" class="w-full px-1 py-0.5 bg-transparent border-none text-center text-[10px] font-bold focus:ring-1 focus:ring-slate-200 rounded" />
                      </td>
                      <td class="px-2 py-1 text-center border-r border-slate-50">
                        <input type="number" value="${wage.wage_days}" data-action="edit-employee" data-emp-id="${emp.master_roll_id}" data-field="wage_days" class="w-full px-1 py-0.5 bg-slate-50 border-none rounded text-center text-[11px] font-black text-indigo-600" />
                      </td>
                      <td class="px-3 py-1 text-right border-r border-slate-50">
                        <span data-emp-id="${emp.master_roll_id}" data-field="gross_salary" class="text-[11px] font-black text-slate-900 font-mono">${Math.round(wage.gross_salary || 0)}</span>
                      </td>
                      <td class="px-2 py-1 border-r border-slate-50">
                        <input type="number" value="${wage.epf_deduction}" data-action="edit-employee" data-emp-id="${emp.master_roll_id}" data-field="epf_deduction" class="w-full px-1 py-0.5 bg-transparent border-none text-center text-[10px] font-bold text-amber-700" />
                      </td>
                      <td class="px-2 py-1 border-r border-slate-50">
                        <input type="number" value="${wage.esic_deduction}" data-action="edit-employee" data-emp-id="${emp.master_roll_id}" data-field="esic_deduction" class="w-full px-1 py-0.5 bg-transparent border-none text-center text-[10px] font-bold text-amber-700" />
                      </td>
                      <td class="px-2 py-1 border-r border-slate-50">
                        <input type="number" value="${wage.other_deduction}" data-action="edit-employee" data-emp-id="${emp.master_roll_id}" data-field="other_deduction" class="w-full px-1 py-0.5 bg-transparent border-none text-center text-[10px] font-bold text-amber-600" />
                      </td>
                      <td class="px-2 py-1 border-r border-slate-50">
                        <input type="number" value="${wage.other_benefit}" data-action="edit-employee" data-emp-id="${emp.master_roll_id}" data-field="other_benefit" class="w-full px-1 py-0.5 bg-transparent border-none text-center text-[10px] font-bold text-emerald-600" />
                      </td>
                      <td class="px-2 py-1 border-r border-slate-50">
                        <input type="number" value="${wage.advance_deduction}" data-action="edit-employee" data-emp-id="${emp.master_roll_id}" data-field="advance_deduction" placeholder="${outstanding > 0 ? '₹' + Math.round(outstanding) : '0'}" class="w-full px-1 py-0.5 rounded text-center text-[10px] font-black transition-all ${outstanding > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100 shadow-sm shadow-rose-100' : 'bg-transparent border-none focus:ring-1 focus:ring-slate-100 text-slate-400'}" />
                      </td>
                      <td class="px-4 py-1 text-right bg-slate-50/50 font-black text-emerald-600 font-mono text-[11px] italic">
                        <span data-emp-id="${emp.master_roll_id}" data-field="net_salary">${netSalary.toFixed(2)}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${filteredEmployees.length === 0 ? `<div class="p-12 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">No staff records found</div>` : ''}
        </div>
      </div>
    `;
}
