const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ── Game state ────────────────────────────────────────
const BRICK_ROWS = 5, BRICK_COLS = 10;
const BRICK_W = 36, BRICK_H = 14, BRICK_GAP = 4;
const BRICK_OFFSET_X = (W - BRICK_COLS*(BRICK_W+BRICK_GAP)+BRICK_GAP) / 2;
const BRICK_OFFSET_Y = 40;

const PADDLE_H = 10, BALL_R = 7;
const POWERUP_TYPES = ['wide','multi','slow','fast','extra'];
const POWERUP_COLORS = { wide:'#4ade80', multi:'#f59e0b', slow:'#38bdf8', fast:'#f87171', extra:'#c084fc' };
const BRICK_COLORS = ['#f87171','#fb923c','#fbbf24','#4ade80','#38bdf8'];

let paddle, balls, bricks, powerups, score, hiScore=0, lives, level, state;
// state: 'idle'|'running'|'paused'|'dead'|'win'|'over'
let paddleW = 70;
let keys = {}, mouseX = W/2;
let frameId = null;

function makeBricks() {
  const arr = [];
  for (let r=0;r<BRICK_ROWS;r++) for (let c=0;c<BRICK_COLS;c++) {
    const hp = r<2 ? 1 : r<4 ? 2 : 3; // top rows easier
    arr.push({
      x: BRICK_OFFSET_X + c*(BRICK_W+BRICK_GAP),
      y: BRICK_OFFSET_Y + r*(BRICK_H+BRICK_GAP),
      w: BRICK_W, h: BRICK_H,
      hp, maxHp: hp, alive: true,
      color: BRICK_COLORS[r % BRICK_COLORS.length],
      hasPowerup: Math.random() < 0.12,
    });
  }
  return arr;
}

function initBall(fromPaddle=true) {
  const speed = 4 + level * 0.5;
  const angle = -Math.PI/2 + (Math.random()-0.5)*0.6;
  return {
    x: fromPaddle ? paddle.x + paddleW/2 : W/2,
    y: fromPaddle ? paddle.y - BALL_R - 1 : H/2,
    vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
    stuck: fromPaddle,
  };
}

function newGame(lvl=1) {
  level = lvl;
  score = lvl===1 ? 0 : score;
  lives = 3;
  paddleW = 70;
  paddle = { x: W/2 - paddleW/2, y: H - 30, w: paddleW, h: PADDLE_H };
  balls = [initBall(true)];
  bricks = makeBricks();
  powerups = [];
  state = 'idle';
  updateHUD();
  cancelAnimationFrame(frameId);
  gameLoop();
}

function updateHUD() {
  document.getElementById('score').textContent = score.toLocaleString();
  document.getElementById('best').textContent  = hiScore.toLocaleString();
  document.getElementById('level').textContent = level;
  document.getElementById('lives').textContent = lives;
}

// ── Game loop ─────────────────────────────────────────
let lastTime = 0;
function gameLoop(ts=0) {
  const dt = Math.min((ts-lastTime)/16, 3); lastTime=ts;
  if (state==='running') update(dt);
  draw();
  frameId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  // Paddle movement
  const speed = 8 * dt;
  if (keys['ArrowLeft']  && paddle.x > 0)              paddle.x -= speed;
  if (keys['ArrowRight'] && paddle.x+paddleW < W)      paddle.x += speed;
  // Mouse
  paddle.x = Math.max(0, Math.min(W-paddleW, mouseX - paddleW/2));
  paddle.w = paddleW;

  // Balls
  balls.forEach(ball => {
    if (ball.stuck) { ball.x = paddle.x + paddleW/2; ball.y = paddle.y - BALL_R - 1; return; }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // Wall bounce
    if (ball.x - BALL_R < 0)  { ball.x = BALL_R;     ball.vx =  Math.abs(ball.vx); }
    if (ball.x + BALL_R > W)   { ball.x = W-BALL_R;   ball.vx = -Math.abs(ball.vx); }
    if (ball.y - BALL_R < 0)   { ball.y = BALL_R;     ball.vy =  Math.abs(ball.vy); }
    // Bottom
    if (ball.y + BALL_R > H) { ball.alive = false; }
    // Paddle
    if (ball.vy > 0 &&
        ball.y + BALL_R >= paddle.y &&
        ball.y - BALL_R <= paddle.y + PADDLE_H &&
        ball.x >= paddle.x && ball.x <= paddle.x + paddleW) {
      ball.vy = -Math.abs(ball.vy);
      // Angle from paddle center
      const offset = (ball.x - (paddle.x + paddleW/2)) / (paddleW/2);
      ball.vx += offset * 2;
      const spd = Math.hypot(ball.vx, ball.vy);
      ball.vx = ball.vx/spd * spd; ball.vy = ball.vy/spd * spd;
    }
    // Bricks
    bricks.filter(b=>b.alive).forEach(brick => {
      if (ball.x+BALL_R < brick.x || ball.x-BALL_R > brick.x+brick.w) return;
      if (ball.y+BALL_R < brick.y || ball.y-BALL_R > brick.y+brick.h) return;
      brick.hp--;
      if (brick.hp<=0) {
        brick.alive=false;
        score += (brick.maxHp*10) * level;
        if (score>hiScore){ hiScore=score; chrome.storage.local.set({breakoutHi:hiScore}); }
        if (brick.hasPowerup) spawnPowerup(brick.x+brick.w/2, brick.y+brick.h/2);
      }
      // Reflect
      const overX = Math.min(ball.x+BALL_R-brick.x, brick.x+brick.w-ball.x+BALL_R);
      const overY = Math.min(ball.y+BALL_R-brick.y, brick.y+brick.h-ball.y+BALL_R);
      if (overX < overY) ball.vx = -ball.vx; else ball.vy = -ball.vy;
    });
  });

  // Remove dead balls
  balls = balls.filter(b=>b.alive);
  if (!balls.length) {
    lives--;
    updateHUD();
    if (lives<=0) { state='over'; return; }
    balls = [initBall(true)]; state='idle';
  }

  // Powerups
  powerups.forEach(p => {
    p.y += 2*dt;
    if (p.y > H) { p.alive=false; return; }
    if (p.y+10 >= paddle.y && p.y <= paddle.y+PADDLE_H &&
        p.x >= paddle.x && p.x <= paddle.x+paddleW) {
      applyPowerup(p.type); p.alive=false;
    }
  });
  powerups = powerups.filter(p=>p.alive);

  // Check win
  if (bricks.every(b=>!b.alive)) {
    setTimeout(()=>newGame(level+1), 800);
    state='win';
  }

  updateHUD();
}

function spawnPowerup(x, y) {
  const type = POWERUP_TYPES[Math.floor(Math.random()*POWERUP_TYPES.length)];
  powerups.push({ x, y, type, alive:true });
}

function applyPowerup(type) {
  if (type==='wide')  { paddleW=Math.min(120,paddleW+20); setTimeout(()=>paddleW=70,8000); }
  if (type==='multi') { balls.push(initBall(false)); }
  if (type==='slow')  { balls.forEach(b=>{b.vx*=0.7;b.vy*=0.7;}); }
  if (type==='fast')  { balls.forEach(b=>{b.vx*=1.3;b.vy*=1.3;}); }
  if (type==='extra') { lives++; updateHUD(); }
}

// ── Draw ──────────────────────────────────────────────
function draw() {
  ctx.fillStyle='#0d0d1a'; ctx.fillRect(0,0,W,H);

  // Bricks
  bricks.filter(b=>b.alive).forEach(brick => {
    const ratio = brick.hp/brick.maxHp;
    const alpha = 0.5 + ratio*0.5;
    ctx.globalAlpha=alpha;
    ctx.fillStyle=brick.color;
    ctx.beginPath(); ctx.roundRect(brick.x,brick.y,brick.w,brick.h,3); ctx.fill();
    // Shine
    ctx.globalAlpha=0.3;
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.fillRect(brick.x+2, brick.y+2, brick.w-4, 3);
    ctx.globalAlpha=1;
    // HP dots
    for (let i=0;i<brick.maxHp;i++) {
      ctx.fillStyle=i<brick.hp?brick.color:'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(brick.x+brick.w-8-i*7,brick.y+brick.h/2,2,0,Math.PI*2); ctx.fill();
    }
  });

  // Paddle
  const grad = ctx.createLinearGradient(paddle.x,paddle.y,paddle.x,paddle.y+PADDLE_H);
  grad.addColorStop(0,'#a78bfa'); grad.addColorStop(1,'#6d28d9');
  ctx.fillStyle=grad;
  ctx.beginPath(); ctx.roundRect(paddle.x,paddle.y,paddleW,PADDLE_H,5); ctx.fill();

  // Balls
  balls.forEach(ball => {
    const g=ctx.createRadialGradient(ball.x-2,ball.y-2,0,ball.x,ball.y,BALL_R);
    g.addColorStop(0,'#fff'); g.addColorStop(0.6,'#c4b5fd'); g.addColorStop(1,'#6d28d9');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(ball.x,ball.y,BALL_R,0,Math.PI*2); ctx.fill();
  });

  // Powerups
  powerups.forEach(p => {
    ctx.fillStyle=POWERUP_COLORS[p.type]||'#fff';
    ctx.beginPath(); ctx.roundRect(p.x-16,p.y-8,32,16,8); ctx.fill();
    ctx.fillStyle='#000'; ctx.font='9px sans-serif'; ctx.textAlign='center';
    ctx.fillText({wide:'WIDE',multi:'MULTI',slow:'SLOW',fast:'FAST',extra:'LIFE'}[p.type],p.x,p.y+3);
  });

  // Overlay messages
  if (state==='idle') drawMsg('スペースキーでスタート','▶');
  if (state==='paused') drawMsg('⏸ ポーズ中','スペースキーで再開');
  if (state==='over')   drawMsg('💀 GAME OVER',`スコア: ${score.toLocaleString()} | スペースキーで再スタート`);
  if (state==='win')    drawMsg('🎉 LEVEL CLEAR!',`LEVEL ${level+1} に進みます...`);
}

function drawMsg(title, sub) {
  ctx.fillStyle='rgba(10,10,20,0.82)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#818cf8'; ctx.font='bold 22px sans-serif'; ctx.fillText(title,W/2,H/2-14);
  ctx.fillStyle='#6b7280'; ctx.font='13px sans-serif'; ctx.fillText(sub,W/2,H/2+14);
}

// ── Input ─────────────────────────────────────────────
canvas.addEventListener('keydown',e=>{
  keys[e.key]=true;
  if (e.code==='Space') {
    e.preventDefault();
    if (state==='idle')   { state='running'; balls.forEach(b=>{ b.stuck=false; const sp=4+level*0.5; b.vy=-sp; b.vx=(Math.random()-0.5)*sp*0.8; }); }
    else if (state==='running') state='paused';
    else if (state==='paused')  state='running';
    else if (state==='over')    newGame(1);
  }
  if (e.code==='ArrowLeft'||e.code==='ArrowRight') e.preventDefault();
});
canvas.addEventListener('keyup',e=>{ keys[e.key]=false; });
canvas.addEventListener('mousemove',e=>{ const r=canvas.getBoundingClientRect(); mouseX=e.clientX-r.left; });

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['breakoutHi'],d=>{
  hiScore=d.breakoutHi||0;
  document.getElementById('best').textContent=hiScore.toLocaleString();
  newGame(1); canvas.focus();
});
