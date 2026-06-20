// Mode tabs
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('mode-' + tab.dataset.mode).classList.remove('hidden');
  });
});

function setCopyBtn(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ コピー済み';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
  });
}

// ── Base64 ──
const b64Input  = document.getElementById('b64-input');
const b64Result = document.getElementById('b64-result');
const b64Error  = document.getElementById('b64-error');

function toUrlSafe(s) { return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromUrlSafe(s) { return s.replace(/-/g, '+').replace(/_/g, '/'); }

document.getElementById('b64-encode').addEventListener('click', () => {
  const urlSafe = document.getElementById('b64-url-safe').checked;
  try {
    let result = btoa(unescape(encodeURIComponent(b64Input.value)));
    if (urlSafe) result = toUrlSafe(result);
    b64Result.textContent = result;
    b64Error.textContent = '';
  } catch (e) { b64Error.textContent = '❌ ' + e.message; }
});

document.getElementById('b64-decode').addEventListener('click', () => {
  try {
    let input = b64Input.value.trim();
    input = fromUrlSafe(input);
    // Re-pad
    while (input.length % 4) input += '=';
    b64Result.textContent = decodeURIComponent(escape(atob(input)));
    b64Error.textContent = '';
  } catch (e) { b64Error.textContent = '❌ デコード失敗: 無効なBase64文字列'; }
});

document.getElementById('b64-copy').addEventListener('click', () => {
  if (b64Result.textContent) setCopyBtn(document.getElementById('b64-copy'), b64Result.textContent);
});

// ── URL Encode ──
const urlInput  = document.getElementById('url-input');
const urlResult = document.getElementById('url-result');
const urlError  = document.getElementById('url-error');

document.getElementById('url-encode').addEventListener('click', () => {
  try {
    const comp = document.getElementById('url-component').checked;
    urlResult.textContent = comp ? encodeURIComponent(urlInput.value) : encodeURI(urlInput.value);
    urlError.textContent = '';
  } catch (e) { urlError.textContent = '❌ ' + e.message; }
});

document.getElementById('url-decode').addEventListener('click', () => {
  try {
    urlResult.textContent = decodeURIComponent(urlInput.value);
    urlError.textContent = '';
  } catch (e) { urlError.textContent = '❌ デコード失敗'; }
});

document.getElementById('url-copy').addEventListener('click', () => {
  if (urlResult.textContent) setCopyBtn(document.getElementById('url-copy'), urlResult.textContent);
});

// ── Hash ──
async function sha(algo, text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('hash-calc').addEventListener('click', async () => {
  const text = document.getElementById('hash-input').value;
  const container = document.getElementById('hash-results');
  container.innerHTML = '<div style="color:#888;font-size:12px;padding:8px">計算中...</div>';

  const algos = [
    { label: 'SHA-256', algo: 'SHA-256' },
    { label: 'SHA-1', algo: 'SHA-1' },
    { label: 'SHA-384', algo: 'SHA-384' },
    { label: 'SHA-512', algo: 'SHA-512' },
  ];

  const results = await Promise.all(algos.map(async a => ({ ...a, hash: await sha(a.algo, text) })));
  container.innerHTML = '';
  results.forEach(({ label, hash }) => {
    const row = document.createElement('div');
    row.className = 'hash-row';
    row.innerHTML = `
      <div class="hash-algo">${label}</div>
      <div class="hash-value" title="クリックでコピー">${hash}</div>
    `;
    row.querySelector('.hash-value').addEventListener('click', () => {
      navigator.clipboard.writeText(hash);
      row.querySelector('.hash-value').style.color = '#34d399';
      setTimeout(() => row.querySelector('.hash-value').style.color = '', 1000);
    });
    container.appendChild(row);
  });
});
