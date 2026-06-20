const CATEGORIES = {
  '長さ': {
    units: {
      'mm': 0.001, 'cm': 0.01, 'm': 1, 'km': 1000,
      'in': 0.0254, 'ft': 0.3048, 'yd': 0.9144, 'mi': 1609.344,
      'nm': 1852, '光年': 9.461e15,
    },
    base: 'm'
  },
  '重さ': {
    units: {
      'mg': 0.000001, 'g': 0.001, 'kg': 1, 't': 1000,
      'oz': 0.0283495, 'lb': 0.453592, 'st': 6.35029,
    },
    base: 'kg'
  },
  '温度': { special: true },
  '面積': {
    units: {
      'mm²': 1e-6, 'cm²': 0.0001, 'm²': 1, 'km²': 1e6,
      'ha': 10000, 'ac': 4046.86, 'ft²': 0.092903, 'in²': 0.00064516,
    },
    base: 'm²'
  },
  '体積': {
    units: {
      'mL': 0.001, 'L': 1, 'm³': 1000,
      'tsp': 0.00492892, 'tbsp': 0.0147868, 'fl oz': 0.0295735,
      'cup': 0.236588, 'pt': 0.473176, 'qt': 0.946353, 'gal': 3.78541,
    },
    base: 'L'
  },
  '速度': {
    units: {
      'm/s': 1, 'km/h': 0.277778, 'mph': 0.44704,
      'kt': 0.514444, 'ft/s': 0.3048,
    },
    base: 'm/s'
  },
  'データ': {
    units: {
      'bit': 1, 'B': 8, 'KB': 8192, 'MB': 8388608,
      'GB': 8589934592, 'TB': 8796093022208,
    },
    base: 'bit'
  },
};

const TEMP_UNITS = ['°C', '°F', 'K'];

function convertTemp(val, from, to) {
  let celsius;
  if (from === '°C') celsius = val;
  else if (from === '°F') celsius = (val - 32) * 5/9;
  else celsius = val - 273.15;

  if (to === '°C') return celsius;
  if (to === '°F') return celsius * 9/5 + 32;
  return celsius + 273.15;
}

function convert(val, fromUnit, toUnit, cat) {
  if (cat === '温度') return convertTemp(val, fromUnit, toUnit);
  const info = CATEGORIES[cat];
  const toBase = val * info.units[fromUnit];
  return toBase / info.units[toUnit];
}

function fmt(n) {
  if (n === null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e10 || (Math.abs(n) < 0.0001 && n !== 0)) return n.toExponential(4);
  const s = parseFloat(n.toPrecision(8)).toString();
  return s;
}

// UI
const catTabsEl   = document.getElementById('category-tabs');
const fromValueEl = document.getElementById('from-value');
const toValueEl   = document.getElementById('to-value');
const fromUnitEl  = document.getElementById('from-unit');
const toUnitEl    = document.getElementById('to-unit');
const allResultsEl= document.getElementById('all-results');
const copyBtn     = document.getElementById('btn-copy-result');

let currentCat = '長さ';
let fromUnit = 'cm';
let toUnit = 'm';

function getUnits(cat) {
  return cat === '温度' ? TEMP_UNITS : Object.keys(CATEGORIES[cat].units);
}

function populateSelects(cat) {
  const units = getUnits(cat);
  [fromUnitEl, toUnitEl].forEach((sel, i) => {
    sel.innerHTML = '';
    units.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      sel.appendChild(opt);
    });
    sel.value = i === 0 ? fromUnit : toUnit;
    if (!units.includes(i === 0 ? fromUnit : toUnit)) sel.selectedIndex = i;
  });
}

function update() {
  const val = parseFloat(fromValueEl.value);
  if (isNaN(val)) { toValueEl.value = ''; allResultsEl.innerHTML = ''; return; }

  const fUnit = fromUnitEl.value;
  const tUnit = toUnitEl.value;
  const result = convert(val, fUnit, tUnit, currentCat);
  toValueEl.value = fmt(result);

  // All results
  allResultsEl.innerHTML = '';
  const units = getUnits(currentCat);
  units.forEach(u => {
    if (u === fUnit) return;
    const r = convert(val, fUnit, u, currentCat);
    const row = document.createElement('div');
    row.className = 'result-row';
    row.innerHTML = `<span class="r-unit">${u}</span><span class="r-value">${fmt(r)}</span>`;
    row.addEventListener('click', () => {
      toUnitEl.value = u;
      toValueEl.value = fmt(r);
    });
    allResultsEl.appendChild(row);
  });
}

function buildCategoryTabs() {
  catTabsEl.innerHTML = '';
  Object.keys(CATEGORIES).forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (cat === currentCat ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      currentCat = cat;
      const units = getUnits(cat);
      fromUnit = units[0];
      toUnit = units[1] || units[0];
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.toggle('active', b.textContent === cat));
      populateSelects(cat);
      update();
      chrome.storage.local.set({ lastCat: cat });
    });
    catTabsEl.appendChild(btn);
  });
}

fromValueEl.addEventListener('input', update);
fromUnitEl.addEventListener('change', () => { fromUnit = fromUnitEl.value; update(); });
toUnitEl.addEventListener('change', () => { toUnit = toUnitEl.value; update(); });

document.getElementById('btn-swap').addEventListener('click', () => {
  const tmp = fromUnitEl.value;
  fromUnitEl.value = toUnitEl.value;
  toUnitEl.value = tmp;
  fromUnit = fromUnitEl.value;
  toUnit = toUnitEl.value;
  const tmpVal = fromValueEl.value;
  fromValueEl.value = toValueEl.value;
  update();
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(toValueEl.value + ' ' + toUnitEl.value).then(() => {
    copyBtn.textContent = '✓ コピー済み';
    copyBtn.classList.add('copied');
    setTimeout(() => { copyBtn.textContent = '結果をコピー'; copyBtn.classList.remove('copied'); }, 1500);
  });
});

chrome.storage.local.get(['lastCat'], (data) => {
  if (data.lastCat && CATEGORIES[data.lastCat]) currentCat = data.lastCat;
  buildCategoryTabs();
  const units = getUnits(currentCat);
  fromUnit = units[0]; toUnit = units[1] || units[0];
  populateSelects(currentCat);
  fromValueEl.value = 1;
  update();
});
