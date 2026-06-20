let todos = [];
let filter = 'all';
let searchQ = '';

const listEl     = document.getElementById('todo-list');
const newTodoEl  = document.getElementById('new-todo');
const searchEl   = document.getElementById('search-todo');
const countBadge = document.getElementById('count-badge');
const progFill   = document.getElementById('progress-fill');
const progLabel  = document.getElementById('progress-label');

function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function save() { chrome.storage.local.set({ todos }); }

function todayStr() { return new Date().toISOString().split('T')[0]; }

function dueMeta(due) {
  if (!due) return '';
  const today = todayStr();
  if (due < today) return { text: `⚠ ${due}`, cls: 'overdue' };
  if (due === today) return { text: `📅 今日`, cls: 'today' };
  return { text: `📅 ${due}`, cls: '' };
}

function parseTags(text) {
  const tags = (text.match(/#\w+/g) || []).map(t => t.slice(1));
  const clean = text.replace(/#\w+/g, '').trim();
  return { text: clean, tags };
}

function getFiltered() {
  const today = todayStr();
  return todos.filter(t => {
    if (filter === 'active' && t.done) return false;
    if (filter === 'done'   && !t.done) return false;
    if (filter === 'today'  && t.due !== today) return false;
    if (searchQ && !t.text.toLowerCase().includes(searchQ.toLowerCase()) &&
        !t.tags.some(tag => tag.toLowerCase().includes(searchQ.toLowerCase()))) return false;
    return true;
  });
}

function render() {
  const filtered = getFiltered();
  listEl.innerHTML = '';

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-state">${todos.length ? 'フィルタ結果なし' : 'タスクを追加してみましょう 🎉'}</div>`;
  } else {
    filtered.forEach(todo => {
      const div = document.createElement('div');
      const prioClass = todo.priority !== 'none' ? `priority-${todo.priority}` : '';
      const doneClass = todo.done ? 'done' : '';
      const due = todo.due ? dueMeta(todo.due) : null;
      const overdueClass = due?.cls === 'overdue' && !todo.done ? 'overdue' : '';

      div.className = ['todo-item', doneClass, prioClass, overdueClass].filter(Boolean).join(' ');

      const check = document.createElement('div');
      check.className = 'todo-check';
      check.addEventListener('click', () => toggleDone(todo.id));

      const body = document.createElement('div');
      body.className = 'todo-body';

      const textEl = document.createElement('div');
      textEl.className = 'todo-text';
      textEl.textContent = todo.text;

      const meta = document.createElement('div');
      meta.className = 'todo-meta';
      todo.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'todo-tag';
        span.textContent = '#' + tag;
        meta.appendChild(span);
      });
      if (due) {
        const dueEl = document.createElement('span');
        dueEl.className = 'todo-due' + (due.cls ? ' ' + due.cls : '');
        dueEl.textContent = due.text;
        meta.appendChild(dueEl);
      }

      body.appendChild(textEl);
      if (todo.tags.length || due) body.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'todo-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'action-btn'; editBtn.textContent = '✏'; editBtn.title = '編集';
      editBtn.addEventListener('click', () => editTodo(todo.id));

      const delBtn = document.createElement('button');
      delBtn.className = 'action-btn'; delBtn.textContent = '×'; delBtn.title = '削除';
      delBtn.addEventListener('click', () => deleteTodo(todo.id));

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      div.appendChild(check);
      div.appendChild(body);
      div.appendChild(actions);
      listEl.appendChild(div);
    });
  }

  // Stats
  const total = todos.length;
  const done  = todos.filter(t => t.done).length;
  const active = total - done;
  countBadge.textContent = `${active}件`;
  progFill.style.width = total > 0 ? (done / total * 100) + '%' : '0%';
  progLabel.textContent = `${done} / ${total}`;
}

function addTodo() {
  const raw = newTodoEl.value.trim();
  if (!raw) return;
  const { text, tags } = parseTags(raw);
  const tagInput = document.getElementById('tag-input').value.replace(/#/g,'').trim();
  if (tagInput) tags.push(tagInput);
  const due = document.getElementById('due-date').value || '';
  const priority = document.getElementById('priority').value;

  todos.unshift({ id: uuid(), text: text||raw, tags, done: false, due, priority, createdAt: Date.now() });
  save(); render();
  newTodoEl.value = '';
  document.getElementById('tag-input').value = '';
  document.getElementById('due-date').value = '';
  document.getElementById('priority').value = 'none';
  newTodoEl.focus();
}

function toggleDone(id) {
  const t = todos.find(t => t.id === id);
  if (t) { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; }
  save(); render();
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  save(); render();
}

function editTodo(id) {
  const t = todos.find(t => t.id === id);
  if (!t) return;
  const newText = prompt('タスクを編集:', t.text);
  if (newText !== null && newText.trim()) {
    const { text, tags } = parseTags(newText.trim());
    t.text = text; t.tags = tags;
    save(); render();
  }
}

// Event listeners
newTodoEl.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    render();
  });
});

searchEl.addEventListener('input', () => { searchQ = searchEl.value; render(); });

document.getElementById('btn-clear-done').addEventListener('click', () => {
  const count = todos.filter(t => t.done).length;
  if (!count) return;
  if (confirm(`完了済み${count}件を削除しますか？`)) {
    todos = todos.filter(t => !t.done);
    save(); render();
  }
});

// Drag to reorder
let dragId = null;
listEl.addEventListener('dragstart', e => {
  dragId = e.target.closest('.todo-item')?.dataset?.id;
});

// Load
chrome.storage.local.get(['todos'], data => {
  todos = data.todos || [];
  render();
});
