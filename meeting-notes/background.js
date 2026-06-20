// Meeting timer alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('meeting-end-')) {
    const title = alarm.name.replace('meeting-end-', '');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⏰ 会議終了時間です',
      message: `「${decodeURIComponent(title)}」の予定時間が終了しました。`,
    });
    chrome.storage.local.set({ meetingTimerRunning: false });
  }
});
