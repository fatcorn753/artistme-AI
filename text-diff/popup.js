const textA   = document.getElementById('text-a');
const textB   = document.getElementById('text-b');
const output  = document.getElementById('diff-output');
const content = document.getElementById('diff-content');
const statsBar= document.getElementById('stats-bar');

// ── Myers Diff Algorithm ──────────────────────────────────
function myersDiff(a, b) {
  const n = a.length, m = b.length;
  const max = n + m;
  const v = new Array(2 * max + 1).fill(0);
  const trace = [];

  for (let d = 0; d <= max; d++) {
    trace.push([...v]);
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max];
      } else {
        x = v[k - 1 + max] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[k + max] = x;
      if (x >= n && y >= m) {
        return backtrack(trace, a, b, max, d);
      }
    }
  }
  return [];
}

function backtrack(trace, a, b, max, d) {
  const result = [];
  let x = a.length, y = b.length;

  for (let dv = d; dv >= 0; dv--) {
    const v = trace[dv];
    const k = x - y;
    let prevK;
    if (k === -dv || (k !== dv && v[k - 1 + max] < v[k + 1 + max])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = v[prevK + max];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) { result.unshift(['=', a[x-1]]); x--; y--; }
    if (dv > 0) {
      if (x === prevX) { result.unshift(['+', b[prevY]]); }
      else             { result.unshift(['-', a[prevX]]); }
    }
    x = prevX; y = prevY;
  }
  return result;
}

// ── Inline word/char diff ─────────────────────────────────
function inlineDiff(lineA, lineB, wordMode) {
  const tokenize = (s) => wordMode
    ? (s.match(/\S+|\s+/g) || [])
    : s.split('');

  const tokA = tokenize(lineA);
  const tokB = tokenize(lineB);
  const ops  = myersDiff(tokA, tokB);

  let htmlA = '', htmlB = '';
  for (const [op, tok] of ops) {
    const esc = escHtml(tok);
    if (op === '=') { htmlA += esc; htmlB += esc; }
    else if (op === '-') { htmlA += `<span class="del">${esc}</span>`; }
    else if (op === '+') { htmlB += `<span class="ins">${esc}</span>`; }
  }
  return { a: htmlA, b: htmlB };
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Main diff ─────────────────────────────────────────────
function computeDiff() {
  let a = textA.value;
  let b = textB.value;

  const ignoreCase  = document.getElementById('ignore-case').checked;
  const ignoreSpace = document.getElementById('ignore-space').checked;
  const wordMode    = document.getElementById('word-diff').checked;

  if (!a && !b) { output.classList.add('hidden'); statsBar.classList.add('hidden'); return; }

  let ca = a, cb = b;
  if (ignoreCase)  { ca = ca.toLowerCase(); cb = cb.toLowerCase(); }
  if (ignoreSpace) { ca = ca.replace(/[ \t]+/g,' ').trim(); cb = cb.replace(/[ \t]+/g,' ').trim(); }

  const linesA = ca.split('\n');
  const linesB = cb.split('\n');
  const rawA   = a.split('\n');
  const rawB   = b.split('\n');

  const ops = myersDiff(linesA, linesB);

  let added = 0, deleted = 0, same = 0;
  let aiA = 0, aiB = 0;
  const htmlLines = [];

  for (const [op] of ops) {
    if (op === '=') { same++; }
    else if (op === '+') { added++; }
    else { deleted++; }
  }

  // Build unified diff view
  const CONTEXT = 3;
  const opList = [];
  let ai = 0, bi = 0;
  for (const [op, _] of ops) {
    if (op === '=')  { opList.push({ op, a: rawA[ai++], b: rawB[bi++], la: ai, lb: bi }); }
    else if (op === '-') { opList.push({ op, a: rawA[ai++], b: null, la: ai, lb: bi }); }
    else { opList.push({ op, a: null, b: rawB[bi++], la: ai, lb: bi }); }
  }

  // Show context around changes
  const show = new Set();
  opList.forEach((item, i) => {
    if (item.op !== '=') {
      for (let j = Math.max(0, i - CONTEXT); j <= Math.min(opList.length-1, i + CONTEXT); j++) {
        show.add(j);
      }
    }
  });

  let lastShown = -1;
  for (let i = 0; i < opList.length; i++) {
    if (!show.has(i)) continue;
    if (lastShown !== -1 && i > lastShown + 1) {
      htmlLines.push(`<div class="diff-line heading"><span class="line-text">@@ ... @@</span></div>`);
    }
    lastShown = i;
    const { op, a: la, b: lb, la: na, lb: nb } = opList[i];

    if (op === '=') {
      htmlLines.push(`<div class="diff-line same"><span class="line-no">${na}</span><span class="line-sign"> </span><span class="line-text">${escHtml(la??'')}</span></div>`);
    } else if (op === '-') {
      // Find matching + nearby for inline
      let lineHtml = escHtml(la??'');
      const nextItem = opList[i+1];
      if (nextItem?.op === '+' && la !== null && nextItem.b !== null) {
        const inline = inlineDiff(la, nextItem.b, wordMode);
        lineHtml = inline.a;
      }
      htmlLines.push(`<div class="diff-line deleted"><span class="line-no">${na}</span><span class="line-sign">-</span><span class="line-text">${lineHtml}</span></div>`);
    } else {
      let lineHtml = escHtml(lb??'');
      const prevItem = opList[i-1];
      if (prevItem?.op === '-' && lb !== null && prevItem.a !== null) {
        const inline = inlineDiff(prevItem.a, lb, wordMode);
        lineHtml = inline.b;
      }
      htmlLines.push(`<div class="diff-line added"><span class="line-no">${nb}</span><span class="line-sign">+</span><span class="line-text">${lineHtml}</span></div>`);
    }
  }

  content.innerHTML = htmlLines.join('');
  output.classList.remove('hidden');

  document.getElementById('stat-add').textContent  = `+${added}`;
  document.getElementById('stat-del').textContent  = `-${deleted}`;
  document.getElementById('stat-same').textContent = `±${same}`;
  const total = added + deleted + same;
  const similarity = total > 0 ? Math.round(same / total * 100) : 100;
  document.getElementById('stat-pct').textContent  = `一致率 ${similarity}%`;
  statsBar.classList.remove('hidden');
}

let debounceTimer = null;
function debounce() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(computeDiff, 200);
}

[textA, textB].forEach(el => el.addEventListener('input', debounce));
['word-diff','ignore-case','ignore-space'].forEach(id =>
  document.getElementById(id).addEventListener('change', computeDiff));

document.getElementById('btn-swap').addEventListener('click', () => {
  [textA.value, textB.value] = [textB.value, textA.value];
  computeDiff();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  textA.value = ''; textB.value = '';
  content.innerHTML = '';
  output.classList.add('hidden');
  statsBar.classList.add('hidden');
});
