let snippets = [];
let selectedId = null;
let editingId  = null;
let activeTag  = null;
let searchQ    = '';

const snippetList = document.getElementById('snippet-list');
const searchInput = document.getElementById('search-input');
const tagFilters  = document.getElementById('tag-filters');
const emptyState  = document.getElementById('empty-state');
const editForm    = document.getElementById('edit-form');
const viewPane    = document.getElementById('view-pane');

function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function save()  { chrome.storage.local.set({ snippets }); }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Render sidebar ────────────────────────────────────
function getAllTags() {
  const tags = new Set();
  snippets.forEach(s => (s.tags || []).forEach(t => tags.add(t)));
  return [...tags].sort();
}

function getFiltered() {
  return snippets.filter(s => {
    if (activeTag && !(s.tags || []).includes(activeTag)) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return s.title.toLowerCase().includes(q) ||
             s.code.toLowerCase().includes(q) ||
             (s.desc || '').toLowerCase().includes(q) ||
             (s.tags || []).some(t => t.toLowerCase().includes(q));
    }
    return true;
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderSidebar() {
  // Tags
  tagFilters.innerHTML = '';
  getAllTags().forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip' + (tag === activeTag ? ' active' : '');
    chip.textContent = '#' + tag;
    chip.addEventListener('click', () => { activeTag = activeTag === tag ? null : tag; renderSidebar(); });
    tagFilters.appendChild(chip);
  });

  // List
  const filtered = getFiltered();
  snippetList.innerHTML = '';
  if (!filtered.length) {
    snippetList.innerHTML = '<div style="color:#30363d;font-size:12px;padding:16px;text-align:center">スニペットなし</div>';
    return;
  }
  filtered.forEach(s => {
    const div = document.createElement('div');
    div.className = 'snip-item' + (s.id === selectedId ? ' active' : '');
    div.innerHTML = `
      <div class="snip-name">${escHtml(s.title)}</div>
      <div class="snip-meta">
        <span class="lang-badge lang-${s.lang}">${s.lang.toUpperCase()}</span>
        <span class="snip-tags-preview">${(s.tags||[]).map(t=>'#'+t).join(' ')}</span>
      </div>
    `;
    div.addEventListener('click', () => selectSnippet(s.id));
    snippetList.appendChild(div);
  });
}

// ── Select / view ─────────────────────────────────────
function selectSnippet(id) {
  selectedId = id;
  editingId  = null;
  showView(id);
  renderSidebar();
}

function showView(id) {
  const s = snippets.find(x => x.id === id);
  if (!s) { showEmpty(); return; }

  emptyState.classList.add('hidden');
  editForm.classList.add('hidden');
  viewPane.classList.remove('hidden');

  document.getElementById('view-title').textContent = s.title;
  document.getElementById('view-desc').textContent  = s.desc || '';
  document.getElementById('view-meta').innerHTML =
    `<span class="lang-badge lang-${s.lang}">${s.lang.toUpperCase()}</span>` +
    (s.tags||[]).map(t=>`<span class="tag-chip" style="cursor:default">#${t}</span>`).join('');

  document.getElementById('view-code').textContent = s.code;
}

function showEmpty() {
  viewPane.classList.add('hidden');
  editForm.classList.add('hidden');
  emptyState.classList.remove('hidden');
}

function showEdit(id) {
  const s = id ? snippets.find(x => x.id === id) : null;
  editingId = id || null;

  emptyState.classList.add('hidden');
  viewPane.classList.add('hidden');
  editForm.classList.remove('hidden');

  document.getElementById('snip-title').value = s?.title || '';
  document.getElementById('snip-lang').value  = s?.lang  || 'js';
  document.getElementById('snip-tags').value  = (s?.tags||[]).map(t=>'#'+t).join(' ');
  document.getElementById('snip-code').value  = s?.code  || '';
  document.getElementById('snip-desc').value  = s?.desc  || '';
  document.getElementById('snip-title').focus();
}

// ── Save snippet ──────────────────────────────────────
document.getElementById('btn-save-snip').addEventListener('click', () => {
  const title = document.getElementById('snip-title').value.trim();
  if (!title) { alert('タイトルを入力してください'); return; }

  const rawTags = document.getElementById('snip-tags').value;
  const tags = rawTags.match(/#(\w+)/g)?.map(t => t.slice(1)) || [];

  const data = {
    title,
    lang: document.getElementById('snip-lang').value,
    tags,
    code: document.getElementById('snip-code').value,
    desc: document.getElementById('snip-desc').value.trim(),
    updatedAt: Date.now(),
  };

  if (editingId) {
    const idx = snippets.findIndex(s => s.id === editingId);
    if (idx >= 0) snippets[idx] = { ...snippets[idx], ...data };
    selectedId = editingId;
  } else {
    const newSnip = { id: uuid(), createdAt: Date.now(), ...data };
    snippets.unshift(newSnip);
    selectedId = newSnip.id;
  }

  save();
  renderSidebar();
  selectSnippet(selectedId);
});

document.getElementById('btn-cancel').addEventListener('click', () => {
  if (selectedId) selectSnippet(selectedId);
  else showEmpty();
});

document.getElementById('btn-delete-snip').addEventListener('click', deleteCurrentSnippet);
document.getElementById('btn-del-view').addEventListener('click', deleteCurrentSnippet);

function deleteCurrentSnippet() {
  const id = editingId || selectedId;
  if (!id || !confirm('このスニペットを削除しますか？')) return;
  snippets = snippets.filter(s => s.id !== id);
  selectedId = null; editingId = null;
  save(); renderSidebar(); showEmpty();
}

// ── Edit from view ────────────────────────────────────
document.getElementById('btn-edit-snip').addEventListener('click', () => showEdit(selectedId));

// ── Copy from view ────────────────────────────────────
document.getElementById('btn-copy-snip').addEventListener('click', function() {
  const s = snippets.find(x => x.id === selectedId);
  if (!s) return;
  navigator.clipboard.writeText(s.code).then(() => {
    this.textContent = '✓ コピー済み'; this.classList.add('copied');
    setTimeout(() => { this.textContent = '⎘ コピー'; this.classList.remove('copied'); }, 1500);
  });
});

// ── New ──────────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', () => showEdit(null));

// ── Search ────────────────────────────────────────────
searchInput.addEventListener('input', () => { searchQ = searchInput.value; renderSidebar(); });

// ── Keyboard ──────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (selectedId) selectSnippet(selectedId); else showEmpty(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); showEdit(null); }
});

// ── Init ─────────────────────────────────────────────
const EXAMPLES = [
  { id: 'ex1', title: 'console.log shorthand', lang: 'js', tags: ['util','js'],
    code: 'const log = (...args) => console.log(...args);', desc: 'console.logの短縮形', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ex2', title: 'Debounce function', lang: 'js', tags: ['util','performance'],
    code: 'function debounce(fn, delay) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}', desc: 'デバウンス関数', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ex3', title: 'CSS Flexbox center', lang: 'css', tags: ['layout','css'],
    code: '.container {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}', desc: 'Flexboxで中央揃え', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ex4', title: 'Python list comprehension', lang: 'py', tags: ['python','list'],
    code: 'evens = [x for x in range(20) if x % 2 == 0]', desc: 'リスト内包表記', createdAt: Date.now(), updatedAt: Date.now() },
];

chrome.storage.local.get(['snippets'], (data) => {
  snippets = data.snippets?.length ? data.snippets : EXAMPLES;
  if (!data.snippets?.length) save();
  renderSidebar();
  if (snippets.length) selectSnippet(snippets[0].id);
});
