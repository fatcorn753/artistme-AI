const LANG_COLORS = {
  JavaScript:'#f1e05a',TypeScript:'#3178c6',Python:'#3572A5',Java:'#b07219',
  'C++':'#f34b7d','C#':'#178600',Go:'#00ADD8',Rust:'#dea584',Ruby:'#701516',
  PHP:'#4F5D95',Swift:'#F05138',Kotlin:'#A97BFF',HTML:'#e34c26',CSS:'#563d7c',
  Shell:'#89e051',Vue:'#41b883',React:'#61dafb',Dart:'#00B4AB',Scala:'#c22d40',
};

async function gh(path) {
  const res = await fetch('https://api.github.com' + path, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ── Scrape contribution graph from GitHub profile page ──
async function scrapeContributions(username) {
  try {
    const res = await fetch(`https://github.com/${username}`, {
      headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();

    // Extract contribution counts from SVG rect elements
    const rectMatches = [...html.matchAll(/data-count="(\d+)"[^>]*data-date="([0-9-]+)"/g)];
    const days = rectMatches.map(m => ({ count: parseInt(m[1]), date: m[2] }));

    // Extract total contribution count
    const totalMatch = html.match(/(\d[\d,]+)\s*contributions? in the last year/i);
    const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : null;

    // Extract streak info from page
    const currentStreakMatch = html.match(/Current streak[^<]*<[^>]+>(\d+)/i);

    return { days: days.slice(-365), total, currentStreak: currentStreakMatch ? parseInt(currentStreakMatch[1]) : null };
  } catch {
    return { days: [], total: null };
  }
}

// ── Main analysis ─────────────────────────────────────
async function analyze(username) {
  const loadingEl = document.getElementById('loading');
  const dashEl    = document.getElementById('dashboard');
  const errorEl   = document.getElementById('error-state');
  const emptyEl   = document.getElementById('empty-state');

  loadingEl.classList.remove('hidden');
  dashEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  emptyEl.classList.add('hidden');

  try {
    // Parallel: API + page scraping
    const [user, repos, events, contribData] = await Promise.all([
      gh(`/users/${username}`),
      gh(`/users/${username}/repos?per_page=100&sort=stars`),
      gh(`/users/${username}/events/public?per_page=30`),
      scrapeContributions(username),
    ]);

    loadingEl.classList.add('hidden');
    dashEl.classList.remove('hidden');

    renderProfile(user);
    renderKPIs(user, repos, contribData);
    renderContribHeatmap(contribData);
    renderLanguages(repos);
    renderTopRepos(repos);
    renderActivity(events);

    chrome.storage.local.set({ ghLastUser: username });
  } catch (e) {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorEl.textContent = '❌ ' + (e.message || 'ユーザーが見つかりません');
  }
}

function renderProfile(user) {
  document.getElementById('avatar').src = user.avatar_url;
  document.getElementById('profile-name').textContent  = user.name || user.login;
  document.getElementById('profile-login').textContent = '@' + user.login;
  document.getElementById('profile-bio').textContent   = user.bio || [user.company, user.location].filter(Boolean).join(' · ') || '';
}

function renderKPIs(user, repos, contribData) {
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const kpis = [
    ['⭐', totalStars.toLocaleString(), 'Total Stars'],
    ['📦', user.public_repos, 'リポジトリ'],
    ['👥', user.followers.toLocaleString(), 'フォロワー'],
    ['📝', contribData.total?.toLocaleString() || '—', 'コントリビュ'],
  ];
  document.getElementById('kpi-row').innerHTML = kpis.map(([icon, val, lbl]) =>
    `<div class="kpi-card"><div class="kpi-val">${icon} ${val}</div><div class="kpi-lbl">${lbl}</div></div>`
  ).join('');
}

function renderContribHeatmap(contribData) {
  const canvas = document.getElementById('contrib-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 380, 70);
  ctx.fillStyle = '#161b22'; ctx.fillRect(0, 0, 380, 70);

  const days = contribData.days.slice(-52 * 7); // Last 52 weeks
  if (!days.length) {
    ctx.fillStyle = '#30363d'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('コントリビューションデータを取得できません', 190, 35); return;
  }

  const maxCount = Math.max(...days.map(d => d.count), 1);
  const cellSize = 9, gap = 2, step = cellSize + gap;
  const startX = 4, startY = 8;

  days.forEach((day, i) => {
    const week = Math.floor(i / 7);
    const dow  = i % 7;
    const x = startX + week * step;
    const y = startY + dow * step;
    const intensity = day.count / maxCount;
    const alpha = day.count === 0 ? 0.1 : 0.2 + intensity * 0.8;
    ctx.fillStyle = `rgba(57,211,83,${alpha})`;
    ctx.beginPath(); ctx.roundRect(x, y, cellSize, cellSize, 2); ctx.fill();
  });

  // Summary
  const totalThisYear = days.reduce((s, d) => s + d.count, 0);
  const maxDay = days.reduce((a, b) => a.count > b.count ? a : b, { count: 0 });
  document.getElementById('contrib-summary').textContent =
    `直近${days.length}日: ${totalThisYear.toLocaleString()}コントリビューション | 最多日: ${maxDay.count}回 (${maxDay.date})`;
}

function renderLanguages(repos) {
  const langBytes = {};
  repos.filter(r => !r.fork && r.language).forEach(r => {
    langBytes[r.language] = (langBytes[r.language] || 0) + (r.size || 1);
  });
  const sorted = Object.entries(langBytes).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total  = sorted.reduce((s, [, v]) => s + v, 0) || 1;

  const canvas = document.getElementById('lang-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 170, 120);
  ctx.fillStyle = '#161b22'; ctx.fillRect(0, 0, 170, 120);

  const cx = 60, cy = 60, r = 50;
  let start = -Math.PI / 2;
  sorted.forEach(([lang, bytes]) => {
    const sweep = (bytes / total) * Math.PI * 2;
    const color = LANG_COLORS[lang] || '#8b949e';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + sweep);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    start += sweep;
  });

  // Inner circle (donut)
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#161b22'; ctx.fill();

  // Legend
  ctx.textAlign = 'left';
  sorted.forEach(([lang, bytes], i) => {
    const pct = Math.round(bytes / total * 100);
    const color = LANG_COLORS[lang] || '#8b949e';
    const y = 14 + i * 20;
    ctx.fillStyle = color;
    ctx.fillRect(120, y - 6, 10, 10);
    ctx.fillStyle = '#8b949e'; ctx.font = '9px sans-serif';
    ctx.fillText(`${lang.slice(0, 10)} ${pct}%`, 134, y + 2);
  });
}

function renderTopRepos(repos) {
  const top = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 4);
  document.getElementById('top-repos').innerHTML = top.map(r => `
    <div class="repo-item" onclick="chrome.tabs.create({url:'${r.html_url}'})">
      <div class="repo-name">${r.name}</div>
      <div class="repo-meta">
        <span class="repo-stars">⭐ ${r.stargazers_count}</span>
        ${r.language ? `<span class="repo-lang">${r.language}</span>` : ''}
        <span>🍴 ${r.forks_count}</span>
      </div>
    </div>
  `).join('');
}

function renderActivity(events) {
  const TYPE_ICONS = {
    PushEvent:'📝', CreateEvent:'✨', PullRequestEvent:'🔀', IssuesEvent:'🐛',
    WatchEvent:'⭐', ForkEvent:'🍴', ReleaseEvent:'🚀', DeleteEvent:'🗑',
    CommitCommentEvent:'💬', IssueCommentEvent:'💬',
  };
  const TYPE_TEXT = {
    PushEvent: e => `<a href="https://github.com/${e.repo.name}" target="_blank">${e.repo.name}</a> にプッシュ (${e.payload.commits?.length || 0}コミット)`,
    CreateEvent: e => `<a href="https://github.com/${e.repo.name}" target="_blank">${e.repo.name}</a> に${e.payload.ref_type}を作成`,
    PullRequestEvent: e => `<a href="https://github.com/${e.repo.name}" target="_blank">${e.repo.name}</a> PR: ${e.payload.action}`,
    IssuesEvent: e => `<a href="https://github.com/${e.repo.name}" target="_blank">${e.repo.name}</a> Issue: ${e.payload.action}`,
    WatchEvent: e => `<a href="https://github.com/${e.repo.name}" target="_blank">${e.repo.name}</a> をスター`,
    ForkEvent: e => `<a href="https://github.com/${e.repo.name}" target="_blank">${e.repo.name}</a> をフォーク`,
    ReleaseEvent: e => `<a href="https://github.com/${e.repo.name}" target="_blank">${e.repo.name}</a> リリース公開`,
  };

  const listEl = document.getElementById('activity-list');
  listEl.innerHTML = events.slice(0, 8).map(e => {
    const icon = TYPE_ICONS[e.type] || '📌';
    const text = (TYPE_TEXT[e.type] || (() => e.repo.name))(e);
    const date = new Date(e.created_at).toLocaleDateString('ja-JP', { month:'numeric', day:'numeric' });
    return `<div class="activity-item"><span class="act-icon">${icon}</span><span class="act-text">${text}</span><span class="act-date">${date}</span></div>`;
  }).join('') || '<div style="color:#484f58;font-size:11px;padding:8px">アクティビティなし</div>';
}

// ── Controls ──────────────────────────────────────────
document.getElementById('btn-analyze').addEventListener('click', () => {
  const u = document.getElementById('username-input').value.trim();
  if (u) analyze(u);
});
document.getElementById('username-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-analyze').click();
});

document.getElementById('btn-scrape-page').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('github.com')) { alert('GitHubのページを開いてください'); return; }
  const match = tab.url.match(/github\.com\/([^/?#]+)/);
  if (match && match[1] && !['login','explore','trending','topics'].includes(match[1])) {
    document.getElementById('username-input').value = match[1];
    analyze(match[1]);
  } else {
    alert('GitHubユーザープロフィールページを開いてください');
  }
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['ghLastUser'], d => {
  if (d.ghLastUser) {
    document.getElementById('username-input').value = d.ghLastUser;
    analyze(d.ghLastUser);
  }
});
