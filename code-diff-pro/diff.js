// ── Myers diff ────────────────────────────────────────
function myersDiff(a, b) {
  const n=a.length, m=b.length, max=n+m;
  const v=new Array(2*max+1).fill(0); const trace=[];
  for(let d=0;d<=max;d++){
    trace.push([...v]);
    for(let k=-d;k<=d;k+=2){
      let x = k===-d||(k!==d&&v[k-1+max]<v[k+1+max]) ? v[k+1+max] : v[k-1+max]+1;
      let y=x-k;
      while(x<n&&y<m&&a[x]===b[y]){x++;y++;}
      v[k+max]=x;
      if(x>=n&&y>=m) return backtrack(trace,a,b,max,d);
    }
  }
  return [];
}

function backtrack(trace,a,b,max,d){
  const result=[]; let x=a.length,y=b.length;
  for(let dv=d;dv>=0;dv--){
    const v=trace[dv]; const k=x-y;
    const prevK=(k===-dv||(k!==dv&&v[k-1+max]<v[k+1+max]))?k+1:k-1;
    const prevX=v[prevK+max]; const prevY=prevX-prevK;
    while(x>prevX&&y>prevY){result.unshift(['=',a[x-1],b[y-1]]);x--;y--;}
    if(dv>0){
      if(x===prevX) result.unshift(['+',null,b[prevY]]);
      else result.unshift(['-',a[prevX],null]);
    }
    x=prevX; y=prevY;
  }
  return result;
}

// ── Syntax highlight ──────────────────────────────────
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function highlight(code, lang) {
  let h = esc(code);
  if (lang==='json') {
    h = h.replace(/"([^"]+)":/g,'<span style="color:#79c0ff">"$1"</span>:')
         .replace(/: "([^"]*)"/g,': <span style="color:#a5d6ff">"$1"</span>')
         .replace(/: (\d+\.?\d*)/g,': <span style="color:#79c0ff">$1</span>')
         .replace(/: (true|false|null)/g,': <span style="color:#ff7b72">$1</span>');
  } else if (lang==='js'||lang==='py') {
    const kws = lang==='js'
      ? ['const','let','var','function','return','if','else','for','while','class','import','export','async','await','new','typeof','=>']
      : ['def','return','if','elif','else','for','while','class','import','from','as','and','or','not','in','True','False','None','lambda','yield'];
    kws.forEach(kw => { h=h.replace(new RegExp(`\\b${kw}\\b`,'g'),`<span style="color:#ff7b72">${kw}</span>`); });
    h = h.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g,'<span style="color:#a5d6ff">$1</span>');
    h = h.replace(/(\/\/[^\n]*|#[^\n]*)/g,'<span style="color:#6e7681;font-style:italic">$1</span>');
    h = h.replace(/\b(\d+\.?\d*)\b/g,'<span style="color:#79c0ff">$1</span>');
  } else if (lang==='css') {
    h = h.replace(/([a-z-]+):/g,'<span style="color:#ffa657">$1</span>:');
    h = h.replace(/#[0-9a-fA-F]{3,6}/g,m=>`<span style="color:${esc(m)}">${esc(m)}</span>`);
  } else if (lang==='html') {
    h = h.replace(/&lt;(\/?[\w]+)/g,'&lt;<span style="color:#7ee787">$1</span>');
    h = h.replace(/(\w+)=/g,'<span style="color:#ffa657">$1</span>=');
  }
  return h;
}

// ── Inline char diff ──────────────────────────────────
function inlineDiff(lineA, lineB) {
  const ops = myersDiff([...lineA],[...lineB]);
  let htmlA='', htmlB='';
  ops.forEach(([op,a,b])=>{
    if(op==='='){htmlA+=esc(a);htmlB+=esc(b);}
    else if(op==='-')htmlA+=`<span class="hl-del">${esc(a)}</span>`;
    else htmlB+=`<span class="hl-add">${esc(b)}</span>`;
  });
  return {a:htmlA,b:htmlB};
}

// ── Main diff ─────────────────────────────────────────
function computeDiff() {
  const lang = document.getElementById('lang-sel').value;
  const mode = document.getElementById('view-mode').value;
  const ignWs = document.getElementById('ignore-ws').checked;
  const ignCa = document.getElementById('ignore-case').checked;

  let textA = document.getElementById('code-a').value;
  let textB = document.getElementById('code-b').value;

  if (!textA && !textB) { document.getElementById('diff-output').innerHTML='<div class="empty-msg">コードを入力して「差分を表示」をクリック</div>'; return; }

  let linesA = textA.split('\n'), linesB = textB.split('\n');
  let compA = linesA.map(l=>{let x=l;if(ignWs)x=x.replace(/\s+/g,' ').trim();if(ignCa)x=x.toLowerCase();return x;});
  let compB = linesB.map(l=>{let x=l;if(ignWs)x=x.replace(/\s+/g,' ').trim();if(ignCa)x=x.toLowerCase();return x;});

  const ops = myersDiff(compA, compB);

  let added=0, deleted=0, same=0;
  let ai=0, bi=0;
  const lineOps = [];
  ops.forEach(([op])=>{
    if(op==='='){lineOps.push({op:'=',a:linesA[ai],b:linesB[bi],la:ai+1,lb:bi+1});ai++;bi++;same++;}
    else if(op==='-'){lineOps.push({op:'-',a:linesA[ai],b:null,la:ai+1,lb:bi});ai++;deleted++;}
    else{lineOps.push({op:'+',a:null,b:linesB[bi],la:ai,lb:bi+1});bi++;added++;}
  });

  document.getElementById('diff-stats').innerHTML =
    `<span class="stat-add">+${added}</span> / <span class="stat-del">-${deleted}</span> / <span>${same}行同一</span>`;

  const output = document.getElementById('diff-output');

  if (mode === 'unified') {
    renderUnified(lineOps, lang, output);
  } else {
    renderSplit(lineOps, lang, output);
  }

  // Store for patch export
  window._patchData = generatePatch(lineOps);
}

function renderSplit(lineOps, lang, output) {
  const CTX = 3;
  const show = new Set();
  lineOps.forEach((lo,i)=>{ if(lo.op!=='=') for(let j=Math.max(0,i-CTX);j<=Math.min(lineOps.length-1,i+CTX);j++) show.add(j); });

  let leftHtml='', rightHtml='';
  let lastShown=-1;
  lineOps.forEach((lo,i)=>{
    if(!show.has(i)) return;
    if(lastShown!==-1&&i>lastShown+1){
      leftHtml+=`<div class="sep-line">@@ ... @@</div>`;
      rightHtml+=`<div class="sep-line">@@ ... @@</div>`;
    }
    lastShown=i;

    const hl_a = lo.a!=null ? highlight(lo.a,lang) : '';
    const hl_b = lo.b!=null ? highlight(lo.b,lang) : '';

    if(lo.op==='='){
      leftHtml +=`<div class="split-line"><span class="split-lnum">${lo.la}</span><span class="split-code">${hl_a}</span></div>`;
      rightHtml+=`<div class="split-line"><span class="split-lnum">${lo.lb}</span><span class="split-code">${hl_b}</span></div>`;
    } else if(lo.op==='-'){
      // Check next for inline
      const next = lineOps[i+1];
      let codeHtml = hl_a;
      if(next?.op==='+'&&lo.a!=null&&next.b!=null){const il=inlineDiff(lo.a,next.b);codeHtml=il.a;}
      leftHtml +=`<div class="split-line line-del"><span class="split-lnum">${lo.la}</span><span class="split-code">${codeHtml}</span></div>`;
      rightHtml+=`<div class="split-line"><span class="split-lnum"></span><span class="split-code"></span></div>`;
    } else {
      const prev = lineOps[i-1];
      let codeHtml = hl_b;
      if(prev?.op==='-'&&prev.a!=null&&lo.b!=null){const il=inlineDiff(prev.a,lo.b);codeHtml=il.b;}
      leftHtml +=`<div class="split-line"><span class="split-lnum"></span><span class="split-code"></span></div>`;
      rightHtml+=`<div class="split-line line-add"><span class="split-lnum">${lo.lb}</span><span class="split-code">${codeHtml}</span></div>`;
    }
  });

  output.innerHTML=`<div class="split-view"><div class="split-pane">${leftHtml}</div><div class="split-pane">${rightHtml}</div></div>`;
}

function renderUnified(lineOps, lang, output) {
  const CTX=3; const show=new Set();
  lineOps.forEach((lo,i)=>{ if(lo.op!=='=') for(let j=Math.max(0,i-CTX);j<=Math.min(lineOps.length-1,i+CTX);j++) show.add(j); });

  let html=''; let last=-1;
  lineOps.forEach((lo,i)=>{
    if(!show.has(i)) return;
    if(last!==-1&&i>last+1) html+=`<div class="unified-line sep-line"><span class="u-code">@@ ... @@</span></div>`;
    last=i;
    const cls = lo.op==='+'?'u-add':lo.op==='-'?'u-del':'u-ctx';
    const sign = lo.op==='+'?'+':lo.op==='-'?'-':' ';
    const lnum = lo.op==='+'?`${lo.lb}`:`${lo.la}`;
    const code = lo.op==='+'?lo.b:lo.a||'';
    html+=`<div class="unified-line ${cls}"><span class="u-sign">${sign}</span><span class="u-lnum">${lnum}</span><span class="u-code">${highlight(code,lang)}</span></div>`;
  });
  output.innerHTML=html||'<div class="empty-msg">差分なし</div>';
}

function generatePatch(lineOps) {
  const lines=[]; const CTX=3; const show=new Set();
  lineOps.forEach((lo,i)=>{ if(lo.op!=='=') for(let j=Math.max(0,i-CTX);j<=Math.min(lineOps.length-1,i+CTX);j++) show.add(j); });
  lines.push('--- a/file'); lines.push('+++ b/file');
  let lastShown=-1;
  lineOps.forEach((lo,i)=>{
    if(!show.has(i)) return;
    if(lastShown!==-1&&i>lastShown+1) lines.push('@@ ... @@');
    lastShown=i;
    const sign=lo.op==='+'?'+':lo.op==='-'?'-':' ';
    lines.push(sign+(lo.op==='+'?lo.b:lo.a||''));
  });
  return lines.join('\n');
}

// ── Events ────────────────────────────────────────────
document.getElementById('btn-diff').addEventListener('click', computeDiff);
['code-a','code-b'].forEach(id=>document.getElementById(id).addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();computeDiff();}}));

document.getElementById('btn-swap').addEventListener('click',()=>{
  const a=document.getElementById('code-a').value;
  const b=document.getElementById('code-b').value;
  document.getElementById('code-a').value=b;
  document.getElementById('code-b').value=a;
  computeDiff();
});

document.getElementById('btn-copy-patch').addEventListener('click',function(){
  const patch=window._patchData||'差分なし';
  navigator.clipboard.writeText(patch).then(()=>{
    this.textContent='✓ コピー済み'; this.classList.add('copied');
    setTimeout(()=>{this.textContent='パッチをコピー';this.classList.remove('copied');},1500);
  });
});

['view-mode','lang-sel','ignore-ws','ignore-case'].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener(el.tagName==='INPUT'?'change':'change',computeDiff);
});

document.getElementById('diff-output').innerHTML='<div class="empty-msg">コードを入力して「差分を表示」をクリック</div>';
