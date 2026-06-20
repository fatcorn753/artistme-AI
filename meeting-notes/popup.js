let agendaItems   = [];
let decisionItems = [];
let actionItems   = [];
let meetingHistory = [];
let timerRunning  = false;
let timerStart    = null;
let timerOffset   = 0;
let timerInterval = null;

function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function today() { return new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit'}); }
function save()  {
  chrome.storage.local.set({
    meetingTitle: document.getElementById('meeting-title').value,
    agendaItems, decisionItems, actionItems,
    notes: document.getElementById('notes-area').value,
    timerOffset, timerRunning,
  });
}

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    if (tab.dataset.tab === 'history') renderHistory();
  });
});

// ── Timer ─────────────────────────────────────────────
const timerBtn  = document.getElementById('btn-timer');
const timerDisp = document.getElementById('timer-time');

function fmtTimer(ms) {
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60);
  if (h > 0) return `${h}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function tickTimer() {
  if (!timerRunning) return;
  const elapsed = timerOffset + (Date.now() - timerStart);
  timerDisp.textContent = fmtTimer(elapsed);
}

timerBtn.addEventListener('click', () => {
  if (!timerRunning) {
    timerRunning = true; timerStart = Date.now();
    timerBtn.textContent = '⏸'; timerBtn.classList.add('running');
    timerInterval = setInterval(tickTimer, 500);
  } else {
    timerOffset += Date.now() - timerStart;
    timerRunning = false;
    timerBtn.textContent = '▶'; timerBtn.classList.remove('running');
    clearInterval(timerInterval);
  }
  save();
});

document.getElementById('btn-set-alarm').addEventListener('click', () => {
  const mins = parseInt(document.getElementById('duration-input').value);
  const title = document.getElementById('meeting-title').value || '会議';
  chrome.alarms.clear('meeting-end-' + encodeURIComponent(title));
  chrome.alarms.create('meeting-end-' + encodeURIComponent(title), { delayInMinutes: mins });
  document.getElementById('btn-set-alarm').textContent = '✅';
  setTimeout(() => document.getElementById('btn-set-alarm').textContent = '🔔', 2000);
});

// ── Agenda ────────────────────────────────────────────
function renderAgenda() {
  const list = document.getElementById('agenda-list');
  list.innerHTML = '';
  if (!agendaItems.length) { list.innerHTML = '<div class="empty">議題を追加してください</div>'; return; }
  agendaItems.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'item-row' + (item.done ? ' done' : '');
    row.innerHTML = `
      <div class="item-check">${item.done ? '✓' : ''}</div>
      <span class="item-text">${item.text}</span>
      <span class="item-time">${item.time}分</span>
      <button class="item-del" data-i="${i}">×</button>
    `;
    row.querySelector('.item-check').addEventListener('click', () => { agendaItems[i].done = !item.done; save(); renderAgenda(); });
    row.querySelector('.item-del').addEventListener('click', () => { agendaItems.splice(i,1); save(); renderAgenda(); });
    list.appendChild(row);
  });
}

document.getElementById('btn-add-agenda').addEventListener('click', () => {
  const text = document.getElementById('agenda-input').value.trim();
  const time = parseInt(document.getElementById('agenda-time').value) || 10;
  if (!text) return;
  agendaItems.push({ id:uuid(), text, time, done: false });
  document.getElementById('agenda-input').value = '';
  save(); renderAgenda();
});
document.getElementById('agenda-input').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('btn-add-agenda').click(); });

// ── Decisions ─────────────────────────────────────────
function renderDecisions() {
  const list = document.getElementById('decision-list');
  list.innerHTML = '';
  if (!decisionItems.length) { list.innerHTML = '<div class="empty">決定事項を追加してください</div>'; return; }
  decisionItems.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<span class="item-text">✅ ${item.text}</span><button class="item-del" data-i="${i}">×</button>`;
    row.querySelector('.item-del').addEventListener('click', () => { decisionItems.splice(i,1); save(); renderDecisions(); });
    list.appendChild(row);
  });
}

document.getElementById('btn-add-decision').addEventListener('click', () => {
  const text = document.getElementById('decision-input').value.trim();
  if (!text) return;
  decisionItems.push({ id:uuid(), text });
  document.getElementById('decision-input').value = '';
  save(); renderDecisions();
});
document.getElementById('decision-input').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('btn-add-decision').click(); });

// ── Actions ───────────────────────────────────────────
function renderActions() {
  const list = document.getElementById('action-list');
  list.innerHTML = '';
  if (!actionItems.length) { list.innerHTML = '<div class="empty">アクションアイテムを追加してください</div>'; return; }
  actionItems.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'item-row' + (item.done ? ' done' : '');
    row.innerHTML = `
      <div class="item-check">${item.done ? '✓' : ''}</div>
      <span class="item-text">${item.text}</span>
      <span class="item-meta">${item.owner ? '👤'+item.owner : ''} ${item.due ? '📅'+item.due : ''}</span>
      <button class="item-del" data-i="${i}">×</button>
    `;
    row.querySelector('.item-check').addEventListener('click', () => { actionItems[i].done = !item.done; save(); renderActions(); });
    row.querySelector('.item-del').addEventListener('click', () => { actionItems.splice(i,1); save(); renderActions(); });
    list.appendChild(row);
  });
}

document.getElementById('btn-add-action').addEventListener('click', () => {
  const text  = document.getElementById('action-input').value.trim();
  const owner = document.getElementById('action-owner').value.trim();
  const due   = document.getElementById('action-due').value;
  if (!text) return;
  actionItems.push({ id:uuid(), text, owner, due, done: false });
  document.getElementById('action-input').value = '';
  document.getElementById('action-owner').value = '';
  save(); renderActions();
});

// ── Notes toolbar ─────────────────────────────────────
const notesEl = document.getElementById('notes-area');
document.querySelectorAll('.fmt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const fmt = btn.dataset.fmt;
    const start = notesEl.selectionStart, end = notesEl.selectionEnd;
    const sel = notesEl.value.slice(start, end);
    const inserts = {
      bold:    `**${sel||'テキスト'}**`,
      italic:  `*${sel||'テキスト'}*`,
      bullet:  `\n- ${sel||'アイテム'}`,
      heading: `\n## ${sel||'見出し'}`,
      hr:      '\n---\n',
    };
    const insert = inserts[fmt] || sel;
    notesEl.focus();
    document.execCommand('insertText', false, insert);
    updateWordCount();
  });
});

notesEl.addEventListener('input', updateWordCount);
function updateWordCount() {
  const text = notesEl.value;
  const words = text.split(/\s+/).filter(Boolean).length;
  document.getElementById('note-wordcount').textContent = `${words}語 / ${text.length}文字`;
  save();
}

// ── History ───────────────────────────────────────────
function saveMeeting() {
  const title = document.getElementById('meeting-title').value.trim();
  if (!title) return;
  const elapsed = timerOffset + (timerRunning ? Date.now() - timerStart : 0);
  const meeting = {
    id: uuid(),
    title,
    date: today(),
    durationMs: elapsed,
    agendaItems: [...agendaItems],
    decisionItems: [...decisionItems],
    actionItems: [...actionItems],
    notes: notesEl.value,
    savedAt: Date.now(),
  };
  meetingHistory.unshift(meeting);
  if (meetingHistory.length > 30) meetingHistory.pop();
  chrome.storage.local.set({ meetingHistory });
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (!meetingHistory.length) { list.innerHTML = '<div class="empty">会議履歴がありません</div>'; return; }
  meetingHistory.forEach(m => {
    const div = document.createElement('div');
    div.className = 'hist-item';
    const dur = m.durationMs ? fmtTimer(m.durationMs) : '—';
    div.innerHTML = `
      <div class="hist-title">${m.title}</div>
      <div class="hist-meta">${m.date} · ${dur} · 決定${m.decisionItems?.length||0}件 · アクション${m.actionItems?.length||0}件</div>
    `;
    div.addEventListener('click', () => loadMeeting(m));
    list.appendChild(div);
  });
}

function loadMeeting(m) {
  document.getElementById('meeting-title').value = m.title;
  agendaItems   = m.agendaItems   || [];
  decisionItems = m.decisionItems || [];
  actionItems   = m.actionItems   || [];
  notesEl.value = m.notes || '';
  timerOffset   = m.durationMs || 0;
  timerDisp.textContent = fmtTimer(timerOffset);
  renderAgenda(); renderDecisions(); renderActions();
  document.querySelectorAll('.tab')[0].click();
}

// ── Export ────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
  const title = document.getElementById('meeting-title').value || '会議メモ';
  const elapsed = timerOffset + (timerRunning ? Date.now() - timerStart : 0);
  const md = `# ${title}\n日時: ${today()} | 時間: ${fmtTimer(elapsed)}\n\n` +
    `## 議題\n${agendaItems.map(i=>`- [${i.done?'x':' '}] ${i.text} (${i.time}分)`).join('\n')}\n\n` +
    `## メモ\n${notesEl.value}\n\n` +
    `## 決定事項\n${decisionItems.map(i=>`- ✅ ${i.text}`).join('\n')}\n\n` +
    `## アクションアイテム\n${actionItems.map(i=>`- [${i.done?'x':' '}] ${i.text}${i.owner?' (@'+i.owner+')':''}${i.due?' 期限:'+i.due:''}`).join('\n')}`;

  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meeting-${title}-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
});

document.getElementById('btn-save-meeting').addEventListener('click', () => { saveMeeting(); });
document.getElementById('btn-new-meeting').addEventListener('click', () => {
  saveMeeting();
  document.getElementById('meeting-title').value = '';
  agendaItems=[]; decisionItems=[]; actionItems=[];
  notesEl.value=''; timerOffset=0; timerDisp.textContent='00:00';
  if (timerRunning) { clearInterval(timerInterval); timerRunning=false; timerBtn.textContent='▶'; timerBtn.classList.remove('running'); }
  renderAgenda(); renderDecisions(); renderActions(); updateWordCount();
});

document.getElementById('meeting-title').addEventListener('input', save);

// ── Init ─────────────────────────────────────────────
document.getElementById('meeting-date').textContent = today();

chrome.storage.local.get(['meetingTitle','agendaItems','decisionItems','actionItems','notes','timerOffset','meetingHistory'], d => {
  if (d.meetingTitle) document.getElementById('meeting-title').value = d.meetingTitle;
  agendaItems   = d.agendaItems   || [];
  decisionItems = d.decisionItems || [];
  actionItems   = d.actionItems   || [];
  notesEl.value = d.notes || '';
  timerOffset   = d.timerOffset   || 0;
  timerDisp.textContent = fmtTimer(timerOffset);
  meetingHistory = d.meetingHistory || [];
  renderAgenda(); renderDecisions(); renderActions(); updateWordCount();
});
