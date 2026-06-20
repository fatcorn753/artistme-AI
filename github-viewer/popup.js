const LANG_COLORS = {
  JavaScript:'#f1e05a', TypeScript:'#3178c6', Python:'#3572A5', Java:'#b07219',
  'C++':'#f34b7d', C:'#555555', 'C#':'#178600', Go:'#00ADD8', Rust:'#dea584',
  Ruby:'#701516', PHP:'#4F5D95', Swift:'#F05138', Kotlin:'#A97BFF', Dart:'#00B4AB',
  HTML:'#e34c26', CSS:'#563d7c', Shell:'#89e051', Vue:'#41b883', Svelte:'#ff3e00',
  R:'#198CE7', Scala:'#c22d40', Haskell:'#5e5086', Elixir:'#6e4a7e',
};

let recentUsers = [];
let allRepos = [];
let currentUser = null;

const GITHUB_API = 'https://api.github.com';

async function gh(path) {
  const res = await fetch(GITHUB_API + path, {
    headers: { Accept: 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function setLoading(v) { document.getElementById('loading').classList.toggle('hidden', !v); }
function setError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg; el.classList.toggle('hidden', !msg);
}

async function searchUser(username) {
  username = username.trim();
  if (!username) return;
  setLoading(true); setError('');
  document.getElementById('profile-section').classList.add('hidden');

  try {
    const [user, repos] = await Promise.all([
      gh(`/users/${username}`),
      gh(`/users/${username}/repos?per_page=100&sort=updated`),
    ]);
    currentUser = user;
    allRepos = repos;

    renderProfile(user);
    renderRepos(repos);
    renderLangs(repos);
    renderContrib(user, repos);

    document.getElementById('profile-section').classList.remove('hidden');
    document.getElementById('recent-section').classList.add('hidden');

    // Save recent
    recentUsers = [{ login: user.login, avatar: user.avatar_url },
                   ...recentUsers.filter(u => u.login !== user.login)].slice(0, 8);
    chrome.storage.local.set({ recentUsers, lastUsername: username });
  } catch (e) {
    setError('❌ ユーザーが見つかりません: ' + username);
  }
  setLoading(false);
}

function renderProfile(user) {
  document.getElementById('user-avatar').src = user.avatar_url;
  document.getElementById('user-name').textContent  = user.name || user.login;
  document.getElementById('user-login').textContent = '@' + user.login;
  document.getElementById('user-bio').textContent   = user.bio || '';
  document.getElementById('user-link').href = user.html_url;

  const meta = [];
  if (user.company)  meta.push('🏢 ' + user.company);
  if (user.location) meta.push('📍 ' + user.location);
  if (user.blog)     meta.push('🔗 ' + user.blog.replace(/^https?:\/\//, ''));
  if (user.twitter_username) meta.push('🐦 @' + user.twitter_username);
  document.getElementById('user-meta').textContent = meta.join('  ');

  const statsRow = document.getElementById('stats-row');
  statsRow.innerHTML = [
    ['リポジトリ', user.public_repos],
    ['フォロワー', user.followers],
    ['フォロー中', user.following],
    ['Gist', user.public_gists],
  ].map(([l,v]) => `
    <div class="stat-item">
      <div class="stat-val">${v.toLocaleString()}</div>
      <div class="stat-lbl">${l}</div>
    </div>
  `).join('');
}

function renderRepos(repos) {
  const sort = document.getElementById('repo-sort').value;
  const q    = document.getElementById('repo-search').value.toLowerCase();

  let filtered = repos.filter(r => !q || r.name.toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q));
  if (sort === 'stars')   filtered.sort((a,b) => b.stargazers_count - a.stargazers_count);
  else if (sort === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name));

  const list = document.getElementById('repo-list');
  list.innerHTML = '';
  filtered.slice(0, 30).forEach(repo => {
    const color = LANG_COLORS[repo.language] || '#8b949e';
    const updatedAgo = timeAgo(new Date(repo.updated_at));
    const topics = (repo.topics || []).slice(0, 2).map(t => `<span class="repo-topic">${t}</span>`).join('');
    const div = document.createElement('div');
    div.className = 'repo-card';
    div.innerHTML = `
      <div class="repo-top">
        <span class="repo-name">${repo.name}</span>
        ${repo.fork ? '<span class="repo-fork-badge">fork</span>' : ''}
        ${topics}
      </div>
      ${repo.description ? `<div class="repo-desc">${repo.description}</div>` : ''}
      <div class="repo-meta">
        ${repo.language ? `<span class="repo-lang"><span class="lang-dot" style="background:${color}"></span>${repo.language}</span>` : ''}
        ${repo.stargazers_count > 0 ? `<span class="repo-stars">⭐ ${repo.stargazers_count.toLocaleString()}</span>` : ''}
        ${repo.forks_count > 0 ? `<span class="repo-forks">🍴 ${repo.forks_count.toLocaleString()}</span>` : ''}
        <span class="repo-updated">${updatedAgo}</span>
      </div>
    `;
    div.addEventListener('click', () => chrome.tabs.create({ url: repo.html_url }));
    list.appendChild(div);
  });
}

function renderLangs(repos) {
  const langBytes = {};
  repos.filter(r => !r.fork && r.language).forEach(r => {
    langBytes[r.language] = (langBytes[r.language] || 0) + (r.size || 1);
  });
  const total = Object.values(langBytes).reduce((s,v)=>s+v,0) || 1;
  const sorted = Object.entries(langBytes).sort((a,b)=>b[1]-a[1]).slice(0, 10);

  const canvas = document.getElementById('lang-chart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw horizontal bar chart
  const H = 160, W = 340, pad = { l: 90, r: 60, t: 10, b: 10 };
  const barArea = H - pad.t - pad.b;
  const barH = Math.min(16, barArea / sorted.length - 4);

  sorted.forEach(([lang, bytes], i) => {
    const pct = bytes / total;
    const color = LANG_COLORS[lang] || '#8b949e';
    const y = pad.t + i * (barH + 5);
    const bw = (W - pad.l - pad.r) * pct;

    ctx.fillStyle = '#161b22';
    ctx.fillRect(pad.l, y, W - pad.l - pad.r, barH);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(pad.l, y, bw, barH, 3); ctx.fill();

    ctx.fillStyle = '#8b949e'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(lang, pad.l - 4, y + barH - 2);
    ctx.fillStyle = '#484f58'; ctx.textAlign = 'left';
    ctx.fillText((pct*100).toFixed(1)+'%', pad.l + bw + 4, y + barH - 2);
  });

  // Legend
  const legend = document.getElementById('lang-legend');
  legend.innerHTML = sorted.map(([lang, bytes]) => {
    const color = LANG_COLORS[lang] || '#8b949e';
    const pct = (bytes/total*100).toFixed(1);
    return `<div class="lang-item"><div class="lang-item-dot" style="background:${color}"></div>${lang} <span class="lang-pct">${pct}%</span></div>`;
  }).join('');
}

function renderContrib(user, repos) {
  const totalStars = repos.reduce((s,r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s,r) => s + r.forks_count, 0);
  const ownRepos   = repos.filter(r => !r.fork).length;

  document.getElementById('contrib-stats').innerHTML = [
    ['総Stars', totalStars.toLocaleString(), '#fbbf24'],
    ['総Forks', totalForks.toLocaleString(), '#60a5fa'],
    ['自作Repo', ownRepos, '#4ade80'],
  ].map(([l,v,c]) => `
    <div class="cs-item">
      <div class="cs-val" style="color:${c}">${v}</div>
      <div class="cs-lbl">${l}</div>
    </div>
  `).join('');

  // Activity chart (repos updated per month last 6 months)
  const canvas = document.getElementById('contrib-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 340, 80);
  const months = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    months[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0;
  }
  repos.forEach(r => {
    const key = r.updated_at?.slice(0, 7);
    if (key in months) months[key]++;
  });
  const vals = Object.values(months);
  const maxV = Math.max(...vals, 1);
  const mKeys = Object.keys(months);
  const barW = 340 / 6;
  vals.forEach((v, i) => {
    const bh = v / maxV * 60;
    const bx = i * barW + 4;
    ctx.fillStyle = '#0d2235';
    ctx.beginPath(); ctx.roundRect(bx, 70-bh, barW-8, bh, 3); ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath(); ctx.roundRect(bx, 70-bh, barW-8, bh, 3); ctx.fill();
    ctx.fillStyle = '#484f58'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(mKeys[i].slice(5), bx + (barW-8)/2, 79);
  });
}

function timeAgo(date) {
  const d = Date.now() - date;
  if (d < 86400000)   return Math.floor(d/3600000) + '時間前';
  if (d < 2592000000) return Math.floor(d/86400000) + '日前';
  if (d < 31536000000) return Math.floor(d/2592000000) + 'ヶ月前';
  return Math.floor(d/31536000000) + '年前';
}

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

// ── Repo filter ───────────────────────────────────────
document.getElementById('repo-search').addEventListener('input', () => renderRepos(allRepos));
document.getElementById('repo-sort').addEventListener('change', () => renderRepos(allRepos));

// ── Recent ────────────────────────────────────────────
function renderRecent() {
  const list = document.getElementById('recent-list');
  list.innerHTML = '';
  recentUsers.forEach(u => {
    const chip = document.createElement('div');
    chip.className = 'recent-chip';
    chip.innerHTML = `<img class="recent-avatar" src="${u.avatar}" alt=""><span>${u.login}</span>`;
    chip.addEventListener('click', () => {
      document.getElementById('username-input').value = u.login;
      searchUser(u.login);
    });
    list.appendChild(chip);
  });
}

// ── Search ────────────────────────────────────────────
document.getElementById('btn-search').addEventListener('click', () => {
  searchUser(document.getElementById('username-input').value);
});
document.getElementById('username-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchUser(document.getElementById('username-input').value);
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['recentUsers', 'lastUsername'], d => {
  recentUsers = d.recentUsers || [];
  renderRecent();
  if (d.lastUsername) {
    document.getElementById('username-input').value = d.lastUsername;
    searchUser(d.lastUsername);
  }
});
