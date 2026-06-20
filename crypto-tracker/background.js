// Background: periodic price fetch + alert checking
chrome.alarms.create('refresh-prices', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'refresh-prices') return;
  chrome.storage.local.get(['watchlist', 'alerts'], async (data) => {
    const ids = (data.watchlist || []).map(c => c.id).join(',');
    if (!ids) return;
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=jpy,usd&include_24hr_change=true&include_market_cap=true`
      );
      const prices = await res.json();
      chrome.storage.local.set({ prices, lastUpdate: Date.now() });

      // Check alerts
      const alerts = data.alerts || [];
      alerts.forEach(alert => {
        const priceData = prices[alert.coinId];
        if (!priceData) return;
        const current = priceData[alert.currency];
        const triggered = alert.direction === 'above' ? current >= alert.target : current <= alert.target;
        if (triggered && !alert.triggered) {
          alert.triggered = true;
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: `💰 価格アラート: ${alert.coinName}`,
            message: `${alert.coinName} が ${alert.target.toLocaleString()} ${alert.currency.toUpperCase()} を${alert.direction === 'above' ? '上回り' : '下回り'}ました。\n現在: ${current.toLocaleString()}`,
          });
        }
        if (!triggered) alert.triggered = false;
      });
      chrome.storage.local.set({ alerts });
    } catch {}
  });
});
