const sqlInput   = document.getElementById('sql-input');
const resultArea = document.getElementById('result-area');

const SNIPPETS = {
  select: 'SELECT * FROM users LIMIT 10;',
  create: `CREATE TABLE products (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  price REAL,\n  stock INTEGER\n);`,
  insert: `INSERT INTO users (name, email, age)\nVALUES ('田中太郎', 'tanaka@example.com', 28);`,
  update: `UPDATE users\nSET email = 'new@example.com'\nWHERE id = 1;`,
  delete: `DELETE FROM users WHERE id = 1;`,
  join:   `SELECT u.name, o.product, o.amount\nFROM users u\nJOIN orders o ON u.id = o.user_id\nORDER BY o.amount DESC;`,
  agg:    `SELECT category, COUNT(*) AS cnt, AVG(price) AS avg_price\nFROM products\nGROUP BY category\nORDER BY cnt DESC;`,
};

const SAMPLE_SQL = `
CREATE TABLE users (id INTEGER, name TEXT, email TEXT, age INTEGER, city TEXT);
INSERT INTO users VALUES
  (1,'田中太郎','tanaka@example.com',28,'東京'),
  (2,'佐藤花子','sato@example.com',34,'大阪'),
  (3,'鈴木一郎','suzuki@example.com',25,'名古屋'),
  (4,'高橋美咲','takahashi@example.com',42,'東京'),
  (5,'伊藤健司','ito@example.com',31,'福岡');

CREATE TABLE orders (id INTEGER, user_id INTEGER, product TEXT, amount INTEGER, date TEXT);
INSERT INTO orders VALUES
  (1,1,'ノートPC',150000,'2026-01-15'),
  (2,2,'スマートフォン',85000,'2026-01-20'),
  (3,1,'マウス',3500,'2026-02-01'),
  (4,3,'キーボード',12000,'2026-02-10'),
  (5,4,'モニター',45000,'2026-02-15'),
  (6,2,'タブレット',60000,'2026-03-01');

CREATE TABLE products (id INTEGER, name TEXT, category TEXT, price REAL, stock INTEGER);
INSERT INTO products VALUES
  (1,'ノートPC','電子機器',150000,10),
  (2,'スマートフォン','電子機器',85000,25),
  (3,'マウス','周辺機器',3500,100),
  (4,'キーボード','周辺機器',12000,50),
  (5,'モニター','電子機器',45000,15),
  (6,'タブレット','電子機器',60000,20);
`;

// ── Execute ────────────────────────────────────────────
function runSQL() {
  const sql = sqlInput.value.trim();
  if (!sql) return;
  const t0 = performance.now();
  const result = db.run(sql);
  const elapsed = (performance.now() - t0).toFixed(1);

  if (!result) { resultArea.innerHTML = '<div class="result-placeholder">結果なし</div>'; return; }

  if (result.error) {
    resultArea.innerHTML = `<div class="result-success"><div class="result-meta error-meta">❌ エラー</div><div class="error-box">${esc(result.error)}</div></div>`;
    return;
  }

  if (result.columns) {
    const cols = result.columns;
    const rows = result.rows;
    resultArea.innerHTML = `
      <div class="result-success">
        <div class="result-meta">✅ ${rows.length}件 | ${elapsed}ms</div>
        <div class="result-table-wrap">
          <table class="result-table">
            <thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row=>`<tr>${row.map(v=>cellHtml(v)).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  } else {
    const icon = result.rowsAffected > 0 ? '✅' : 'ℹ️';
    resultArea.innerHTML = `<div class="result-success"><div class="result-meta">${icon} ${esc(result.message)} (${elapsed}ms)</div></div>`;
    if (result.tableModified) refreshSchema();
  }
}

function cellHtml(v) {
  if (v === null) return `<td><span class="null-val">NULL</span></td>`;
  if (typeof v === 'number') return `<td><span class="num-val">${v}</span></td>`;
  return `<td><span class="str-val">${esc(String(v))}</span></td>`;
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Schema ────────────────────────────────────────────
function refreshSchema() {
  const list = document.getElementById('schema-list');
  list.innerHTML = '';
  const schema = db.getSchema();
  if (!schema.length) { list.innerHTML = '<div style="color:#30363d;font-size:11px;padding:8px">テーブルなし</div>'; return; }
  schema.forEach(tbl => {
    const div = document.createElement('div');
    div.className = 'schema-table';
    div.innerHTML = `<div class="schema-table-name" title="SELECT * FROM ${tbl.name}">📋 ${tbl.name} <span style="color:#484f58">(${tbl.rowCount})</span></div>` +
      tbl.cols.map(c=>`<div class="schema-col">${esc(c.name)} <span class="col-type">${esc(c.type)}</span></div>`).join('');
    div.querySelector('.schema-table-name').addEventListener('click', () => {
      sqlInput.value = `SELECT * FROM ${tbl.name} LIMIT 20;`; runSQL();
    });
    list.appendChild(div);
  });
}

// ── Format SQL ────────────────────────────────────────
function formatSQL(sql) {
  const keywords = ['SELECT','FROM','WHERE','JOIN','LEFT JOIN','RIGHT JOIN','ON','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','AND','OR','NOT','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','CREATE TABLE','DROP TABLE'];
  let result = sql.trim();
  keywords.forEach(kw => {
    result = result.replace(new RegExp(`\\b${kw}\\b`,'gi'), '\n'+kw.toUpperCase());
  });
  return result.replace(/\n+/g,'\n').replace(/^\n/,'');
}

// ── Events ────────────────────────────────────────────
document.getElementById('btn-run').addEventListener('click', runSQL);
sqlInput.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key==='Enter') { e.preventDefault(); runSQL(); }
  if (e.key==='Tab') { e.preventDefault(); const s=sqlInput.selectionStart; sqlInput.value=sqlInput.value.slice(0,s)+'  '+sqlInput.value.slice(s); sqlInput.selectionStart=sqlInput.selectionEnd=s+2; }
});

document.getElementById('btn-format').addEventListener('click', () => { sqlInput.value = formatSQL(sqlInput.value); });
document.getElementById('btn-copy-sql').addEventListener('click', () => { navigator.clipboard.writeText(sqlInput.value); });

document.getElementById('snippet-select').addEventListener('change', e => {
  if (e.target.value && SNIPPETS[e.target.value]) { sqlInput.value = SNIPPETS[e.target.value]; e.target.value=''; }
});

document.getElementById('btn-sample').addEventListener('click', () => {
  db.run(SAMPLE_SQL); refreshSchema();
  sqlInput.value='SELECT * FROM users;'; runSQL();
});

document.getElementById('btn-export').addEventListener('click', () => {
  const res = db.run(sqlInput.value.trim());
  if (!res || !res.columns) { alert('SELECT文を実行してからエクスポートしてください'); return; }
  const csv = [res.columns.join(','), ...res.rows.map(r=>r.map(v=>v===null?'':`"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='result.csv'; a.click();
});

document.getElementById('btn-clear-db').addEventListener('click', () => {
  if (confirm('データベースをリセットしますか？')) { window.db=new SQLEngine(); refreshSchema(); resultArea.innerHTML='<div class="result-placeholder">DBをリセットしました</div>'; }
});

// ── Init ─────────────────────────────────────────────
refreshSchema();
sqlInput.value = '-- Ctrl+Enter で実行 | サンプルDBボタンでデータを準備\nSELECT \'Hello, SQL!\' AS message;';
