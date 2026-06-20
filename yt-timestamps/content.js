// Inject "Save Timestamp" button next to YouTube controls
function injectButton() {
  if (document.getElementById('__yt-ts-btn__')) return;

  const controls = document.querySelector('.ytp-right-controls');
  if (!controls) return;

  const btn = document.createElement('button');
  btn.id = '__yt-ts-btn__';
  btn.title = 'タイムスタンプを保存 (S)';
  btn.style.cssText = `
    background: none; border: none; cursor: pointer; color: white;
    font-size: 13px; padding: 0 8px; height: 48px; opacity: 0.9;
    font-family: sans-serif; font-weight: 700;
  `;
  btn.textContent = '⏱ 保存';
  btn.addEventListener('click', saveTimestamp);
  controls.prepend(btn);
}

function getVideoInfo() {
  const video = document.querySelector('video');
  const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata');
  return {
    time: video ? Math.floor(video.currentTime) : 0,
    title: titleEl ? titleEl.textContent.trim() : document.title,
    url: location.href.split('&t=')[0],
  };
}

function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${m}:${String(sec).padStart(2,'0')}`;
}

function saveTimestamp() {
  const info = getVideoInfo();
  const ts = { ...info, formattedTime: formatTime(info.time), note: '', savedAt: Date.now() };
  const storageKey = `yt-ts-${new URL(info.url).searchParams.get('v')}`;

  chrome.storage.local.get([storageKey], (data) => {
    const list = data[storageKey] || { title: info.title, url: info.url, timestamps: [] };
    list.timestamps.push(ts);
    chrome.storage.local.set({ [storageKey]: list });

    // Flash feedback
    const btn = document.getElementById('__yt-ts-btn__');
    if (btn) {
      btn.textContent = '✓ 保存！';
      btn.style.color = '#4ade80';
      setTimeout(() => { btn.textContent = '⏱ 保存'; btn.style.color = 'white'; }, 1200);
    }
  });
}

// Keyboard shortcut: S key (when not in input)
document.addEventListener('keydown', (e) => {
  if (e.key === 's' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
    saveTimestamp();
  }
});

// Retry until controls are ready
const tryInject = setInterval(() => {
  if (document.querySelector('.ytp-right-controls')) {
    injectButton();
    clearInterval(tryInject);
  }
}, 500);

// Re-inject on navigation
const observer = new MutationObserver(() => injectButton());
observer.observe(document.body, { childList: true, subtree: true });
