const pixelCanvas  = document.getElementById('pixel-canvas');
const overlayCanvas= document.getElementById('overlay-canvas');
const ctx          = pixelCanvas.getContext('2d');
const octx         = overlayCanvas.getContext('2d');

const PALETTE_COLORS = [
  '#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00',
  '#ff00ff','#00ffff','#ff8800','#8800ff','#ff6688','#88ff66',
  '#6688ff','#ffaa00','#444444','#aaaaaa',
];

let GRID = 32;
let CELL = 14;
let pixels = [];         // 2D array of color strings ('' = transparent)
let history = [];        // undo stack
let redoStack = [];
let tool = 'pen';
let color = '#3b82f6';
let mouseDown = false;
let showGrid = true;
let lineStart = null;    // for line/rect tools
let overlayPixels = {};  // preview for line/rect

// ── Init ──────────────────────────────────────────────
function init(size) {
  GRID = parseInt(size);
  CELL = Math.floor(Math.min(500, 440) / GRID);
  pixels = Array.from({ length: GRID }, () => Array(GRID).fill(''));
  history = []; redoStack = [];
  const W = GRID * CELL, H = GRID * CELL;
  pixelCanvas.width  = overlayCanvas.width  = W;
  pixelCanvas.height = overlayCanvas.height = H;
  // Position overlay
  overlayCanvas.style.top  = 0;
  overlayCanvas.style.left = 0;
  draw();
}

// ── Drawing ───────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height);

  // Pixels
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (pixels[r][c]) {
        ctx.fillStyle = pixels[r][c];
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
  }

  // Grid
  if (showGrid) {
    ctx.strokeStyle = 'rgba(100,100,160,0.3)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i*CELL, 0); ctx.lineTo(i*CELL, GRID*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*CELL); ctx.lineTo(GRID*CELL, i*CELL); ctx.stroke();
    }
  }
}

function drawOverlay() {
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  for (const [key, col] of Object.entries(overlayPixels)) {
    const [r, c] = key.split(',').map(Number);
    octx.fillStyle = col || 'rgba(0,0,0,0)';
    if (col) octx.fillRect(c*CELL, r*CELL, CELL, CELL);
  }
}

// ── Save/undo ─────────────────────────────────────────
function saveHistory() {
  history.push(pixels.map(row => [...row]));
  if (history.length > 50) history.shift();
  redoStack = [];
  updateUndoRedo();
}

function updateUndoRedo() {
  document.getElementById('btn-undo').disabled = !history.length;
  document.getElementById('btn-redo').disabled = !redoStack.length;
}

function undo() {
  if (!history.length) return;
  redoStack.push(pixels.map(row => [...row]));
  pixels = history.pop();
  draw(); updateUndoRedo();
}

function redo() {
  if (!redoStack.length) return;
  history.push(pixels.map(row => [...row]));
  pixels = redoStack.pop();
  draw(); updateUndoRedo();
}

// ── Pixel operations ──────────────────────────────────
function getRC(e) {
  const rect = pixelCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  return [Math.floor(y / CELL), Math.floor(x / CELL)];
}

function inBounds(r, c) { return r >= 0 && r < GRID && c >= 0 && c < GRID; }

function setPixel(r, c, col) {
  if (!inBounds(r, c)) return;
  pixels[r][c] = col;
}

// Flood fill (BFS)
function floodFill(r, c, newColor) {
  const target = pixels[r][c];
  if (target === newColor) return;
  const queue = [[r, c]];
  const visited = new Set([`${r},${c}`]);
  while (queue.length) {
    const [cr, cc] = queue.shift();
    if (!inBounds(cr, cc) || pixels[cr][cc] !== target) continue;
    pixels[cr][cc] = newColor;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = cr+dr, nc = cc+dc;
      const key = `${nr},${nc}`;
      if (!visited.has(key) && inBounds(nr, nc) && pixels[nr][nc] === target) {
        visited.add(key); queue.push([nr, nc]);
      }
    }
  }
}

// Bresenham line
function linePixels(r0, c0, r1, c1) {
  const pts = [];
  let dr = Math.abs(r1-r0), dc = Math.abs(c1-c0);
  let sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
  let err = dr - dc;
  let r = r0, c = c0;
  while (true) {
    pts.push([r, c]);
    if (r === r1 && c === c1) break;
    const e2 = 2 * err;
    if (e2 > -dc) { err -= dc; r += sr; }
    if (e2 < dr)  { err += dr; c += sc; }
  }
  return pts;
}

// Rect outline
function rectPixels(r0, c0, r1, c1) {
  const pts = [];
  const minR = Math.min(r0,r1), maxR = Math.max(r0,r1);
  const minC = Math.min(c0,c1), maxC = Math.max(c0,c1);
  for (let r = minR; r <= maxR; r++) {
    pts.push([r, minC]); pts.push([r, maxC]);
  }
  for (let c = minC; c <= maxC; c++) {
    pts.push([minR, c]); pts.push([maxR, c]);
  }
  return pts;
}

// ── Mouse events ──────────────────────────────────────
function handleDraw(e) {
  const [r, c] = getRC(e);
  if (!inBounds(r, c)) return;

  if (tool === 'pen') {
    setPixel(r, c, color);
    draw();
  } else if (tool === 'eraser') {
    setPixel(r, c, '');
    draw();
  } else if (tool === 'eyedrop') {
    const picked = pixels[r][c];
    if (picked) { color = picked; document.getElementById('color-picker').value = picked; updateColorDisplay(); }
    tool = 'pen'; document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'pen'));
  } else if (tool === 'line' || tool === 'rect') {
    if (lineStart) {
      const pts = tool === 'line' ? linePixels(lineStart[0], lineStart[1], r, c)
                                  : rectPixels(lineStart[0], lineStart[1], r, c);
      overlayPixels = {};
      pts.forEach(([pr,pc]) => { if(inBounds(pr,pc)) overlayPixels[`${pr},${pc}`] = color; });
      drawOverlay();
    }
  }

  // Update status
  document.getElementById('status-pos').textContent = `x:${c} y:${r}`;
}

pixelCanvas.addEventListener('mousedown', (e) => {
  const [r, c] = getRC(e);
  if (!inBounds(r, c)) return;
  mouseDown = true;
  saveHistory();

  if (tool === 'fill') {
    floodFill(r, c, color);
    draw(); return;
  }
  if (tool === 'line' || tool === 'rect') {
    lineStart = [r, c]; return;
  }
  handleDraw(e);
});

pixelCanvas.addEventListener('mousemove', (e) => {
  if (!mouseDown && tool !== 'line' && tool !== 'rect') {
    const [r,c] = getRC(e);
    document.getElementById('status-pos').textContent = `x:${c} y:${r}`;
    return;
  }
  if (mouseDown) handleDraw(e);
});

pixelCanvas.addEventListener('mouseup', (e) => {
  mouseDown = false;
  if ((tool === 'line' || tool === 'rect') && lineStart) {
    const [r, c] = getRC(e);
    const pts = tool === 'line' ? linePixels(lineStart[0], lineStart[1], r, c)
                                : rectPixels(lineStart[0], lineStart[1], r, c);
    pts.forEach(([pr,pc]) => setPixel(pr, pc, color));
    lineStart = null;
    overlayPixels = {};
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    draw();
  }
});

pixelCanvas.addEventListener('mouseleave', () => { mouseDown = false; });

// ── Tool buttons ──────────────────────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tool = btn.dataset.tool;
    lineStart = null; overlayPixels = {}; octx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  });
});

function updateColorDisplay() {
  document.getElementById('status-color').style.background = color;
}

document.getElementById('color-picker').addEventListener('input', (e) => {
  color = e.target.value; updateColorDisplay();
});

// Palette
const paletteEl = document.getElementById('palette');
PALETTE_COLORS.forEach(c => {
  const sw = document.createElement('div');
  sw.className = 'pal-swatch';
  sw.style.background = c;
  sw.title = c;
  sw.addEventListener('click', () => {
    color = c;
    document.getElementById('color-picker').value = c;
    updateColorDisplay();
  });
  paletteEl.appendChild(sw);
});

// Grid size
document.getElementById('grid-size').addEventListener('change', (e) => init(e.target.value));

// Show grid
document.getElementById('show-grid').addEventListener('change', (e) => {
  showGrid = e.target.checked; draw();
});

// Undo/redo
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
document.getElementById('btn-clear').addEventListener('click', () => {
  saveHistory();
  pixels = Array.from({length:GRID}, () => Array(GRID).fill(''));
  draw();
});

// Export PNG (1:1)
document.getElementById('btn-export').addEventListener('click', () => exportPng(1));
document.getElementById('btn-export-big').addEventListener('click', () => exportPng(8));

function exportPng(scale) {
  const out = document.createElement('canvas');
  out.width = GRID * scale; out.height = GRID * scale;
  const oc = out.getContext('2d');
  oc.imageSmoothingEnabled = false;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (pixels[r][c]) {
        oc.fillStyle = pixels[r][c];
        oc.fillRect(c*scale, r*scale, scale, scale);
      }
    }
  }
  const a = document.createElement('a');
  a.download = `pixel-art-${GRID}x${GRID}${scale>1?'_x'+scale:''}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'y') { e.preventDefault(); redo(); }
    return;
  }
  const toolMap = { p:'pen', e:'eraser', f:'fill', i:'eyedrop', l:'line', r:'rect' };
  if (toolMap[e.key.toLowerCase()]) {
    tool = toolMap[e.key.toLowerCase()];
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  }
});

// Init
init(32);
updateColorDisplay();
updateUndoRedo();
