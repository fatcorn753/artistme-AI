const colorInput = document.getElementById('color-input');
const previewBox = document.getElementById('preview-box');
const hexValue = document.getElementById('hex-value');
const rgbValue = document.getElementById('rgb-value');
const hslValue = document.getElementById('hsl-value');
const saveBtn = document.getElementById('save-btn');
const palette = document.getElementById('palette');

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return { r, g, b };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function updateDisplay(hex) {
  const upper = hex.toUpperCase();
  previewBox.style.background = hex;
  hexValue.textContent = upper;

  const { r, g, b } = hexToRgb(hex);
  rgbValue.textContent = `rgb(${r}, ${g}, ${b})`;

  const { h, s, l } = rgbToHsl(r, g, b);
  hslValue.textContent = `hsl(${h}, ${s}%, ${l}%)`;
}

colorInput.addEventListener('input', (e) => updateDisplay(e.target.value));

previewBox.addEventListener('click', () => colorInput.click());

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = document.getElementById(btn.dataset.target).textContent;
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'コピー'; btn.classList.remove('copied'); }, 1500);
    });
  });
});

function renderPalette(colors) {
  palette.innerHTML = '';
  if (!colors.length) {
    palette.innerHTML = '<span class="empty-msg">まだ色が保存されていません</span>';
    return;
  }
  colors.forEach((color, i) => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = color;
    swatch.title = color.toUpperCase();

    const del = document.createElement('div');
    del.className = 'delete';
    del.textContent = '×';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.storage.local.get(['palette'], (data) => {
        const arr = data.palette || [];
        arr.splice(i, 1);
        chrome.storage.local.set({ palette: arr }, () => renderPalette(arr));
      });
    });

    swatch.appendChild(del);
    swatch.addEventListener('click', () => {
      colorInput.value = color;
      updateDisplay(color);
    });
    palette.appendChild(swatch);
  });
}

saveBtn.addEventListener('click', () => {
  const hex = colorInput.value;
  chrome.storage.local.get(['palette'], (data) => {
    const arr = data.palette || [];
    if (!arr.includes(hex)) {
      arr.unshift(hex);
      if (arr.length > 20) arr.pop();
      chrome.storage.local.set({ palette: arr }, () => renderPalette(arr));
    }
  });
});

chrome.storage.local.get(['palette', 'lastColor'], (data) => {
  const color = data.lastColor || '#ff6b6b';
  colorInput.value = color;
  updateDisplay(color);
  renderPalette(data.palette || []);
});

window.addEventListener('beforeunload', () => {
  chrome.storage.local.set({ lastColor: colorInput.value });
});

updateDisplay(colorInput.value);
