let jobs = [], selectedJobId = null, searchQ = '', statusFilter = 'all';

const STATUS_LABELS = { new:'未読', interested:'興味あり', applied:'応募済み', rejected:'見送り' };
const STATUS_COLORS = { new:'status-new', interested:'status-interested', applied:'status-applied', rejected:'status-rejected' };

function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function save() { chrome.storage.local.set({ savedJobs: jobs }); }

// ── Scraper (injected into page) ──────────────────────
async function scrapeJobsFromPage(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Site-specific selectors
      const SITES = {
        'indeed': {
          cards: '.job_seen_beacon,.jobsearch-ResultsList > li',
          title: 'h2 a,[data-testid="jobTitle"]',
          company: '.companyName,[data-testid="company-name"]',
          location: '.companyLocation,[data-testid="text-location"]',
          salary: '.salary-snippet-container,.estimated-salary',
          link: 'h2 a',
        },
        'linkedin': {
          cards: '.job-search-card,.base-card',
          title: '.base-search-card__title,.job-search-card__title',
          company: '.base-search-card__subtitle',
          location: '.job-search-card__location',
          salary: '.job-search-card__salary-info',
          link: 'a.base-card__full-link',
        },
        'kyujinbox': {
          cards: '.rs-card,.job-list-item',
          title: '.rs-card__title,.job-title',
          company: '.rs-card__company,.company-name',
          location: '.rs-card__location,.work-place',
          salary: '.rs-card__salary,.salary',
          link: 'a',
        },
      };

      const host = location.hostname;
      let site = null;
      for (const [key] of Object.entries(SITES)) {
        if (host.includes(key)) { site = SITES[key]; break; }
      }

      // Generic fallback
      if (!site) {
        site = {
          cards: 'article,[class*="job"],[class*="Job"],[class*="listing"],[class*="vacancy"]',
          title: 'h1,h2,h3,[class*="title"],[class*="Title"]',
          company: '[class*="company"],[class*="Company"],[class*="employer"]',
          location: '[class*="location"],[class*="Location"],[class*="place"]',
          salary: '[class*="salary"],[class*="Salary"],[class*="pay"],[class*="compensation"]',
          link: 'a',
        };
      }

      const extractedJobs = [];
      const cardEls = document.querySelectorAll(site.cards);

      cardEls.forEach(card => {
        const getText = sel => card.querySelector(sel)?.textContent?.trim() || '';
        const getHref = sel => {
          const el = card.querySelector(sel);
          if (!el) return location.href;
          const href = el.getAttribute('href') || '';
          return href.startsWith('http') ? href : location.origin + href;
        };

        const title = getText(site.title);
        if (!title || title.length < 3) return;

        const salary = getText(site.salary);
        const location2 = getText(site.location);

        // Detect remote
        const fullText = card.textContent || '';
        const isRemote = /リモート|remote|テレワーク|在宅/i.test(fullText);

        // Detect employment type
        const typeMatch = fullText.match(/正社員|契約社員|アルバイト|パート|業務委託|派遣|フリーランス|full.?time|part.?time|contract|freelance/i);
        const empType = typeMatch ? typeMatch[0] : '';

        extractedJobs.push({
          title,
          company: getText(site.company),
          location: location2,
          salary,
          empType,
          isRemote,
          url: getHref(site.link),
          snippet: fullText.slice(0, 200),
          scrapedAt: new Date().toISOString(),
          source: location.hostname,
        });
      });

      // If no structured cards, try to extract a single job detail page
      if (extractedJobs.length === 0) {
        const h1 = document.querySelector('h1')?.textContent?.trim();
        if (h1) {
          const bodyText = document.body.innerText;
          const salaryMatch = bodyText.match(/([0-9,，]+)\s*[万千百]?円|¥\s*([0-9,]+)/);
          const locationMatch = bodyText.match(/東京|大阪|名古屋|福岡|札幌|横浜|神奈川|埼玉|千葉|京都|兵庫/);
          extractedJobs.push({
            title: h1,
            company: document.querySelector('[class*="company"],[class*="employer"]')?.textContent?.trim() || '',
            location: locationMatch ? locationMatch[0] : '',
            salary: salaryMatch ? salaryMatch[0] : '',
            empType: '',
            isRemote: /リモート|remote|テレワーク|在宅/i.test(bodyText),
            url: location.href,
            snippet: bodyText.slice(0, 300),
            scrapedAt: new Date().toISOString(),
            source: location.hostname,
          });
        }
      }

      return extractedJobs;
    },
  });
  return result?.result || [];
}

// ── Extract button ────────────────────────────────────
document.getElementById('btn-extract-page').addEventListener('click', async () => {
  const btn = document.getElementById('btn-extract-page');
  btn.textContent = '⏳ 取得中...'; btn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('タブが取得できません');

    const scraped = await scrapeJobsFromPage(tab.id);
    if (!scraped.length) {
      alert('求人情報が見つかりませんでした。\nIndeed・LinkedIn・求人ボックス等の求人一覧ページで試してください。');
      return;
    }

    let added = 0;
    scraped.forEach(j => {
      if (jobs.some(existing => existing.url === j.url && existing.title === j.title)) return;
      jobs.unshift({ id: uuid(), ...j, status: 'new', memo: '', savedAt: Date.now() });
      added++;
    });

    save();
    renderList();
    document.getElementById('btn-export-csv').disabled = !jobs.length;
    alert(`✅ ${added}件の求人を取得しました（重複除く）`);
  } catch (e) {
    alert('❌ ' + e.message);
  } finally {
    btn.textContent = '📋 このページから取得'; btn.disabled = false;
  }
});

// ── Render list ───────────────────────────────────────
function renderList() {
  const list = document.getElementById('job-list');

  // Stats
  const counts = { new:0, interested:0, applied:0, rejected:0 };
  jobs.forEach(j => { if (counts[j.status] !== undefined) counts[j.status]++; });
  const dotColors = { new:'#64748b', interested:'#60a5fa', applied:'#4ade80', rejected:'#f87171' };
  document.getElementById('stats-bar').innerHTML =
    `<span>計 <b>${jobs.length}</b>件</span>` +
    Object.entries(counts).map(([s,c])=>`<span><span class="stat-dot" style="background:${dotColors[s]}"></span>${STATUS_LABELS[s]}: ${c}</span>`).join('');

  list.innerHTML = '';
  const filtered = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return [j.title, j.company, j.location, j.salary].some(t => t?.toLowerCase().includes(q));
    }
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">${jobs.length ? '条件に一致する求人がありません' : '📭 求人を取得していません<br><small>求人サイトの一覧ページで「このページから取得」を押してください</small>'}</div>`;
    return;
  }

  filtered.forEach(job => {
    const card = document.createElement('div');
    card.className = 'job-card';
    const chips = [
      job.salary   ? `<span class="chip salary">¥ ${job.salary.slice(0,20)}</span>` : '',
      job.location ? `<span class="chip location">📍 ${job.location.slice(0,20)}</span>` : '',
      job.empType  ? `<span class="chip type">${job.empType}</span>` : '',
      job.isRemote ? `<span class="chip remote">🏠 リモート</span>` : '',
    ].filter(Boolean).join('');

    const savedDate = new Date(job.savedAt).toLocaleDateString('ja-JP', { month:'numeric', day:'numeric' });

    card.innerHTML = `
      <div class="jc-top">
        <div class="jc-info">
          <div class="jc-title">${job.title}</div>
          <div class="jc-company">${job.company || job.source}</div>
          <div class="jc-chips">${chips}<span class="chip date">${savedDate}</span></div>
        </div>
        <span class="status-badge ${STATUS_COLORS[job.status] || 'status-new'}">${STATUS_LABELS[job.status]}</span>
      </div>
    `;
    card.addEventListener('click', () => showDetail(job.id));
    list.appendChild(card);
  });
}

// ── Detail view ───────────────────────────────────────
function showDetail(id) {
  const job = jobs.find(j => j.id === id);
  if (!job) return;
  selectedJobId = id;

  document.getElementById('job-list').style.display = 'none';
  document.getElementById('filter-bar').style.display = 'none';
  document.getElementById('stats-bar').style.display = 'none';
  document.getElementById('job-detail').classList.remove('hidden');

  document.getElementById('d-title').textContent = job.title;
  document.getElementById('d-company').textContent = [job.company, job.source].filter(Boolean).join(' · ');
  document.getElementById('detail-link').href = job.url;
  document.getElementById('job-memo').value = job.memo || '';

  const chips = [
    job.salary   ? `<span class="chip salary">¥ ${job.salary}</span>` : '',
    job.location ? `<span class="chip location">📍 ${job.location}</span>` : '',
    job.empType  ? `<span class="chip type">${job.empType}</span>` : '',
    job.isRemote ? `<span class="chip remote">🏠 リモート可</span>` : '',
  ].filter(Boolean).join('');
  document.getElementById('detail-chips').innerHTML = chips;
  document.getElementById('d-desc').textContent = job.snippet || '';

  const statusSel = document.getElementById('detail-status');
  statusSel.innerHTML = Object.entries(STATUS_LABELS).map(([v,l]) =>
    `<option value="${v}" ${job.status===v?'selected':''}>${l}</option>`).join('');
  statusSel.addEventListener('change', () => {
    job.status = statusSel.value; save(); renderList();
  });
}

document.getElementById('btn-back').addEventListener('click', () => {
  document.getElementById('job-detail').classList.add('hidden');
  document.getElementById('job-list').style.display = '';
  document.getElementById('filter-bar').style.display = '';
  document.getElementById('stats-bar').style.display = '';
  selectedJobId = null;
});

document.getElementById('btn-save-memo').addEventListener('click', () => {
  const job = jobs.find(j => j.id === selectedJobId);
  if (!job) return;
  job.memo = document.getElementById('job-memo').value;
  save();
  document.getElementById('btn-save-memo').textContent = '✓ 保存済み';
  setTimeout(() => document.getElementById('btn-save-memo').textContent = '保存', 1500);
});

document.getElementById('btn-delete-job').addEventListener('click', () => {
  if (!selectedJobId || !confirm('この求人を削除しますか？')) return;
  jobs = jobs.filter(j => j.id !== selectedJobId);
  save(); document.getElementById('btn-back').click(); renderList();
});

// ── CSV export ────────────────────────────────────────
document.getElementById('btn-export-csv').addEventListener('click', () => {
  const headers = ['タイトル','企業','勤務地','給与','雇用形態','リモート','ステータス','メモ','URL','取得日'];
  const rows = jobs.map(j => [
    j.title, j.company, j.location, j.salary, j.empType,
    j.isRemote ? 'あり' : 'なし', STATUS_LABELS[j.status], j.memo,
    j.url, new Date(j.savedAt).toLocaleDateString('ja-JP'),
  ].map(v => `"${(v||'').replace(/"/g,'""')}"`));
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jobs_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
});

// ── Search & filter ───────────────────────────────────
document.getElementById('search-jobs').addEventListener('input', e => { searchQ = e.target.value; renderList(); });
document.getElementById('status-filter').addEventListener('change', e => { statusFilter = e.target.value; renderList(); });
document.getElementById('btn-clear-all').addEventListener('click', () => {
  if (jobs.length && confirm(`${jobs.length}件の求人を全て削除しますか？`)) {
    jobs = []; save(); renderList();
    document.getElementById('btn-export-csv').disabled = true;
  }
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['savedJobs'], d => {
  jobs = d.savedJobs || [];
  document.getElementById('btn-export-csv').disabled = !jobs.length;
  renderList();
});
