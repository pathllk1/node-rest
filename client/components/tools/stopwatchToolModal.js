function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const centiseconds = String(Math.floor((milliseconds % 1000) / 10)).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}.${centiseconds}`;
}

export function createStopwatchToolModal() {
  const state = {
    mode: 'stopwatch',
    running: false,
    startedAt: null,
    elapsed: 0,
    timerDuration: 5 * 60 * 1000,
    timerRemaining: 5 * 60 * 1000,
    intervalId: null,
    laps: [],
  };

  function clearTicker() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  function currentValue() {
    if (!state.running || !state.startedAt) {
      return state.mode === 'stopwatch' ? state.elapsed : state.timerRemaining;
    }

    if (state.mode === 'stopwatch') {
      return state.elapsed + (Date.now() - state.startedAt);
    }

    return Math.max(0, state.timerRemaining - (Date.now() - state.startedAt));
  }

  function sync(root) {
    const displayEl = root.querySelector('#tool-stopwatch-display');
    const modeEl = root.querySelector('#tool-stopwatch-mode');
    const lapsEl = root.querySelector('#tool-stopwatch-laps');
    const timerInputEl = root.querySelector('#tool-stopwatch-timer-input');
    const label = state.mode === 'stopwatch' ? 'Stopwatch' : 'Countdown timer';

    if (displayEl) {
      displayEl.textContent = formatDuration(currentValue());
    }

    if (modeEl) {
      modeEl.textContent = label;
    }

    if (timerInputEl) {
      timerInputEl.value = String(Math.max(1, Math.round(state.timerDuration / 60000)));
    }

    if (lapsEl) {
      if (!state.laps.length) {
        lapsEl.innerHTML = '<div class="text-[9px] font-black text-gray-500 text-center py-4 uppercase tracking-widest">No laps recorded</div>';
      } else {
        lapsEl.innerHTML = state.laps
          .map((lap, index) => `
            <div class="flex justify-between items-center p-3 bg-gray-800/30 rounded-xl border border-gray-800">
              <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Lap ${state.laps.length - index}</span>
              <span class="font-mono font-black text-white text-sm tracking-tighter">${formatDuration(lap)}</span>
            </div>
          `)
          .join('');
      }
    }
  }

  function tick(root) {
    sync(root);

    if (state.mode === 'timer' && currentValue() <= 0) {
      state.running = false;
      state.startedAt = null;
      state.timerRemaining = 0;
      clearTicker();
      sync(root);
    }
  }

  function start(root) {
    if (state.running) return;
    state.running = true;
    state.startedAt = Date.now();
    clearTicker();
    state.intervalId = setInterval(() => tick(root), 50);
    sync(root);
  }

  function pause(root) {
    if (!state.running) return;

    if (state.mode === 'stopwatch') {
      state.elapsed = currentValue();
    } else {
      state.timerRemaining = currentValue();
    }

    state.running = false;
    state.startedAt = null;
    clearTicker();
    sync(root);
  }

  function reset(root) {
    state.running = false;
    state.startedAt = null;
    state.elapsed = 0;
    state.timerRemaining = state.timerDuration;
    state.laps = [];
    clearTicker();
    sync(root);
  }

  function setMode(root, mode) {
    pause(root);
    state.mode = mode;
    reset(root);
  }

  return {
    id: 'stopwatch',
    title: 'Stopwatch',
    subtitle: 'Timer and lap tracking',
    description: 'Switch between stopwatch and countdown timer with lap history.',
    badge: 'Time',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="stopwatch" role="dialog" aria-modal="true" aria-labelledby="tool-stopwatch-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-gray-900 border border-gray-700 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col">
            <div class="border-b border-gray-700 p-6 flex justify-between items-start bg-gray-800/50">
              <div>
                <p class="text-xs font-black text-indigo-400 uppercase tracking-widest">Stopwatch</p>
                <h2 id="tool-stopwatch-title" class="text-2xl font-black text-white mt-1 tracking-tighter italic">Precision Timer</h2>
              </div>
              <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white transition" data-close-utility aria-label="Close dialog">✕</button>
            </div>
            <div class="p-8 space-y-8 bg-gray-900">
              <div class="flex justify-between items-center bg-gray-800/50 p-2 rounded-2xl border border-gray-800 shadow-inner">
                <div id="tool-stopwatch-mode" class="text-[10px] font-black text-white uppercase tracking-widest ml-4">Stopwatch</div>
                <div class="flex gap-2">
                  <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white text-[9px] px-3 py-1.5 rounded-lg font-black uppercase transition border border-transparent has-[:checked]:border-indigo-500" data-stopwatch-mode="stopwatch">Stopwatch</button>
                  <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white text-[9px] px-3 py-1.5 rounded-lg font-black uppercase transition border border-transparent has-[:checked]:border-indigo-500" data-stopwatch-mode="timer">Timer</button>
                </div>
              </div>

              <div id="tool-stopwatch-display" class="text-6xl font-black text-white text-center py-12 font-mono tracking-tighter tabular-nums bg-black/40 rounded-[2.5rem] border border-white/5 shadow-inner">00:00:00.00</div>

              <div class="grid grid-cols-2 gap-4">
                <button type="button" class="bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-emerald-900/20" data-stopwatch-action="start">Start</button>
                <button type="button" class="bg-amber-600 hover:bg-amber-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-amber-900/20" data-stopwatch-action="pause">Pause</button>
                <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition" data-stopwatch-action="lap">Lap</button>
                <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition border border-gray-700 shadow-sm" data-stopwatch-action="reset">Reset</button>
              </div>

              <div class="flex items-center gap-4 bg-gray-800/30 p-5 rounded-2xl border border-gray-800">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest shrink-0" for="tool-stopwatch-timer-input">Target Min</label>
                <input id="tool-stopwatch-timer-input" class="w-full bg-gray-800 border-none rounded-xl px-4 py-2 text-sm text-white font-black focus:ring-1 focus:ring-indigo-500/30 transition-all text-center" type="number" min="1" step="1" value="5" />
              </div>

              <div id="tool-stopwatch-laps" class="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-800"></div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const timerInputEl = root.querySelector('#tool-stopwatch-timer-input');

      root.addEventListener('click', (event) => {
        const modeButton = event.target.closest('[data-stopwatch-mode]');
        if (modeButton) {
          setMode(root, modeButton.dataset.stopwatchMode);
          return;
        }

        const actionButton = event.target.closest('[data-stopwatch-action]');
        if (!actionButton) return;

        switch (actionButton.dataset.stopwatchAction) {
          case 'start':
            start(root);
            break;
          case 'pause':
            pause(root);
            break;
          case 'lap':
            if (state.mode === 'stopwatch') {
              state.laps = [currentValue(), ...state.laps].slice(0, 12);
              sync(root);
            }
            break;
          case 'reset':
            reset(root);
            break;
          default:
            break;
        }
      });

      timerInputEl?.addEventListener('input', () => {
        const minutes = Math.max(1, Number(timerInputEl.value || 1));
        state.timerDuration = minutes * 60 * 1000;
        if (!state.running && state.mode === 'timer') {
          state.timerRemaining = state.timerDuration;
          sync(root);
        }
      });

      sync(root);
    },
    onOpen(root) {
      sync(root);
    },
  };
}
