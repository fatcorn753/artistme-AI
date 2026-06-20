const canvas  = document.getElementById('game-canvas');
const ctx     = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const hiEl    = document.getElementById('high-score');
const startBtn= document.getElementById('btn-start');

const CELL  = 18;
const COLS  = Math.floor(canvas.width  / CELL);
const ROWS  = Math.floor(canvas.height / CELL);

// Colors
const C = {
  bg:      '#0d1f0d',
  grid:    '#0f2a0f',
  snake:   '#4ade80',
  snakeH:  '#86efac',
  food:    '#f87171',
  bonus:   '#fbbf24',
  wall:    '#1e3a1e',
  text:    '#4ade80',
  overlay: 'rgba(10,15,26,0.85)',
};

let snake, dir, nextDir, food, bonusFood, score, highScore, gameInterval, speed, state;
// state: 'idle' | 'running' | 'paused' | 'over'

function rand(max) { return Math.floor(Math.random() * max); }

function randomCell(excluded = []) {
  let pos;
  do {
    pos = { x: rand(COLS), y: rand(ROWS) };
  } while (excluded.some(e => e.x === pos.x && e.y === pos.y));
  return pos;
}

function init() {
  snake = [
    { x: Math.floor(COLS/2),     y: Math.floor(ROWS/2) },
    { x: Math.floor(COLS/2) - 1, y: Math.floor(ROWS/2) },
    { x: Math.floor(COLS/2) - 2, y: Math.floor(ROWS/2) },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  scoreEl.textContent = 0;
  food = randomCell(snake);
  bonusFood = null;
  state = 'running';
  startBtn.textContent = '一時停止 (Space)';
  startBtn.classList.remove('pause-mode');

  clearInterval(gameInterval);
  gameInterval = setInterval(tick, speed);
  draw();
}

function tick() {
  if (state !== 'running') return;

  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision (wrap)
  head.x = (head.x + COLS) % COLS;
  head.y = (head.y + ROWS) % ROWS;

  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    gameOver(); return;
  }

  snake.unshift(head);

  // Eat food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    food = randomCell(snake);
    // Spawn bonus every 50 pts
    if (score % 50 === 0) {
      bonusFood = randomCell(snake);
      setTimeout(() => { bonusFood = null; draw(); }, 5000);
    }
  } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
    score += 50;
    scoreEl.textContent = score;
    bonusFood = null;
    snake.push({ ...snake[snake.length - 1] }); // extra growth
  } else {
    snake.pop();
  }

  draw();
}

function draw() {
  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x*CELL, 0); ctx.lineTo(x*CELL, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y*CELL); ctx.lineTo(canvas.width, y*CELL); ctx.stroke();
  }

  // Snake
  snake.forEach((seg, i) => {
    const grd = ctx.createRadialGradient(
      seg.x*CELL + CELL/2, seg.y*CELL + CELL/2, 0,
      seg.x*CELL + CELL/2, seg.y*CELL + CELL/2, CELL/2
    );
    grd.addColorStop(0, i === 0 ? C.snakeH : C.snake);
    grd.addColorStop(1, i === 0 ? '#4ade80' : '#166534');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(seg.x*CELL + 1, seg.y*CELL + 1, CELL - 2, CELL - 2, 4);
    ctx.fill();

    // Eyes on head
    if (i === 0) {
      ctx.fillStyle = '#0d1f0d';
      const ex = dir.x !== 0 ? (dir.x > 0 ? 0.65 : 0.2) : 0.25;
      const ey1 = 0.25, ey2 = 0.65;
      [ey1, ey2].forEach(ey => {
        const ox = dir.y !== 0 ? ey : ex;
        const oy = dir.y !== 0 ? (dir.y > 0 ? ex : 1-ex) : ey;
        ctx.beginPath();
        ctx.arc(seg.x*CELL + CELL*ox, seg.y*CELL + CELL*oy, 2, 0, Math.PI*2);
        ctx.fill();
      });
    }
  });

  // Food
  ctx.fillStyle = C.food;
  ctx.beginPath();
  ctx.arc(food.x*CELL + CELL/2, food.y*CELL + CELL/2, CELL/2 - 2, 0, Math.PI*2);
  ctx.fill();
  // Apple shine
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(food.x*CELL + CELL/3, food.y*CELL + CELL/3, 2, 0, Math.PI*2);
  ctx.fill();

  // Bonus food
  if (bonusFood) {
    ctx.fillStyle = C.bonus;
    ctx.beginPath();
    const bx = bonusFood.x*CELL + CELL/2, by = bonusFood.y*CELL + CELL/2;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 4/5) - Math.PI/2;
      ctx.lineTo(bx + Math.cos(a)*(CELL/2-1), by + Math.sin(a)*(CELL/2-1));
      const a2 = a + Math.PI/5;
      ctx.lineTo(bx + Math.cos(a2)*(CELL/4), by + Math.sin(a2)*(CELL/4));
    }
    ctx.closePath(); ctx.fill();
  }

  // Overlays
  if (state === 'idle') {
    drawOverlay('🐍 Snake', 'Space でスタート', score > 0 ? `最高スコア: ${highScore}` : '');
  } else if (state === 'paused') {
    drawOverlay('⏸ 一時停止', 'Space で再開', `スコア: ${score}`);
  } else if (state === 'over') {
    drawOverlay('💀 ゲームオーバー', `スコア: ${score}`, highScore > score ? `最高: ${highScore}` : '🏆 新記録！');
  }
}

function drawOverlay(title, sub1, sub2) {
  ctx.fillStyle = C.overlay;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.text;
  ctx.font = 'bold 26px monospace';
  ctx.fillText(title, canvas.width/2, canvas.height/2 - 24);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(sub1, canvas.width/2, canvas.height/2 + 8);
  if (sub2) {
    ctx.font = '12px monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(sub2, canvas.width/2, canvas.height/2 + 30);
  }
}

function gameOver() {
  clearInterval(gameInterval);
  state = 'over';
  if (score > highScore) {
    highScore = score;
    hiEl.textContent = highScore;
    chrome.storage.local.set({ snakeHi: highScore });
  }
  startBtn.textContent = 'もう一度 (Space)';
  startBtn.classList.remove('pause-mode');
  draw();
}

// ── Controls ──────────────────────────────────────────
speed = 120;

startBtn.addEventListener('click', toggleGame);

function toggleGame() {
  if (state === 'idle' || state === 'over') {
    init();
  } else if (state === 'running') {
    state = 'paused';
    clearInterval(gameInterval);
    startBtn.textContent = '再開 (Space)';
    startBtn.classList.add('pause-mode');
    draw();
  } else if (state === 'paused') {
    state = 'running';
    gameInterval = setInterval(tick, speed);
    startBtn.textContent = '一時停止 (Space)';
    startBtn.classList.remove('pause-mode');
  }
}

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    speed = parseInt(btn.dataset.speed);
    if (state === 'running') {
      clearInterval(gameInterval);
      gameInterval = setInterval(tick, speed);
    }
  });
});

document.addEventListener('keydown', (e) => {
  const KEY_DIR = {
    ArrowUp:    { x: 0, y: -1 },
    ArrowDown:  { x: 0, y:  1 },
    ArrowLeft:  { x: -1, y: 0 },
    ArrowRight: { x:  1, y: 0 },
    w: { x: 0, y: -1 }, s: { x: 0, y:  1 },
    a: { x: -1, y: 0 }, d: { x:  1, y: 0 },
  };

  if (e.key === ' ') { e.preventDefault(); toggleGame(); return; }

  const newDir = KEY_DIR[e.key];
  if (newDir && state === 'running') {
    // Prevent reversing
    if (newDir.x !== -dir.x || newDir.y !== -dir.y) {
      nextDir = newDir;
    }
    e.preventDefault();
  }
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['snakeHi'], (data) => {
  highScore = data.snakeHi || 0;
  hiEl.textContent = highScore;
  state = 'idle';
  draw();
});
