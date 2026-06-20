let words = [];
let pos = 0;
let playing = false;
let timer = null;
let startTime = null;
let wordsRead = 0;

const displayEl  = document.getElementById('word-display');
const progressEl = document.getElementById('progress-bar');
const playBtn    = document.getElementById('btn-play');
const wpmSlider  = document.getElementById('wpm-slider');
const wpmVal     = document.getElementById('wpm-val');
const fontSlider = document.getElementById('font-slider');
const posEl      = document.getElementById('word-pos');
const wpmDisp    = document.getElementById('wpm-display');
const timeLeft   = document.getElementById('time-left');

// ── Text processing ───────────────────────────────────
function tokenize(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0);
}

function isPunct(word) {
  return /[.!?。！？]$/.test(word);
}

function isComma(word) {
  return /[,;、；]$/.test(word);
}

// ── Pivot calculation (ORP — Optimal Recognition Point) ──
function getPivotIndex(word) {
  const clean = word.replace(/[^a-zA-Z぀-鿿]/g, '');
  const len = clean.length || word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

function renderWord(word) {
  const highlight = document.getElementById('highlight-mid').checked;
  if (!highlight || !word) { displayEl.innerHTML = escHtml(word); return; }
  const pivotIdx = getPivotIndex(word);
  const before = word.slice(0, pivotIdx);
  const pivot  = word[pivotIdx] || '';
  const after  = word.slice(pivotIdx + 1);
  displayEl.innerHTML = escHtml(before) + `<span class="pivot">${escHtml(pivot)}</span>` + escHtml(after);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Playback ──────────────────────────────────────────
function getDelay(word) {
  const wpm  = parseInt(wpmSlider.value);
  const base = 60000 / wpm;
  const pausePunct = document.getElementById('pause-punct').checked;
  if (pausePunct && isPunct(word))  return base * 3;
  if (pausePunct && isComma(word))  return base * 1.8;
  // Longer words get slightly more time
  return base * Math.max(0.5, Math.min(1.5, word.length / 5));
}

function advance() {
  if (pos >= words.length) { stop(); return; }

  const word = words[pos];
  renderWord(word);
  progressEl.style.width = (pos / Math.max(1, words.length - 1) * 100) + '%';
  posEl.textContent = `${pos + 1} / ${words.length}`;

  // Live WPM
  if (startTime) {
    const elapsed = (Date.now() - startTime) / 60000;
    const liveWpm = elapsed > 0 ? Math.round(wordsRead / elapsed) : 0;
    wpmDisp.textContent = `${liveWpm} WPM`;
    // Time left
    const remaining = words.length - pos;
    const secsLeft  = Math.round(remaining / (parseInt(wpmSlider.value) / 60));
    timeLeft.textContent = secsLeft > 60
      ? `残り ${Math.floor(secsLeft/60)}分${secsLeft%60}秒`
      : `残り ${secsLeft}秒`;
  }

  pos++;
  wordsRead++;
  timer = setTimeout(advance, getDelay(word));
}

function play() {
  if (words.length === 0) return;
  playing = true;
  if (!startTime) startTime = Date.now();
  playBtn.textContent = '⏸ 停止';
  playBtn.classList.add('playing');
  advance();
}

function stop() {
  playing = false;
  clearTimeout(timer);
  timer = null;
  playBtn.textContent = '▶ スタート';
  playBtn.classList.remove('playing');
  if (pos >= words.length) {
    displayEl.innerHTML = '完了！ 🎉';
    progressEl.style.width = '100%';
  }
}

function restart() {
  stop();
  pos = 0; wordsRead = 0; startTime = null;
  wpmDisp.textContent = '— WPM';
  timeLeft.textContent = '—';
  progressEl.style.width = '0%';
  if (words.length) { renderWord(words[0]); posEl.textContent = `1 / ${words.length}`; }
  else { displayEl.textContent = 'テキストを読み込んでください'; posEl.textContent = '0 / 0'; }
}

function loadText() {
  const text = document.getElementById('text-input').value.trim();
  if (!text) return;
  words = tokenize(text);
  restart();
  chrome.storage.local.set({ srText: text });
}

// ── Controls ──────────────────────────────────────────
playBtn.addEventListener('click', () => { playing ? stop() : play(); });

document.getElementById('btn-prev').addEventListener('click', () => {
  stop(); pos = Math.max(0, pos - 2);
  if (words.length) { renderWord(words[pos]); posEl.textContent = `${pos+1} / ${words.length}`; }
});

document.getElementById('btn-next').addEventListener('click', () => {
  stop(); pos = Math.min(words.length - 1, pos + 1);
  if (words.length) { renderWord(words[pos]); posEl.textContent = `${pos+1} / ${words.length}`; }
});

document.getElementById('btn-restart').addEventListener('click', restart);

wpmSlider.addEventListener('input', () => { wpmVal.textContent = wpmSlider.value; });
fontSlider.addEventListener('input', () => { displayEl.style.fontSize = fontSlider.value + 'px'; });

document.getElementById('btn-load').addEventListener('click', loadText);
document.getElementById('text-input').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') loadText();
});

document.getElementById('btn-clear-text').addEventListener('click', () => {
  document.getElementById('text-input').value = '';
  words = []; restart();
});

document.getElementById('btn-from-page').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const main = document.querySelector('main, article, [role="main"]') || document.body;
        const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','NAV','HEADER','FOOTER','ASIDE']);
        function getText(el) {
          if (SKIP.has(el.tagName)) return '';
          if (el.nodeType === 3) return el.textContent;
          return [...el.childNodes].map(getText).join(' ');
        }
        return getText(main).replace(/\s+/g,' ').trim().slice(0, 5000);
      }
    }, (results) => {
      if (results?.[0]?.result) {
        document.getElementById('text-input').value = results[0].result;
        loadText();
      }
    });
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === ' ') { e.preventDefault(); playing ? stop() : play(); }
  if (e.key === 'ArrowLeft') document.getElementById('btn-prev').click();
  if (e.key === 'ArrowRight') document.getElementById('btn-next').click();
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['srWpm','srFont','srText'], (data) => {
  if (data.srWpm)  { wpmSlider.value = data.srWpm;  wpmVal.textContent = data.srWpm; }
  if (data.srFont) { fontSlider.value = data.srFont; displayEl.style.fontSize = data.srFont + 'px'; }
  if (data.srText) {
    document.getElementById('text-input').value = data.srText;
    words = tokenize(data.srText);
    if (words.length) { renderWord(words[0]); posEl.textContent = `1 / ${words.length}`; }
  }
});

wpmSlider.addEventListener('change', () => chrome.storage.local.set({ srWpm: wpmSlider.value }));
fontSlider.addEventListener('change', () => chrome.storage.local.set({ srFont: fontSlider.value }));
