// ── Word pools ────────────────────────────────────────
const LOREM_WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');

const JP_WORDS = '吾輩は猫である名前はまだないどこで生れたかとんと見当がつかぬ何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶しているこんな具合に感じたのかも知れない知識とは人生の幅を広げるものであると私は考えます新しい技術は日々進歩しており私たちの生活をより豊かにしてくれます社会の変化に柔軟に対応することが重要です人々は互いに助け合いながら社会を形成しています未来への投資として教育は欠かせない要素です創造性と論理的思考を組み合わせることで新しいアイデアが生まれます持続可能な社会の実現に向けて私たちは行動する必要があります'.split('');

const HTML_TAGS = ['<p>', '<h2>', '<ul>', '<blockquote>'];

let type = 'lorem';
let unit = 'paragraphs';
let count = 3;

const outputEl   = document.getElementById('output');
const countEl    = document.getElementById('count-display');
const charCountEl= document.getElementById('char-count');

// ── Generators ────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function loreSentence(wordCount = null) {
  const len = wordCount || (6 + Math.floor(Math.random() * 12));
  return LOREM_WORDS.slice(0, len)
    .map((w,i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ') + '.';
}

function loreParagraph(sentenceCount = null) {
  const n = sentenceCount || (3 + Math.floor(Math.random() * 4));
  return Array.from({ length: n }, (_, i) => {
    // Shuffle words for variety on non-first
    const words = i === 0 ? [...LOREM_WORDS] : [...LOREM_WORDS].sort(() => Math.random() - 0.5);
    const len = 6 + Math.floor(Math.random() * 12);
    return words.slice(0, len)
      .map((w, j) => j === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
      .join(' ') + '.';
  }).join(' ');
}

function jpSentence() {
  const len = 20 + Math.floor(Math.random() * 40);
  return JP_WORDS.sort(() => Math.random() - 0.5).slice(0, len).join('') + '。';
}

function jpParagraph() {
  return Array.from({ length: 2 + Math.floor(Math.random() * 3) }, jpSentence).join('');
}

function generate() {
  const startLorem = document.getElementById('start-lorem').checked;
  const addH1      = document.getElementById('add-h1').checked;
  const isHtml     = type === 'html';
  const isJp       = type === 'jp';

  let result = '';

  if (addH1) {
    const title = isJp ? 'ダミーテキストのサンプルタイトル' : 'Lorem Ipsum Title';
    result += isHtml ? `<h1>${title}</h1>\n\n` : `${title}\n\n`;
  }

  if (unit === 'paragraphs') {
    const paras = Array.from({ length: count }, (_, i) => {
      if (isJp) return jpParagraph();
      const para = i === 0 && startLorem
        ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' + loreParagraph(2)
        : loreParagraph();
      return para;
    });
    if (isHtml) {
      result += paras.map(p => `<p>${p}</p>`).join('\n');
    } else {
      result += paras.join('\n\n');
    }
  } else if (unit === 'sentences') {
    const sentences = Array.from({ length: count }, (_, i) => {
      if (isJp) return jpSentence();
      return i === 0 && startLorem
        ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
        : loreSentence();
    });
    result += isHtml
      ? `<p>${sentences.join(' ')}</p>`
      : sentences.join(' ');
  } else if (unit === 'words') {
    const words = isJp
      ? JP_WORDS.slice(0, count).join('')
      : LOREM_WORDS.slice(0, count).join(' ');
    const text = startLorem && !isJp
      ? 'Lorem ipsum ' + words.replace(/^lorem ipsum /, '')
      : words;
    result += isHtml ? `<p>${text}</p>` : text;
  } else if (unit === 'chars') {
    const pool = isJp ? JP_WORDS.join('') : LOREM_WORDS.join(' ');
    let text = '';
    while (text.length < count) text += pool;
    text = text.slice(0, count);
    if (startLorem && !isJp) text = ('Lorem ipsum ' + text).slice(0, count);
    result += isHtml ? `<p>${text}</p>` : text;
  }

  // For HTML type with multiple paragraphs, add some variety
  if (isHtml && unit === 'paragraphs' && count >= 3) {
    const lines = result.split('\n');
    // Replace one paragraph with a list and one with a blockquote for variety
    if (lines.length >= 3) {
      const listItems = Array.from({length:3}, () => `<li>${loreSentence()}</li>`).join('');
      lines.splice(1, 0, `<ul>${listItems}</ul>`);
    }
    result = lines.join('\n');
  }

  // Render
  outputEl.innerHTML = isHtml ? `<pre style="white-space:pre-wrap;font-family:monospace;font-size:11px">${escHtml(result)}</pre>` : '';
  if (!isHtml) {
    if (addH1) {
      const [h1, ...rest] = result.split('\n\n');
      outputEl.innerHTML = `<h1>${escHtml(h1)}</h1>` + rest.map(p => `<p>${escHtml(p)}</p>`).join('');
    } else {
      outputEl.innerHTML = result.split('\n\n').map(p => `<p>${escHtml(p)}</p>`).join('');
    }
  }

  charCountEl.textContent = `${result.replace(/\s+/g,' ').trim().length}文字 / ${result.split(/\s+/).filter(Boolean).length}語`;
  outputEl.dataset.raw = result;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Controls ──────────────────────────────────────────
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    type = btn.dataset.type;
    generate();
  });
});

document.querySelectorAll('.unit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    unit = btn.dataset.unit;
    const slider = document.getElementById('count-slider');
    // Adjust range based on unit
    const ranges = { paragraphs:[1,10], sentences:[1,20], words:[5,200], chars:[50,2000] };
    const [min,max] = ranges[unit];
    const defaults  = { paragraphs:3, sentences:5, words:50, chars:300 };
    slider.min = min; slider.max = max;
    slider.value = defaults[unit];
    count = defaults[unit];
    countEl.textContent = count;
    generate();
  });
});

document.getElementById('count-slider').addEventListener('input', (e) => {
  count = parseInt(e.target.value);
  countEl.textContent = count;
  generate();
});

['start-lorem','add-h1'].forEach(id => {
  document.getElementById(id).addEventListener('change', generate);
});

document.getElementById('btn-refresh').addEventListener('click', function() {
  this.classList.add('spinning');
  setTimeout(() => this.classList.remove('spinning'), 400);
  generate();
});

document.getElementById('btn-copy').addEventListener('click', function() {
  const text = outputEl.dataset.raw || outputEl.textContent;
  navigator.clipboard.writeText(text).then(() => {
    this.textContent = '✓ コピー済み'; this.classList.add('copied');
    setTimeout(() => { this.textContent = 'コピー'; this.classList.remove('copied'); }, 1500);
  });
});

generate();
