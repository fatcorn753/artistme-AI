const CATEGORIES = [
  { icon: '😀', label: '顔・感情', emojis: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','🤠','🥳','😷','🤒','🤕','🤢','🤮','🤧','😇','🥸','🤡','🤫','🤭','🧐','🤓','😈','👿','💀','☠️','💩','👹','👺','👻','👽','👾','🤖'] },
  { icon: '👋', label: '手・体', emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🦷','🦴','👀','👁','👅','👄','💋','🫀','🫁','🧠','🦷'] },
  { icon: '👨', label: '人物', emojis: ['👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷','👮','🕵️','💂','🥷','👷','🫅','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧝','🧛','🧟','🧌','🧞','🧜','🧚','🧑‍🤝‍🧑','👫','👬','👭'] },
  { icon: '🐶', label: '動物・自然', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔'] },
  { icon: '🍎', label: '食べ物', emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🧄','🧅','🥔','🌽','🫒','🍠','🫘','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🫖','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'] },
  { icon: '⚽', label: 'スポーツ・活動', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🎿','⛷','🏂','🏋️','🤸','⛹️','🤺','🤼','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖','🎗','🏵','🎫','🎟','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'] },
  { icon: '🚗', label: '乗り物・場所', emojis: ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','⛽','🛞','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🚤','🛥','🛳','⛴','🚢','✈️','🛩','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰','🚀','🛸','🌍','🌎','🌏','🌐','🗺','🧭','⛰','🏔','🗻','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🧱','🪨','🪵','🛖','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩','🕋','⛲','⛺','🌁','🌃','🏙','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🛝','🎡','🎢','💈','🎪','🌌','🎑','🏞'] },
  { icon: '❤️', label: 'シンボル', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅'] },
  { icon: '🌟', label: 'その他', emojis: ['🌟','⭐','🌠','✨','💫','⚡','🔥','💥','❄️','🌊','🌈','🌤','⛅','🌦','🌧','⛈','🌩','🌨','🌪','🌫','🌬','🌀','🌻','🌺','🌹','🥀','🌷','🌱','🌲','🌳','🌴','🌵','🌾','🍄','🐚','🪸','🪨','🌙','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌞','🪐','💎','💰','💴','💵','💶','💷','💸','💳','🪙','💹','✉️','📧','📨','📩','📤','📥','📦','📫','📪','📬','📭','📮','🗳','✏️','✒️','🖊','🖋','📝','💼','📁','📂','🗂','📅','📆','🗒','🗓','📇','📈','📉','📊','📋','📌','📍','📎','🖇','📏','📐','✂️','🗃','🗄','🗑','🔒','🔓','🔏','🔐','🔑','🗝','🔨','🪓','⛏','⚒','🛠','🗡','⚔️','🔫','🪃','🏹','🛡','🪚','🔧','🪛','🔩','⚙️','🗜','⚖️','🦯','🔗','⛓','🪝','🧲','🪜','🧰','🧲'] },
];

const searchEl  = document.getElementById('search');
const gridEl    = document.getElementById('emoji-grid');
const tabsEl    = document.getElementById('cat-tabs');
const recentEl  = document.getElementById('recent-row');
const toastEl   = document.getElementById('toast');

let currentCat = 0;
let recent = [];
let toastTimer = null;

// ── Build category tabs ───────────────────────────────
CATEGORIES.forEach((cat, i) => {
  const btn = document.createElement('button');
  btn.className = 'cat-tab' + (i === 0 ? ' active' : '');
  btn.textContent = cat.icon;
  btn.title = cat.label;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCat = i;
    searchEl.value = '';
    renderGrid(cat.emojis);
  });
  tabsEl.appendChild(btn);
});

// ── Render grid ───────────────────────────────────────
function renderGrid(emojis) {
  gridEl.innerHTML = '';
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.title = emoji;
    btn.addEventListener('click', () => copyEmoji(emoji, btn));
    gridEl.appendChild(btn);
  });
}

// ── Copy ──────────────────────────────────────────────
function copyEmoji(emoji, btn) {
  navigator.clipboard.writeText(emoji).then(() => {
    if (btn) { btn.classList.add('copied'); setTimeout(() => btn.classList.remove('copied'), 600); }
    showToast(`${emoji} コピー！`);
    addRecent(emoji);
  });
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
}

// ── Recent ────────────────────────────────────────────
function addRecent(emoji) {
  recent = [emoji, ...recent.filter(e => e !== emoji)].slice(0, 18);
  chrome.storage.local.set({ emojiRecent: recent });
  renderRecent();
}

function renderRecent() {
  recentEl.innerHTML = '';
  recent.slice(0, 8).forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.title = emoji;
    btn.addEventListener('click', () => copyEmoji(emoji, btn));
    recentEl.appendChild(btn);
  });
}

// ── Search ────────────────────────────────────────────
function buildSearchIndex() {
  const index = [];
  CATEGORIES.forEach(cat => {
    cat.emojis.forEach(emoji => index.push(emoji));
  });
  return index;
}
const ALL_EMOJIS = buildSearchIndex();

searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim().toLowerCase();
  if (!q) {
    renderGrid(CATEGORIES[currentCat].emojis);
    return;
  }
  // Search by unicode name approximation (use emoji codepoints) or just return all that visually match
  // Since we don't have a name DB, filter by simple pattern or return filtered subset
  const matched = ALL_EMOJIS.filter(e => {
    try {
      const cp = e.codePointAt(0).toString(16);
      return cp.includes(q) || e.includes(q);
    } catch { return false; }
  });
  // Show all if query is short (browse mode), else show matched
  renderGrid(matched.length ? matched : ALL_EMOJIS.slice(0, 72));
});

// Also support Japanese keyword search by mapping keywords
const KEYWORD_MAP = {
  'ハート': ['❤️','🧡','💛','💚','💙','💜','🖤','💕','💞','💓','💗','💖','💘','💝'],
  'heart': ['❤️','🧡','💛','💚','💙','💜','🖤','💕','💞','💓','💗','💖','💘','💝'],
  '笑': ['😀','😁','😂','🤣','😄','😆','😊','🥰','😍'],
  '泣': ['😢','😭','😥','😓'],
  '怒': ['😠','😡','🤬','👿'],
  '猫': ['🐱','🐈','🐈‍⬛','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  '犬': ['🐶','🐕','🦮','🐕‍🦺','🐩'],
  '火': ['🔥','🕯','🪔'],
  '星': ['⭐','🌟','💫','✨','🌠','🌌'],
  '花': ['🌸','🌺','🌹','🌷','🌻','🌼','🌈'],
  'ok': ['👍','✅','☑️','✔️'],
  'ng': ['👎','❌','🚫','⛔'],
};

searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim().toLowerCase();
  if (!q) { renderGrid(CATEGORIES[currentCat].emojis); return; }

  // Check keyword map first
  for (const [kw, emojis] of Object.entries(KEYWORD_MAP)) {
    if (kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase())) {
      renderGrid(emojis); return;
    }
  }

  // Fallback: show all
  renderGrid(ALL_EMOJIS.slice(0, 72));
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['emojiRecent'], (data) => {
  recent = data.emojiRecent || [];
  renderRecent();
  renderGrid(CATEGORIES[0].emojis);
  searchEl.focus();
});
