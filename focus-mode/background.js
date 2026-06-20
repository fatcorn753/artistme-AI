chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focus-end') {
    chrome.storage.local.set({ active: false, endsAt: null });
    chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ['block_rules']
    });
    chrome.action.setBadgeText({ text: '' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '集中モード終了！',
      message: 'お疲れ様でした！集中タイム終了です。'
    });
  }
  if (alarm.name === 'focus-tick') {
    chrome.storage.local.get(['active', 'endsAt'], (data) => {
      if (!data.active || !data.endsAt) return;
      const remaining = Math.max(0, Math.ceil((data.endsAt - Date.now()) / 60000));
      chrome.action.setBadgeText({ text: remaining > 0 ? `${remaining}m` : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'start') {
    const { minutes, blockedDomains } = msg;
    const endsAt = Date.now() + minutes * 60 * 1000;

    // Build dynamic rules
    const rules = blockedDomains.map((domain, i) => ({
      id: i + 1,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
      condition: { urlFilter: `||${domain}`, resourceTypes: ['main_frame'] }
    }));

    chrome.storage.local.set({ active: true, endsAt, blockedDomains }, () => {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map(r => r.id),
        addRules: rules
      });
      chrome.alarms.create('focus-end', { delayInMinutes: minutes });
      chrome.alarms.create('focus-tick', { periodInMinutes: 1 });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === 'stop') {
    chrome.alarms.clearAll();
    chrome.storage.local.set({ active: false, endsAt: null });
    chrome.storage.local.get(['blockedDomains'], (data) => {
      const domains = data.blockedDomains || [];
      const ids = domains.map((_, i) => i + 1);
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
    });
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return true;
  }
});
