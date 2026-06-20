chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'countdown-done') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'タイマー終了！',
      message: 'カウントダウンタイマーが終了しました。'
    });
    chrome.storage.local.set({ timerRunning: false, timerEndTime: null });
    chrome.action.setBadgeText({ text: '' });
  }
});

// Update badge every second for countdown
setInterval(async () => {
  const data = await chrome.storage.local.get(['timerRunning','timerEndTime','swRunning','swStart','swOffset']);
  if (data.timerRunning && data.timerEndTime) {
    const rem = Math.max(0, Math.ceil((data.timerEndTime - Date.now()) / 1000));
    const m = Math.floor(rem / 60), s = rem % 60;
    chrome.action.setBadgeText({ text: rem > 0 ? `${m}:${String(s).padStart(2,'0')}` : 'Done' });
    chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
  } else if (data.swRunning && data.swStart != null) {
    const elapsed = (data.swOffset || 0) + (Date.now() - data.swStart);
    const m = Math.floor(elapsed / 60000), s = Math.floor((elapsed % 60000) / 1000);
    chrome.action.setBadgeText({ text: `${m}:${String(s).padStart(2,'0')}` });
    chrome.action.setBadgeBackgroundColor({ color: '#0369a1' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}, 1000);
