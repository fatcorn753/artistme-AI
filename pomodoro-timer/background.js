const WORK_MINUTES = 25;
const SHORT_BREAK = 5;
const LONG_BREAK = 15;
const POMODOROS_BEFORE_LONG = 4;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    status: 'idle',
    mode: 'work',
    secondsLeft: WORK_MINUTES * 60,
    pomodoroCount: 0,
    startTime: null,
    totalSeconds: WORK_MINUTES * 60
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoro-tick') {
    chrome.storage.local.get(['secondsLeft', 'mode', 'pomodoroCount', 'status'], (data) => {
      if (data.status !== 'running') return;

      const newSeconds = data.secondsLeft - 1;
      if (newSeconds <= 0) {
        chrome.alarms.clear('pomodoro-tick');

        let nextMode, nextSeconds, pomodoroCount, title, message;
        if (data.mode === 'work') {
          pomodoroCount = data.pomodoroCount + 1;
          if (pomodoroCount % POMODOROS_BEFORE_LONG === 0) {
            nextMode = 'longBreak';
            nextSeconds = LONG_BREAK * 60;
            title = '長い休憩タイム！';
            message = `${pomodoroCount}個のポモドーロ完了！${LONG_BREAK}分間しっかり休もう。`;
          } else {
            nextMode = 'shortBreak';
            nextSeconds = SHORT_BREAK * 60;
            title = '休憩タイム！';
            message = `ポモドーロ${pomodoroCount}完了！${SHORT_BREAK}分間休憩しよう。`;
          }
        } else {
          pomodoroCount = data.pomodoroCount;
          nextMode = 'work';
          nextSeconds = WORK_MINUTES * 60;
          title = '集中タイム開始！';
          message = `休憩終了。${WORK_MINUTES}分間集中しよう！`;
        }

        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title,
          message
        });

        chrome.storage.local.set({
          status: 'idle',
          mode: nextMode,
          secondsLeft: nextSeconds,
          totalSeconds: nextSeconds,
          pomodoroCount
        });
      } else {
        chrome.storage.local.set({ secondsLeft: newSeconds });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'start') {
    chrome.storage.local.get(['secondsLeft', 'mode'], (data) => {
      chrome.storage.local.set({ status: 'running' });
      chrome.alarms.create('pomodoro-tick', { periodInMinutes: 1 / 60 });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === 'pause') {
    chrome.alarms.clear('pomodoro-tick');
    chrome.storage.local.set({ status: 'paused' });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'reset') {
    chrome.alarms.clear('pomodoro-tick');
    chrome.storage.local.get(['mode'], (data) => {
      const seconds = data.mode === 'work' ? WORK_MINUTES * 60
        : data.mode === 'shortBreak' ? SHORT_BREAK * 60
        : LONG_BREAK * 60;
      chrome.storage.local.set({
        status: 'idle',
        secondsLeft: seconds,
        totalSeconds: seconds
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === 'skip') {
    chrome.alarms.clear('pomodoro-tick');
    chrome.storage.local.get(['mode', 'pomodoroCount'], (data) => {
      let nextMode, nextSeconds;
      if (data.mode === 'work') {
        const count = data.pomodoroCount + 1;
        if (count % POMODOROS_BEFORE_LONG === 0) {
          nextMode = 'longBreak';
          nextSeconds = LONG_BREAK * 60;
        } else {
          nextMode = 'shortBreak';
          nextSeconds = SHORT_BREAK * 60;
        }
        chrome.storage.local.set({
          status: 'idle',
          mode: nextMode,
          secondsLeft: nextSeconds,
          totalSeconds: nextSeconds,
          pomodoroCount: count
        });
      } else {
        nextMode = 'work';
        nextSeconds = WORK_MINUTES * 60;
        chrome.storage.local.set({
          status: 'idle',
          mode: nextMode,
          secondsLeft: nextSeconds,
          totalSeconds: nextSeconds
        });
      }
      sendResponse({ ok: true });
    });
    return true;
  }
});
