const inputEl  = document.getElementById('input-code');
const outputEl = document.getElementById('output-hl');
const statusEl = document.getElementById('status-msg');
const sizeEl   = document.getElementById('size-info');

function getIndent() {
  const v = document.getElementById('indent-size').value;
  return v === 'tab' ? '\t' : ' '.repeat(parseInt(v));
}

function setStatus(msg, type='') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

// ── Beautifiers ───────────────────────────────────────
function beautifyJSON(code) {
  const parsed = JSON.parse(code);
  const indent = getIndent();
  return JSON.stringify(parsed, null, indent);
}

function beautifyCSS(code) {
  const ind = getIndent();
  return code
    .replace(/\s*\{\s*/g, ' {\n' + ind)
    .replace(/\s*;\s*/g, ';\n' + ind)
    .replace(/\s*\}\s*/g, '\n}\n\n')
    .replace(/,\s*/g, ',\n')
    .trim();
}

function beautifyHTML(code) {
  const ind = getIndent();
  let depth = 0;
  const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const lines = [];
  const tokens = code
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  tokens.forEach(token => {
    if (/^<\//.test(token)) {
      depth = Math.max(0, depth - 1);
      lines.push(ind.repeat(depth) + token);
    } else if (/^<[^!?]/.test(token)) {
      lines.push(ind.repeat(depth) + token);
      const tagName = (token.match(/^<(\w+)/) || [])[1]?.toLowerCase();
      if (tagName && !VOID_TAGS.has(tagName) && !token.endsWith('/>')) depth++;
    } else {
      lines.push(ind.repeat(depth) + token);
    }
  });
  return lines.join('\n');
}

function beautifySQL(code) {
  const keywords = ['SELECT','FROM','WHERE','JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN','ON','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','CREATE TABLE','ALTER TABLE','DROP TABLE','AND','OR','NOT','IN','BETWEEN','LIKE','IS NULL','IS NOT NULL','UNION','UNION ALL','WITH','AS','DISTINCT','COUNT','SUM','AVG','MIN','MAX'];
  let result = code.trim();
  keywords.forEach(kw => {
    result = result.replace(new RegExp('\\b' + kw + '\\b', 'gi'), '\n' + kw.toUpperCase());
  });
  return result.replace(/\n+/g, '\n').trim();
}

function beautifyXML(code) {
  const ind = getIndent();
  let depth = 0; let result = '';
  const tokens = code.match(/<[^>]+>|[^<]+/g) || [];
  tokens.forEach(token => {
    if (/^<\//.test(token)) { depth = Math.max(0, depth-1); result += ind.repeat(depth) + token + '\n'; }
    else if (/^<[^?!]/.test(token) && !token.endsWith('/>') && !/<\w+[^>]*\/\s*>/.test(token)) {
      result += ind.repeat(depth) + token + '\n'; depth++;
    } else { result += ind.repeat(depth) + token.trim() + '\n'; }
  });
  return result.trim();
}

function beautifyJS(code) {
  // Basic JS formatting - handle braces, semicolons, operators
  const ind = getIndent();
  let depth = 0; let result = '';
  let inStr = false; let strChar = '';
  const lines = code.replace(/\r\n/g, '\n').split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const closes = (trimmed.match(/[}\]]/g) || []).length;
    const opens  = (trimmed.match(/[{[]/g) || []).length;
    if (trimmed.startsWith('}') || trimmed.startsWith(']')) depth = Math.max(0, depth-1);
    result += ind.repeat(depth) + trimmed + '\n';
    depth = Math.max(0, depth + opens - closes);
  });
  return result.trim();
}

// ── Minifiers ─────────────────────────────────────────
function minifyJSON(code) { return JSON.stringify(JSON.parse(code)); }
function minifyCSS(code)  { return code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,' ').replace(/\s*([{};:,>~+])\s*/g,'$1').trim(); }
function minifyHTML(code) { return code.replace(/<!--[\s\S]*?-->/g,'').replace(/\s+/g,' ').replace(/>\s+</g,'><').trim(); }
function minifySQL(code)  { return code.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,' ').trim(); }
function minifyJS(code)   { return code.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\n+/g,'\n').replace(/^\s+/gm,'').trim(); }

// ── Syntax highlight ──────────────────────────────────
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function highlightJSON(code) {
  return escHtml(code)
    .replace(/"([^"\\]|\\.)*"/g, m => `<span class="hl-str">${m}</span>`)
    .replace(/\b(true|false|null)\b/g, m => `<span class="hl-key">${m}</span>`)
    .replace(/\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, m => `<span class="hl-num">${m}</span>`);
}

function highlightCSS(code) {
  return escHtml(code)
    .replace(/(\/\*[\s\S]*?\*\/)/g, m => `<span class="hl-cmnt">${m}</span>`)
    .replace(/([a-zA-Z-]+)\s*:/g, m => `<span class="hl-prop">${m}</span>`)
    .replace(/"([^"]*)"/g, m => `<span class="hl-str">${m}</span>`)
    .replace(/#[0-9a-fA-F]{3,8}\b/g, m => `<span class="hl-num">${m}</span>`)
    .replace(/\b(\d+(?:\.\d+)?(?:px|em|rem|vh|vw|%|pt|ms|s))\b/g, m => `<span class="hl-num">${m}</span>`);
}

function highlightHTML(code) {
  return escHtml(code)
    .replace(/(&lt;\/?)(\w+)/g, (_, open, tag) => `${open}<span class="hl-tag">${tag}</span>`)
    .replace(/(\w+)=(&quot;[^&]*&quot;)/g, (_, attr, val) => `<span class="hl-prop">${attr}</span>=${val.replace(/&quot;([^&]*)&quot;/, '<span class="hl-str">&quot;$1&quot;</span>')}`)
    .replace(/&lt;!--[\s\S]*?--&gt;/g, m => `<span class="hl-cmnt">${m}</span>`);
}

function highlightSQL(code) {
  const kws = ['SELECT','FROM','WHERE','JOIN','ON','GROUP BY','ORDER BY','HAVING','LIMIT','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','ALTER','DROP','TABLE','AND','OR','NOT','IN','BETWEEN','LIKE','NULL','COUNT','SUM','AVG','MIN','MAX','DISTINCT','AS','WITH','UNION','ALL','LEFT','RIGHT','INNER'];
  let result = escHtml(code);
  kws.forEach(kw => {
    result = result.replace(new RegExp('\\b(' + kw + ')\\b', 'gi'), '<span class="hl-key">$1</span>');
  });
  return result
    .replace(/'([^']*)'/g, m => `<span class="hl-str">${m}</span>`)
    .replace(/\b(\d+)\b/g, m => `<span class="hl-num">${m}</span>`)
    .replace(/(--[^\n]*)/g, m => `<span class="hl-cmnt">${m}</span>`);
}

function highlightJS(code) {
  const kws = ['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','class','extends','import','export','default','new','delete','typeof','instanceof','in','of','try','catch','finally','throw','async','await','true','false','null','undefined','this','super'];
  let result = escHtml(code)
    .replace(/(\/\/[^\n]*)/g, m => `<span class="hl-cmnt">${m}</span>`)
    .replace(/(\/\*[\s\S]*?\*\/)/g, m => `<span class="hl-cmnt">${m}</span>`)
    .replace(/("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`)/g, m => `<span class="hl-str">${m}</span>`)
    .replace(/\b(\d+\.?\d*)\b/g, m => `<span class="hl-num">${m}</span>`);
  kws.forEach(kw => {
    result = result.replace(new RegExp('(?<![\\w$])(' + kw + ')(?![\\w$])', 'g'), '<span class="hl-key">$1</span>');
  });
  return result.replace(/\b([a-zA-Z_$][\w$]*)\s*\(/g, (m, fn) => `<span class="hl-fn">${fn}</span>(`);
}

const BEAUTIFIERS  = { json: beautifyJSON, css: beautifyCSS, html: beautifyHTML, sql: beautifySQL, xml: beautifyXML, js: beautifyJS };
const MINIFIERS    = { json: minifyJSON,   css: minifyCSS,   html: minifyHTML,  sql: minifySQL,  xml: minifyJS,    js: minifyJS };
const HIGHLIGHTERS = { json: highlightJSON, css: highlightCSS, html: highlightHTML, sql: highlightSQL, xml: highlightHTML, js: highlightJS };

const VALIDATORS = {
  json: code => { JSON.parse(code); return 'JSON は有効です'; },
  js:   code => { new Function(code); return 'JS 構文チェック OK (基本)'; },
};

const SAMPLES = {
  json: '{"name":"Alice","age":30,"hobbies":["coding","music"],"address":{"city":"Tokyo","zip":"100-0001"}}',
  js:   'function greet(name){const msg="Hello, "+name+"!";console.log(msg);return msg;}const result=greet("World");',
  css:  'body{margin:0;padding:0;font-family:sans-serif;}.container{max-width:1200px;margin:0 auto;padding:0 16px;}h1{color:#333;font-size:2rem;}',
  html: '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Test</title></head><body><h1>Hello</h1><p>World</p></body></html>',
  sql:  'SELECT u.id,u.name,COUNT(o.id) AS order_count FROM users u LEFT JOIN orders o ON u.id=o.user_id WHERE u.active=1 GROUP BY u.id ORDER BY order_count DESC LIMIT 10;',
  xml:  '<?xml version="1.0"?><root><user id="1"><name>Alice</name><email>alice@example.com</email></user></root>',
};

function run(mode) {
  const lang = document.getElementById('lang-select').value;
  const code = inputEl.value.trim();
  if (!code) { setStatus('コードを入力してください', ''); return; }

  try {
    let result;
    if (mode === 'beautify') result = BEAUTIFIERS[lang](code);
    else if (mode === 'minify') result = MINIFIERS[lang](code);
    else if (mode === 'validate') {
      const validator = VALIDATORS[lang];
      if (!validator) { setStatus(`${lang.toUpperCase()} の検証はサポートされていません`); return; }
      setStatus(validator(code), 'ok');
      return;
    }

    const hl = HIGHLIGHTERS[lang];
    outputEl.innerHTML = hl ? hl(result) : escHtml(result);

    const origSize = new Blob([code]).size;
    const newSize  = new Blob([result]).size;
    const ratio = ((1 - newSize/origSize) * 100).toFixed(1);
    const changeStr = mode === 'minify'
      ? ` (${ratio > 0 ? '-'+ratio+'%' : '+'+Math.abs(ratio)+'%'})`
      : '';
    setStatus(mode === 'beautify' ? `✨ 整形完了${changeStr}` : `📦 最小化完了${changeStr}`, 'ok');
    sizeEl.textContent = `${origSize}B → ${newSize}B`;
    chrome.storage.local.set({ [lang + '_last']: code });
  } catch(e) {
    setStatus('❌ ' + e.message, 'error');
    outputEl.textContent = '';
  }
}

document.getElementById('btn-beautify').addEventListener('click', () => run('beautify'));
document.getElementById('btn-minify').addEventListener('click',   () => run('minify'));
document.getElementById('btn-validate').addEventListener('click', () => run('validate'));

document.getElementById('btn-paste').addEventListener('click', async () => {
  try { inputEl.value = await navigator.clipboard.readText(); run('beautify'); } catch {}
});

document.getElementById('btn-clear-in').addEventListener('click', () => {
  inputEl.value = ''; outputEl.innerHTML = ''; setStatus(''); sizeEl.textContent = '';
});

document.getElementById('btn-sample').addEventListener('click', () => {
  const lang = document.getElementById('lang-select').value;
  inputEl.value = SAMPLES[lang] || '';
  run('beautify');
});

document.getElementById('btn-copy-out').addEventListener('click', function() {
  const text = outputEl.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    this.textContent = '✓ コピー済み'; this.classList.add('copied');
    setTimeout(() => { this.textContent = 'コピー'; this.classList.remove('copied'); }, 1500);
  });
});

document.getElementById('btn-swap').addEventListener('click', () => {
  const outText = outputEl.textContent;
  if (outText) { inputEl.value = outText; run('beautify'); }
});

// Auto-detect language from content
document.getElementById('lang-select').addEventListener('change', () => {
  if (inputEl.value) run('beautify');
});

// Keyboard shortcut
inputEl.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run('beautify');
  if ((e.ctrlKey || e.metaKey) && e.key === 'm') { e.preventDefault(); run('minify'); }
  // Tab key inserts spaces
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = inputEl.selectionStart, end = inputEl.selectionEnd;
    const ind = document.getElementById('indent-size').value === 'tab' ? '\t' : '  ';
    inputEl.value = inputEl.value.slice(0, start) + ind + inputEl.value.slice(end);
    inputEl.selectionStart = inputEl.selectionEnd = start + ind.length;
  }
});

// Restore
chrome.storage.local.get(['beautifier_last_lang'], d => {
  if (d.beautifier_last_lang) document.getElementById('lang-select').value = d.beautifier_last_lang;
});
document.getElementById('lang-select').addEventListener('change', e => {
  chrome.storage.local.set({ beautifier_last_lang: e.target.value });
});
