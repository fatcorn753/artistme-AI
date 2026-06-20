const bgCanvas  = document.getElementById('bg-canvas');
const mainCanvas= document.getElementById('main-canvas');
const ovCanvas  = document.getElementById('overlay-canvas');
const bgCtx     = bgCanvas.getContext('2d');
const ctx       = mainCanvas.getContext('2d');
const ovCtx     = ovCanvas.getContext('2d');

const PALETTE = [
  '#000000','#ffffff','#808080','#c0c0c0',
  '#ff0000','#800000','#ff8000','#804000',
  '#ffff00','#808000','#00ff00','#008000',
  '#00ffff','#008080','#0000ff','#000080',
  '#ff00ff','#800080','#ff80c0','#804060',
  '#ff4444','#44ff44','#4444ff','#ffaa00',
  '#8b5cf6','#06b6d4','#10b981','#f59e0b',
];

let tool='brush', primaryColor='#000000', secondaryColor='#ffffff';
let brushSize=8, opacity=1.0, fillShape=false, blendMode='source-over';
let drawing=false, startX=0, startY=0, lastX=0, lastY=0;
let history=[], redoStack=[], textMode=false;
let sprayInterval=null;

// ── Palette ───────────────────────────────────────────
const paletteEl = document.getElementById('palette');
PALETTE.forEach(c => {
  const div = document.createElement('div');
  div.className='pal-color'; div.style.background=c;
  div.addEventListener('click',   () => setColor(c, 'primary'));
  div.addEventListener('contextmenu', e => { e.preventDefault(); setColor(c,'secondary'); });
  paletteEl.appendChild(div);
});

function setColor(c, which='primary') {
  if (which==='primary') { primaryColor=c; document.getElementById('primary-color').style.background=c; document.getElementById('color-picker').value=c; }
  else { secondaryColor=c; document.getElementById('secondary-color').style.background=c; }
}
document.getElementById('primary-color').style.background = primaryColor;
document.getElementById('secondary-color').style.background = secondaryColor;
document.getElementById('color-picker').addEventListener('input', e => setColor(e.target.value));
document.getElementById('primary-color').addEventListener('click', () => document.getElementById('color-picker').click());
document.getElementById('secondary-color').addEventListener('contextmenu', e => { e.preventDefault(); setColor(secondaryColor,'primary'); setColor(primaryColor,'secondary'); });

// ── Tools ─────────────────────────────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); tool=btn.dataset.tool;
    ovCanvas.style.cursor = tool==='text'?'text':tool==='eyedrop'?'crosshair':'crosshair';
  });
});

// ── Brush size / opacity ──────────────────────────────
document.getElementById('brush-size').addEventListener('input', e => {
  brushSize=parseInt(e.target.value); document.getElementById('size-display').textContent=brushSize;
});
document.getElementById('opacity').addEventListener('input', e => {
  opacity=parseInt(e.target.value)/100; document.getElementById('opacity-display').textContent=e.target.value+'%';
});
document.getElementById('fill-shape').addEventListener('change', e => fillShape=e.target.checked);
document.getElementById('blend-mode').addEventListener('change', e => blendMode=e.target.value);

// ── White background ──────────────────────────────────
bgCtx.fillStyle='#ffffff'; bgCtx.fillRect(0,0,560,460);

function getPos(e) {
  const r=ovCanvas.getBoundingClientRect();
  return [e.clientX-r.left, e.clientY-r.top];
}

// ── Save history ──────────────────────────────────────
function saveState() {
  history.push(ctx.getImageData(0,0,mainCanvas.width,mainCanvas.height));
  if(history.length>40) history.shift();
  redoStack=[];
}

function undo() { if(!history.length) return; redoStack.push(ctx.getImageData(0,0,mainCanvas.width,mainCanvas.height)); ctx.putImageData(history.pop(),0,0); }
function redo() { if(!redoStack.length) return; history.push(ctx.getImageData(0,0,mainCanvas.width,mainCanvas.height)); ctx.putImageData(redoStack.pop(),0,0); }

document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
document.getElementById('btn-clear').addEventListener('click', () => {
  if(confirm('キャンバスをクリアしますか？')){ saveState(); ctx.clearRect(0,0,mainCanvas.width,mainCanvas.height); }
});
document.getElementById('btn-save').addEventListener('click', () => {
  const merged=document.createElement('canvas'); merged.width=560; merged.height=460;
  const mCtx=merged.getContext('2d');
  mCtx.drawImage(bgCanvas,0,0); mCtx.drawImage(mainCanvas,0,0);
  const a=document.createElement('a'); a.download='paint.png'; a.href=merged.toDataURL(); a.click();
});

// ── Drawing ───────────────────────────────────────────
function applyCtx(c2d) {
  c2d.globalAlpha=opacity; c2d.globalCompositeOperation=blendMode;
  c2d.strokeStyle=primaryColor; c2d.fillStyle=primaryColor;
  c2d.lineWidth=brushSize; c2d.lineCap='round'; c2d.lineJoin='round';
}

function floodFill(x, y, fillColor) {
  const imgData=ctx.getImageData(0,0,mainCanvas.width,mainCanvas.height);
  const data=imgData.data; const w=mainCanvas.width;
  const tx=Math.round(x), ty=Math.round(y);
  const idx=(ty*w+tx)*4;
  const tr=data[idx],tg=data[idx+1],tb=data[idx+2],ta=data[idx+3];
  const fc=parseInt(fillColor.slice(1),16);
  const fr=(fc>>16)&255,fg=(fc>>8)&255,fb=fc&255;
  if(tr===fr&&tg===fg&&tb===fb) return;
  const queue=[[tx,ty]]; const visited=new Set([`${tx},${ty}`]);
  while(queue.length){
    const [cx,cy]=queue.shift();
    const ci=(cy*w+cx)*4;
    if(data[ci]!==tr||data[ci+1]!==tg||data[ci+2]!==tb) continue;
    data[ci]=fr;data[ci+1]=fg;data[ci+2]=fb;data[ci+3]=255;
    [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]].forEach(([nx,ny])=>{
      if(nx>=0&&nx<w&&ny>=0&&ny<mainCanvas.height&&!visited.has(`${nx},${ny}`)){visited.add(`${nx},${ny}`);queue.push([nx,ny]);}
    });
  }
  ctx.putImageData(imgData,0,0);
}

ovCanvas.addEventListener('mousedown', e => {
  const [x,y]=getPos(e); const rightClick=(e.button===2);
  if(rightClick) e.preventDefault();
  const activeColor=rightClick?secondaryColor:primaryColor;

  if(tool==='eyedrop'){
    const d=ctx.getImageData(Math.round(x),Math.round(y),1,1).data;
    const hex='#'+[...d.slice(0,3)].map(v=>v.toString(16).padStart(2,'0')).join('');
    setColor(hex, rightClick?'secondary':'primary'); return;
  }
  if(tool==='fill'){ saveState(); floodFill(x,y,activeColor); return; }
  if(tool==='text'){ showTextInput(x,y); return; }

  saveState(); drawing=true; startX=x; startY=y; lastX=x; lastY=y;
  applyCtx(ctx);

  if(tool==='brush'||tool==='eraser'){
    ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';
    ctx.beginPath(); ctx.arc(x,y,brushSize/2,0,Math.PI*2); ctx.fill();
  }
  if(tool==='spray'){ sprayDots(x,y); sprayInterval=setInterval(()=>{ if(drawing) sprayDots(lastX,lastY); },30); }
});

ovCanvas.addEventListener('mousemove', e => {
  if(!drawing) return;
  const [x,y]=getPos(e);
  applyCtx(ctx);

  if(tool==='brush'||tool==='eraser'){
    ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';
    ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(x,y); ctx.stroke();
  }
  if(tool==='spray') { lastX=x; lastY=y; }

  // Shape preview on overlay
  if(['rect','ellipse','line','arrow'].includes(tool)){
    ovCtx.clearRect(0,0,ovCanvas.width,ovCanvas.height);
    applyCtx(ovCtx); ovCtx.strokeStyle=primaryColor; ovCtx.fillStyle=primaryColor;
    drawShape(ovCtx, tool, startX,startY,x,y);
  }
  lastX=x; lastY=y;
});

ovCanvas.addEventListener('mouseup', e => {
  if(!drawing) return; drawing=false;
  clearInterval(sprayInterval);
  const [x,y]=getPos(e);
  applyCtx(ctx);
  if(['rect','ellipse','line','arrow'].includes(tool)){
    drawShape(ctx,tool,startX,startY,x,y);
    ovCtx.clearRect(0,0,ovCanvas.width,ovCanvas.height);
  }
  ctx.globalCompositeOperation='source-over';
});
ovCanvas.addEventListener('mouseleave',()=>{ if(drawing){ clearInterval(sprayInterval); } });
ovCanvas.addEventListener('contextmenu',e=>e.preventDefault());

function sprayDots(x,y){
  const r=brushSize*2; const density=Math.max(5,brushSize);
  ctx.fillStyle=primaryColor; ctx.globalAlpha=opacity*0.3;
  for(let i=0;i<density;i++){
    const a=Math.random()*Math.PI*2; const d=Math.random()*r;
    ctx.beginPath(); ctx.arc(x+d*Math.cos(a),y+d*Math.sin(a),1,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}

function drawShape(c2d,t,x0,y0,x1,y1){
  c2d.beginPath();
  if(t==='rect'){
    if(fillShape){c2d.fillRect(x0,y0,x1-x0,y1-y0);}
    c2d.strokeRect(x0,y0,x1-x0,y1-y0);
  } else if(t==='ellipse'){
    c2d.ellipse((x0+x1)/2,(y0+y1)/2,Math.abs(x1-x0)/2,Math.abs(y1-y0)/2,0,0,Math.PI*2);
    if(fillShape) c2d.fill(); c2d.stroke();
  } else if(t==='line'){
    c2d.moveTo(x0,y0); c2d.lineTo(x1,y1); c2d.stroke();
  } else if(t==='arrow'){
    c2d.moveTo(x0,y0); c2d.lineTo(x1,y1); c2d.stroke();
    const a=Math.atan2(y1-y0,x1-x0), as=brushSize*3;
    c2d.beginPath();
    c2d.moveTo(x1,y1);
    c2d.lineTo(x1-as*Math.cos(a-0.4),y1-as*Math.sin(a-0.4));
    c2d.lineTo(x1-as*Math.cos(a+0.4),y1-as*Math.sin(a+0.4));
    c2d.closePath(); c2d.fill();
  }
}

// ── Text tool ─────────────────────────────────────────
function showTextInput(x,y){
  const div=document.getElementById('text-input-div');
  const inp=document.getElementById('text-field');
  div.style.left=x+'px'; div.style.top=y+'px';
  div.classList.remove('hidden'); inp.value='';
  inp.style.color=primaryColor; inp.style.fontSize=Math.max(12,brushSize*2)+'px';
  inp.focus();
  const commit=()=>{
    const text=inp.value.trim();
    if(text){ saveState(); applyCtx(ctx); ctx.font=`${Math.max(12,brushSize*2)}px sans-serif`; ctx.fillText(text,x,y); }
    div.classList.add('hidden');
  };
  inp.onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();commit();} if(e.key==='Escape'){div.classList.add('hidden');} };
  inp.onblur=()=>setTimeout(()=>div.classList.add('hidden'),100);
}

// ── Keyboard ──────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}
  if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redo();}
  const keyTool={b:'brush',e:'eraser',s:'spray',f:'fill',i:'eyedrop',t:'text',r:'rect',o:'ellipse',l:'line'};
  if(keyTool[e.key]){tool=keyTool[e.key];document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));}
});
