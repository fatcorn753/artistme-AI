// ── Mode tabs ──────────────────────────────────────────
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('mode-' + tab.dataset.mode).classList.remove('hidden');
  });
});

// ── Helpers ────────────────────────────────────────────
function fmt(ms, centiseconds = true) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  if (centiseconds) return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Stopwatch ──────────────────────────────────────────
const swDisplay = document.getElementById('sw-display');
const swStart   = document.getElementById('sw-start');
const swReset   = document.getElementById('sw-reset');
const swLap     = document.getElementById('sw-lap');
const lapsList  = document.getElementById('laps-list');

let swRunning = false, swOffset = 0, swStartTime = null, swInterval = null;
let laps = [], lastLapTime = 0;

function swTick() {
  const elapsed = swOffset + (Date.now() - swStartTime);
  swDisplay.textContent = fmt(elapsed);
}

function updateSwButtons() {
  swStart.textContent = swRunning ? '一時停止' : 'スタート';
  swStart.classList.toggle('running', swRunning);
  swLap.disabled = !swRunning;
}

swStart.addEventListener('click', () => {
  if (!swRunning) {
    swStartTime = Date.now();
    swRunning = true;
    swInterval = setInterval(swTick, 10);
    chrome.storage.local.set({ swRunning: true, swStart: swStartTime, swOffset });
  } else {
    swOffset += Date.now() - swStartTime;
    swRunning = false;
    clearInterval(swInterval);
    chrome.storage.local.set({ swRunning: false, swStart: null, swOffset });
  }
  updateSwButtons();
});

swReset.addEventListener('click', () => {
  clearInterval(swInterval);
  swRunning = false; swOffset = 0; swStartTime = null;
  laps = []; lastLapTime = 0;
  swDisplay.textContent = '00:00.00';
  lapsList.innerHTML = '';
  updateSwButtons();
  chrome.storage.local.set({ swRunning: false, swStart: null, swOffset: 0 });
});

swLap.addEventListener('click', () => {
  const elapsed = swOffset + (Date.now() - swStartTime);
  const delta = elapsed - lastLapTime;
  lastLapTime = elapsed;
  laps.unshift({ n: laps.length + 1, time: elapsed, delta });

  const lapTimes = laps.map(l => l.delta);
  const best = Math.min(...lapTimes);
  const worst = Math.max(...lapTimes);

  lapsList.innerHTML = '';
  laps.forEach(lap => {
    const row = document.createElement('div');
    row.className = 'lap-row';
    if (lap.delta === best && laps.length > 1) row.classList.add('best');
    if (lap.delta === worst && laps.length > 1) row.classList.add('worst');
    row.innerHTML = `
      <span class="lap-num">Lap ${laps.length - laps.indexOf(lap)}</span>
      <span class="lap-delta">${fmt(lap.delta)}</span>
      <span class="lap-time">${fmt(lap.time)}</span>
    `;
    lapsList.appendChild(row);
  });
});

// Restore SW state
chrome.storage.local.get(['swRunning','swStart','swOffset'], data => {
  swOffset = data.swOffset || 0;
  if (data.swRunning && data.swStart) {
    swStartTime = data.swStart;
    swRunning = true;
    swInterval = setInterval(swTick, 10);
  } else {
    swDisplay.textContent = fmt(swOffset);
  }
  updateSwButtons();
});

// ── Countdown Timer ────────────────────────────────────
const tmDisplay  = document.getElementById('tm-display');
const tmStart    = document.getElementById('tm-start');
const tmReset    = document.getElementById('tm-reset');
const ringFill   = document.getElementById('ring-fill');
const CIRCUMF    = 2 * Math.PI * 50;

let tmRunning = false, tmEndTime = null, tmTotal = 0, tmInterval = null;

function getInputSeconds() {
  const h = parseInt(document.getElementById('tm-hours').value) || 0;
  const m = parseInt(document.getElementById('tm-minutes').value) || 0;
  const s = parseInt(document.getElementById('tm-seconds').value) || 0;
  return h * 3600 + m * 60 + s;
}

function updateRing(remaining, total) {
  const pct = total > 0 ? remaining / total : 1;
  const offset = CIRCUMF * (1 - pct);
  ringFill.style.strokeDasharray = CIRCUMF;
  ringFill.style.strokeDashoffset = offset;
  ringFill.classList.toggle('done', remaining <= 0);
}

function tmTick() {
  const rem = Math.max(0, tmEndTime - Date.now());
  tmDisplay.textContent = fmt(rem, false);
  updateRing(rem, tmTotal * 1000);
  if (rem <= 0) {
    clearInterval(tmInterval);
    tmRunning = false;
    updateTmButtons();
  }
}

function updateTmButtons() {
  tmStart.textContent = tmRunning ? '一時停止' : 'スタート';
  tmStart.classList.toggle('running', tmRunning);
  const inputArea = document.getElementById('tm-set');
  inputArea.style.opacity = tmRunning ? '0.5' : '1';
  inputArea.style.pointerEvents = tmRunning ? 'none' : '';
}

tmStart.addEventListener('click', () => {
  if (!tmRunning) {
    const total = getInputSeconds();
    if (total <= 0) return;
    if (!tmEndTime) { tmTotal = total; tmEndTime = Date.now() + total * 1000; }
    tmRunning = true;
    tmInterval = setInterval(tmTick, 200);
    chrome.alarms.create('countdown-done', { when: tmEndTime });
    chrome.storage.local.set({ timerRunning: true, timerEndTime: tmEndTime });
  } else {
    const rem = tmEndTime - Date.now();
    clearInterval(tmInterval);
    chrome.alarms.clear('countdown-done');
    tmEndTime = null;
    tmRunning = false;
    chrome.storage.local.set({ timerRunning: false, timerEndTime: null });
    // Store remaining for resume
    const h = Math.floor(rem / 3600000);
    const m = Math.floor((rem % 3600000) / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    document.getElementById('tm-hours').value = h;
    document.getElementById('tm-minutes').value = m;
    document.getElementById('tm-seconds').value = s;
    tmDisplay.textContent = fmt(rem, false);
  }
  updateTmButtons();
});

tmReset.addEventListener('click', () => {
  clearInterval(tmInterval);
  chrome.alarms.clear('countdown-done');
  tmRunning = false; tmEndTime = null; tmTotal = 0;
  tmDisplay.textContent = '00:00';
  updateRing(1, 1);
  updateTmButtons();
  chrome.storage.local.set({ timerRunning: false, timerEndTime: null });
});

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const sec = parseInt(btn.dataset.sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    document.getElementById('tm-hours').value = h;
    document.getElementById('tm-minutes').value = m;
    document.getElementById('tm-seconds').value = s;
    tmTotal = sec; tmEndTime = null;
    tmDisplay.textContent = fmt(sec * 1000, false);
    updateRing(1, 1);
  });
});

// Restore timer state
chrome.storage.local.get(['timerRunning','timerEndTime'], data => {
  if (data.timerRunning && data.timerEndTime && data.timerEndTime > Date.now()) {
    tmEndTime = data.timerEndTime;
    tmTotal = Math.ceil((data.timerEndTime - Date.now()) / 1000);
    tmRunning = true;
    tmInterval = setInterval(tmTick, 200);
    updateTmButtons();
    tmTick();
  }
});
