// Color blindness simulation using SVG filters + CSS
const FILTERS = [
  {
    id: 'normal', name: '通常視', type: '参照',
    desc: '通常の色覚。すべての色が見えます。',
    preview: ['#e74c3c','#f1c40f','#2ecc71','#3498db'],
    cssFilter: 'none',
    matrix: null,
  },
  {
    id: 'protanopia', name: '1型2色覚', type: '赤緑(赤欠)',
    desc: '赤い色が見えにくくなる色覚異常。赤と緑が区別しにくくなります。日本人男性の約1.4%に見られます。',
    preview: ['#7b7b00','#a4a400','#2ecc71','#3498db'],
    matrix: [0.567,0.433,0,0,0, 0.558,0.442,0,0,0, 0,0.242,0.758,0,0, 0,0,0,1,0],
  },
  {
    id: 'deuteranopia', name: '2型2色覚', type: '赤緑(緑欠)',
    desc: '緑の色が見えにくくなる色覚異常。最も一般的な色覚異常で、日本人男性の約4.9%に見られます。',
    preview: ['#d3a800','#c8a100','#8b8b00','#3498db'],
    matrix: [0.625,0.375,0,0,0, 0.7,0.3,0,0,0, 0,0.3,0.7,0,0, 0,0,0,1,0],
  },
  {
    id: 'tritanopia', name: '3型2色覚', type: '青黄(青欠)',
    desc: '青い色が見えにくくなる色覚異常。赤と青、黄と白が区別しにくくなります。非常にまれです。',
    preview: ['#e74c3c','#ea6600','#2ecc71','#006e5f'],
    matrix: [0.95,0.05,0,0,0, 0,0.433,0.567,0,0, 0,0.475,0.525,0,0, 0,0,0,1,0],
  },
  {
    id: 'protanomaly', name: '1型異常3色覚', type: '赤弱',
    desc: '赤の感度が低下した色覚異常。赤が暗く見え、赤緑の識別が困難になります。',
    preview: ['#b39600','#c8a100','#2ecc71','#3498db'],
    matrix: [0.817,0.183,0,0,0, 0.333,0.667,0,0,0, 0,0.125,0.875,0,0, 0,0,0,1,0],
  },
  {
    id: 'deuteranomaly', name: '2型異常3色覚', type: '緑弱',
    desc: '緑の感度が低下した色覚異常。最も多い色覚異常の一つ。',
    preview: ['#c8a100','#c4a000','#6b6b00','#3498db'],
    matrix: [0.8,0.2,0,0,0, 0.258,0.742,0,0,0, 0,0.142,0.858,0,0, 0,0,0,1,0],
  },
  {
    id: 'tritanomaly', name: '3型異常3色覚', type: '青弱',
    desc: '青の感度が低下した色覚異常。青と緑、黄と赤の識別が困難です。',
    preview: ['#e74c3c','#e86400','#2ecc71','#007068'],
    matrix: [0.967,0.033,0,0,0, 0,0.733,0.267,0,0, 0,0.183,0.817,0,0, 0,0,0,1,0],
  },
  {
    id: 'achromatopsia', name: '全色盲', type: '完全色盲',
    desc: '色が全く見えず、明暗のみで世界を認識します。非常にまれな症状です。',
    preview: ['#808080','#aaaaaa','#6e6e6e','#606060'],
    matrix: [0.299,0.587,0.114,0,0, 0.299,0.587,0.114,0,0, 0.299,0.587,0.114,0,0, 0,0,0,1,0],
  },
];

const SAMPLE_COLORS = ['#e74c3c','#f1c40f','#2ecc71','#3498db','#9b59b6','#e67e22','#1abc9c','#34495e'];

let currentFilter = 'normal';

// ── Build filter grid ─────────────────────────────────
const grid = document.getElementById('filter-grid');
FILTERS.forEach(f => {
  const btn = document.createElement('div');
  btn.className = 'filter-btn' + (f.id==='normal'?' active':'');
  btn.dataset.id = f.id;

  const dotsHtml = f.preview.map(c =>
    `<div class="fb-dot" style="background:${c}"></div>`
  ).join('');

  btn.innerHTML = `
    <div class="fb-name">${f.name}</div>
    <div class="fb-type">${f.type}</div>
    <div class="fb-preview">${dotsHtml}</div>
  `;
  btn.addEventListener('click', () => applyFilter(f.id));
  grid.appendChild(btn);
});

// ── Apply filter ──────────────────────────────────────
function applyFilter(id) {
  currentFilter = id;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.id===id));

  const filter = FILTERS.find(f=>f.id===id);
  document.getElementById('active-info').textContent = `フィルター: ${filter.name} (${filter.type})`;
  document.getElementById('info-text').textContent = filter.desc;

  // Apply to page via content script
  chrome.tabs.query({active:true,currentWindow:true}, tabs => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (matrix, filterId) => {
        const STYLE_ID = '__colorblind_filter__';
        let style = document.getElementById(STYLE_ID);
        if (!style) { style=document.createElement('style'); style.id=STYLE_ID; document.head.appendChild(style); }

        if (filterId === 'normal') { style.textContent=''; return; }

        // Inject SVG filter
        let svg = document.getElementById('__colorblind_svg__');
        if (!svg) {
          svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
          svg.id='__colorblind_svg__';
          svg.setAttribute('width','0'); svg.setAttribute('height','0');
          svg.style.cssText='position:fixed;top:-9999px;left:-9999px;';
          document.body.appendChild(svg);
        }
        svg.innerHTML=`<defs><filter id="cbf" color-interpolation-filters="linearRGB">
          <feColorMatrix type="matrix" values="${matrix.join(' ')}"/>
        </filter></defs>`;

        style.textContent=`html{filter:url(#cbf)!important}`;
      },
      args: [filter.matrix || [1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0], id]
    });
  });

  updatePreviewCanvas(filter.matrix);
}

// ── Preview canvas ────────────────────────────────────
function applyMatrixToColor(r, g, b, matrix) {
  if (!matrix) return [r,g,b];
  const m=matrix;
  return [
    Math.round(r*m[0]+g*m[1]+b*m[2]+255*m[4]),
    Math.round(r*m[5]+g*m[6]+b*m[7]+255*m[9]),
    Math.round(r*m[10]+g*m[11]+b*m[12]+255*m[14]),
  ].map(v=>Math.max(0,Math.min(255,v)));
}

function hexToRgb(hex) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

function updatePreviewCanvas(matrix) {
  const canvas = document.getElementById('preview-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,320,60);

  const W=320,H=60,n=SAMPLE_COLORS.length,sw=W/n;

  // Top: original colors
  SAMPLE_COLORS.forEach((hex,i)=>{
    ctx.fillStyle=hex;
    ctx.fillRect(i*sw, 0, sw-1, H/2-1);
  });

  // Bottom: simulated colors
  SAMPLE_COLORS.forEach((hex,i)=>{
    const [r,g,b]=hexToRgb(hex);
    const [nr,ng,nb]=applyMatrixToColor(r,g,b,matrix);
    ctx.fillStyle=`rgb(${nr},${ng},${nb})`;
    ctx.fillRect(i*sw, H/2+1, sw-1, H/2-1);
  });

  // Labels
  ctx.fillStyle='rgba(0,0,0,0.5)';
  ctx.fillRect(0,0,34,10);
  ctx.fillRect(0,H/2+1,40,10);
  ctx.fillStyle='#fff'; ctx.font='8px sans-serif'; ctx.textAlign='left';
  ctx.fillText('元色',2,9); ctx.fillText('シミュ',2,H/2+9);

  // Update swatches
  const swatchContainer = document.getElementById('color-swatches');
  swatchContainer.innerHTML='';
  SAMPLE_COLORS.forEach(hex=>{
    const div=document.createElement('div'); div.className='swatch'; div.style.background=hex;
    swatchContainer.appendChild(div);
  });
}

// ── Reset ─────────────────────────────────────────────
document.getElementById('btn-reset').addEventListener('click',()=>applyFilter('normal'));

// ── Screenshot analyze (simulate on canvas) ───────────
document.getElementById('btn-screenshot').addEventListener('click',()=>{
  chrome.tabs.captureVisibleTab(null,{format:'png'},dataUrl=>{
    if(chrome.runtime.lastError) return;
    const img=new Image(); img.src=dataUrl;
    img.onload=()=>{
      const filter=FILTERS.find(f=>f.id===currentFilter);
      const canvas=document.getElementById('preview-canvas');
      const ctx=canvas.getContext('2d');
      canvas.width=320; canvas.height=120;
      // Draw scaled version of screenshot
      ctx.drawImage(img,0,0,320,60);
      // Apply simulation
      if(filter.matrix){
        const imageData=ctx.getImageData(0,0,320,60);
        const d=imageData.data;
        for(let i=0;i<d.length;i+=4){
          const [nr,ng,nb]=applyMatrixToColor(d[i],d[i+1],d[i+2],filter.matrix);
          d[i]=nr;d[i+1]=ng;d[i+2]=nb;
        }
        ctx.putImageData(imageData,0,60);
      } else {
        ctx.drawImage(img,0,60,320,60);
      }
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,50,14); ctx.fillRect(0,60,80,14);
      ctx.fillStyle='#fff'; ctx.font='9px sans-serif'; ctx.textAlign='left';
      ctx.fillText('元の画面',3,10); ctx.fillText(filter.name,3,70);
    };
  });
});

// ── Init ─────────────────────────────────────────────
updatePreviewCanvas(null);
