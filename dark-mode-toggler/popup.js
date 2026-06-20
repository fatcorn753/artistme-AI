const PRESETS = {
  night:    { brightness: 80, contrast: 90,  sepia: 0,  invert: true },
  warm:     { brightness: 85, contrast: 85,  sepia: 40, invert: true },
  reading:  { brightness: 90, contrast: 80,  sepia: 20, invert: true },
  custom:   { brightness: 100, contrast: 100, sepia: 0, invert: true },
};

const toggleEl     = document.getElementById('toggle-enabled');
const controlsEl   = document.getElementById('controls');
const siteEl       = document.getElementById('current-site');
const brightnessEl = document.getElementById('brightness');
const contrastEl   = document.getElementById('contrast');
const sepiaEl      = document.getElementById('sepia');

let hostname = '';
let currentSettings = { enabled: false, brightness: 85, contrast: 90, sepia: 0, invert: true };

function updateLabels() {
  document.getElementById('brightness-val').textContent = brightnessEl.value + '%';
  document.getElementById('contrast-val').textContent   = contrastEl.value   + '%';
  document.getElementById('sepia-val').textContent      = sepiaEl.value      + '%';
}

function getSettings() {
  return {
    enabled:    currentSettings.enabled,
    brightness: parseInt(brightnessEl.value),
    contrast:   parseInt(contrastEl.value),
    sepia:      parseInt(sepiaEl.value),
    invert:     true,
  };
}

function applyToTab(settings) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (s) => {
        const STYLE_ID = '__dark-mode-toggler__';
        let el = document.getElementById(STYLE_ID);
        if (!s.enabled) { el?.remove(); return; }
        if (!el) { el = document.createElement('style'); el.id = STYLE_ID; document.documentElement.appendChild(el); }
        const f = [`brightness(${s.brightness}%)`, `contrast(${s.contrast}%)`];
        if (s.sepia > 0) f.push(`sepia(${s.sepia}%)`);
        if (s.invert) f.push('invert(1) hue-rotate(180deg)');
        el.textContent = `html{filter:${f.join(' ')}!important;background:#fff!important}img,video,canvas,svg{filter:invert(1) hue-rotate(180deg)!important}`;
      },
      args: [settings],
    });
  });
}

function saveAndApply() {
  const settings = getSettings();
  currentSettings = settings;
  chrome.storage.local.get(['siteSettings'], (data) => {
    const ss = data.siteSettings || {};
    ss[hostname] = settings;
    chrome.storage.local.set({ siteSettings: ss });
  });
  applyToTab(settings);
}

toggleEl.addEventListener('change', () => {
  currentSettings.enabled = toggleEl.checked;
  controlsEl.classList.toggle('disabled', !toggleEl.checked);
  saveAndApply();
});

[brightnessEl, contrastEl, sepiaEl].forEach(el => {
  el.addEventListener('input', () => { updateLabels(); saveAndApply(); });
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    brightnessEl.value = p.brightness;
    contrastEl.value   = p.contrast;
    sepiaEl.value      = p.sepia;
    updateLabels();
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    saveAndApply();
  });
});

document.getElementById('btn-reset-site').addEventListener('click', () => {
  chrome.storage.local.get(['siteSettings'], (data) => {
    const ss = data.siteSettings || {};
    delete ss[hostname];
    chrome.storage.local.set({ siteSettings: ss });
    toggleEl.checked = false;
    currentSettings.enabled = false;
    controlsEl.classList.add('disabled');
    applyToTab({ enabled: false });
  });
});

document.getElementById('btn-global').addEventListener('click', () => {
  const enabled = !toggleEl.checked;
  toggleEl.checked = enabled;
  currentSettings.enabled = enabled;
  controlsEl.classList.toggle('disabled', !enabled);
  chrome.storage.local.set({ globalEnabled: enabled });
  saveAndApply();
});

// Init
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  try { hostname = new URL(tabs[0]?.url || '').hostname; } catch { hostname = 'unknown'; }
  siteEl.textContent = hostname;

  chrome.storage.local.get(['siteSettings'], (data) => {
    const ss = (data.siteSettings || {})[hostname];
    if (ss) {
      currentSettings = ss;
      toggleEl.checked = ss.enabled;
      brightnessEl.value = ss.brightness ?? 85;
      contrastEl.value   = ss.contrast   ?? 90;
      sepiaEl.value      = ss.sepia      ?? 0;
      updateLabels();
      if (ss.enabled) controlsEl.classList.remove('disabled');
    }
  });
});
