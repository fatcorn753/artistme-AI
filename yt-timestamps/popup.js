let currentKey = null;

function fmt(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

function exportText(data) {
  return `${data.title}\n${data.url}\n\n` +
    data.timestamps.map(ts => `${ts.formattedTime}${ts.note ? ' - ' + ts.note : ''}  ${data.url}&t=${ts.time}`).join('\n');
}

function renderTimestamps(key, data) {
  currentKey = key;
  document.getElementById('no-yt').classList.add('hidden');
  document.getElementById('current-video').classList.remove('hidden');
  document.getElementById('video-title').textContent = data.title;

  const list = document.getElementById('timestamps-list');
  list.innerHTML = '';

  data.timestamps.forEach((ts, i) => {
    const div = document.createElement('div');
    div.className = 'ts-item';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'ts-time';
    timeSpan.textContent = ts.formattedTime;

    const noteEl = document.createElement('input');
    noteEl.type = 'text';
    noteEl.className = 'ts-note-input';
    noteEl.value = ts.note || '';
    noteEl.placeholder = 'メモを追加...';
    noteEl.addEventListener('change', () => {
      data.timestamps[i].note = noteEl.value;
      chrome.storage.local.set({ [key]: data });
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'ts-del';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      data.timestamps.splice(i, 1);
      chrome.storage.local.set({ [key]: data }, () => renderTimestamps(key, data));
    });

    // Click time to seek (if on YT tab)
    timeSpan.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url?.includes('youtube.com/watch')) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (t) => { const v = document.querySelector('video'); if (v) v.currentTime = t; },
            args: [ts.time],
          });
        }
      });
    });

    div.appendChild(timeSpan);
    div.appendChild(noteEl);
    div.appendChild(delBtn);
    list.appendChild(div);
  });

  if (!data.timestamps.length) {
    list.innerHTML = '<div style="color:#555;font-size:12px;padding:8px">タイムスタンプがありません</div>';
  }
}

function loadHistory() {
  chrome.storage.local.get(null, (all) => {
    const entries = Object.entries(all).filter(([k]) => k.startsWith('yt-ts-'));

    // Try to find current YT tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      const vidId = url.includes('youtube.com/watch') ? new URL(url).searchParams.get('v') : null;
      const curKey = vidId ? `yt-ts-${vidId}` : null;

      if (curKey && all[curKey]) {
        renderTimestamps(curKey, all[curKey]);
      } else {
        document.getElementById('no-yt').classList.remove('hidden');
      }

      // History list
      const histList = document.getElementById('history-list');
      histList.innerHTML = '';
      const others = entries.filter(([k]) => k !== curKey).sort((a, b) => {
        const lastA = a[1].timestamps.at(-1)?.savedAt || 0;
        const lastB = b[1].timestamps.at(-1)?.savedAt || 0;
        return lastB - lastA;
      });

      if (!others.length) {
        histList.innerHTML = '<div style="color:#444;font-size:11px;padding:4px">履歴なし</div>';
        return;
      }

      others.forEach(([key, data]) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
          <span class="history-title" title="${data.title}">${data.title}</span>
          <span class="history-count">${data.timestamps.length}件</span>
        `;
        div.addEventListener('click', () => renderTimestamps(key, data));
        histList.appendChild(div);
      });
    });
  });
}

document.getElementById('btn-export').addEventListener('click', () => {
  if (!currentKey) return;
  chrome.storage.local.get([currentKey], (d) => {
    navigator.clipboard.writeText(exportText(d[currentKey]));
    const btn = document.getElementById('btn-export');
    btn.textContent = '✓ コピー済み';
    setTimeout(() => btn.textContent = '📋 コピー', 1500);
  });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (!currentKey || !confirm('このビデオのタイムスタンプを全て削除しますか？')) return;
  chrome.storage.local.remove(currentKey, loadHistory);
});

document.getElementById('btn-export-all').addEventListener('click', () => {
  chrome.storage.local.get(null, (all) => {
    const entries = Object.entries(all).filter(([k]) => k.startsWith('yt-ts-'));
    const text = entries.map(([, d]) => exportText(d)).join('\n\n═══════════════\n\n');
    navigator.clipboard.writeText(text);
  });
});

loadHistory();
