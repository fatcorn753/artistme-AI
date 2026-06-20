const CURRENCIES = [
  'USD','EUR','JPY','GBP','AUD','CAD','CHF','CNY','HKD','NZD',
  'SEK','KRW','SGD','NOK','MXN','INR','RUB','ZAR','BRL','THB',
  'TWD','DKK','PLN','IDR','HUF','CZK','ILS','CLP','PHP','MYR',
  'AED','TRY','SAR','VND','PKR',
];

const CURRENCY_NAMES = {
  USD:'米ドル', EUR:'ユーロ', JPY:'日本円', GBP:'英ポンド',
  AUD:'豪ドル', CAD:'カナダドル', CHF:'スイスフラン', CNY:'人民元',
  HKD:'香港ドル', NZD:'NZドル', SEK:'スウェーデンクローナ',
  KRW:'韓国ウォン', SGD:'シンガポールドル', NOK:'ノルウェークローネ',
  MXN:'メキシコペソ', INR:'インドルピー', RUB:'ロシアルーブル',
  ZAR:'南アフリカランド', BRL:'ブラジルレアル', THB:'タイバーツ',
  TWD:'台湾ドル', DKK:'デンマーククローネ', PLN:'ポーランドズロチ',
  IDR:'インドネシアルピア', AED:'UAEディルハム', TRY:'トルコリラ',
};

const FEATURED = ['USD','EUR','GBP','CNY','KRW','AUD','CHF','HKD'];

let rates = null; // base=USD rates object
let lastUpdated = null;

const fromAmtEl  = document.getElementById('amount-from');
const toAmtEl    = document.getElementById('amount-to');
const fromSelEl  = document.getElementById('from-currency');
const toSelEl    = document.getElementById('to-currency');
const rateInfoEl = document.getElementById('rate-info');
const ratesGrid  = document.getElementById('rates-grid');
const loadingEl  = document.getElementById('loading');
const errorEl    = document.getElementById('error-msg');

// ── Populate selects ──────────────────────────────────
CURRENCIES.forEach(c => {
  [fromSelEl, toSelEl].forEach(sel => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    opt.title = CURRENCY_NAMES[c] || c;
    sel.appendChild(opt);
  });
});
fromSelEl.value = 'USD';
toSelEl.value   = 'JPY';

// ── Fetch rates from Frankfurter (free, no key) ───────
async function fetchRates() {
  // Frankfurter API returns rates relative to base currency
  const res = await fetch('https://api.frankfurter.app/latest?base=USD');
  if (!res.ok) throw new Error('レート取得失敗 (HTTP ' + res.status + ')');
  const data = await res.json();
  data.rates['USD'] = 1; // base
  return { rates: data.rates, date: data.date };
}

async function refreshRates(force = false) {
  // Cache for 1 hour
  const cached = await new Promise(r => chrome.storage.local.get(['fxRates','fxDate','fxTime'], r));
  const now = Date.now();

  if (!force && cached.fxRates && cached.fxTime && (now - cached.fxTime) < 3600000) {
    rates = cached.fxRates;
    lastUpdated = cached.fxDate;
    return;
  }

  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  try {
    const { rates: r, date } = await fetchRates();
    rates = r;
    lastUpdated = date;
    chrome.storage.local.set({ fxRates: r, fxDate: date, fxTime: now });
  } catch (e) {
    if (cached.fxRates) {
      rates = cached.fxRates;
      lastUpdated = cached.fxDate + ' (キャッシュ)';
    } else {
      errorEl.textContent = '❌ ' + e.message;
      errorEl.classList.remove('hidden');
    }
  }
  loadingEl.classList.add('hidden');
}

// ── Conversion ────────────────────────────────────────
function convert(amount, from, to) {
  if (!rates) return null;
  const rFrom = rates[from]; // rate vs USD
  const rTo   = rates[to];
  if (!rFrom || !rTo) return null;
  return amount / rFrom * rTo;
}

function fmtRate(v, to) {
  if (v === null || isNaN(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toLocaleString('en', { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 1)    return v.toFixed(4);
  return v.toPrecision(4);
}

function updateConversion() {
  const amt  = parseFloat(fromAmtEl.value) || 0;
  const from = fromSelEl.value;
  const to   = toSelEl.value;
  const result = convert(amt, from, to);
  toAmtEl.value = result !== null ? fmtRate(result, to) : '—';

  if (rates) {
    const rate = convert(1, from, to);
    rateInfoEl.textContent = rate !== null
      ? `1 ${from} = ${fmtRate(rate, to)} ${to}  ·  ${lastUpdated || ''}`
      : lastUpdated || '';
  }

  updateFeatured();
}

function updateFeatured() {
  const amt  = parseFloat(fromAmtEl.value) || 1;
  const from = fromSelEl.value;
  ratesGrid.innerHTML = '';
  FEATURED.filter(c => c !== from).forEach(c => {
    const v = convert(amt, from, c);
    const div = document.createElement('div');
    div.className = 'rate-item';
    div.innerHTML = `<span class="rate-code">${c}</span><span class="rate-value">${fmtRate(v, c)}</span>`;
    div.addEventListener('click', () => {
      toSelEl.value = c; updateConversion();
    });
    ratesGrid.appendChild(div);
  });
}

// ── Events ────────────────────────────────────────────
fromAmtEl.addEventListener('input', updateConversion);
fromSelEl.addEventListener('change', updateConversion);
toSelEl.addEventListener('change', updateConversion);

document.getElementById('btn-swap').addEventListener('click', () => {
  [fromSelEl.value, toSelEl.value] = [toSelEl.value, fromSelEl.value];
  updateConversion();
});

document.getElementById('btn-refresh').addEventListener('click', async () => {
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning');
  await refreshRates(true);
  updateConversion();
  setTimeout(() => btn.classList.remove('spinning'), 500);
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['fxFrom','fxTo'], (data) => {
  if (data.fxFrom) fromSelEl.value = data.fxFrom;
  if (data.fxTo)   toSelEl.value   = data.fxTo;
});

fromSelEl.addEventListener('change', () => chrome.storage.local.set({ fxFrom: fromSelEl.value }));
toSelEl.addEventListener('change',   () => chrome.storage.local.set({ fxTo:   toSelEl.value   }));

refreshRates().then(updateConversion);
