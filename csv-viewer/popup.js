let parsedData = { headers: [], rows: [] };
let sortCol = -1, sortAsc = true;
let filteredRows = [];

// ── CSV Parser ──
function parseCSV(text, delim = ',') {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };

  const parse = (line) => {
    const result = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === delim && !inQ) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parse(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(parse);
  return { headers, rows };
}

// ── Stats ──
function computeStats(headers, rows) {
  const stats = headers.map((h, i) => {
    const vals = rows.map(r => r[i] || '').filter(v => v !== '');
    const nums = vals.map(Number).filter(v => !isNaN(v) && v !== '');
    return {
      col: h,
      count: vals.length,
      numeric: nums.length,
      min: nums.length ? Math.min(...nums) : null,
      max: nums.length ? Math.max(...nums) : null,
      avg: nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null,
    };
  });
  return stats;
}

function renderStats(stats) {
  const bar = document.getElementById('stats-bar');
  bar.innerHTML = stats.slice(0, 4).map(s => {
    if (s.numeric > 0 && s.avg !== null) {
      return `<span class="stat-item">${s.col}: min=<span>${s.min}</span> max=<span>${s.max}</span> avg=<span>${s.avg.toFixed(2)}</span></span>`;
    }
    return `<span class="stat-item">${s.col}: <span>${s.count}</span>件</span>`;
  }).join('');
}

// ── Table render ──
function renderTable(rows, query = '') {
  const thead = document.getElementById('csv-thead');
  const tbody = document.getElementById('csv-tbody');
  const { headers } = parsedData;

  // Headers
  thead.innerHTML = '<tr>' + headers.map((h, i) => {
    const cls = sortCol === i ? (sortAsc ? 'asc' : 'desc') : '';
    return `<th class="${cls}" data-col="${i}">${h}<span class="sort-icon"></span></th>`;
  }).join('') + '</tr>';

  thead.querySelectorAll('th').forEach(th => {
    th.addEventListener('click', () => {
      const col = parseInt(th.dataset.col);
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = true; }
      applyFilterSort(query);
    });
  });

  // Body
  function hl(text, q) {
    if (!q) return escHtml(text);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    return escHtml(text).replace(re, m => `<mark class="highlight">${m}</mark>`);
  }

  tbody.innerHTML = rows.map(row =>
    '<tr>' + headers.map((_, i) => `<td title="${escHtml(row[i]||'')}">${hl(row[i]||'', query)}</td>`).join('') + '</tr>'
  ).join('');

  document.getElementById('row-count').textContent = `${rows.length} / ${parsedData.rows.length} 行`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function applyFilterSort(query = document.getElementById('search-input').value) {
  let rows = [...parsedData.rows];

  if (query) {
    const q = query.toLowerCase();
    rows = rows.filter(row => row.some(cell => (cell||'').toLowerCase().includes(q)));
  }

  if (sortCol >= 0) {
    rows.sort((a, b) => {
      const av = a[sortCol] || '', bv = b[sortCol] || '';
      const an = parseFloat(av), bn = parseFloat(bv);
      const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : av.localeCompare(bv, 'ja');
      return sortAsc ? cmp : -cmp;
    });
  }

  filteredRows = rows;
  renderTable(rows, query);
}

// ── Parsing flow ──
function showTable() {
  document.getElementById('input-section').classList.add('hidden');
  document.getElementById('table-section').classList.remove('hidden');
}

function showInput() {
  document.getElementById('table-section').classList.add('hidden');
  document.getElementById('input-section').classList.remove('hidden');
}

document.getElementById('btn-parse').addEventListener('click', () => {
  const text = document.getElementById('csv-input').value.trim();
  const delim = document.getElementById('delimiter').value;
  const errEl = document.getElementById('parse-error');

  if (!text) { errEl.textContent = 'CSVテキストを入力してください'; return; }

  try {
    parsedData = parseCSV(text, delim);
    if (!parsedData.headers.length) { errEl.textContent = 'データが見つかりません'; return; }
    errEl.textContent = '';
    sortCol = -1; sortAsc = true;
    renderStats(computeStats(parsedData.headers, parsedData.rows));
    applyFilterSort('');
    showTable();
    chrome.storage.local.set({ lastCsv: text, lastDelim: delim });
  } catch (e) {
    errEl.textContent = '❌ ' + e.message;
  }
});

document.getElementById('btn-back').addEventListener('click', showInput);

document.getElementById('btn-clear').addEventListener('click', () => {
  document.getElementById('csv-input').value = '';
  parsedData = { headers: [], rows: [] };
  showInput();
  chrome.storage.local.remove(['lastCsv', 'lastDelim']);
});

document.getElementById('search-input').addEventListener('input', (e) => applyFilterSort(e.target.value));

document.getElementById('btn-copy-csv').addEventListener('click', function() {
  const text = [parsedData.headers, ...filteredRows].map(r => r.join(',')).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    this.textContent = '✓ コピー済み'; this.classList.add('copied');
    setTimeout(() => { this.textContent = 'コピー'; this.classList.remove('copied'); }, 1500);
  });
});

// File open
document.getElementById('btn-open').addEventListener('click', () => {
  document.getElementById('file-input').click();
});
document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('csv-input').value = ev.target.result;
    if (file.name.endsWith('.tsv')) document.getElementById('delimiter').value = '\t';
    document.getElementById('btn-parse').click();
  };
  reader.readAsText(file, 'UTF-8');
});

// Restore
chrome.storage.local.get(['lastCsv', 'lastDelim'], (data) => {
  if (data.lastCsv) {
    document.getElementById('csv-input').value = data.lastCsv;
    if (data.lastDelim) document.getElementById('delimiter').value = data.lastDelim;
  }
});
