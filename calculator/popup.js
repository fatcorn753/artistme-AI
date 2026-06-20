const exprEl   = document.getElementById('expr');
const resultEl = document.getElementById('result');
const histList = document.getElementById('hist-list');

let expression = '';
let lastResult = '0';
let memory = 0;
let isDeg = true;
let justEvaled = false;
let history = [];

// ── Math helpers ──────────────────────────────────────
function toRad(x) { return isDeg ? x * Math.PI / 180 : x; }
function safeMath(expr) {
  // Replace display symbols with JS operators
  let e = expr
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
    .replace(/π/g, '(' + Math.PI + ')')
    .replace(/\be\b/g, '(' + Math.E + ')');

  // Functions: sin(x) etc — already in expression as "sin(...)"
  // We'll evaluate with Function constructor in a sandbox
  const mathFns = {
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    asin: (x) => isDeg ? Math.asin(x) * 180 / Math.PI : Math.asin(x),
    acos: (x) => isDeg ? Math.acos(x) * 180 / Math.PI : Math.acos(x),
    atan: (x) => isDeg ? Math.atan(x) * 180 / Math.PI : Math.atan(x),
    log: (x) => Math.log10(x),
    ln: (x) => Math.log(x),
    sqrt: (x) => Math.sqrt(x),
    abs: (x) => Math.abs(x),
    pow: (a, b) => Math.pow(a, b),
  };

  // Build safe evaluator
  const keys = Object.keys(mathFns);
  const vals = Object.values(mathFns);

  try {
    const fn = new Function(...keys, '"use strict"; return (' + e + ')');
    const result = fn(...vals);
    if (!isFinite(result)) throw new Error('∞');
    if (isNaN(result)) throw new Error('エラー');
    return result;
  } catch {
    throw new Error('エラー');
  }
}

function fmtResult(n) {
  if (!isFinite(n)) return '∞';
  // Avoid floating point noise
  const s = parseFloat(n.toPrecision(12)).toString();
  return s.length > 16 ? n.toExponential(6) : s;
}

// ── Display update ────────────────────────────────────
function updateDisplay() {
  exprEl.textContent = expression;
  // Live eval for preview
  if (expression) {
    try {
      const v = safeMath(expression);
      const s = fmtResult(v);
      resultEl.textContent = s;
      resultEl.className = 'result' + (s.length > 12 ? ' small' : '');
    } catch {
      resultEl.textContent = lastResult;
      resultEl.className = 'result';
    }
  } else {
    resultEl.textContent = lastResult;
    resultEl.className = 'result';
  }
}

// ── Button handler ────────────────────────────────────
function handleAction(action) {
  // If we just evaluated and user types a digit, start fresh
  if (justEvaled && /^[0-9.]$/.test(action)) {
    expression = '';
    justEvaled = false;
  }
  // If we just evaluated and user types an operator, continue from result
  if (justEvaled && ['+', '−', '×', '÷', 'xʸ'].includes(action)) {
    expression = lastResult;
    justEvaled = false;
  }
  if (justEvaled && !['=','clear','mc','mr','m+','m-'].includes(action)) {
    justEvaled = false;
  }

  switch (action) {
    case 'clear':
      expression = ''; lastResult = '0'; justEvaled = false;
      resultEl.textContent = '0'; exprEl.textContent = '';
      resultEl.className = 'result';
      return;

    case '=': {
      if (!expression) return;
      try {
        const v = safeMath(expression);
        const s = fmtResult(v);
        history.unshift({ expr: expression, val: s });
        if (history.length > 50) history.pop();
        saveHistory();
        renderHistory();
        exprEl.textContent = expression + ' =';
        expression = '';
        lastResult = s;
        resultEl.textContent = s;
        resultEl.className = 'result' + (s.length > 12 ? ' small' : '');
        justEvaled = true;
      } catch (err) {
        resultEl.textContent = err.message;
        resultEl.className = 'result error';
        expression = '';
      }
      return;
    }

    case '⌫':
      expression = expression.slice(0, -1);
      break;

    case 'sign':
      if (expression) expression = '(-(' + expression + '))';
      else if (lastResult !== '0') expression = '(-(' + lastResult + '))';
      break;

    case 'percent':
      expression += '/100';
      break;

    case 'mc': memory = 0; return;
    case 'mr':
      expression += fmtResult(memory);
      break;
    case 'm+':
      try { memory += safeMath(expression || lastResult); } catch {}
      return;
    case 'm-':
      try { memory -= safeMath(expression || lastResult); } catch {}
      return;

    case 'sin': expression += 'sin('; break;
    case 'cos': expression += 'cos('; break;
    case 'tan': expression += 'tan('; break;
    case 'log': expression += 'log('; break;
    case 'ln':  expression += 'ln(';  break;
    case '√':   expression += 'sqrt('; break;
    case 'abs': expression += 'abs('; break;
    case 'x²':  expression += '**2'; break;
    case 'xʸ':  expression += '**'; break;
    case '1/x': expression = '1/(' + (expression || lastResult) + ')'; break;
    case 'π':   expression += 'π'; break;
    case 'e':   expression += 'e'; break;
    case '(':   expression += '('; break;
    case ')':   expression += ')'; break;

    default:
      expression += action;
  }

  updateDisplay();
}

// ── Button clicks ─────────────────────────────────────
document.querySelectorAll('.btn[data-action]').forEach(btn => {
  btn.addEventListener('click', () => handleAction(btn.dataset.action));
});

// ── Keyboard support ──────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') handleAction(e.key);
  else if (e.key === '.') handleAction('.');
  else if (e.key === '+') handleAction('+');
  else if (e.key === '-') handleAction('−');
  else if (e.key === '*') handleAction('×');
  else if (e.key === '/') { e.preventDefault(); handleAction('÷'); }
  else if (e.key === 'Enter' || e.key === '=') handleAction('=');
  else if (e.key === 'Backspace') handleAction('⌫');
  else if (e.key === 'Escape') handleAction('clear');
  else if (e.key === '(' ) handleAction('(');
  else if (e.key === ')' ) handleAction(')');
  else if (e.key === '%' ) handleAction('percent');
  else if (e.key === '^' ) handleAction('xʸ');
});

// ── Mode tabs ─────────────────────────────────────────
let currentMode = 'basic';
document.getElementById('mode-basic').addEventListener('click', () => setMode('basic'));
document.getElementById('mode-sci').addEventListener('click', () => setMode('sci'));
document.getElementById('mode-hist').addEventListener('click', () => setMode('hist'));

function setMode(m) {
  currentMode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mode-' + m).classList.add('active');
  document.getElementById('hist-panel').classList.toggle('hidden', m !== 'hist');
  document.getElementById('sci-grid').classList.toggle('hidden', m !== 'sci');
}

// ── DEG/RAD ───────────────────────────────────────────
document.getElementById('deg-btn').addEventListener('click', () => {
  isDeg = !isDeg;
  const btn = document.getElementById('deg-btn');
  btn.textContent = isDeg ? 'DEG' : 'RAD';
  btn.classList.toggle('active', isDeg);
  updateDisplay();
});

// ── History ───────────────────────────────────────────
function renderHistory() {
  histList.innerHTML = '';
  if (!history.length) {
    histList.innerHTML = '<div style="color:#3a3a3c;font-size:12px;padding:12px;text-align:center">履歴なし</div>';
    return;
  }
  history.forEach(h => {
    const div = document.createElement('div');
    div.className = 'hist-item';
    div.innerHTML = `<div class="hist-expr">${h.expr}</div><div class="hist-val">${h.val}</div>`;
    div.addEventListener('click', () => {
      expression = h.val;
      lastResult = h.val;
      updateDisplay();
      setMode('basic');
    });
    histList.appendChild(div);
  });
}

function saveHistory() {
  chrome.storage.local.set({ calcHistory: history.slice(0, 50) });
}

document.getElementById('hist-clear').addEventListener('click', () => {
  history = [];
  saveHistory();
  renderHistory();
});

// ── Init ──────────────────────────────────────────────
chrome.storage.local.get(['calcHistory'], (data) => {
  history = data.calcHistory || [];
  renderHistory();
});
