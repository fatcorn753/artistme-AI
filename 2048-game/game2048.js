const CELL = 72, GAP = 8;
let grid, score, bestScore = 0, prevGrid, prevScore, gameOver = false;

function newGrid() { return Array.from({length:4},()=>Array(4).fill(0)); }

function addTile(g) {
  const empty = [];
  for (let r=0;r<4;r++) for (let c=0;c<4;c++) if(!g[r][c]) empty.push([r,c]);
  if (!empty.length) return;
  const [r,c] = empty[Math.floor(Math.random()*empty.length)];
  g[r][c] = Math.random()<0.9 ? 2 : 4;
}

function newGame() {
  grid=newGrid(); score=0; gameOver=false;
  addTile(grid); addTile(grid);
  prevGrid=null; prevScore=0;
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('score').textContent='0';
  render();
}

// ── Move logic ────────────────────────────────────────
function slide(row) {
  let nums = row.filter(v=>v), gained = 0;
  for (let i=0;i<nums.length-1;i++) {
    if (nums[i]===nums[i+1]) { nums[i]*=2; gained+=nums[i]; nums[i+1]=0; i++; }
  }
  nums = nums.filter(v=>v);
  while (nums.length<4) nums.push(0);
  return { row:nums, gained };
}

function move(dir) {
  prevGrid = grid.map(r=>[...r]); prevScore = score;
  let moved=false, gained=0;
  const g = grid.map(r=>[...r]);

  if (dir==='left') {
    for (let r=0;r<4;r++) { const {row,gained:g2}=slide(g[r]); if(g2||JSON.stringify(row)!==JSON.stringify(g[r])){g[r]=row;gained+=g2;moved=true;} }
  } else if (dir==='right') {
    for (let r=0;r<4;r++) { const rev=g[r].slice().reverse(); const {row,gained:g2}=slide(rev); const final=row.reverse(); if(g2||JSON.stringify(final)!==JSON.stringify(g[r])){g[r]=final;gained+=g2;moved=true;} }
  } else if (dir==='up') {
    for (let c=0;c<4;c++) {
      const col=g.map(r=>r[c]); const {row,gained:g2}=slide(col);
      if (g2||JSON.stringify(row)!==JSON.stringify(col)) { row.forEach((v,r)=>g[r][c]=v); gained+=g2; moved=true; }
    }
  } else if (dir==='down') {
    for (let c=0;c<4;c++) {
      const col=g.map(r=>r[c]).reverse(); const {row,gained:g2}=slide(col); const final=row.reverse();
      if (g2||JSON.stringify(final)!==JSON.stringify(g.map(r=>r[c]))) { final.forEach((v,r)=>g[r][c]=v); gained+=g2; moved=true; }
    }
  }

  if (!moved) return;
  grid=g; score+=gained;
  if (score>bestScore) { bestScore=score; chrome.storage.local.set({best2048:bestScore}); }
  document.getElementById('score').textContent=score.toLocaleString();
  document.getElementById('best').textContent=bestScore.toLocaleString();

  addTile(grid);
  render();

  if (grid.flat().some(v=>v===2048)) { showOverlay('🎉 2048達成！'); }
  else if (isGameOver()) { showOverlay('💀 ゲームオーバー'); }
}

function isGameOver() {
  if (grid.flat().some(v=>v===0)) return false;
  for (let r=0;r<4;r++) for (let c=0;c<4;c++) {
    const v=grid[r][c];
    if((r<3&&grid[r+1][c]===v)||(c<3&&grid[r][c+1]===v)) return false;
  }
  return true;
}

function showOverlay(msg) {
  document.getElementById('overlay-msg').textContent=msg;
  document.getElementById('overlay').classList.remove('hidden');
  gameOver=true;
}

// ── Rendering ─────────────────────────────────────────
function tileClass(v) {
  if (v<=2048) return 't'+v;
  return 't-super';
}

function render() {
  // Build grid cells (background)
  const gridEl = document.getElementById('board-grid');
  gridEl.innerHTML='';
  for (let i=0;i<16;i++) {
    const cell=document.createElement('div'); cell.className='grid-cell';
    gridEl.appendChild(cell);
  }

  // Build tiles
  const tileLayer = document.getElementById('tile-layer');
  tileLayer.innerHTML='';
  for (let r=0;r<4;r++) for (let c=0;c<4;c++) {
    const v=grid[r][c]; if(!v) continue;
    const tile=document.createElement('div');
    tile.className=`tile ${tileClass(v)}`;
    tile.textContent=v.toLocaleString();
    tile.style.left=(c*(CELL+GAP))+'px';
    tile.style.top =(r*(CELL+GAP))+'px';
    tileLayer.appendChild(tile);
  }
}

// ── Input ─────────────────────────────────────────────
const container = document.getElementById('board-container');
container.addEventListener('keydown', e => {
  if (gameOver) return;
  const map = { ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',
                a:'left',d:'right',w:'up',s:'down',A:'left',D:'right',W:'up',S:'down' };
  const dir=map[e.key];
  if (dir) { e.preventDefault(); move(dir); }
});

// Touch swipe
let touchStart={x:0,y:0};
container.addEventListener('touchstart',e=>{touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
container.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-touchStart.x;
  const dy=e.changedTouches[0].clientY-touchStart.y;
  if(Math.abs(dx)<10&&Math.abs(dy)<10) return;
  if(Math.abs(dx)>Math.abs(dy)) move(dx>0?'right':'left');
  else move(dy>0?'down':'up');
},{passive:true});

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-try-again').addEventListener('click', newGame);
document.getElementById('btn-undo').addEventListener('click', () => {
  if (!prevGrid) return;
  grid=prevGrid.map(r=>[...r]); score=prevScore; prevGrid=null; gameOver=false;
  document.getElementById('score').textContent=score.toLocaleString();
  document.getElementById('overlay').classList.add('hidden');
  render();
});

// Click to focus
container.addEventListener('click', ()=>container.focus());

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['best2048'],d=>{
  bestScore=d.best2048||0;
  document.getElementById('best').textContent=bestScore.toLocaleString();
  newGame(); container.focus();
});
