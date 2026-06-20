const EMOJI_POOL = [
  '🐶','🐱','🦊','🐭','🐼','🐨','🐯','🦁','🐸','🐙',
  '🦄','🦋','🌸','🌈','⚡','🔥','🎸','🎯','🚀','🍕',
  '🍎','🍇','🌮','🎃','👾','💎','🏆','🎲','🎪','🌙',
  '🦀','🐬','🌊','🎭','🎨','🎻','🎺','🎹','🎵','🌺',
  '🏔','🌋','🏝','🌵','🍄','🌻','🦩','🦚','🦜','🦉',
];

let cols = 4, rows = 4;
let cards = [], flipped = [], matched = 0, moves = 0;
let timerInterval = null, elapsed = 0, started = false;
let bestScores = {};

const board       = document.getElementById('board');
const movesEl     = document.getElementById('moves');
const timerEl     = document.getElementById('timer');
const bestEl      = document.getElementById('best-score');
const winOverlay  = document.getElementById('win-overlay');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function newGame() {
  clearInterval(timerInterval);
  elapsed = 0; moves = 0; started = false; matched = 0; flipped = [];
  movesEl.textContent = '0';
  timerEl.textContent = '0:00';
  winOverlay.classList.add('hidden');

  const count = cols * rows;
  const pairs = count / 2;
  const pool = shuffle([...EMOJI_POOL]).slice(0, pairs);
  cards = shuffle([...pool, ...pool]);

  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  board.innerHTML = '';
  cards.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.idx = i;
    card.dataset.emoji = emoji;
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-back"></div>
        <div class="card-front">${emoji}</div>
      </div>
    `;
    card.addEventListener('click', () => onCardClick(card, i, emoji));
    board.appendChild(card);
  });

  updateBest();
}

function startTimer() {
  timerInterval = setInterval(() => {
    elapsed++;
    timerEl.textContent = fmtTime(elapsed);
  }, 1000);
}

function onCardClick(card, idx, emoji) {
  if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
  if (flipped.length >= 2) return;

  if (!started) { started = true; startTimer(); }

  card.classList.add('flipped');
  flipped.push({ card, idx, emoji });

  if (flipped.length === 2) {
    moves++;
    movesEl.textContent = moves;

    const [a, b] = flipped;
    if (a.emoji === b.emoji) {
      // Match
      setTimeout(() => {
        a.card.classList.add('matched');
        b.card.classList.add('matched');
        flipped = [];
        matched += 2;
        if (matched === cards.length) finishGame();
      }, 400);
    } else {
      // No match
      setTimeout(() => {
        a.card.classList.remove('flipped');
        b.card.classList.remove('flipped');
        flipped = [];
      }, 900);
    }
  }
}

function finishGame() {
  clearInterval(timerInterval);
  const key = `${cols}x${rows}`;
  const prev = bestScores[key];

  let bestMsg = '';
  // Score: lower moves and time is better — use moves as primary
  if (!prev || moves < prev.moves || (moves === prev.moves && elapsed < prev.time)) {
    bestScores[key] = { moves, time: elapsed };
    chrome.storage.local.set({ memoryBest: bestScores });
    bestMsg = `🏆 新記録！`;
    updateBest();
  } else {
    bestMsg = `最高: ${prev.moves}手 ${fmtTime(prev.time)}`;
  }

  document.getElementById('win-stats').innerHTML =
    `${moves}手 · ${fmtTime(elapsed)}<br><span style="color:#fbbf24">${bestMsg}</span>`;
  winOverlay.classList.remove('hidden');
}

function updateBest() {
  const key = `${cols}x${rows}`;
  const b = bestScores[key];
  bestEl.textContent = b ? `${b.moves}手 ${fmtTime(b.time)}` : '—';
}

// ── Difficulty buttons ────────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cols = parseInt(btn.dataset.cols);
    rows = parseInt(btn.dataset.rows);
    newGame();
  });
});

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-win-new').addEventListener('click', newGame);

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['memoryBest'], (data) => {
  bestScores = data.memoryBest || {};
  newGame();
});
