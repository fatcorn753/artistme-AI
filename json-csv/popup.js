let mode = 'json2csv'; // 'json2csv' | 'csv2json'

const inputEl    = document.getElementById('input-area');
const outputEl   = document.getElementById('output-area');
const errorEl    = document.getElementById('error-msg');
const previewSec = document.getElementById('preview-section');
const tableEl    = document.getElementById('preview-table');
const inputLabel = document.getElementById('input-label');
const outputLabel= document.getElementById('output-label');

// ── JSON → CSV ────────────────────────────────────────
function jsonToCSV(json, delim, includeHeader) {
  let data;
  try { data = JSON.parse(json); } catch(e) { throw new Error('JSONの解析エラー: ' + e.message); }

  if (!Array.isArray(data)) {
    // If object, wrap in array
    if (typeof data === 'object' && data !== null) data = [data];
    else throw new Error('JSONの配列またはオブジェクトを入力してください');
  }
  if (data.length === 0) throw new Error('空の配列です');

  // Collect all keys
  const keys = [...new Set(data.flatMap(obj => Object.keys(obj || {})))];
  if (keys.length === 0) throw new Error('オブジェクトにキーがありません');

  const escapeCell = (val) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(delim) || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const rows = data.map(obj => keys.map(k => escapeCell(obj?.[k])));
  const lines = rows.map(r => r.join(delim));
  if (includeHeader) lines.unshift(keys.map(k => escapeCell(k)).join(delim));
  return { csv: lines.join('\n'), keys, rows };
}

// ── CSV → JSON ────────────────────────────────────────
function csvToJSON(csv, delim, hasHeader, pretty) {
  const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error('CSVが空です');

  const parseRow = (line) => {
    const cells = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === delim && !inQ) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return cells.map(c => c.trim());
  };

  let headers, dataRows;
  if (hasHeader) {
    headers  = parseRow(lines[0]);
    dataRows = lines.slice(1).map(parseRow);
  } else {
    const firstRow = parseRow(lines[0]);
    headers  = firstRow.map((_, i) => `col${i+1}`);
    dataRows = lines.map(parseRow);
  }

  const data = dataRows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  );

  return { json: pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data), headers, rows: dataRows };
}

// ── Convert ───────────────────────────────────────────
function convert() {
  const input = inputEl.value.trim();
  if (!input) { outputEl.value = ''; previewSec.classList.add('hidden'); return; }

  const delim       = document.getElementById('delimiter').value;
  const hasHeader   = document.getElementById('include-header').checked;
  const prettyJson  = document.getElementById('pretty-json').checked;
  errorEl.classList.add('hidden');
  previewSec.classList.add('hidden');

  try {
    if (mode === 'json2csv') {
      const { csv, keys, rows } = jsonToCSV(input, delim, hasHeader);
      outputEl.value = csv;
      renderPreview(keys, rows);
    } else {
      const { json, headers, rows } = csvToJSON(input, delim, hasHeader, prettyJson);
      outputEl.value = json;
      renderPreview(headers, rows);
    }
  } catch(e) {
    errorEl.textContent = '❌ ' + e.message;
    errorEl.classList.remove('hidden');
    outputEl.value = '';
  }
}

function renderPreview(headers, rows) {
  tableEl.innerHTML = '';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr>' + headers.map(h => `<th>${escHtml(h)}</th>`).join('') + '</tr>';
  tableEl.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.slice(0, 5).forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = headers.map((_,i) => `<td title="${escHtml(row[i]||'')}">${escHtml(row[i]||'')}</td>`).join('');
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
  previewSec.classList.remove('hidden');
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Mode switching ────────────────────────────────────
document.getElementById('btn-json2csv').addEventListener('click', () => {
  mode = 'json2csv';
  document.getElementById('btn-json2csv').classList.add('active');
  document.getElementById('btn-csv2json').classList.remove('active');
  inputLabel.textContent = 'JSON 入力';
  outputLabel.textContent = 'CSV 出力';
  inputEl.placeholder = '[{"name":"田中","age":28},{"name":"佐藤","age":34}]';
  outputEl.value = ''; inputEl.value = '';
  previewSec.classList.add('hidden');
  errorEl.classList.add('hidden');
});

document.getElementById('btn-csv2json').addEventListener('click', () => {
  mode = 'csv2json';
  document.getElementById('btn-csv2json').classList.add('active');
  document.getElementById('btn-json2csv').classList.remove('active');
  inputLabel.textContent = 'CSV 入力';
  outputLabel.textContent = 'JSON 出力';
  inputEl.placeholder = 'name,age\n田中,28\n佐藤,34';
  outputEl.value = ''; inputEl.value = '';
  previewSec.classList.add('hidden');
  errorEl.classList.add('hidden');
});

document.getElementById('btn-swap').addEventListener('click', () => {
  const tmp = inputEl.value;
  inputEl.value = outputEl.value;
  outputEl.value = tmp;
  // Toggle mode
  if (mode === 'json2csv') document.getElementById('btn-csv2json').click();
  else document.getElementById('btn-json2csv').click();
  if (inputEl.value) convert();
});

// ── Events ────────────────────────────────────────────
document.getElementById('btn-convert').addEventListener('click', convert);
inputEl.addEventListener('input', () => {
  clearTimeout(inputEl._t);
  inputEl._t = setTimeout(convert, 400);
});
['delimiter','include-header','pretty-json'].forEach(id =>
  document.getElementById(id).addEventListener('change', convert));

document.getElementById('btn-copy-out').addEventListener('click', function() {
  if (!outputEl.value) return;
  navigator.clipboard.writeText(outputEl.value).then(() => {
    this.textContent = '✓ コピー済み'; this.classList.add('copied');
    setTimeout(() => { this.textContent = 'コピー'; this.classList.remove('copied'); }, 1500);
  });
});

document.getElementById('btn-download').addEventListener('click', () => {
  if (!outputEl.value) return;
  const ext = mode === 'json2csv' ? 'csv' : 'json';
  const mime = mode === 'json2csv' ? 'text/csv' : 'application/json';
  const blob = new Blob([outputEl.value], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `converted.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
});
