const LEVELS = {
  easy: { cols: 9,  rows: 9,  mines: 10, label: '初級' },
  med:  { cols: 16, rows: 16, mines: 40, label: '中級' },
  hard: { cols: 30, rows: 16, mines: 99, label: '上級' },
};

let level = 'easy';
let grid = [], cols, rows, totalMines;
let revealed, flagged, gameState; // 'idle'|'running'|'won'|'lost'
let firstClick = true;
let elapsed = 0, timerInterval = null;
let bestTimes = {};

const boardEl    = document.getElementById('board');
const mineCountEl= document.getElementById('mine-count');
const timerEl    = document.getElementById('timer');
const faceBtn    = document.getElementById('btn-reset');
const bestEl     = document.getElementById('best-time');

// ── Init ──────────────────────────────────────────────
function newGame() {
  clearInterval(timerInterval);
  const cfg = LEVELS[level];
  cols = cfg.cols; rows = cfg.rows; totalMines = cfg.mines;

  grid     = Array.from({ length: rows }, () => Array(cols).fill(0));
  revealed = Array.from({ length: rows }, () => Array(cols).fill(false));
  flagged  = Array.from({ length: rows }, () => Array(cols).fill(false));
  gameState = 'idle';
  firstClick = true;
  elapsed = 0;

  mineCountEl.textContent = totalMines;
  timerEl.textContent = '0';
  faceBtn.textContent = '😊';
  bestEl.textContent = bestTimes[level] ? bestTimes[level] + '秒' : '—';

  renderBoard();
  updateSize();
}

function updateSize() {
  // Adjust popup width based on level
  const w = Math.min(580, cols * 26 + 20);
  document.querySelector('.board-wrap').style.maxWidth = w + 'px';
}

function placeMines(safeR, safeC) {
  const positions = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (Math.abs(r - safeR) > 1 || Math.abs(c - safeC) > 1)
        positions.push([r, c]);

  // Shuffle and pick first N
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  positions.slice(0, totalMines).forEach(([r, c]) => { grid[r][c] = -1; });

  // Calculate numbers
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r+dr, nc = c+dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === -1) count++;
        }
      grid[r][c] = count;
    }
  }
}

// ── Render ────────────────────────────────────────────
function renderBoard() {
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 24px)`;
  boardEl.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c;
      updateCell(cell, r, c);

      cell.addEventListener('click', () => onLeftClick(r, c));
      cell.addEventListener('contextmenu', (e) => { e.preventDefault(); onRightClick(r, c); });
      boardEl.appendChild(cell);
    }
  }
}

function updateCell(cell, r, c) {
  cell.className = 'cell';
  cell.textContent = '';

  if (revealed[r][c]) {
    cell.classList.add('revealed');
    const val = grid[r][c];
    if (val === -1) {
      cell.textContent = '💣';
    } else if (val > 0) {
      cell.textContent = val;
      cell.classList.add('n' + val);
    }
  } else if (flagged[r][c]) {
    cell.classList.add('flagged');
    cell.textContent = '🚩';
  }
}

function refreshCell(r, c) {
  const cell = boardEl.children[r * cols + c];
  if (cell) updateCell(cell, r, c);
}

// ── Game logic ────────────────────────────────────────
function onLeftClick(r, c) {
  if (gameState === 'won' || gameState === 'lost') return;
  if (flagged[r][c] || revealed[r][c]) return;

  if (firstClick) {
    firstClick = false;
    gameState = 'running';
    placeMines(r, c);
    timerInterval = setInterval(() => {
      elapsed++;
      timerEl.textContent = elapsed;
    }, 1000);
  }

  if (grid[r][c] === -1) {
    // Hit mine
    revealMine(r, c);
    loseGame();
    return;
  }

  flood(r, c);
  checkWin();
}

function onRightClick(r, c) {
  if (gameState === 'won' || gameState === 'lost') return;
  if (revealed[r][c]) return;

  flagged[r][c] = !flagged[r][c];
  refreshCell(r, c);

  const flagCount = flagged.flat().filter(Boolean).length;
  mineCountEl.textContent = totalMines - flagCount;
}

function flood(r, c) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return;
  if (revealed[r][c] || flagged[r][c]) return;
  revealed[r][c] = true;
  refreshCell(r, c);

  if (grid[r][c] === 0) {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        flood(r+dr, c+dc);
  }
}

function revealMine(r, c) {
  revealed[r][c] = true;
  const cell = boardEl.children[r * cols + c];
  if (cell) { cell.classList.add('cell', 'mine-exploded'); cell.textContent = '💣'; }
}

function loseGame() {
  clearInterval(timerInterval);
  gameState = 'lost';
  faceBtn.textContent = '😵';
  // Show all mines
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c] === -1 && !flagged[r][c] && !revealed[r][c]) {
        revealed[r][c] = true;
        const cell = boardEl.children[r * cols + c];
        if (cell) { cell.classList.add('mine-shown'); cell.textContent = '💣'; }
      }
}

function checkWin() {
  let unrevealedSafe = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!revealed[r][c] && grid[r][c] !== -1) unrevealedSafe++;

  if (unrevealedSafe === 0) {
    clearInterval(timerInterval);
    gameState = 'won';
    faceBtn.textContent = '😎';

    if (!bestTimes[level] || elapsed < bestTimes[level]) {
      bestTimes[level] = elapsed;
      chrome.storage.local.set({ msBest: bestTimes });
      bestEl.textContent = elapsed + '秒 🏆';
    }
  }
}

// ── Controls ──────────────────────────────────────────
faceBtn.addEventListener('click', newGame);

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    level = btn.dataset.level;
    newGame();
  });
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['msBest'], (data) => {
  bestTimes = data.msBest || {};
  newGame();
});
