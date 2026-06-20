const clockCanvas = document.getElementById('clock-canvas');
const cCtx        = clockCanvas.getContext('2d');
const WORLD_ZONES = [
  { city:'東京',       tz:'Asia/Tokyo' },
  { city:'ニューヨーク', tz:'America/New_York' },
  { city:'ロンドン',    tz:'Europe/London' },
  { city:'パリ',       tz:'Europe/Paris' },
  { city:'シドニー',    tz:'Australia/Sydney' },
  { city:'シンガポール', tz:'Asia/Singapore' },
];
let alarms = [];
let timerRunning=false, timerSecs=0, timerTotal=0, timerInterval=null;

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p=>p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-'+tab.dataset.tab).classList.remove('hidden');
  });
});

// ── Analog Clock ──────────────────────────────────────
function drawClock() {
  const now = new Date();
  const W=180, H=180, cx=W/2, cy=H/2, r=80;
  cCtx.clearRect(0,0,W,H);

  // Face
  cCtx.beginPath(); cCtx.arc(cx,cy,r,0,Math.PI*2);
  const grad = cCtx.createRadialGradient(cx-20,cy-20,0,cx,cy,r);
  grad.addColorStop(0,'#1e1e2e'); grad.addColorStop(1,'#111118');
  cCtx.fillStyle=grad; cCtx.fill();
  cCtx.strokeStyle='#2d2d4e'; cCtx.lineWidth=2; cCtx.stroke();

  // Hour marks
  for (let i=0;i<12;i++) {
    const a=i*Math.PI/6-Math.PI/2;
    const r1=i%3===0?r-10:r-6, r2=r-2;
    cCtx.beginPath();
    cCtx.moveTo(cx+r1*Math.cos(a),cy+r1*Math.sin(a));
    cCtx.lineTo(cx+r2*Math.cos(a),cy+r2*Math.sin(a));
    cCtx.strokeStyle=i%3===0?'#6366f1':'#2d2d4e';
    cCtx.lineWidth=i%3===0?2:1; cCtx.stroke();
  }

  const h=now.getHours()%12, m=now.getMinutes(), s=now.getSeconds();
  const ms=now.getMilliseconds();

  // Hour hand
  const hAngle=(h+m/60)*Math.PI/6-Math.PI/2;
  drawHand(cCtx,cx,cy,hAngle,r*0.5,5,'#e0e0f0');
  // Minute hand
  const mAngle=(m+s/60)*Math.PI/30-Math.PI/2;
  drawHand(cCtx,cx,cy,mAngle,r*0.75,3,'#c4b5fd');
  // Second hand
  const sAngle=(s+ms/1000)*Math.PI/30-Math.PI/2;
  drawHand(cCtx,cx,cy,sAngle,r*0.85,1,'#818cf8');

  // Center dot
  cCtx.beginPath(); cCtx.arc(cx,cy,4,0,Math.PI*2);
  cCtx.fillStyle='#818cf8'; cCtx.fill();

  // Digital time
  const pad=n=>String(n).padStart(2,'0');
  document.getElementById('digital-time').textContent=`${pad(now.getHours())}:${pad(m)}:${pad(s)}`;
  document.getElementById('date-display').textContent=now.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'});

  // Update world clocks if visible
  if (!document.getElementById('tab-world').classList.contains('hidden')) renderWorldClocks();
  // Check alarms
  checkAlarms(now);
}

function drawHand(ctx, cx, cy, angle, len, width, color) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx+len*Math.cos(angle), cy+len*Math.sin(angle));
  ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round'; ctx.stroke();
}

// ── Alarm operations ──────────────────────────────────
function renderAlarms() {
  const list = document.getElementById('alarm-list');
  list.innerHTML = '';
  if (!alarms.length) { list.innerHTML='<div style="color:#374151;font-size:12px;padding:8px">アラームなし</div>'; return; }

  const now = new Date();
  alarms.forEach((alarm, i) => {
    const [h,m] = alarm.time.split(':').map(Number);
    const nextFire = new Date(); nextFire.setHours(h,m,0,0);
    if (nextFire<=now) nextFire.setDate(nextFire.getDate()+1);
    const diffMs = nextFire-now;
    const diffH = Math.floor(diffMs/3600000), diffM = Math.floor((diffMs%3600000)/60000);
    const countdown = `${diffH}時間${diffM}分後`;

    const div=document.createElement('div');
    div.className='alarm-item'+(alarm.enabled?'':' disabled');
    div.innerHTML=`
      <span class="alarm-time-big">${alarm.time}</span>
      <div class="alarm-info">
        <div class="alarm-label">${alarm.label||'アラーム'}</div>
        <div class="alarm-repeat">${{once:'1回のみ',daily:'毎日',weekdays:'平日',weekends:'週末'}[alarm.repeat||'once']} ${alarm.enabled?`<span class="alarm-countdown">${countdown}</span>`:''}</div>
      </div>
      <button class="alarm-toggle${alarm.enabled?' on':''}" data-i="${i}"></button>
      <button class="alarm-del" data-i="${i}">×</button>
    `;
    div.querySelector('.alarm-toggle').addEventListener('click', () => {
      alarms[i].enabled=!alarms[i].enabled; saveAlarms(); scheduleAlarms(); renderAlarms();
    });
    div.querySelector('.alarm-del').addEventListener('click', () => {
      chrome.alarms.clear('alarm_'+alarm.id);
      alarms.splice(i,1); saveAlarms(); renderAlarms();
    });
    list.appendChild(div);
  });
}

function saveAlarms() { chrome.storage.local.set({ alarms }); }

function scheduleAlarms() {
  alarms.forEach(alarm => {
    chrome.alarms.clear('alarm_'+alarm.id);
    if (!alarm.enabled) return;
    const [h,m]=alarm.time.split(':').map(Number);
    const now=new Date(), fire=new Date();
    fire.setHours(h,m,0,0);
    if(fire<=now) fire.setDate(fire.getDate()+1);
    const delayMin=(fire-now)/60000;
    const period = alarm.repeat==='daily'?1440:undefined;
    if (period) chrome.alarms.create('alarm_'+alarm.id,{delayInMinutes:delayMin,periodInMinutes:period});
    else chrome.alarms.create('alarm_'+alarm.id,{delayInMinutes:delayMin});
  });
}

function checkAlarms(now) {
  const h=now.getHours(), m=now.getMinutes(), s=now.getSeconds();
  if (s!==0) return;
  alarms.forEach(alarm => {
    if (!alarm.enabled) return;
    const [ah,am]=alarm.time.split(':').map(Number);
    if (ah===h && am===m) {
      chrome.notifications?.create?.({type:'basic',iconUrl:'icons/icon128.png',title:`⏰ ${alarm.label||'アラーム'}`,message:`${alarm.time} のアラームです！`});
    }
  });
}

document.getElementById('btn-add-alarm').addEventListener('click', () => {
  const time=document.getElementById('alarm-time').value;
  const label=document.getElementById('alarm-label').value.trim();
  const repeat=document.getElementById('alarm-repeat').value;
  alarms.push({id:Date.now().toString(36),time,label,repeat,enabled:true});
  saveAlarms(); scheduleAlarms(); renderAlarms();
  document.getElementById('alarm-label').value='';
});

// ── Timer ─────────────────────────────────────────────
function fmtTimer(s) {
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function updateTimerDisplay() {
  document.getElementById('timer-time').textContent=fmtTimer(timerSecs);
  const pct=timerTotal>0?(1-timerSecs/timerTotal)*100:0;
  document.getElementById('timer-bar').style.width=pct+'%';
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    timerTotal=timerSecs=parseInt(btn.dataset.sec);
    updateTimerDisplay();
    if(timerRunning){clearInterval(timerInterval);timerRunning=false;document.getElementById('btn-timer-start').textContent='▶ スタート';document.getElementById('btn-timer-start').classList.remove('running');}
  });
});

['timer-h','timer-m','timer-s'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{
  const h=parseInt(document.getElementById('timer-h').value||0);
  const m=parseInt(document.getElementById('timer-m').value||0);
  const s=parseInt(document.getElementById('timer-s').value||0);
  timerTotal=timerSecs=h*3600+m*60+s; updateTimerDisplay();
}));

document.getElementById('btn-timer-start').addEventListener('click', function() {
  if (!timerRunning) {
    if(timerSecs<=0){timerTotal=timerSecs=(parseInt(document.getElementById('timer-h').value||0)*3600+parseInt(document.getElementById('timer-m').value||0)*60+parseInt(document.getElementById('timer-s').value||0));}
    if(timerSecs<=0) return;
    timerRunning=true; this.textContent='⏸ 停止'; this.classList.add('running');
    timerInterval=setInterval(()=>{
      timerSecs--;updateTimerDisplay();
      if(timerSecs<=0){clearInterval(timerInterval);timerRunning=false;document.getElementById('btn-timer-start').textContent='▶ スタート';document.getElementById('btn-timer-start').classList.remove('running');chrome.notifications?.create?.({type:'basic',iconUrl:'icons/icon128.png',title:'⏱ タイマー終了！',message:'設定した時間が経過しました！'});}
    },1000);
  } else {clearInterval(timerInterval);timerRunning=false;this.textContent='▶ スタート';this.classList.remove('running');}
});
document.getElementById('btn-timer-reset').addEventListener('click',()=>{clearInterval(timerInterval);timerRunning=false;timerSecs=timerTotal;document.getElementById('btn-timer-start').textContent='▶ スタート';document.getElementById('btn-timer-start').classList.remove('running');updateTimerDisplay();});

// ── World Clocks ──────────────────────────────────────
function renderWorldClocks() {
  const container = document.getElementById('world-clocks');
  container.innerHTML='';
  const now=new Date();
  WORLD_ZONES.forEach(({city,tz})=>{
    const time=now.toLocaleTimeString('ja-JP',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const offset=now.toLocaleString('en',{timeZone:tz,timeZoneName:'shortOffset'}).match(/GMT([+-]\d+)/)?.[1]||'';
    const div=document.createElement('div');
    div.className='world-clock-item';
    div.innerHTML=`<div><div class="wc-city">${city}</div><div class="wc-offset">UTC${offset}</div></div><div class="wc-time">${time}</div>`;
    container.appendChild(div);
  });
}

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['alarms'],d=>{
  alarms=d.alarms||[];
  renderAlarms();
  scheduleAlarms();
});
updateTimerDisplay();
setInterval(drawClock, 100);
drawClock();
