const COLS = [
  { id: 'todo',   label: 'ToDo',  color: '#94a3b8', dot: '#94a3b8' },
  { id: 'doing',  label: '進行中', color: '#60a5fa', dot: '#60a5fa' },
  { id: 'done',   label: '完了',  color: '#4ade80', dot: '#4ade80' },
];

const LABELS = [
  { id: 'none',   name: 'なし' },
  { id: 'red',    name: '🔴 緊急' },
  { id: 'yellow', name: '🟡 注意' },
  { id: 'green',  name: '🟢 完了' },
  { id: 'blue',   name: '🔵 情報' },
  { id: 'purple', name: '🟣 機能' },
];

let boards = [];
let currentBoardIdx = 0;
let dragCardId = null, dragFromCol = null;

function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function save() { chrome.storage.local.set({ kBoards: boards, kCurrentIdx: currentBoardIdx }); }

function currentBoard() { return boards[currentBoardIdx] || null; }

// ── Board management ──────────────────────────────────
function newBoard(name) {
  const board = {
    id: uuid(), name, cards: {},
  };
  COLS.forEach(c => board.cards[c.id] = []);
  // Add example cards
  board.cards.todo.push({ id: uuid(), text: 'このボードへようこそ！', label: 'blue' });
  boards.push(board);
  currentBoardIdx = boards.length - 1;
  save();
}

function populateBoardSelect() {
  const sel = document.getElementById('board-select');
  sel.innerHTML = '';
  boards.forEach((b, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = b.name;
    if (i === currentBoardIdx) opt.selected = true;
    sel.appendChild(opt);
  });
}

document.getElementById('board-select').addEventListener('change', (e) => {
  currentBoardIdx = parseInt(e.target.value);
  save(); render();
});

document.getElementById('btn-new-board').addEventListener('click', () => {
  const name = prompt('新しいボード名:', '新しいボード');
  if (name?.trim()) { newBoard(name.trim()); populateBoardSelect(); render(); }
});

document.getElementById('btn-del-board').addEventListener('click', () => {
  if (boards.length <= 1) { alert('最後のボードは削除できません'); return; }
  if (!confirm(`「${currentBoard().name}」を削除しますか？`)) return;
  boards.splice(currentBoardIdx, 1);
  currentBoardIdx = Math.max(0, currentBoardIdx - 1);
  save(); populateBoardSelect(); render();
});

// ── Render ────────────────────────────────────────────
function render() {
  const board = currentBoard();
  const columnsEl = document.getElementById('columns');
  columnsEl.innerHTML = '';

  let totalCards = 0;

  COLS.forEach(col => {
    const cards = board.cards[col.id] || [];
    totalCards += cards.length;

    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.colId = col.id;

    // Header
    colEl.innerHTML = `
      <div class="col-header" style="color:${col.color}">
        <div class="col-title">
          <div class="col-dot" style="background:${col.dot}"></div>
          ${col.label}
        </div>
        <span class="col-count">${cards.length}</span>
      </div>
    `;

    // Card body (droppable)
    const body = document.createElement('div');
    body.className = 'col-body';
    body.dataset.colId = col.id;

    cards.forEach(card => {
      const cardEl = buildCard(card, col.id);
      body.appendChild(cardEl);
    });

    // Drag events on column body
    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', (e) => {
      e.preventDefault();
      body.classList.remove('drag-over');
      if (!dragCardId || !dragFromCol) return;
      if (dragFromCol === col.id) return;
      const b = currentBoard();
      const fromArr = b.cards[dragFromCol];
      const idx = fromArr.findIndex(c => c.id === dragCardId);
      if (idx < 0) return;
      const [card] = fromArr.splice(idx, 1);
      b.cards[col.id].push(card);
      save(); render();
    });

    colEl.appendChild(body);

    // Add card form (hidden initially)
    const form = document.createElement('div');
    form.className = 'add-card-form'; form.style.display = 'none';
    const textarea = document.createElement('textarea');
    textarea.className = 'add-card-input';
    textarea.placeholder = 'カードを追加...';
    textarea.rows = 2;

    const labelSel = document.createElement('select');
    labelSel.style.cssText = 'width:100%;margin-top:4px;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#94a3b8;font-size:11px;padding:3px;outline:none';
    LABELS.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id; opt.textContent = l.name;
      labelSel.appendChild(opt);
    });

    const btns = document.createElement('div');
    btns.className = 'add-card-btns';
    btns.innerHTML = '<button class="add-btn-ok">追加</button><button class="add-btn-cancel">✕</button>';

    btns.querySelector('.add-btn-ok').addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;
      currentBoard().cards[col.id].push({ id: uuid(), text, label: labelSel.value });
      save(); render();
    });
    btns.querySelector('.add-btn-cancel').addEventListener('click', () => {
      form.style.display = 'none';
      footer.style.display = '';
      textarea.value = '';
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); btns.querySelector('.add-btn-ok').click(); }
      if (e.key === 'Escape') btns.querySelector('.add-btn-cancel').click();
    });

    form.appendChild(textarea);
    form.appendChild(labelSel);
    form.appendChild(btns);
    colEl.appendChild(form);

    // Footer with + button
    const footer = document.createElement('div');
    footer.className = 'col-footer';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-card';
    addBtn.textContent = '+ カードを追加';
    addBtn.addEventListener('click', () => {
      form.style.display = '';
      footer.style.display = 'none';
      textarea.focus();
    });
    footer.appendChild(addBtn);
    colEl.appendChild(footer);

    columnsEl.appendChild(colEl);
  });

  document.getElementById('card-count').textContent = `${totalCards}枚`;
}

function buildCard(card, colId) {
  const el = document.createElement('div');
  el.className = 'card';
  el.draggable = true;
  el.dataset.cardId = card.id;

  const labelCls = card.label && card.label !== 'none' ? `card-label label-${card.label}` : 'card-label label-none';
  const labelText = LABELS.find(l => l.id === card.label)?.name?.replace(/^../, '') || '';

  el.innerHTML = `
    <div class="card-text">${escHtml(card.text)}</div>
    <div class="card-meta">
      <span class="${labelCls}">${escHtml(labelText)}</span>
      <div class="card-actions">
        <button class="card-btn edit-btn" title="編集">✏</button>
        <button class="card-btn del-btn" title="削除">×</button>
      </div>
    </div>
  `;

  // Drag
  el.addEventListener('dragstart', () => { dragCardId = card.id; dragFromCol = colId; el.classList.add('dragging'); });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); dragCardId = null; dragFromCol = null; });

  // Edit
  el.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const newText = prompt('カードを編集:', card.text);
    if (newText !== null && newText.trim()) {
      card.text = newText.trim();
      save(); render();
    }
  });

  // Delete
  el.querySelector('.del-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const b = currentBoard();
    b.cards[colId] = b.cards[colId].filter(c => c.id !== card.id);
    save(); render();
  });

  return el;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Icons ────────────────────────────────────────────
// (generated via python below)

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['kBoards','kCurrentIdx'], (data) => {
  boards = data.kBoards || [];
  currentBoardIdx = data.kCurrentIdx || 0;
  if (!boards.length) newBoard('マイボード');
  if (currentBoardIdx >= boards.length) currentBoardIdx = 0;
  populateBoardSelect();
  render();
});
