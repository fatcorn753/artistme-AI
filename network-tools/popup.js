// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function kv(key, val, cls='') { return `<div class="kv-row"><span class="kv-key">${esc(key)}</span><span class="kv-val ${cls}">${esc(String(val))}</span></div>`; }
function section(t) { return `<div class="section-title">${esc(t)}</div>`; }

// ── HTTP Diagnostic ───────────────────────────────────
document.getElementById('btn-http-check').addEventListener('click', async () => {
  const url = document.getElementById('http-url').value.trim();
  const res_el = document.getElementById('http-result');
  if (!url) return;
  res_el.innerHTML = '<div class="loading">診断中...</div>';

  try {
    const t0 = performance.now();
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const t1 = performance.now();
    const latency = Math.round(t1 - t0);

    const statusClass = res.status < 300 ? 'ok' : res.status < 400 ? 'warn' : 'err';
    const ttfb = latency;

    let html = section('基本情報');
    html += kv('URL', url);
    html += kv('HTTPステータス', `${res.status} ${res.statusText}`, statusClass);
    html += kv('TTFB (推定)', `${ttfb}ms`, ttfb < 200 ? 'ok' : ttfb < 500 ? 'warn' : 'err');
    html += kv('リダイレクト先', res.url !== url ? res.url : 'なし', res.url !== url ? 'info' : '');

    html += section('セキュリティ');
    const isHttps = url.startsWith('https://');
    html += kv('HTTPS', isHttps ? '✅ 有効' : '❌ 非推奨', isHttps ? 'ok' : 'err');
    const hsts = res.headers.get('strict-transport-security');
    html += kv('HSTS', hsts ? '✅ ' + hsts.slice(0,40) : '⚠ 未設定', hsts ? 'ok' : 'warn');
    const csp = res.headers.get('content-security-policy');
    html += kv('CSP', csp ? '✅ 設定済み' : '⚠ 未設定', csp ? 'ok' : 'warn');
    const xfo = res.headers.get('x-frame-options');
    html += kv('X-Frame-Options', xfo || '⚠ 未設定', xfo ? 'ok' : 'warn');

    html += section('パフォーマンス');
    const cc = res.headers.get('cache-control');
    html += kv('Cache-Control', cc || 'なし');
    const ce = res.headers.get('content-encoding');
    html += kv('圧縮', ce ? '✅ ' + ce : '未圧縮', ce ? 'ok' : '');
    const srv = res.headers.get('server');
    html += kv('サーバー', srv || '不明');
    const ct = res.headers.get('content-type');
    html += kv('Content-Type', ct || '不明');

    res_el.innerHTML = html;
  } catch (e) {
    res_el.innerHTML = `<div class="error">❌ 接続エラー: ${esc(e.message)}</div>`;
  }
});
document.getElementById('http-url').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-http-check').click(); });

// ── Subnet Calculator ────────────────────────────────
document.getElementById('btn-subnet-calc').addEventListener('click', () => {
  const input = document.getElementById('subnet-input').value.trim();
  const res_el = document.getElementById('subnet-result');

  try {
    const [ipStr, prefixStr] = input.split('/');
    const prefix = parseInt(prefixStr);
    if (!ipStr || isNaN(prefix) || prefix < 0 || prefix > 32) throw new Error('形式: x.x.x.x/n');

    const parts = ipStr.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p<0 || p>255)) throw new Error('IPアドレスが無効');

    const ipNum = parts.reduce((a,b) => (a<<8)|b, 0) >>> 0;
    const maskNum = prefix === 0 ? 0 : (0xFFFFFFFF << (32-prefix)) >>> 0;
    const netNum  = (ipNum & maskNum) >>> 0;
    const bcastNum= (netNum | ~maskNum) >>> 0;
    const firstNum= prefix <= 30 ? (netNum + 1) >>> 0 : netNum;
    const lastNum = prefix <= 30 ? (bcastNum - 1) >>> 0 : bcastNum;
    const hostsCount = prefix <= 30 ? Math.pow(2, 32-prefix) - 2 : Math.pow(2, 32-prefix);

    function numToIp(n) {
      return [(n>>>24)&0xFF,(n>>>16)&0xFF,(n>>>8)&0xFF,n&0xFF].join('.');
    }
    function numToMask(n) { return numToIp(n); }

    const wildNum = ~maskNum >>> 0;

    let html = section('サブネット情報');
    html += kv('ネットワークアドレス', numToIp(netNum), 'info');
    html += kv('サブネットマスク', numToMask(maskNum));
    html += kv('ワイルドカードマスク', numToIp(wildNum));
    html += kv('ブロードキャスト', numToIp(bcastNum), 'warn');
    html += kv('最初のホストIP', numToIp(firstNum), 'ok');
    html += kv('最後のホストIP', numToIp(lastNum), 'ok');
    html += kv('利用可能ホスト数', hostsCount.toLocaleString(), 'ok');
    html += kv('プレフィックス長', '/' + prefix);

    html += section('バイナリ表現');
    const binMask = maskNum.toString(2).padStart(32,'0').replace(/(.{8})/g,'$1 ').trim();
    html += `<div style="font-family:monospace;font-size:11px;color:#64748b;margin:4px 0">${binMask}</div>`;

    html += section('IPクラス');
    const firstOctet = parts[0];
    const ipClass = firstOctet < 128 ? 'A' : firstOctet < 192 ? 'B' : firstOctet < 224 ? 'C' : firstOctet < 240 ? 'D(マルチキャスト)' : 'E(予約)';
    html += kv('クラス', ipClass);
    const isPrivate = (parts[0]===10) || (parts[0]===172&&parts[1]>=16&&parts[1]<=31) || (parts[0]===192&&parts[1]===168);
    html += kv('種別', isPrivate ? '🏠 プライベートIP' : '🌐 パブリックIP', isPrivate ? 'info' : 'ok');

    res_el.innerHTML = html;
  } catch(e) {
    res_el.innerHTML = `<div class="error">❌ ${esc(e.message)}</div>`;
  }
});
document.getElementById('subnet-input').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-subnet-calc').click(); });

// ── HTTP Headers ──────────────────────────────────────
document.getElementById('btn-headers-fetch').addEventListener('click', async () => {
  const url = document.getElementById('headers-url').value.trim();
  const res_el = document.getElementById('headers-result');
  if (!url) return;
  res_el.innerHTML = '<div class="loading">取得中...</div>';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    let html = `<span style="color:#4ade80">${esc(res.status+' '+res.statusText)}</span>\n\n`;
    res.headers.forEach((val, key) => {
      html += `<span style="color:#60a5fa">${esc(key)}</span>: ${esc(val)}\n`;
    });
    res_el.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-all">${html}</pre>`;
  } catch(e) {
    res_el.innerHTML = `<div class="error">❌ ${esc(e.message)}</div>`;
  }
});
document.getElementById('headers-url').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-headers-fetch').click(); });

// ── Latency Test ──────────────────────────────────────
const LATENCY_TARGETS = [
  { host: 'cloudflare.com',   url: 'https://cloudflare.com/cdn-cgi/trace' },
  { host: 'google.com',       url: 'https://www.google.com/favicon.ico' },
  { host: 'github.com',       url: 'https://github.com/favicon.ico' },
  { host: 'amazon.co.jp',     url: 'https://www.amazon.co.jp/favicon.ico' },
  { host: 'wikipedia.org',    url: 'https://ja.wikipedia.org/favicon.ico' },
  { host: 'twitter.com',      url: 'https://abs.twimg.com/favicons/twitter.ico' },
];

function renderLatencyList(results) {
  const list = document.getElementById('latency-list');
  list.innerHTML = '';
  results.forEach(r => {
    const row = document.createElement('div');
    row.className = 'lat-row';
    const ms = r.ms;
    const color = ms === null ? '#f87171' : ms < 100 ? '#4ade80' : ms < 300 ? '#fbbf24' : '#f87171';
    const barW = ms === null ? 0 : Math.min(100, ms / 5);
    row.innerHTML = `
      <span class="lat-host">${esc(r.host)}</span>
      <div class="lat-bar-wrap"><div class="lat-bar" style="width:${barW}%;background:${color}"></div></div>
      <span class="lat-ms" style="color:${color}">${ms === null ? '—' : ms+'ms'}</span>
      <span class="lat-status">${ms === null ? '❌' : ms < 100 ? '🟢' : ms < 300 ? '🟡' : '🔴'}</span>
    `;
    list.appendChild(row);
  });
}

// Init latency list
renderLatencyList(LATENCY_TARGETS.map(t => ({ ...t, ms: null })));

document.getElementById('btn-lat-run').addEventListener('click', async () => {
  const btn = document.getElementById('btn-lat-run');
  btn.textContent = '計測中...'; btn.disabled = true;
  const results = await Promise.all(LATENCY_TARGETS.map(async target => {
    try {
      const t0 = performance.now();
      await fetch(target.url + '?t=' + Date.now(), { cache: 'no-store', method: 'HEAD' });
      const ms = Math.round(performance.now() - t0);
      return { ...target, ms };
    } catch { return { ...target, ms: null }; }
  }));
  renderLatencyList(results);
  btn.textContent = '計測開始'; btn.disabled = false;
});

// Auto-fill current tab URL
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const url = tabs[0]?.url || '';
  if (url.startsWith('http')) {
    document.getElementById('http-url').value = url;
    document.getElementById('headers-url').value = url;
  }
});
