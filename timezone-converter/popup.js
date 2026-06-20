const POPULAR_TZ = [
  { id: 'Asia/Tokyo',             name: '東京 🇯🇵' },
  { id: 'Asia/Seoul',             name: 'ソウル 🇰🇷' },
  { id: 'Asia/Shanghai',          name: '上海 🇨🇳' },
  { id: 'Asia/Singapore',         name: 'シンガポール 🇸🇬' },
  { id: 'Asia/Kolkata',           name: 'ムンバイ 🇮🇳' },
  { id: 'Asia/Dubai',             name: 'ドバイ 🇦🇪' },
  { id: 'Europe/London',          name: 'ロンドン 🇬🇧' },
  { id: 'Europe/Paris',           name: 'パリ 🇫🇷' },
  { id: 'Europe/Berlin',          name: 'ベルリン 🇩🇪' },
  { id: 'Europe/Moscow',          name: 'モスクワ 🇷🇺' },
  { id: 'America/New_York',       name: 'ニューヨーク 🇺🇸' },
  { id: 'America/Chicago',        name: 'シカゴ 🇺🇸' },
  { id: 'America/Los_Angeles',    name: 'ロサンゼルス 🇺🇸' },
  { id: 'America/Toronto',        name: 'トロント 🇨🇦' },
  { id: 'America/Sao_Paulo',      name: 'サンパウロ 🇧🇷' },
  { id: 'Australia/Sydney',       name: 'シドニー 🇦🇺' },
  { id: 'Pacific/Auckland',       name: 'オークランド 🇳🇿' },
  { id: 'Pacific/Honolulu',       name: 'ホノルル 🇺🇸' },
  { id: 'UTC',                    name: 'UTC' },
  { id: 'Africa/Cairo',           name: 'カイロ 🇪🇬' },
  { id: 'Africa/Johannesburg',    name: 'ヨハネスブルク 🇿🇦' },
  { id: 'Asia/Bangkok',           name: 'バンコク 🇹🇭' },
  { id: 'Asia/Jakarta',           name: 'ジャカルタ 🇮🇩' },
  { id: 'Asia/Hong_Kong',         name: '香港 🇭🇰' },
  { id: 'Asia/Taipei',            name: '台北 🇹🇼' },
];

const srcTzSel  = document.getElementById('src-tz');
const addTzSel  = document.getElementById('add-tz');
const srcDate   = document.getElementById('src-date');
const srcTime   = document.getElementById('src-time');
const resultsEl = document.getElementById('results');

let targetZones = [];

// ── Populate selects ──────────────────────────────────
function populateSelect(sel, selectedId) {
  sel.innerHTML = '';
  POPULAR_TZ.forEach(tz => {
    const opt = document.createElement('option');
    opt.value = tz.id;
    opt.textContent = tz.name;
    if (tz.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

populateSelect(srcTzSel, 'Asia/Tokyo');
populateSelect(addTzSel, 'America/New_York');

// ── Helpers ───────────────────────────────────────────
function getSourceDate() {
  const d = srcDate.value, t = srcTime.value;
  if (!d || !t) return null;
  return new Date(`${d}T${t}:00`);
}

function offsetLabel(tzId, refDate) {
  try {
    const utcMs = refDate.getTime();
    const srcOff = getOffset(srcTzSel.value, refDate);
    const tgtOff = getOffset(tzId, refDate);
    const diffH = (tgtOff - srcOff) / 60;
    const sign = diffH >= 0 ? '+' : '';
    return `${sign}${diffH}h`;
  } catch { return ''; }
}

function getOffset(tzId, date) {
  const parts = Intl.DateTimeFormat('en', { timeZone: tzId, timeZoneName: 'shortOffset' })
    .formatToParts(date);
  const off = parts.find(p => p.type === 'timeZoneName')?.value || 'UTC+0';
  const m = off.match(/([+-])(\d+):?(\d*)/);
  if (!m) return 0;
  return (parseInt(m[2]) * 60 + parseInt(m[3] || 0)) * (m[1] === '+' ? 1 : -1);
}

function formatInTz(tzId, date) {
  return {
    time: date.toLocaleTimeString('ja-JP', { timeZone: tzId, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: date.toLocaleDateString('ja-JP', { timeZone: tzId, month: 'numeric', day: 'numeric', weekday: 'short' }),
    dateObj: new Date(date.toLocaleString('en-US', { timeZone: tzId })),
  };
}

function dayDiff(tzId, date) {
  const srcFormatted = new Date(date.toLocaleString('en-US', { timeZone: srcTzSel.value }));
  const tgtFormatted = new Date(date.toLocaleString('en-US', { timeZone: tzId }));
  return Math.round((tgtFormatted - srcFormatted) / 86400000);
}

// ── Render ────────────────────────────────────────────
function render() {
  const date = getSourceDate();
  if (!date) return;

  resultsEl.innerHTML = '';
  targetZones.forEach((tzId, i) => {
    const tz = POPULAR_TZ.find(t => t.id === tzId) || { name: tzId };
    const { time, date: dateStr, dateObj } = formatInTz(tzId, date);
    const diff = dayDiff(tzId, date);
    const off = offsetLabel(tzId, date);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    const row = document.createElement('div');
    row.className = 'tz-row';

    const diffLabel = diff > 0 ? `<span class="next-day">+${diff}日</span>`
                    : diff < 0 ? `<span class="prev-day">${diff}日</span>` : '';

    row.innerHTML = `
      <div class="tz-info">
        <div class="tz-name">${tz.name}</div>
        <div class="tz-id">${tzId}</div>
        <div class="tz-offset">${off}</div>
      </div>
      <div style="text-align:right">
        <div class="tz-time ${isWeekend ? 'weekend' : ''}">${time}</div>
        <div class="tz-date">${dateStr} ${diffLabel}</div>
      </div>
      <button class="del-btn" data-idx="${i}">×</button>
    `;
    row.querySelector('.del-btn').addEventListener('click', () => {
      targetZones.splice(i, 1);
      saveAndRender();
    });
    resultsEl.appendChild(row);
  });

  renderOverlap(date);
}

// ── Meeting overlap finder ────────────────────────────
function renderOverlap(date) {
  const disp = document.getElementById('overlap-display');
  if (targetZones.length === 0) {
    disp.innerHTML = '<div class="no-overlap">タイムゾーンを追加してください</div>';
    return;
  }

  const allZones = [srcTzSel.value, ...targetZones];
  const slots = [];

  for (let h = 0; h < 24; h++) {
    const testDate = new Date(date);
    testDate.setHours(h, 0, 0, 0);

    const allInBusiness = allZones.every(tzId => {
      const localH = new Date(testDate.toLocaleString('en-US', { timeZone: tzId })).getHours();
      return localH >= 9 && localH < 18;
    });

    if (allInBusiness) slots.push(h);
  }

  if (!slots.length) {
    disp.innerHTML = '<div class="no-overlap">重複する業務時間帯がありません</div>';
    return;
  }

  disp.innerHTML = '<div class="overlap-slots" id="overlap-slots"></div>';
  const slotsEl = disp.querySelector('#overlap-slots');
  slots.forEach(h => {
    const btn = document.createElement('button');
    btn.className = 'overlap-slot';
    btn.textContent = `${String(h).padStart(2,'0')}:00`;
    btn.title = '時刻をソースにセット';
    btn.addEventListener('click', () => {
      srcTime.value = `${String(h).padStart(2,'0')}:00`;
      render();
    });
    slotsEl.appendChild(btn);
  });
}

function saveAndRender() {
  chrome.storage.local.set({ tzTargets: targetZones, tzSrc: srcTzSel.value });
  render();
}

// ── Events ────────────────────────────────────────────
document.getElementById('btn-now').addEventListener('click', () => {
  const now = new Date();
  srcDate.value = now.toISOString().split('T')[0];
  srcTime.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  render();
});

document.getElementById('btn-add-tz').addEventListener('click', () => {
  const tz = addTzSel.value;
  if (!targetZones.includes(tz)) {
    targetZones.push(tz);
    saveAndRender();
  }
});

srcDate.addEventListener('change', render);
srcTime.addEventListener('change', render);
srcTzSel.addEventListener('change', render);

// ── Init ─────────────────────────────────────────────
const now = new Date();
srcDate.value = now.toISOString().split('T')[0];
srcTime.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

chrome.storage.local.get(['tzTargets','tzSrc'], (data) => {
  if (data.tzSrc) { srcTzSel.value = data.tzSrc; }
  targetZones = data.tzTargets || ['America/New_York','Europe/London','Australia/Sydney'];
  render();
});
