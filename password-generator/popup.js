const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const NUMS  = '0123456789';
const SYMS  = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = /[0Ol1I]/g;

const display   = document.getElementById('password-display');
const btnCopy   = document.getElementById('btn-copy');
const btnRegen  = document.getElementById('btn-regen');
const lenSlider = document.getElementById('length');
const lenDisplay= document.getElementById('len-display');
const fill      = document.getElementById('strength-fill');
const label     = document.getElementById('strength-label');
const histList  = document.getElementById('history-list');

let currentPassword = '';

function getCharset() {
  let chars = '';
  if (document.getElementById('upper').checked)   chars += UPPER;
  if (document.getElementById('lower').checked)   chars += LOWER;
  if (document.getElementById('numbers').checked) chars += NUMS;
  if (document.getElementById('symbols').checked) chars += SYMS;
  if (document.getElementById('exclude-ambiguous').checked) chars = chars.replace(AMBIGUOUS, '');
  return chars || LOWER;
}

function generate() {
  const len = parseInt(lenSlider.value);
  const chars = getCharset();
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => chars[n % chars.length]).join('');
}

function entropy(pw) {
  const charset = getCharset().length;
  return pw.length * Math.log2(charset);
}

function strengthInfo(bits) {
  if (bits < 28) return { pct: 15, color: '#f87171', text: '弱い' };
  if (bits < 36) return { pct: 35, color: '#fb923c', text: '普通' };
  if (bits < 60) return { pct: 60, color: '#facc15', text: '強い' };
  if (bits < 80) return { pct: 80, color: '#4ade80', text: '非常に強い' };
  return { pct: 100, color: '#34d399', text: '最強' };
}

function updateStrength(pw) {
  const bits = entropy(pw);
  const { pct, color, text } = strengthInfo(bits);
  fill.style.width = pct + '%';
  fill.style.background = color;
  label.style.color = color;
  label.textContent = text;
}

function regen() {
  currentPassword = generate();
  display.textContent = currentPassword;
  updateStrength(currentPassword);
  btnRegen.classList.add('spinning');
  setTimeout(() => btnRegen.classList.remove('spinning'), 400);
}

function copyPw(pw) {
  navigator.clipboard.writeText(pw).then(() => {
    btnCopy.textContent = '✓';
    btnCopy.classList.add('copied');
    setTimeout(() => { btnCopy.textContent = '⎘'; btnCopy.classList.remove('copied'); }, 1500);
    saveHistory(pw);
  });
}

function saveHistory(pw) {
  chrome.storage.local.get(['pwHistory'], (data) => {
    let h = data.pwHistory || [];
    h = h.filter(p => p !== pw);
    h.unshift(pw);
    if (h.length > 10) h = h.slice(0, 10);
    chrome.storage.local.set({ pwHistory: h }, () => renderHistory(h));
  });
}

function renderHistory(history) {
  histList.innerHTML = '';
  history.forEach(pw => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<span title="${pw}">${pw}</span><span class="copy-hist">コピー</span>`;
    item.addEventListener('click', () => {
      navigator.clipboard.writeText(pw);
      item.style.borderColor = '#34d399';
      setTimeout(() => item.style.borderColor = '', 1000);
    });
    histList.appendChild(item);
  });
}

lenSlider.addEventListener('input', () => {
  lenDisplay.textContent = lenSlider.value;
  regen();
});

['upper','lower','numbers','symbols','exclude-ambiguous'].forEach(id => {
  document.getElementById(id).addEventListener('change', regen);
});

btnRegen.addEventListener('click', regen);
btnCopy.addEventListener('click', () => { if (currentPassword) copyPw(currentPassword); });

document.getElementById('btn-clear-history').addEventListener('click', () => {
  chrome.storage.local.set({ pwHistory: [] }, () => renderHistory([]));
});

chrome.storage.local.get(['pwHistory'], (data) => {
  renderHistory(data.pwHistory || []);
});

regen();
