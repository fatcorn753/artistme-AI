// Periodic price check for tracked items
chrome.alarms.create('price-check', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'price-check') return;
  const { trackedItems = [] } = await chrome.storage.local.get('trackedItems');

  for (const item of trackedItems) {
    try {
      // Fetch the page
      const res = await fetch(item.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      const html = await res.text();
      const price = extractPrice(html, item.url);
      if (!price) continue;

      const today = new Date().toISOString().split('T')[0];
      item.history = item.history || [];
      item.history.push({ date: today, price });
      if (item.history.length > 30) item.history.shift();
      item.currentPrice = price;
      item.lastChecked = Date.now();

      // Check alert
      if (item.alertPrice && price <= item.alertPrice) {
        chrome.notifications.create({
          type: 'basic', iconUrl: 'icons/icon128.png',
          title: '💰 値下がりアラート！',
          message: `${item.title}\n${price.toLocaleString()}円 (目標: ${item.alertPrice.toLocaleString()}円以下)`,
          buttons: [{ title: 'ページを開く' }],
        });
      }
    } catch {}
  }
  chrome.storage.local.set({ trackedItems });
});

function extractPrice(html, url) {
  // Amazon
  let m = html.match(/class="a-price-whole">([0-9,]+)/);
  if (m) return parseInt(m[1].replace(/,/g, ''));

  // Generic price patterns
  const patterns = [
    /"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
    /class="[^"]*price[^"]*"[^>]*>(?:[^<]*<[^>]+>)*([0-9,，]+)/,
    /itemprop="price"[^>]*content="([0-9.]+)"/,
    /<meta[^>]+property="product:price:amount"[^>]+content="([0-9.]+)"/,
    /¥([0-9,]+)/,
    /([0-9,]+)円/,
  ];

  for (const pat of patterns) {
    const match = html.match(pat);
    if (match) {
      const num = parseFloat(match[1].replace(/[,，]/g, ''));
      if (num > 0 && num < 10000000) return num;
    }
  }
  return null;
}

// Open URL on notification click
chrome.notifications.onButtonClicked.addListener(async (notifId) => {
  const { trackedItems = [] } = await chrome.storage.local.get('trackedItems');
  const item = trackedItems.find(i => notifId.includes(i.id));
  if (item) chrome.tabs.create({ url: item.url });
});
