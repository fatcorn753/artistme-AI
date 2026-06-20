const methodEl   = document.getElementById('method');
const urlEl      = document.getElementById('url');
const sendBtn    = document.getElementById('btn-send');
const loadingEl  = document.getElementById('loading');
const respSection= document.getElementById('response-section');
const statusBadge= document.getElementById('status-badge');
const respTimeEl = document.getElementById('response-time');
const respSizeEl = document.getElementById('response-size');
const headersList= document.getElementById('headers-list');
const bodyInput  = document.getElementById('body-input');

// ── Tabs ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

document.querySelectorAll('.resp-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.resp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.response-body').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('rtab-' + tab.dataset.rtab).classList.remove('hidden');
  });
});

// ── Headers KV ──
function addHeader(key = '', value = '') {
  const row = document.createElement('div');
  row.className = 'kv-row';
  const k = document.createElement('input'); k.type='text'; k.placeholder='Header-Name'; k.value=key;
  const v = document.createElement('input'); v.type='text'; v.placeholder='value'; v.value=value;
  const del = document.createElement('button'); del.className='kv-del'; del.textContent='×';
  del.addEventListener('click', () => row.remove());
  row.appendChild(k); row.appendChild(v); row.appendChild(del);
  headersList.appendChild(row);
}
document.getElementById('btn-add-header').addEventListener('click', () => addHeader());

// Add default Content-Type header
addHeader('Accept', 'application/json');

function getHeaders() {
  const headers = {};
  headersList.querySelectorAll('.kv-row').forEach(row => {
    const [k, v] = row.querySelectorAll('input');
    if (k.value.trim()) headers[k.value.trim()] = v.value.trim();
  });
  // Auto Content-Type for body
  const bodyType = document.querySelector('input[name="body-type"]:checked')?.value;
  if (bodyType === 'json') headers['Content-Type'] = 'application/json';
  if (bodyType === 'form') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  return headers;
}

function getBody() {
  const bodyType = document.querySelector('input[name="body-type"]:checked')?.value;
  if (bodyType === 'none') return undefined;
  const text = bodyInput.value.trim();
  if (!text) return undefined;
  if (bodyType === 'json') {
    try { JSON.parse(text); } catch { /* send raw */ }
    return text;
  }
  return text;
}

// ── JSON syntax highlight ──
function highlightJson(text) {
  try {
    const parsed = JSON.parse(text);
    const pretty = JSON.stringify(parsed, null, 2);
    return pretty
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"([^"]+)":/g, '<span class="j-key">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="j-str">"$1"</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="j-num">$1</span>')
      .replace(/: (true|false)/g, ': <span class="j-bool">$1</span>')
      .replace(/: (null)/g, ': <span class="j-null">$1</span>');
  } catch {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

function statusClass(code) {
  if (code >= 200 && code < 300) return 'ok';
  if (code >= 300 && code < 400) return 'redir';
  return 'err';
}

// ── Send ──
sendBtn.addEventListener('click', async () => {
  const url = urlEl.value.trim();
  if (!url) { urlEl.focus(); return; }

  sendBtn.disabled = true;
  loadingEl.classList.remove('hidden');
  respSection.classList.add('hidden');

  const start = Date.now();
  try {
    const opts = { method: methodEl.value, headers: getHeaders() };
    const body = getBody();
    if (body !== undefined) opts.body = body;

    const res = await fetch(url, opts);
    const elapsed = Date.now() - start;
    const text = await res.text();
    const size = new Blob([text]).size;

    // Status
    statusBadge.textContent = `${res.status} ${res.statusText}`;
    statusBadge.className = 'status-badge ' + statusClass(res.status);
    respTimeEl.textContent = `${elapsed}ms`;
    respSizeEl.textContent = size < 1024 ? `${size}B` : `${(size/1024).toFixed(1)}KB`;

    // Body
    const bodyEl = document.getElementById('rtab-body');
    const ct = res.headers.get('content-type') || '';
    bodyEl.innerHTML = ct.includes('json') ? highlightJson(text)
      : text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Response headers
    const rhEl = document.getElementById('rtab-resp-headers');
    let headerText = '';
    res.headers.forEach((v, k) => { headerText += `<span class="j-key">${k}</span>: ${v}\n`; });
    rhEl.innerHTML = headerText;

    respSection.classList.remove('hidden');

    // Save history
    saveHistory({ method: methodEl.value, url, status: res.status, time: Date.now() });

  } catch (e) {
    statusBadge.textContent = 'エラー';
    statusBadge.className = 'status-badge err';
    respTimeEl.textContent = `${Date.now() - start}ms`;
    respSizeEl.textContent = '';
    document.getElementById('rtab-body').textContent = String(e);
    respSection.classList.remove('hidden');
  }

  sendBtn.disabled = false;
  loadingEl.classList.add('hidden');
});

// Enter key to send
urlEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendBtn.click(); });

// Copy response
document.getElementById('btn-copy-response').addEventListener('click', function() {
  const active = document.querySelector('.resp-tab.active');
  const content = document.getElementById('rtab-' + active.dataset.rtab).textContent;
  navigator.clipboard.writeText(content).then(() => {
    this.textContent = '✓ コピー済み'; this.classList.add('copied');
    setTimeout(() => { this.textContent = 'コピー'; this.classList.remove('copied'); }, 1500);
  });
});

// ── History ──
function saveHistory(entry) {
  chrome.storage.local.get(['httpHistory'], (data) => {
    const h = data.httpHistory || [];
    h.unshift(entry);
    if (h.length > 20) h.pop();
    chrome.storage.local.set({ httpHistory: h }, renderHistory);
  });
}

function renderHistory() {
  chrome.storage.local.get(['httpHistory'], (data) => {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    const h = data.httpHistory || [];
    if (!h.length) {
      list.innerHTML = '<div style="color:#374151;font-size:12px;padding:8px">履歴なし</div>';
      return;
    }
    h.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const sc = statusClass(item.status);
      const color = sc==='ok'?'#4ade80':sc==='redir'?'#fbbf24':'#f87171';
      div.innerHTML = `<span class="h-method">${item.method}</span>
        <span class="h-url" title="${item.url}">${item.url}</span>
        <span class="h-status" style="color:${color}">${item.status}</span>`;
      div.addEventListener('click', () => {
        methodEl.value = item.method;
        urlEl.value = item.url;
        // Switch to headers tab
        document.querySelectorAll('.tab')[0].click();
      });
      list.appendChild(div);
    });
  });
}

chrome.storage.local.get(['lastUrl', 'lastMethod'], (data) => {
  if (data.lastUrl) urlEl.value = data.lastUrl;
  if (data.lastMethod) methodEl.value = data.lastMethod;
});

urlEl.addEventListener('change', () => chrome.storage.local.set({ lastUrl: urlEl.value }));
methodEl.addEventListener('change', () => chrome.storage.local.set({ lastMethod: methodEl.value }));

renderHistory();
