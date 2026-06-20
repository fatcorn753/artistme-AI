const COLORS_PALETTE = ['#38bdf8','#4ade80','#f59e0b','#f87171','#a78bfa','#34d399','#fb923c','#60a5fa'];
const PRODUCTIVE_CATS = { productive: '#4ade80', neutral: '#94a3b8', distraction: '#f87171' };

let currentDate = new Date().toISOString().split('T')[0];
let trackingData = {}, limits = {}, categories = {};

function dateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date().toISOString().split('T')[0];
  const yest  = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return '今日';
  if (dateStr === yest)  return '昨日';
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

function fmtSecs(s) {
  if (s < 60)   return s + '秒';
  if (s < 3600) return Math.floor(s/60) + '分';
  return Math.floor(s/3600) + 'h' + Math.floor((s%3600)/60) + 'm';
}

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    if (tab.dataset.tab === 'week') renderWeek();
    if (tab.dataset.tab === 'limits') renderLimits();
    if (tab.dataset.tab === 'productivity') renderProductivity();
  });
});

// ── Date nav ──────────────────────────────────────────
document.getElementById('btn-prev-day').addEventListener('click', () => {
  const d = new Date(currentDate); d.setDate(d.getDate() - 1);
  currentDate = d.toISOString().split('T')[0];
  document.getElementById('date-label').textContent = dateLabel(currentDate);
  document.getElementById('btn-next-day').disabled = currentDate >= new Date().toISOString().split('T')[0];
  renderToday();
});
document.getElementById('btn-next-day').addEventListener('click', () => {
  const d = new Date(currentDate); d.setDate(d.getDate() + 1);
  const next = d.toISOString().split('T')[0];
  if (next > new Date().toISOString().split('T')[0]) return;
  currentDate = next;
  document.getElementById('date-label').textContent = dateLabel(currentDate);
  renderToday();
});

// ── Render Today ──────────────────────────────────────
function renderToday() {
  const dayData = trackingData[currentDate] || {};
  const entries = Object.entries(dayData).sort((a,b) => b[1]-a[1]);
  const total   = entries.reduce((s,[,v]) => s+v, 0);

  document.getElementById('total-time').textContent = fmtSecs(total);

  // Bar chart (top 5)
  const barChart = document.getElementById('time-bar-chart');
  barChart.innerHTML = '';
  entries.slice(0, 5).forEach(([host, secs], i) => {
    const pct = total > 0 ? secs/total*100 : 0;
    const color = COLORS_PALETTE[i % COLORS_PALETTE.length];
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.innerHTML = `
      <div class="chart-host" title="${host}">${host}</div>
      <div class="chart-bar-wrap"><div class="chart-bar" style="width:${pct}%;background:${color}"></div></div>
      <div class="chart-time">${fmtSecs(secs)}</div>
    `;
    barChart.appendChild(row);
  });

  // Site list
  const siteList = document.getElementById('site-list');
  siteList.innerHTML = '';
  if (!entries.length) {
    siteList.innerHTML = '<div class="empty">この日の記録がありません</div>';
    return;
  }
  entries.forEach(([host, secs], i) => {
    const color = COLORS_PALETTE[i % COLORS_PALETTE.length];
    const pct   = total > 0 ? Math.round(secs/total*100) : 0;
    const limit = limits[host];
    const limitPct = limit ? Math.min(100, secs / (limit*60) * 100) : null;
    const limitColor = limitPct >= 100 ? '#f87171' : limitPct >= 80 ? '#f59e0b' : '#38bdf8';

    const row = document.createElement('div');
    row.className = 'site-row';
    row.innerHTML = `
      <img class="site-favicon" src="https://www.google.com/s2/favicons?domain=${host}&sz=16" alt="" onerror="this.style.display='none'">
      <div class="site-host">${host}</div>
      <div class="site-time">${fmtSecs(secs)}</div>
      <div class="site-pct">${pct}%</div>
      ${limit ? `<div class="site-limit-bar"><div class="site-limit-fill" style="width:${limitPct}%;background:${limitColor}"></div></div>` : ''}
    `;
    siteList.appendChild(row);
  });
}

// ── Render Week ───────────────────────────────────────
function renderWeek() {
  const canvas = document.getElementById('week-chart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const dailyTotals = days.map(d => {
    const dayData = trackingData[d] || {};
    return Object.values(dayData).reduce((s,v) => s+v, 0);
  });

  const maxVal = Math.max(...dailyTotals, 1);
  const W = canvas.width, H = canvas.height;
  const pad = { l: 40, r: 10, t: 10, b: 30 };
  const barW = (W - pad.l - pad.r) / 7;

  // Grid lines
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (H - pad.t - pad.b) * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W-pad.r, y); ctx.stroke();
    ctx.fillStyle = '#334155'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    ctx.fillText(fmtSecs(maxVal * (4-i) / 4), pad.l - 3, y + 3);
  }

  // Bars
  days.forEach((day, i) => {
    const val = dailyTotals[i];
    const bh  = (H - pad.t - pad.b) * val / maxVal;
    const bx  = pad.l + i * barW + barW * 0.1;
    const bw  = barW * 0.8;
    const by  = H - pad.b - bh;
    const isToday = day === new Date().toISOString().split('T')[0];

    ctx.fillStyle = isToday ? '#38bdf8' : '#1e3a5f';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 3);
    ctx.fill();

    // Day label
    const d = new Date(day + 'T00:00:00');
    const label = ['日','月','火','水','木','金','土'][d.getDay()];
    ctx.fillStyle = isToday ? '#38bdf8' : '#334155';
    ctx.font = isToday ? 'bold 10px sans-serif' : '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, bx + bw/2, H - pad.b + 14);
  });

  // Week stats
  const avgSecs = dailyTotals.reduce((s,v)=>s+v,0) / 7;
  const maxDay  = days[dailyTotals.indexOf(Math.max(...dailyTotals))];
  const statsEl = document.getElementById('week-stats');
  statsEl.innerHTML = `
    <div class="week-stat"><div class="ws-label">週平均</div><div class="ws-val">${fmtSecs(Math.round(avgSecs))}</div></div>
    <div class="week-stat"><div class="ws-label">最多日</div><div class="ws-val">${dateLabel(maxDay)}</div></div>
    <div class="week-stat"><div class="ws-label">週合計</div><div class="ws-val">${fmtSecs(dailyTotals.reduce((s,v)=>s+v,0))}</div></div>
    <div class="week-stat"><div class="ws-label">計測日数</div><div class="ws-val">${dailyTotals.filter(v=>v>0).length}日</div></div>
  `;
}

// ── Limits ────────────────────────────────────────────
function renderLimits() {
  const list = document.getElementById('limit-list');
  list.innerHTML = '';
  const entries = Object.entries(limits);
  if (!entries.length) { list.innerHTML = '<div class="empty">上限設定なし</div>'; return; }
  entries.forEach(([host, mins]) => {
    const div = document.createElement('div');
    div.className = 'limit-item';
    div.innerHTML = `<span class="limit-host">${host}</span><span class="limit-min">${mins}分/日</span><button class="limit-del" data-h="${host}">×</button>`;
    div.querySelector('.limit-del').addEventListener('click', () => {
      delete limits[host]; chrome.storage.local.set({ limits }); renderLimits();
    });
    list.appendChild(div);
  });
}

document.getElementById('btn-add-limit').addEventListener('click', () => {
  const host = document.getElementById('limit-host').value.trim().replace(/^https?:\/\//, '').split('/')[0];
  const mins = parseInt(document.getElementById('limit-mins').value);
  if (!host || isNaN(mins) || mins < 1) return;
  limits[host] = mins;
  chrome.storage.local.set({ limits });
  document.getElementById('limit-host').value = '';
  document.getElementById('limit-mins').value = '';
  renderLimits();
});

// ── Productivity Score ────────────────────────────────
function renderProductivity() {
  const dayData = trackingData[currentDate] || {};
  const entries = Object.entries(dayData).sort((a,b) => b[1]-a[1]);
  const total   = entries.reduce((s,[,v]) => s+v, 0);

  let productive = 0, distraction = 0;
  entries.forEach(([host, secs]) => {
    const cat = categories[host] || 'neutral';
    if (cat === 'productive') productive += secs;
    if (cat === 'distraction') distraction += secs;
  });

  const score = total > 0 ? Math.round((productive / total * 100) - (distraction / total * 50)) : null;
  const clamped = score !== null ? Math.max(0, Math.min(100, score + 50)) : null;

  // Draw score circle
  const canvas = document.getElementById('score-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 140, 140);
  const cx = 70, cy = 70, r = 54;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 12; ctx.stroke();
  if (clamped !== null) {
    const color = clamped >= 70 ? '#4ade80' : clamped >= 40 ? '#f59e0b' : '#f87171';
    ctx.beginPath();
    ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2 + Math.PI*2*clamped/100);
    ctx.strokeStyle = color; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke();
  }

  const scoreEl = document.getElementById('score-val');
  scoreEl.textContent = clamped !== null ? clamped : '—';

  // Category list
  const catList = document.getElementById('cat-site-list');
  catList.innerHTML = '';
  if (!entries.length) { catList.innerHTML = '<div class="empty">データなし</div>'; return; }
  entries.slice(0, 15).forEach(([host]) => {
    const cat = categories[host] || 'neutral';
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <span class="cat-host">${host}</span>
      <select class="cat-sel" data-host="${host}">
        <option value="productive" ${cat==='productive'?'selected':''}>✅ 生産的</option>
        <option value="neutral"    ${cat==='neutral'   ?'selected':''}>⚪ 中立</option>
        <option value="distraction"${cat==='distraction'?'selected':''}>❌ 気晴らし</option>
      </select>
    `;
    row.querySelector('select').addEventListener('change', e => {
      categories[host] = e.target.value;
      chrome.storage.local.set({ categories });
      renderProductivity();
    });
    catList.appendChild(row);
  });
}

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['trackingData','limits','categories'], d => {
  trackingData = d.trackingData || {};
  limits       = d.limits       || {};
  categories   = d.categories   || {};
  document.getElementById('date-label').textContent = dateLabel(currentDate);
  renderToday();

  // Auto-refresh every 5s
  setInterval(() => {
    chrome.storage.local.get(['trackingData'], nd => {
      trackingData = nd.trackingData || {};
      const tab = document.querySelector('.tab.active')?.dataset?.tab;
      if (tab === 'today') renderToday();
    });
  }, 5000);
});
