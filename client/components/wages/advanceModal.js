import { api, fetchWithCSRF } from '../../utils/api.js';

export function createAdvanceModal() {
  let modalRoot = null;
  let allEmployees = [];
  let employeeBalances = {}; 
  let filteredEmployees = [];
  let firmBankAccounts = [];
  let selectedEmployeeId = null;
  let onSuccessCallback = null;
  let currentSearchTerm = '';
  let showOnlyWithBalance = false;

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  function getInitials(name) {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
  }

  async function loadData() {
    try {
      const [empRes, balRes] = await Promise.all([
        api.get('/api/master-rolls?activeOnly=true'),
        api.get('/api/advances/bulk-balances')
      ]);

      if (empRes.success) {
        allEmployees = empRes.data.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
      }
      if (balRes.success) {
        employeeBalances = balRes.balances || {};
      }
      
      applyFilters();
    } catch (e) {
      console.error('Failed to load data for advance modal', e);
    }
  }

  function applyFilters() {
    filteredEmployees = allEmployees.filter(emp => {
      const nameMatch = emp.employee_name.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
                       (emp.project || '').toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
                       (emp.site || '').toLowerCase().includes(currentSearchTerm.toLowerCase());
      
      const balance = employeeBalances[emp._id] || 0;
      const balanceMatch = !showOnlyWithBalance || balance > 0;

      return nameMatch && balanceMatch;
    });
    
    renderEmployeeList();
  }

  function getBankAccountOptionLabel(account) {
    const parts = [
      account.account_name || account.bank_name || 'Bank Account',
      account.bank_name || null,
      account.account_number ? `A/C ${account.account_number}` : null,
    ].filter(Boolean);
    return parts.join(' • ');
  }

  function render() {
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-7xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-200">
          
          <div class="flex flex-col md:flex-row h-[650px] bg-white">
            
            <!-- 1. LEFT DIRECTORY (MINIMAL) -->
            <div class="w-[220px] border-r border-slate-100 flex flex-col bg-slate-50/50">
              <div class="p-4 border-b border-slate-100 bg-white">
                <div class="flex items-center gap-2 mb-4">
                  <div class="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center text-white text-sm">💸</div>
                  <h3 class="text-sm font-black text-slate-900 tracking-tighter uppercase">Ledger</h3>
                </div>

                <div class="space-y-2">
                  <input type="text" id="adv-employee-search" placeholder="Search..." 
                    class="w-full px-3 py-2 bg-slate-100/50 border-none rounded-xl text-[11px] font-bold focus:ring-1 focus:ring-slate-900/10 transition-all placeholder:text-slate-400" />
                  
                  <div class="flex p-0.5 bg-slate-100 rounded-lg">
                    <button id="filter-all" class="flex-1 py-1 text-[8px] font-black uppercase tracking-widest rounded-md transition-all ${!showOnlyWithBalance ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}">All</button>
                    <button id="filter-balance" class="flex-1 py-1 text-[8px] font-black uppercase tracking-widest rounded-md transition-all ${showOnlyWithBalance ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}">Debt</button>
                  </div>
                </div>
              </div>
              
              <div id="advance-employee-list" class="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
                <!-- List items rendered here -->
              </div>
            </div>

            <!-- 2. RIGHT WORKSPACE (EXPANDED) -->
            <div class="flex-1 flex flex-col bg-white relative">
              
              <!-- NO SELECTION OVERLAY -->
              <div id="adv-form-overlay" class="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center text-center p-8 transition-all duration-500">
                <div class="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-3xl mb-4 text-slate-200 border border-slate-100">👤</div>
                <p class="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Select Employee to begin</p>
              </div>

              <!-- MAIN INTERFACE -->
              <div id="adv-main-content" class="flex-1 flex flex-col overflow-hidden opacity-0 transition-all duration-500 scale-[0.99]">
                
                <!-- HEADER / HERO (COMPACTED) -->
                <div class="px-8 py-6 bg-slate-900 text-white flex justify-between items-center relative overflow-hidden shrink-0">
                   <button id="close-advance-modal" class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-rose-500 transition-all text-sm">&times;</button>
                   
                   <div>
                     <span class="inline-block px-1.5 py-0.5 bg-emerald-500 text-[8px] font-black rounded uppercase tracking-widest mb-1">Live Statement</span>
                     <h4 id="selected-emp-name" class="text-2xl font-black tracking-tighter">--</h4>
                     <p id="selected-emp-meta" class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">--</p>
                   </div>
                   
                   <div class="text-right">
                     <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 text-right">Outstanding</p>
                     <p id="advance-outstanding-balance" class="text-3xl font-black text-white font-mono tracking-tighter">₹ 0.00</p>
                   </div>
                </div>

                <div class="flex-1 flex overflow-hidden">
                   
                   <!-- CENTER: HISTORY LEDGER (NARROWER) -->
                   <div class="w-[260px] border-r border-slate-100 flex flex-col bg-slate-50/20">
                      <div class="px-5 py-3 border-b border-slate-100/50">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction History</span>
                      </div>
                      <div id="advance-history-list" class="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
                        <!-- History items -->
                      </div>
                   </div>

                   <!-- RIGHT: DISBURSEMENT CONSOLE (MAX SPACE & COMPACT) -->
                   <div class="flex-1 flex flex-col bg-white overflow-y-auto p-8 custom-scrollbar">
                      
                      <div class="mb-6">
                         <div class="flex items-center gap-2 mb-1">
                           <div class="w-1 h-4 bg-slate-900 rounded-full"></div>
                           <h5 class="text-[11px] font-black text-slate-900 uppercase tracking-widest">Disbursement Console</h5>
                         </div>
                         <p class="text-[9px] text-slate-400 font-bold uppercase">Record new cash or bank advance</p>
                      </div>
                      
                      <form id="advance-form" class="space-y-4">
                        
                        <!-- AMOUNT & DATE (CLEAN & COMPACT) -->
                        <div class="grid grid-cols-2 gap-4">
                          <div class="space-y-1.5">
                            <label class="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Advance Amount</label>
                            <div class="relative group">
                              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">₹</span>
                              <input type="number" id="adv-amount" required step="0.01" min="1" placeholder="0.00" 
                                class="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all placeholder:text-slate-300" />
                            </div>
                          </div>
                          
                          <div class="space-y-1.5">
                            <label class="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Disbursement Date</label>
                            <input type="date" id="adv-date" required 
                              class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all" />
                          </div>
                        </div>

                        <!-- CHANNEL SELECTION (HORIZONTAL & TIGHT) -->
                        <div class="space-y-1.5">
                          <label class="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Payment Channel</label>
                          <div class="grid grid-cols-2 gap-3">
                            <label class="relative flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900/5 group">
                              <input type="radio" name="payment-mode" value="CASH" checked class="sr-only">
                              <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm group-has-[:checked]:bg-slate-900 group-has-[:checked]:text-white">💵</div>
                              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 group-has-[:checked]:text-slate-900">Physical Cash</span>
                            </label>
                            
                            <label class="relative flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900/5 group">
                              <input type="radio" name="payment-mode" value="BANK" class="sr-only">
                              <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm group-has-[:checked]:bg-slate-900 group-has-[:checked]:text-white">🏦</div>
                              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 group-has-[:checked]:text-slate-900">Firm Bank</span>
                            </label>
                          </div>
                        </div>

                        <!-- BANK DROPDOWN -->
                        <div id="adv-bank-details-container" class="hidden animate-in slide-in-from-top-2 duration-200 space-y-1.5">
                          <label class="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Funding Account</label>
                          <select id="adv-bank-select" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all appearance-none cursor-pointer">
                            <option value="">-- Select Bank Account --</option>
                            ${firmBankAccounts.map(account => `
                              <option value="${getBankAccountOptionLabel(account)}">
                                ${getBankAccountOptionLabel(account)}
                              </option>
                            `).join('')}
                          </select>
                        </div>

                        <!-- REMARKS -->
                        <div class="space-y-1.5">
                          <label class="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Notes / Remarks</label>
                          <textarea id="adv-remarks" rows="2" placeholder="Brief reason..." 
                            class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all resize-none"></textarea>
                        </div>

                        <!-- ERROR DISPLAY -->
                        <div id="adv-error" class="hidden">
                           <div class="bg-rose-50 p-3 rounded-xl border border-rose-100 flex items-center gap-3">
                              <span class="text-sm">⚠️</span>
                              <p class="text-[9px] font-black text-rose-600 uppercase tracking-wide" id="adv-error-text"></p>
                           </div>
                        </div>

                        <!-- SUBMIT -->
                        <button type="submit" id="save-advance-btn" 
                          class="w-full py-4 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg shadow-slate-900/20">
                          Confirm Disbursement
                        </button>
                      </form>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    if (selectedEmployeeId) {
      onEmployeeSwitch(selectedEmployeeId);
    } else {
      renderEmployeeList();
    }
  }

  function renderEmployeeList() {
    const list = modalRoot.querySelector('#advance-employee-list');
    if (!list) return;

    if (filteredEmployees.length === 0) {
      list.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-center opacity-40">
           <p class="text-[8px] font-black uppercase tracking-widest text-slate-500 text-center">No staff found</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filteredEmployees.map(emp => {
      const balance = employeeBalances[emp._id] || 0;
      const isSelected = selectedEmployeeId === emp._id;
      const initials = getInitials(emp.employee_name);
      
      return `
        <div data-emp-id="${emp._id}" class="group p-2 rounded-xl transition-all cursor-pointer border-2 border-transparent ${isSelected ? 'bg-slate-900 border-slate-900' : 'hover:bg-white hover:shadow-sm'} flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${isSelected ? 'bg-white/10 text-white' : 'bg-white text-slate-400 group-hover:bg-slate-900 group-hover:text-white shadow-sm border border-slate-100'}">
            ${initials}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-[11px] font-black truncate ${isSelected ? 'text-white' : 'text-slate-700'}">${esc(emp.employee_name)}</h4>
            <p class="text-[8px] font-bold ${isSelected ? 'text-slate-400' : 'text-slate-400'} uppercase truncate tracking-widest">${esc(emp.project || 'GENERAL')}</p>
          </div>
          ${balance > 0 ? `
            <div class="text-right">
              <p class="text-[9px] font-black ${isSelected ? 'text-emerald-400' : 'text-rose-500'} font-mono">₹${Math.round(balance)}</p>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Bind item clicks
    list.querySelectorAll('[data-emp-id]').forEach(el => {
      el.onclick = () => onEmployeeSwitch(el.dataset.empId);
    });
  }

  function bindEvents() {
    modalRoot.querySelector('#close-advance-modal').onclick = close;
    
    const searchInput = modalRoot.querySelector('#adv-employee-search');
    searchInput.oninput = (e) => {
      currentSearchTerm = e.target.value;
      applyFilters();
    };

    modalRoot.querySelector('#filter-all').onclick = () => {
      showOnlyWithBalance = false;
      modalRoot.querySelector('#filter-all').classList.add('bg-white', 'text-slate-900', 'shadow-sm');
      modalRoot.querySelector('#filter-all').classList.remove('text-slate-500');
      modalRoot.querySelector('#filter-balance').classList.remove('bg-white', 'text-rose-600', 'shadow-sm');
      modalRoot.querySelector('#filter-balance').classList.add('text-slate-500');
      applyFilters();
    };

    modalRoot.querySelector('#filter-balance').onclick = () => {
      showOnlyWithBalance = true;
      modalRoot.querySelector('#filter-balance').classList.add('bg-white', 'text-rose-600', 'shadow-sm');
      modalRoot.querySelector('#filter-balance').classList.remove('text-slate-500');
      modalRoot.querySelector('#filter-all').classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
      modalRoot.querySelector('#filter-all').classList.add('text-slate-500');
      applyFilters();
    };

    const modeRadios = modalRoot.querySelectorAll('input[name="payment-mode"]');
    const bankDetails = modalRoot.querySelector('#adv-bank-details-container');
    modeRadios.forEach(radio => {
      radio.onchange = (e) => {
        bankDetails.classList.toggle('hidden', e.target.value !== 'BANK');
      };
    });

    const form = modalRoot.querySelector('#advance-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!selectedEmployeeId) return;

      const mode = modalRoot.querySelector('input[name="payment-mode"]:checked').value;
      const bankVal = document.getElementById('adv-bank-select').value;
      
      const btn = document.getElementById('save-advance-btn');
      const errContainer = document.getElementById('adv-error');
      const errText = document.getElementById('adv-error-text');

      if (mode === 'BANK' && !bankVal) {
        errText.innerText = 'SELECT FUNDING ACCOUNT';
        errContainer.classList.remove('hidden');
        return;
      }
      
      errContainer.classList.add('hidden');
      btn.disabled = true;
      btn.innerText = 'PROCESSING...';

      try {
        const payload = {
          masterRollId: selectedEmployeeId,
          amount: document.getElementById('adv-amount').value,
          date: document.getElementById('adv-date').value,
          paymentMode: mode,
          bankDetails: mode === 'BANK' ? bankVal : '',
          remarks: document.getElementById('adv-remarks').value
        };

        const result = await api.post('/api/advances/record', payload);
        
        if (result.success) {
          form.reset();
          document.getElementById('adv-date').value = new Date().toISOString().split('T')[0];
          await Promise.all([
            loadHistory(selectedEmployeeId),
            loadBalance(selectedEmployeeId),
            refreshBalanceMap()
          ]);
          if (onSuccessCallback) onSuccessCallback(selectedEmployeeId);
        } else {
          errText.innerText = (result.message || 'TRANSACTION FAILED').toUpperCase();
          errContainer.classList.remove('hidden');
        }
      } catch (error) {
        errText.innerText = 'CONNECTION ERROR';
        errContainer.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerText = 'CONFIRM DISBURSEMENT';
      }
    };
  }

  async function refreshBalanceMap() {
    const balRes = await api.get('/api/advances/bulk-balances');
    if (balRes.success) {
      employeeBalances = balRes.balances || {};
      renderEmployeeList();
    }
  }

  async function onEmployeeSwitch(empId) {
    selectedEmployeeId = empId;
    const overlay = modalRoot.querySelector('#adv-form-overlay');
    const mainContent = modalRoot.querySelector('#adv-main-content');

    if (!empId) {
      overlay.classList.remove('hidden');
      mainContent.classList.add('opacity-0', 'scale-[0.99]');
      return;
    }

    overlay.classList.add('hidden');
    mainContent.classList.remove('opacity-0', 'scale-[0.99]');
    
    const emp = allEmployees.find(e => e._id === empId);
    if (emp) {
      modalRoot.querySelector('#selected-emp-name').innerText = emp.employee_name;
      modalRoot.querySelector('#selected-emp-meta').innerText = `${emp.project || 'General'} • ${emp.site || 'N/A'}`;
    }

    document.getElementById('adv-date').value = new Date().toISOString().split('T')[0];
    
    renderEmployeeList();
    await Promise.all([
      loadHistory(empId),
      loadBalance(empId)
    ]);
  }

  async function loadHistory(empId) {
    const list = document.getElementById('advance-history-list');
    list.innerHTML = `<div class="flex flex-col items-center justify-center h-full gap-2 opacity-10"><div class="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div><p class="text-[8px] font-black uppercase tracking-widest text-center">Syncing...</p></div>`;
    
    try {
      const result = await api.get(`/api/advances/history/${empId}`);
      if (result.success && result.data.length > 0) {
        list.innerHTML = result.data.map(rec => `
          <div class="bg-white p-3 rounded-2xl border border-slate-100 flex justify-between items-center group/item hover:border-slate-300 transition-all">
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${rec.type === 'ADVANCE' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}">
                  ${rec.type}
                </span>
                <span class="text-[9px] font-bold text-slate-300 font-mono">${rec.date}</span>
              </div>
              <p class="text-[11px] font-black text-slate-800 truncate">${rec.remarks || 'Transaction'}</p>
            </div>
            <div class="text-right flex flex-col items-end">
              <p class="text-[12px] font-black ${rec.type === 'ADVANCE' ? 'text-slate-900' : 'text-emerald-500'} font-mono">
                ${rec.type === 'ADVANCE' ? '' : '-' }₹${Math.round(rec.amount)}
              </p>
              ${rec.payment_mode !== 'WAGE_DEDUCTION' ? `
                <button data-action="delete-advance" data-id="${rec._id}" class="mt-1 text-[7px] font-black text-rose-400 opacity-0 group-hover/item:opacity-100 transition-all uppercase tracking-widest hover:text-rose-600">Void</button>
              ` : ''}
            </div>
          </div>
        `).join('');

        list.onclick = async (e) => {
          const btn = e.target.closest('[data-action="delete-advance"]');
          if (!btn) return;
          if (!confirm('AUDIT WARNING: VOID this entry?')) return;
          try {
            const res = await api.delete(`/api/advances/${btn.dataset.id}`);
            if (res.success) {
              await Promise.all([
                loadHistory(empId),
                loadBalance(empId),
                refreshBalanceMap()
              ]);
              if (onSuccessCallback) onSuccessCallback(empId);
            } else {
              alert(res.message);
            }
          } catch (err) {
            alert('Operation failed');
          }
        };
      } else {
        list.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-center opacity-10 p-8">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-900">Ledger Clear</p>
          </div>
        `;
      }
    } catch (err) {
      list.innerHTML = `<div class="p-4 text-rose-500 text-[8px] font-black uppercase text-center">Sync Error</div>`;
    }
  }

  async function loadBalance(empId) {
    const balEl = document.getElementById('advance-outstanding-balance');
    try {
      const result = await api.get(`/api/advances/balance/${empId}`);
      if (result.success) {
        balEl.innerText = `₹ ${result.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      }
    } catch (err) {
      balEl.innerText = '₹ --.--';
    }
  }

  function close() {
    if (modalRoot) {
      modalRoot.remove();
      modalRoot = null;
    }
  }

  return {
    open: async (preselectedEmpId, banks, callback) => {
      selectedEmployeeId = preselectedEmpId;
      firmBankAccounts = banks || [];
      onSuccessCallback = callback;
      
      modalRoot = document.createElement('div');
      modalRoot.id = 'advance-modal-container';
      document.body.appendChild(modalRoot);
      
      render();
      await loadData();
      render();
    },
    close
  };
}
