const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const searchEl = document.getElementById('search');

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'たった今';
  if (diff < 3600000) return `${Math.floor(diff/60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}時間前`;
  return `${Math.floor(diff/86400000)}日前`;
}

function highlight(text, query) {
  if (!query) return escHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escHtml(text).replace(new RegExp(escaped, 'gi'), m => `<mark>${m}</mark>`);
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function render(history, query = '') {
  const filtered = query
    ? history.filter(i => i.text.toLowerCase().includes(query.toLowerCase()))
    : history;

  listEl.innerHTML = '';
  emptyEl.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'item';

    const flash = document.createElement('span');
    flash.className = 'copy-flash';
    flash.textContent = '✓ コピー済み';

    div.innerHTML = `
      <div class="item-text">${highlight(item.text, query)}</div>
      <div class="item-footer">
        <span class="item-time">${timeAgo(item.time)}</span>
        <div class="item-actions">
          <button class="action-btn copy-btn">コピー</button>
          <button class="action-btn del del-btn">削除</button>
        </div>
      </div>
    `;
    div.appendChild(flash);

    const copyItem = () => {
      navigator.clipboard.writeText(item.text).then(() => {
        div.classList.add('copied');
        flash.classList.add('show');
        setTimeout(() => { div.classList.remove('copied'); flash.classList.remove('show'); }, 1500);
      });
    };

    div.addEventListener('click', copyItem);
    div.querySelector('.copy-btn').addEventListener('click', (e) => { e.stopPropagation(); copyItem(); });
    div.querySelector('.del-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.storage.local.get(['history'], (data) => {
        const h = (data.history || []).filter(i => i.text !== item.text);
        chrome.storage.local.set({ history: h }, () => render(h, searchEl.value));
      });
    });

    listEl.appendChild(div);
  });
}

function load() {
  chrome.storage.local.get(['history'], (data) => {
    render(data.history || [], searchEl.value);
  });
}

searchEl.addEventListener('input', () => {
  chrome.storage.local.get(['history'], (data) => {
    render(data.history || [], searchEl.value);
  });
});

document.getElementById('btn-clear-all').addEventListener('click', () => {
  if (confirm('全履歴を削除しますか？')) {
    chrome.storage.local.set({ history: [] }, load);
  }
});

load();
searchEl.focus();
