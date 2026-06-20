let categories = {}, currentView = 'study';
let studyQueue = [], studyIdx = 0, flipped = false, sessionStats = {};

function uuid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function today() { return new Date().toISOString().split('T')[0]; }
function save() { chrome.storage.local.set({ fcCategories: categories }); }

// SM-2
function sm2(card, q) {
  let ef = card.ef ?? 2.5, interval = card.interval ?? 1, reps = card.reps ?? 0;
  ef = Math.max(1.3, ef + 0.1 - (4-q)*(0.08+(4-q)*0.02));
  if (q <= 1) { reps=0; interval=1; }
  else if (reps===0) { interval=1; reps=1; }
  else if (reps===1) { interval=6; reps=2; }
  else { interval=Math.round(interval*ef); reps++; }
  return { ef, interval, reps, nextReview: addDays(today(), interval), lastStudied: today() };
}
function addDays(d, n) { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().split('T')[0]; }

// ── Views ─────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
    tab.classList.add('active');
    currentView = tab.dataset.view;
    document.getElementById('view-'+currentView).classList.remove('hidden');
    if (currentView==='cards')  populateCategorySelects();
    if (currentView==='stats')  renderStats();
    if (currentView==='study')  populateCategorySelects();
  });
});

// ── Study ─────────────────────────────────────────────
function populateCategorySelects() {
  ['study-category','manage-category'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    Object.keys(categories).forEach(cat => {
      const opt = document.createElement('option'); opt.value=cat; opt.textContent=cat;
      sel.appendChild(opt);
    });
  });
  updateHeaderStats();
}

function updateHeaderStats() {
  const total = Object.values(categories).reduce((s,c)=>s+c.cards.length,0);
  const due = getDueCards(Object.keys(categories)[0]).length;
  document.getElementById('header-stats').textContent = `${total}枚 | 要復習${due}枚`;
}

function getDueCards(catName) {
  const cat = categories[catName];
  if (!cat) return [];
  const t = today();
  return cat.cards.filter(c => !c.nextReview || c.nextReview <= t);
}

document.getElementById('btn-start-study').addEventListener('click', () => {
  const cat = document.getElementById('study-category').value;
  if (!cat) return;
  let due = getDueCards(cat);
  if (!due.length) due = categories[cat]?.cards?.slice(0,10) || [];
  if (!due.length) { document.getElementById('idle-msg').textContent='カードがありません'; return; }
  studyQueue = [...due].sort(()=>Math.random()-0.5);
  studyIdx=0; flipped=false; sessionStats={correct:0,total:0};
  document.getElementById('study-idle').classList.add('hidden');
  document.getElementById('study-area').classList.remove('hidden');
  showCard();
});

function showCard() {
  if (studyIdx >= studyQueue.length) { finishStudy(); return; }
  const card = studyQueue[studyIdx];
  document.getElementById('front-content').textContent = card.front;
  document.getElementById('back-content').textContent  = card.back;
  document.getElementById('card-3d').classList.remove('flipped');
  document.getElementById('rating-section').classList.add('hidden');
  flipped = false;

  const pct = studyIdx / studyQueue.length * 100;
  document.getElementById('study-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${studyIdx}/${studyQueue.length}`;
}

document.getElementById('card-scene').addEventListener('click', () => {
  if (flipped) return;
  flipped = true;
  document.getElementById('card-3d').classList.add('flipped');
  setTimeout(() => document.getElementById('rating-section').classList.remove('hidden'), 300);
});

document.querySelectorAll('.rate-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = parseInt(btn.dataset.q);
    const card = studyQueue[studyIdx];
    sessionStats.total++;
    if (q >= 3) sessionStats.correct++;
    // Find in categories and update
    Object.values(categories).forEach(cat => {
      const found = cat.cards.find(c=>c.id===card.id);
      if (found) Object.assign(found, sm2(found, q));
    });
    save();
    studyIdx++; flipped=false;
    showCard();
  });
});

document.getElementById('btn-quit-study').addEventListener('click', finishStudy);

function finishStudy() {
  document.getElementById('study-area').classList.add('hidden');
  document.getElementById('study-idle').classList.remove('hidden');
  const msg = sessionStats.total
    ? `完了！ 正解率: ${Math.round(sessionStats.correct/sessionStats.total*100)}%`
    : 'カテゴリを選んで学習を開始';
  document.getElementById('idle-msg').textContent = msg;
  updateHeaderStats();
}

// ── Card manager ──────────────────────────────────────
document.getElementById('btn-new-cat').addEventListener('click', () => {
  const name = prompt('カテゴリ名:');
  if (name?.trim()) {
    categories[name.trim()] = { cards: [] };
    save(); populateCategorySelects(); renderCardList();
  }
});

document.getElementById('btn-del-cat').addEventListener('click', () => {
  const cat = document.getElementById('manage-category').value;
  if (cat && confirm(`「${cat}」を削除しますか？`)) {
    delete categories[cat]; save(); populateCategorySelects(); renderCardList();
  }
});

document.getElementById('btn-add-card').addEventListener('click', () => {
  const front = document.getElementById('new-front').value.trim();
  const back  = document.getElementById('new-back').value.trim();
  const cat   = document.getElementById('manage-category').value;
  if (!front || !back || !cat) return;
  categories[cat].cards.push({ id:uuid(), front, back, reps:0, ef:2.5, interval:1, nextReview:today() });
  save(); renderCardList();
  document.getElementById('new-front').value = '';
  document.getElementById('new-back').value  = '';
});

document.getElementById('manage-category').addEventListener('change', renderCardList);

function renderCardList() {
  const cat = document.getElementById('manage-category').value;
  const list = document.getElementById('card-list');
  list.innerHTML = '';
  if (!cat || !categories[cat]) return;
  categories[cat].cards.forEach((card, i) => {
    const div = document.createElement('div');
    div.className = 'card-item';
    div.innerHTML = `
      <div class="card-item-text">
        <div class="card-front-text">${card.front.slice(0,40)}</div>
        <div class="card-back-text">${card.back.slice(0,40)}</div>
      </div>
      <button class="card-del" data-i="${i}">×</button>
    `;
    div.querySelector('.card-del').addEventListener('click', () => {
      categories[cat].cards.splice(i,1); save(); renderCardList();
    });
    list.appendChild(div);
  });
}

// ── Stats ─────────────────────────────────────────────
function renderStats() {
  const total   = Object.values(categories).reduce((s,c)=>s+c.cards.length,0);
  const mastered= Object.values(categories).reduce((s,c)=>s+c.cards.filter(x=>(x.interval||0)>=21).length,0);
  const t = today();
  const due = Object.values(categories).reduce((s,c)=>s+c.cards.filter(x=>!x.nextReview||x.nextReview<=t).length,0);
  document.getElementById('stats-summary').innerHTML = [
    ['総カード',total,'#a78bfa'],['習得済み',mastered,'#4ade80'],['要復習',due,'#f87171']
  ].map(([l,v,c])=>`<div class="ss-item"><div class="ss-val" style="color:${c}">${v}</div><div class="ss-lbl">${l}</div></div>`).join('');

  // Weekly study chart
  const canvas = document.getElementById('stats-chart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,360,120);
  ctx.fillStyle='#1e1e2e'; ctx.fillRect(0,0,360,120);
  const days=[]; for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().split('T')[0]);}
  const studiedCounts = days.map(d=>Object.values(categories).reduce((s,c)=>s+c.cards.filter(x=>x.lastStudied===d).length,0));
  const maxV = Math.max(...studiedCounts,1);
  days.forEach((d,i)=>{
    const bh=(studiedCounts[i]/maxV)*90;
    const bx=i*51+4; const by=110-bh;
    ctx.fillStyle=i===6?'#a78bfa':'#312e81';
    ctx.beginPath(); ctx.roundRect(bx,by,43,bh,4); ctx.fill();
    ctx.fillStyle='#374151'; ctx.font='9px sans-serif'; ctx.textAlign='center';
    ctx.fillText(['日','月','火','水','木','金','土'][new Date(d+'T00:00:00').getDay()],bx+21,118);
  });

  // Category stats
  const catStats = document.getElementById('cat-stats');
  catStats.innerHTML='';
  Object.entries(categories).forEach(([name,cat])=>{
    const total2=cat.cards.length||1;
    const learned=cat.cards.filter(c=>(c.reps||0)>0).length;
    const pct=Math.round(learned/total2*100);
    const div=document.createElement('div'); div.className='cs-row';
    div.innerHTML=`<div class="cs-name">${name}</div>
      <div class="cs-bar-wrap"><div class="cs-bar" style="width:${pct}%"></div></div>
      <div class="cs-info">${learned}/${total2}枚 (${pct}%習得)</div>`;
    catStats.appendChild(div);
  });
}

// ── Init ─────────────────────────────────────────────
const SAMPLE_CATS = {
  '英単語': { cards: [
    {id:uuid(),front:'serendipity',back:'偶然の幸運な発見',reps:0,ef:2.5,interval:1,nextReview:today()},
    {id:uuid(),front:'ephemeral',back:'はかない、一時的な',reps:0,ef:2.5,interval:1,nextReview:today()},
    {id:uuid(),front:'ubiquitous',back:'どこにでもある',reps:0,ef:2.5,interval:1,nextReview:today()},
  ]},
  '数学': { cards: [
    {id:uuid(),front:'π (パイ)',back:'≈ 3.14159...',reps:0,ef:2.5,interval:1,nextReview:today()},
    {id:uuid(),front:'e (ネイピア数)',back:'≈ 2.71828...',reps:0,ef:2.5,interval:1,nextReview:today()},
  ]},
};

chrome.storage.local.get(['fcCategories'], d => {
  categories = d.fcCategories || SAMPLE_CATS;
  if (!d.fcCategories) save();
  populateCategorySelects();
  renderCardList();
});
