const canvas   = document.getElementById('qr-canvas');
const output   = document.getElementById('qr-output');
const errorEl  = document.getElementById('qr-error');
const fgEl     = document.getElementById('qr-fg');
const bgEl     = document.getElementById('qr-bg');
const sizeEl   = document.getElementById('qr-size');

let currentMode = 'text';

// Mode tabs
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    currentMode = tab.dataset.mode;
    document.getElementById('mode-' + currentMode).classList.remove('hidden');
  });
});

// Get current tab URL
document.getElementById('btn-current-url').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      document.getElementById('text-input').value = tabs[0].url;
    }
  });
});

function buildContent() {
  if (currentMode === 'text') {
    return document.getElementById('text-input').value.trim();
  }
  if (currentMode === 'wifi') {
    const ssid = document.getElementById('wifi-ssid').value;
    const pass = document.getElementById('wifi-pass').value;
    const enc  = document.getElementById('wifi-enc').value;
    return `WIFI:T:${enc};S:${ssid};P:${pass};;`;
  }
  if (currentMode === 'vcard') {
    const name  = document.getElementById('vc-name').value;
    const phone = document.getElementById('vc-phone').value;
    const email = document.getElementById('vc-email').value;
    const org   = document.getElementById('vc-org').value;
    const url   = document.getElementById('vc-url').value;
    return [
      'BEGIN:VCARD', 'VERSION:3.0',
      name  ? `FN:${name}`    : '',
      phone ? `TEL:${phone}`  : '',
      email ? `EMAIL:${email}`: '',
      org   ? `ORG:${org}`    : '',
      url   ? `URL:${url}`    : '',
      'END:VCARD'
    ].filter(Boolean).join('\n');
  }
  return '';
}

function generate() {
  errorEl.textContent = '';
  const text = buildContent();
  if (!text) { errorEl.textContent = 'コンテンツを入力してください'; return; }

  try {
    const size = parseInt(sizeEl.value);
    canvas.width = size;
    canvas.height = size;

    const qr = QRCode.generate(text);
    QRCode.draw(qr, canvas, fgEl.value, bgEl.value);
    output.classList.remove('hidden');

    chrome.storage.local.set({ lastText: text, lastFg: fgEl.value, lastBg: bgEl.value });
  } catch (e) {
    errorEl.textContent = '❌ ' + e.message;
    output.classList.add('hidden');
  }
}

document.getElementById('btn-generate').addEventListener('click', generate);

// Auto-generate on color/size change
[fgEl, bgEl, sizeEl].forEach(el => el.addEventListener('change', () => {
  if (!output.classList.contains('hidden')) generate();
}));

// Download PNG
document.getElementById('btn-dl-png').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'qrcode.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Copy image
document.getElementById('btn-copy-img').addEventListener('click', () => {
  canvas.toBlob(blob => {
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
      const btn = document.getElementById('btn-copy-img');
      btn.textContent = '✓ コピー済み';
      setTimeout(() => btn.textContent = '画像コピー', 1500);
    }).catch(() => {
      errorEl.textContent = 'コピーに失敗しました（ブラウザ制限）';
    });
  });
});

// Enter to generate
document.getElementById('text-input').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate();
});

// Restore last state
chrome.storage.local.get(['lastText','lastFg','lastBg'], (data) => {
  if (data.lastText) document.getElementById('text-input').value = data.lastText;
  if (data.lastFg) fgEl.value = data.lastFg;
  if (data.lastBg) bgEl.value = data.lastBg;
});
