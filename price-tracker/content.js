// Content script: scrape price and product info from current page
function scrapePageInfo() {
  const info = {
    title: '',
    price: null,
    imageUrl: '',
    url: location.href,
  };

  // Title
  info.title = document.querySelector('h1')?.textContent?.trim() ||
               document.querySelector('[itemprop="name"]')?.textContent?.trim() ||
               document.title.split('|')[0].split('-')[0].trim();
  if (info.title.length > 80) info.title = info.title.slice(0, 80) + '…';

  // Image
  info.imageUrl = document.querySelector('[itemprop="image"]')?.src ||
                  document.querySelector('meta[property="og:image"]')?.content || '';

  // Price — try many selectors
  const priceSelectors = [
    // Amazon
    '.a-price-whole', '#priceblock_ourprice', '#priceblock_dealprice',
    '.a-price .a-offscreen',
    // Generic
    '[itemprop="price"]', '[data-price]', '.price', '.product-price',
    '.sale-price', '.current-price', '.selling-price',
    // Japan-specific
    '.productPrice', '.priceValue', '#price', '.item-price',
  ];

  for (const sel of priceSelectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const text = (el.textContent || el.getAttribute('content') || el.getAttribute('data-price') || '').trim();
    const match = text.match(/([0-9,，\.]+)/);
    if (match) {
      const num = parseFloat(match[1].replace(/[,，]/g, ''));
      if (num > 0 && num < 10000000) { info.price = num; break; }
    }
  }

  // Fallback: search page text for price patterns
  if (!info.price) {
    const bodyText = document.body.innerText;
    const patterns = [/¥\s*([0-9,，]+)/, /([0-9,，]+)\s*円/];
    for (const pat of patterns) {
      const match = bodyText.match(pat);
      if (match) {
        const num = parseFloat(match[1].replace(/[,，]/g, ''));
        if (num > 100 && num < 10000000) { info.price = num; break; }
      }
    }
  }

  return info;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.action === 'scrapePrice') sendResponse(scrapePageInfo());
  return true;
});
