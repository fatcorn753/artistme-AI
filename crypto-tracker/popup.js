// Known coins with emoji icons
const COIN_ICONS = {
  bitcoin:'₿', ethereum:'Ξ', solana:'◎', cardano:'₳', ripple:'✕', dogecoin:'Ð',
  polkadot:'⬡', chainlink:'⬡', litecoin:'Ł', 'bitcoin-cash':'₿', stellar:'✦',
  uniswap:'🦄', avalanche:'🔺', polygon:'🔷', cosmos:'⚛', monero:'ɱ',
  'shiba-inu':'🐕', tron:'TRX', toncoin:'💎', 'near-protocol':'🔵',
};

const DEFAULT_COINS = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
];

let watchlist = [];
let prices = {};
let holdings = [];
let alerts = [];
let currency = 'jpy';
let priceHistory = {};  // id → last 7 price points

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    if (tab.dataset.tab === 'portfolio') renderPortfolio();
    if (tab.dataset.tab === 'alerts') renderAlerts();
  });
});

// ── Currency ──────────────────────────────────────────
document.getElementById('currency-sel').addEventListener('change', e => {
  currency = e.target.value;
  chrome.storage.local.set({ currency });
  renderPrices();
  renderPortfolio();
});

// ── Format helpers ────────────────────────────────────
function fmtPrice(v, cur) {
  if (!v) return '—';
  const sym = cur === 'jpy' ? '¥' : '$';
  if (v >= 1000000) return sym + (v/1000000).toFixed(2) + 'M';
  if (v >= 1000)    return sym + v.toLocaleString('ja-JP', {maximumFractionDigits: 0});
  if (v >= 1)       return sym + v.toFixed(2);
  return sym + v.toFixed(6);
}

function fmtChange(c) {
  if (c == null) return '';
  const sign = c >= 0 ? '+' : '';
  return sign + c.toFixed(2) + '%';
}

// ── Fetch prices ──────────────────────────────────────
async function fetchPrices() {
  const ids = watchlist.map(c => c.id).join(',');
  if (!ids) return;
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spin');
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=jpy,usd&include_24hr_change=true&include_market_cap=true&include_7d_change=true`
    );
    prices = await res.json();

    // Record history for sparkline
    watchlist.forEach(c => {
      if (!priceHistory[c.id]) priceHistory[c.id] = [];
      if (prices[c.id]) {
        priceHistory[c.id].push(prices[c.id][currency]);
        if (priceHistory[c.id].length > 20) priceHistory[c.id].shift();
      }
    });

    chrome.storage.local.set({ prices, priceHistory, lastUpdate: Date.now() });
    renderPrices();
    document.getElementById('last-update').textContent = '更新: ' + new Date().toLocaleTimeString('ja-JP');
  } catch (e) {
    document.getElementById('last-update').textContent = '取得エラー';
  }
  btn.classList.remove('spin');
}

// ── Render prices ─────────────────────────────────────
function renderPrices() {
  const list = document.getElementById('coin-list');
  list.innerHTML = '';
  if (!watchlist.length) {
    list.innerHTML = '<div class="empty">コインを検索して追加してください</div>';
    return;
  }
  watchlist.forEach(coin => {
    const p = prices[coin.id];
    const price = p?.[currency];
    const change24 = p?.[`${currency}_24h_change`];
    const icon = COIN_ICONS[coin.id] || '🪙';
    const history = priceHistory[coin.id] || [];

    const row = document.createElement('div');
    row.className = 'coin-row';

    // Sparkline SVG
    const spark = history.length >= 2 ? buildSparkline(history, change24 >= 0) : '';

    row.innerHTML = `
      <div class="coin-icon">${icon}</div>
      <div class="coin-info">
        <div class="coin-name">${coin.name}</div>
        <div class="coin-symbol">${coin.symbol}</div>
      </div>
      ${spark}
      <div class="coin-price-col">
        <div class="coin-price">${fmtPrice(price, currency)}</div>
        <div class="coin-change ${change24 >= 0 ? 'pos' : 'neg'}">${fmtChange(change24)}</div>
      </div>
      <button class="coin-del" data-id="${coin.id}">×</button>
    `;

    row.querySelector('.coin-del').addEventListener('click', e => {
      e.stopPropagation();
      watchlist = watchlist.filter(c => c.id !== coin.id);
      chrome.storage.local.set({ watchlist });
      renderPrices();
      populateAlertCoinSelect();
    });

    list.appendChild(row);
  });
}

function buildSparkline(data, positive) {
  const w = 60, h = 30;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const color = positive ? '#4ade80' : '#f87171';
  return `<svg class="coin-chart" viewBox="0 0 ${w} ${h}">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

// ── Add coin ──────────────────────────────────────────
document.getElementById('btn-add-coin').addEventListener('click', addCoin);
document.getElementById('coin-search').addEventListener('keydown', e => { if (e.key === 'Enter') addCoin(); });

async function addCoin() {
  const query = document.getElementById('coin-search').value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!query) return;
  if (watchlist.some(c => c.id === query || c.symbol.toLowerCase() === query)) {
    document.getElementById('coin-search').value = '';
    return;
  }
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${query}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    watchlist.push({ id: data.id, name: data.name, symbol: data.symbol.toUpperCase() });
    chrome.storage.local.set({ watchlist });
    document.getElementById('coin-search').value = '';
    await fetchPrices();
    populateAlertCoinSelect();
  } catch {
    document.getElementById('coin-search').style.borderColor = '#f87171';
    setTimeout(() => document.getElementById('coin-search').style.borderColor = '', 1500);
  }
}

// ── Portfolio ─────────────────────────────────────────
function renderPortfolio() {
  let total = 0, totalChange = 0;
  const list = document.getElementById('portfolio-list');
  list.innerHTML = '';

  if (!holdings.length) {
    list.innerHTML = '<div class="empty">保有量を追加してください</div>';
    document.getElementById('portfolio-total').textContent = fmtPrice(0, currency);
    return;
  }

  holdings.forEach((h, i) => {
    const p = prices[h.coinId]?.[currency];
    const value = p ? p * h.amount : 0;
    const change = prices[h.coinId]?.[`${currency}_24h_change`];
    total += value;
    if (change) totalChange += (value * change / 100);

    const row = document.createElement('div');
    row.className = 'holding-row';
    row.innerHTML = `
      <div style="flex:1">
        <div class="holding-name">${h.coinName} (${h.coinSymbol})</div>
        <div class="holding-amount">${h.amount} ${h.coinSymbol}</div>
      </div>
      <div class="holding-value">${fmtPrice(value, currency)}</div>
      <button class="holding-del" data-i="${i}">×</button>
    `;
    row.querySelector('.holding-del').addEventListener('click', () => {
      holdings.splice(i, 1);
      chrome.storage.local.set({ holdings });
      renderPortfolio();
    });
    list.appendChild(row);
  });

  document.getElementById('portfolio-total').textContent = fmtPrice(total, currency);
  const pct = total > 0 ? (totalChange / (total - totalChange) * 100) : 0;
  const changeEl = document.getElementById('portfolio-change');
  changeEl.textContent = fmtChange(pct) + ' (24h)';
  changeEl.className = 'total-change ' + (pct >= 0 ? 'pos' : 'neg');
}

document.getElementById('btn-add-holding').addEventListener('click', () => {
  if (!watchlist.length) { alert('まずコインを追加してください'); return; }
  const coin = watchlist[0];
  const coinId = prompt('コインID (例: bitcoin):', coin.id);
  const found = watchlist.find(c => c.id === coinId);
  if (!found) { alert('ウォッチリストにないコインです'); return; }
  const amount = parseFloat(prompt('保有量:', '0.1'));
  if (isNaN(amount) || amount <= 0) return;
  holdings.push({ coinId: found.id, coinName: found.name, coinSymbol: found.symbol, amount });
  chrome.storage.local.set({ holdings });
  renderPortfolio();
});

// ── Alerts ────────────────────────────────────────────
function populateAlertCoinSelect() {
  const sel = document.getElementById('alert-coin');
  sel.innerHTML = watchlist.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function renderAlerts() {
  const list = document.getElementById('alert-list');
  list.innerHTML = '';
  if (!alerts.length) { list.innerHTML = '<div class="empty">アラートなし</div>'; return; }
  alerts.forEach((a, i) => {
    const item = document.createElement('div');
    item.className = 'alert-item' + (a.triggered ? ' triggered' : '');
    const sym = currency === 'jpy' ? '¥' : '$';
    item.innerHTML = `
      <div class="alert-item-text">
        ${a.coinName}: ${a.direction === 'above' ? '↑' : '↓'} ${sym}${a.target.toLocaleString()}
        ${a.triggered ? ' ✅' : ''}
      </div>
      <button class="alert-del" data-i="${i}">×</button>
    `;
    item.querySelector('.alert-del').addEventListener('click', () => {
      alerts.splice(i, 1);
      chrome.storage.local.set({ alerts });
      renderAlerts();
    });
    list.appendChild(item);
  });
}

document.getElementById('btn-add-alert').addEventListener('click', () => {
  const coinId = document.getElementById('alert-coin').value;
  const coin = watchlist.find(c => c.id === coinId);
  if (!coin) return;
  const dir = document.getElementById('alert-dir').value;
  const target = parseFloat(document.getElementById('alert-price').value);
  if (isNaN(target) || target <= 0) return;
  alerts.push({ coinId, coinName: coin.name, currency, direction: dir, target, triggered: false });
  chrome.storage.local.set({ alerts });
  document.getElementById('alert-price').value = '';
  renderAlerts();
});

// ── Refresh button ────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click', fetchPrices);

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['watchlist','prices','priceHistory','holdings','alerts','currency','lastUpdate'], d => {
  watchlist    = d.watchlist    || DEFAULT_COINS;
  prices       = d.prices       || {};
  priceHistory = d.priceHistory || {};
  holdings     = d.holdings     || [];
  alerts       = d.alerts       || [];
  currency     = d.currency     || 'jpy';
  document.getElementById('currency-sel').value = currency;
  if (d.lastUpdate) {
    document.getElementById('last-update').textContent = '更新: ' + new Date(d.lastUpdate).toLocaleTimeString('ja-JP');
  }
  renderPrices();
  populateAlertCoinSelect();
  fetchPrices();
});
