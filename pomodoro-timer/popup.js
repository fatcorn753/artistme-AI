const CIRCUMFERENCE = 2 * Math.PI * 54;

const display = document.getElementById('timer-display');
const ring = document.getElementById('ring-progress');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const btnSkip = document.getElementById('btn-skip');
const countEl = document.getElementById('pomodoro-count');

const tabs = {
  work: document.getElementById('tab-work'),
  shortBreak: document.getElementById('tab-shortBreak'),
  longBreak: document.getElementById('tab-longBreak')
};

let refreshInterval = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateRing(secondsLeft, totalSeconds, mode) {
  const progress = secondsLeft / totalSeconds;
  const offset = CIRCUMFERENCE * (1 - progress);
  ring.style.strokeDasharray = CIRCUMFERENCE;
  ring.style.strokeDashoffset = offset;
  ring.classList.toggle('break', mode !== 'work');
}

function updateUI(data) {
  display.textContent = formatTime(data.secondsLeft);
  updateRing(data.secondsLeft, data.totalSeconds, data.mode);
  countEl.textContent = data.pomodoroCount || 0;

  Object.entries(tabs).forEach(([key, el]) => {
    el.classList.toggle('active', key === data.mode);
  });

  if (data.status === 'running') {
    btnStart.textContent = '一時停止';
    btnStart.classList.add('running');
  } else {
    btnStart.textContent = 'スタート';
    btnStart.classList.remove('running');
  }
}

function startPolling() {
  if (refreshInterval) return;
  refreshInterval = setInterval(() => {
    chrome.storage.local.get(null, updateUI);
  }, 500);
}

chrome.storage.local.get(null, updateUI);
startPolling();

chrome.storage.onChanged.addListener(() => {
  chrome.storage.local.get(null, updateUI);
});

btnStart.addEventListener('click', () => {
  chrome.storage.local.get(['status'], (data) => {
    const action = data.status === 'running' ? 'pause' : 'start';
    chrome.runtime.sendMessage({ action });
  });
});

btnReset.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'reset' });
});

btnSkip.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'skip' });
});

Object.entries(tabs).forEach(([mode, el]) => {
  el.addEventListener('click', () => {
    chrome.alarms.clear('pomodoro-tick');
    const minutes = mode === 'work' ? 25 : mode === 'shortBreak' ? 5 : 15;
    chrome.storage.local.set({
      status: 'idle',
      mode,
      secondsLeft: minutes * 60,
      totalSeconds: minutes * 60
    });
  });
});
