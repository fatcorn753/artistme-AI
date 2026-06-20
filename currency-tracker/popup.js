const CURRENCIES = ['USD','EUR','JPY','GBP','AUD','CAD','CHF','CNY','KRW','SGD','HKD','INR','MXN','BRL','NOK','SEK','DKK','NZD','THB','ZAR'];
let trackedPairs=[], rateHistory={}, rateAlerts=[], lastFetch=null, selectedPair=null, chartDays=7;

// ── Populate currency selects ─────────────────────────
['base-sel','quote-sel'].forEach((id,i) => {
  const sel=document.getElementById(id);
  CURRENCIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
  sel.value=i===0?'USD':'JPY';
});

// ── Load data ─────────────────────────────────────────
async function loadData() {
  const d=await new Promise(r=>chrome.storage.local.get(['trackedPairs','rateHistory','rateAlerts','lastFetch'],r));
  trackedPairs=d.trackedPairs||[{from:'USD',to:'JPY'},{from:'EUR',to:'JPY'}];
  rateHistory=d.rateHistory||{};
  rateAlerts=d.rateAlerts||[];
  lastFetch=d.lastFetch||null;
  if(lastFetch) document.getElementById('last-update').textContent='最終更新: '+new Date(lastFetch).toLocaleTimeString('ja-JP');

  // Populate alert pair select
  populateAlertPairs();
  renderPairs();
  renderAlerts();
  if(trackedPairs.length) { selectedPair=trackedPairs[0]; renderChart(); }
}

function save() { chrome.storage.local.set({ trackedPairs, rateAlerts }); }

function getLatestRate(pair) {
  const key=`${pair.from}_${pair.to}`;
  const hist=rateHistory[key]||[];
  return hist.length?hist[hist.length-1].rate:null;
}

function getChange(pair) {
  const key=`${pair.from}_${pair.to}`;
  const hist=rateHistory[key]||[];
  if(hist.length<2) return null;
  const latest=hist[hist.length-1].rate, prev=hist[hist.length-2].rate;
  return ((latest-prev)/prev*100);
}

// ── Pairs ─────────────────────────────────────────────
function renderPairs() {
  const list=document.getElementById('pairs-list');
  list.innerHTML='';
  if(!trackedPairs.length){ list.innerHTML='<div style="color:#334155;font-size:11px;padding:6px">ペアを追加してください</div>'; return; }
  trackedPairs.forEach((pair,i)=>{
    const rate=getLatestRate(pair);
    const chg=getChange(pair);
    const div=document.createElement('div');
    const isSelected=selectedPair&&selectedPair.from===pair.from&&selectedPair.to===pair.to;
    div.className='pair-card'+(isSelected?' selected':'');
    div.innerHTML=`
      <div class="pair-name">${pair.from}/${pair.to}</div>
      <div class="pair-rate">${rate?rate.toFixed(4):'—'}</div>
      <div class="pair-change ${chg>=0?'pos':'neg'}">${chg!=null?(chg>=0?'▲':'▼')+Math.abs(chg).toFixed(2)+'%':'—'}</div>
      <button class="pair-del" data-i="${i}">×</button>
    `;
    div.addEventListener('click',e=>{ if(!e.target.classList.contains('pair-del')){selectedPair=pair;renderPairs();renderChart();} });
    div.querySelector('.pair-del').addEventListener('click',e=>{ e.stopPropagation(); trackedPairs.splice(i,1); save(); populateAlertPairs(); renderPairs(); });
    list.appendChild(div);
  });
}

document.getElementById('btn-add-pair').addEventListener('click',()=>{
  const from=document.getElementById('base-sel').value;
  const to=document.getElementById('quote-sel').value;
  if(from===to) return;
  if(trackedPairs.some(p=>p.from===from&&p.to===to)) return;
  trackedPairs.push({from,to}); save();
  populateAlertPairs(); renderPairs();
  // Fetch immediately
  chrome.runtime.sendMessage({action:'fetchNow'}).catch(()=>{});
});

// ── Chart ─────────────────────────────────────────────
function renderChart() {
  if(!selectedPair) return;
  const key=`${selectedPair.from}_${selectedPair.to}`;
  const hist=(rateHistory[key]||[]).slice(-chartDays);
  document.getElementById('chart-title').textContent=`${selectedPair.from}/${selectedPair.to} (過去${chartDays}日)`;

  const canvas=document.getElementById('rate-chart');
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,360,120);
  ctx.fillStyle='#1e293b'; ctx.fillRect(0,0,360,120);

  if(hist.length<2){ ctx.fillStyle='#334155'; ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.fillText('データが不足しています',180,60); return; }

  const rates=hist.map(h=>h.rate);
  const min=Math.min(...rates), max=Math.max(...rates), range=max-min||1;
  const pad={l:50,r:10,t:10,b:25};
  const W=360-pad.l-pad.r, H=120-pad.t-pad.b;

  // Gradient fill
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+H);
  grad.addColorStop(0,'rgba(52,211,153,0.3)'); grad.addColorStop(1,'rgba(52,211,153,0)');
  ctx.beginPath();
  hist.forEach((h,i)=>{
    const x=pad.l+i*(W/(hist.length-1));
    const y=pad.t+H-((h.rate-min)/range)*H;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.lineTo(pad.l+W,pad.t+H); ctx.lineTo(pad.l,pad.t+H); ctx.closePath();
  ctx.fillStyle=grad; ctx.fill();

  // Line
  ctx.beginPath();
  hist.forEach((h,i)=>{
    const x=pad.l+i*(W/(hist.length-1));
    const y=pad.t+H-((h.rate-min)/range)*H;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.strokeStyle='#34d399'; ctx.lineWidth=2; ctx.stroke();

  // Y labels
  ctx.fillStyle='#475569'; ctx.font='9px monospace'; ctx.textAlign='right';
  [min,max,(min+max)/2].forEach(v=>{ const y=pad.t+H-((v-min)/range)*H; ctx.fillText(v.toFixed(2),pad.l-4,y+3); });

  // X labels
  ctx.textAlign='center';
  [0,Math.floor(hist.length/2),hist.length-1].forEach(i=>{
    if(i<hist.length){ const x=pad.l+i*(W/(hist.length-1)); ctx.fillText(hist[i].date.slice(5),x,pad.t+H+14); }
  });

  // Stats
  const latest=rates[rates.length-1], first=rates[0];
  const totalChg=((latest-first)/first*100);
  document.getElementById('chart-stats').innerHTML=`
    <div class="cs-item">最新: <strong>${latest.toFixed(4)}</strong></div>
    <div class="cs-item">最高: <strong>${max.toFixed(4)}</strong></div>
    <div class="cs-item">最低: <strong>${min.toFixed(4)}</strong></div>
    <div class="cs-item">${chartDays}日変化: <strong class="${totalChg>=0?'pos':'neg'}">${totalChg>=0?'+':''}${totalChg.toFixed(2)}%</strong></div>
  `;
}

document.querySelectorAll('.period-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); chartDays=parseInt(btn.dataset.days); renderChart();
  });
});

// ── Alerts ────────────────────────────────────────────
function populateAlertPairs() {
  const sel=document.getElementById('alert-pair-sel');
  sel.innerHTML='';
  trackedPairs.forEach(p=>{ const o=document.createElement('option'); o.value=`${p.from}_${p.to}`; o.textContent=`${p.from}/${p.to}`; sel.appendChild(o); });
}

function renderAlerts() {
  const list=document.getElementById('alerts-list');
  list.innerHTML='';
  if(!rateAlerts.length){ list.innerHTML='<div style="color:#334155;font-size:10px;padding:4px">アラートなし</div>'; return; }
  rateAlerts.forEach((a,i)=>{
    const div=document.createElement('div');
    div.className='alert-item'+(a.triggered?' triggered':'');
    div.innerHTML=`<span class="alert-text">${a.pair}: ${a.dir==='above'?'↑':'↓'} ${a.rate}${a.triggered?' ✅':''}</span><button class="alert-del" data-i="${i}">×</button>`;
    div.querySelector('.alert-del').addEventListener('click',()=>{ rateAlerts.splice(i,1); save(); renderAlerts(); });
    list.appendChild(div);
  });
}

document.getElementById('btn-add-alert').addEventListener('click',()=>{
  const pair=document.getElementById('alert-pair-sel').value;
  const dir=document.getElementById('alert-dir').value;
  const rate=parseFloat(document.getElementById('alert-rate-input').value);
  if(!pair||isNaN(rate)||rate<=0) return;
  const [from,to]=pair.split('_');
  rateAlerts.push({pair,from,to,dir,rate,triggered:false});
  save(); renderAlerts();
  document.getElementById('alert-rate-input').value='';
});

// ── Refresh ───────────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click',async()=>{
  document.getElementById('btn-refresh').style.animation='spin 0.5s';
  // Re-fetch via background
  chrome.runtime.sendMessage({action:'fetchNow'}).catch(()=>{});
  await new Promise(r=>setTimeout(r,2000));
  await loadData();
  document.getElementById('btn-refresh').style.animation='';
});

// ── Init ─────────────────────────────────────────────
loadData();
