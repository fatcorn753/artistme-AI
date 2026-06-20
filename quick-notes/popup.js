let notes = [];
let activeId = null;
let saveTimer = null;
let previewMode = false;

const notesList   = document.getElementById('notes-list');
const searchEl    = document.getElementById('search-notes');
const titleEl     = document.getElementById('note-title');
const bodyEl      = document.getElementById('note-body');
const previewPane = document.getElementById('preview-pane');
const charCount   = document.getElementById('char-count');
const saveStatus  = document.getElementById('save-status');

// --- Simple Markdown renderer ---
function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup]|<blockquote|<pre)(.+)/gm, '<p>$1</p>');
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function timeAgo(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function save() {
  chrome.storage.local.set({ notes });
  saveStatus.textContent = '保存済み';
  saveStatus.className = 'save-status saved';
}

function scheduleSave() {
  saveStatus.textContent = '保存中...';
  saveStatus.className = 'save-status saving';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 600);
}

function getActiveNote() { return notes.find(n => n.id === activeId); }

function renderSidebar(filterQ = '') {
  notesList.innerHTML = '';
  const filtered = filterQ
    ? notes.filter(n => n.title.toLowerCase().includes(filterQ.toLowerCase()) || n.body.toLowerCase().includes(filterQ.toLowerCase()))
    : notes;

  filtered.sort((a, b) => b.updatedAt - a.updatedAt).forEach(note => {
    const div = document.createElement('div');
    div.className = 'note-item' + (note.id === activeId ? ' active' : '');
    div.innerHTML = `
      <div class="note-item-title">${note.title || '無題'}</div>
      <div class="note-item-preview">${note.body.slice(0, 40).replace(/\n/g, ' ') || '...'}</div>
      <div class="note-item-date">${timeAgo(note.updatedAt)}</div>
    `;
    div.addEventListener('click', () => selectNote(note.id));
    notesList.appendChild(div);
  });
}

function selectNote(id) {
  activeId = id;
  const note = getActiveNote();
  if (!note) return;
  titleEl.value = note.title;
  bodyEl.value = note.body;
  charCount.textContent = note.body.length + '文字';
  renderSidebar(searchEl.value);
  if (previewMode) updatePreview();
}

function updatePreview() {
  previewPane.innerHTML = renderMarkdown(bodyEl.value);
}

function newNote() {
  const note = { id: uuid(), title: '', body: '', createdAt: Date.now(), updatedAt: Date.now() };
  notes.unshift(note);
  save();
  renderSidebar();
  selectNote(note.id);
  titleEl.focus();
}

// Toolbar actions
document.querySelector('.toolbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const start = bodyEl.selectionStart;
  const end = bodyEl.selectionEnd;
  const sel = bodyEl.value.slice(start, end);
  let replacement = '';
  if (action === 'bold') replacement = `**${sel || '太字テキスト'}**`;
  else if (action === 'italic') replacement = `*${sel || '斜体テキスト'}*`;
  else if (action === 'heading') replacement = `## ${sel || '見出し'}`;
  else if (action === 'list') replacement = `\n- ${sel || 'リスト項目'}`;
  else if (action === 'code') replacement = sel.includes('\n') ? `\`\`\`\n${sel || 'code'}\n\`\`\`` : `\`${sel || 'code'}\``;
  bodyEl.focus();
  document.execCommand('insertText', false, replacement);
});

document.getElementById('btn-preview').addEventListener('click', () => {
  previewMode = !previewMode;
  bodyEl.classList.toggle('hidden', previewMode);
  previewPane.classList.toggle('hidden', !previewMode);
  if (previewMode) updatePreview();
});

titleEl.addEventListener('input', () => {
  const note = getActiveNote(); if (!note) return;
  note.title = titleEl.value;
  note.updatedAt = Date.now();
  scheduleSave();
  renderSidebar(searchEl.value);
});

bodyEl.addEventListener('input', () => {
  const note = getActiveNote(); if (!note) return;
  note.body = bodyEl.value;
  note.updatedAt = Date.now();
  charCount.textContent = note.body.length + '文字';
  scheduleSave();
  renderSidebar(searchEl.value);
});

document.getElementById('btn-new').addEventListener('click', newNote);

document.getElementById('btn-delete').addEventListener('click', () => {
  if (!activeId || !confirm('このノートを削除しますか？')) return;
  notes = notes.filter(n => n.id !== activeId);
  activeId = notes[0]?.id || null;
  save();
  renderSidebar();
  if (activeId) selectNote(activeId);
  else { titleEl.value = ''; bodyEl.value = ''; }
});

searchEl.addEventListener('input', () => renderSidebar(searchEl.value));

document.getElementById('btn-export').addEventListener('click', () => {
  const content = notes.map(n => `# ${n.title}\n\n${n.body}`).join('\n\n---\n\n');
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'notes.md'; a.click();
  URL.revokeObjectURL(url);
});

// Init
chrome.storage.local.get(['notes'], (data) => {
  notes = data.notes || [];
  if (!notes.length) {
    notes = [{ id: uuid(), title: 'はじめに', body: '# Quick Notes へようこそ！\n\n- **太字**: `**テキスト**`\n- *斜体*: `*テキスト*`\n- `コード`: バッククォートで囲む\n\n> メモを自由に書いてみましょう。', createdAt: Date.now(), updatedAt: Date.now() }];
    save();
  }
  renderSidebar();
  if (notes.length) selectNote(notes[0].id);
});
