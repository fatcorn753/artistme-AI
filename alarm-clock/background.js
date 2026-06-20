chrome.alarms.onAlarm.addListener(async (alarm) => {
  const { alarms = [] } = await chrome.storage.local.get('alarms');
  const a = alarms.find(a => 'alarm_' + a.id === alarm.name);
  if (!a || !a.enabled) return;

  chrome.notifications.create('alarm_notif_' + a.id, {
    type: 'basic', iconUrl: 'icons/icon128.png',
    title: `⏰ アラーム: ${a.label || a.time}`,
    message: a.label ? `時刻: ${a.time}` : 'アラーム時刻になりました！',
    buttons: [{ title: 'スヌーズ (5分)' }, { title: '停止' }],
    requireInteraction: true,
  });

  // Reschedule for repeat
  if (a.repeat !== 'once') {
    const [h, m] = a.time.split(':').map(Number);
    const days = { daily: 1440, weekdays: null, weekends: null };
    if (a.repeat === 'daily') {
      chrome.alarms.create('alarm_' + a.id, { delayInMinutes: 1440 });
    }
  } else {
    // Disable one-shot alarm
    const idx = alarms.findIndex(x => x.id === a.id);
    if (idx >= 0) { alarms[idx].enabled = false; chrome.storage.local.set({ alarms }); }
  }
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
  if (btnIdx === 0) { // Snooze
    chrome.alarms.create('snooze_' + Date.now(), { delayInMinutes: 5 });
    chrome.alarms.onAlarm.addListener(function snoozeHandler(alarm) {
      if (!alarm.name.startsWith('snooze_')) return;
      chrome.notifications.create({ type:'basic', iconUrl:'icons/icon128.png', title:'⏰ スヌーズ終了', message:'スヌーズの5分が経過しました！' });
      chrome.alarms.onAlarm.removeListener(snoozeHandler);
    });
  }
  chrome.notifications.clear(notifId);
});
