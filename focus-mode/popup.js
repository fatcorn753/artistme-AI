const idleView = document.getElementById('idle-view');
const activeView = document.getElementById('active-view');
const remainingEl = document.getElementById('remaining-time');
const blockedCountEl = document.getElementById('blocked-count');
const customSiteInput = document.getElementById('custom-site');
const customList = document.getElementById('custom-list');
const customMinInput = document.getElementById('custom-min');

let selectedMinutes = 25;
let customSites = [];
let tickInterval = null;

// Preset buttons
document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMinutes = parseInt(btn.dataset.min);
    customMinInput.value = '';
  });
});
document.querySelector('.preset[data-min="25"]').classList.add('selected');

customMinInput.addEventListener('input', () => {
  if (customMinInput.value) {
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('selected'));
    selectedMinutes = parseInt(customMinInput.value);
  }
});

document.getElementById('btn-add-site').addEventListener('click', addCustomSite);
customSiteInput.addEventListener('keydown', e => { if (e.key === 'Enter') addCustomSite(); });

function addCustomSite() {
  let domain = customSiteInput.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain || customSites.includes(domain)) { customSiteInput.value = ''; return; }
  customSites.push(domain);
  customSiteInput.value = '';
  renderCustomSites();
}

function renderCustomSites() {
  customList.innerHTML = '';
  customSites.forEach((d, i) => {
    const tag = document.createElement('div');
    tag.className = 'custom-tag';
    tag.innerHTML = `${d}<button data-i="${i}">×</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      customSites.splice(i, 1);
      renderCustomSites();
    });
    customList.appendChild(tag);
  });
}

document.getElementById('btn-start').addEventListener('click', () => {
  const checked = [...document.querySelectorAll('.default-sites input:checked')].map(el => el.value);
  const allDomains = [...new Set([...checked, ...customSites])];
  if (allDomains.length === 0) { alert('ブロックするサイトを選択してください'); return; }
  const minutes = selectedMinutes || 25;
  chrome.runtime.sendMessage({ action: 'start', minutes, blockedDomains: allDomains }, () => {
    showActive();
  });
});

document.getElementById('btn-stop').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stop' }, () => showIdle());
});

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function showActive() {
  idleView.classList.add('hidden');
  activeView.classList.remove('hidden');
  startTick();
}

function showIdle() {
  activeView.classList.add('hidden');
  idleView.classList.remove('hidden');
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
}

function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    chrome.storage.local.get(['endsAt', 'active', 'blockedDomains'], (data) => {
      if (!data.active) { showIdle(); return; }
      const remaining = data.endsAt - Date.now();
      remainingEl.textContent = formatTime(remaining);
      blockedCountEl.querySelector('span').textContent = (data.blockedDomains || []).length;
    });
  }, 500);
}

// Init
chrome.storage.local.get(['active', 'endsAt', 'blockedDomains'], (data) => {
  if (data.active && data.endsAt > Date.now()) {
    blockedCountEl.querySelector('span').textContent = (data.blockedDomains || []).length;
    showActive();
  } else {
    showIdle();
  }
});
