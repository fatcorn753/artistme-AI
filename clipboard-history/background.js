const MAX_ITEMS = 50;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'add') {
    const text = msg.text?.trim();
    if (!text) return;
    chrome.storage.local.get(['history'], (data) => {
      let history = data.history || [];
      history = history.filter(item => item.text !== text);
      history.unshift({ text, time: Date.now() });
      if (history.length > MAX_ITEMS) history = history.slice(0, MAX_ITEMS);
      chrome.storage.local.set({ history });
    });
  }
});
