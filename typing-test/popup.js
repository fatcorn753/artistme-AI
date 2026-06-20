const TEXTS = {
  en: [
    "the quick brown fox jumps over the lazy dog and runs away from the farm",
    "programming is the art of telling another human what you want the computer to do",
    "to be or not to be that is the question whether tis nobler in the mind to suffer",
    "all that glitters is not gold often have you heard that told many a man his life hath sold",
    "it was the best of times it was the worst of times it was the age of wisdom it was the age of foolishness",
    "success is not final failure is not fatal it is the courage to continue that counts in the end",
    "the only way to do great work is to love what you do if you have not found it keep looking do not settle",
  ],
  jp: [
    "吾輩は猫である名前はまだない どこで生れたか頓と見当がつかぬ",
    "春はあけぼの やうやう白くなりゆく山際 少し明かりて紫だちたる雲の細くたなびきたる",
    "人は誰でも過去に縛られている だからこそ今この瞬間を大切に生きることが重要なのだ",
    "技術は日々進歩しており プログラミングを学ぶことは現代社会において非常に重要なスキルとなっている",
    "東京は日本の首都であり 世界最大級の都市の一つとして 多くの人々が生活している",
  ],
  code: [
    "const sum = (a, b) => a + b; console.log(sum(1, 2));",
    "function fibonacci(n) { if (n <= 1) return n; return fibonacci(n-1) + fibonacci(n-2); }",
    "const arr = [1, 2, 3, 4, 5]; const doubled = arr.map(x => x * 2).filter(x => x > 4);",
    "async function fetchData(url) { const res = await fetch(url); return res.json(); }",
    "class Stack { constructor() { this.items = []; } push(x) { this.items.push(x); } pop() { return this.items.pop(); } }",
    "SELECT name, email FROM users WHERE active = 1 ORDER BY created_at DESC LIMIT 10;",
  ],
};

let mode = 'en';
let duration = 30;
let timeLeft = 30;
let started = false;
let finished = false;
let timerInterval = null;
let currentText = '';
let typedCorrect = 0;
let typedTotal = 0;
let totalCorrectChars = 0;
let cursorPos = 0;
let bestScores = {};

const displayEl   = document.getElementById('text-display');
const inputEl     = document.getElementById('type-input');
const wpmEl       = document.getElementById('wpm');
const accEl       = document.getElementById('accuracy');
const timerEl     = document.getElementById('timer');
const bestEl      = document.getElementById('best');
const resultPanel = document.getElementById('result-panel');

// ── Helpers ───────────────────────────────────────────
function randomText() {
  const pool = TEXTS[mode];
  const t = pool[Math.floor(Math.random() * pool.length)];
  // Repeat to always have enough chars
  return (t + ' ' + t + ' ' + t).slice(0, 300);
}

function calcWPM() {
  const elapsed = (duration - timeLeft) / 60;
  return elapsed > 0 ? Math.round(totalCorrectChars / 5 / elapsed) : 0;
}

function calcAccuracy() {
  if (typedTotal === 0) return 100;
  return Math.round(typedCorrect / typedTotal * 100);
}

// ── Render display ────────────────────────────────────
function renderDisplay() {
  const chars = currentText.split('');
  let html = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] === ' ' ? '&nbsp;' : chars[i];
    if (i < cursorPos) {
      // Already typed
      html += `<span class="char-correct">${ch}</span>`;
    } else if (i === cursorPos) {
      // Current cursor position
      html += `<span class="char-cursor char-pending">${ch}</span>`;
    } else {
      html += `<span class="char-pending">${ch}</span>`;
    }
  }

  displayEl.innerHTML = html;

  // Scroll cursor into view
  const cursorEl = displayEl.querySelector('.char-cursor');
  if (cursorEl) cursorEl.scrollIntoView({ block: 'nearest' });
}

// ── Timer ─────────────────────────────────────────────
function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    wpmEl.textContent = calcWPM();
    if (timeLeft <= 0) finishTest();
  }, 1000);
}

// ── Test flow ─────────────────────────────────────────
function initTest() {
  clearInterval(timerInterval);
  currentText = randomText();
  cursorPos = 0;
  typedCorrect = 0;
  typedTotal = 0;
  totalCorrectChars = 0;
  started = false;
  finished = false;
  timeLeft = duration;

  wpmEl.textContent = '0';
  accEl.textContent = '100%';
  timerEl.textContent = duration;
  inputEl.value = '';
  inputEl.disabled = false;
  inputEl.classList.remove('error');
  resultPanel.classList.add('hidden');

  const key = mode;
  bestEl.textContent = bestScores[key] || 0;

  renderDisplay();
  inputEl.focus();
}

function finishTest() {
  clearInterval(timerInterval);
  finished = true;
  inputEl.disabled = true;

  const wpm = calcWPM();
  const acc = calcAccuracy();
  const key = mode;

  document.getElementById('r-wpm').textContent = wpm;
  document.getElementById('r-acc').textContent = acc + '%';
  document.getElementById('r-chars').textContent = totalCorrectChars;

  if (!bestScores[key] || wpm > bestScores[key]) {
    bestScores[key] = wpm;
    chrome.storage.local.set({ typingBest: bestScores });
    document.getElementById('r-best-msg').textContent = wpm > 0 ? '🏆 新記録！' : '';
    bestEl.textContent = wpm;
  } else {
    document.getElementById('r-best-msg').textContent = `最高: ${bestScores[key]} WPM`;
  }

  resultPanel.classList.remove('hidden');
}

// ── Input handler ─────────────────────────────────────
inputEl.addEventListener('input', () => {
  if (finished) return;

  const val = inputEl.value;
  if (!val) return;

  if (!started) {
    started = true;
    startTimer();
  }

  // Process last character typed
  const lastChar = val[val.length - 1];
  const expectedChar = currentText[cursorPos];

  typedTotal++;

  if (lastChar === expectedChar) {
    typedCorrect++;
    totalCorrectChars++;
    cursorPos++;
    inputEl.classList.remove('error');

    // Auto advance if text runs out
    if (cursorPos >= currentText.length) {
      currentText += ' ' + randomText();
    }
  } else {
    inputEl.classList.add('error');
    // Don't advance cursor on error
  }

  // Clear input after each word (space)
  if (lastChar === ' ' || val.length > 20) {
    inputEl.value = '';
    inputEl.classList.remove('error');
  }

  accEl.textContent = calcAccuracy() + '%';
  wpmEl.textContent = calcWPM();
  renderDisplay();
});

inputEl.addEventListener('keydown', (e) => {
  // Allow backspace to clear error
  if (e.key === 'Backspace') {
    inputEl.classList.remove('error');
  }
});

// ── Controls ──────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    initTest();
  });
});

document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    duration = parseInt(btn.dataset.sec);
    initTest();
  });
});

document.getElementById('btn-retry').addEventListener('click', initTest);

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['typingBest'], (data) => {
  bestScores = data.typingBest || {};
  initTest();
});
