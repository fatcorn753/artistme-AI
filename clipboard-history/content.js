document.addEventListener('copy', () => {
  setTimeout(() => {
    navigator.clipboard.readText().then(text => {
      if (!text || text.length > 10000) return;
      chrome.runtime.sendMessage({ action: 'add', text });
    }).catch(() => {});
  }, 100);
});
