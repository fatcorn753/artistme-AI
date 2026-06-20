// Daily word notification
chrome.alarms.create('daily-word', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'daily-word') return;
  const { words = [] } = await chrome.storage.local.get('words');
  if (!words.length) return;
  const today = new Date().toISOString().split('T')[0];
  const due = words.filter(w => (!w.nextReview || w.nextReview <= today) && !w.mastered);
  if (!due.length) return;
  const word = due[Math.floor(Math.random() * due.length)];
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `📚 今日の単語: ${word.word}`,
    message: word.definition?.slice(0, 120) || word.meaning || '定義を確認しましょう',
  });
});
