import { createCalendarToolModal } from './calendarToolModal.js';
import { createCalculatorToolModal } from './calculatorToolModal.js';
import { createNotepadToolModal } from './notepadToolModal.js';
import { createStopwatchToolModal } from './stopwatchToolModal.js';
import { createUnitConverterToolModal } from './unitConverterToolModal.js';
import { createTextStudioToolModal } from './textStudioToolModal.js';

const TOOL_DEFINITIONS = [
  createCalendarToolModal(),
  createCalculatorToolModal(),
  createNotepadToolModal(),
  createStopwatchToolModal(),
  createUnitConverterToolModal(),
  createTextStudioToolModal(),
];

let toolRegistryState = null;

function buildUtilityHostMarkup() {
  return `
    <div id="tool-utility-host">
      ${TOOL_DEFINITIONS.map((tool) => tool.render()).join('')}
    </div>
  `;
}

function closeToolModal() {
  if (!toolRegistryState || !toolRegistryState.activeToolId) return;

  const activeModal = toolRegistryState.host.querySelector(
    `[data-tool-modal="${toolRegistryState.activeToolId}"]`
  );

  activeModal?.classList.add('hidden');
  toolRegistryState.activeToolId = null;
}

function openToolModal(toolId) {
  if (!toolRegistryState) return;

  const modal = toolRegistryState.host.querySelector(`[data-tool-modal="${toolId}"]`);
  const tool = toolRegistryState.toolsById.get(toolId);

  if (!modal || !tool) return;

  toolRegistryState.host.querySelectorAll('[data-tool-modal]').forEach((item) => {
    item.classList.add('hidden');
  });

  modal.classList.remove('hidden');
  toolRegistryState.activeToolId = toolId;

  if (typeof tool.onOpen === 'function') {
    tool.onOpen(modal);
  }
}

export function initToolRegistry() {
  if (toolRegistryState) {
    return {
      getTools: () => TOOL_DEFINITIONS.slice(),
      openToolModal,
      closeToolModal,
    };
  }

  const host = document.createElement('div');
  host.innerHTML = buildUtilityHostMarkup();
  document.body.appendChild(host.firstElementChild);

  const hostElement = document.getElementById('tool-utility-host');
  const toolsById = new Map(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));

  TOOL_DEFINITIONS.forEach((tool) => {
    const root = hostElement.querySelector(`[data-tool-modal="${tool.id}"]`);
    if (root && typeof tool.init === 'function') {
      tool.init(root);
    }
  });

  toolRegistryState = {
    host: hostElement,
    activeToolId: null,
    toolsById,
  };

  hostElement.addEventListener('click', (event) => {
    const dismissModal = event.target.closest('[data-dismiss-modal]');
    const closeButton = event.target.closest('[data-close-utility]');
    
    if (dismissModal || closeButton) {
      closeToolModal();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toolRegistryState?.activeToolId) {
      event.preventDefault();
      closeToolModal();
    }
  });

  return {
    getTools: () => TOOL_DEFINITIONS.slice(),
    openToolModal,
    closeToolModal,
  };
}
