const input = document.getElementById('input');
const output = document.getElementById('output');
const outputWrapper = document.getElementById('output-wrapper');
const errorMsg = document.getElementById('error-msg');
const statsEl = document.getElementById('stats');
const indentSize = document.getElementById('indent-size');

function getIndent() {
  const v = indentSize.value;
  return v === 'tab' ? '\t' : parseInt(v);
}

function countNodes(obj) {
  if (typeof obj !== 'object' || obj === null) return 1;
  return Object.values(obj).reduce((acc, v) => acc + countNodes(v), 1);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildTree(value, depth = 0) {
  if (value === null) return `<span class="j-null">null</span>`;
  if (typeof value === 'boolean') return `<span class="j-bool">${value}</span>`;
  if (typeof value === 'number') return `<span class="j-num">${value}</span>`;
  if (typeof value === 'string') return `<span class="j-str">"${escapeHtml(value)}"</span>`;

  const isArr = Array.isArray(value);
  const entries = isArr ? value.map((v,i) => [i, v]) : Object.entries(value);
  if (entries.length === 0) return isArr ? '[]' : '{}';

  const open = isArr ? '[' : '{';
  const close = isArr ? ']' : '}';
  const id = `node-${Math.random().toString(36).slice(2)}`;

  let inner = '';
  entries.forEach(([k, v], i) => {
    const comma = i < entries.length - 1 ? ',' : '';
    const keyPart = isArr ? '' : `<span class="j-key">"${escapeHtml(String(k))}"</span>: `;
    inner += `<div style="padding-left:16px">${keyPart}${buildTree(v, depth+1)}${comma}</div>`;
  });

  const summary = `${entries.length} ${isArr ? 'items' : 'keys'}`;
  return `<span class="j-brace collapsible" data-target="${id}">${open}</span><span class="collapse-hint collapsed-hint" id="hint-${id}" style="display:none"> …${summary}… </span><div class="collapsible-content" id="${id}">${inner}</div><span class="j-brace">${close}</span>`;
}

function format() {
  const text = input.value.trim();
  if (!text) { errorMsg.textContent = ''; outputWrapper.classList.add('hidden'); return; }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    errorMsg.textContent = `❌ ${e.message}`;
    outputWrapper.classList.add('hidden');
    return;
  }

  errorMsg.textContent = '';
  const nodes = countNodes(parsed);
  statsEl.textContent = `${nodes} ノード`;
  output.innerHTML = buildTree(parsed);
  outputWrapper.classList.remove('hidden');

  output.querySelectorAll('.collapsible').forEach(el => {
    el.addEventListener('click', () => {
      const target = document.getElementById(el.dataset.target);
      const hint = document.getElementById('hint-' + el.dataset.target);
      const collapsed = el.classList.toggle('collapsed');
      target.classList.toggle('hidden', collapsed);
      if (hint) hint.style.display = collapsed ? 'inline' : 'none';
    });
  });
}

document.getElementById('btn-format').addEventListener('click', format);

document.getElementById('btn-minify').addEventListener('click', () => {
  const text = input.value.trim();
  if (!text) return;
  try {
    input.value = JSON.stringify(JSON.parse(text));
    errorMsg.textContent = '';
    outputWrapper.classList.add('hidden');
  } catch (e) {
    errorMsg.textContent = `❌ ${e.message}`;
  }
});

document.getElementById('btn-copy').addEventListener('click', () => {
  const text = input.value.trim();
  if (!text) return;
  let toCopy = text;
  try { toCopy = JSON.stringify(JSON.parse(text), null, getIndent()); } catch {}
  navigator.clipboard.writeText(toCopy).then(() => {
    const btn = document.getElementById('btn-copy');
    btn.textContent = '✓ コピー済み';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'コピー'; btn.classList.remove('copied'); }, 1500);
  });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  input.value = '';
  errorMsg.textContent = '';
  outputWrapper.classList.add('hidden');
});

document.getElementById('btn-collapse-all').addEventListener('click', () => {
  output.querySelectorAll('.collapsible').forEach(el => {
    const target = document.getElementById(el.dataset.target);
    const hint = document.getElementById('hint-' + el.dataset.target);
    el.classList.add('collapsed');
    target?.classList.add('hidden');
    if (hint) hint.style.display = 'inline';
  });
});

document.getElementById('btn-expand-all').addEventListener('click', () => {
  output.querySelectorAll('.collapsible').forEach(el => {
    const target = document.getElementById(el.dataset.target);
    const hint = document.getElementById('hint-' + el.dataset.target);
    el.classList.remove('collapsed');
    target?.classList.remove('hidden');
    if (hint) hint.style.display = 'none';
  });
});

input.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') format();
});
