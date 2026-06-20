const LIMITS = [
  { name: 'Twitter/X',    max: 280 },
  { name: 'Instagram',    max: 2200 },
  { name: 'LinkedIn',     max: 3000 },
  { name: 'YouTube説明',  max: 5000 },
  { name: 'SMS',          max: 160 },
  { name: 'メタdesc',     max: 160 },
];

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','shall','can',
  'this','that','these','those','i','you','he','she','it','we','they',
  'me','him','her','us','them','my','your','his','its','our','their',
  'が','の','は','を','に','へ','と','から','まで','で','も','や','か',
  'より','こと','もの','ため','よう','それ','これ','あれ','その','この','あの',
]);

const textarea  = document.getElementById('text-input');
const limitsGrid = document.getElementById('limits-grid');
const topWords  = document.getElementById('top-words');

function fmtTime(words, wpm) {
  const secs = Math.round(words / wpm * 60);
  if (secs < 60) return secs + '秒';
  const m = Math.floor(secs / 60), s = secs % 60;
  return s > 0 ? `${m}分${s}秒` : `${m}分`;
}

function analyze(text) {
  const chars        = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const lines        = text === '' ? 0 : text.split('\n').length;
  const paragraphs   = text.split(/\n\s*\n/).filter(p => p.trim()).length;
  const sentences    = (text.match(/[^.!?。！？]*[.!?。！？]+/g) || []).length || (text.trim() ? 1 : 0);

  // Word count: split on whitespace + Japanese word boundary (rough)
  const wordList = text.trim() === '' ? [] :
    text.trim().split(/[\s　​]+/).filter(w => w.length > 0);
  const words = wordList.length;

  // Top words (skip stop words, short words)
  const freq = {};
  wordList.forEach(w => {
    const clean = w.toLowerCase().replace(/[^\w぀-ヿ一-鿿]/g, '');
    if (clean.length >= 2 && !STOP_WORDS.has(clean)) {
      freq[clean] = (freq[clean] || 0) + 1;
    }
  });
  const topList = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, 8);

  return { chars, charsNoSpace, words, lines, sentences, paragraphs, topList };
}

function updateLimits(chars) {
  limitsGrid.innerHTML = '';
  LIMITS.forEach(({ name, max }) => {
    const pct = Math.min(100, chars / max * 100);
    const over = chars > max;
    const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#34d399';

    const row = document.createElement('div');
    row.className = 'limit-row';
    row.innerHTML = `
      <span class="limit-name">${name}</span>
      <div class="limit-bar"><div class="limit-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="limit-count${over ? ' over' : ''}">${chars}/${max}</span>
    `;
    limitsGrid.appendChild(row);
  });
}

function updateTopWords(topList) {
  topWords.innerHTML = '';
  if (!topList.length) {
    topWords.innerHTML = '<span style="color:#374151;font-size:12px">テキストを入力...</span>';
    return;
  }
  topList.forEach(([word, count]) => {
    const chip = document.createElement('div');
    chip.className = 'word-chip';
    chip.innerHTML = `${word} <span class="wc">${count}</span>`;
    topWords.appendChild(chip);
  });
}

function update() {
  const text = textarea.value;
  const { chars, charsNoSpace, words, lines, sentences, paragraphs, topList } = analyze(text);

  document.getElementById('chars').textContent        = chars.toLocaleString();
  document.getElementById('chars-nospace').textContent= charsNoSpace.toLocaleString();
  document.getElementById('words').textContent        = words.toLocaleString();
  document.getElementById('sentences').textContent    = sentences.toLocaleString();
  document.getElementById('lines').textContent        = lines.toLocaleString();
  document.getElementById('paragraphs').textContent   = paragraphs.toLocaleString();
  document.getElementById('reading-time').textContent = fmtTime(words || charsNoSpace / 5, 250);
  document.getElementById('speaking-time').textContent= fmtTime(words || charsNoSpace / 5, 130);

  updateLimits(chars);
  updateTopWords(topList);

  chrome.storage.local.set({ wcText: text });
}

textarea.addEventListener('input', update);

document.getElementById('btn-clear').addEventListener('click', () => {
  textarea.value = '';
  update();
  textarea.focus();
});

// Restore
chrome.storage.local.get(['wcText'], (data) => {
  if (data.wcText) textarea.value = data.wcText;
  update();
});

update();
