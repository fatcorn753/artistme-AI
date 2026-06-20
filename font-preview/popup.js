const SYSTEM_FONTS = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Helvetica Neue', 'Impact', 'Lucida Console', 'Palatino', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana',
  '-apple-system', 'BlinkMacSystemFont', 'Menlo', 'Monaco', 'SF Pro Display',
];

const GOOGLE_FONTS = [
  'Roboto','Open Sans','Lato','Montserrat','Poppins','Inter','Nunito',
  'Raleway','Oswald','Merriweather','Playfair Display','Source Sans Pro',
  'Ubuntu','Noto Sans','PT Sans','Fira Code','JetBrains Mono','Space Mono',
  'Inconsolata','DM Sans','Work Sans','Quicksand','Mulish','Karla',
  'Josefin Sans','Cabin','Nunito Sans','Exo 2','Titillium Web','Barlow',
  'Bebas Neue','Pacifico','Dancing Script','Lobster','Abril Fatface',
  'Righteous','Fredoka One','Russo One','Permanent Marker','Caveat',
  'Noto Serif','EB Garamond','Cormorant Garamond','Libre Baskerville',
  'Bitter','Lora','Crimson Text','Spectral','Frank Ruhl Libre',
  'Noto Sans JP','M PLUS Rounded 1c','Kosugi Maru','Sawarabi Gothic',
];

const previewTextEl = document.getElementById('preview-text');
const fontSizeEl    = document.getElementById('font-size');
const weightEl      = document.getElementById('weight-select');
const styleEl       = document.getElementById('style-select');
const darkBgEl      = document.getElementById('dark-bg');
const searchEl      = document.getElementById('font-search');
const fontList      = document.getElementById('font-list');
const gfontsLink    = document.getElementById('gfonts-link');

let favorites = new Set();
let loadedGFonts = new Set();

function loadGFont(family) {
  if (loadedGFonts.has(family)) return;
  loadedGFonts.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700;900&display=swap`;
  document.head.appendChild(link);
}

function getSampleText() { return previewTextEl.value || 'The quick brown fox 12345'; }
function getFontSize()   { return parseInt(fontSizeEl.value) || 22; }
function getWeight()     { return weightEl.value; }
function getFontStyle()  { return styleEl.value; }

function renderAll() {
  const q = searchEl.value.toLowerCase();
  const dark = darkBgEl.checked;
  fontList.innerHTML = '';

  const allFonts = [...SYSTEM_FONTS, ...GOOGLE_FONTS];
  const filtered = q ? allFonts.filter(f => f.toLowerCase().includes(q)) : allFonts;

  // Favorites first
  const favs = filtered.filter(f => favorites.has(f));
  const rest  = filtered.filter(f => !favorites.has(f));

  if (favs.length) {
    addDivider('お気に入り');
    favs.forEach(f => addCard(f, dark));
  }

  const sysFiltered = rest.filter(f => SYSTEM_FONTS.includes(f));
  const gFiltered   = rest.filter(f => GOOGLE_FONTS.includes(f));

  if (sysFiltered.length) {
    addDivider('システムフォント');
    sysFiltered.forEach(f => addCard(f, dark));
  }
  if (gFiltered.length) {
    addDivider('Google Fonts');
    gFiltered.forEach(f => addCard(f, dark));
  }
}

function addDivider(text) {
  const d = document.createElement('div');
  d.className = 'section-divider';
  d.textContent = text;
  fontList.appendChild(d);
}

function addCard(family, dark) {
  if (GOOGLE_FONTS.includes(family)) loadGFont(family);

  const card = document.createElement('div');
  card.className = 'font-card' + (dark ? ' dark-bg' : '') + (favorites.has(family) ? ' favorited' : '');

  const nameRow = document.createElement('div');
  nameRow.className = 'font-name-row';

  const nameEl = document.createElement('span');
  nameEl.className = 'font-name';
  nameEl.textContent = family;

  const favBtn = document.createElement('button');
  favBtn.className = 'fav-btn' + (favorites.has(family) ? ' active' : '');
  favBtn.textContent = '★';
  favBtn.title = 'お気に入り';
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (favorites.has(family)) favorites.delete(family);
    else favorites.add(family);
    chrome.storage.local.set({ favorites: [...favorites] }, renderAll);
  });

  nameRow.appendChild(nameEl);
  nameRow.appendChild(favBtn);

  const sample = document.createElement('div');
  sample.className = 'font-sample';
  sample.style.fontFamily = `'${family}', sans-serif`;
  sample.style.fontSize = getFontSize() + 'px';
  sample.style.fontWeight = getWeight();
  sample.style.fontStyle = getFontStyle();
  sample.textContent = getSampleText();

  card.appendChild(nameRow);
  card.appendChild(sample);

  card.addEventListener('click', () => {
    navigator.clipboard.writeText(family);
    nameEl.textContent = family + ' ✓';
    setTimeout(() => nameEl.textContent = family, 1200);
  });

  fontList.appendChild(card);
}

function updateSamples() {
  document.querySelectorAll('.font-sample').forEach(el => {
    el.textContent = getSampleText();
    el.style.fontSize = getFontSize() + 'px';
    el.style.fontWeight = getWeight();
    el.style.fontStyle = getFontStyle();
  });
  document.querySelectorAll('.font-card').forEach(el => {
    el.classList.toggle('dark-bg', darkBgEl.checked);
  });
}

previewTextEl.addEventListener('input', updateSamples);
fontSizeEl.addEventListener('input', updateSamples);
weightEl.addEventListener('change', updateSamples);
styleEl.addEventListener('change', updateSamples);
darkBgEl.addEventListener('change', updateSamples);
searchEl.addEventListener('input', renderAll);

chrome.storage.local.get(['favorites'], (data) => {
  favorites = new Set(data.favorites || []);
  renderAll();
});
