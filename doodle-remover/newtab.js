// Enterキーで検索
document.getElementById('search-form').addEventListener('submit', (e) => {
  const q = document.getElementById('search-input').value.trim();
  if (!q) {
    e.preventDefault();
    window.location.href = 'https://www.google.com';
  }
});

// ページ読み込み時に検索欄にフォーカス
document.getElementById('search-input').focus();
