const CALCULATOR_STORAGE_KEY = 'global-tool-calculator-state';

function evaluateExpression(expression) {
  const sanitized = expression.replace(/\s+/g, '');
  const allowedPattern = /^[0-9+\-*/().%]+$/;

  if (!sanitized) {
    return { success: true, result: 0 };
  }

  if (!allowedPattern.test(sanitized)) {
    return { success: false, message: 'Invalid characters in expression' };
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${sanitized})`);
    const val = fn();
    
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return { success: false, message: 'Calculation resulted in an invalid number' };
    }
    
    return { success: true, result: Number(val.toFixed(8)) };
  } catch (err) {
    return { success: false, message: 'Invalid mathematical expression' };
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(CALCULATOR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { history: [] };
  } catch (e) {
    return { history: [] };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Ignore storage errors
  }
}

export function createCalculatorToolModal() {
  const state = loadState();

  function sync(root) {
    const memoryEl = root.querySelector('#tool-calculator-memory');
    const historyEl = root.querySelector('#tool-calculator-history');

    if (memoryEl) {
      memoryEl.textContent = state.memory ? `M: ${state.memory}` : 'Memory empty';
    }

    if (historyEl) {
      if (!state.history.length) {
        historyEl.innerHTML = '<div class="text-[8px] font-black text-gray-700 text-center py-4 uppercase tracking-widest">No history</div>';
      } else {
        historyEl.innerHTML = state.history
          .map((item) => `
            <div class="p-1.5 bg-gray-900/50 rounded border border-gray-800 text-[9px] font-bold">
              <div class="text-gray-600 truncate">${item.expression} =</div>
              <div class="text-white text-right font-mono">${item.result}</div>
            </div>
          `)
          .join('');
      }
    }
  }

  function runEvaluation(root) {
    const inputEl = root.querySelector('#tool-calculator-input');
    const resultEl = root.querySelector('#tool-calculator-result');
    if (!inputEl || !resultEl) return;

    const expression = inputEl.value;
    const res = evaluateExpression(expression);

    if (res.success) {
      resultEl.textContent = String(res.result);
      resultEl.classList.remove('text-rose-500');
      resultEl.classList.add('text-white');

      if (expression && expression !== String(res.result)) {
        state.history = [{ expression, result: res.result }, ...state.history].slice(0, 8);
        saveState(state);
        sync(root);
      }
    } else {
      resultEl.textContent = 'Error';
      resultEl.classList.remove('text-white');
      resultEl.classList.add('text-rose-500');
    }
  }

  return {
    id: 'calculator',
    title: 'Calculator',
    subtitle: 'Workspace-grade math utility',
    description: 'Expression input, memory support, and transaction history.',
    badge: 'Math',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="calculator" role="dialog" aria-modal="true" aria-labelledby="tool-calculator-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col">
            <!-- Header (Ultra Thin) -->
            <div class="border-b border-gray-700 px-4 py-1.5 flex justify-between items-center bg-gray-800/50">
              <div class="flex items-center gap-2">
                <span class="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Calc</span>
                <div class="w-px h-3 bg-gray-700"></div>
                <h2 id="tool-calculator-title" class="text-[11px] font-black text-white uppercase tracking-tighter italic">Workspace</h2>
              </div>
              <button type="button" class="text-gray-400 hover:text-white transition p-1" data-close-utility aria-label="Close">✕</button>
            </div>

            <!-- Body -->
            <div class="flex overflow-hidden">
              <!-- Left: Main Calc Area (Extreme Compaction) -->
              <div class="flex-1 flex flex-col p-4 space-y-3 bg-white/[0.02]">
                <!-- Screen (Slimmer) -->
                <div class="bg-black rounded-xl p-4 space-y-1 border border-white/5 shadow-inner shrink-0">
                  <div class="flex justify-between items-center text-[7px] font-black uppercase tracking-widest text-gray-600 px-0.5">
                    <span>Expression</span>
                    <span id="tool-calculator-memory" class="text-indigo-600/80 italic font-black">Memory empty</span>
                  </div>
                  <input id="tool-calculator-input" class="w-full bg-transparent text-gray-400 text-base font-bold outline-none placeholder:text-gray-900" type="text" autocomplete="off" placeholder="(2400*18)/12" />
                  <div id="tool-calculator-result" class="text-3xl font-black text-white text-right font-mono tracking-tighter leading-none">0</div>
                  <div class="flex gap-3 pt-1.5 mt-1 border-t border-white/5">
                    <button type="button" class="text-[7px] font-black uppercase text-gray-600 hover:text-white transition tracking-widest" data-calc-action="copy-result">Copy</button>
                    <button type="button" class="text-[7px] font-black uppercase text-gray-600 hover:text-white transition tracking-widest" data-calc-action="clear-history">Clear</button>
                  </div>
                </div>

                <!-- Keys Grid -->
                <div class="space-y-2">
                   <!-- Memory Row (Tighter) -->
                   <div class="grid grid-cols-5 gap-1.5">
                      ${['MC', 'MR', 'M+', 'M-', '+/-'].map(m => `
                        <button type="button" class="bg-gray-800/40 hover:bg-indigo-600 hover:text-white text-indigo-400 text-[8px] font-black py-1.5 rounded-lg border border-gray-800 transition" data-calc-action="${m === '+/-' ? 'toggle-sign' : 'memory-' + m.toLowerCase().replace('+', 'add').replace('-', 'subtract')}">${m}</button>
                      `).join('')}
                   </div>

                   <!-- Numbers & Ops (Dense Vertical) -->
                   <div class="grid grid-cols-4 gap-1.5">
                      <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg font-black text-[10px] uppercase border border-gray-700/50" data-calc-action="clear">AC</button>
                      <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg font-black text-[10px] uppercase border border-gray-700/50" data-calc-action="backspace">BS</button>
                      <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg font-black text-xs border border-gray-700/50" data-calc-value="(">(</button>
                      <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg font-black text-xs border border-gray-700/50" data-calc-value=")">)</button>
                      
                      ${['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-'].map(k => `
                        <button type="button" class="py-2.5 rounded-lg font-black text-sm transition ${['/', '*', '-'].includes(k) ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm' : 'bg-gray-700 hover:bg-gray-600 text-white'}" data-calc-value="${k}">${k}</button>
                      `).join('')}
                      
                      <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg font-black text-sm col-span-2" data-calc-value="0">0</button>
                      <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg font-black text-sm" data-calc-value=".">.</button>
                      <button type="button" class="bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-black text-sm shadow-sm" data-calc-value="+">+</button>
                      
                      <button type="button" class="bg-gray-800/40 hover:bg-gray-800 text-gray-500 py-2 rounded-lg font-black text-[8px] col-span-2 uppercase tracking-widest" data-calc-value="%">Percent</button>
                      <button type="button" class="bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-black text-lg col-span-2 shadow-lg shadow-emerald-900/20 transition-transform active:scale-95" data-calc-action="equals">=</button>
                   </div>
                </div>
              </div>

              <!-- Right: History (Narrow Strip) -->
              <div class="w-36 border-l border-gray-800 bg-black/20 flex flex-col shrink-0">
                 <div class="px-3 py-2 border-b border-gray-800 text-[8px] font-black text-gray-600 uppercase tracking-widest">History</div>
                 <div id="tool-calculator-history" class="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-none"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const inputEl = root.querySelector('#tool-calculator-input');
      const resultEl = root.querySelector('#tool-calculator-result');

      root.addEventListener('click', async (event) => {
        const valueBtn = event.target.closest('[data-calc-value]');
        if (valueBtn) {
          const val = valueBtn.dataset.calcValue;
          inputEl.value += val;
          inputEl.focus();
          return;
        }

        const actionBtn = event.target.closest('[data-calc-action]');
        if (!actionBtn) return;

        const action = actionBtn.dataset.calcAction;
        switch (action) {
          case 'clear':
            inputEl.value = '';
            resultEl.textContent = '0';
            break;
          case 'backspace':
            inputEl.value = inputEl.value.slice(0, -1);
            break;
          case 'equals':
            runEvaluation(root);
            break;
          case 'copy-result':
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(resultEl.textContent);
            }
            break;
          case 'clear-history':
            state.history = [];
            saveState(state);
            sync(root);
            break;
          case 'memory-clear':
            state.memory = 0;
            saveState(state);
            sync(root);
            break;
          case 'memory-recall':
            inputEl.value += String(state.memory || 0);
            break;
          case 'memory-add':
            runEvaluation(root);
            state.memory = (state.memory || 0) + Number(resultEl.textContent);
            saveState(state);
            sync(root);
            break;
          case 'memory-subtract':
            runEvaluation(root);
            state.memory = (state.memory || 0) - Number(resultEl.textContent);
            saveState(state);
            sync(root);
            break;
          case 'toggle-sign':
            if (inputEl.value.startsWith('-')) {
              inputEl.value = inputEl.value.slice(1);
            } else if (inputEl.value) {
              inputEl.value = `-${inputEl.value}`;
            }
            break;
          default:
            break;
        }
      });

      inputEl?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runEvaluation(root);
        }
      });

      sync(root);
    },
    onOpen(root) {
      sync(root);
      root.querySelector('#tool-calculator-input')?.focus();
    },
  };
}
