const homeScreen   = document.getElementById('home-screen');
const editorScreen = document.getElementById('editor-screen');
const baseCanvas   = document.getElementById('base-canvas');
const annCanvas    = document.getElementById('ann-canvas');
const baseCtx      = baseCanvas.getContext('2d');
const annCtx       = annCanvas.getContext('2d');

let tool = 'pen', color = '#ef4444', strokeSize = 3;
let drawing = false, startX = 0, startY = 0;
let history = [];        // snapshots of ann-canvas for undo
let textInput = null;    // active text entry element

// ── Capture ───────────────────────────────────────────
document.getElementById('btn-capture').addEventListener('click', async () => {
  const errEl = document.getElementById('cap-error');
  errEl.classList.add('hidden');
  try {
    // Use chrome.tabs.captureVisibleTab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('タブが取得できません');

    chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 95 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        errEl.textContent = '❌ ' + chrome.runtime.lastError.message;
        errEl.classList.remove('hidden');
        return;
      }
      openEditor(dataUrl);
    });
  } catch (e) {
    errEl.textContent = '❌ ' + e.message;
    errEl.classList.remove('hidden');
  }
});

function openEditor(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 800 / img.width, 600 / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    baseCanvas.width = annCanvas.width = w;
    baseCanvas.height = annCanvas.height = h;

    baseCtx.drawImage(img, 0, 0, w, h);
    annCtx.clearRect(0, 0, w, h);
    history = [];

    homeScreen.classList.add('hidden');
    editorScreen.classList.remove('hidden');
    document.body.style.width = 'auto';
  };
  img.src = dataUrl;
}

// ── Tool selection ────────────────────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tool = btn.dataset.tool;
    annCanvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
    if (textInput) commitText();
  });
});

document.getElementById('ann-color').addEventListener('input', e => { color = e.target.value; });
document.getElementById('ann-size').addEventListener('input', e => { strokeSize = parseInt(e.target.value); });

// ── Drawing events ────────────────────────────────────
annCanvas.addEventListener('mousedown', onDown);
annCanvas.addEventListener('mousemove', onMove);
annCanvas.addEventListener('mouseup', onUp);
annCanvas.addEventListener('mouseleave', () => { if (drawing) { drawing = false; saveHistory(); } });

function pt(e) {
  const r = annCanvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onDown(e) {
  const { x, y } = pt(e);
  if (tool === 'text') { placeText(x, y); return; }
  if (textInput) commitText();
  saveHistory();
  drawing = true;
  startX = x; startY = y;
  annCtx.strokeStyle = color;
  annCtx.fillStyle = color;
  annCtx.lineWidth = strokeSize;
  annCtx.lineCap = 'round';
  annCtx.lineJoin = 'round';
  if (tool === 'pen') { annCtx.beginPath(); annCtx.moveTo(x, y); }
}

function onMove(e) {
  if (!drawing) return;
  const { x, y } = pt(e);
  if (tool === 'pen') {
    annCtx.lineTo(x, y); annCtx.stroke();
  } else {
    // Restore last history frame for live preview
    restoreLastHistory();
    drawShape(startX, startY, x, y);
  }
}

function onUp(e) {
  if (!drawing) return;
  drawing = false;
  const { x, y } = pt(e);
  if (tool !== 'pen') {
    restoreLastHistory();
    drawShape(startX, startY, x, y);
  }
  saveHistory();
}

function drawShape(x0, y0, x1, y1) {
  annCtx.strokeStyle = color;
  annCtx.lineWidth = strokeSize;
  annCtx.lineCap = 'round';

  switch (tool) {
    case 'rect':
      annCtx.strokeRect(x0, y0, x1-x0, y1-y0);
      break;
    case 'arrow': {
      const dx = x1-x0, dy = y1-y0, len = Math.hypot(dx, dy);
      if (len < 2) break;
      const ax = dx/len, ay = dy/len;
      const hw = Math.max(10, strokeSize*4), hl = Math.max(12, strokeSize*5);
      annCtx.beginPath();
      annCtx.moveTo(x0, y0);
      annCtx.lineTo(x1, y1);
      annCtx.stroke();
      // Arrowhead
      annCtx.beginPath();
      annCtx.moveTo(x1, y1);
      annCtx.lineTo(x1 - hl*ax + hw*ay, y1 - hl*ay - hw*ax);
      annCtx.lineTo(x1 - hl*ax - hw*ay, y1 - hl*ay + hw*ax);
      annCtx.closePath();
      annCtx.fillStyle = color;
      annCtx.fill();
      break;
    }
    case 'blur': {
      const bw = Math.abs(x1-x0), bh = Math.abs(y1-y0);
      const bx = Math.min(x0,x1), by = Math.min(y0,y1);
      if (bw < 4 || bh < 4) break;
      // Draw pixelated blur from base canvas
      const imgData = baseCtx.getImageData(bx, by, bw, bh);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = bw; tempCanvas.height = bh;
      const tc = tempCanvas.getContext('2d');
      tc.putImageData(imgData, 0, 0);
      // Scale down then up to pixelate
      const factor = 0.05;
      const tw = Math.max(1, Math.round(bw * factor));
      const th = Math.max(1, Math.round(bh * factor));
      tc.drawImage(tempCanvas, 0, 0, tw, th);
      annCtx.save();
      annCtx.imageSmoothingEnabled = false;
      annCtx.drawImage(tempCanvas, 0, 0, tw, th, bx, by, bw, bh);
      annCtx.restore();
      break;
    }
  }
}

// ── Text tool ─────────────────────────────────────────
function placeText(x, y) {
  if (textInput) commitText();
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.style.cssText = `position:absolute;left:${x}px;top:${y}px;background:transparent;border:1px dashed ${color};color:${color};font-size:${strokeSize*6+10}px;font-weight:bold;outline:none;min-width:80px;z-index:10;padding:2px;font-family:sans-serif;`;
  document.getElementById('canvas-wrap').appendChild(inp);
  inp.focus();
  textInput = inp;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') commitText(); });
}

function commitText() {
  if (!textInput) return;
  const text = textInput.value.trim();
  const x = parseInt(textInput.style.left);
  const y = parseInt(textInput.style.top);
  const size = strokeSize * 6 + 10;
  textInput.remove();
  textInput = null;
  if (!text) return;
  saveHistory();
  annCtx.fillStyle = color;
  annCtx.font = `bold ${size}px sans-serif`;
  annCtx.fillText(text, x, y + size);
  saveHistory();
}

// ── History ───────────────────────────────────────────
function saveHistory() {
  history.push(annCtx.getImageData(0, 0, annCanvas.width, annCanvas.height));
  if (history.length > 30) history.shift();
}

function restoreLastHistory() {
  if (history.length) {
    annCtx.putImageData(history[history.length-1], 0, 0);
  } else {
    annCtx.clearRect(0, 0, annCanvas.width, annCanvas.height);
  }
}

document.getElementById('btn-undo').addEventListener('click', () => {
  if (history.length > 1) {
    history.pop();
    annCtx.putImageData(history[history.length-1], 0, 0);
  } else {
    history = [];
    annCtx.clearRect(0, 0, annCanvas.width, annCanvas.height);
  }
});

document.getElementById('btn-clear-ann').addEventListener('click', () => {
  annCtx.clearRect(0, 0, annCanvas.width, annCanvas.height);
  history = [];
});

// ── Composite & save ──────────────────────────────────
function composite() {
  const c = document.createElement('canvas');
  c.width = baseCanvas.width; c.height = baseCanvas.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.drawImage(annCanvas, 0, 0);
  return c;
}

document.getElementById('btn-save').addEventListener('click', () => {
  const c = composite();
  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screenshot-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

document.getElementById('btn-copy-ann').addEventListener('click', () => {
  const c = composite();
  c.toBlob(blob => {
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
  });
});

document.getElementById('btn-back').addEventListener('click', () => {
  if (textInput) commitText();
  editorScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  document.body.style.width = '320px';
  loadSaved();
});

// ── Saved images ──────────────────────────────────────
function loadSaved() {
  chrome.storage.local.get(['screenshots'], (data) => {
    const list = document.getElementById('saved-list');
    const shots = data.screenshots || [];
    list.innerHTML = '';
    if (!shots.length) {
      list.innerHTML = '<div style="font-size:12px;color:#374151;text-align:center;padding:12px">保存済みなし</div>';
      return;
    }
    shots.slice(0).reverse().forEach((s, ri) => {
      const i = shots.length - 1 - ri;
      const div = document.createElement('div');
      div.className = 'saved-item';
      div.innerHTML = `
        <img class="saved-thumb" src="${s.thumb}" alt="">
        <div class="saved-info">
          <div class="saved-name">${new Date(s.time).toLocaleString('ja-JP')}</div>
        </div>
        <button class="saved-del" data-idx="${i}">×</button>
      `;
      div.addEventListener('click', (e) => { if (!e.target.classList.contains('saved-del')) openEditor(s.dataUrl); });
      div.querySelector('.saved-del').addEventListener('click', (e) => {
        e.stopPropagation();
        shots.splice(i, 1);
        chrome.storage.local.set({ screenshots: shots }, loadSaved);
      });
      list.appendChild(div);
    });
  });
}

loadSaved();
