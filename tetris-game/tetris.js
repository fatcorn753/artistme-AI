const COLS=10, ROWS=20, SQ=20;
const COLORS=['','#f87171','#fb923c','#fbbf24','#4ade80','#22d3ee','#818cf8','#e879f9'];
// I O T S Z J L
const SHAPES=[
  [],
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[1,1],[1,1]],                              // O
  [[0,1,0],[1,1,1],[0,0,0]],                  // T
  [[0,1,1],[1,1,0],[0,0,0]],                  // S
  [[1,1,0],[0,1,1],[0,0,0]],                  // Z
  [[1,0,0],[1,1,1],[0,0,0]],                  // J
  [[0,0,1],[1,1,1],[0,0,0]],                  // L
];
const POINTS=[0,100,300,500,800];
const LEVEL_SPEED=[800,720,630,550,470,380,300,220,130,100,80];

let board, piece, nextQueue, hold, held, score, level, lines, hiScore=0;
let gameOver=true, paused=false, dropTimer, lastDrop;
let canHold=true, softDrop=false;
const canvas  = document.getElementById('game-canvas');
const ctx     = canvas.getContext('2d');
const nextCtx = document.getElementById('next-canvas').getContext('2d');
const holdCtx = document.getElementById('hold-canvas').getContext('2d');

function randPiece() { return Math.ceil(Math.random()*7); }

function newPiece(type) {
  const shape = SHAPES[type].map(r=>[...r]);
  return { type, shape, x: Math.floor((COLS-shape[0].length)/2), y: -1 };
}

function rotateCW(shape) {
  const n=shape.length;
  return shape[0].map((_,i)=>shape.map(r=>r[i]).reverse());
}

function valid(p, dx=0, dy=0, shape=p.shape) {
  return shape.every((row,r)=>row.every((v,c)=>{
    if(!v) return true;
    const nr=p.y+r+dy, nc=p.x+c+dx;
    return nr<ROWS && nc>=0 && nc<COLS && (!board[nr] || !board[nr][nc]);
  }));
}

function lock() {
  piece.shape.forEach((row,r)=>row.forEach((v,c)=>{ if(v && piece.y+r>=0) board[piece.y+r][piece.x+c]=piece.type; }));
  // Clear lines
  let cleared=0;
  for(let r=ROWS-1;r>=0;r--){
    if(board[r].every(v=>v)){ board.splice(r,1); board.unshift(Array(COLS).fill(0)); cleared++; r++; }
  }
  lines+=cleared; score+=POINTS[cleared]*(level+1);
  level=Math.min(10,Math.floor(lines/10)+1);
  document.getElementById('score').textContent=score.toLocaleString();
  document.getElementById('level').textContent=level;
  document.getElementById('lines').textContent=lines;
  if(score>hiScore){ hiScore=score; chrome.storage.local.set({tetrisHi:hiScore}); document.getElementById('best').textContent=hiScore.toLocaleString(); }
  spawnPiece();
  canHold=true;
}

function spawnPiece() {
  piece=newPiece(nextQueue.shift());
  nextQueue.push(randPiece());
  if(!valid(piece)){ endGame(); }
  drawNext();
}

function ghostRow() {
  let dy=0;
  while(valid(piece,0,dy+1)) dy++;
  return dy;
}

function hardDrop() {
  while(valid(piece,0,1)) piece.y++;
  lock();
}

function tryRotate() {
  const rotated=rotateCW(piece.shape);
  const kicks=[0,-1,1,-2,2];
  for(const k of kicks){ if(valid({...piece,shape:rotated},k,0)){piece.shape=rotated;piece.x+=k;return;} }
}

// ── Drawing ────────────────────────────────────────────
function drawBoard() {
  ctx.fillStyle='#0d0d1a'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Grid
  ctx.strokeStyle='#1a1a2e'; ctx.lineWidth=0.5;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    ctx.strokeRect(c*SQ,r*SQ,SQ,SQ);
    if(board[r][c]){ drawBlock(ctx,c,r,COLORS[board[r][c]]); }
  }
}

function drawBlock(c2d,x,y,color,alpha=1){
  c2d.globalAlpha=alpha;
  c2d.fillStyle=color; c2d.fillRect(x*SQ+1,y*SQ+1,SQ-2,SQ-2);
  c2d.fillStyle='rgba(255,255,255,0.25)'; c2d.fillRect(x*SQ+1,y*SQ+1,SQ-2,4);
  c2d.globalAlpha=1;
}

function drawPiece(p, offsetX=0, offsetY=0, c2d=ctx, alpha=1) {
  p.shape.forEach((row,r)=>row.forEach((v,c)=>{ if(v) drawBlock(c2d,p.x+c+offsetX,p.y+r+offsetY,COLORS[p.type],alpha); }));
}

function drawGhost() {
  const dy=ghostRow();
  piece.shape.forEach((row,r)=>row.forEach((v,c)=>{
    if(v&&piece.y+r+dy>=0){
      ctx.globalAlpha=0.2; ctx.fillStyle=COLORS[piece.type];
      ctx.fillRect((piece.x+c)*SQ+1,(piece.y+r+dy)*SQ+1,SQ-2,SQ-2); ctx.globalAlpha=1;
    }
  }));
}

function drawNext() {
  nextCtx.fillStyle='#1a1a2e'; nextCtx.fillRect(0,0,80,240);
  nextQueue.slice(0,3).forEach((type,i)=>{
    const shape=SHAPES[type]; const offX=Math.floor((4-shape[0].length)/2);
    const offY=i*3+Math.floor((2-shape.length)/2);
    shape.forEach((row,r)=>row.forEach((v,c)=>{
      if(v){ nextCtx.fillStyle=COLORS[type]; nextCtx.fillRect((c+offX)*20+8,(r+offY)*20+6,18,18);
        nextCtx.fillStyle='rgba(255,255,255,0.2)'; nextCtx.fillRect((c+offX)*20+8,(r+offY)*20+6,18,4); }
    }));
  });
}

function drawHold() {
  holdCtx.fillStyle='#1a1a2e'; holdCtx.fillRect(0,0,80,80);
  if(hold===null) return;
  const shape=SHAPES[hold]; const offX=Math.floor((4-shape[0].length)/2);
  const offY=Math.floor((4-shape.length)/2);
  shape.forEach((row,r)=>row.forEach((v,c)=>{
    if(v){ holdCtx.fillStyle=COLORS[hold]; holdCtx.fillRect((c+offX)*18+5,(r+offY)*18+5,16,16);
      holdCtx.fillStyle='rgba(255,255,255,0.2)'; holdCtx.fillRect((c+offX)*18+5,(r+offY)*18+5,16,4); }
  }));
}

function render() {
  drawBoard();
  if(piece){ drawGhost(); drawPiece(piece); }
}

// ── Game loop ─────────────────────────────────────────
function startGame() {
  board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  nextQueue=[randPiece(),randPiece(),randPiece(),randPiece()];
  hold=null; held=false; score=0; level=1; lines=0; canHold=true; softDrop=false;
  document.getElementById('score').textContent='0';
  document.getElementById('level').textContent='1';
  document.getElementById('lines').textContent='0';
  document.getElementById('overlay').classList.add('hidden');
  gameOver=false; paused=false;
  spawnPiece();
  lastDrop=performance.now();
  requestAnimationFrame(loop);
}

function endGame() {
  gameOver=true;
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('overlay-title').textContent='GAME OVER';
  document.getElementById('overlay-sub').textContent=`Score: ${score.toLocaleString()} | Press SPACE`;
}

let lastFrame=0;
function loop(now) {
  if(gameOver||paused) return;
  const speed=LEVEL_SPEED[level-1]||80;
  const interval=softDrop?50:speed;
  if(now-lastDrop>=interval){ if(valid(piece,0,1)){piece.y++;} else{lock();} lastDrop=now; }
  render();
  requestAnimationFrame(loop);
}

// ── Input ──────────────────────────────────────────────
canvas.addEventListener('keydown',e=>{
  if(gameOver){ if(e.code==='Space'){e.preventDefault();startGame();} return; }
  if(e.code==='KeyP'){ paused=!paused; if(!paused){lastDrop=performance.now();requestAnimationFrame(loop);} return; }
  if(paused) return;
  switch(e.code){
    case 'ArrowLeft':  e.preventDefault(); if(valid(piece,-1,0)) piece.x--; break;
    case 'ArrowRight': e.preventDefault(); if(valid(piece,1,0))  piece.x++; break;
    case 'ArrowDown':  e.preventDefault(); softDrop=true; break;
    case 'ArrowUp':    e.preventDefault(); tryRotate(); break;
    case 'Space':      e.preventDefault(); hardDrop(); break;
    case 'KeyC':       e.preventDefault();
      if(canHold){
        const t=hold; hold=piece.type;
        piece=t!==null?newPiece(t):newPiece(nextQueue.shift())&&nextQueue.push(randPiece())||newPiece(hold-1);
        if(t===null){piece=newPiece(nextQueue.shift());nextQueue.push(randPiece());}
        else piece=newPiece(t);
        canHold=false; drawHold();
      } break;
  }
  render();
});
canvas.addEventListener('keyup',e=>{ if(e.code==='ArrowDown') softDrop=false; });
canvas.focus();

// ── Init ──────────────────────────────────────────────
chrome.storage.local.get(['tetrisHi'],d=>{
  hiScore=d.tetrisHi||0;
  document.getElementById('best').textContent=hiScore.toLocaleString();
});
board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
render();
