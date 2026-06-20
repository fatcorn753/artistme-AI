// Test endpoints — public CDN files for download, httpbin for upload/ping
const PING_URL    = 'https://cloudflare.com/cdn-cgi/trace';
const DOWN_URLS   = [
  'https://speed.cloudflare.com/__down?bytes=5000000',   // 5 MB
  'https://speed.cloudflare.com/__down?bytes=2000000',   // 2 MB fallback
];
const UP_URL      = 'https://speed.cloudflare.com/__up';

const canvas    = document.getElementById('gauge-canvas');
const ctx       = canvas.getContext('2d');
const speedVal  = document.getElementById('speed-value');
const speedUnit = document.getElementById('speed-unit');
const speedLbl  = document.getElementById('speed-label');
const pingVal   = document.getElementById('ping-val');
const downVal   = document.getElementById('down-val');
const upVal     = document.getElementById('up-val');
const startBtn  = document.getElementById('btn-start');
const statusMsg = document.getElementById('status-msg');
const histList  = document.getElementById('history-list');

let history = [];
let testing  = false;

// ── Gauge drawing ─────────────────────────────────────
function drawGauge(value, max = 1000) {
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H - 10;
  const r  = 110;
  const startAngle = Math.PI;        // 9 o'clock
  const endAngle   = 2 * Math.PI;   // 3 o'clock

  ctx.clearRect(0, 0, W, H);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = '#1e1e2e';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Color zones
  const zones = [
    { from: 0, to: 0.2, color: '#ef4444' },
    { from: 0.2, to: 0.5, color: '#f59e0b' },
    { from: 0.5, to: 1.0, color: '#22c55e' },
  ];
  zones.forEach(({ from, to, color }) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle + Math.PI * from, startAngle + Math.PI * to);
    ctx.strokeStyle = color + '44';
    ctx.lineWidth = 14;
    ctx.stroke();
  });

  // Progress arc
  if (value > 0) {
    const progress = Math.min(value / max, 1);
    const angle = startAngle + Math.PI * progress;
    const color = progress < 0.2 ? '#ef4444' : progress < 0.5 ? '#f59e0b' : '#22c55e';
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Needle
    const needleAngle = startAngle + Math.PI * progress;
    const nx = cx + (r - 18) * Math.cos(needleAngle);
    const ny = cy + (r - 18) * Math.sin(needleAngle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Scale labels
  ctx.fillStyle = '#374151';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const labels = [0, 100, 300, 500, 1000];
  labels.forEach(v => {
    const pct = v / max;
    const a = startAngle + Math.PI * pct;
    const lx = cx + (r + 14) * Math.cos(a);
    const ly = cy + (r + 14) * Math.sin(a);
    ctx.fillText(v >= 1000 ? '1G' : String(v), lx, ly);
  });
}

function setSpeed(val, label) {
  const formatted = val >= 1000 ? (val/1000).toFixed(2) : val.toFixed(1);
  const unit = val >= 1000 ? 'Gbps' : 'Mbps';
  speedVal.textContent = formatted;
  speedUnit.textContent = unit;
  speedLbl.textContent = label;
  drawGauge(val);
}

// ── Measurement functions ─────────────────────────────
async function measurePing() {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    try {
      await fetch(PING_URL + '?t=' + Date.now(), { cache: 'no-store', method: 'HEAD' });
    } catch {
      await fetch(PING_URL + '?t=' + Date.now(), { cache: 'no-store' }).catch(() => {});
    }
    times.push(performance.now() - t0);
  }
  times.sort((a,b) => a-b);
  return Math.round(times[1]); // 2nd lowest to avoid outlier
}

async function measureDownload() {
  const url = DOWN_URLS[0];
  const t0 = performance.now();
  let loaded = 0;

  try {
    const res = await fetch(url + '&t=' + Date.now(), { cache: 'no-store' });
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.length;
      const elapsed = (performance.now() - t0) / 1000;
      const mbps = (loaded * 8 / 1000000) / elapsed;
      setSpeed(mbps, 'ダウンロード中...');
      drawGauge(mbps);
    }
  } catch {
    // Fallback: time the fetch without streaming
    const t1 = performance.now();
    const res = await fetch(DOWN_URLS[1] + '&t=' + Date.now(), { cache: 'no-store' });
    const buf = await res.arrayBuffer();
    const elapsed = (performance.now() - t1) / 1000;
    return (buf.byteLength * 8 / 1000000) / elapsed;
  }

  const elapsed = (performance.now() - t0) / 1000;
  return (loaded * 8 / 1000000) / elapsed;
}

async function measureUpload() {
  const SIZE = 2 * 1024 * 1024; // 2MB
  const data = new Uint8Array(SIZE);
  crypto.getRandomValues(data);
  const blob = new Blob([data]);

  const t0 = performance.now();
  try {
    await fetch(UP_URL + '?t=' + Date.now(), {
      method: 'POST', body: blob, cache: 'no-store',
    });
  } catch {
    // estimate from time taken
  }
  const elapsed = (performance.now() - t0) / 1000;
  return (SIZE * 8 / 1000000) / elapsed;
}

// ── Run test ──────────────────────────────────────────
async function runTest() {
  if (testing) return;
  testing = true;
  startBtn.disabled = true;
  startBtn.textContent = '測定中...';
  startBtn.classList.add('testing');

  document.querySelectorAll('.metric').forEach(m => m.classList.remove('active'));
  pingVal.textContent = downVal.textContent = upVal.textContent = '—';
  setSpeed(0, '測定中...');

  try {
    // Ping
    statusMsg.textContent = 'レイテンシを測定中...';
    document.getElementById('m-ping').classList.add('active');
    const ping = await measurePing();
    pingVal.textContent = ping + ' ms';
    document.getElementById('m-ping').classList.remove('active');

    // Download
    statusMsg.textContent = 'ダウンロード速度を測定中...';
    document.getElementById('m-down').classList.add('active');
    const down = await measureDownload();
    downVal.textContent = down.toFixed(1) + ' Mbps';
    setSpeed(down, 'ダウンロード完了');
    document.getElementById('m-down').classList.remove('active');

    // Upload
    statusMsg.textContent = 'アップロード速度を測定中...';
    document.getElementById('m-up').classList.add('active');
    const up = await measureUpload();
    upVal.textContent = up.toFixed(1) + ' Mbps';
    setSpeed(up, 'アップロード完了');
    document.getElementById('m-up').classList.remove('active');

    statusMsg.textContent = `テスト完了 — ↓${down.toFixed(1)} ↑${up.toFixed(1)} Mbps / ping: ${ping}ms`;

    // Save history
    const result = { time: Date.now(), ping, down: +down.toFixed(1), up: +up.toFixed(1) };
    history.unshift(result);
    if (history.length > 10) history.pop();
    chrome.storage.local.set({ speedHistory: history });
    renderHistory();

  } catch(e) {
    statusMsg.textContent = '❌ 測定エラー: ' + e.message;
  }

  testing = false;
  startBtn.disabled = false;
  startBtn.textContent = 'もう一度テスト';
  startBtn.classList.remove('testing');
}

// ── History ───────────────────────────────────────────
function renderHistory() {
  histList.innerHTML = '';
  if (!history.length) {
    histList.innerHTML = '<div style="color:#374151;font-size:11px;padding:6px">履歴なし</div>';
    return;
  }
  history.forEach(h => {
    const t = new Date(h.time).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
    const div = document.createElement('div');
    div.className = 'hist-item';
    div.innerHTML = `
      <span class="hist-time">${t}</span>
      <span class="hist-ping">📶 ${h.ping}ms</span>
      <span class="hist-down">↓${h.down}</span>
      <span class="hist-up">↑${h.up}</span>
    `;
    histList.appendChild(div);
  });
}

startBtn.addEventListener('click', runTest);

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['speedHistory'], (data) => {
  history = data.speedHistory || [];
  drawGauge(0);
  renderHistory();
});
