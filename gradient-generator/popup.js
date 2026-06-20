const PRESETS = [
  { stops: ['#ff6b6b','#feca57'], angle: 135 },
  { stops: ['#48dbfb','#ff9ff3'], angle: 90 },
  { stops: ['#ff9f43','#ee5a24'], angle: 45 },
  { stops: ['#0abde3','#48dbfb','#1dd1a1'], angle: 120 },
  { stops: ['#a29bfe','#fd79a8'], angle: 135 },
  { stops: ['#6c5ce7','#a29bfe','#fd79a8'], angle: 225 },
  { stops: ['#00b894','#00cec9'], angle: 90 },
  { stops: ['#fdcb6e','#e17055'], angle: 160 },
  { stops: ['#2d3436','#636e72'], angle: 180 },
  { stops: ['#e17055','#d63031','#c0392b'], angle: 45 },
  { stops: ['#55efc4','#81ecec','#74b9ff'], angle: 135 },
  { stops: ['#fd79a8','#e84393','#a29bfe'], angle: 210 },
];

let stops = [
  { color: '#f472b6', pos: 0 },
  { color: '#818cf8', pos: 100 },
];
let gradType = 'linear';
let angle = 135;
let outputFmt = 'css';

const preview    = document.getElementById('preview');
const angleEl    = document.getElementById('angle');
const angleVal   = document.getElementById('angle-val');
const stopsList  = document.getElementById('stops-list');
const cssOutput  = document.getElementById('css-output');
const presetsGrid= document.getElementById('presets-grid');

function buildGradientCSS() {
  const sorted = [...stops].sort((a,b) => a.pos - b.pos);
  const colorStr = sorted.map(s => `${s.color} ${s.pos}%`).join(', ');
  if (gradType === 'linear') return `linear-gradient(${angle}deg, ${colorStr})`;
  if (gradType === 'radial') return `radial-gradient(circle, ${colorStr})`;
  return `conic-gradient(from ${angle}deg, ${colorStr})`;
}

function update() {
  const grad = buildGradientCSS();
  preview.style.background = grad;

  let out = '';
  if (outputFmt === 'css') {
    out = `background: ${grad};`;
  } else if (outputFmt === 'tailwind') {
    const sorted = [...stops].sort((a,b)=>a.pos-b.pos);
    out = `style="background: ${grad}"`;
  } else {
    out = grad;
  }
  cssOutput.textContent = out;

  chrome.storage.local.set({ gradStops: stops, gradAngle: angle, gradType });
}

function renderStops() {
  stopsList.innerHTML = '';
  stops.forEach((stop, i) => {
    const row = document.createElement('div');
    row.className = 'stop-row';

    // Color picker
    const colorBox = document.createElement('div');
    colorBox.className = 'color-preview';
    colorBox.style.background = stop.color;
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = stop.color;
    colorInput.addEventListener('input', () => {
      stops[i].color = colorInput.value;
      colorBox.style.background = colorInput.value;
      update();
    });
    colorBox.appendChild(colorInput);

    // Position input
    const posInput = document.createElement('input');
    posInput.type = 'number';
    posInput.className = 'stop-pos';
    posInput.min = 0; posInput.max = 100;
    posInput.value = stop.pos;
    posInput.addEventListener('input', () => {
      stops[i].pos = Math.max(0, Math.min(100, parseInt(posInput.value) || 0));
      posSlider.value = stops[i].pos;
      update();
    });

    const posSlider = document.createElement('input');
    posSlider.type = 'range';
    posSlider.className = 'stop-pos-slider';
    posSlider.min = 0; posSlider.max = 100;
    posSlider.value = stop.pos;
    posSlider.addEventListener('input', () => {
      stops[i].pos = parseInt(posSlider.value);
      posInput.value = stops[i].pos;
      update();
    });

    const del = document.createElement('button');
    del.className = 'stop-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      if (stops.length <= 2) return;
      stops.splice(i, 1);
      renderStops();
      update();
    });

    row.appendChild(colorBox);
    row.appendChild(posInput);
    row.appendChild(posSlider);
    row.appendChild(del);
    stopsList.appendChild(row);
  });
}

function buildPresets() {
  PRESETS.forEach((p, i) => {
    const swatch = document.createElement('div');
    swatch.className = 'preset-swatch';
    const sorted = p.stops.map((c,i,a) => `${c} ${Math.round(i/(a.length-1)*100)}%`).join(', ');
    swatch.style.background = `linear-gradient(${p.angle}deg, ${sorted})`;
    swatch.title = 'プリセット ' + (i+1);
    swatch.addEventListener('click', () => {
      const len = p.stops.length;
      stops = p.stops.map((color, i) => ({ color, pos: Math.round(i/(len-1)*100) }));
      angle = p.angle; angleEl.value = angle; angleVal.textContent = angle + '°';
      renderStops(); update();
    });
    presetsGrid.appendChild(swatch);
  });
}

// Type buttons
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gradType = btn.dataset.type;
    document.getElementById('angle-group').style.opacity = gradType === 'radial' ? '0.4' : '1';
    update();
  });
});

// Angle
angleEl.addEventListener('input', () => {
  angle = parseInt(angleEl.value);
  angleVal.textContent = angle + '°';
  update();
});

// Add stop
document.getElementById('btn-add-stop').addEventListener('click', () => {
  stops.push({ color: '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0'), pos: 50 });
  renderStops(); update();
});

// Output format tabs
document.querySelectorAll('.out-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.out-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    outputFmt = tab.dataset.fmt;
    update();
  });
});

// Copy
document.getElementById('btn-copy').addEventListener('click', function() {
  navigator.clipboard.writeText(cssOutput.textContent).then(() => {
    this.textContent = '✓'; this.classList.add('copied');
    setTimeout(() => { this.textContent = 'コピー'; this.classList.remove('copied'); }, 1500);
  });
});

// Init
chrome.storage.local.get(['gradStops','gradAngle','gradType'], (data) => {
  if (data.gradStops) stops = data.gradStops;
  if (data.gradAngle) { angle = data.gradAngle; angleEl.value = angle; angleVal.textContent = angle + '°'; }
  if (data.gradType)  { gradType = data.gradType; document.querySelector(`[data-type="${gradType}"]`)?.classList.add('active'); }
  buildPresets();
  renderStops();
  update();
});
