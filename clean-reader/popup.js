let extractedArticle = null;
let currentTheme = 'dark';

// ── Content script injected into target page ──────────
const EXTRACTOR_SCRIPT = `
(function() {
  // Score each element by text density
  function scoreElement(el) {
    const text = el.innerText || '';
    const words = text.split(/\\s+/).filter(w => w.length > 1).length;
    const links = el.querySelectorAll('a');
    const linkWords = [...links].reduce((s, a) => s + (a.innerText || '').split(/\\s+/).length, 0);
    const density = words > 0 ? (words - linkWords) / words : 0;
    return words * density;
  }

  const SKIP_TAGS = new Set(['SCRIPT','STYLE','NAV','HEADER','FOOTER','ASIDE','FORM','BUTTON','SELECT','NOSCRIPT','IFRAME','AD','FIGURE']);
  const SKIP_CLASSES = /nav|header|footer|sidebar|banner|ad|comment|social|share|related|recommend|widget|menu|cookie/i;

  // Find main content container
  function findMainContent() {
    // Try semantic elements first
    for (const sel of ['main', 'article', '[role="main"]', '.article-body', '.post-body', '.entry-content', '.article-content', '#article-body', '.content-body']) {
      const el = document.querySelector(sel);
      if (el && el.innerText.length > 300) return el;
    }

    // Score all divs
    const candidates = [...document.querySelectorAll('div, section')].filter(el => {
      if (SKIP_TAGS.has(el.tagName)) return false;
      const cls = (el.className + ' ' + el.id).toLowerCase();
      return !SKIP_CLASSES.test(cls);
    });

    let best = null, bestScore = 0;
    for (const el of candidates) {
      const score = scoreElement(el);
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  function cleanContent(el) {
    const clone = el.cloneNode(true);
    // Remove unwanted child elements
    const remove = clone.querySelectorAll('script,style,nav,header,footer,aside,form,button,iframe,.ad,.ads,.advertisement,.social-share,.related-posts,.comment,.cookie-notice');
    remove.forEach(r => r.remove());
    // Remove empty elements
    clone.querySelectorAll('p,div,span').forEach(e => { if (!e.textContent.trim()) e.remove(); });
    return clone.innerHTML;
  }

  const main = findMainContent();
  const title = document.querySelector('h1')?.innerText?.trim() ||
                document.querySelector('[itemprop="headline"]')?.innerText?.trim() ||
                document.title.split('|')[0].split(' - ')[0].trim();

  const author = document.querySelector('[itemprop="author"]')?.innerText?.trim() ||
                 document.querySelector('.author,.byline,.writer')?.innerText?.trim() || '';

  const dateEl = document.querySelector('[itemprop="datePublished"],[datetime],[pubdate],.published,.post-date,.article-date');
  const publishDate = dateEl?.getAttribute('datetime') || dateEl?.innerText?.trim() || '';

  const content = main ? cleanContent(main) : document.body.innerText.slice(0, 3000);
  const wordCount = (main?.innerText || '').split(/\\s+/).filter(Boolean).length;

  return { title, author, publishDate, content, wordCount, url: location.href, domain: location.hostname };
})();
`;

// ── Extract article ───────────────────────────────────
document.getElementById('btn-extract').addEventListener('click', async () => {
  const loadingEl = document.getElementById('loading-state');
  const emptyEl   = document.getElementById('empty-state');
  const previewEl = document.getElementById('article-preview');

  emptyEl.classList.add('hidden');
  previewEl.classList.add('hidden');
  loadingEl.classList.remove('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('タブが取得できません');

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: new Function(`return ${EXTRACTOR_SCRIPT}`),
    });

    if (!result?.result) throw new Error('コンテンツの取得に失敗しました');

    extractedArticle = result.result;
    loadingEl.classList.add('hidden');
    renderArticle(extractedArticle);
    document.getElementById('btn-open-reader').disabled = false;

    chrome.storage.local.set({ lastArticle: extractedArticle });
  } catch (e) {
    loadingEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    emptyEl.querySelector('.state-msg').textContent = '❌ ' + e.message;
  }
});

function renderArticle(article) {
  const previewEl = document.getElementById('article-preview');
  previewEl.classList.remove('hidden');

  document.getElementById('article-title').textContent = article.title || 'タイトル不明';
  document.getElementById('article-domain').textContent = '🌐 ' + article.domain;
  document.getElementById('article-wordcount').textContent = `📝 ${article.wordCount.toLocaleString()}語`;
  const readMin = Math.ceil(article.wordCount / 250);
  document.getElementById('article-readtime').textContent = `⏱ 約${readMin}分`;

  const contentEl = document.getElementById('article-content');
  contentEl.innerHTML = article.content || '<p>本文を取得できませんでした</p>';
  applySettings();
}

// ── Settings ──────────────────────────────────────────
function applySettings() {
  const content = document.getElementById('article-content');
  const fs      = document.getElementById('font-size-slider').value;
  const lh      = document.getElementById('line-height-slider').value;
  content.style.fontSize   = fs + 'px';
  content.style.lineHeight = lh;

  const themes = {
    dark:  { bg: '#0f172a', text: '#cbd5e1', metaBg: '#0f172a' },
    light: { bg: '#f8fafc', text: '#1e293b', metaBg: '#f1f5f9' },
    sepia: { bg: '#fdf6e3', text: '#4a3520', metaBg: '#f5ead2' },
  };
  const t = themes[currentTheme];
  const preview = document.getElementById('article-preview');
  preview.style.background = t.bg;
  content.style.color = t.text;
  document.getElementById('article-content').style.background = t.bg;
  document.querySelector('.article-meta').style.background = t.metaBg;
}

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTheme = btn.dataset.theme;
    applySettings();
    chrome.storage.local.set({ readerTheme: currentTheme });
  });
});

document.getElementById('font-size-slider').addEventListener('input', e => {
  document.getElementById('font-size-display').textContent = e.target.value;
  applySettings();
});
document.getElementById('line-height-slider').addEventListener('input', applySettings);

// ── Open in full tab ──────────────────────────────────
document.getElementById('btn-open-reader').addEventListener('click', () => {
  if (!extractedArticle) return;
  chrome.storage.local.set({ lastArticle: extractedArticle }, () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
  });
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['lastArticle', 'readerTheme'], d => {
  if (d.readerTheme) {
    currentTheme = d.readerTheme;
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === currentTheme));
  }
  if (d.lastArticle) {
    extractedArticle = d.lastArticle;
    renderArticle(d.lastArticle);
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('btn-open-reader').disabled = false;
  }
});
