// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1200);
  });
}

// ── NUMBER BASE CONVERTER ─────────────────────────────
const BASES = [
  { id: 'dec', label: 'DEC', base: 10, placeholder: '42' },
  { id: 'hex', label: 'HEX', base: 16, placeholder: '2A' },
  { id: 'oct', label: 'OCT', base: 8,  placeholder: '52' },
  { id: 'bin', label: 'BIN', base: 2,  placeholder: '101010' },
];

const baseRows = document.getElementById('base-rows');
BASES.forEach(({ id, label, base, placeholder }) => {
  const row = document.createElement('div');
  row.className = 'base-row';
  row.innerHTML = `
    <span class="base-label">${label}</span>
    <input type="text" id="base-${id}" placeholder="${placeholder}" spellcheck="false">
    <button class="copy-val-btn" data-src="base-${id}">⎘</button>
  `;
  baseRows.appendChild(row);
});

let updating = false;
function updateBases(fromId) {
  if (updating) return;
  updating = true;
  const fromEl = document.getElementById('base-' + fromId);
  const fromBase = BASES.find(b => b.id === fromId).base;
  const raw = fromEl.value.trim().replace(/\s/g, '');
  fromEl.classList.remove('error');

  if (!raw) { BASES.filter(b => b.id !== fromId).forEach(b => document.getElementById('base-'+b.id).value = ''); updating = false; return; }

  let n;
  try { n = parseInt(raw, fromBase); } catch { n = NaN; }
  if (isNaN(n) || !isFinite(n)) { fromEl.classList.add('error'); updating = false; return; }

  BASES.filter(b => b.id !== fromId).forEach(({ id, base }) => {
    const el = document.getElementById('base-' + id);
    el.value = n.toString(base).toUpperCase();
    el.classList.remove('error');
  });

  // Bit display
  const bitDisplay = document.getElementById('bit-display');
  bitDisplay.innerHTML = '';
  const binStr = n.toString(2).padStart(Math.max(8, Math.ceil(n.toString(2).length / 8) * 8), '0');
  for (let i = 0; i < binStr.length; i++) {
    if (i > 0 && i % 4 === 0) {
      const sep = document.createElement('span');
      sep.className = 'bit-sep'; sep.textContent = ' ';
      bitDisplay.appendChild(sep);
    }
    const bit = document.createElement('span');
    bit.className = 'bit ' + (binStr[i] === '1' ? 'one' : 'zero');
    bit.textContent = binStr[i];
    bitDisplay.appendChild(bit);
  }

  updating = false;
}

BASES.forEach(({ id }) => {
  document.getElementById('base-' + id).addEventListener('input', () => updateBases(id));
});

document.querySelectorAll('.copy-val-btn').forEach(btn => {
  if (!btn.dataset.src?.startsWith('base-')) return;
  btn.addEventListener('click', () => {
    const val = document.getElementById(btn.dataset.src)?.value;
    if (val) copyText(val, btn);
  });
});

// Set default
document.getElementById('base-dec').value = '42';
updateBases('dec');

// ── BIT OPERATIONS ────────────────────────────────────
const OPS = [
  { label: 'AND',  fn: (a,b) => a & b },
  { label: 'OR',   fn: (a,b) => a | b },
  { label: 'XOR',  fn: (a,b) => a ^ b },
  { label: 'NAND', fn: (a,b) => ~(a & b) },
  { label: 'NOR',  fn: (a,b) => ~(a | b) },
  { label: 'NOT A',fn: (a,b) => ~a },
  { label: '<<1',  fn: (a,b) => a << 1 },
  { label: '>>1',  fn: (a,b) => a >> 1 },
];

function updateBitOps() {
  const a = parseInt(document.getElementById('bit-a').value) || 0;
  const b = parseInt(document.getElementById('bit-b').value) || 0;
  const results = document.getElementById('bitop-results');
  results.innerHTML = '';
  OPS.forEach(({ label, fn }) => {
    const val = fn(a, b) >>> 0; // unsigned
    const div = document.createElement('div');
    div.className = 'bitop-item';
    div.innerHTML = `<div class="bitop-op">${label}</div><div class="bitop-val">${val}</div><div class="bitop-hex">0x${val.toString(16).toUpperCase()}</div>`;
    div.addEventListener('click', () => { navigator.clipboard.writeText(String(val)); div.style.borderColor='#4ade80'; setTimeout(()=>div.style.borderColor='',1000); });
    results.appendChild(div);
  });
}

['bit-a','bit-b'].forEach(id => document.getElementById(id).addEventListener('input', updateBitOps));
updateBitOps();

// ── COLOR CONVERTER ───────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}
function rgbToHsl(r,g,b) {
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}}
  return [Math.round(h*360),Math.round(s*100),Math.round(l*100)];
}

function updateColor(hex) {
  const normalized = hex.replace(/^#?([0-9a-fA-F]{3})$/, (_,h) => '#'+h.split('').map(c=>c+c).join(''));
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return;
  const [r,g,b] = hexToRgb(normalized);
  const [h,s,l] = rgbToHsl(r,g,b);
  const intVal = (r<<16)|(g<<8)|b;
  document.getElementById('color-swatch').style.background = normalized;
  document.getElementById('color-rgb').value = `${r}, ${g}, ${b}`;
  document.getElementById('color-hsl').value = `${h}°, ${s}%, ${l}%`;
  document.getElementById('color-int').value = intVal;
}

document.getElementById('color-hex').addEventListener('input', e => updateColor(e.target.value.startsWith('#') ? e.target.value : '#'+e.target.value));
document.getElementById('color-swatch').addEventListener('click', () => document.getElementById('color-picker').click());
document.getElementById('color-picker').addEventListener('input', e => {
  document.getElementById('color-hex').value = e.target.value;
  updateColor(e.target.value);
});
document.getElementById('btn-open-picker').addEventListener('click', () => document.getElementById('color-picker').click());

document.querySelectorAll('.copy-val-btn[data-src^="color-"]').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = document.getElementById(btn.dataset.src)?.value;
    if (val) copyText(val, btn);
  });
});
updateColor('#FF6B6B');

// ── ASCII ─────────────────────────────────────────────
function updateAscii() {
  const input = document.getElementById('ascii-input').value;
  const result = document.getElementById('ascii-result');
  result.innerHTML = '';
  if (!input) return;

  const chars = [...input].slice(0, 10);
  chars.forEach(ch => {
    const code = ch.charCodeAt(0);
    const card = document.createElement('div');
    card.className = 'ascii-char-card';
    card.innerHTML = `<div class="ascii-char">${ch === ' ' ? '⎵' : ch}</div><div class="ascii-code">Dec: ${code}</div><div class="ascii-hex">Hex: ${code.toString(16).toUpperCase()}</div>`;
    result.appendChild(card);
  });
}

document.getElementById('ascii-input').addEventListener('input', updateAscii);

// Build ASCII table
const tableEl = document.getElementById('ascii-table');
for (let code = 32; code <= 126; code++) {
  const ch = String.fromCharCode(code);
  const cell = document.createElement('div');
  cell.className = 'at-cell';
  cell.title = `Dec:${code} Hex:${code.toString(16).toUpperCase()}`;
  cell.innerHTML = `<div class="at-char">${ch}</div><div class="at-code">${code}</div>`;
  cell.addEventListener('click', () => {
    document.getElementById('ascii-input').value += ch;
    updateAscii();
  });
  tableEl.appendChild(cell);
}
