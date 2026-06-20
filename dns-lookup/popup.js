const TYPE_MAP = {
  1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX',
  16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA',
};

// Cloudflare DNS over HTTPS
async function dnsQuery(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { Accept: 'application/dns-json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatRecord(rec, type) {
  const data = rec.data;
  switch (type) {
    case 'MX': {
      const parts = data.split(' ');
      return `Priority: ${parts[0]}  →  ${parts.slice(1).join(' ')}`;
    }
    case 'TXT': return data.replace(/^"|"$/g, '').replace(/""/g, '');
    case 'SOA': {
      const [ns, email, serial, refresh, retry, expire, minTTL] = data.split(' ');
      return `NS: ${ns}\nEmail: ${email}\nSerial: ${serial}\nRefresh: ${refresh}s`;
    }
    default: return data;
  }
}

function getActiveTypes() {
  return [...document.querySelectorAll('.rt-btn.active')].map(b => b.dataset.type);
}

let lastDomain = '';

async function lookup(domain) {
  domain = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  if (!domain) return;
  lastDomain = domain;

  const loadingEl = document.getElementById('loading');
  const errorEl   = document.getElementById('error-msg');
  const resultsEl = document.getElementById('results');
  const listEl    = document.getElementById('records-list');

  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  listEl.innerHTML = '';

  const types = getActiveTypes();
  if (!types.length) { loadingEl.classList.add('hidden'); return; }

  try {
    const responses = await Promise.all(types.map(t => dnsQuery(domain, t).catch(() => null)));

    document.getElementById('domain-badge').textContent = domain;
    resultsEl.classList.remove('hidden');

    let anyResults = false;
    types.forEach((type, i) => {
      const data = responses[i];
      const answers = data?.Answer || [];

      const section = document.createElement('div');
      section.className = 'record-section';

      const hdr = document.createElement('div');
      hdr.className = 'record-type-header';
      hdr.innerHTML = `<span class="type-badge type-${type}">${type}</span> ${answers.length} レコード`;
      section.appendChild(hdr);

      if (!answers.length) {
        const none = document.createElement('div');
        none.className = 'no-records';
        none.textContent = 'レコードなし';
        section.appendChild(none);
      } else {
        anyResults = true;
        answers.forEach(rec => {
          const item = document.createElement('div');
          item.className = 'record-item';
          const formatted = formatRecord(rec, type);
          item.innerHTML = `${formatted.replace(/\n/g,'<br>')}<span class="ttl">TTL: ${rec.TTL}s</span>`;
          item.title = 'クリックでコピー';
          item.addEventListener('click', () => {
            navigator.clipboard.writeText(formatted);
            item.classList.add('copied');
            setTimeout(() => item.classList.remove('copied'), 1000);
          });
          section.appendChild(item);
        });
      }

      listEl.appendChild(section);
    });

    chrome.storage.local.set({ lastDomain: domain });
  } catch (e) {
    errorEl.textContent = '❌ ' + e.message;
    errorEl.classList.remove('hidden');
    resultsEl.classList.add('hidden');
  }
  loadingEl.classList.add('hidden');
}

// Record type toggles
document.querySelectorAll('.rt-btn').forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('active'));
});

// Lookup button
document.getElementById('btn-lookup').addEventListener('click', () => {
  lookup(document.getElementById('domain-input').value);
});

document.getElementById('domain-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') lookup(document.getElementById('domain-input').value);
});

// Current tab URL
document.getElementById('btn-current').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    try {
      const host = new URL(tabs[0]?.url || '').hostname;
      if (host) {
        document.getElementById('domain-input').value = host;
        lookup(host);
      }
    } catch {}
  });
});

// Restore
chrome.storage.local.get(['lastDomain'], data => {
  if (data.lastDomain) {
    document.getElementById('domain-input').value = data.lastDomain;
  }
});
