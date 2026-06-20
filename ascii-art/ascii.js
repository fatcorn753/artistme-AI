// ── ASCII font definitions (5×7 bitmap) ──────────────
const FONT_BLOCK = {
  'A':['░▓▓▓░','▓░░░▓','▓▓▓▓▓','▓░░░▓','▓░░░▓'],
  'B':['▓▓▓▓░','▓░░░▓','▓▓▓▓░','▓░░░▓','▓▓▓▓░'],
  'C':['░▓▓▓▓','▓░░░░','▓░░░░','▓░░░░','░▓▓▓▓'],
  'D':['▓▓▓▓░','▓░░░▓','▓░░░▓','▓░░░▓','▓▓▓▓░'],
  'E':['▓▓▓▓▓','▓░░░░','▓▓▓▓░','▓░░░░','▓▓▓▓▓'],
  'F':['▓▓▓▓▓','▓░░░░','▓▓▓▓░','▓░░░░','▓░░░░'],
  'G':['░▓▓▓░','▓░░░░','▓░▓▓▓','▓░░░▓','░▓▓▓░'],
  'H':['▓░░░▓','▓░░░▓','▓▓▓▓▓','▓░░░▓','▓░░░▓'],
  'I':['▓▓▓▓▓','░░▓░░','░░▓░░','░░▓░░','▓▓▓▓▓'],
  'J':['░░░▓▓','░░░░▓','░░░░▓','▓░░░▓','░▓▓▓░'],
  'K':['▓░░░▓','▓░░▓░','▓▓▓░░','▓░░▓░','▓░░░▓'],
  'L':['▓░░░░','▓░░░░','▓░░░░','▓░░░░','▓▓▓▓▓'],
  'M':['▓░░░▓','▓▓░▓▓','▓░▓░▓','▓░░░▓','▓░░░▓'],
  'N':['▓░░░▓','▓▓░░▓','▓░▓░▓','▓░░▓▓','▓░░░▓'],
  'O':['░▓▓▓░','▓░░░▓','▓░░░▓','▓░░░▓','░▓▓▓░'],
  'P':['▓▓▓▓░','▓░░░▓','▓▓▓▓░','▓░░░░','▓░░░░'],
  'Q':['░▓▓▓░','▓░░░▓','▓░▓░▓','▓░░▓░','░▓▓░▓'],
  'R':['▓▓▓▓░','▓░░░▓','▓▓▓▓░','▓░░▓░','▓░░░▓'],
  'S':['░▓▓▓▓','▓░░░░','░▓▓▓░','░░░░▓','▓▓▓▓░'],
  'T':['▓▓▓▓▓','░░▓░░','░░▓░░','░░▓░░','░░▓░░'],
  'U':['▓░░░▓','▓░░░▓','▓░░░▓','▓░░░▓','░▓▓▓░'],
  'V':['▓░░░▓','▓░░░▓','▓░░░▓','░▓░▓░','░░▓░░'],
  'W':['▓░░░▓','▓░░░▓','▓░▓░▓','▓▓░▓▓','▓░░░▓'],
  'X':['▓░░░▓','░▓░▓░','░░▓░░','░▓░▓░','▓░░░▓'],
  'Y':['▓░░░▓','░▓░▓░','░░▓░░','░░▓░░','░░▓░░'],
  'Z':['▓▓▓▓▓','░░░▓░','░░▓░░','░▓░░░','▓▓▓▓▓'],
  '0':['░▓▓▓░','▓░░▓▓','▓░▓░▓','▓▓░░▓','░▓▓▓░'],
  '1':['░░▓░░','░▓▓░░','░░▓░░','░░▓░░','░▓▓▓░'],
  '2':['░▓▓▓░','▓░░░▓','░░▓▓░','░▓░░░','▓▓▓▓▓'],
  '3':['▓▓▓▓░','░░░░▓','░▓▓▓░','░░░░▓','▓▓▓▓░'],
  '!':['░░▓░░','░░▓░░','░░▓░░','░░░░░','░░▓░░'],
  '?':['░▓▓▓░','▓░░░▓','░░▓▓░','░░░░░','░░▓░░'],
  ' ':['░░░░░','░░░░░','░░░░░','░░░░░','░░░░░'],
};

// Mini font (3×5)
const FONT_MINI = {
  'A':['▓▓▓','▓░▓','▓▓▓','▓░▓','▓░▓'],
  'B':['▓▓░','▓░▓','▓▓░','▓░▓','▓▓░'],
  'H':['▓░▓','▓░▓','▓▓▓','▓░▓','▓░▓'],
  'E':['▓▓▓','▓░░','▓▓░','▓░░','▓▓▓'],
  'L':['▓░░','▓░░','▓░░','▓░░','▓▓▓'],
  'O':['░▓░','▓░▓','▓░▓','▓░▓','░▓░'],
  ' ':['░░░','░░░','░░░','░░░','░░░'],
};

function textToAscii(text, font, charSet, invert) {
  const F = font === 'mini' ? FONT_MINI : FONT_BLOCK;
  const chars = text.toUpperCase().split('').map(c => F[c] || F[' '] || ['░░░░░','░░░░░','░░░░░','░░░░░','░░░░░']);
  const rows = chars[0].length;
  const lines = [];
  for (let r=0;r<rows;r++) {
    let line = chars.map(ch => (ch[r]||'░░░░░')).join(' ');
    if (invert) { line = line.replace(/▓/g,'X').replace(/░/g,'▓').replace(/X/g,'░'); }
    if (charSet==='alpha')  { line = line.replace(/▓/g,'@').replace(/░/g,' '); }
    else if (charSet==='lines') { line = line.replace(/▓/g,'#').replace(/░/g,'.'); }
    else if (charSet==='dense') { /* keep as is */ }
    lines.push(line);
  }
  return lines.join('\n');
}

const SHAPES = [
  { name:'ハート', fn:()=>drawShape('heart') },
  { name:'星',     fn:()=>drawShape('star') },
  { name:'円',     fn:()=>drawShape('circle') },
  { name:'三角形', fn:()=>drawShape('triangle') },
  { name:'菱形',   fn:()=>drawShape('diamond') },
  { name:'矢印↑', fn:()=>drawShape('arrow-up') },
  { name:'格子',   fn:()=>drawShape('grid') },
  { name:'波',     fn:()=>drawShape('wave') },
];

function drawShape(type) {
  const n=20;
  const lines=[];
  for(let y=0;y<n;y++){
    let line='';
    for(let x=0;x<n*2;x++){
      const nx=(x/2-n/2)/n*2,ny=(y-n/2)/n*2;
      let v=false;
      if(type==='heart')   v=Math.pow(nx*nx+ny*ny-1,3)-nx*nx*ny*ny*ny<0;
      else if(type==='star')  { const a=Math.atan2(ny,nx),r=Math.sqrt(nx*nx+ny*ny); const k=5; const rStar=0.7*(1+0.5*Math.cos(k*a)); v=r<rStar; }
      else if(type==='circle') v=nx*nx+ny*ny<0.7;
      else if(type==='triangle') v=ny<0.8&&ny>-0.8&&Math.abs(nx)<0.9*(0.8+ny)/1.6;
      else if(type==='diamond') v=Math.abs(nx)+Math.abs(ny)<0.9;
      else if(type==='arrow-up') v=(ny<0.3&&Math.abs(nx)<0.8*(0.3-ny))||( ny>=0.3&&Math.abs(nx)<0.2);
      else if(type==='grid') v=(Math.abs(Math.sin(nx*8))>0.7)||(Math.abs(Math.sin(ny*8))>0.7);
      else if(type==='wave') v=Math.abs(ny-Math.sin(nx*4)*0.5)<0.12;
      line+=v?'██':'  ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// ── Image to ASCII ────────────────────────────────────
function imageToAscii(imgEl, width, useColor) {
  const canvas = document.getElementById('img-canvas');
  const aspect = imgEl.height / imgEl.width;
  const h = Math.round(width * aspect * 0.45);
  canvas.width = width; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, width, h);
  const data = ctx.getImageData(0,0,width,h).data;

  const CHARS = '@#S%?*+;:,.  ';
  const lines = [];
  for (let y=0;y<h;y++) {
    let line = '';
    for (let x=0;x<width;x++) {
      const i=(y*width+x)*4;
      const r=data[i],g=data[i+1],b=data[i+2];
      const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
      const ch = CHARS[Math.floor(lum * (CHARS.length-1))];
      if (useColor) {
        line += `<span style="color:rgb(${r},${g},${b})">${ch}</span>`;
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  return { text: lines.join('\n'), html: lines.join('\n'), colored: useColor };
}

// ── Output ────────────────────────────────────────────
const outputEl = document.getElementById('ascii-output');
let rawOutput = '';

function setOutput(result) {
  if (typeof result === 'object' && result.colored) {
    outputEl.innerHTML = result.html;
    rawOutput = result.text.replace(/<[^>]+>/g,'');
  } else {
    const text = typeof result === 'string' ? result : '';
    rawOutput = text;
    outputEl.textContent = text;
  }
}

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p=>p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-'+tab.dataset.tab).classList.remove('hidden');
  });
});

// ── Text → ASCII ──────────────────────────────────────
function regenerate(){
  const text=document.getElementById('text-input').value||' ';
  const font=document.getElementById('font-select').value;
  const charSet=document.getElementById('char-set').value;
  const invert=document.getElementById('invert-chk').checked;
  setOutput(textToAscii(text,font,charSet,invert));
}
['text-input','font-select','char-set','invert-chk','color-chk'].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener(el.tagName==='INPUT'&&el.type!=='checkbox'?'input':'change', regenerate);
});

// ── Image drop ────────────────────────────────────────
const dropZone=document.getElementById('img-drop');
dropZone.addEventListener('click',()=>document.getElementById('img-file').click());
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('drag-over');loadImage(e.dataTransfer.files[0]);});
document.getElementById('img-file').addEventListener('change',e=>loadImage(e.target.files[0]));

function loadImage(file){
  if(!file?.type.startsWith('image/')) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image(); img.onload=()=>{
      const w=parseInt(document.getElementById('img-width').value)||60;
      const useColor=document.getElementById('img-color').checked;
      setOutput(imageToAscii(img,w,useColor));
    }; img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}
document.getElementById('img-width').addEventListener('change',()=>{ const f=document.getElementById('img-file'); if(f.files[0]) loadImage(f.files[0]); });

// ── Shapes ────────────────────────────────────────────
const shapesGrid=document.getElementById('shapes-grid');
SHAPES.forEach(s=>{
  const btn=document.createElement('button'); btn.className='shape-btn'; btn.textContent=s.name;
  btn.addEventListener('click',()=>setOutput(s.fn()));
  shapesGrid.appendChild(btn);
});

// ── Controls ──────────────────────────────────────────
document.getElementById('btn-copy-art').addEventListener('click',function(){
  navigator.clipboard.writeText(rawOutput).then(()=>{
    this.textContent='✓ コピー済み'; this.classList.add('copied');
    setTimeout(()=>{this.textContent='コピー';this.classList.remove('copied');},1500);
  });
});
document.getElementById('btn-download').addEventListener('click',()=>{
  const blob=new Blob([rawOutput],{type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ascii-art.txt'; a.click();
});
document.getElementById('output-size').addEventListener('change',e=>{
  outputEl.style.fontSize=e.target.value+'px';
});

// ── Init ─────────────────────────────────────────────
regenerate();
