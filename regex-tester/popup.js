const COMMON_PATTERNS = [
  { label: 'メール', pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}' },
  { label: 'URL', pattern: 'https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+[/#?]?\\S*' },
  { label: '電話番号', pattern: '0\\d{1,4}-\\d{1,4}-\\d{4}' },
  { label: '郵便番号', pattern: '\\d{3}-?\\d{4}' },
  { label: 'IPアドレス', pattern: '(?:\\d{1,3}\\.){3}\\d{1,3}' },
  { label: '日付(YYYY-MM-DD)', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])' },
  { label: '16進カラー', pattern: '#[0-9a-fA-F]{3,6}' },
  { label: '数字のみ', pattern: '^\\d+$' },
  { label: '英数字', pattern: '^[a-zA-Z0-9]+$' },
  { label: '空白行', pattern: '^\\s*$' },
  { label: 'HTMLタグ', pattern: '<[^>]+>' },
  { label: 'JSON文字列値', pattern: '"[^"]*":\\s*"[^"]*"' },
];

const patternInput = document.getElementById('pattern');
const flagsInput   = document.getElementById('flags');
const testInput    = document.getElementById('test-string');
const errorEl      = document.getElementById('regex-error');
const matchCount   = document.getElementById('match-count');
const highlightOut = document.getElementById('highlight-output');
const groupsSection= document.getElementById('groups-section');
const groupsList   = document.getElementById('groups-list');
const patternsGrid = document.getElementById('patterns-grid');

// Build preset chips
COMMON_PATTERNS.forEach(({ label, pattern }) => {
  const chip = document.createElement('button');
  chip.className = 'pattern-chip';
  chip.textContent = label;
  chip.title = pattern;
  chip.addEventListener('click', () => {
    patternInput.value = pattern;
    if (!flagsInput.value.includes('g')) flagsInput.value = 'g';
    update();
  });
  patternsGrid.appendChild(chip);
});

// Flag toggle buttons
document.querySelectorAll('.flag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const f = btn.dataset.flag;
    btn.classList.toggle('active');
    let flags = '';
    document.querySelectorAll('.flag-btn.active').forEach(b => flags += b.dataset.flag);
    flagsInput.value = flags;
    update();
  });
});

flagsInput.addEventListener('input', () => {
  const flags = flagsInput.value;
  document.querySelectorAll('.flag-btn').forEach(btn => {
    btn.classList.toggle('active', flags.includes(btn.dataset.flag));
  });
  update();
});

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function update() {
  const pat = patternInput.value;
  const flags = flagsInput.value;
  const text = testInput.value;

  if (!pat) {
    errorEl.textContent = '';
    highlightOut.textContent = text || '';
    matchCount.textContent = 'マッチなし';
    matchCount.classList.remove('has-matches');
    groupsSection.classList.add('hidden');
    return;
  }

  let re;
  try {
    re = new RegExp(pat, flags.includes('g') ? flags : flags + 'g');
    errorEl.textContent = '';
  } catch (e) {
    errorEl.textContent = '❌ ' + e.message;
    highlightOut.textContent = text;
    matchCount.textContent = 'エラー';
    matchCount.classList.remove('has-matches');
    return;
  }

  const matches = [...text.matchAll(re)];
  const count = matches.length;

  if (count === 0) {
    matchCount.textContent = 'マッチなし';
    matchCount.classList.remove('has-matches');
    highlightOut.textContent = text;
    groupsSection.classList.add('hidden');
    return;
  }

  matchCount.textContent = `${count} マッチ`;
  matchCount.classList.add('has-matches');

  // Build highlighted output
  let result = '';
  let lastIndex = 0;
  matches.forEach((m, i) => {
    result += escHtml(text.slice(lastIndex, m.index));
    result += `<mark class="${i % 2 === 1 ? 'alt' : ''}">${escHtml(m[0])}</mark>`;
    lastIndex = m.index + m[0].length;
  });
  result += escHtml(text.slice(lastIndex));
  highlightOut.innerHTML = result;

  // Capture groups
  const hasGroups = matches[0] && matches[0].length > 1;
  if (hasGroups) {
    groupsSection.classList.remove('hidden');
    groupsList.innerHTML = '';
    matches.slice(0, 8).forEach((m, mi) => {
      m.slice(1).forEach((g, gi) => {
        const div = document.createElement('div');
        div.className = 'group-item';
        div.innerHTML = `<span class="group-label">M${mi+1} G${gi+1}</span><span class="group-value">${escHtml(g ?? '(undefined)')}</span>`;
        groupsList.appendChild(div);
      });
    });
  } else {
    groupsSection.classList.add('hidden');
  }

  // Persist
  chrome.storage.local.set({ lastPattern: pat, lastFlags: flags, lastText: text });
}

patternInput.addEventListener('input', update);
flagsInput.addEventListener('input', update);
testInput.addEventListener('input', update);

// Restore last state
chrome.storage.local.get(['lastPattern','lastFlags','lastText'], (data) => {
  if (data.lastPattern) patternInput.value = data.lastPattern;
  if (data.lastFlags) {
    flagsInput.value = data.lastFlags;
    document.querySelectorAll('.flag-btn').forEach(btn => {
      btn.classList.toggle('active', (data.lastFlags||'').includes(btn.dataset.flag));
    });
  }
  if (data.lastText) testInput.value = data.lastText;
  update();
});
