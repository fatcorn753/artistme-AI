const dropZone    = document.getElementById('drop-zone');
const fileInput   = document.getElementById('file-input');
const previewCanvas = document.getElementById('preview-canvas');
const loadingEl   = document.getElementById('loading');
const errorEl     = document.getElementById('error-msg');
const paletteSection = document.getElementById('palette-section');
const paletteEl   = document.getElementById('palette');

// ── Color name lookup (basic) ─────────────────────────
const COLOR_NAMES = [
  [0,0,0,'ブラック'],[255,255,255,'ホワイト'],[255,0,0,'レッド'],[0,255,0,'ライム'],
  [0,0,255,'ブルー'],[255,255,0,'イエロー'],[0,255,255,'シアン'],[255,0,255,'マゼンタ'],
  [192,192,192,'シルバー'],[128,128,128,'グレー'],[128,0,0,'マルーン'],[128,128,0,'オリーブ'],
  [0,128,0,'グリーン'],[128,0,128,'パープル'],[0,128,128,'ティール'],[0,0,128,'ネイビー'],
  [255,165,0,'オレンジ'],[255,192,203,'ピンク'],[165,42,42,'ブラウン'],[240,230,140,'カーキ'],
  [255,215,0,'ゴールド'],[220,20,60,'クリムゾン'],[100,149,237,'コーンフラワーブルー'],
  [144,238,144,'ライトグリーン'],[135,206,235,'スカイブルー'],[255,99,71,'トマト'],
  [72,61,139,'ダークスレートブルー'],[255,140,0,'ダークオレンジ'],[46,139,87,'シーグリーン'],
];

function nearestColorName(r, g, b) {
  let best = ''; let bestDist = Infinity;
  for (const [cr, cg, cb, name] of COLOR_NAMES) {
    const d = (r-cr)**2 + (g-cg)**2 + (b-cb)**2;
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

// ── k-means color quantization ────────────────────────
function extractColors(imageData, k) {
  const data = imageData.data;
  const pixels = [];

  // Sample pixels (skip transparent)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] < 128) continue;
    pixels.push([data[i], data[i+1], data[i+2]]);
  }

  if (pixels.length === 0) return [];

  // Initialize centroids randomly from pixels
  const shuffled = [...pixels].sort(() => Math.random() - 0.5);
  let centroids = shuffled.slice(0, k).map(p => [...p]);

  for (let iter = 0; iter < 20; iter++) {
    // Assign pixels to nearest centroid
    const clusters = Array.from({ length: k }, () => []);
    for (const px of pixels) {
      let best = 0, bestDist = Infinity;
      for (let j = 0; j < centroids.length; j++) {
        const d = (px[0]-centroids[j][0])**2 + (px[1]-centroids[j][1])**2 + (px[2]-centroids[j][2])**2;
        if (d < bestDist) { bestDist = d; best = j; }
      }
      clusters[best].push(px);
    }

    // Update centroids
    let changed = false;
    for (let j = 0; j < k; j++) {
      if (clusters[j].length === 0) continue;
      const nr = Math.round(clusters[j].reduce((s,p) => s+p[0], 0) / clusters[j].length);
      const ng = Math.round(clusters[j].reduce((s,p) => s+p[1], 0) / clusters[j].length);
      const nb = Math.round(clusters[j].reduce((s,p) => s+p[2], 0) / clusters[j].length);
      if (nr !== centroids[j][0] || ng !== centroids[j][1] || nb !== centroids[j][2]) changed = true;
      centroids[j] = [nr, ng, nb];
    }

    if (!changed) break;
  }

  // Calculate percentages
  const total = pixels.length;
  const counts = Array(k).fill(0);
  for (const px of pixels) {
    let best = 0, bestDist = Infinity;
    for (let j = 0; j < centroids.length; j++) {
      const d = (px[0]-centroids[j][0])**2 + (px[1]-centroids[j][1])**2 + (px[2]-centroids[j][2])**2;
      if (d < bestDist) { bestDist = d; best = j; }
    }
    counts[best]++;
  }

  return centroids.map((c, i) => ({
    r: c[0], g: c[1], b: c[2],
    pct: Math.round(counts[i] / total * 100),
    hex: '#' + [c[0],c[1],c[2]].map(v => v.toString(16).padStart(2,'0').toUpperCase()).join(''),
    lum: 0.299*c[0] + 0.587*c[1] + 0.114*c[2],
  })).filter(c => c.pct > 0).sort((a,b) => b.pct - a.pct);
}

// ── Render palette ────────────────────────────────────
function renderPalette(colors) {
  const sortLum = document.getElementById('sort-luminance').checked;
  const showNames = document.getElementById('show-names').checked;
  const list = sortLum ? [...colors].sort((a,b) => b.lum - a.lum) : colors;

  paletteEl.innerHTML = '';
  list.forEach(c => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.title = 'クリックでHEXをコピー';
    swatch.innerHTML = `
      <div class="swatch-color" style="background:${c.hex}"></div>
      <div class="swatch-info">
        <div class="swatch-hex">${c.hex}</div>
        <div class="swatch-rgb">${c.r}, ${c.g}, ${c.b}</div>
        <div class="swatch-pct">${c.pct}%</div>
        ${showNames ? `<div class="swatch-name">${nearestColorName(c.r,c.g,c.b)}</div>` : ''}
      </div>
    `;
    swatch.addEventListener('click', () => {
      navigator.clipboard.writeText(c.hex);
      swatch.classList.add('copied');
      setTimeout(() => swatch.classList.remove('copied'), 1000);
    });
    paletteEl.appendChild(swatch);
  });

  document.getElementById('palette-title').textContent = `${list.length}色抽出`;
  paletteSection.classList.remove('hidden');
}

let lastColors = [];

function processImage(img) {
  // Draw to canvas for sampling
  const MAX = 150;
  const scale = Math.min(1, MAX / img.width, MAX / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const offscreen = document.createElement('canvas');
  offscreen.width = w; offscreen.height = h;
  const ctx = offscreen.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  // Show preview
  const pw = Math.min(img.width, 372);
  const ph = Math.round(img.height * pw / img.width);
  previewCanvas.width = pw; previewCanvas.height = ph;
  previewCanvas.getContext('2d').drawImage(img, 0, 0, pw, ph);
  previewCanvas.classList.remove('hidden');

  // Extract
  const k = parseInt(document.getElementById('color-count').value);
  const imageData = ctx.getImageData(0, 0, w, h);
  lastColors = extractColors(imageData, k);
  renderPalette(lastColors);
  loadingEl.classList.add('hidden');
}

function loadFromFile(file) {
  if (!file?.type.startsWith('image/')) { showError('画像ファイルを選択してください'); return; }
  setLoading(true);
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => processImage(img);
    img.onerror = () => showError('画像を読み込めませんでした');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function loadFromUrl(url) {
  if (!url.trim()) return;
  setLoading(true);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => processImage(img);
  img.onerror = () => showError('画像を読み込めませんでした（CORS制限の可能性があります）');
  img.src = url.trim();
}

function setLoading(v) {
  loadingEl.classList.toggle('hidden', !v);
  if (v) { errorEl.classList.add('hidden'); paletteSection.classList.add('hidden'); }
}
function showError(msg) {
  loadingEl.classList.add('hidden');
  errorEl.textContent = '❌ ' + msg;
  errorEl.classList.remove('hidden');
}

// ── Events ────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
document.getElementById('btn-file').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', e => loadFromFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFromFile(file);
  else {
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url) loadFromUrl(url);
  }
});

document.getElementById('btn-url').addEventListener('click', () => loadFromUrl(document.getElementById('url-input').value));
document.getElementById('url-input').addEventListener('keydown', e => { if (e.key === 'Enter') loadFromUrl(e.target.value); });

['color-count','sort-luminance','show-names'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { if (lastColors.length) renderPalette(lastColors); });
});

document.getElementById('btn-copy-all').addEventListener('click', function() {
  const text = lastColors.map(c => c.hex).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    this.textContent = '✓ コピー済み'; this.classList.add('copied');
    setTimeout(() => { this.textContent = '全コピー'; this.classList.remove('copied'); }, 1500);
  });
});

document.getElementById('btn-export-css').addEventListener('click', function() {
  const css = ':root {\n' + lastColors.map((c,i) => `  --color-${i+1}: ${c.hex};`).join('\n') + '\n}';
  navigator.clipboard.writeText(css).then(() => {
    this.textContent = '✓ コピー済み'; this.classList.add('copied');
    setTimeout(() => { this.textContent = 'CSS変数'; this.classList.remove('copied'); }, 1500);
  });
});
