let bookmarks = [];
let activeTag = null;
let searchQ   = '';
let sort      = 'newest';

const listEl   = document.getElementById('bookmark-list');
const searchEl = document.getElementById('search-input');
const tagRow   = document.getElementById('tag-row');
const statsEl  = document.getElementById('stats-bar');

function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function save() { chrome.storage.local.set({ bookmarks }); }

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 3600000) return `${Math.floor(d/60000)}分前`;
  if (d < 86400000) return `${Math.floor(d/3600000)}時間前`;
  return `${Math.floor(d/86400000)}日前`;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function getAllTags() {
  const s = new Set();
  bookmarks.forEach(b => (b.tags||[]).forEach(t => s.add(t)));
  return [...s].sort();
}

function getFiltered() {
  let list = bookmarks.filter(b => {
    if (activeTag && !(b.tags||[]).includes(activeTag)) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) ||
             (b.note||'').toLowerCase().includes(q) || (b.tags||[]).some(t=>t.includes(q));
    }
    return true;
  });
  if (sort === 'newest') list.sort((a,b) => b.savedAt - a.savedAt);
  else if (sort === 'oldest') list.sort((a,b) => a.savedAt - b.savedAt);
  else list.sort((a,b) => a.title.localeCompare(b.title, 'ja'));
  return list;
}

function render() {
  // Tags
  tagRow.innerHTML = '';
  getAllTags().forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip' + (tag === activeTag ? ' active' : '');
    chip.textContent = '#' + tag;
    chip.addEventListener('click', () => { activeTag = activeTag === tag ? null : tag; render(); });
    tagRow.appendChild(chip);
  });

  // List
  const filtered = getFiltered();
  listEl.innerHTML = '';

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-msg">ブックマークがありません<br><small>+ ボタンで現在のページを保存</small></div>';
    statsEl.textContent = '';
    return;
  }

  filtered.forEach(b => {
    const div = document.createElement('div');
    div.className = 'bm-item';
    const hostname = (() => { try { return new URL(b.url).hostname; } catch { return ''; } })();
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;

    div.innerHTML = `
      <div class="bm-top">
        <img class="bm-favicon" src="${faviconUrl}" onerror="this.style.display='none'">
        <span class="bm-title-link" title="${escHtml(b.url)}">${escHtml(b.title)}</span>
        <div class="bm-actions">
          <button class="bm-action open-btn" title="開く">↗</button>
          <button class="bm-action edit-btn" title="編集">✏</button>
          <button class="bm-action del del-btn" title="削除">×</button>
        </div>
      </div>
      <div class="bm-url">${escHtml(hostname)}</div>
      ${b.note ? `<div class="bm-note">${escHtml(b.note)}</div>` : ''}
      <div class="bm-footer">
        <div class="bm-tags">${(b.tags||[]).map(t=>`<span class="bm-tag">#${t}</span>`).join('')}</div>
        <span class="bm-date">${timeAgo(b.savedAt)}</span>
      </div>
    `;

    div.querySelector('.bm-title-link').addEventListener('click', () => {
      chrome.tabs.create({ url: b.url });
    });
    div.querySelector('.open-btn').addEventListener('click', () => chrome.tabs.create({ url: b.url }));
    div.querySelector('.edit-btn').addEventListener('click', () => editBookmark(b.id));
    div.querySelector('.del-btn').addEventListener('click', () => {
      bookmarks = bookmarks.filter(x => x.id !== b.id);
      save(); render();
    });

    listEl.appendChild(div);
  });

  statsEl.textContent = `${filtered.length} / ${bookmarks.length} 件`;
}

// ── Edit inline ───────────────────────────────────────
function editBookmark(id) {
  const b = bookmarks.find(x => x.id === id);
  if (!b) return;
  const newTitle = prompt('タイトル:', b.title);
  if (newTitle === null) return;
  const newTags  = prompt('タグ (#tag1 #tag2):', (b.tags||[]).map(t=>'#'+t).join(' '));
  if (newTags === null) return;
  const newNote  = prompt('メモ:', b.note || '');
  b.title = newTitle.trim() || b.title;
  b.tags  = (newTags.match(/#(\w+)/g) || []).map(t => t.slice(1));
  b.note  = (newNote || '').trim();
  save(); render();
}

// ── Save current page ─────────────────────────────────
const quickSave = document.getElementById('quick-save');
const qsUrl     = document.getElementById('qs-url');
const qsTitle   = document.getElementById('qs-title');
const qsTags    = document.getElementById('qs-tags');
const qsNote    = document.getElementById('qs-note');
let pendingUrl = '';

document.getElementById('btn-save-page').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;
    pendingUrl = tab.url;
    qsUrl.textContent = tab.url;
    qsTitle.value = tab.title || '';
    qsTags.value  = '';
    qsNote.value  = '';
    quickSave.classList.remove('hidden');
    qsTitle.focus(); qsTitle.select();
  });
});

document.getElementById('qs-confirm').addEventListener('click', () => {
  const title = qsTitle.value.trim() || pendingUrl;
  const tags  = (qsTags.value.match(/#(\w+)/g) || []).map(t => t.slice(1));
  const note  = qsNote.value.trim();

  // Don't save duplicates
  const existing = bookmarks.find(b => b.url === pendingUrl);
  if (existing) {
    existing.title = title; existing.tags = tags; existing.note = note;
    existing.savedAt = Date.now();
  } else {
    bookmarks.unshift({ id: uuid(), url: pendingUrl, title, tags, note, savedAt: Date.now() });
  }

  save(); render();
  quickSave.classList.add('hidden');
});

document.getElementById('qs-cancel').addEventListener('click', () => quickSave.classList.add('hidden'));

// Enter to save
[qsTitle, qsTags, qsNote].forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('qs-confirm').click(); });
});

// ── Search / sort ─────────────────────────────────────
searchEl.addEventListener('input', () => { searchQ = searchEl.value; render(); });
document.getElementById('sort-select').addEventListener('change', e => { sort = e.target.value; render(); });

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['bookmarks'], (data) => {
  bookmarks = data.bookmarks || [];
  render();
});
