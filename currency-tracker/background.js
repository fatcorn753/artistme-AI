// Fetch rates every hour and store history
chrome.alarms.create('fetch-rates', { periodInMinutes: 60 });

async function fetchAndStore() {
  try {
    const { trackedPairs = [{ from:'USD', to:'JPY' }] } = await chrome.storage.local.get('trackedPairs');
    const { rateHistory = {} } = await chrome.storage.local.get('rateHistory');
    const { rateAlerts = [] } = await chrome.storage.local.get('rateAlerts');

    const today = new Date().toISOString().split('T')[0];

    for (const pair of trackedPairs) {
      const res = await fetch(`https://api.frankfurter.app/latest?base=${pair.from}&symbols=${pair.to}`);
      const data = await res.json();
      const rate = data.rates[pair.to];
      if (!rate) continue;
      const key = `${pair.from}_${pair.to}`;
      if (!rateHistory[key]) rateHistory[key] = [];
      // Store daily rate (avoid duplicates)
      const existing = rateHistory[key].find(h => h.date === today);
      if (!existing) rateHistory[key].push({ date: today, rate });
      // Keep last 30 days
      if (rateHistory[key].length > 30) rateHistory[key].shift();

      // Check alerts
      rateAlerts.forEach(alert => {
        if (alert.from!==pair.from || alert.to!==pair.to || alert.triggered) return;
        const triggered = alert.dir==='above' ? rate >= alert.rate : rate <= alert.rate;
        if (triggered) {
          alert.triggered = true;
          chrome.notifications.create({
            type: 'basic', iconUrl: 'icons/icon128.png',
            title: `💹 レートアラート: ${pair.from}/${pair.to}`,
            message: `${pair.from}/${pair.to} が ${alert.rate} を${alert.dir==='above'?'上回り':'下回り'}ました。現在: ${rate.toFixed(4)}`,
          });
        }
      });
    }
    chrome.storage.local.set({ rateHistory, rateAlerts, lastFetch: Date.now() });
  } catch {}
}

chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name==='fetch-rates') fetchAndStore(); });
fetchAndStore();
