const loadingEl   = document.getElementById('loading');
const resultEl    = document.getElementById('result');
const timeValue   = document.getElementById('time-value');
const wordCount   = document.getElementById('word-count');
const charCount   = document.getElementById('char-count');
const sentenceCount = document.getElementById('sentence-count');
const paragraphCount= document.getElementById('paragraph-count');
const wpmSlider   = document.getElementById('wpm');
const wpmDisplay  = document.getElementById('wpm-display');

let pageStats = null;

function fmt(n) {
  return n >= 1000 ? (n/1000).toFixed(1) + 'k' : String(n);
}

function updateTime(wpm) {
  if (!pageStats) return;
  const minutes = Math.max(1, Math.ceil(pageStats.words / wpm));
  timeValue.textContent = minutes;
}

function renderStats(stats) {
  pageStats = stats;
  wordCount.textContent = fmt(stats.words);
  charCount.textContent = fmt(stats.chars);
  sentenceCount.textContent = fmt(stats.sentences);
  paragraphCount.textContent = fmt(stats.paragraphs);
  loadingEl.style.display = 'none';
  resultEl.classList.remove('hidden');
  updateTime(parseInt(wpmSlider.value));
}

// Inject script to extract page text
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) { loadingEl.textContent = 'タブが取得できません'; return; }
  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => {
      const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','HEADER','FOOTER','NAV','ASIDE']);
      function extractText(el) {
        if (SKIP_TAGS.has(el.tagName)) return '';
        if (el.nodeType === Node.TEXT_NODE) return el.textContent;
        return [...el.childNodes].map(extractText).join(' ');
      }
      const main = document.querySelector('main, article, [role="main"]') || document.body;
      const text = extractText(main).replace(/\s+/g, ' ').trim();
      // Count paragraphs by p tags or double newlines
      const paragraphs = [...document.querySelectorAll('p')].filter(p => p.textContent.trim().length > 20).length || 1;
      return {
        text,
        paragraphs,
      };
    }
  }, (results) => {
    if (chrome.runtime.lastError || !results?.[0]?.result) {
      loadingEl.textContent = 'テキストを取得できませんでした';
      return;
    }
    const { text, paragraphs } = results[0].result;
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const chars = text.replace(/\s/g, '').length;
    const sentences = (text.match(/[。！？.!?]+/g) || []).length || Math.ceil(words / 15);
    renderStats({ words, chars, sentences, paragraphs });
  });
});

wpmSlider.addEventListener('input', () => {
  const wpm = parseInt(wpmSlider.value);
  wpmDisplay.textContent = wpm + ' wpm';
  updateTime(wpm);
  chrome.storage.local.set({ wpm });
  document.querySelectorAll('.speed-preset').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.wpm) === wpm);
  });
});

document.querySelectorAll('.speed-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const wpm = parseInt(btn.dataset.wpm);
    wpmSlider.value = wpm;
    wpmDisplay.textContent = wpm + ' wpm';
    updateTime(wpm);
    chrome.storage.local.set({ wpm });
    document.querySelectorAll('.speed-preset').forEach(b => b.classList.toggle('active', b === btn));
  });
});

chrome.storage.local.get(['wpm'], (data) => {
  if (data.wpm) {
    wpmSlider.value = data.wpm;
    wpmDisplay.textContent = data.wpm + ' wpm';
    document.querySelectorAll('.speed-preset').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.wpm) === data.wpm);
    });
  }
});
