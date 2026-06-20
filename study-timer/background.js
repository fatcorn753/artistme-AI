chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'study-end') {
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icons/icon128.png',
      title: '📚 学習タイマー終了！', message: '設定した学習時間が終了しました。お疲れ様でした！'
    });
    chrome.storage.local.set({ timerRunning: false });
  }
});
