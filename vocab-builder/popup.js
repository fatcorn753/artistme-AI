let words = [];
let studyQueue = [];
let studyIdx = 0;
let studyRevealed = false;
let studyMode = 'due';

// ── SM-2 SRS ──────────────────────────────────────────
function sm2(word, quality) {
  let ef = word.ef ?? 2.5;
  let interval = word.interval ?? 1;
  let reps = word.reps ?? 0;

  ef = Math.max(1.3, ef + 0.1 - (5-quality)*(0.08+(5-quality)*0.02));
  if (quality < 3) { reps = 0; interval = 1; }
  else if (reps === 0) { interval = 1; reps = 1; }
  else if (reps === 1) { interval = 6; reps = 2; }
  else { interval = Math.round(interval * ef); reps++; }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    ef, interval, reps,
    nextReview: nextDate.toISOString().split('T')[0],
    mastered: interval >= 21,
    lastStudied: new Date().toISOString().split('T')[0],
  };
}

function today() { return new Date().toISOString().split('T')[0]; }
function save()  { chrome.storage.local.set({ words }); }
function uuid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    const map = { words: renderWordList, stats: renderStats };
    if (map[tab.dataset.tab]) map[tab.dataset.tab]();
  });
});

// ── Study ─────────────────────────────────────────────
function initStudy(mode = 'due') {
  studyMode = mode;
  const t = today();
  studyQueue = mode === 'due'
    ? words.filter(w => !w.mastered && (!w.nextReview || w.nextReview <= t))
    : [...words].sort(() => Math.random() - 0.5).slice(0, 20);

  if (!studyQueue.length) {
    document.getElementById('due-count').textContent = '復習待ちの単語がありません 🎉';
    return;
  }
  studyIdx = 0;
  document.getElementById('study-ready').classList.add('hidden');
  document.getElementById('study-session').classList.remove('hidden');
  showCard();
}

function showCard() {
  if (studyIdx >= studyQueue.length) { finishStudy(); return; }
  const word = studyQueue[studyIdx];
  studyRevealed = false;

  document.getElementById('card-word').textContent = word.word;
  document.getElementById('card-pos').textContent = word.pos || '';
  document.getElementById('card-phonetic').textContent = word.phonetic || '';
  document.getElementById('card-def').textContent = word.definition || '';
  document.getElementById('card-example').textContent = word.example ? `"${word.example}"` : '';
  document.getElementById('card-meaning').textContent = word.meaning || '';
  document.getElementById('card-back').classList.add('hidden');
  document.getElementById('rating-btns').classList.add('hidden');
  document.getElementById('btn-reveal').style.display = '';

  const total = studyQueue.length;
  document.getElementById('prog-fill').style.width = (studyIdx / total * 100) + '%';
  document.getElementById('prog-label').textContent = `${studyIdx}/${total}`;
}

document.getElementById('btn-reveal').addEventListener('click', () => {
  studyRevealed = true;
  document.getElementById('card-back').classList.remove('hidden');
  document.getElementById('btn-reveal').style.display = 'none';
  document.getElementById('rating-btns').classList.remove('hidden');
});

document.querySelectorAll('.rate-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!studyRevealed) return;
    const q = parseInt(btn.dataset.q);
    const word = studyQueue[studyIdx];
    const idx  = words.findIndex(w => w.id === word.id);
    if (idx >= 0) Object.assign(words[idx], sm2(words[idx], q));
    save();
    studyIdx++;
    showCard();
  });
});

document.getElementById('btn-speak').addEventListener('click', () => {
  const word = studyQueue[studyIdx]?.word;
  if (word && chrome.tts) {
    chrome.tts.speak(word, { lang: 'en-US', rate: 0.9 });
  }
});

document.getElementById('btn-start-study').addEventListener('click', () => initStudy('due'));
document.getElementById('btn-study-all').addEventListener('click', () => initStudy('all'));
document.getElementById('btn-quit-study').addEventListener('click', finishStudy);

function finishStudy() {
  document.getElementById('study-session').classList.add('hidden');
  document.getElementById('study-ready').classList.remove('hidden');
  updateDueCount();
}

function updateDueCount() {
  const t = today();
  const due = words.filter(w => !w.mastered && (!w.nextReview || w.nextReview <= t)).length;
  document.getElementById('due-count').textContent = `${due}件の単語が復習待ち`;
  document.getElementById('header-stats').textContent = `総単語: ${words.length} | 習得: ${words.filter(w=>w.mastered).length}`;
}

// ── Word List ─────────────────────────────────────────
function renderWordList() {
  const q = document.getElementById('word-search').value.toLowerCase();
  const f = document.getElementById('word-filter').value;
  const t = today();

  const filtered = words.filter(w => {
    if (q && !w.word.toLowerCase().includes(q) && !(w.meaning||'').toLowerCase().includes(q)) return false;
    if (f === 'due')      return !w.mastered && (!w.nextReview || w.nextReview <= t);
    if (f === 'mastered') return w.mastered;
    if (f === 'new')      return !w.reps;
    return true;
  }).sort((a,b) => a.word.localeCompare(b.word));

  const list = document.getElementById('word-list');
  list.innerHTML = '';

  if (!filtered.length) { list.innerHTML = '<div class="empty">単語が見つかりません</div>'; return; }

  filtered.forEach(w => {
    const status = w.mastered ? 'mastered' : (w.reps > 0 ? 'learning' : 'new');
    const statusLabel = { mastered: '習得', learning: '学習中', new: '新規' }[status];
    const tags = (w.tags || []).map(t => `<span class="wi-tag">${t}</span>`).join('');
    const nextInfo = w.nextReview ? `次回: ${w.nextReview}` : '';

    const div = document.createElement('div');
    div.className = 'word-item' + (w.mastered ? ' mastered' : '');
    div.innerHTML = `
      <div class="word-item-top">
        <span class="wi-word">${w.word}</span>
        <span class="wi-status ${status}">${statusLabel}</span>
        <span class="wi-next">${nextInfo}</span>
        <button class="wi-del" data-id="${w.id}">×</button>
      </div>
      <div class="wi-meaning">${w.meaning || w.definition?.slice(0,60) || ''}</div>
      ${tags ? `<div class="wi-tags">${tags}</div>` : ''}
    `;
    div.querySelector('.wi-del').addEventListener('click', e => {
      e.stopPropagation();
      words = words.filter(wd => wd.id !== w.id);
      save(); renderWordList();
    });
    div.addEventListener('click', e => {
      if (e.target.classList.contains('wi-del')) return;
      // Expand to show full definition
      const existing = div.querySelector('.wi-detail');
      if (existing) { existing.remove(); return; }
      const detail = document.createElement('div');
      detail.className = 'wi-detail';
      detail.style.cssText = 'font-size:11px;color:#818cf8;margin-top:5px;line-height:1.5';
      detail.textContent = [w.phonetic, w.definition, w.example ? `"${w.example}"` : ''].filter(Boolean).join('\n');
      div.appendChild(detail);
    });
    list.appendChild(div);
  });
}

document.getElementById('word-search').addEventListener('input', renderWordList);
document.getElementById('word-filter').addEventListener('change', renderWordList);

// ── Add Word ──────────────────────────────────────────
document.getElementById('btn-add-word').addEventListener('click', addWord);

function addWord() {
  const word = document.getElementById('new-word').value.trim();
  if (!word) return;
  if (words.some(w => w.word.toLowerCase() === word.toLowerCase())) {
    alert('この単語は既に登録されています'); return;
  }
  const rawTags = document.getElementById('new-tags').value;
  const tags = rawTags.match(/#(\w+)/g)?.map(t => t.slice(1)) || [];
  words.unshift({
    id: uuid(), word, meaning: document.getElementById('new-meaning').value.trim(),
    definition: document.getElementById('new-def').value.trim(),
    example: document.getElementById('new-example').value.trim(),
    tags, pos: '', phonetic: '',
    reps: 0, ef: 2.5, interval: 1, mastered: false,
    nextReview: today(), addedAt: today(),
  });
  save(); updateDueCount();
  ['new-word','new-meaning','new-def','new-example','new-tags'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('new-word').focus();
}

// Auto-lookup from Free Dictionary API
document.getElementById('btn-lookup').addEventListener('click', async () => {
  const word = document.getElementById('new-word').value.trim();
  if (!word) return;
  const btn = document.getElementById('btn-lookup');
  btn.textContent = '⏳';
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      const entry = data[0];
      const phonetic = entry.phonetics?.find(p => p.text)?.text || '';
      const meaning  = entry.meanings?.[0];
      const def      = meaning?.definitions?.[0];
      document.getElementById('new-def').value     = def?.definition || '';
      document.getElementById('new-example').value = def?.example   || '';
      document.getElementById('new-meaning').placeholder = phonetic;
      // Store phonetic & pos for later
      document.getElementById('new-word').dataset.phonetic = phonetic;
      document.getElementById('new-word').dataset.pos = meaning?.partOfSpeech || '';
    }
  } catch {}
  btn.textContent = '🔍';
});

// Import
document.getElementById('btn-import').addEventListener('click', () => {
  const text = document.getElementById('import-text').value.trim();
  if (!text) return;
  let count = 0;
  text.split('\n').forEach(line => {
    const [word, ...rest] = line.split(',');
    const w = word?.trim();
    const m = rest.join(',').trim();
    if (!w || words.some(wd => wd.word.toLowerCase() === w.toLowerCase())) return;
    words.push({ id: uuid(), word: w, meaning: m, definition: '', example: '', tags: [],
      reps: 0, ef: 2.5, interval: 1, mastered: false, nextReview: today(), addedAt: today() });
    count++;
  });
  save(); updateDueCount();
  document.getElementById('import-text').value = '';
  alert(`${count}語をインポートしました`);
});

// ── Stats ─────────────────────────────────────────────
function renderStats() {
  const total    = words.length;
  const mastered = words.filter(w => w.mastered).length;
  const learning = words.filter(w => w.reps > 0 && !w.mastered).length;
  const newWords = words.filter(w => !w.reps).length;
  const t = today();
  const due = words.filter(w => !w.mastered && (!w.nextReview || w.nextReview <= t)).length;

  const grid = document.getElementById('stats-grid');
  grid.innerHTML = [
    ['総単語数', total, '#818cf8'],
    ['習得済み', mastered, '#4ade80'],
    ['学習中', learning, '#f59e0b'],
    ['復習待ち', due, '#f87171'],
  ].map(([lbl, val, color]) => `
    <div class="stat-card">
      <div class="sc-val" style="color:${color}">${val}</div>
      <div class="sc-lbl">${lbl}</div>
    </div>
  `).join('');

  // Study heatmap (last 30 days)
  const canvas = document.getElementById('heatmap-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const days = 30;
  const cellW = Math.floor((canvas.width - 10) / days);
  const cellH = 40;

  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().split('T')[0];
    const studied = words.filter(w => w.lastStudied === key).length;
    const alpha = studied > 0 ? Math.min(1, 0.2 + studied * 0.15) : 0.05;
    ctx.fillStyle = `rgba(129, 140, 248, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(5 + i * cellW, 10, cellW - 2, cellH, 3);
    ctx.fill();
  }

  // Streak
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (words.some(w => w.lastStudied === key)) streak++;
    else break;
  }
  document.getElementById('streak-info').textContent = `🔥 連続学習: ${streak}日`;
}

// ── Init ─────────────────────────────────────────────
const SAMPLE_WORDS = [
  { id: uuid(), word: 'serendipity', meaning: '偶然の幸運な発見', pos: 'noun',
    phonetic: '/ˌserənˈdɪpɪti/',
    definition: 'The occurrence of events by chance in a happy or beneficial way.',
    example: 'A happy accident or serendipity led him to the new discovery.',
    tags: ['advanced'], reps: 0, ef: 2.5, interval: 1, mastered: false, nextReview: today(), addedAt: today() },
  { id: uuid(), word: 'ephemeral', meaning: 'はかない、一時的な', pos: 'adjective',
    phonetic: '/ɪˈfemərəl/',
    definition: 'Lasting for a very short time.',
    example: 'The ephemeral beauty of cherry blossoms.',
    tags: ['literary'], reps: 1, ef: 2.5, interval: 3, mastered: false, nextReview: today(), addedAt: today() },
  { id: uuid(), word: 'ubiquitous', meaning: 'どこにでもある', pos: 'adjective',
    phonetic: '/juːˈbɪkwɪtəs/',
    definition: 'Present, appearing, or found everywhere.',
    example: 'The ubiquitous smartphone has changed how we communicate.',
    tags: ['TOEFL'], reps: 3, ef: 2.6, interval: 10, mastered: false, nextReview: today(), addedAt: today() },
];

chrome.storage.local.get(['words'], d => {
  words = d.words?.length ? d.words : SAMPLE_WORDS;
  if (!d.words?.length) save();
  updateDueCount();
});
