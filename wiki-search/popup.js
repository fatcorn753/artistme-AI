let lang = 'ja';
let searchHistory = [];

const resultArea = document.getElementById('result-area');
const searchInput = document.getElementById('search-input');

// Language toggle
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    lang = btn.dataset.lang;
    chrome.storage.local.set({ wikiLang: lang });
  });
});

async function search(query) {
  if (!query.trim()) return;
  resultArea.innerHTML = '<div class="result-loading">検索中...</div>';

  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json&origin=*`;
    const [, titles, , urls] = await (await fetch(searchUrl)).json();

    if (!titles.length) {
      const otherLang = lang === 'ja' ? 'en' : 'ja';
      const [, ft, , fu] = await (await fetch(
        `https://${otherLang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json&origin=*`
      )).json();
      if (ft.length) return showSummary(ft[0], fu[0], otherLang);
      resultArea.innerHTML = '<div class="result-error">記事が見つかりませんでした</div>';
      return;
    }
    showSummary(titles[0], urls[0], lang);
    addHistory(query);
  } catch {
    resultArea.innerHTML = '<div class="result-error">通信エラー</div>';
  }
}

async function showSummary(title, pageUrl, useLang) {
  try {
    const res = await fetch(`https://${useLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const data = await res.json();
    const thumb = data.thumbnail?.source;
    const extract = (data.extract || '').slice(0, 500);

    resultArea.innerHTML = `
      <div class="result-card">
        <div class="result-header">
          <div class="result-title">${data.title || title}</div>
          <a class="result-link" href="${pageUrl}" target="_blank">Wikipedia →</a>
        </div>
        <div class="result-desc">${data.description || ''}</div>
        <div class="result-body">
          ${thumb ? `<img class="result-thumb" src="${thumb}" alt="">` : ''}
          <div class="result-extract">${extract}${data.extract?.length > 500 ? '...' : ''}</div>
        </div>
      </div>
    `;
  } catch {
    resultArea.innerHTML = '<div class="result-error">概要取得エラー</div>';
  }
}

function addHistory(query) {
  searchHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
  chrome.storage.local.set({ wikiHistory: searchHistory });
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById('search-history');
  el.innerHTML = '';
  searchHistory.forEach(h => {
    const chip = document.createElement('span');
    chip.className = 'hist-item';
    chip.textContent = h;
    chip.addEventListener('click', () => { searchInput.value = h; search(h); });
    el.appendChild(chip);
  });
}

document.getElementById('btn-search').addEventListener('click', () => search(searchInput.value));
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') search(searchInput.value); });

chrome.storage.local.get(['wikiLang', 'wikiHistory'], d => {
  if (d.wikiLang) {
    lang = d.wikiLang;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  }
  searchHistory = d.wikiHistory || [];
  renderHistory();
});
