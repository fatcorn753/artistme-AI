let slides = [];
let currentSlide = 0;
let currentTheme = 'dark';

const previewEl = document.getElementById('slide-preview');
const counterEl = document.getElementById('slide-counter');
const presentBtn= document.getElementById('btn-present');

// ── Minimal Markdown → HTML ───────────────────────────
function mdToHtml(text) {
  let h = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Code blocks
  h = h.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  // Inline code
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Headings
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  // Bold/italic
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g,     '<em>$1</em>');
  // Blockquote
  h = h.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  // Lists
  h = h.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Line breaks → paragraphs
  h = h.replace(/^(?!<[huplb])(.+)$/gm, '<p>$1</p>');
  h = h.replace(/<\/ul>\s*<ul>/g, '');
  return h;
}

// ── Generate slides ───────────────────────────────────
function generate() {
  const md = document.getElementById('md-input').value;
  const theme = document.getElementById('theme-select').value;
  currentTheme = theme;

  const parts = md.split(/^---$/m).map(s => s.trim()).filter(Boolean);
  slides = parts.map(part => mdToHtml(part));

  if (!slides.length) return;
  currentSlide = 0;

  document.getElementById('slides-section').classList.remove('hidden');
  presentBtn.disabled = false;
  renderSlide();
  chrome.storage.local.set({ slideMd: md, slideTheme: theme });
}

function renderSlide() {
  if (!slides.length) return;

  const html = slides[currentSlide];
  counterEl.textContent = `${currentSlide + 1} / ${slides.length}`;

  document.getElementById('btn-prev-slide').disabled = currentSlide === 0;
  document.getElementById('btn-next-slide').disabled = currentSlide === slides.length - 1;

  previewEl.className = `slide-preview theme-${currentTheme}`;
  previewEl.innerHTML = `
    <div class="slide-inner" style="position:relative">
      ${html}
      <span class="slide-num">${currentSlide + 1} / ${slides.length}</span>
    </div>
  `;
}

// ── Navigation ────────────────────────────────────────
document.getElementById('btn-prev-slide').addEventListener('click', () => {
  if (currentSlide > 0) { currentSlide--; renderSlide(); }
});
document.getElementById('btn-next-slide').addEventListener('click', () => {
  if (currentSlide < slides.length - 1) { currentSlide++; renderSlide(); }
});

// Click to advance
previewEl.addEventListener('click', () => {
  if (currentSlide < slides.length - 1) { currentSlide++; renderSlide(); }
});

document.getElementById('btn-generate').addEventListener('click', generate);

document.getElementById('theme-select').addEventListener('change', (e) => {
  currentTheme = e.target.value;
  if (slides.length) renderSlide();
});

// ── Present in new window ─────────────────────────────
presentBtn.addEventListener('click', () => {
  const theme = currentTheme;
  const allSlides = slides;

  const presentHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Presentation</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#000; display:flex; align-items:center; justify-content:center; height:100vh; }
.slide {
  width:100vw; height:100vh; display:flex; align-items:center; justify-content:center;
  font-family:-apple-system,sans-serif; font-size:clamp(14px,2vw,22px); line-height:1.7;
  position:relative;
}
${getThemeCSS(theme)}
.slide-inner { width:90%; max-width:900px; }
.slide-inner h1 { font-size:2.4em; margin-bottom:.4em; padding-bottom:.2em; border-bottom:2px solid currentColor; }
.slide-inner h2 { font-size:1.8em; margin-bottom:.3em; }
.slide-inner h3 { font-size:1.4em; margin-bottom:.2em; }
.slide-inner ul, .slide-inner ol { padding-left:1.4em; margin:.4em 0; }
.slide-inner li { margin:.2em 0; }
.slide-inner code { padding:.1em .4em; border-radius:4px; font-family:monospace; font-size:.85em; }
.slide-inner pre { padding:1em; border-radius:.5em; margin:.6em 0; overflow-x:auto; }
.slide-inner pre code { background:none; padding:0; }
.nav { position:fixed; bottom:20px; right:20px; display:flex; gap:10px; }
.nav button { background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.2); border-radius:8px; color:#fff; font-size:20px; width:48px; height:40px; cursor:pointer; }
.nav button:hover { background:rgba(255,255,255,.2); }
.counter { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); color:rgba(255,255,255,.4); font-size:14px; font-family:monospace; }
.hidden { display:none; }
</style>
</head>
<body>
${allSlides.map((s,i) => `<div class="slide theme-${theme}${i===0?'':' hidden'}" id="s${i}"><div class="slide-inner">${s}</div></div>`).join('')}
<div class="counter" id="counter">1 / ${allSlides.length}</div>
<div class="nav">
  <button onclick="nav(-1)">◀</button>
  <button onclick="nav(1)">▶</button>
</div>
<script>
let cur=0;
const total=${allSlides.length};
function nav(d){
  document.getElementById('s'+cur).classList.add('hidden');
  cur=Math.max(0,Math.min(total-1,cur+d));
  document.getElementById('s'+cur).classList.remove('hidden');
  document.getElementById('counter').textContent=(cur+1)+' / '+total;
}
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='Space') nav(1);
  if(e.key==='ArrowLeft') nav(-1);
  if(e.key==='Escape') window.close();
});
document.addEventListener('click', e=>{ if(!e.target.closest('.nav')) nav(1); });
<\/script>
</body></html>`;

  const blob = new Blob([presentHtml], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  chrome.tabs.create({ url });
});

function getThemeCSS(theme) {
  const themes = {
    dark:   `.theme-dark{background:#0f0f1a;color:#e0e0f0}.theme-dark h1,.theme-dark h2{color:#a78bfa}.theme-dark code{background:#1e1e2e;color:#c4b5fd}.theme-dark pre{background:#1e1e2e}`,
    light:  `.theme-light{background:#fff;color:#1a1a2e}.theme-light h1,.theme-light h2{color:#5b21b6}.theme-light code{background:#f5f3ff;color:#5b21b6}.theme-light pre{background:#f5f3ff}`,
    ocean:  `.theme-ocean{background:#0c1445;color:#e0f4ff}.theme-ocean h1,.theme-ocean h2{color:#38bdf8}.theme-ocean code{background:#0f2060;color:#7dd3fc}.theme-ocean pre{background:#0f2060}`,
    forest: `.theme-forest{background:#0a1a0a;color:#d1fae5}.theme-forest h1,.theme-forest h2{color:#34d399}.theme-forest code{background:#0f2a0f;color:#6ee7b7}.theme-forest pre{background:#0f2a0f}`,
    sunset: `.theme-sunset{background:#1a0a0a;color:#fde8e0}.theme-sunset h1,.theme-sunset h2{color:#f97316}.theme-sunset code{background:#2a0f0f;color:#fdba74}.theme-sunset pre{background:#2a0f0f}`,
  };
  return themes[theme] || themes.dark;
}

// ── Export HTML ───────────────────────────────────────
document.getElementById('btn-export-html').addEventListener('click', () => {
  const theme = currentTheme;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Slides</title>
<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px}
.slide{border:1px solid #ddd;border-radius:8px;padding:40px;margin:20px 0;min-height:300px;display:flex;align-items:center}
${getThemeCSS(theme)}
.slide-inner h1{font-size:2em;margin-bottom:.4em}
.slide-inner ul{padding-left:1.4em}
</style></head><body>
${slides.map((s,i) => `<div class="slide theme-${theme}"><div class="slide-inner">${s}</div></div>`).join('\n')}
</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'slides.html';
  a.click();
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['slideMd','slideTheme'], (data) => {
  if (data.slideMd) document.getElementById('md-input').value = data.slideMd;
  if (data.slideTheme) {
    document.getElementById('theme-select').value = data.slideTheme;
    currentTheme = data.slideTheme;
  }
  generate();
});
