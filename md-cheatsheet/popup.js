const CHEATSHEET = [
  // 見出し
  { cat:'見出し', syntax:'# H1', label:'H1 見出し', desc:'最大見出し（ページタイトル）' },
  { cat:'見出し', syntax:'## H2', label:'H2 見出し', desc:'セクション見出し' },
  { cat:'見出し', syntax:'### H3', label:'H3 見出し', desc:'サブセクション見出し' },
  { cat:'見出し', syntax:'#### H4 ##### H5 ###### H6', label:'H4〜H6', desc:'小見出し' },
  // 強調
  { cat:'強調', syntax:'**太字**', label:'太字', desc:'アスタリスク2つで囲む' },
  { cat:'強調', syntax:'*斜体*', label:'斜体 (Italic)', desc:'アスタリスク1つで囲む' },
  { cat:'強調', syntax:'~~取り消し~~', label:'取り消し線', desc:'チルダ2つで囲む' },
  { cat:'強調', syntax:'==ハイライト==', label:'ハイライト', desc:'等号2つ (一部対応)' },
  { cat:'強調', syntax:'**_太字斜体_**', label:'太字＋斜体', desc:'組み合わせ' },
  // リスト
  { cat:'リスト', syntax:'- 項目1\n- 項目2\n  - ネスト', label:'箇条書きリスト', desc:'- または * または + で開始' },
  { cat:'リスト', syntax:'1. 項目1\n2. 項目2\n3. 項目3', label:'番号付きリスト', desc:'数字とピリオドで開始' },
  { cat:'リスト', syntax:'- [x] 完了タスク\n- [ ] 未完了タスク', label:'タスクリスト', desc:'GitHub Flavored Markdown' },
  // リンク・画像
  { cat:'リンク', syntax:'[テキスト](https://url.com)', label:'リンク', desc:'[]にテキスト、()にURL' },
  { cat:'リンク', syntax:'[テキスト](url "タイトル")', label:'タイトル付きリンク', desc='ホバーで表示されるタイトル' },
  { cat:'リンク', syntax:'![代替テキスト](image.png)', label:'画像', desc:'!を先頭に付ける' },
  { cat:'リンク', syntax:'<https://url.com>', label:'自動リンク', desc:'<>で囲む' },
  { cat:'リンク', syntax:'[参照リンク][id]\n[id]: https://url.com', label:'参照リンク', desc:'定義を別の場所に記述' },
  // コード
  { cat:'コード', syntax:'`インラインコード`', label:'インラインコード', desc:'バッククォートで囲む' },
  { cat:'コード', syntax:'```javascript\nconst x = 1;\n```', label:'コードブロック', desc:'言語名で構文ハイライト' },
  { cat:'コード', syntax:'```\nコード\n```', label:'汎用コードブロック', desc:'言語なし' },
  // テーブル
  { cat:'テーブル', syntax:'| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| A   | B   | C   |', label:'テーブル', desc:'| で列を区切る' },
  { cat:'テーブル', syntax:'| 左寄せ | 中央 | 右寄せ |\n|:-----|:---:|----:|\n| A | B | C |', label:'テーブル (整列)', desc=':で整列方向を指定' },
  // 引用・区切り
  { cat:'その他', syntax:'> 引用文\n> 続き', label:'ブロック引用', desc:'>で開始' },
  { cat:'その他', syntax:'---', label:'水平線', desc:'--- または *** または ___' },
  { cat:'その他', syntax:'\\*エスケープ\\*', label:'エスケープ', desc:'\\でMarkdown記号を無効化' },
  { cat:'その他', syntax:'<!-- コメント -->', label:'HTMLコメント', desc:'レンダリングされない' },
  // 脚注・定義
  { cat:'拡張', syntax:'テキスト[^1]\n\n[^1]: 脚注の内容', label:'脚注', desc:'GitHub/Pandoc対応' },
  { cat:'拡張', syntax:'用語\n: 定義', label:'定義リスト', desc:'一部の実装でサポート' },
  { cat:'拡張', syntax:'```mermaid\ngraph LR\n  A --> B\n```', label:'Mermaid図', desc:'GitHub/Notion等でサポート' },
  { cat:'拡張', syntax:'$$\nE = mc^2\n$$', label:'数式 (LaTeX)', desc:'KaTeX/MathJax対応環境' },
];

const CATEGORIES = [...new Set(CHEATSHEET.map(c => c.cat))];
let currentCat = '全て';
let searchQ = '';

// ── Category tabs ──────────────────────────────────────
const catTabs = document.getElementById('cat-tabs');
['全て', ...CATEGORIES].forEach(cat => {
  const btn = document.createElement('button');
  btn.className = 'cat-tab' + (cat === '全て' ? ' active' : '');
  btn.textContent = cat;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCat = cat;
    renderCheatsheet();
  });
  catTabs.appendChild(btn);
});

// ── Render ────────────────────────────────────────────
function renderCheatsheet() {
  const grid = document.getElementById('cheat-grid');
  grid.innerHTML = '';
  const items = CHEATSHEET.filter(item => {
    const matchCat = currentCat === '全て' || item.cat === currentCat;
    const matchSearch = !searchQ || item.label.toLowerCase().includes(searchQ) ||
                        item.syntax.toLowerCase().includes(searchQ) ||
                        item.desc.toLowerCase().includes(searchQ);
    return matchCat && matchSearch;
  });

  if (!items.length) { grid.innerHTML = '<div style="color:#30363d;font-size:12px;padding:12px">見つかりません</div>'; return; }

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cheat-item';
    div.innerHTML = `
      <div class="cheat-syntax">${esc(item.syntax)}</div>
      <div class="cheat-right">
        <div class="cheat-label">${esc(item.label)}</div>
        <div class="cheat-desc">${esc(item.desc)}</div>
        <div class="cheat-copy-hint">クリックでコピー</div>
      </div>
    `;
    div.addEventListener('click', () => {
      navigator.clipboard.writeText(item.syntax).then(() => {
        div.classList.add('copied');
        div.querySelector('.cheat-copy-hint').textContent = '✓ コピー済み';
        setTimeout(() => {
          div.classList.remove('copied');
          div.querySelector('.cheat-copy-hint').textContent = 'クリックでコピー';
        }, 1200);
      });
    });
    grid.appendChild(div);
  });
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Search ────────────────────────────────────────────
document.getElementById('search-input').addEventListener('input', e => {
  searchQ = e.target.value.toLowerCase();
  renderCheatsheet();
});

// ── Preview ───────────────────────────────────────────
document.getElementById('preview-toggle').addEventListener('change', e => {
  const panel = document.getElementById('preview-panel');
  panel.classList.toggle('hidden', !e.target.checked);
  const grid = document.getElementById('cheat-grid');
  grid.style.maxHeight = e.target.checked ? '180px' : '360px';
});

document.getElementById('btn-clear-preview').addEventListener('click', () => {
  document.getElementById('preview-input').value = '';
  document.getElementById('preview-output').innerHTML = '';
});

document.getElementById('preview-input').addEventListener('input', e => {
  document.getElementById('preview-output').innerHTML = mdToHtml(e.target.value);
});

function mdToHtml(text) {
  let h = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_,lang,code) => `<pre><code class="lang-${lang}">${code}</code></pre>`);
  h = h.replace(/`([^`]+)`/g,'<code>$1</code>');
  h = h.replace(/^#{6} (.+)$/gm,'<h6>$1</h6>').replace(/^#{5} (.+)$/gm,'<h5>$1</h5>').replace(/^#{4} (.+)$/gm,'<h4>$1</h4>');
  h = h.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h = h.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  h = h.replace(/~~(.+?)~~/g,'<del>$1</del>').replace(/==(.+?)==/g,'<mark>$1</mark>');
  h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%">');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
  h = h.replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>');
  h = h.replace(/^- \[x\] (.+)$/gm,'<li><input type="checkbox" checked disabled> $1</li>');
  h = h.replace(/^- \[ \] (.+)$/gm,'<li><input type="checkbox" disabled> $1</li>');
  h = h.replace(/^[-*] (.+)$/gm,'<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>');
  h = h.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  h = h.replace(/^(?:---|\*\*\*|___)$/gm,'<hr>');
  h = h.replace(/^(?!<[huplbi]|<blockquote|<pre|<hr)(.+)$/gm,(m,p)=>p.trim()?`<p>${p}</p>`:m);
  h = h.replace(/<\/ul>\s*<ul>/g,'');
  return h;
}

// ── Init ──────────────────────────────────────────────
renderCheatsheet();
