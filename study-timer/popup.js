const DEFAULT_SUBJECTS = ['数学','英語','国語','理科','社会','プログラミング'];
const SUBJECT_COLORS   = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'];

let subjects = [], subjectData = {}, running = false, elapsed = 0, startTime = null;
let timerMode = 'free', goalSecs = 3600;
let laps = [], lapStart = 0;

const ringCanvas = document.getElementById('ring-canvas');
const ringCtx    = ringCanvas.getContext('2d');
const CIRCUMF    = 2 * Math.PI * 80;

function today() { return new Date().toISOString().split('T')[0]; }
function todayKey(subject) { return `${subject}_${today()}`; }

function fmt(secs) {
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function fmtHM(secs) {
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60);
  return h>0 ? `${h}h${m}m` : `${m}m`;
}

// ── UI Updates ────────────────────────────────────────
function drawRing(elapsed, goal) {
  ringCtx.clearRect(0, 0, 200, 200);
  const cx=100, cy=100, r=80, lw=14;
  const pct = goal > 0 ? Math.min(1, elapsed/goal) : (elapsed > 0 ? (elapsed%3600)/3600 : 0);
  const subj = document.getElementById('subject-select').value;
  const idx  = subjects.indexOf(subj);
  const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length] || '#6366f1';

  // Background
  ringCtx.beginPath(); ringCtx.arc(cx,cy,r,0,Math.PI*2);
  ringCtx.strokeStyle='#1e1e2e'; ringCtx.lineWidth=lw; ringCtx.stroke();

  // Progress
  if (elapsed > 0 || running) {
    const endAngle = -Math.PI/2 + Math.PI*2*pct;
    ringCtx.beginPath(); ringCtx.arc(cx,cy,r,-Math.PI/2,endAngle);
    ringCtx.strokeStyle=color; ringCtx.lineWidth=lw; ringCtx.lineCap='round'; ringCtx.stroke();
  }
}

function updateDisplay() {
  document.getElementById('timer-time').textContent = fmt(elapsed);
  const goalEl = document.getElementById('timer-goal');
  if (timerMode==='goal' && goalSecs>0) {
    const pct = Math.round(elapsed/goalSecs*100);
    goalEl.textContent = `${pct}% / ${fmtHM(goalSecs)}`;
  } else {
    goalEl.textContent = '';
  }
  drawRing(elapsed, timerMode==='goal'?goalSecs:timerMode==='pomodoro'?1500:3600);
}

function updateTodayStats() {
  const subj = document.getElementById('subject-select').value;
  const todayTotal = Object.entries(subjectData)
    .filter(([k]) => k.endsWith('_'+today()))
    .reduce((s,[,v]) => s+v, 0);
  const streak = calcStreak(subj);
  const sessToday = (subjectData[todayKey(subj)] || 0) + (running ? elapsed : 0);

  document.getElementById('today-stats').innerHTML = `
    <div class="ts-item"><div class="ts-val">${fmtHM(sessToday)}</div><div class="ts-lbl">今日 (${subj})</div></div>
    <div class="ts-item"><div class="ts-val">${fmtHM(todayTotal)}</div><div class="ts-lbl">今日 合計</div></div>
    <div class="ts-item"><div class="ts-val">🔥${streak}</div><div class="ts-lbl">連続日数</div></div>
  `;
}

function calcStreak(subject) {
  let streak=0; let d=new Date();
  for (let i=0;i<365;i++) {
    const key = `${subject}_${d.toISOString().split('T')[0]}`;
    if (subjectData[key]>0) streak++;
    else if (i>0) break;
    d.setDate(d.getDate()-1);
  }
  return streak;
}

// ── Subject management ────────────────────────────────
function renderSubjects() {
  const sel = document.getElementById('subject-select');
  const cur = sel.value;
  sel.innerHTML = subjects.map((s,i) => `<option value="${s}" style="color:${SUBJECT_COLORS[i%SUBJECT_COLORS.length]}">${s}</option>`).join('');
  if (subjects.includes(cur)) sel.value = cur;
}

document.getElementById('btn-add-subject').addEventListener('click', () => {
  const name = prompt('科目名を入力:');
  if (name?.trim() && !subjects.includes(name.trim())) {
    subjects.push(name.trim()); renderSubjects();
    chrome.storage.local.set({ subjects });
  }
});
document.getElementById('btn-del-subject').addEventListener('click', () => {
  const subj = document.getElementById('subject-select').value;
  if (subjects.length <= 1) return;
  if (confirm(`「${subj}」を削除しますか？`)) {
    subjects = subjects.filter(s=>s!==subj);
    renderSubjects();
    chrome.storage.local.set({ subjects });
  }
});

// ── Timer ─────────────────────────────────────────────
let tick = null;

document.getElementById('btn-start').addEventListener('click', toggleTimer);

function toggleTimer() {
  const btn = document.getElementById('btn-start');
  if (!running) {
    running=true; startTime=Date.now()-elapsed*1000;
    if (lapStart===0) lapStart=elapsed;
    btn.textContent='⏸ 停止'; btn.classList.add('running');
    tick = setInterval(() => {
      elapsed = Math.floor((Date.now()-startTime)/1000);
      updateDisplay(); updateTodayStats();
      // Pomodoro auto-stop at 25min
      if (timerMode==='pomodoro' && elapsed>=1500) { stopTimer(true); }
      if (timerMode==='goal' && elapsed>=goalSecs) { stopTimer(true); }
    }, 500);
    if (timerMode==='goal' && goalSecs>0) {
      chrome.alarms.create('study-end', { delayInMinutes: goalSecs/60 });
    }
  } else {
    stopTimer(false);
  }
}

function stopTimer(autoEnd) {
  running=false; clearInterval(tick); tick=null;
  const btn = document.getElementById('btn-start');
  btn.textContent='▶ スタート'; btn.classList.remove('running');
  const subj = document.getElementById('subject-select').value;
  // Save session
  const key = todayKey(subj);
  subjectData[key] = (subjectData[key]||0) + elapsed;
  chrome.storage.local.set({ subjectData });
  elapsed=0; lapStart=0; updateDisplay(); updateTodayStats();
  renderWeekly(); renderSubjectStats();
  chrome.alarms.clear('study-end');
  if (autoEnd) chrome.notifications?.create?.({type:'basic',iconUrl:'icons/icon128.png',title:'📚 学習完了！',message:'設定した時間の学習が終わりました！'});
}

document.getElementById('btn-reset').addEventListener('click', () => {
  if (running) { running=false; clearInterval(tick); tick=null; document.getElementById('btn-start').textContent='▶ スタート'; document.getElementById('btn-start').classList.remove('running'); }
  elapsed=0; laps=[]; lapStart=0; updateDisplay(); renderLaps();
});

document.getElementById('btn-lap').addEventListener('click', () => {
  if (!running) return;
  const lapTime = elapsed - lapStart;
  laps.push({ n: laps.length+1, total: elapsed, split: lapTime });
  lapStart = elapsed;
  renderLaps();
});

// ── Mode ──────────────────────────────────────────────
document.querySelectorAll('.mode-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); timerMode=btn.dataset.mode;
    document.getElementById('timer-mode').textContent = {free:'フリー',pomodoro:'ポモドーロ (25分)',goal:'目標時間'}[timerMode];
    document.getElementById('goal-input-row').classList.toggle('hidden', timerMode!=='goal');
    updateDisplay();
  });
});
document.getElementById('goal-hours').addEventListener('change', () => {
  goalSecs = parseInt(document.getElementById('goal-hours').value||0)*3600 + parseInt(document.getElementById('goal-mins').value||0)*60;
  document.getElementById('timer-goal').textContent = `目標: ${fmtHM(goalSecs)}`;
  updateDisplay();
});
document.getElementById('goal-mins').addEventListener('change', () => {
  goalSecs = parseInt(document.getElementById('goal-hours').value||0)*3600 + parseInt(document.getElementById('goal-mins').value||0)*60;
  updateDisplay();
});

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-'+tab.dataset.tab).classList.remove('hidden');
  });
});

// ── Charts ────────────────────────────────────────────
function renderWeekly() {
  const c = document.getElementById('weekly-chart');
  const ctx2 = c.getContext('2d');
  ctx2.clearRect(0,0,340,90);
  ctx2.fillStyle='#1e1e2e'; ctx2.fillRect(0,0,340,90);

  const days=[];
  for (let i=6;i>=0;i--) { const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toISOString().split('T')[0]); }

  const dayTotals = days.map(d =>
    subjects.reduce((s,subj) => s+(subjectData[`${subj}_${d}`]||0), 0)
  );
  const maxVal = Math.max(...dayTotals, 1);
  const barW = 340/7;

  dayTotals.forEach((v,i) => {
    const bh = (v/maxVal)*72;
    const bx = i*barW+3; const by=80-bh;
    const isToday = i===6;
    ctx2.fillStyle = isToday ? '#6366f1' : '#312e81';
    ctx2.beginPath(); ctx2.roundRect(bx, by, barW-6, bh, 3); ctx2.fill();
    const wd=['日','月','火','水','木','金','土'][new Date(days[i]+'T00:00:00').getDay()];
    ctx2.fillStyle = isToday?'#818cf8':'#374151'; ctx2.font='9px sans-serif'; ctx2.textAlign='center';
    ctx2.fillText(wd, bx+(barW-6)/2, 89);
    if (v>0) { ctx2.fillStyle='#818cf8'; ctx2.fillText(fmtHM(v), bx+(barW-6)/2, Math.max(12,by-2)); }
  });

  const total7 = dayTotals.reduce((s,v)=>s+v,0);
  const avg = Math.round(total7/7);
  document.getElementById('weekly-stats').innerHTML = `
    <div class="ws-chip">週合計 <strong>${fmtHM(total7)}</strong></div>
    <div class="ws-chip">日平均 <strong>${fmtHM(avg)}</strong></div>
    <div class="ws-chip">最多 <strong>${fmtHM(Math.max(...dayTotals))}</strong></div>
  `;
}

function renderSubjectStats() {
  const container = document.getElementById('subject-stats');
  container.innerHTML='';
  const totals = subjects.map(s => ({
    name: s,
    total: Object.entries(subjectData).filter(([k])=>k.startsWith(s+'_')).reduce((sum,[,v])=>sum+v,0),
    idx: subjects.indexOf(s)
  })).sort((a,b)=>b.total-a.total);
  const maxT = Math.max(...totals.map(t=>t.total),1);
  totals.forEach(({name,total,idx})=>{
    const color=SUBJECT_COLORS[idx%SUBJECT_COLORS.length];
    const div=document.createElement('div'); div.className='ss-row';
    div.innerHTML=`<div class="ss-name">${name}</div>
      <div class="ss-bar-wrap"><div class="ss-bar" style="width:${total/maxT*100}%;background:${color}"></div></div>
      <div class="ss-time">${fmtHM(total)} | 今日: ${fmtHM(subjectData[todayKey(name)]||0)}</div>`;
    container.appendChild(div);
  });
}

function renderLaps() {
  const list = document.getElementById('laps-list');
  list.innerHTML='';
  [...laps].reverse().forEach(lap=>{
    const div=document.createElement('div'); div.className='lap-item';
    div.innerHTML=`<span class="lap-num">Lap ${lap.n}</span><span class="lap-time">${fmt(lap.total)}</span><span class="lap-split">(+${fmt(lap.split)})</span>`;
    list.appendChild(div);
  });
}

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['subjects','subjectData'], d => {
  subjects    = d.subjects    || DEFAULT_SUBJECTS;
  subjectData = d.subjectData || {};
  renderSubjects();
  updateDisplay(); updateTodayStats();
  renderWeekly(); renderSubjectStats();
  document.getElementById('timer-mode').textContent = 'フリー';
});
