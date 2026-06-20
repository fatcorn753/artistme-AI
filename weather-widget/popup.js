// WMO weather interpretation codes → emoji + description
const WMO = {
  0:  ['☀️', '快晴'],
  1:  ['🌤', 'ほぼ晴れ'], 2: ['⛅', '一部曇り'], 3: ['☁️', '曇り'],
  45: ['🌫', '霧'], 48: ['🌫', '霧氷'],
  51: ['🌦', '霧雨（弱）'], 53: ['🌦', '霧雨'], 55: ['🌧', '霧雨（強）'],
  61: ['🌧', '小雨'], 63: ['🌧', '雨'], 65: ['🌧', '大雨'],
  71: ['❄️', '小雪'], 73: ['❄️', '雪'], 75: ['❄️', '大雪'],
  77: ['🌨', '雪あられ'],
  80: ['🌦', 'にわか雨（弱）'], 81: ['🌦', 'にわか雨'], 82: ['⛈', 'にわか雨（強）'],
  85: ['🌨', 'にわか雪'], 86: ['🌨', 'にわか雪（強）'],
  95: ['⛈', '雷雨'], 96: ['⛈', '雷雨とひょう'], 99: ['⛈', '雷雨とひょう（強）'],
};
function wmo(code) { return WMO[code] || ['🌡', `コード${code}`]; }

const DAY_NAMES = ['日','月','火','水','木','金','土'];

// ── Geocoding (Open-Meteo / Nominatim) ───────────────
async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ja&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) throw new Error('都市が見つかりません: ' + city);
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, name: r.name + (r.country ? `, ${r.country}` : '') };
}

// ── Weather fetch (Open-Meteo, free, no key) ──────────
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,` +
    `weather_code,surface_pressure,visibility` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('天気データを取得できませんでした');
  return res.json();
}

// ── Display ───────────────────────────────────────────
function showCurrent(data, cityName) {
  const c = data.current;
  const [icon, desc] = wmo(c.weather_code);

  document.getElementById('city-name').textContent = cityName;
  document.getElementById('weather-icon').textContent = icon;
  document.getElementById('temp').textContent = Math.round(c.temperature_2m) + '°';
  document.getElementById('feels-like').textContent = `体感 ${Math.round(c.apparent_temperature)}°`;
  document.getElementById('desc').textContent = desc;
  document.getElementById('humidity').textContent = `湿度 ${c.relative_humidity_2m}%`;
  document.getElementById('wind').textContent = `風速 ${Math.round(c.wind_speed_10m)} km/h`;
  document.getElementById('visibility').textContent = c.visibility != null
    ? `視程 ${(c.visibility/1000).toFixed(1)} km` : '視程 —';
  document.getElementById('pressure').textContent = `気圧 ${Math.round(c.surface_pressure)} hPa`;

  document.getElementById('current').classList.remove('hidden');
}

function showForecast(data) {
  const { daily } = data;
  const list = document.getElementById('forecast-list');
  list.innerHTML = '';

  for (let i = 0; i < Math.min(5, daily.time.length); i++) {
    const d = new Date(daily.time[i] + 'T00:00:00');
    const dayLabel = i === 0 ? '今日' : i === 1 ? '明日' : DAY_NAMES[d.getDay()] + '曜';
    const [icon] = wmo(daily.weather_code[i]);
    const rain = daily.precipitation_probability_max[i];

    const div = document.createElement('div');
    div.className = 'fc-day';
    div.innerHTML = `
      <div class="fc-day-label">${dayLabel}</div>
      <div class="fc-icon">${icon}</div>
      <div class="fc-max">${Math.round(daily.temperature_2m_max[i])}°</div>
      <div class="fc-min">${Math.round(daily.temperature_2m_min[i])}°</div>
      ${rain > 0 ? `<div class="fc-rain">💧${rain}%</div>` : ''}
    `;
    list.appendChild(div);
  }
  document.getElementById('forecast').classList.remove('hidden');
}

function setLoading(v) {
  document.getElementById('loading').classList.toggle('hidden', !v);
}
function setError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg; el.classList.toggle('hidden', !msg);
}
function hideResults() {
  ['current','forecast'].forEach(id => document.getElementById(id).classList.add('hidden'));
}

async function loadWeather(lat, lon, cityName) {
  setLoading(true); setError(''); hideResults();
  try {
    const data = await fetchWeather(lat, lon);
    showCurrent(data, cityName);
    showForecast(data);
    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('updated').textContent = `更新: ${now}`;
    chrome.storage.local.set({ wLat: lat, wLon: lon, wCity: cityName });
  } catch (e) {
    setError(e.message);
  }
  setLoading(false);
}

// ── Search ────────────────────────────────────────────
async function searchCity() {
  const city = document.getElementById('city-input').value.trim();
  if (!city) return;
  setLoading(true); setError(''); hideResults();
  try {
    const { lat, lon, name } = await geocode(city);
    await loadWeather(lat, lon, name);
  } catch (e) {
    setError(e.message);
    setLoading(false);
  }
}

document.getElementById('btn-search').addEventListener('click', searchCity);
document.getElementById('city-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchCity();
});

// ── Geolocation ───────────────────────────────────────
document.getElementById('btn-locate').addEventListener('click', () => {
  setLoading(true); setError(''); hideResults();
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      // Reverse geocode via Open-Meteo
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ja`;
        const res = await fetch(url, { headers: { 'User-Agent': 'WeatherWidget/1.0' } });
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.village || '現在地';
        await loadWeather(lat, lon, city);
      } catch {
        await loadWeather(lat, lon, '現在地');
      }
    },
    (err) => {
      setLoading(false);
      setError('位置情報を取得できませんでした: ' + err.message);
    },
    { timeout: 10000 }
  );
});

// ── Init ─────────────────────────────────────────────
chrome.storage.local.get(['wLat','wLon','wCity'], (data) => {
  if (data.wLat && data.wLon) {
    document.getElementById('city-input').value = data.wCity || '';
    loadWeather(data.wLat, data.wLon, data.wCity || '');
  } else {
    // Default to Tokyo
    loadWeather(35.6762, 139.6503, '東京, Japan');
    document.getElementById('city-input').value = 'Tokyo';
  }
});
