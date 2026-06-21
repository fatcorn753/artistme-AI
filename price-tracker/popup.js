let trackedItems = [];
let selectedId   = null;

function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmtPrice(p) { return p != null ? '¥' + p.toLocaleString() : '—'; }
function fmtDate(ts)  { return ts ? new Date(ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

// ── Load & save ───────────────────────────────────────
async function load() {
  const d = await new Promise(r => chrome.storage.local.get(['trackedItems'], r));
  trackedItems = d.trackedItems || [];
}
function save() { chrome.storage.local.set({ trackedItems }); }

// ── Track current page ────────────────────────────────
document.getElementById('btn-track-page').addEventListener('click', async () => {
  const status = document.getElementById('scrape-status');
  status.className = 'scrape-status loading';
  status.textContent = '🔍 ページから価格を取得中...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('タブが取得できません');

    // Inject content script
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

    const info = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'scrapePrice' }, res => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    });

    if (!info) throw new Error('ページ情報の取得に失敗しました');

    // Check if already tracking
    if (trackedItems.some(i => i.url === info.url)) {
      status.className = 'scrape-status success';
      status.textContent = '✅ このページは既に追跡中です';
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const newItem = {
      id: uuid(),
      url: info.url,
      title: info.title || new URL(info.url).hostname,
      imageUrl: info.imageUrl || '',
      currentPrice: info.price,
      alertPrice: null,
      history: info.price ? [{ date: today, price: info.price }] : [],
      addedAt: Date.now(),
      lastChecked: Date.now(),
    };
    trackedItems.unshift(newItem);
    save();

    if (info.price) {
      status.className = 'scrape-status success';
      status.textContent = `✅ 追跡開始: ${info.title?.slice(0, 30)}…  ${fmtPrice(info.price)}`;
    } else {
      status.className = 'scrape-status error';
      status.textContent = `⚠ 追跡開始（価格未検出）: ${info.title?.slice(0, 40)}`;
    }
    renderItems();
  } catch (e) {
    status.className = 'scrape-status error';
    status.textContent = '❌ ' + e.message;
  }
});

// ── Render items list ─────────────────────────────────
function renderItems() {
  const list = document.getElementById('items-list');
  list.innerHTML = '';

  if (!trackedItems.length) {
    list.innerHTML = '<div class="empty-state">📭 追跡中の商品がありません<br><small>ECサイトのページを開いてボタンを押してください</small></div>';
    document.getElementById('footer-info').textContent = '';
    return;
  }

  document.getElementById('footer-info').textContent = `${trackedItems.length}件追跡中 | 1時間ごとに自動更新`;

  trackedItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card' + (item.id === selectedId ? ' selected' : '');

    const hist = item.history || [];
    const prevPrice = hist.length >= 2 ? hist[hist.length - 2].price : null;
    const chg = prevPrice && item.currentPrice ? item.currentPrice - prevPrice : null;
    const chgClass = chg == null ? 'same' : chg < 0 ? 'down' : chg > 0 ? 'up' : 'same';
    const chgText = chg == null ? '' : (chg < 0 ? `▼${fmtPrice(Math.abs(chg))}` : chg > 0 ? `▲${fmtPrice(chg)}` : '変化なし');

    card.innerHTML = `
      ${item.imageUrl ? `<img class="item-thumb" src="${item.imageUrl}" alt="" onerror="this.style.display='none'">` : '<div class="item-thumb"></div>'}
      <div class="item-info">
        <div class="item-title">${item.title}</div>
        <div class="item-price-row">
          ${item.currentPrice ? `<span class="item-price">${fmtPrice(item.currentPrice)}</span>` : '<span class="item-no-price">価格未検出</span>'}
          ${chgText ? `<span class="item-change ${chgClass}">${chgText}</span>` : ''}
          ${item.alertPrice ? `<span class="item-alert-badge">🔔 ${fmtPrice(item.alertPrice)}以下</span>` : ''}
        </div>
        <div class="item-last-check">最終確認: ${fmtDate(item.lastChecked)}</div>
      </div>
    `;
    card.addEventListener('click', () => { selectedId = item.id; renderItems(); showDetail(item); });
    list.appendChild(card);
  });
}

// ── Detail panel ──────────────────────────────────────
function showDetail(item) {
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('hidden');

  document.getElementById('detail-title').textContent = item.title;
  document.getElementById('detail-link').href = item.url;

  const hist = item.history || [];
  const prevPrice = hist.length >= 2 ? hist[hist.length - 2].price : null;
  const chg = prevPrice && item.currentPrice ? item.currentPrice - prevPrice : null;

  document.getElementById('detail-price').textContent  = fmtPrice(item.currentPrice);
  const chgEl = document.getElementById('detail-change');
  if (chg != null) {
    chgEl.textContent  = (chg < 0 ? '▼ ' : '▲ ') + fmtPrice(Math.abs(chg));
    chgEl.className    = 'price-change ' + (chg < 0 ? 'down' : 'up');
  } else { chgEl.textContent = ''; }

  document.getElementById('alert-price-input').value = item.alertPrice || '';

  // Stats
  const prices = hist.map(h => h.price).filter(Boolean);
  document.getElementById('detail-low').textContent  = `最安: ${prices.length ? fmtPrice(Math.min(...prices)) : '—'}`;
  document.getElementById('detail-high').textContent = `最高: ${prices.length ? fmtPrice(Math.max(...prices)) : '—'}`;
  const avg = prices.length ? Math.round(prices.reduce((a,b)=>a+b,0)/prices.length) : null;
  document.getElementById('detail-avg').textContent  = `平均: ${avg ? fmtPrice(avg) : '—'}`;

  drawPriceChart(item);
}

function drawPriceChart(item) {
  const canvas = document.getElementById('price-chart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 340, 100);
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 340, 100);

  const hist = (item.history || []).filter(h => h.price);
  if (hist.length < 2) {
    ctx.fillStyle = '#334155'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('価格履歴が不足しています', 170, 50); return;
  }

  const prices = hist.map(h => h.price);
  const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
  const pad = { l: 50, r: 10, t: 8, b: 22 };
  const W = 340 - pad.l - pad.r, H = 100 - pad.t - pad.b;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + H);
  grad.addColorStop(0, 'rgba(251,191,36,0.3)'); grad.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.beginPath();
  hist.forEach((h, i) => {
    const x = pad.l + i * W / (hist.length - 1);
    const y = pad.t + H - ((h.price - min) / range) * H;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.l + W, pad.t + H); ctx.lineTo(pad.l, pad.t + H); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  hist.forEach((h, i) => {
    const x = pad.l + i * W / (hist.length - 1);
    const y = pad.t + H - ((h.price - min) / range) * H;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.stroke();

  // Alert line
  if (item.alertPrice && item.alertPrice >= min && item.alertPrice <= max) {
    const ay = pad.t + H - ((item.alertPrice - min) / range) * H;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, ay); ctx.lineTo(pad.l + W, ay);
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#60a5fa'; ctx.font = '8px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('🔔', pad.l - 2, ay + 3);
  }

  // Y labels
  ctx.fillStyle = '#475569'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  [min, max].forEach(v => {
    const y = pad.t + H - ((v - min) / range) * H;
    ctx.fillText('¥' + v.toLocaleString(), pad.l - 3, y + 3);
  });

  // X labels (dates)
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(hist.length / 4));
  for (let i = 0; i < hist.length; i += step) {
    const x = pad.l + i * W / (hist.length - 1);
    ctx.fillText(hist[i].date.slice(5), x, pad.t + H + 14);
  }
}

// ── Alert & remove ────────────────────────────────────
document.getElementById('btn-set-alert').addEventListener('click', () => {
  if (!selectedId) return;
  const item = trackedItems.find(i => i.id === selectedId);
  if (!item) return;
  const val = parseFloat(document.getElementById('alert-price-input').value);
  item.alertPrice = isNaN(val) || val <= 0 ? null : val;
  save(); renderItems(); showDetail(item);
});

document.getElementById('btn-remove-item').addEventListener('click', () => {
  if (!selectedId) return;
  trackedItems = trackedItems.filter(i => i.id !== selectedId);
  selectedId = null;
  document.getElementById('detail-panel').classList.add('hidden');
  save(); renderItems();
});

document.getElementById('btn-close-detail').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
  selectedId = null; renderItems();
});

// ── Manual refresh for selected ───────────────────────
async function refreshItem(item) {
  try {
    const [tab] = await chrome.tabs.query({ url: item.url });
    if (tab) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const info = await new Promise(r => chrome.tabs.sendMessage(tab.id, { action: 'scrapePrice' }, r));
      if (info?.price) {
        item.currentPrice = info.price;
        const today = new Date().toISOString().split('T')[0];
        if (!item.history.some(h => h.date === today)) item.history.push({ date: today, price: info.price });
        item.lastChecked = Date.now();
        save(); renderItems();
        if (selectedId === item.id) showDetail(item);
      }
    }
  } catch {}
}

// ── Init ─────────────────────────────────────────────
load().then(renderItems);
