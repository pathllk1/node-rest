const NOTEPAD_STORAGE_KEY = 'global-tool-notepad-workspace';

function createNote(title = 'Untitled note') {
  return {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    body: '',
    updatedAt: new Date().toISOString(),
  };
}

function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTEPAD_STORAGE_KEY) || '{}');
    const notes = Array.isArray(saved.notes) && saved.notes.length ? saved.notes : [createNote('Workspace note')];
    const activeNoteId = notes.some((note) => note.id === saved.activeNoteId)
      ? saved.activeNoteId
      : notes[0].id;

    return { notes, activeNoteId, filter: '' };
  } catch {
    const note = createNote('Workspace note');
    return { notes: [note], activeNoteId: note.id, filter: '' };
  }
}

function persistWorkspace(state) {
  localStorage.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify({
    notes: state.notes,
    activeNoteId: state.activeNoteId,
  }));
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function createNotepadToolModal() {
  const state = loadWorkspace();

  function getActiveNote() {
    return state.notes.find((note) => note.id === state.activeNoteId) || state.notes[0];
  }

  function updateStats(root, note) {
    const statsEl = root.querySelector('#tool-notepad-stats');
    if (!statsEl || !note) return;

    const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
    const chars = note.body.length;
    statsEl.textContent = `${words} words  |  ${chars} chars  |  Updated ${formatTimestamp(note.updatedAt)}`;
  }

  function sync(root) {
    const activeNote = getActiveNote();
    const listEl = root.querySelector('#tool-notepad-list');
    const titleEl = root.querySelector('#tool-notepad-title');
    const bodyEl = root.querySelector('#tool-notepad-input');
    const filter = state.filter.trim().toLowerCase();
    const visibleNotes = state.notes.filter((note) => {
      if (!filter) return true;
      return `${note.title} ${note.body}`.toLowerCase().includes(filter);
    });

    if (listEl) {
      listEl.innerHTML = visibleNotes
        .map((note) => `
          <button type="button" class="w-full text-left px-2 py-2 rounded transition ${note.id === activeNote?.id ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-100'}" data-note-id="${note.id}">
            <div class="font-semibold text-sm truncate">${note.title || 'Untitled note'}</div>
            <div class="text-xs opacity-75">${formatTimestamp(note.updatedAt)}</div>
          </button>
        `)
        .join('') || '<div class="text-xs text-gray-400 text-center py-4 px-2">No notes match the current filter.</div>';
    }

    if (titleEl && activeNote) {
      titleEl.value = activeNote.title;
    }

    if (bodyEl && activeNote) {
      bodyEl.value = activeNote.body;
    }

    updateStats(root, activeNote);
    persistWorkspace(state);
  }

  function setActiveNote(noteId, root) {
    if (!state.notes.some((note) => note.id === noteId)) return;
    state.activeNoteId = noteId;
    sync(root);
  }

  function saveActiveNote(root, changes) {
    const activeNote = getActiveNote();
    if (!activeNote) return;

    Object.assign(activeNote, changes, { updatedAt: new Date().toISOString() });
    sync(root);
  }

  function exportActiveNote() {
    const activeNote = getActiveNote();
    if (!activeNote) return;

    const blob = new Blob([activeNote.body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(activeNote.title || 'note').replace(/[^a-z0-9-_]+/gi, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    id: 'notepad',
    title: 'Notepad',
    subtitle: 'Multi-note writing workspace',
    description: 'Autosaved note library with search, rename, duplicate, and export.',
    badge: 'Notes',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="notepad" role="dialog" aria-modal="true" aria-labelledby="tool-notepad-title-main">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-gray-900 border border-gray-700 rounded-[2rem] shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div class="border-b border-gray-700 p-6 flex justify-between items-start bg-gray-800/50">
              <div>
                <p class="text-xs font-black text-indigo-400 uppercase tracking-widest">Notepad</p>
                <h2 id="tool-notepad-title-main" class="text-2xl font-black text-white mt-1 tracking-tighter italic">Note Workspace</h2>
              </div>
              <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white transition" data-close-utility aria-label="Close dialog">✕</button>
            </div>
            <div class="flex-1 overflow-hidden flex">
              <aside class="w-64 border-r border-gray-700 bg-gray-800/30 flex flex-col">
                <div class="p-4 border-b border-gray-700 flex gap-2">
                  <button type="button" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] py-2.5 rounded-xl font-black uppercase tracking-widest transition shadow-lg shadow-indigo-900/20" data-note-action="new">New</button>
                  <button type="button" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-[10px] py-2.5 rounded-xl font-black uppercase tracking-widest transition" data-note-action="duplicate">Dup</button>
                </div>
                <div class="p-4 border-b border-gray-700 bg-gray-900/50">
                  <input id="tool-notepad-filter" class="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all" type="text" placeholder="Search notes..." />
                </div>
                <div id="tool-notepad-list" class="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700"></div>
              </aside>
              <section class="flex-1 bg-gray-900 flex flex-col overflow-hidden relative">
                <div class="border-b border-gray-700 p-4 flex items-center justify-between gap-4 bg-gray-800/20">
                  <input id="tool-notepad-title" class="flex-1 bg-transparent border-none text-white font-black text-lg focus:outline-none placeholder:text-gray-700" type="text" placeholder="Note title" />
                  <div class="flex gap-2">
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest transition border border-gray-700" data-note-action="export">Export</button>
                    <button type="button" class="bg-gray-800 hover:bg-rose-900/30 hover:text-rose-400 text-rose-900 text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest transition border border-gray-700" data-note-action="delete">Delete</button>
                  </div>
                </div>
                <div id="tool-notepad-stats" class="px-6 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-700/50 bg-gray-900"></div>
                <textarea id="tool-notepad-input" class="flex-1 bg-transparent border-0 px-6 py-6 text-gray-300 text-base leading-relaxed focus:outline-none resize-none scrollbar-thin scrollbar-thumb-gray-800" placeholder="Start writing here..."></textarea>
              </section>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const filterEl = root.querySelector('#tool-notepad-filter');
      const titleEl = root.querySelector('#tool-notepad-title');
      const bodyEl = root.querySelector('#tool-notepad-input');

      root.addEventListener('click', (event) => {
        const noteItem = event.target.closest('[data-note-id]');
        if (noteItem) {
          setActiveNote(noteItem.dataset.noteId, root);
          return;
        }

        const actionButton = event.target.closest('[data-note-action]');
        if (!actionButton) return;

        switch (actionButton.dataset.noteAction) {
          case 'new': {
            const note = createNote(`Note ${state.notes.length + 1}`);
            state.notes.unshift(note);
            state.activeNoteId = note.id;
            sync(root);
            break;
          }
          case 'duplicate': {
            const active = getActiveNote();
            if (!active) return;
            const duplicate = createNote(`${active.title} copy`);
            duplicate.body = active.body;
            state.notes.unshift(duplicate);
            state.activeNoteId = duplicate.id;
            sync(root);
            break;
          }
          case 'delete': {
            if (state.notes.length === 1) {
              state.notes = [createNote('Workspace note')];
              state.activeNoteId = state.notes[0].id;
            } else {
              state.notes = state.notes.filter((note) => note.id !== state.activeNoteId);
              state.activeNoteId = state.notes[0].id;
            }
            sync(root);
            break;
          }
          case 'export':
            exportActiveNote();
            break;
          default:
            break;
        }
      });

      filterEl?.addEventListener('input', () => {
        state.filter = filterEl.value;
        sync(root);
      });

      titleEl?.addEventListener('input', () => {
        saveActiveNote(root, { title: titleEl.value || 'Untitled note' });
      });

      bodyEl?.addEventListener('input', () => {
        saveActiveNote(root, { body: bodyEl.value });
      });

      sync(root);
    },
    onOpen(root) {
      sync(root);
      root.querySelector('#tool-notepad-input')?.focus();
    },
  };
}
