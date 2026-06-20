const loadingEl = document.getElementById('loading');
const errorEl   = document.getElementById('error-msg');
const resultEl  = document.getElementById('result');

function setLoading(v) { loadingEl.classList.toggle('hidden', !v); }
function setError(msg) { errorEl.textContent = msg; errorEl.classList.toggle('hidden', !msg); }

async function lookup(ip = '') {
  setLoading(true); setError(''); resultEl.classList.add('hidden');

  try {
    const url = ip
      ? `https://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query,mobile,proxy,hosting`
      : `https://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query,mobile,proxy,hosting`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'fail') throw new Error(data.message || '取得失敗');

    renderResult(data);
    chrome.storage.local.set({ lastIp: data.query });
  } catch (e) {
    setError('❌ ' + e.message);
  }
  setLoading(false);
}

function renderResult(d) {
  document.getElementById('ip-display').textContent = d.query;

  const types = [];
  if (d.mobile)  types.push('モバイル');
  if (d.proxy)   types.push('プロキシ');
  if (d.hosting) types.push('ホスティング');
  document.getElementById('ip-type').textContent = types.length ? types.join(' · ') : 'レジデンシャル';

  const ROWS = [
    { icon: '🌍', key: '国',         val: d.country + (d.countryCode ? ` (${d.countryCode})` : '') },
    { icon: '📍', key: '地域',       val: [d.regionName, d.city].filter(Boolean).join(', ') },
    { icon: '📮', key: '郵便番号',   val: d.zip || '—' },
    { icon: '🕐', key: 'タイムゾーン', val: d.timezone || '—' },
    { icon: '🏢', key: 'ISP',        val: d.isp || '—' },
    { icon: '🏗', key: '組織',       val: d.org || '—' },
    { icon: '📡', key: 'AS',         val: d.as || '—' },
  ];

  const grid = document.getElementById('info-grid');
  grid.innerHTML = '';
  ROWS.forEach(({ icon, key, val }) => {
    if (!val || val === '—') return;
    const row = document.createElement('div');
    row.className = 'info-row';
    row.title = 'クリックでコピー';
    row.innerHTML = `
      <span class="info-icon">${icon}</span>
      <span class="info-key">${key}</span>
      <span class="info-val">${val}</span>
      <span class="info-copy">⎘</span>
    `;
    row.addEventListener('click', () => {
      navigator.clipboard.writeText(val);
      row.classList.add('copied');
      setTimeout(() => row.classList.remove('copied'), 1000);
    });
    grid.appendChild(row);
  });

  // Map section
  if (d.lat && d.lon) {
    const mapSection = document.getElementById('map-section');
    mapSection.classList.remove('hidden');
    document.getElementById('coords').textContent = `${d.lat}, ${d.lon}`;
    document.getElementById('map-link').href = `https://www.google.com/maps?q=${d.lat},${d.lon}`;
  }

  resultEl.classList.remove('hidden');
}

document.getElementById('btn-lookup').addEventListener('click', () => {
  const val = document.getElementById('ip-input').value.trim();
  lookup(val || '');
});

document.getElementById('ip-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') lookup(document.getElementById('ip-input').value.trim());
});

document.getElementById('btn-myip').addEventListener('click', () => {
  document.getElementById('ip-input').value = '';
  lookup('');
});

// Init — auto load my IP
lookup('');
