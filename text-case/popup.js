// ── Transform definitions ─────────────────────────────
const TRANSFORMS = [
  // Case
  { id: 'upper',       label: '大文字 (UPPER CASE)',    cat: 'case',   fn: s => s.toUpperCase() },
  { id: 'lower',       label: '小文字 (lower case)',    cat: 'case',   fn: s => s.toLowerCase() },
  { id: 'title',       label: 'Title Case',             cat: 'case',   fn: s => s.replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()) },
  { id: 'sentence',    label: 'Sentence case',          cat: 'case',   fn: s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() },
  { id: 'alternating', label: 'aLtErNaTiNg CaSe',      cat: 'case',   fn: s => [...s].map((c,i) => i%2===0 ? c.toLowerCase() : c.toUpperCase()).join('') },
  { id: 'inverse',     label: 'iNVERSE cASE',           cat: 'case',   fn: s => [...s].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('') },
  // Code
  { id: 'camel',       label: 'camelCase',              cat: 'code',   fn: s => s.trim().split(/[\s_\-]+/).map((w,i) => i===0 ? w.toLowerCase() : w[0].toUpperCase()+w.slice(1).toLowerCase()).join('') },
  { id: 'pascal',      label: 'PascalCase',             cat: 'code',   fn: s => s.trim().split(/[\s_\-]+/).map(w => w[0].toUpperCase()+w.slice(1).toLowerCase()).join('') },
  { id: 'snake',       label: 'snake_case',             cat: 'code',   fn: s => s.trim().replace(/[A-Z]/g, m => '_'+m).replace(/[\s\-]+/g,'_').replace(/^_/,'').toLowerCase() },
  { id: 'screaming',   label: 'SCREAMING_SNAKE',        cat: 'code',   fn: s => s.trim().replace(/[A-Z]/g, m => '_'+m).replace(/[\s\-]+/g,'_').replace(/^_/,'').toUpperCase() },
  { id: 'kebab',       label: 'kebab-case',             cat: 'code',   fn: s => s.trim().replace(/[A-Z]/g, m => '-'+m).replace(/[\s_]+/g,'-').replace(/^-/,'').toLowerCase() },
  { id: 'cobol',       label: 'COBOL-CASE',             cat: 'code',   fn: s => s.trim().replace(/[A-Z]/g, m => '-'+m).replace(/[\s_]+/g,'-').replace(/^-/,'').toUpperCase() },
  { id: 'dot',         label: 'dot.case',               cat: 'code',   fn: s => s.trim().replace(/[A-Z]/g, m => '.'+m).replace(/[\s_\-]+/g,'.').replace(/^\./,'').toLowerCase() },
  { id: 'path',        label: 'path/case',              cat: 'code',   fn: s => s.trim().replace(/[A-Z]/g, m => '/'+m).replace(/[\s_\-]+/g,'/').replace(/^\//,'').toLowerCase() },
  { id: 'slug',        label: 'url-slug',               cat: 'code',   fn: s => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') },
  { id: 'constant',    label: 'CONSTANT_CASE',          cat: 'code',   fn: s => s.trim().toUpperCase().replace(/[\s\-]+/g,'_') },
  // Encode/Transform
  { id: 'reverse',     label: '逆順テキスト',            cat: 'encode', fn: s => [...s].reverse().join('') },
  { id: 'rot13',       label: 'ROT-13 暗号',            cat: 'encode', fn: s => s.replace(/[a-zA-Z]/g, c => { const base = c<='Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0)-base+13)%26+base); }) },
  { id: 'base64enc',   label: 'Base64 エンコード',       cat: 'encode', fn: s => btoa(unescape(encodeURIComponent(s))) },
  { id: 'base64dec',   label: 'Base64 デコード',         cat: 'encode', fn: s => { try { return decodeURIComponent(escape(atob(s))); } catch { return '(デコードエラー)'; } } },
  { id: 'urlenc',      label: 'URL エンコード',          cat: 'encode', fn: s => encodeURIComponent(s) },
  { id: 'urldec',      label: 'URL デコード',           cat: 'encode', fn: s => { try { return decodeURIComponent(s); } catch { return s; } } },
  { id: 'html_esc',    label: 'HTML エスケープ',         cat: 'encode', fn: s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') },
  { id: 'html_unesc',  label: 'HTML アンエスケープ',     cat: 'encode', fn: s => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"') },
  { id: 'morse',       label: 'モールス信号',            cat: 'encode', fn: morseEncode },
  { id: 'binary',      label: 'バイナリ (ASCII)',        cat: 'encode', fn: s => [...s].map(c => c.charCodeAt(0).toString(2).padStart(8,'0')).join(' ') },
  { id: 'hex_enc',     label: 'HEX エンコード',         cat: 'encode', fn: s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join('') },
  { id: 'char_count',  label: '文字数カウント',          cat: 'encode', fn: s => `${s.length}文字 / ${s.split(/\s+/).filter(Boolean).length}語 / ${s.replace(/\s/g,'').length}文字(SP除く)` },
  // Japanese
  { id: 'zenkaku',     label: '半角→全角',               cat: 'jp',     fn: s => s.replace(/[!-~]/g, c => String.fromCharCode(c.charCodeAt(0)+0xFEE0)).replace(' ','　') },
  { id: 'hankaku',     label: '全角→半角',               cat: 'jp',     fn: s => s.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace('　',' ') },
  { id: 'remove_space',label: '空白を除去',               cat: 'jp',     fn: s => s.replace(/[\s　]+/g,'') },
  { id: 'trim_lines',  label: '各行をトリム',            cat: 'jp',     fn: s => s.split('\n').map(l=>l.trim()).join('\n') },
  { id: 'remove_blank',label: '空白行を削除',            cat: 'jp',     fn: s => s.split('\n').filter(l=>l.trim()).join('\n') },
  // Fun
  { id: 'upside',      label: 'ʇxǝʇ uʍop ǝpısdn',      cat: 'fun',    fn: upsideDown },
  { id: 'zalgo',       label: 'Z̴̢͓͍̫a̴̘͒l̵̤̒g̴̝̓o̴͕̎ text', cat: 'fun',    fn: zalgoText },
  { id: 'stars',       label: '★★ スター装飾 ★★',        cat: 'fun',    fn: s => `★ ${s} ★` },
  { id: 'emoji_boxes', label: '🔲 ボックス装飾',          cat: 'fun',    fn: s => `『 ${s} 』` },
  { id: 'wave',        label: '〜波線装飾〜',             cat: 'fun',    fn: s => `〜 ${s} 〜` },
  { id: 'shuffle',     label: 'シャッフル (ランダム)',    cat: 'fun',    fn: s => [...s].sort(()=>Math.random()-0.5).join('') },
  { id: 'repeat',      label: '3回繰り返し',             cat: 'fun',    fn: s => `${s} ${s} ${s}` },
  { id: 'leet',        label: '1337 スピーク',           cat: 'fun',    fn: s => s.replace(/a/gi,'4').replace(/e/gi,'3').replace(/i/gi,'1').replace(/o/gi,'0').replace(/t/gi,'7').replace(/s/gi,'5') },
];

const MORSE = {a:'.-',b:'-...',c:'-.-.',d:'-..',e:'.',f:'..-.',g:'--.',h:'....',i:'..',j:'.---',k:'-.-',l:'.-..',m:'--',n:'-.',o:'---',p:'.--.',q:'--.-',r:'.-.',s:'...',t:'-',u:'..-',v:'...-',w:'.--',x:'-..-',y:'-.--',z:'--..'};
function morseEncode(s) { return s.toLowerCase().split('').map(c => MORSE[c]||c).join(' '); }

const FLIP = {'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ','i':'ı','j':'ɾ','k':'ʞ','l':'l','m':'ɯ','n':'u','o':'o','p':'d','q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ','w':'ʍ','x':'x','y':'ʎ','z':'z',' ':' ','0':'0','1':'ƖL','2':'ᄅ','3':'Ɛ','4':'ㄣ','5':'ϛ','6':'9','7':'Ɫ','8':'8','9':'6'};
function upsideDown(s) { return [...s.toLowerCase()].map(c=>FLIP[c]||c).reverse().join(''); }

function zalgoText(s) {
  const ZC = ['̴','̵','̶','̷','̸','̡','̢','͇','͈','͉','͍','͎','͓','͔','͕','͖'];
  return [...s].map(c => c + (c.trim() ? ZC[Math.floor(Math.random()*ZC.length)] + ZC[Math.floor(Math.random()*ZC.length)] : '')).join('');
}

// ── UI ────────────────────────────────────────────────
const inputEl = document.getElementById('input-text');
const gridEl  = document.getElementById('transforms-grid');

function renderTransforms() {
  const text = inputEl.value;
  const searchQ = document.getElementById('search-transforms').value.toLowerCase();
  const catFilter = document.getElementById('category-filter').value;

  const filtered = TRANSFORMS.filter(t =>
    (catFilter === 'all' || t.cat === catFilter) &&
    (!searchQ || t.label.toLowerCase().includes(searchQ) || t.id.includes(searchQ))
  );

  gridEl.innerHTML = '';
  filtered.forEach(t => {
    let result = '';
    try { result = text ? t.fn(text) : ''; } catch { result = '(エラー)'; }

    const card = document.createElement('div');
    card.className = 'transform-card';
    const catNames = { case:'大文字', code:'コード', encode:'変換', jp:'日本語', fun:'楽しい' };
    card.innerHTML = `
      <span class="cat-badge cat-${t.cat}">${catNames[t.cat]}</span>
      <div class="tc-label">${t.label}</div>
      <div class="tc-result" title="${result}">${result || '—'}</div>
      <span class="tc-copy-hint">クリックでコピー</span>
    `;
    card.addEventListener('click', () => {
      if (!result) return;
      navigator.clipboard.writeText(result).then(() => {
        card.classList.add('copied');
        card.querySelector('.tc-copy-hint').textContent = '✓ コピー済み';
        setTimeout(() => {
          card.classList.remove('copied');
          card.querySelector('.tc-copy-hint').textContent = 'クリックでコピー';
        }, 1200);
      });
    });
    gridEl.appendChild(card);
  });
}

inputEl.addEventListener('input', renderTransforms);
document.getElementById('search-transforms').addEventListener('input', renderTransforms);
document.getElementById('category-filter').addEventListener('change', renderTransforms);

// Get selected text from page
document.getElementById('btn-from-sel').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => window.getSelection()?.toString() || '',
    }, results => {
      const text = results?.[0]?.result;
      if (text?.trim()) { inputEl.value = text; renderTransforms(); }
    });
  });
});

// Restore last text
chrome.storage.local.get(['tcText'], d => {
  if (d.tcText) { inputEl.value = d.tcText; }
  renderTransforms();
});
inputEl.addEventListener('change', () => chrome.storage.local.set({ tcText: inputEl.value }));
