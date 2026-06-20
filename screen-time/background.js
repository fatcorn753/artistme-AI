let activeTabId = null;
let activeHost  = null;
let activeStart = null;
let trackingData = {};  // { date: { host: seconds } }

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function getHost(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch { return null; }
}

async function loadData() {
  const d = await chrome.storage.local.get(['trackingData']);
  trackingData = d.trackingData || {};
}

async function saveData() {
  await chrome.storage.local.set({ trackingData });
}

function flush() {
  if (!activeHost || !activeStart) return;
  const elapsed = Math.floor((Date.now() - activeStart) / 1000);
  if (elapsed <= 0) return;
  const today = todayKey();
  if (!trackingData[today]) trackingData[today] = {};
  trackingData[today][activeHost] = (trackingData[today][activeHost] || 0) + elapsed;
  activeStart = Date.now();
  saveData();
  checkLimits(activeHost, today);
}

async function checkLimits(host, today) {
  const { limits = {} } = await chrome.storage.local.get('limits');
  const limit = limits[host];
  if (!limit) return;
  const spent = trackingData[today]?.[host] || 0;
  const limitSecs = limit * 60;
  const pcts = [0.8, 1.0];
  const { alerted = {} } = await chrome.storage.local.get('alerted');
  const alertKey = `${today}_${host}`;
  for (const pct of pcts) {
    if (spent >= limitSecs * pct && !alerted[`${alertKey}_${pct}`]) {
      alerted[`${alertKey}_${pct}`] = true;
      chrome.storage.local.set({ alerted });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⏱ スクリーンタイム通知',
        message: `${host} の使用時間が制限の${Math.round(pct*100)}%に達しました（${Math.round(spent/60)}分/${limit}分）`,
      });
    }
  }
}

function switchTo(tabId, url) {
  flush();
  activeTabId = tabId;
  activeHost  = url ? getHost(url) : null;
  activeStart = activeHost ? Date.now() : null;
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  switchTo(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (tabId === activeTabId && change.url) {
    switchTo(tabId, change.url);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    flush();
    activeStart = null;
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) switchTo(tab.id, tab.url);
  }
});

// Periodic flush every 30 seconds
chrome.alarms.create('flush', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'flush') flush(); });

// Cleanup old data (keep 30 days)
chrome.alarms.create('cleanup', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'cleanup') return;
  await loadData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  Object.keys(trackingData).forEach(date => {
    if (new Date(date) < cutoff) delete trackingData[date];
  });
  saveData();
});

loadData();
