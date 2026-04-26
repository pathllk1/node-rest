const TEXT_STUDIO_STORAGE_KEY = 'enterprise-notepad-docs';

const DEFAULT_DOC_HTML = `
  <h1 class="mb-4 text-3xl font-bold text-slate-900">Enterprise Notepad Pro</h1>
  <p class="mb-3 text-sm leading-7 text-slate-700">Begin your documentation here.</p>
  <p class="text-sm leading-7 text-slate-700">Use the toolbar to format text, insert links, tables, images, and code blocks, then save documents in the directory panel.</p>
`;

const EDITOR_CONTENT_CLASSES = [
  'prose',
  'prose-slate',
  'max-w-none',
  'h-full',
  'min-h-full',
  'p-6',
  'sm:p-8',
  'outline-none',
  'overflow-y-auto',
  'text-sm',
  'leading-7',
  'text-slate-800',
  '[&_a]:text-sky-600',
  '[&_a]:underline',
  '[&_blockquote]:my-4',
  '[&_blockquote]:border-l-4',
  '[&_blockquote]:border-sky-500',
  '[&_blockquote]:pl-4',
  '[&_blockquote]:italic',
  '[&_code]:rounded',
  '[&_code]:bg-slate-100',
  '[&_code]:px-1.5',
  '[&_code]:py-0.5',
  '[&_code]:font-mono',
  '[&_code]:text-[13px]',
  '[&_code]:text-rose-600',
  '[&_pre]:my-4',
  '[&_pre]:overflow-x-auto',
  '[&_pre]:rounded-xl',
  '[&_pre]:bg-slate-900',
  '[&_pre]:p-4',
  '[&_pre]:font-mono',
  '[&_pre]:text-[13px]',
  '[&_pre]:leading-6',
  '[&_pre]:text-slate-100',
  '[&_pre_code]:bg-transparent',
  '[&_pre_code]:p-0',
  '[&_pre_code]:text-slate-100',
  '[&_table]:my-4',
  '[&_table]:w-full',
  '[&_table]:border-collapse',
  '[&_th]:border',
  '[&_th]:border-slate-300',
  '[&_th]:bg-slate-100',
  '[&_th]:px-3',
  '[&_th]:py-2',
  '[&_th]:text-left',
  '[&_td]:border',
  '[&_td]:border-slate-300',
  '[&_td]:px-3',
  '[&_td]:py-2',
  '[&_img]:max-w-full',
  '[&_img]:rounded-lg',
].join(' ');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFilename(value = 'document') {
  return String(value).trim().replace(/[^a-z0-9-_]+/gi, '_') || 'document';
}

function createDocument(title = `Document ${new Date().toLocaleString()}`) {
  return {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    content: DEFAULT_DOC_HTML.trim(),
    modified: new Date().toISOString(),
  };
}

function loadDocuments() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEXT_STUDIO_STORAGE_KEY) || '{}');
    const docs = Array.isArray(parsed.docs) ? parsed.docs : [];
    const activeDocId = parsed.activeDocId;
    if (!docs.length) {
      const initial = createDocument('Workspace Document');
      return { docs: [initial], activeDocId: initial.id };
    }

    const safeActiveDocId = docs.some((doc) => doc.id === activeDocId) ? activeDocId : docs[0].id;
    return { docs, activeDocId: safeActiveDocId };
  } catch {
    const initial = createDocument('Workspace Document');
    return { docs: [initial], activeDocId: initial.id };
  }
}

function saveDocuments(state) {
  localStorage.setItem(TEXT_STUDIO_STORAGE_KEY, JSON.stringify({
    docs: state.docs,
    activeDocId: state.activeDocId,
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripInlineStyles(html) {
  return html.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
}

export function createTextStudioToolModal() {
  const state = loadDocuments();
  let autoSaveTimer = null;
  let savedRange = null;
  let isSyncingEditor = false;

  function getActiveDoc() {
    return state.docs.find((doc) => doc.id === state.activeDocId) || state.docs[0] || null;
  }

  function saveSelection(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    savedRange = range.cloneRange();
  }

  function restoreSelection(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    if (!editor || !savedRange) return false;

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  }

  function focusEditor(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    if (!editor) return null;
    editor.focus();
    restoreSelection(root);
    return editor;
  }

  function setStatus(root, tone, label) {
    const statuses = root.querySelectorAll('[data-save-status]');
    if (!statuses.length) return;

    const toneMap = {
      saved: 'bg-emerald-500 text-emerald-600',
      saving: 'bg-amber-500 text-amber-600',
      editing: 'bg-sky-500 text-sky-600',
    };
    const classes = toneMap[tone] || toneMap.saved;

    statuses.forEach((status) => {
      status.className = `inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] ${classes.split(' ')[1]}`;
      status.innerHTML = `<span class="h-2 w-2 rounded-full ${classes.split(' ')[0]}"></span>${escapeHtml(label)}`;
    });
  }

  function updateCounts(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    if (!editor) return;

    const text = editor.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const lines = text ? text.split(/\n/).length : 1;

    root.querySelector('[data-count="words"]').textContent = String(words);
    root.querySelector('[data-count="chars"]').textContent = String(chars);
    root.querySelector('[data-count="lines"]').textContent = String(lines);
  }

  function syncEditorFromState(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    const title = root.querySelector('[data-doc-title]');
    const activeDoc = getActiveDoc();
    if (!editor || !title || !activeDoc) return;

    isSyncingEditor = true;
    title.value = activeDoc.title;
    editor.innerHTML = stripInlineStyles(activeDoc.content || DEFAULT_DOC_HTML.trim());
    isSyncingEditor = false;
    updateCounts(root);
  }

  function renderDocList(root) {
    const list = root.querySelector('[data-doc-list]');
    if (!list) return;

    list.innerHTML = state.docs.map((doc) => `
      <div class="group rounded-2xl border transition ${doc.id === state.activeDocId ? 'border-sky-600 bg-sky-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'}">
        <button type="button" class="flex w-full items-start gap-3 px-3 py-3 text-left" data-doc-id="${escapeHtml(doc.id)}">
          <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${doc.id === state.activeDocId ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}">Tx</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold">${escapeHtml(doc.title || 'Untitled')}</span>
            <span class="block truncate text-[11px] ${doc.id === state.activeDocId ? 'text-sky-100' : 'text-slate-400'}">${escapeHtml(formatTimestamp(doc.modified))}</span>
          </span>
        </button>
        <div class="flex items-center justify-end gap-2 px-3 pb-3">
          <button type="button" class="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${doc.id === state.activeDocId ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" data-doc-action="duplicate" data-doc-id="${escapeHtml(doc.id)}">Copy</button>
          <button type="button" class="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${doc.id === state.activeDocId ? 'bg-rose-500/20 text-white hover:bg-rose-500/30' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}" data-doc-action="delete" data-doc-id="${escapeHtml(doc.id)}">Delete</button>
        </div>
      </div>
    `).join('');
  }

  function sync(root) {
    syncEditorFromState(root);
    renderDocList(root);
    saveDocuments(state);
    setStatus(root, 'saved', 'Saved');
  }

  function queueSave(root, label = 'Saving') {
    setStatus(root, 'saving', label);
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const activeDoc = getActiveDoc();
      const editor = root.querySelector('[data-text-studio-editor]');
      const title = root.querySelector('[data-doc-title]');
      if (!activeDoc || !editor || !title) return;

      activeDoc.title = title.value.trim() || 'Untitled document';
      activeDoc.content = editor.innerHTML;
      activeDoc.modified = new Date().toISOString();
      renderDocList(root);
      saveDocuments(state);
      setStatus(root, 'saved', 'Saved');
    }, 300);
  }

  function openPanel(root, name) {
    root.querySelectorAll('[data-panel]').forEach((panel) => {
      if (panel.dataset.panel === name) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });
  }

  function closePanels(root) {
    root.querySelectorAll('[data-panel]').forEach((panel) => panel.classList.add('hidden'));
  }

  function exec(root, command, value = null) {
    focusEditor(root);
    document.execCommand(command, false, value);
    saveSelection(root);
    updateCounts(root);
    queueSave(root);
  }

  function insertHtml(root, html) {
    focusEditor(root);
    document.execCommand('insertHTML', false, html);
    saveSelection(root);
    updateCounts(root);
    queueSave(root);
  }

  function insertInlineCode(root) {
    const editor = focusEditor(root);
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      insertHtml(root, '<code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-rose-600">code</code>');
      return;
    }

    const fragmentText = escapeHtml(range.toString());
    insertHtml(root, `<code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-rose-600">${fragmentText}</code>`);
  }

  function createNewDoc(root) {
    const doc = createDocument(`Document ${state.docs.length + 1}`);
    state.docs.unshift(doc);
    state.activeDocId = doc.id;
    sync(root);
    focusEditor(root);
  }

  function duplicateDoc(root, docId) {
    const source = state.docs.find((doc) => doc.id === docId);
    if (!source) return;

    const duplicate = {
      ...source,
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `${source.title} copy`,
      modified: new Date().toISOString(),
    };
    state.docs.unshift(duplicate);
    state.activeDocId = duplicate.id;
    sync(root);
  }

  function deleteDoc(root, docId) {
    if (state.docs.length === 1) {
      state.docs = [createDocument('Workspace Document')];
      state.activeDocId = state.docs[0].id;
      sync(root);
      return;
    }

    state.docs = state.docs.filter((doc) => doc.id !== docId);
    if (!state.docs.some((doc) => doc.id === state.activeDocId)) {
      state.activeDocId = state.docs[0].id;
    }
    sync(root);
  }

  function exportDoc(root, format) {
    const activeDoc = getActiveDoc();
    const editor = root.querySelector('[data-text-studio-editor]');
    if (!activeDoc || !editor) return;

    const content = format === 'html' ? editor.innerHTML : editor.innerText;
    const mime = format === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(activeDoc.title)}.${format === 'html' ? 'html' : 'txt'}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printDoc(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    if (!editor) return;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print</title>
          <link rel="stylesheet" href="/css/output.css" />
        </head>
        <body class="bg-white p-8 text-slate-900">
          <div class="${EDITOR_CONTENT_CLASSES}">${editor.innerHTML}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function findNext(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    const input = root.querySelector('[data-find-input]');
    if (!editor || !input) return;

    const term = input.value.trim();
    if (!term) return;

    focusEditor(root);
    const found = window.find(term, false, false, true, false, false, false);
    if (!found) {
      window.getSelection()?.removeAllRanges();
      window.find(term, false, false, true, false, false, false);
    }
    saveSelection(root);
  }

  function replaceCurrent(root) {
    const findInput = root.querySelector('[data-find-input]');
    const replaceInput = root.querySelector('[data-replace-input]');
    if (!findInput || !replaceInput) return;

    const selected = window.getSelection()?.toString() || '';
    if (selected.toLowerCase() === findInput.value.trim().toLowerCase()) {
      document.execCommand('insertText', false, replaceInput.value);
      queueSave(root);
      updateCounts(root);
    } else {
      findNext(root);
    }
  }

  function replaceAll(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    const findInput = root.querySelector('[data-find-input]');
    const replaceInput = root.querySelector('[data-replace-input]');
    if (!editor || !findInput || !replaceInput) return;

    const term = findInput.value.trim();
    if (!term) return;

    const regex = new RegExp(escapeRegExp(term), 'gi');
    editor.innerHTML = editor.innerHTML.replace(regex, escapeHtml(replaceInput.value));
    saveSelection(root);
    updateCounts(root);
    queueSave(root);
  }

  function insertTable(root) {
    const rows = Number(root.querySelector('[data-table-rows]')?.value || 3);
    const cols = Number(root.querySelector('[data-table-cols]')?.value || 3);
    if (rows < 1 || cols < 1) return;

    let html = '<table class="my-4 w-full border-collapse text-sm"><thead><tr>';
    for (let col = 0; col < cols; col += 1) {
      html += `<th class="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold">Header ${col + 1}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let row = 0; row < rows; row += 1) {
      html += '<tr>';
      for (let col = 0; col < cols; col += 1) {
        html += '<td class="border border-slate-300 px-3 py-2">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p></p>';
    insertHtml(root, html);
    closePanels(root);
  }

  function insertLink(root) {
    const text = root.querySelector('[data-link-text]')?.value?.trim();
    const href = root.querySelector('[data-link-url]')?.value?.trim();
    if (!href) return;

    const label = text || href;
    insertHtml(
      root,
      `<a class="text-sky-600 underline" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
    );
    closePanels(root);
  }

  function insertImage(root) {
    const src = root.querySelector('[data-image-url]')?.value?.trim();
    const alt = root.querySelector('[data-image-alt]')?.value?.trim() || 'Inserted image';
    if (!src) return;

    insertHtml(
      root,
      `<img class="my-4 max-w-full rounded-lg border border-slate-200" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`,
    );
    closePanels(root);
  }

  function insertCodeBlock(root) {
    const language = root.querySelector('[data-code-language]')?.value?.trim() || 'text';
    const code = root.querySelector('[data-code-content]')?.value || '';
    if (!code.trim()) return;

    insertHtml(
      root,
      `<pre class="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-[13px] leading-6 text-slate-100" data-lang="${escapeHtml(language)}"><code class="bg-transparent p-0 text-slate-100">${escapeHtml(code)}</code></pre><p></p>`,
    );
    closePanels(root);
  }

  function applySpanClass(root, cls) {
    const editor = focusEditor(root);
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const tmp = document.createElement('div');
    tmp.appendChild(range.cloneContents());
    insertHtml(root, `<span class="${cls}">${tmp.innerHTML}</span>`);
  }

  function applyAlignment(root, cls) {
    const editor = root.querySelector('[data-text-studio-editor]');
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV', 'PRE']);
    while (node && node !== editor && !blockTags.has(node.nodeName)) {
      node = node.parentElement;
    }

    if (!node || node === editor) return;

    node.classList.remove('text-left', 'text-center', 'text-right', 'text-justify');
    if (cls) node.classList.add(cls);

    const activeDoc = getActiveDoc();
    if (activeDoc) {
      activeDoc.content = editor.innerHTML;
      activeDoc.modified = new Date().toISOString();
    }
    saveSelection(root);
    queueSave(root);
  }

  function applyFontName(root, fontName) {
    const editor = focusEditor(root);
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      // No selection — execCommand only sets pending internal state, no DOM write, no CSP risk
      document.execCommand('fontName', false, fontName);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const tmp = document.createElement('div');
    tmp.appendChild(range.cloneContents());
    insertHtml(root, `<font face="${escapeHtml(fontName)}">${tmp.innerHTML}</font>`);
  }

  function getBlockNode(root) {
    const editor = root.querySelector('[data-text-studio-editor]');
    if (!editor) return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV', 'PRE']);
    while (node && node !== editor && !blockTags.has(node.nodeName)) {
      node = node.parentElement;
    }

    return node && node !== editor ? node : null;
  }

  const INDENT_CLASSES = ['pl-8', 'pl-16', 'pl-24', 'pl-32'];

  function applyIndent(root) {
    const node = getBlockNode(root);
    if (!node) return;

    const level = Math.min(4, Number(node.dataset.indent || 0) + 1);
    node.dataset.indent = String(level);
    node.classList.remove(...INDENT_CLASSES);
    node.classList.add(INDENT_CLASSES[level - 1]);

    const activeDoc = getActiveDoc();
    if (activeDoc) { activeDoc.content = root.querySelector('[data-text-studio-editor]').innerHTML; activeDoc.modified = new Date().toISOString(); }
    saveSelection(root);
    queueSave(root);
  }

  function applyOutdent(root) {
    const node = getBlockNode(root);
    if (!node) return;

    const level = Math.max(0, Number(node.dataset.indent || 0) - 1);
    node.dataset.indent = String(level);
    node.classList.remove(...INDENT_CLASSES);
    if (level > 0) node.classList.add(INDENT_CLASSES[level - 1]);

    const activeDoc = getActiveDoc();
    if (activeDoc) { activeDoc.content = root.querySelector('[data-text-studio-editor]').innerHTML; activeDoc.modified = new Date().toISOString(); }
    saveSelection(root);
    queueSave(root);
  }

  function handleCommand(root, command) {
    switch (command) {
      case 'new':
        createNewDoc(root);
        break;
      case 'save':
        queueSave(root, 'Saving');
        break;
      case 'undo':
      case 'redo':
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikeThrough':
      case 'subscript':
      case 'superscript':
      case 'insertUnorderedList':
      case 'insertOrderedList':
      case 'removeFormat':
      case 'selectAll':
      case 'insertHorizontalRule':
        exec(root, command);
        break;
      case 'indent':
        applyIndent(root);
        break;
      case 'outdent':
        applyOutdent(root);
        break;
      case 'justifyLeft':
        applyAlignment(root, 'text-left');
        break;
      case 'justifyCenter':
        applyAlignment(root, 'text-center');
        break;
      case 'justifyRight':
        applyAlignment(root, 'text-right');
        break;
      case 'justifyFull':
        applyAlignment(root, 'text-justify');
        break;
      case 'color-default':
        applySpanClass(root, 'text-slate-900');
        break;
      case 'color-rose':
        applySpanClass(root, 'text-rose-600');
        break;
      case 'color-sky':
        applySpanClass(root, 'text-sky-600');
        break;
      case 'color-emerald':
        applySpanClass(root, 'text-emerald-600');
        break;
      case 'color-amber':
        applySpanClass(root, 'text-amber-500');
        break;
      case 'color-purple':
        applySpanClass(root, 'text-purple-600');
        break;
      case 'highlight-yellow':
        applySpanClass(root, 'bg-yellow-200');
        break;
      case 'highlight-green':
        applySpanClass(root, 'bg-emerald-200');
        break;
      case 'highlight-blue':
        applySpanClass(root, 'bg-sky-200');
        break;
      case 'highlight-pink':
        applySpanClass(root, 'bg-pink-200');
        break;
      case 'insert-date':
        exec(root, 'insertText', new Date().toLocaleString());
        break;
      case 'inline-code':
        insertInlineCode(root);
        break;
      case 'export-txt':
        exportDoc(root, 'txt');
        break;
      case 'export-html':
        exportDoc(root, 'html');
        break;
      case 'print':
        printDoc(root);
        break;
      case 'show-find':
        openPanel(root, 'find');
        break;
      case 'show-table':
        openPanel(root, 'table');
        break;
      case 'show-link':
        openPanel(root, 'link');
        break;
      case 'show-image':
        openPanel(root, 'image');
        break;
      case 'show-code':
        openPanel(root, 'code');
        break;
      default:
        break;
    }
  }

  return {
    id: 'text-studio',
    title: 'Enterprise Notepad Pro',
    subtitle: 'Professional rich text workspace',
    description: 'Rich text editor with autosave, code blocks, links, tables, and multi-document management.',
    badge: 'Write',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" data-tool-modal="text-studio" role="dialog" aria-modal="true" aria-labelledby="tool-text-studio-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div class="flex items-center gap-5 border-b border-slate-200 bg-slate-900 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300">
              <button type="button" class="relative rounded-lg px-2 py-1 text-left transition hover:bg-white/10 hover:text-white" data-editor-cmd="new">File</button>
              <button type="button" class="relative rounded-lg px-2 py-1 text-left transition hover:bg-white/10 hover:text-white" data-editor-cmd="show-find">Edit</button>
              <button type="button" class="relative rounded-lg px-2 py-1 text-left transition hover:bg-white/10 hover:text-white" data-editor-cmd="show-table">Insert</button>
              <span class="ml-auto text-sky-400">Text Studio</span>
              <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white" data-close-utility aria-label="Close dialog">X</button>
            </div>

            <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div class="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="new">New</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="save">Save</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="print">Print</button>
              </div>

              <div class="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="undo">Undo</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="redo">Redo</button>
              </div>

              <div class="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                <select data-editor-select="fontName" class="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none">
                  <optgroup label="Sans-serif">
                    <option value="Arial">Arial</option>
                    <option value="Arial Black">Arial Black</option>
                    <option value="Calibri">Calibri</option>
                    <option value="Candara">Candara</option>
                    <option value="Century Gothic">Century Gothic</option>
                    <option value="Franklin Gothic Medium">Franklin Gothic</option>
                    <option value="Gill Sans">Gill Sans</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Impact">Impact</option>
                    <option value="Segoe UI" selected>Segoe UI</option>
                    <option value="Tahoma">Tahoma</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                    <option value="Verdana">Verdana</option>
                  </optgroup>
                  <optgroup label="Serif">
                    <option value="Book Antiqua">Book Antiqua</option>
                    <option value="Cambria">Cambria</option>
                    <option value="Constantia">Constantia</option>
                    <option value="Garamond">Garamond</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Palatino Linotype">Palatino</option>
                    <option value="Times New Roman">Times New Roman</option>
                  </optgroup>
                  <optgroup label="Monospace">
                    <option value="Consolas">Consolas</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Lucida Console">Lucida Console</option>
                    <option value="Monaco">Monaco</option>
                    <option value="Roboto Mono">Roboto Mono</option>
                  </optgroup>
                </select>
                <select data-editor-select="fontSize" class="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none">
                  <option value="2">10pt</option>
                  <option value="3" selected>12pt</option>
                  <option value="4">14pt</option>
                  <option value="5">18pt</option>
                  <option value="6">24pt</option>
                </select>
                <select data-editor-select="formatBlock" class="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none">
                  <option value="p">Normal</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                  <option value="blockquote">Quote</option>
                </select>
              </div>

              <div class="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="bold">B</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold italic text-slate-700 transition hover:bg-slate-100" data-editor-cmd="italic">I</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold underline text-slate-700 transition hover:bg-slate-100" data-editor-cmd="underline">U</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold line-through text-slate-700 transition hover:bg-slate-100" data-editor-cmd="strikeThrough">S</button>
                <button type="button" class="rounded-xl px-3 py-2 font-mono text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="inline-code">&lt;/&gt;</button>
              </div>

              <div class="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-1.5">
                <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">A</span>
                <button type="button" class="h-5 w-5 rounded-full bg-slate-900 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="color-default" title="Black"></button>
                <button type="button" class="h-5 w-5 rounded-full bg-rose-600 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="color-rose" title="Red"></button>
                <button type="button" class="h-5 w-5 rounded-full bg-sky-600 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="color-sky" title="Blue"></button>
                <button type="button" class="h-5 w-5 rounded-full bg-emerald-600 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="color-emerald" title="Green"></button>
                <button type="button" class="h-5 w-5 rounded-full bg-amber-500 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="color-amber" title="Amber"></button>
                <button type="button" class="h-5 w-5 rounded-full bg-purple-600 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="color-purple" title="Purple"></button>
                <span class="mx-0.5 h-4 w-px bg-slate-200"></span>
                <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">H</span>
                <button type="button" class="h-5 w-5 rounded-full bg-yellow-300 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="highlight-yellow" title="Yellow highlight"></button>
                <button type="button" class="h-5 w-5 rounded-full bg-emerald-200 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="highlight-green" title="Green highlight"></button>
                <button type="button" class="h-5 w-5 rounded-full bg-sky-200 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="highlight-blue" title="Blue highlight"></button>
                <button type="button" class="h-5 w-5 rounded-full bg-pink-200 ring-1 ring-offset-1 ring-transparent transition hover:ring-slate-400" data-editor-cmd="highlight-pink" title="Pink highlight"></button>
                <span class="mx-0.5 h-4 w-px bg-slate-200"></span>
                <button type="button" class="rounded-xl px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="removeFormat">Clear</button>
              </div>

              <div class="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="justifyLeft">Left</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="justifyCenter">Center</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="justifyRight">Right</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="justifyFull">Justify</button>
              </div>

              <div class="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="insertUnorderedList">Bullets</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="insertOrderedList">Numbered</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="indent">Indent</button>
              </div>

              <div class="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="show-link">Link</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="show-image">Image</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="show-table">Table</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="show-code">Code</button>
                <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" data-editor-cmd="insert-date">Date</button>
              </div>
            </div>

            <div class="relative flex min-h-0 flex-1 overflow-hidden bg-slate-100">
              <div class="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
                <div class="flex items-center gap-3 rounded-t-[1.5rem] border border-b-0 border-slate-200 bg-white px-5 py-4">
                  <input type="text" data-doc-title class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" placeholder="Document title" />
                  <div class="hidden sm:block">
                    <span data-save-status class="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                      <span class="h-2 w-2 rounded-full bg-emerald-500"></span>Saved
                    </span>
                  </div>
                </div>
                <div class="min-h-0 flex-1 rounded-b-[1.5rem] border border-slate-200 bg-white shadow-sm">
                  <div data-text-studio-editor class="${EDITOR_CONTENT_CLASSES}" contenteditable="true" spellcheck="true">${DEFAULT_DOC_HTML.trim()}</div>
                </div>
              </div>

              <aside class="hidden w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50 md:flex">
                <div class="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                  <div>
                    <p class="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Directory</p>
                    <h3 class="mt-1 text-sm font-bold text-slate-900">Documents</h3>
                  </div>
                  <button type="button" class="rounded-xl bg-sky-600 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-sky-500" data-editor-cmd="new">New</button>
                </div>
                <div class="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                  <button type="button" class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-slate-100" data-editor-cmd="export-txt">TXT</button>
                  <button type="button" class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-slate-100" data-editor-cmd="export-html">HTML</button>
                </div>
                <div data-doc-list class="flex-1 space-y-3 overflow-y-auto p-3"></div>
              </aside>

              <div class="pointer-events-none absolute inset-0">
                <div data-panel="find" class="pointer-events-auto absolute inset-0 hidden flex items-center justify-center bg-slate-950/20 p-6 backdrop-blur-sm">
                  <div class="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl">
                    <h4 class="text-sm font-bold text-slate-900">Find and Replace</h4>
                    <p class="mt-1 text-xs text-slate-500">Search within the active document and replace selected matches or all matches.</p>
                    <div class="mt-5 space-y-3">
                      <input type="text" data-find-input class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" placeholder="Find text" />
                      <input type="text" data-replace-input class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" placeholder="Replace with" />
                    </div>
                    <div class="mt-5 flex flex-wrap gap-2">
                      <button type="button" class="rounded-xl bg-slate-900 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white" data-find-action="find">Find</button>
                      <button type="button" class="rounded-xl bg-sky-600 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white" data-find-action="replace">Replace</button>
                      <button type="button" class="rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white" data-find-action="replace-all">Replace All</button>
                      <button type="button" class="ml-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500" data-panel-close>Close</button>
                    </div>
                  </div>
                </div>

                <div data-panel="table" class="pointer-events-auto absolute inset-0 hidden flex items-center justify-center bg-slate-950/20 p-6 backdrop-blur-sm">
                  <div class="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl">
                    <h4 class="text-sm font-bold text-slate-900">Insert Table</h4>
                    <div class="mt-5 grid grid-cols-2 gap-3">
                      <label class="space-y-2 text-xs font-semibold text-slate-500">
                        <span>Rows</span>
                        <input type="number" min="1" max="20" value="3" data-table-rows class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" />
                      </label>
                      <label class="space-y-2 text-xs font-semibold text-slate-500">
                        <span>Columns</span>
                        <input type="number" min="1" max="10" value="3" data-table-cols class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" />
                      </label>
                    </div>
                    <div class="mt-5 flex items-center gap-2">
                      <button type="button" class="rounded-xl bg-slate-900 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white" data-table-action="insert">Insert</button>
                      <button type="button" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500" data-panel-close>Close</button>
                    </div>
                  </div>
                </div>

                <div data-panel="link" class="pointer-events-auto absolute inset-0 hidden flex items-center justify-center bg-slate-950/20 p-6 backdrop-blur-sm">
                  <div class="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl">
                    <h4 class="text-sm font-bold text-slate-900">Insert Link</h4>
                    <div class="mt-5 space-y-3">
                      <input type="text" data-link-text class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" placeholder="Link text" />
                      <input type="url" data-link-url class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" placeholder="https://example.com" />
                    </div>
                    <div class="mt-5 flex items-center gap-2">
                      <button type="button" class="rounded-xl bg-slate-900 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white" data-link-action="insert">Insert</button>
                      <button type="button" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500" data-panel-close>Close</button>
                    </div>
                  </div>
                </div>

                <div data-panel="image" class="pointer-events-auto absolute inset-0 hidden flex items-center justify-center bg-slate-950/20 p-6 backdrop-blur-sm">
                  <div class="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl">
                    <h4 class="text-sm font-bold text-slate-900">Insert Image</h4>
                    <div class="mt-5 space-y-3">
                      <input type="url" data-image-url class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" placeholder="Image URL" />
                      <input type="text" data-image-alt class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" placeholder="Alt text" />
                    </div>
                    <div class="mt-5 flex items-center gap-2">
                      <button type="button" class="rounded-xl bg-slate-900 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white" data-image-action="insert">Insert</button>
                      <button type="button" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500" data-panel-close>Close</button>
                    </div>
                  </div>
                </div>

                <div data-panel="code" class="pointer-events-auto absolute inset-0 hidden flex items-center justify-center bg-slate-950/20 p-6 backdrop-blur-sm">
                  <div class="w-full max-w-2xl rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl">
                    <h4 class="text-sm font-bold text-slate-900">Insert Code Block</h4>
                    <div class="mt-5 space-y-3">
                      <select data-code-language class="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white">
                        <option value="javascript">JavaScript</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                        <option value="json">JSON</option>
                        <option value="sql">SQL</option>
                        <option value="bash">Bash</option>
                        <option value="text">Plain text</option>
                      </select>
                      <textarea data-code-content class="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 outline-none focus:border-sky-400 focus:bg-white" placeholder="Paste code here"></textarea>
                    </div>
                    <div class="mt-5 flex items-center gap-2">
                      <button type="button" class="rounded-xl bg-slate-900 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white" data-code-action="insert">Insert</button>
                      <button type="button" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500" data-panel-close>Close</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-900 px-5 py-3">
              <div class="flex flex-wrap items-center gap-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <span>Words <span data-count="words" class="ml-1 text-white">0</span></span>
                <span>Chars <span data-count="chars" class="ml-1 text-white">0</span></span>
                <span>Lines <span data-count="lines" class="ml-1 text-white">1</span></span>
              </div>
              <div class="sm:hidden">
                <span data-save-status class="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                  <span class="h-2 w-2 rounded-full bg-emerald-500"></span>Saved
                </span>
              </div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const editor = root.querySelector('[data-text-studio-editor]');
      const title = root.querySelector('[data-doc-title]');

      root.querySelectorAll('button[data-editor-cmd]').forEach((element) => {
        element.addEventListener('mousedown', (event) => {
          saveSelection(root);
          event.preventDefault();
        });
      });

      root.querySelectorAll('select[data-editor-select]').forEach((element) => {
        element.addEventListener('mousedown', () => {
          saveSelection(root);
        });
      });

      root.addEventListener('click', (event) => {
        const docButton = event.target.closest('[data-doc-id]');
        if (docButton && !event.target.closest('[data-doc-action]')) {
          state.activeDocId = docButton.dataset.docId;
          sync(root);
          return;
        }

        const docAction = event.target.closest('[data-doc-action]');
        if (docAction) {
          const { docId, docAction: action } = docAction.dataset;
          if (action === 'duplicate') duplicateDoc(root, docId);
          if (action === 'delete') deleteDoc(root, docId);
          return;
        }

        const commandButton = event.target.closest('[data-editor-cmd]');
        if (commandButton) {
          handleCommand(root, commandButton.dataset.editorCmd);
          return;
        }

        if (event.target.closest('[data-panel-close]')) {
          closePanels(root);
          return;
        }

        if (event.target.closest('[data-find-action="find"]')) {
          findNext(root);
          return;
        }

        if (event.target.closest('[data-find-action="replace"]')) {
          replaceCurrent(root);
          return;
        }

        if (event.target.closest('[data-find-action="replace-all"]')) {
          replaceAll(root);
          return;
        }

        if (event.target.closest('[data-table-action="insert"]')) {
          insertTable(root);
          return;
        }

        if (event.target.closest('[data-link-action="insert"]')) {
          insertLink(root);
          return;
        }

        if (event.target.closest('[data-image-action="insert"]')) {
          insertImage(root);
          return;
        }

        if (event.target.closest('[data-code-action="insert"]')) {
          insertCodeBlock(root);
        }
      });

      root.querySelectorAll('select[data-editor-select]').forEach((select) => {
        select.addEventListener('change', (event) => {
          const { editorSelect } = event.target.dataset;
          if (editorSelect === 'fontName') applyFontName(root, event.target.value);
          if (editorSelect === 'fontSize') exec(root, 'fontSize', event.target.value);
          if (editorSelect === 'formatBlock') exec(root, 'formatBlock', event.target.value);
        });
      });


      title?.addEventListener('input', () => {
        const activeDoc = getActiveDoc();
        if (!activeDoc) return;
        activeDoc.title = title.value.trim() || 'Untitled document';
        activeDoc.modified = new Date().toISOString();
        renderDocList(root);
        saveDocuments(state);
        setStatus(root, 'editing', 'Editing');
        queueSave(root);
      });

      editor?.addEventListener('mouseup', () => saveSelection(root));
      editor?.addEventListener('keyup', () => saveSelection(root));

      editor?.addEventListener('input', () => {
        if (isSyncingEditor) return;
        const activeDoc = getActiveDoc();
        if (!activeDoc) return;
        activeDoc.content = editor.innerHTML;
        activeDoc.modified = new Date().toISOString();
        updateCounts(root);
        renderDocList(root);
        setStatus(root, 'editing', 'Editing');
        queueSave(root);
      });

      root.addEventListener('keydown', (event) => {
        if (!(event.ctrlKey || event.metaKey)) return;

        const key = event.key.toLowerCase();
        if (key === 's') {
          event.preventDefault();
          queueSave(root, 'Saving');
        } else if (key === 'n') {
          event.preventDefault();
          createNewDoc(root);
        } else if (key === 'p') {
          event.preventDefault();
          printDoc(root);
        } else if (key === 'f') {
          event.preventDefault();
          openPanel(root, 'find');
          root.querySelector('[data-find-input]')?.focus();
        } else if (key === '`') {
          event.preventDefault();
          insertInlineCode(root);
        }
      });

      sync(root);
    },
    onOpen(root) {
      sync(root);
      closePanels(root);
      focusEditor(root);
    },
  };
}