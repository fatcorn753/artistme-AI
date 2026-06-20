chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'wiki-search',
    title: 'Wikipedia で "%s" を検索',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'wiki-search') {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (query) => window.__wikiSearchQuery = query,
      args: [info.selectionText],
    }).then(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    });
  }
});
