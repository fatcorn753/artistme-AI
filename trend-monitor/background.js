// Auto-refresh trends every 30 minutes
chrome.alarms.create('refresh-trends', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'refresh-trends') fetchAllTrends();
});

async function fetchAllTrends() {
  const results = {};
  await Promise.allSettled([
    fetchHackerNews().then(d => results.hn = d),
    fetchGitHubTrending().then(d => results.gh = d),
    fetchRedditTech().then(d => results.reddit = d),
    fetchDevTo().then(d => results.devto = d),
  ]);
  chrome.storage.local.set({ trendData: results, lastFetched: Date.now() });
}

async function fetchHackerNews() {
  const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  const ids = (await res.json()).slice(0, 20);
  const items = await Promise.all(
    ids.map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()))
  );
  return items.filter(Boolean).map(item => ({
    id: String(item.id),
    title: item.title,
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    score: item.score,
    comments: item.descendants || 0,
    author: item.by,
    source: 'Hacker News',
    icon: '🔶',
  }));
}

async function fetchGitHubTrending() {
  // Scrape GitHub Trending page (public, no auth needed)
  const res = await fetch('https://github.com/trending?since=daily', {
    headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();

  // Parse repo articles
  const repoPattern = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  const repos = [];
  let match;

  while ((match = repoPattern.exec(html)) !== null && repos.length < 20) {
    const block = match[1];
    const nameMatch = block.match(/href="\/([^"]+)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>[^<]*<span[^>]*>([^<]+)/);
    if (!nameMatch) continue;
    const fullName = nameMatch[1].replace(/\s/g, '');
    const starsMatch = block.match(/aria-label="([0-9,]+)\s*users? starred/);
    const langMatch = block.match(/itemprop="programmingLanguage"[^>]*>([^<]+)/);
    const descMatch = block.match(/<p[^>]*class="[^"]*color-fg-muted[^"]*"[^>]*>\s*([^<]+?)\s*<\/p>/);
    const todayMatch = block.match(/([0-9,]+)\s*stars? today/);

    repos.push({
      id: fullName,
      title: fullName,
      url: `https://github.com/${fullName}`,
      description: descMatch ? descMatch[1].trim() : '',
      stars: starsMatch ? starsMatch[1].replace(/,/g, '') : '0',
      todayStars: todayMatch ? todayMatch[1].replace(/,/g, '') : '0',
      language: langMatch ? langMatch[1].trim() : '',
      source: 'GitHub Trending',
      icon: '⬡',
    });
  }
  return repos;
}

async function fetchRedditTech() {
  const res = await fetch('https://www.reddit.com/r/programming/hot.json?limit=20', {
    headers: { 'User-Agent': 'TrendMonitor/1.0' }
  });
  const data = await res.json();
  return (data.data?.children || []).map(({ data: p }) => ({
    id: p.id,
    title: p.title,
    url: p.url || `https://reddit.com${p.permalink}`,
    score: p.score,
    comments: p.num_comments,
    author: p.author,
    subreddit: p.subreddit_name_prefixed,
    source: 'Reddit',
    icon: '🟠',
  }));
}

async function fetchDevTo() {
  const res = await fetch('https://dev.to/api/articles?top=1&per_page=20');
  const articles = await res.json();
  return articles.map(a => ({
    id: String(a.id),
    title: a.title,
    url: a.url,
    score: a.positive_reactions_count,
    comments: a.comments_count,
    author: a.user?.name || a.user?.username,
    tags: a.tag_list,
    source: 'DEV.to',
    icon: '👩‍💻',
  }));
}

// Run immediately on install
fetchAllTrends();
