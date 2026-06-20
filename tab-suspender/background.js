// Track tab last-active times
const tabActivity = {};  // tabId -> timestamp

chrome.tabs.onActivated.addListener(({ tabId }) => {
  tabActivity[tabId] = Date.now();
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'complete') tabActivity[tabId] = Date.now();
});
chrome.tabs.onRemoved.addListener(tabId => delete tabActivity[tabId]);

// Periodic check
chrome.alarms.create('suspend-check', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'suspend-check') return;
  const { suspendAfter = 30, enabled = true, whitelist = [] } = await chrome.storage.local.get(['suspendAfter','enabled','whitelist']);
  if (!enabled) return;

  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  const threshold = suspendAfter * 60 * 1000;

  for (const tab of tabs) {
    if (tab.active || tab.pinned || tab.audible) continue;
    if (tab.url?.startsWith('chrome')) continue;
    if (tab.discarded) continue;
    // Check whitelist
    try {
      const host = new URL(tab.url || '').hostname;
      if (whitelist.some(w => host.includes(w))) continue;
    } catch {}

    const lastActive = tabActivity[tab.id] || tab.lastAccessed || 0;
    if (now - lastActive > threshold) {
      chrome.tabs.discard(tab.id);
    }
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.action === 'getTabActivity') sendResponse(tabActivity);
  if (msg.action === 'suspendTab') chrome.tabs.discard(msg.tabId);
  if (msg.action === 'wakeTab') chrome.tabs.reload(msg.tabId);
  return true;
});
