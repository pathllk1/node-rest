import { initToolRegistry } from './toolRegistry.js';

const MODAL_ID = 'global-tool-modal';
const SEARCH_INPUT_ID = 'global-tool-modal-search';
const RESULTS_ID = 'global-tool-modal-results';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function matchesTool(tool, query) {
  if (!query) return true;

  const normalizedQuery = query.trim().toLowerCase();
  const haystack = [
    tool.title,
    tool.subtitle,
    tool.description,
    tool.badge,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function buildModalMarkup() {
  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  // Use Tailwind 'hidden' by default on the root element
  modal.className = 'hidden fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] bg-slate-900/60 backdrop-blur-sm';
  modal.setAttribute('aria-hidden', 'true');
  
  modal.innerHTML = `
    <div class="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden transform translate-y-4 scale-95 transition-all duration-300" role="dialog" aria-modal="true" aria-labelledby="tool-modal-title">
      <div class="p-8 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200">
        <div class="flex justify-between items-baseline mb-2">
          <div>
            <p class="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Global Tools</p>
            <h2 id="tool-modal-title" class="text-3xl font-black text-slate-900 tracking-tight">Utility Launcher</h2>
          </div>
          <span class="text-[10px] font-bold px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-500 shadow-sm">Ctrl + .</span>
        </div>
        <p class="text-sm text-slate-600 font-medium mt-1">Access quick utilities from anywhere in the app.</p>
        <input
          id="${SEARCH_INPUT_ID}"
          class="w-full mt-6 px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
          type="text"
          autocomplete="off"
          placeholder="Search tools..."
        />
      </div>
      <div id="${RESULTS_ID}" class="max-h-[500px] overflow-y-auto p-6"></div>
      <div class="px-8 py-4 bg-slate-50 border-t border-slate-200 flex gap-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
        <span>↵ Enter to open</span>
        <span>↑↓ Navigate</span>
        <span>Esc to close</span>
      </div>
    </div>
  `;

  return modal;
}

function isShortcutEvent(event) {
  const hasControlOnly = event.ctrlKey && !event.altKey && !event.metaKey;
  const matchesPeriodKey =
    event.key === '.' ||
    event.key === '>' ||
    event.code === 'Period' ||
    event.code === 'NumpadDecimal';

  return hasControlOnly && matchesPeriodKey;
}

export function initGlobalToolModal() {
  if (window.__globalToolModal?.initialized) {
    return window.__globalToolModal.api;
  }

  const toolRegistry = initToolRegistry();
  const modal = buildModalMarkup();
  const panel = modal.querySelector('[role="dialog"]');
  const searchInput = modal.querySelector(`#${SEARCH_INPUT_ID}`);
  const resultsContainer = modal.querySelector(`#${RESULTS_ID}`);

  let isOpen = false;
  let activeIndex = 0;
  let visibleTools = [];
  let previousActiveElement = null;

  function renderResults() {
    const query = searchInput.value || '';
    visibleTools = toolRegistry.getTools().filter(tool => matchesTool(tool, query));

    if (!visibleTools.length) {
      resultsContainer.innerHTML = '<div class="text-center text-slate-400 py-12 text-sm font-bold uppercase tracking-widest">No matching tools</div>';
      return;
    }

    activeIndex = Math.min(activeIndex, visibleTools.length - 1);

    resultsContainer.innerHTML = `
      <div class="grid grid-cols-2 gap-4">
        ${visibleTools.map((tool, index) => `
          <button
            type="button"
            class="group relative p-5 rounded-2xl border-2 transition-all text-left overflow-hidden ${index === activeIndex ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'}"
            data-tool-index="${index}"
          >
            <!-- Background accent -->
            <div class="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-full -mr-10 -mt-10 transition-all group-hover:scale-150"></div>
            
            <!-- Content -->
            <div class="relative z-10">
              <div class="flex items-start justify-between mb-3">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black uppercase tracking-tighter shadow-sm transition-all ${index === activeIndex ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600'}">
                  ${escapeHtml(tool.badge)}
                </div>
                <div class="text-[10px] font-black uppercase tracking-[0.2em] transition-all opacity-0 ${index === activeIndex ? 'text-white opacity-100' : 'text-indigo-600 group-hover:opacity-100'}">
                  Launch →
                </div>
              </div>
              <h4 class="text-base font-black truncate mb-1 ${index === activeIndex ? 'text-white' : 'text-slate-800'}">${escapeHtml(tool.title)}</h4>
              <p class="text-xs font-bold truncate uppercase tracking-widest ${index === activeIndex ? 'text-indigo-100' : 'text-slate-500'}">${escapeHtml(tool.subtitle)}</p>
              ${tool.description ? `<p class="text-xs mt-2 line-clamp-2 ${index === activeIndex ? 'text-indigo-50' : 'text-slate-600'}">${escapeHtml(tool.description)}</p>` : ''}
            </div>
          </button>
        `).join('')}
      </div>
    `;
  }

  function focusActiveItem() {
    const activeItem = resultsContainer.querySelector(`[data-tool-index="${activeIndex}"]`);
    activeItem?.scrollIntoView({ block: 'nearest' });
  }

  function close() {
    if (!isOpen) return;

    isOpen = false;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    previousActiveElement?.focus?.();
  }

  function open() {
    if (isOpen) return;

    previousActiveElement = document.activeElement;
    isOpen = true;
    activeIndex = 0;
    searchInput.value = '';
    renderResults();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(() => searchInput.focus());
  }

  function toggle() {
    if (isOpen) {
      close();
      return;
    }

    open();
  }

  function runActiveTool() {
    const tool = visibleTools[activeIndex];
    if (!tool) return;

    close();
    toolRegistry.openToolModal(tool.id);
  }

  searchInput.addEventListener('input', () => {
    activeIndex = 0;
    renderResults();
  });

  resultsContainer.addEventListener('mousemove', (event) => {
    const item = event.target.closest('[data-tool-index]');
    if (!item) return;

    const nextIndex = Number(item.dataset.toolIndex);
    if (Number.isNaN(nextIndex) || nextIndex === activeIndex) return;

    activeIndex = nextIndex;
    renderResults();
  });

  resultsContainer.addEventListener('click', (event) => {
    const item = event.target.closest('[data-tool-index]');
    if (!item) return;

    activeIndex = Number(item.dataset.toolIndex);
    runActiveTool();
  });

  modal.addEventListener('click', (event) => {
    if (!panel.contains(event.target)) {
      close();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (isShortcutEvent(event)) {
      event.preventDefault();
      event.stopPropagation();
      toggle();
      return;
    }

    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = visibleTools.length ? (activeIndex + 1) % visibleTools.length : 0;
      renderResults();
      focusActiveItem();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = visibleTools.length
        ? (activeIndex - 1 + visibleTools.length) % visibleTools.length
        : 0;
      renderResults();
      focusActiveItem();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      runActiveTool();
    }
  }, true);

  document.body.appendChild(modal);

  const api = { open, close, toggle };
  window.__globalToolModal = {
    initialized: true,
    api,
  };
  window.openGlobalToolModal = open;
  window.closeGlobalToolModal = close;
  window.toggleGlobalToolModal = toggle;

  return api;
}
