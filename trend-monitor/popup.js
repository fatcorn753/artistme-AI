let trendData = {}, bookmarks = new Set(), lastFetched = null;
let activeSource = 'all', searchQ = '', sortMode = 'default';

const SRC_CLASS = { 'Hacker News':'src-hn', 'GitHub Trending':'src-gh', 'Reddit':'src-reddit', 'DEV.to':'src-devto' };

function getAllItems() {
  const all = [
    ...(trendData.hn     || []),
    ...(trendData.gh     || []),
    ...(trendData.reddit || []),
    ...(trendData.devto  || []),
  ];
  return all;
}

function getFilteredItems() {
  let items = activeSource === 'bookmarks'
    ? getAllItems().filter(i => bookmarks.has(i.id))
    : activeSource === 'all'
      ? getAllItems()
      : getAllItems().filter(i => {
          const srcMap = { hn:'Hacker News', gh:'GitHub Trending', reddit:'Reddit', devto:'DEV.to' };
          return i.source === srcMap[activeSource];
        });

  if (searchQ) {
    const q = searchQ.toLowerCase();
    items = items.filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.author?.toLowerCase().includes(q) ||
      i.language?.toLowerCase().includes(q) ||
      i.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  if (sortMode === 'score')    items.sort((a,b) => (parseInt(b.score)||0) - (parseInt(a.score)||0));
  if (sortMode === 'comments') items.sort((a,b) => (parseInt(b.comments)||0) - (parseInt(a.comments)||0));

  return items;
}

function renderList() {
  const list = document.getElementById('trend-list');
  const items = getFilteredItems();
  list.innerHTML = '';

  if (!items.length) {
    const msg = Object.keys(trendData).length === 0
      ? '📡 データを取得中...\n\nしばらくお待ちください（初回は30秒ほどかかります）'
      : activeSource === 'bookmarks' ? '🔖 ブックマークがありません' : '検索結果がありません';
    list.innerHTML = `<div class="empty-msg">${msg.replace(/\n/g,'<br>')}</div>`;
    return;
  }

  items.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'trend-item ' + (SRC_CLASS[item.source] || '') + (bookmarks.has(item.id) ? ' bookmarked' : '');

    // Build meta chips
    const metaChips = [
      `<span class="ti-source">${item.icon} ${item.source}</span>`,
      item.score    ? `<span class="ti-score">▲ ${Number(item.score).toLocaleString()}</span>` : '',
      item.comments ? `<span class="ti-comments">💬 ${Number(item.comments).toLocaleString()}</span>` : '',
      item.author   ? `<span class="ti-author">by ${item.author}</span>` : '',
      item.language ? `<span class="ti-lang">${item.language}</span>` : '',
      item.todayStars && item.todayStars !== '0' ? `<span class="ti-today">+${Number(item.todayStars).toLocaleString()} 今日</span>` : '',
      item.stars    ? `<span class="ti-stars">⭐ ${Number(item.stars).toLocaleString()}</span>` : '',
      item.tags?.length ? `<span class="ti-tags">${item.tags.slice(0,2).map(t=>`<span class="ti-tag">#${t}</span>`).join('')}</span>` : '',
    ].filter(Boolean).join('');

    const bmIcon = bookmarks.has(item.id) ? '🔖' : '☆';

    div.innerHTML = `
      <div class="ti-top">
        <span class="ti-icon">${item.icon || '📌'}</span>
        <span class="ti-title">${escHtml(item.title || '')}</span>
        <button class="ti-bm-btn" data-id="${escHtml(item.id)}" title="ブックマーク">${bmIcon}</button>
      </div>
      ${item.description ? `<div class="ti-desc">${escHtml(item.description)}</div>` : ''}
      <div class="ti-meta">${metaChips}</div>
    `;

    // Open link
    div.addEventListener('click', e => {
      if (e.target.classList.contains('ti-bm-btn')) return;
      chrome.tabs.create({ url: item.url });
    });

    // Bookmark toggle
    div.querySelector('.ti-bm-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (bookmarks.has(item.id)) { bookmarks.delete(item.id); }
      else { bookmarks.add(item.id); }
      chrome.storage.local.set({ bookmarks: [...bookmarks] });
      renderList();
    });

    list.appendChild(div);
  });

  // Footer
  const total = getAllItems().length;
  document.getElementById('footer-bar').textContent =
    `${items.length}件表示 / 全${total}件 | ${lastFetched ? '更新: ' + new Date(lastFetched).toLocaleTimeString('ja-JP') : ''}`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Source tabs ───────────────────────────────────────
document.querySelectorAll('.src-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.src-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeSource = tab.dataset.src;
    renderList();
  });
});

// ── Search & sort ─────────────────────────────────────
document.getElementById('search-input').addEventListener('input', e => { searchQ = e.target.value; renderList(); });
document.getElementById('sort-select').addEventListener('change', e => { sortMode = e.target.value; renderList(); });

// ── Refresh ───────────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click', async () => {
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning'); btn.disabled = true;
  document.getElementById('loading-overlay').classList.remove('hidden');

  // Trigger background to fetch
  await new Promise(r => {
    chrome.runtime.sendMessage({ action: 'refreshTrends' }, () => r());
    setTimeout(r, 3000); // fallback timeout
  });

  // Wait a bit for background to finish
  await new Promise(r => setTimeout(r, 4000));
  await loadData();

  btn.classList.remove('spinning'); btn.disabled = false;
  document.getElementById('loading-overlay').classList.add('hidden');
});

document.getElementById('btn-bookmarks').addEventListener('click', () => {
  document.querySelectorAll('.src-tab').forEach(t => t.classList.toggle('active', t.dataset.src === 'bookmarks'));
  activeSource = 'bookmarks';
  renderList();
});

// ── Load from storage ─────────────────────────────────
async function loadData() {
  const d = await new Promise(r => chrome.storage.local.get(['trendData','lastFetched','bookmarks'], r));
  trendData   = d.trendData   || {};
  lastFetched = d.lastFetched || null;
  bookmarks   = new Set(d.bookmarks || []);

  if (lastFetched) {
    document.getElementById('last-updated').textContent =
      '更新: ' + new Date(lastFetched).toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
  }
  renderList();
}

// ── Init ─────────────────────────────────────────────
loadData();

// Poll for updates every 5 seconds on first load until data arrives
let pollCount = 0;
const poll = setInterval(async () => {
  pollCount++;
  const d = await new Promise(r => chrome.storage.local.get(['trendData','lastFetched'], r));
  if (d.lastFetched && Object.keys(d.trendData || {}).length > 0) {
    trendData = d.trendData; lastFetched = d.lastFetched;
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('last-updated').textContent =
      '更新: ' + new Date(d.lastFetched).toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
    renderList();
    clearInterval(poll);
  }
  if (pollCount > 12) clearInterval(poll); // Stop after 1 minute
}, 5000);
