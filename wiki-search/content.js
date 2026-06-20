// Wikipedia Quick Search — content script
// Shows a floating card when text is selected (double-click or keyboard shortcut)

(function() {
  if (window.__wikiLoaded) return;
  window.__wikiLoaded = true;

  let card = null;
  let currentQuery = '';
  let lang = 'ja';

  // ── Build card ──────────────────────────────────────
  function getOrCreateCard() {
    if (card) return card;
    card = document.createElement('div');
    card.id = '__wiki-card__';
    card.innerHTML = `
      <div class="wk-header">
        <span class="wk-title" id="wk-title">Wikipedia</span>
        <div class="wk-controls">
          <button class="wk-lang-btn" id="wk-lang">EN</button>
          <a class="wk-open" id="wk-open" target="_blank" title="Wikipediaで開く">↗</a>
          <button class="wk-close" id="wk-close">×</button>
        </div>
      </div>
      <div class="wk-body" id="wk-body">
        <div class="wk-loading">読み込み中...</div>
      </div>
    `;
    document.body.appendChild(card);

    document.getElementById('wk-close').addEventListener('click', hideCard);
    document.getElementById('wk-lang').addEventListener('click', toggleLang);
    return card;
  }

  function showCard(x, y) {
    const c = getOrCreateCard();
    c.style.display = 'block';
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = 340, ch = 300;
    const left = Math.min(x + 12, vw - cw - 16);
    const top  = y + 12 + ch > vh ? y - ch - 8 : y + 12;
    c.style.left = Math.max(8, left) + 'px';
    c.style.top  = Math.max(8, top) + 'px';
  }

  function hideCard() {
    if (card) card.style.display = 'none';
  }

  function toggleLang() {
    lang = lang === 'ja' ? 'en' : 'ja';
    document.getElementById('wk-lang').textContent = lang === 'ja' ? 'EN' : 'JA';
    if (currentQuery) fetchWiki(currentQuery);
  }

  // ── Fetch Wikipedia ─────────────────────────────────
  async function fetchWiki(query) {
    const body = document.getElementById('wk-body');
    if (!body) return;
    body.innerHTML = '<div class="wk-loading">検索中...</div>';
    document.getElementById('wk-title').textContent = query;

    try {
      // Search for the best matching page
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      const [, titles, , urls] = await searchRes.json();

      if (!titles.length) {
        // Try other lang
        const otherLang = lang === 'ja' ? 'en' : 'ja';
        const fallbackUrl = `https://${otherLang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json&origin=*`;
        const fb = await fetch(fallbackUrl);
        const [, ftitles, , furls] = await fb.json();
        if (!ftitles.length) {
          body.innerHTML = '<div class="wk-not-found">記事が見つかりませんでした</div>';
          return;
        }
        return fetchSummary(ftitles[0], furls[0], otherLang);
      }
      fetchSummary(titles[0], urls[0], lang);
    } catch {
      body.innerHTML = '<div class="wk-not-found">取得エラー</div>';
    }
  }

  async function fetchSummary(title, pageUrl, lang) {
    const body = document.getElementById('wk-body');
    try {
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const res = await fetch(url);
      const data = await res.json();
      const extract = data.extract || '概要が見つかりません';
      const thumbnail = data.thumbnail?.source;

      document.getElementById('wk-title').textContent = data.title || title;
      document.getElementById('wk-open').href = pageUrl || data.content_urls?.desktop?.page || '#';

      body.innerHTML = `
        ${thumbnail ? `<img class="wk-thumb" src="${thumbnail}" alt="">` : ''}
        <p class="wk-extract">${extract.slice(0, 600)}${extract.length > 600 ? '...' : ''}</p>
        <div class="wk-categories">${(data.description || '').slice(0, 80)}</div>
      `;
    } catch {
      body.innerHTML = '<div class="wk-not-found">取得エラー</div>';
    }
  }

  // ── Listen for selection ────────────────────────────
  let selTimer = null;
  document.addEventListener('mouseup', (e) => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const sel = window.getSelection()?.toString().trim();
      if (sel && sel.length >= 2 && sel.length <= 100) {
        currentQuery = sel;
        showCard(e.clientX + window.scrollX, e.clientY + window.scrollY);
        fetchWiki(sel);
      }
    }, 400);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCard();
    // Alt+W to search selected
    if (e.altKey && e.key === 'w') {
      const sel = window.getSelection()?.toString().trim();
      if (sel) { currentQuery = sel; showCard(200, 200); fetchWiki(sel); }
    }
  });

  // Handle context menu trigger
  if (window.__wikiSearchQuery) {
    currentQuery = window.__wikiSearchQuery;
    delete window.__wikiSearchQuery;
    showCard(200, 200);
    fetchWiki(currentQuery);
  }

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (card && !card.contains(e.target)) hideCard();
  });
})();
