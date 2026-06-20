// Auto-format JSON pages (when the entire page content is raw JSON)
(function () {
  if (document.contentType !== 'application/json') return;
  const pre = document.querySelector('pre');
  if (!pre) return;
  try {
    const parsed = JSON.parse(pre.textContent);
    pre.textContent = JSON.stringify(parsed, null, 2);
    pre.style.cssText = 'font-family: monospace; font-size: 13px; line-height: 1.6; padding: 16px; color: #c9d1d9; background: #0d1117; min-height: 100vh; margin: 0;';
    document.body.style.background = '#0d1117';
  } catch {}
})();
