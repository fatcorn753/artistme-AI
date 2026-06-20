const THEMES = {
  github: `body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#24292e;line-height:1.6}h1,h2,h3,h4{border-bottom:1px solid #eee;padding-bottom:.3em;margin:24px 0 16px}code{background:#f6f8fa;padding:.2em .4em;border-radius:3px;font-size:85%}pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto}pre code{background:none;padding:0}blockquote{border-left:4px solid #dfe2e5;padding:0 1em;color:#6a737d}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dfe2e5;padding:6px 13px}th{background:#f6f8fa}a{color:#0366d6}`,
  dark: `body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#c9d1d9;background:#0d1117;line-height:1.6}h1,h2,h3{color:#e6edf3;border-bottom:1px solid #30363d;padding-bottom:.3em;margin:24px 0 16px}code{background:#161b22;padding:.2em .4em;border-radius:3px;color:#79c0ff;font-size:85%}pre{background:#161b22;border:1px solid #30363d;padding:16px;border-radius:6px;overflow:auto}pre code{background:none;padding:0;color:#c9d1d9}blockquote{border-left:4px solid #3b5bdb;padding:0 1em;color:#8b949e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #30363d;padding:6px 13px}th{background:#161b22}a{color:#58a6ff}strong{color:#e6edf3}`,
  minimal: `body{font-family:Georgia,serif;max-width:700px;margin:60px auto;padding:0 20px;color:#333;line-height:1.8}h1,h2,h3{font-weight:700;margin:28px 0 12px}code{font-family:monospace;background:#f4f4f4;padding:.1em .3em}pre{background:#f4f4f4;padding:14px;overflow:auto}blockquote{border-left:3px solid #999;padding-left:1em;color:#666;font-style:italic}a{color:#555;text-decoration:underline}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 10px}`,
};

// ── Markdown parser ───────────────────────────────────
function mdToHtml(text) {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Fenced code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/gm, (_, lang, code) =>
    `<pre><code class="language-${lang}">${code}</code></pre>`);

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Tables
  html = html.replace(/^(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n)*)/gm, (match) => {
    const lines = match.trim().split('\n');
    const headers = lines[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const body = lines.slice(2).map(l =>
      '<tr>' + l.split('|').filter(c => c !== undefined).slice(1,-1).map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
    ).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>\n`;
  });

  // Headings
  html = html.replace(/^(#{1,6}) (.+)$/gm, (_, h, t) => `<h${h.length}>${t}</h${h.length}>`);

  // HR
  html = html.replace(/^[-*_]{3,}$/gm, '<hr>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Unordered lists
  html = html.replace(/^[-*+] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Inline elements
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs (lines not already wrapped in block elements)
  html = html.replace(/^(?!<[huptbdo]|<\/|<li|<th|<td|\s*$)(.+)$/gm, '<p>$1</p>');

  // Clean up extra newlines
  html = html.replace(/\n{3,}/g, '\n\n');

  return html;
}

function fullHtml(body, theme, includeStyle) {
  const style = includeStyle ? `<style>${THEMES[theme] || THEMES.github}</style>` : '';
  return `<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${style}\n</head>\n<body>\n${body}\n</body>\n</html>`;
}

// ── UI ────────────────────────────────────────────────
const mdInput    = document.getElementById('md-input');
const previewPane= document.getElementById('preview-pane');
const htmlOutput = document.getElementById('html-output');
const statsEl    = document.getElementById('stats');

let currentView = 'preview';

function convert() {
  const text = mdInput.value;
  const html = mdToHtml(text);

  previewPane.innerHTML = html;
  htmlOutput.value = html;

  const lines = text.split('\n').length;
  const chars = text.length;
  statsEl.textContent = `${chars}文字 · ${lines}行`;

  chrome.storage.local.set({ mdText: text });
}

// Output tabs
document.querySelectorAll('.out-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.out-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentView = tab.dataset.view;
    previewPane.classList.toggle('hidden', currentView !== 'preview');
    htmlOutput.classList.toggle('hidden', currentView !== 'html');
  });
});

mdInput.addEventListener('input', convert);
document.getElementById('theme-select').addEventListener('change', convert);
document.getElementById('include-style').addEventListener('change', convert);
document.getElementById('btn-clear-md').addEventListener('click', () => { mdInput.value = ''; convert(); });

function copyBtn(btnId, textFn) {
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(textFn()).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ コピー済み';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    });
  });
}

copyBtn('btn-copy-html', () => mdToHtml(mdInput.value));
copyBtn('btn-copy-full', () => {
  const theme = document.getElementById('theme-select').value;
  const includeStyle = document.getElementById('include-style').checked;
  return fullHtml(mdToHtml(mdInput.value), theme, includeStyle);
});

// Init
chrome.storage.local.get(['mdText'], (data) => {
  if (data.mdText) mdInput.value = data.mdText;
  else mdInput.value = '# Markdown to HTML\n\n**太字** と *斜体* に対応しています。\n\n## 機能\n\n- 見出し (H1〜H6)\n- **太字** / *斜体* / ~~取り消し線~~\n- `インラインコード`\n- [リンク](https://example.com)\n- リスト\n- 引用文\n- テーブル\n- コードブロック\n\n```javascript\nconsole.log("Hello, World!");\n```\n\n> 引用テキストはこのように表示されます。\n\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| A   | B   | C   |\n| D   | E   | F   |';
  convert();
});
