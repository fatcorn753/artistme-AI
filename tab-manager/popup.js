const tabsList   = document.getElementById('tabs-list');
const sessionsList = document.getElementById('sessions-list');
const searchEl   = document.getElementById('search');
const countBadge = document.getElementById('tab-count');

let allTabs = [];

async function loadTabs() {
  allTabs = await chrome.tabs.query({});
  countBadge.textContent = allTabs.length;
  renderTabs(allTabs);
}

function renderTabs(tabs) {
  tabsList.innerHTML = '';
  if (!tabs.length) {
    tabsList.innerHTML = '<div class="empty-msg">タブが見つかりません</div>';
    return;
  }
  tabs.forEach(tab => {
    const div = document.createElement('div');
    div.className = 'tab-item' + (tab.active ? ' active-tab' : '');

    let faviconEl;
    if (tab.favIconUrl) {
      faviconEl = `<img class="tab-favicon" src="${tab.favIconUrl}" onerror="this.style.display='none'">`;
    } else {
      faviconEl = `<div class="tab-favicon-placeholder">⬜</div>`;
    }

    const hostname = (() => { try { return new URL(tab.url).hostname; } catch { return tab.url || ''; } })();

    div.innerHTML = `
      ${faviconEl}
      <div class="tab-info">
        <div class="tab-title" title="${tab.title || ''}">${tab.title || '無題'}</div>
        <div class="tab-url">${hostname}</div>
      </div>
      <button class="tab-close" data-id="${tab.id}">×</button>
    `;

    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) return;
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
      window.close();
    });

    div.querySelector('.tab-close').addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.tabs.remove(tab.id);
      loadTabs();
    });

    tabsList.appendChild(div);
  });
}

searchEl.addEventListener('input', () => {
  const q = searchEl.value.toLowerCase();
  const filtered = q
    ? allTabs.filter(t => (t.title || '').toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q))
    : allTabs;
  renderTabs(filtered);
});

document.getElementById('btn-dedup').addEventListener('click', async () => {
  const seen = new Set();
  const toClose = [];
  for (const tab of allTabs) {
    const key = tab.url;
    if (seen.has(key)) toClose.push(tab.id);
    else seen.add(key);
  }
  if (toClose.length === 0) { alert('重複タブはありません'); return; }
  await chrome.tabs.remove(toClose);
  loadTabs();
});

document.getElementById('btn-close-others').addEventListener('click', async () => {
  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  const toClose = allTabs.filter(t => t.id !== current?.id).map(t => t.id);
  if (!confirm(`${toClose.length}個のタブを閉じますか？`)) return;
  await chrome.tabs.remove(toClose);
  loadTabs();
});

document.getElementById('btn-save-session').addEventListener('click', () => {
  const name = `セッション ${new Date().toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}`;
  const urls = allTabs.map(t => ({ url: t.url, title: t.title }));
  chrome.storage.local.get(['sessions'], (data) => {
    const sessions = data.sessions || [];
    sessions.unshift({ name, urls, time: Date.now() });
    if (sessions.length > 10) sessions.pop();
    chrome.storage.local.set({ sessions }, loadSessions);
  });
});

function loadSessions() {
  chrome.storage.local.get(['sessions'], (data) => {
    const sessions = data.sessions || [];
    sessionsList.innerHTML = '';
    if (!sessions.length) {
      sessionsList.innerHTML = '<div class="empty-msg">保存済みセッションなし</div>';
      return;
    }
    sessions.forEach((session, i) => {
      const div = document.createElement('div');
      div.className = 'session-item';
      div.innerHTML = `
        <span title="${session.urls.length}タブ">${session.name} (${session.urls.length})</span>
        <button class="session-btn restore-btn">復元</button>
        <button class="session-btn del delete-btn">削除</button>
      `;
      div.querySelector('.restore-btn').addEventListener('click', () => {
        session.urls.forEach(({ url }) => {
          if (url && url.startsWith('http')) chrome.tabs.create({ url });
        });
      });
      div.querySelector('.delete-btn').addEventListener('click', () => {
        chrome.storage.local.get(['sessions'], (data) => {
          const s = data.sessions || [];
          s.splice(i, 1);
          chrome.storage.local.set({ sessions: s }, loadSessions);
        });
      });
      sessionsList.appendChild(div);
    });
  });
}

loadTabs();
loadSessions();
searchEl.focus();
