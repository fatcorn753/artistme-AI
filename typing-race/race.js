const TEXTS = {
  easy: [
    'the quick brown fox jumps over the lazy dog',
    'hello world this is a typing race game play now',
    'practice makes perfect keep typing every day',
    'speed and accuracy are both very important skills',
  ],
  medium: [
    'the only way to do great work is to love what you do stay hungry stay foolish',
    'programming is the art of algorithm design and the craft of debugging',
    'success is not final failure is not fatal it is the courage to continue that counts',
    'in the middle of difficulty lies opportunity every problem has a solution within it',
  ],
  hard: [
    'asynchronous JavaScript promises and async await patterns revolutionized web development significantly',
    'the quick brown fox jumps over 13 lazy dogs! Special chars: @#$%^&*(){}[]<>?/|~',
    'consciousness is a fascinating and deeply mysterious phenomenon studied by neuroscientists worldwide',
    'complexity analysis using Big-O notation: O(1) O(log n) O(n) O(n²) O(2^n) O(n!)',
  ],
  jp: [
    'すもも も もも も もも の うち もも も すもも も もも の うち',
    'はやい タイピングは れんしゅうを つづけることで ちからが つきます',
    'プログラミングは むずかしいが たのしい しごとです まいにち べんきょうしよう',
    'にほんごの タイピングも れんしゅうすれば はやく うつことが できます',
  ],
};

let currentText='', typedCorrect=0, typedTotal=0, startTime=null, running=false;
let cpuInterval=null, cpuProgress=0, difficulty='medium', cpuWPM=80;
let bestScores={easy:0,medium:0,hard:0,jp:0};

const typeInput   = document.getElementById('type-input');
const textDisplay = document.getElementById('text-display');
const playerBar   = document.getElementById('player-bar');
const cpuBar      = document.getElementById('cpu-bar');
const liveWPM     = document.getElementById('live-wpm');
const liveAcc     = document.getElementById('live-acc');
const liveTime    = document.getElementById('live-time');
let timeInterval  = null;

// ── Init race ─────────────────────────────────────────
function initRace() {
  const pool = TEXTS[difficulty];
  currentText = pool[Math.floor(Math.random()*pool.length)];
  typedCorrect=0; typedTotal=0; startTime=null; running=false; cpuProgress=0;
  typeInput.value=''; typeInput.disabled=false;
  playerBar.style.width='0%'; cpuBar.style.width='0%';
  liveWPM.textContent='0'; liveAcc.textContent='100%'; liveTime.textContent='0.0s';
  document.getElementById('result-panel').classList.add('hidden');
  clearInterval(cpuInterval); clearInterval(timeInterval);
  renderText(0, -1);
  typeInput.focus();
}

function renderText(correctLen, errorPos) {
  let html = '';
  for (let i=0;i<currentText.length;i++) {
    const ch = currentText[i]==' ' ? '&nbsp;' : currentText[i];
    if (i < correctLen)     html += `<span class="char-correct">${ch}</span>`;
    else if (i === errorPos) html += `<span class="char-error">${ch}</span>`;
    else if (i === correctLen) html += `<span class="char-current char-pending">${ch}</span>`;
    else                     html += `<span class="char-pending">${ch}</span>`;
  }
  textDisplay.innerHTML = html;
}

// ── Input handling ────────────────────────────────────
typeInput.addEventListener('input', () => {
  if (!running) {
    running = true; startTime = Date.now();
    startCPU(); startTimer();
  }

  const val = typeInput.value;
  const expected = currentText.slice(0, val.length);
  typedTotal = val.length;

  // Count correct chars
  let correct = 0;
  for (let i=0;i<val.length;i++) { if(val[i]===currentText[i]) correct++; }
  typedCorrect = correct;

  // Check current position error
  const lastChar = val[val.length-1];
  const expectedChar = currentText[val.length-1];
  const hasError = lastChar !== expectedChar;

  typeInput.classList.toggle('error', hasError);

  const correctLen = (() => { let l=0; for(let i=0;i<val.length;i++){if(val[i]===currentText[i])l++;else break;} return l; })();
  const errorPos = hasError ? val.length-1 : -1;
  renderText(correctLen, errorPos);

  // Progress
  const pct = Math.min(100, (correctLen / currentText.length) * 100);
  playerBar.style.width = pct + '%';

  // Update live stats
  const elapsedMin = (Date.now() - startTime) / 60000;
  const wpm = elapsedMin > 0 ? Math.round((correctLen/5) / elapsedMin) : 0;
  const acc = typedTotal > 0 ? Math.round(typedCorrect/typedTotal*100) : 100;
  liveWPM.textContent = wpm;
  liveAcc.textContent = acc + '%';

  // Auto clear on error after space
  if (val.endsWith(' ') && hasError) {
    // Allow continuing
  }

  // Finish
  if (correctLen === currentText.length) { finishRace(true); }
});

typeInput.addEventListener('keydown', e => {
  // Backspace handling is native
});

// ── CPU ───────────────────────────────────────────────
function startCPU() {
  const totalChars = currentText.length;
  const charsPerMs = cpuWPM * 5 / 60000;
  clearInterval(cpuInterval);
  cpuInterval = setInterval(() => {
    cpuProgress += charsPerMs * 100;
    const pct = Math.min(100, cpuProgress / totalChars * 100);
    cpuBar.style.width = pct + '%';
    if (cpuProgress >= totalChars) {
      clearInterval(cpuInterval);
      if (running) finishRace(false); // CPU won
    }
  }, 100);
}

function startTimer() {
  clearInterval(timeInterval);
  timeInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    liveTime.textContent = elapsed.toFixed(1) + 's';
  }, 100);
}

// ── Finish ────────────────────────────────────────────
function finishRace(playerWon) {
  running = false;
  typeInput.disabled = true;
  clearInterval(cpuInterval); clearInterval(timeInterval);

  const elapsedSec = (Date.now() - startTime) / 1000;
  const elapsedMin = elapsedSec / 60;
  const correctLen = (() => { let l=0,v=typeInput.value; for(let i=0;i<v.length;i++){if(v[i]===currentText[i])l++;else break;} return l; })();
  const finalWPM = elapsedMin > 0 ? Math.round((correctLen/5)/elapsedMin) : 0;
  const finalAcc = typedTotal > 0 ? Math.round(typedCorrect/typedTotal*100) : 100;

  const panel = document.getElementById('result-panel');
  document.getElementById('result-title').textContent = playerWon ? '🏆 勝利！' : '😔 CPU に負けました';

  document.getElementById('result-stats').innerHTML = `
    <div class="rs-item"><span class="rs-val">${finalWPM}</span><span class="rs-lbl">WPM</span></div>
    <div class="rs-item"><span class="rs-val">${finalAcc}%</span><span class="rs-lbl">精度</span></div>
    <div class="rs-item"><span class="rs-val">${elapsedSec.toFixed(1)}s</span><span class="rs-lbl">タイム</span></div>
  `;

  let recordMsg = '';
  if (playerWon && finalWPM > (bestScores[difficulty]||0)) {
    bestScores[difficulty] = finalWPM;
    chrome.storage.local.set({ typingRaceBest: bestScores });
    recordMsg = `🏆 新記録！ ${finalWPM} WPM`;
    if (playerWon) confetti();
  } else if (playerWon) {
    recordMsg = `ベスト: ${bestScores[difficulty]} WPM`;
  }
  document.getElementById('records').textContent = recordMsg;
  updateBestDisplay();
  panel.classList.remove('hidden');
}

function confetti() {
  const wrap = document.createElement('div');
  wrap.className = 'confetti-wrap';
  document.body.appendChild(wrap);
  const colors = ['#f59e0b','#4ade80','#818cf8','#f87171','#60a5fa'];
  for (let i=0;i<40;i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random()*100+'%';
    piece.style.top = '-10px';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.animationDelay = Math.random()*0.8+'s';
    wrap.appendChild(piece);
  }
  setTimeout(()=>wrap.remove(), 2000);
}

// ── Controls ──────────────────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); difficulty=btn.dataset.diff; initRace();
  });
});

document.getElementById('cpu-speed').addEventListener('input', e => {
  cpuWPM = parseInt(e.target.value);
  document.getElementById('cpu-wpm-display').textContent = cpuWPM + ' WPM';
  document.getElementById('cpu-label').textContent = `CPU (${cpuWPM}WPM)`;
});

document.getElementById('btn-retry').addEventListener('click', initRace);

function updateBestDisplay() {
  ['easy','medium','hard'].forEach(d=>{
    document.getElementById('best-'+d).textContent = bestScores[d] ? bestScores[d]+' WPM' : '—';
  });
}

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['typingRaceBest'],d=>{
  bestScores=d.typingRaceBest||{easy:0,medium:0,hard:0,jp:0};
  updateBestDisplay(); initRace();
});
