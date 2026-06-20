let whitelist = [];
let suspendAfter = 30;
let enabled = true;
let tabActivity = {};

async function loadData() {
  const d = await new Promise(r => chrome.storage.local.get(['whitelist','suspendAfter','enabled'], r));
  whitelist    = d.whitelist    || [];
  suspendAfter = d.suspendAfter || 30;
  enabled      = d.enabled      !== false;
  document.getElementById('enabled-toggle').checked  = enabled;
  document.getElementById('suspend-after').value     = suspendAfter;
}

function save() {
  chrome.storage.local.set({ whitelist, suspendAfter, enabled });
}

// ── Render tabs ────────────────────────────────────────
async function renderTabs() {
  const tabs = await chrome.tabs.query({});
  tabActivity = await new Promise(r => chrome.runtime.sendMessage({ action:'getTabActivity' }, r));

  const list = document.getElementById('tabs-list');
  list.innerHTML = '';

  let suspended = 0;
  const now = Date.now();

  tabs.forEach(tab => {
    if (tab.discarded) suspended++;

    const item = document.createElement('div');
    item.className = 'tab-item';

    const favicon = tab.favIconUrl || '';
    const host = (() => { try { return new URL(tab.url||'').hostname; } catch { return ''; } })();
    const lastActive = tabActivity[tab.id] || 0;
    const idleMin = lastActive ? Math.floor((now-lastActive)/60000) : null;

    let statusText, statusCls;
    if (tab.discarded)    { statusText='スリープ'; statusCls='sleeping'; }
    else if (tab.active)  { statusText='アクティブ'; statusCls='active'; }
    else if (idleMin!==null) { statusText=idleMin+'分前'; statusCls='normal'; }
    else                  { statusText='—'; statusCls='normal'; }

    const actionBtn = tab.discarded
      ? `<button class="tab-btn wake-btn" data-id="${tab.id}" title="復元">▶</button>`
      : `<button class="tab-btn sleep-btn" data-id="${tab.id}" title="スリープ">💤</button>`;

    item.innerHTML = `
      ${favicon ? `<img class="tab-favicon" src="${favicon}" alt="" onerror="this.style.display='none'">` : '<div class="tab-favicon"></div>'}
      <span class="tab-title" title="${tab.title||''}">${tab.title||host||'無題'}</span>
      <span class="tab-status ${statusCls}">${statusText}</span>
      ${actionBtn}
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.sleep-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action:'suspendTab', tabId:parseInt(btn.dataset.id) });
      renderTabs();
    });
  });
  list.querySelectorAll('.wake-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action:'wakeTab', tabId:parseInt(btn.dataset.id) });
      setTimeout(renderTabs, 800);
    });
  });

  // Stats
  document.getElementById('total-tabs').textContent     = tabs.length;
  document.getElementById('suspended-tabs').textContent = suspended;
  document.getElementById('mem-saved').textContent      = Math.round(suspended * 80) + 'MB';
}

// ── Whitelist ──────────────────────────────────────────
function renderWhitelist() {
  const list = document.getElementById('white-list');
  list.innerHTML = '';
  if (!whitelist.length) {
    list.innerHTML = '<span style="color:#334155;font-size:11px">なし</span>';
    return;
  }
  whitelist.forEach((domain, i) => {
    const item = document.createElement('div');
    item.className = 'white-item';
    item.innerHTML = `${domain}<button class="white-del" data-i="${i}">×</button>`;
    item.querySelector('.white-del').addEventListener('click', () => {
      whitelist.splice(i, 1); save(); renderWhitelist();
    });
    list.appendChild(item);
  });
}

document.getElementById('btn-add-white').addEventListener('click', () => {
  const domain = prompt('除外するドメインを入力:\n（例: google.com, youtube.com）');
  if (domain?.trim() && !whitelist.includes(domain.trim())) {
    whitelist.push(domain.trim()); save(); renderWhitelist();
  }
});

// ── Controls ──────────────────────────────────────────
document.getElementById('enabled-toggle').addEventListener('change', e => {
  enabled = e.target.checked; save();
});
document.getElementById('suspend-after').addEventListener('change', e => {
  suspendAfter = parseInt(e.target.value); save();
});

document.getElementById('btn-suspend-all').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: false, pinned: false, discarded: false });
  for (const tab of tabs) {
    if (!tab.url?.startsWith('chrome') && !tab.audible) {
      try { await chrome.runtime.sendMessage({ action:'suspendTab', tabId:tab.id }); } catch {}
    }
  }
  setTimeout(renderTabs, 500);
});

document.getElementById('btn-wake-all').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ discarded: true });
  for (const tab of tabs) {
    try { await chrome.runtime.sendMessage({ action:'wakeTab', tabId:tab.id }); } catch {}
  }
  setTimeout(renderTabs, 1000);
});

// ── Init ─────────────────────────────────────────────
loadData().then(() => { renderTabs(); renderWhitelist(); });
setInterval(renderTabs, 5000);
