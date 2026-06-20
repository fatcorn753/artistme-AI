const STYLE_ID = '__dark-mode-toggler__';

function applySettings(settings) {
  let el = document.getElementById(STYLE_ID);
  if (!settings || !settings.enabled) {
    el?.remove();
    return;
  }

  const { brightness = 100, contrast = 100, sepia = 0, invert = true } = settings;

  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.documentElement.appendChild(el);
  }

  const filterParts = [
    `brightness(${brightness}%)`,
    `contrast(${contrast}%)`,
    sepia > 0 ? `sepia(${sepia}%)` : '',
    invert ? 'invert(1) hue-rotate(180deg)' : '',
  ].filter(Boolean).join(' ');

  el.textContent = `
    html {
      filter: ${filterParts} !important;
      background: #fff !important;
    }
    img, video, canvas, svg, [style*="background-image"] {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `;
}

// Apply on load
chrome.storage.local.get(['siteSettings', 'globalEnabled'], (data) => {
  const hostname = location.hostname;
  const siteSettings = (data.siteSettings || {})[hostname];
  const global = data.globalEnabled;
  const settings = siteSettings !== undefined ? siteSettings : (global ? { enabled: true } : null);
  if (settings) applySettings(settings);
});

// Listen for runtime updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'applySettings') applySettings(msg.settings);
});
