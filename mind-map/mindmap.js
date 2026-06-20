const canvas = document.getElementById('map-canvas');
const ctx    = canvas.getContext('2d');

const THEMES = {
  dark:     { bg:'#0d0d1a', line:'#2d2d4e', nodeColors:['#7c3aed','#0369a1','#0891b2','#065f46','#92400e','#881337'], text:'#f1f5f9', selectedBorder:'#a78bfa' },
  light:    { bg:'#f8fafc', line:'#cbd5e1', nodeColors:['#7c3aed','#0369a1','#059669','#d97706','#dc2626','#7c3aed'], text:'#1e293b', selectedBorder:'#7c3aed' },
  colorful: { bg:'#0f0f1a', line:'#334155', nodeColors:['#f87171','#fb923c','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6'], text:'#fff', selectedBorder:'#fff' },
};
let theme = THEMES.dark;

// ── Data model ────────────────────────────────────────
let nodes = [{ id:'root', text:'中心テーマ', x:400, y:260, parentId:null, color:0, collapsed:false }];
let edges = [];
let selectedId = 'root';
let history = []; let redoStack = [];
let pan = { x:0, y:0 }; let zoom = 1.0;
let dragging = null; let dragStart = null; let isPanning = false; let panStart = null;

function uuid() { return Math.random().toString(36).slice(2); }

function getNode(id) { return nodes.find(n => n.id === id); }
function getChildren(id) { return nodes.filter(n => n.parentId === id); }
function getDescendants(id) {
  const res = []; const queue = [id];
  while (queue.length) { const cur = queue.shift(); const ch = getChildren(cur); ch.forEach(c=>{res.push(c.id);queue.push(c.id);}); }
  return res;
}

function saveHistory() {
  history.push(JSON.stringify({ nodes, edges, selectedId }));
  if (history.length > 50) history.shift();
  redoStack = [];
}

// ── Layout ────────────────────────────────────────────
function autoLayout() {
  saveHistory();
  const root = getNode('root');
  if (!root) return;
  const W = canvas.width; const H = canvas.height;
  root.x = W/2 + pan.x/zoom; root.y = H/2 + pan.y/zoom;

  function layoutChildren(nodeId, angle, spreadAngle, depth, dist) {
    const children = getChildren(nodeId);
    if (!children.length) return;
    const step = spreadAngle / Math.max(1, children.length);
    const startAngle = angle - spreadAngle/2 + step/2;
    children.forEach((child, i) => {
      const a = startAngle + i * step;
      const parent = getNode(nodeId);
      child.x = parent.x + Math.cos(a) * dist;
      child.y = parent.y + Math.sin(a) * dist;
      layoutChildren(child.id, a, Math.min(Math.PI*0.8, step*1.2), depth+1, dist*0.75);
    });
  }
  layoutChildren('root', 0, Math.PI*2, 0, 160);
  draw();
}

// ── Drawing ───────────────────────────────────────────
function worldToScreen(x, y) { return [(x - pan.x/zoom) * zoom, (y - pan.y/zoom) * zoom]; }
function screenToWorld(x, y) { return [x/zoom + pan.x/zoom, y/zoom + pan.y/zoom]; }

function getNodeRadius(node) {
  const isRoot = !node.parentId;
  const depth = getDepth(node.id);
  return isRoot ? 50 : depth === 1 ? 36 : 26;
}

function getDepth(id) {
  let d = 0; let cur = getNode(id);
  while (cur && cur.parentId) { d++; cur = getNode(cur.parentId); }
  return d;
}

function draw() {
  canvas.width  = canvas.offsetWidth || 800;
  canvas.height = canvas.offsetHeight || 460;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  // Draw edges
  nodes.forEach(node => {
    if (!node.parentId) return;
    const parent = getNode(node.parentId);
    if (!parent) return;
    const [sx, sy] = [parent.x, parent.y];
    const [ex, ey] = [node.x, node.y];
    // Bezier curve
    const mx = (sx+ex)/2, my = (sy+ey)/2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(mx, sy, mx, ey, ex, ey);
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = Math.max(1, 3 - getDepth(node.id));
    ctx.stroke();
  });

  // Draw nodes
  nodes.forEach(node => {
    if (node.parentId) {
      const ancestors = [];
      let cur = node;
      while (cur) { ancestors.push(cur.id); cur = getNode(cur.parentId); }
    }
    drawNode(node);
  });

  ctx.restore();

  document.getElementById('node-count').textContent = `ノード: ${nodes.length}`;
}

function drawNode(node) {
  const [sx, sy] = [node.x, node.y];
  const r = getNodeRadius(node);
  const isSelected = node.id === selectedId;
  const isRoot = !node.parentId;
  const colorIdx = node.color % theme.nodeColors.length;
  const nodeColor = theme.nodeColors[colorIdx];

  ctx.save();

  // Shadow
  if (isSelected) {
    ctx.shadowColor = theme.selectedBorder; ctx.shadowBlur = 14;
  }

  // Node background
  ctx.beginPath();
  if (isRoot) {
    ctx.ellipse(sx, sy, r, r*0.65, 0, 0, Math.PI*2);
  } else {
    const w = Math.max(60, ctx.measureText(node.text).width + 28);
    roundRect(ctx, sx-w/2, sy-r/2, w, r, r/3);
  }

  const grad = ctx.createRadialGradient(sx-r*0.2, sy-r*0.2, 0, sx, sy, r*1.2);
  grad.addColorStop(0, lighten(nodeColor, 30));
  grad.addColorStop(1, nodeColor);
  ctx.fillStyle = grad;
  ctx.fill();

  // Border
  ctx.strokeStyle = isSelected ? theme.selectedBorder : 'rgba(255,255,255,0.15)';
  ctx.lineWidth = isSelected ? 2.5 : 1;
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Text
  ctx.fillStyle = theme.text;
  ctx.font = isRoot ? 'bold 14px sans-serif' : 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.text, sx, sy);

  // Collapse indicator
  const children = getChildren(node.id);
  if (children.length && node.collapsed !== undefined) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px sans-serif';
    ctx.fillText(node.collapsed ? `▶(${children.length})` : '▼', sx, sy + r*0.7 + 6);
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y, x+w,y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w,y+h, x+w-r,y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x,y+h, x,y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x,y, x+r,y, r);
  ctx.closePath();
}

function lighten(hex, amount) {
  const num = parseInt(hex.slice(1),16);
  const r = Math.min(255,(num>>16)+amount);
  const g = Math.min(255,((num>>8)&0xff)+amount);
  const b = Math.min(255,(num&0xff)+amount);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

// ── Hit test ──────────────────────────────────────────
function hitTest(wx, wy) {
  for (let i = nodes.length-1; i >= 0; i--) {
    const node = nodes[i];
    const r = getNodeRadius(node);
    const dx = wx - node.x, dy = wy - node.y;
    if (!node.parentId) {
      if (dx*dx/(r*r) + dy*dy/((r*0.65)*(r*0.65)) < 1) return node;
    } else {
      const textW = 80;
      if (Math.abs(dx) < textW/2 && Math.abs(dy) < r/2) return node;
    }
  }
  return null;
}

// ── Node operations ───────────────────────────────────
function addChild(parentId) {
  saveHistory();
  const parent = getNode(parentId);
  if (!parent) return;
  const angle = (getChildren(parentId).length * 0.7) % (Math.PI*2);
  const dist = getDepth(parentId) < 1 ? 160 : 120;
  const id = uuid();
  const colorIdx = (getDepth(parentId) + getChildren(parentId).length) % theme.nodeColors.length;
  nodes.push({
    id, text: '新しいノード',
    x: parent.x + Math.cos(angle)*dist,
    y: parent.y + Math.sin(angle)*dist,
    parentId, color: colorIdx, collapsed: false
  });
  selectedId = id;
  save(); draw();
  startEdit(id);
}

function addSibling(id) {
  const node = getNode(id);
  if (!node || !node.parentId) { addChild('root'); return; }
  addChild(node.parentId);
}

function deleteNode(id) {
  if (id === 'root') return;
  saveHistory();
  const descendants = [id, ...getDescendants(id)];
  nodes = nodes.filter(n => !descendants.includes(n.id));
  selectedId = 'root';
  save(); draw();
}

function changeColor(id) {
  saveHistory();
  const node = getNode(id);
  if (!node) return;
  node.color = ((node.color || 0) + 1) % theme.nodeColors.length;
  save(); draw();
}

// ── Edit overlay ──────────────────────────────────────
let editingId = null;
function startEdit(id) {
  const node = getNode(id);
  if (!node) return;
  editingId = id;
  const overlay = document.getElementById('edit-overlay');
  const input   = document.getElementById('edit-input');
  const [sx, sy] = [node.x * zoom + pan.x, node.y * zoom + pan.y];
  overlay.style.left = (sx - 80) + 'px';
  overlay.style.top  = (sy - 18) + 'px';
  overlay.classList.remove('hidden');
  input.value = node.text;
  input.style.minWidth = Math.max(120, node.text.length * 10) + 'px';
  input.focus(); input.select();
}

function commitEdit() {
  if (!editingId) return;
  const input = document.getElementById('edit-input');
  const node  = getNode(editingId);
  if (node && input.value.trim()) {
    saveHistory(); node.text = input.value.trim(); save();
  }
  document.getElementById('edit-overlay').classList.add('hidden');
  editingId = null; draw();
  canvas.focus();
}

document.getElementById('edit-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { commitEdit(); e.preventDefault(); }
  if (e.key === 'Escape') { document.getElementById('edit-overlay').classList.add('hidden'); editingId=null; canvas.focus(); }
  if (e.key === 'Tab') { e.preventDefault(); commitEdit(); if(selectedId) addChild(selectedId); }
});
document.getElementById('edit-input').addEventListener('blur', () => setTimeout(commitEdit, 100));

// ── Mouse/Touch events ────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (editingId) return;
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const [wx, wy] = screenToWorld(sx, sy);
  const hit = hitTest(wx, wy);

  if (hit) {
    selectedId = hit.id;
    dragging = { id: hit.id, startX: wx - hit.x, startY: wy - hit.y };
    draw();
  } else {
    isPanning = true;
    panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    selectedId = null; draw();
  }
});

canvas.addEventListener('mousemove', e => {
  if (dragging) {
    const rect = canvas.getBoundingClientRect();
    const [wx, wy] = screenToWorld(e.clientX-rect.left, e.clientY-rect.top);
    const node = getNode(dragging.id);
    if (node) { node.x = wx - dragging.startX; node.y = wy - dragging.startY; draw(); }
  } else if (isPanning) {
    pan.x = e.clientX - panStart.x; pan.y = e.clientY - panStart.y; draw();
  }
});

canvas.addEventListener('mouseup', e => {
  if (dragging) { saveHistory(); save(); }
  dragging = null; isPanning = false;
});

canvas.addEventListener('dblclick', e => {
  const rect = canvas.getBoundingClientRect();
  const [wx, wy] = screenToWorld(e.clientX-rect.left, e.clientY-rect.top);
  const hit = hitTest(wx, wy);
  if (hit) { selectedId = hit.id; startEdit(hit.id); }
  else {
    // Create new root-level child at click position
    saveHistory();
    const id = uuid();
    nodes.push({ id, text:'新しいノード', x:wx, y:wy, parentId:'root', color:0, collapsed:false });
    selectedId = id; save(); draw(); startEdit(id);
  }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const oldZoom = zoom;
  zoom = Math.max(0.3, Math.min(3.0, zoom - e.deltaY * 0.001));
  // Zoom toward mouse
  pan.x -= (mx/zoom - mx/oldZoom) * zoom;
  pan.y -= (my/zoom - my/oldZoom) * zoom;
  draw();
}, { passive: false });

// ── Keyboard ──────────────────────────────────────────
canvas.addEventListener('keydown', e => {
  if (editingId) return;
  if (e.key==='Tab')    { e.preventDefault(); if(selectedId) addChild(selectedId); }
  if (e.key==='Enter')  { e.preventDefault(); if(selectedId) addSibling(selectedId); }
  if (e.key==='Delete'||e.key==='Backspace') { if(selectedId) deleteNode(selectedId); }
  if (e.key==='F2')     { if(selectedId) startEdit(selectedId); }
  if (e.key==='c')      { if(selectedId) changeColor(selectedId); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='z') { undo(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='y') { redo(); }
  if (e.key==='0') { pan.x=0; pan.y=0; zoom=1; draw(); }
});

// ── Toolbar buttons ───────────────────────────────────
document.getElementById('btn-add-child').addEventListener('click', () => { if(selectedId) addChild(selectedId); });
document.getElementById('btn-add-sibling').addEventListener('click', () => { if(selectedId) addSibling(selectedId); });
document.getElementById('btn-delete').addEventListener('click', () => { if(selectedId) deleteNode(selectedId); });
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
document.getElementById('btn-layout').addEventListener('click', autoLayout);

document.getElementById('theme-select').addEventListener('change', e => {
  theme = THEMES[e.target.value];
  draw();
});

// Export PNG
document.getElementById('btn-export-png').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'mindmap.png'; a.href = canvas.toDataURL('image/png'); a.click();
});

// Export JSON
document.getElementById('btn-export-json').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({nodes, pan, zoom},null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.download='mindmap.json'; a.href=URL.createObjectURL(blob); a.click();
});

// Import JSON
document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', e => {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      saveHistory(); nodes = d.nodes; pan = d.pan||{x:0,y:0}; zoom = d.zoom||1;
      save(); draw();
    } catch { alert('JSONの読み込みに失敗しました'); }
  };
  r.readAsText(f);
});

// ── Undo/Redo ─────────────────────────────────────────
function undo() {
  if (!history.length) return;
  redoStack.push(JSON.stringify({nodes,edges,selectedId}));
  const state = JSON.parse(history.pop());
  nodes = state.nodes; edges = state.edges; selectedId = state.selectedId;
  draw();
}
function redo() {
  if (!redoStack.length) return;
  history.push(JSON.stringify({nodes,edges,selectedId}));
  const state = JSON.parse(redoStack.pop());
  nodes = state.nodes; edges = state.edges; selectedId = state.selectedId;
  draw();
}

// ── Persist ───────────────────────────────────────────
function save() { chrome.storage.local.set({ mindMapData: {nodes, pan, zoom} }); }

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['mindMapData'], d => {
  if (d.mindMapData?.nodes?.length) {
    nodes = d.mindMapData.nodes;
    pan   = d.mindMapData.pan  || {x:0,y:0};
    zoom  = d.mindMapData.zoom || 1.0;
  }
  // Center root
  const root = getNode('root');
  if (root && !d.mindMapData) {
    root.x = canvas.offsetWidth/2 || 400;
    root.y = canvas.offsetHeight/2 || 230;
  }
  draw(); canvas.focus();
});

window.addEventListener('resize', draw);
