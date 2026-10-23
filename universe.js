/*
 * The Weather Bureau: the climate of Pixel City, and the Bureau's forecaster.
 *
 * A root of the Pixel Universe: a pure function of time that reads nothing else.
 * Follows the Pixel Universe Shared Conventions:
 *   - all simulation in UTC; the city's clock is UTC, so the sun is highest at 12:00
 *   - seeded randomness only (Glacial's mulberry32 + FNV-1a), seeds start with "weather:"
 *   - simulation maths uses only + - * / Math.floor Math.imul. Seasons and days need a cosine,
 *     so this file uses Bhaskara's approximation, which needs only arithmetic.
 *
 * Registers window.PixelUniverse.climate.
 */
(function (root) {
  'use strict';

  const VERSION = '0.1.0';
  const MIN = 60000, H = 3600000, DAY = 86400000;
  const EPOCH = Date.UTC(2025, 11, 3); // Glacial's first Daily Crawl
  const PI = 3.141592653589793, TAU = 6.283185307179586;

  // ---------------------------------------------------------------- shared RNG (identical to Glacial's)
  function rng(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const unit = (s) => hash('weather:' + s) / 4294967296;
  const seeded = (s) => rng(hash('weather:' + s));

  // ---------------------------------------------------------------- small maths
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const abs = (x) => (x < 0 ? -x : x);
  const rd1 = (x) => Math.floor(x * 10 + 0.5) / 10;
  const rd = (x) => Math.floor(x * 1000 + 0.5) / 1000;
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const dayOf = (ms) => ms - (ms % DAY);
  function ymd(ms) {
    const d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
  /** Bhaskara I's sine approximation: arithmetic only, error under 0.002. */
  function bh(x) { const p = x * (PI - x); return (16 * p) / (5 * PI * PI - 4 * p); }
  function sin(x) { x = x - Math.floor(x / TAU) * TAU; return x < PI ? bh(x) : -bh(x - PI); }
  const cos = (x) => sin(x + PI / 2);
  /** Smooth value noise in -1..1, changing over roughly `periodH` hours. */
  function noise(key, t, periodH) {
    const x = t / (periodH * H), i = Math.floor(x), f = x - i;
    const a = unit(key + ':' + i), b = unit(key + ':' + (i + 1));
    return (a + (b - a) * smooth(f)) * 2 - 1;
  }
  function weighted(x, items, weights) {
    let tot = 0;
    for (const w of weights) tot += w;
    let v = x * tot;
    for (let i = 0; i < items.length; i++) { v -= weights[i]; if (v < 0) return items[i]; }
    return items[items.length - 1];
  }

  // ---------------------------------------------------------------- seasons and daylight
  function yearFrac(t) {
    const y = new Date(t).getUTCFullYear(), a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1);
    return (t - a) / (b - a);
  }
  /** +1 at the warmest time of year (late January), -1 at the coldest (late July). */
  const season = (t) => cos(TAU * (yearFrac(t) - 25 / 365));
  /** +1 at the December solstice. */
  const solar = (t) => cos(TAU * (yearFrac(t) - 355 / 365));
  const dayLength = (t) => 12 + 2.7 * solar(t); // hours: about 14.7 in December, 9.3 in June
  function seasonName(t) {
    const m = new Date(t).getUTCMonth();
    return m === 11 || m < 2 ? 'Summer' : m < 5 ? 'Autumn' : m < 8 ? 'Winter' : 'Spring';
  }
  function normals(t) {
    const S = season(t);
    return { max: rd1(19.25 + 4.75 * S), min: rd1(10.25 + 4.75 * S), dayLength: rd1(dayLength(t)) };
  }

  // ---------------------------------------------------------------- weather systems
  // A sequence of systems, each arriving after the last has passed. Each is announced by an approach
  // ("ramp") of up to two and a half days, so pressure falls and cloud builds well before it arrives.
  const TYPES = ['high', 'northerly', 'front', 'low', 'southerly', 'drizzle'];
  const TYPE_NAME = { high: 'High pressure', northerly: 'Warm northwesterly', front: 'Cold front', low: 'Low', southerly: 'Southerly change', drizzle: 'Moist northeasterly' };
  const RANGES = {
    high: { dur: [48, 120], ramp: [12, 24] }, northerly: { dur: [18, 42], ramp: [12, 24] }, front: { dur: [18, 36], ramp: [24, 48] },
    low: { dur: [24, 54], ramp: [30, 60] }, southerly: { dur: [18, 40], ramp: [4, 10] }, drizzle: { dur: [24, 60], ramp: [10, 18] }
  };
  const STORM_NAMES = ['Aperture', 'Baud', 'Cache', 'Diode', 'Ember', 'Flux', 'Gauss', 'Hertz', 'Inode', 'Joule', 'Kelvin', 'Latch',
    'Modem', 'Nyquist', 'Ohm', 'Parity', 'Quartz', 'Relay', 'Sector', 'Tesla', 'Unicode', 'Vertex', 'Wavelet', 'Xenon', 'Yotta', 'Zenith'];
  const FALL = 8 * H;
  const systems = [];
  let named = 0;
  function roman(n) {
    const v = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [k, s] of v) while (n >= k) { out += s; n -= k; }
    return out;
  }
  function addSystem() {
    const k = systems.length, r = seeded('system:' + k), prev = systems[k - 1];
    const a = r(), b = r(), c = r(), d = r(), e = r();
    const arrive = prev ? prev.end + (12 + Math.floor(a * 36)) * H : EPOCH - 3 * DAY;
    const w = (season(arrive) + 1) / 2; // 1 in summer, 0 in winter
    const type = weighted(b, TYPES, [0.25 + 0.13 * w, 0.05 + 0.13 * w, 0.25 - 0.05 * w, 0.2 - 0.1 * w, 0.2 - 0.12 * w, 0.05 + 0.01 * w]);
    const R = RANGES[type];
    const dur = (R.dur[0] + Math.floor(c * (R.dur[1] - R.dur[0]))) * H;
    const ramp = (R.ramp[0] + Math.floor(d * (R.ramp[1] - R.ramp[0]))) * H;
    const s = { k, id: 'sys-' + k, type, name: TYPE_NAME[type], arrive, dur, end: arrive + dur, ramp, intensity: rd(0.45 + e * 0.55) };
    if (type === 'low' && s.intensity > 0.82) {
      const round = Math.floor(named / STORM_NAMES.length);
      s.named = 'Storm ' + STORM_NAMES[named % STORM_NAMES.length] + (round ? ' ' + roman(round + 1) : '');
      s.intensity = rd(s.intensity + 0.15);
      named++;
    }
    systems.push(s);
  }
  function ensureSystems(t) {
    while (!systems.length || systems[systems.length - 1].end < t + 8 * DAY) addSystem();
  }
  function near(t) {
    ensureSystems(t);
    let lo = 0, hi = systems.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (systems[m].end + FALL < t) lo = m + 1; else hi = m; }
    const out = [];
    for (let i = lo; i < systems.length && systems[i].arrive - systems[i].ramp <= t; i++) out.push(systems[i]);
    return out;
  }
  function weight(s, t) {
    if (t < s.arrive - s.ramp || t > s.end + FALL) return 0;
    if (t < s.arrive) return smooth((t - (s.arrive - s.ramp)) / s.ramp);
    if (t <= s.end) return 1;
    return 1 - smooth((t - s.end) / FALL);
  }
  const BG = { tD: 0, tN: 0, p: 0, wind: 15, dir: 270, cloud: 0.5, rain: 0, showery: 0, hum: 0, thunder: 0, fog: 0 };
  /** What a system does to the weather at time t, at full strength. */
  function effects(s, t) {
    const I = s.intensity, ph = clamp((t - s.arrive) / s.dur, 0, 1);
    switch (s.type) {
      case 'high': return { tD: 1.5, tN: -2.8, p: 14 * I, wind: 8, dir: 200, cloud: 0.18, rain: 0, showery: 0, hum: -8, thunder: 0, fog: 0.6 };
      case 'northerly': return { tD: 5 * I, tN: 4 * I, p: -4, wind: 24 + 26 * I, dir: 315, cloud: 0.45, rain: 0, showery: 0, hum: -15, thunder: 0, fog: 0 };
      case 'front':
        if (ph < 0.35) return { tD: 2, tN: 2, p: -6 * I, wind: 20 + 14 * I, dir: 320, cloud: 0.75, rain: 0.2, showery: 0.3, hum: 5, thunder: 0, fog: 0 };
        if (ph < 0.5) return { tD: -1, tN: 0, p: -9 * I, wind: 28 + 18 * I, dir: 270, cloud: 1, rain: 1.4 + 2.4 * I, showery: 0.1, hum: 15, thunder: 0.3, fog: 0 };
        return { tD: -4 * I, tN: -3 * I, p: 2, wind: 22 + 12 * I, dir: 225, cloud: 0.55, rain: 0.35, showery: 0.75, hum: -5, thunder: 0.1, fog: 0 };
      case 'low':
        if (ph < 0.3) return { tD: 0, tN: 2, p: -10 * I, wind: 26 + 24 * I, dir: 45, cloud: 0.95, rain: 0.5 + 1 * I, showery: 0.2, hum: 15, thunder: 0.2, fog: 0 };
        if (ph < 0.65) return { tD: -1, tN: 1, p: -18 * I, wind: 32 + 38 * I, dir: 120, cloud: 1, rain: 0.9 + 2.6 * I, showery: 0.1, hum: 20, thunder: 0.5, fog: 0 };
        return { tD: -3, tN: -2, p: -8 * I, wind: 30 + 24 * I, dir: 200, cloud: 0.8, rain: 0.4 + 0.8 * I, showery: 0.6, hum: 10, thunder: 0.2, fog: 0 };
      case 'southerly': return { tD: -6 * I, tN: -5 * I, p: 4, wind: 28 + 26 * I, dir: 190, cloud: 0.7, rain: 0.5, showery: 0.8, hum: 5, thunder: 0.1, fog: 0 };
      default: return { tD: -1, tN: 2, p: -2, wind: 12, dir: 30, cloud: 0.95, rain: 0.12, showery: 0.3, hum: 15, thunder: 0, fog: 1 };
    }
  }

  // ---------------------------------------------------------------- the weather at a moment
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function sample(t) {
    const S = season(t), h = (t % DAY) / H;
    const dl = dayLength(t), rise = 12 - dl / 2, set = 12 + dl / 2;
    const isDay = h >= rise && h < set;
    const d = 0.5 + 0.5 * cos((TAU * (h - 15)) / 24); // 1 at 3pm, 0 at 3am
    const acc = { tD: 0, tN: 0, p: 0, wind: 0, cloud: 0, rain: 0, showery: 0, hum: 0, thunder: 0, fog: 0 };
    let W = 0, dom = null, domW = 0;
    for (const s of near(t)) {
      const w = weight(s, t);
      if (w <= 0) continue;
      const e = effects(s, t);
      for (const k in acc) acc[k] += (k === 'rain' ? w * w : w) * e[k];
      W += w;
      if (w > domW) { dom = s; domW = w; }
    }
    if (W > 1) for (const k in acc) acc[k] /= W;
    const bg = W >= 1 ? 0 : 1 - W;
    for (const k in acc) acc[k] += bg * BG[k];
    const maxN = 19.25 + 4.75 * S, minN = 10.25 + 4.75 * S;
    const cloud = clamp(acc.cloud + 0.2 * noise('cloud', t, 4), 0, 1);
    let temp = minN + acc.tN + (maxN + acc.tD - minN - acc.tN) * d;
    temp += noise('temp', t, 7) * 1.2 + noise('spell', t, 30) * 1.6;
    temp += -cloud * 1.6 * d + cloud * 1.4 * (1 - d);
    const breeze = isDay ? 6 * d * (S + 1) / 2 : 0;
    const wind = clamp(acc.wind * (1 + 0.25 * noise('wind', t, 3)) + breeze, 0, 160);
    const gust = wind * (1.25 + 0.25 * unit('gust:' + Math.floor(t / H)));
    let rain = 0;
    if (cloud > 0.45 && acc.rain > 0.02) {
      const n = (noise('rain', t, 1.5) + 1) / 2;
      rain = acc.showery > 0 ? (n < acc.showery * 0.7 ? 0 : acc.rain * n * 1.6) : acc.rain * (0.7 + 0.3 * n);
    }
    const hum = clamp(70 + acc.hum + rain * 5 - (temp - 15) * 1.2 + 8 * (1 - d), 25, 100);
    const dir = ((dom && domW >= 0.5 ? effects(dom, t).dir : 270) + noise('dir', t, 5) * 25 + 360) % 360;
    const snow = temp < 1.2 && rain > 0.1;
    const fog = acc.fog > 0.3 && h >= 3 && h < 10 && wind < 12 && hum > 92;
    const frost = temp < 0.6 && cloud < 0.35 && !isDay;
    const thunder = acc.thunder > 0 && rain > 3 && S > -0.2 && unit('thunder:' + Math.floor(t / H)) < acc.thunder * 0.6;
    const storm = dom && dom.named && domW >= 0.5 ? dom.named : null;
    const x = {
      time: t, temp: rd1(temp), feels: rd1(temp - (wind > 10 ? (wind - 10) * 0.08 : 0)), pressure: rd1(1013 + acc.p + noise('press', t, 10) * 3),
      wind: Math.floor(wind + 0.5), gust: Math.floor(gust + 0.5), dir: Math.floor(dir + 0.5), compass: COMPASS[Math.floor((dir + 11.25) / 22.5) % 16],
      cloud: rd(cloud), rain: rd1(rain), humidity: Math.floor(hum + 0.5), isDay, snow, fog, frost, thunder, storm,
      system: dom && domW >= 0.5 ? { id: dom.id, type: dom.type, name: dom.named || dom.name } : null
    };
    const c = classify(x);
    x.cond = c.cond; x.icon = c.icon;
    return x;
  }
  function classify(x) {
    if (x.storm && (x.gust >= 75 || x.rain >= 4)) return { cond: x.storm, icon: 'storm' };
    if (x.snow) return { cond: 'Snow', icon: 'snow' };
    if (x.thunder) return { cond: 'Thunderstorm', icon: 'storm' };
    if (x.rain >= 4) return { cond: 'Heavy rain', icon: 'rain' };
    if (x.rain >= 0.5) return { cond: 'Rain', icon: 'rain' };
    if (x.rain > 0) return { cond: x.cloud > 0.9 ? 'Drizzle' : 'Showers', icon: 'showers' };
    if (x.fog) return { cond: 'Fog', icon: 'fog' };
    if (x.frost) return { cond: 'Frost', icon: 'clear' };
    if (x.cloud > 0.85) return { cond: 'Overcast', icon: 'cloud' };
    if (x.cloud > 0.6) return { cond: 'Cloudy', icon: 'cloud' };
    if (x.cloud > 0.3) return { cond: 'Partly cloudy', icon: 'part' };
    return { cond: x.isDay ? 'Sunny' : 'Clear', icon: 'clear' };
  }

  // ---------------------------------------------------------------- days
  const dayCache = new Map();
  function summarise(d, upTo) {
    let max = -99, min = 99, rain = 0, gust = 0, windSum = 0, sun = 0, n = 0, pmin = 9999;
    let thunder = false, snow = false, frost = false, fog = false, storm = null;
    const dirs = {};
    for (let h = 0; h < 24; h++) {
      const t = d + h * H + 30 * MIN;
      if (upTo !== undefined && t > upTo) break;
      const x = sample(t);
      n++;
      if (x.temp > max) max = x.temp;
      if (x.temp < min) min = x.temp;
      rain += x.rain;
      if (x.gust > gust) gust = x.gust;
      windSum += x.wind;
      if (x.isDay) sun += x.cloud < 0.25 ? 1 : x.cloud < 0.5 ? 0.6 : x.cloud < 0.75 ? 0.25 : 0;
      if (x.pressure < pmin) pmin = x.pressure;
      thunder = thunder || x.thunder; snow = snow || x.snow; frost = frost || x.frost; fog = fog || x.fog;
      if (x.storm) storm = x.storm;
      const c8 = x.compass.length === 3 ? x.compass.slice(1) : x.compass;
      dirs[c8] = (dirs[c8] || 0) + 1;
    }
    if (!n) return null;
    let dir = 'W', best = 0;
    for (const k in dirs) if (dirs[k] > best) { best = dirs[k]; dir = k; }
    const out = { day: d, date: ymd(d), max: rd1(max), min: rd1(min), rain: rd1(rain), gust, wind: Math.floor(windSum / n + 0.5), sunshine: rd1(sun),
      pressureMin: rd1(pmin), thunder, snow, frost, fog, storm, dir, hours: n };
    const c = dayCondition(out);
    out.cond = c.cond; out.icon = c.icon; out.cat = c.cat;
    return out;
  }
  function dayCondition(s) {
    let cat = s.storm || s.gust >= 85 || s.rain >= 30 ? 'stormy' : s.rain >= 2 || s.snow ? 'wet' : s.sunshine >= 6 ? 'fine' : 'cloudy';
    if (s.storm) return { cond: s.storm, icon: 'storm', cat };
    if (s.snow) return { cond: 'Snow', icon: 'snow', cat };
    if (s.thunder) return { cond: 'Thunderstorms', icon: 'storm', cat };
    if (s.rain >= 20) return { cond: 'Heavy rain', icon: 'rain', cat };
    if (s.rain >= 5) return { cond: 'Rain', icon: 'rain', cat };
    if (s.rain >= 1) return { cond: 'Showers', icon: 'showers', cat };
    if (s.fog && s.sunshine < 6) return { cond: 'Fog', icon: 'fog', cat };
    if (s.sunshine >= 8) return { cond: s.gust >= 60 ? 'Sunny and windy' : 'Sunny', icon: 'clear', cat };
    if (s.sunshine >= 4.5) return { cond: 'Partly cloudy', icon: 'part', cat };
    if (s.sunshine >= 2) return { cond: 'Cloudy', icon: 'cloud', cat };
    return { cond: 'Overcast', icon: 'cloud', cat };
  }
  function day(d) {
    if (!dayCache.has(d)) dayCache.set(d, summarise(d));
    return dayCache.get(d);
  }

  // ---------------------------------------------------------------- the forecaster
  const FORECASTER = {
    name: 'Isobar Fairweather',
    title: 'Chief Forecaster',
    color: '#7FB8E8',
    since: ymd(EPOCH),
    bio: 'Has issued a forecast every morning at 06:00 since the first Daily Crawl. Believes, on balance, that it will probably be fine.'
  };
  const CAT_TEXT = {
    fine: ['Fine.', 'Sunny and settled.', 'Mostly sunny.', 'Fine and clear.'],
    cloudy: ['Cloudy periods.', 'Mostly cloudy, a few breaks.', 'Overcast at times.', 'Grey, but dry.'],
    wet: ['Rain at times.', 'Showers.', 'Periods of rain.', 'Showers, clearing later.'],
    stormy: ['Heavy rain and gales.', 'Stormy.', 'Severe weather possible.']
  };
  const DIR_WORD = { N: 'northerly', NE: 'northeasterly', E: 'easterly', SE: 'southeasterly', S: 'southerly', SW: 'southwesterly', W: 'westerly', NW: 'northwesterly' };
  function windPhrase(gust, dir) {
    const w = DIR_WORD[dir] || 'westerly';
    if (gust >= 90) return 'Gale-force ' + w + 's.';
    if (gust >= 65) return 'Strong ' + w + 's.';
    if (gust >= 40) return 'A fresh ' + w + '.';
    return 'Light winds.';
  }
  const fcCache = new Map();
  /** The forecast issued at 06:00 on `issueDay`, for that day and the next four. */
  function forecast(issueDay) {
    if (fcCache.has(issueDay)) return fcCache.get(issueDay);
    const days = [];
    for (let L = 0; L < 5; L++) {
      const target = issueDay + L * DAY, truth = day(target);
      const r = seeded('forecast:' + ymd(issueDay) + ':' + ymd(target));
      const g = () => (r() + r() + r() + r() - 2) * 1.73; // about one standard deviation
      const spread = 1 + 0.6 * L;
      const g1 = g(), g2 = g(), g3 = g(), g4 = g(), g5 = g(), g6 = r();
      const max = rd1(truth.max + 0.4 + g1 * 0.7 * spread);
      const min = rd1(truth.min + 0.3 + g2 * 0.7 * spread);
      const wet = clamp(truth.rain / (truth.rain + 2.5) + g3 * 0.13 * spread - 0.05, 0, 1);
      const sun = truth.sunshine + g4 * 1.4 * (1 + 0.5 * L) + 0.8;
      let cat = wet > 0.38 ? 'wet' : sun >= 6 ? 'fine' : 'cloudy';
      if (truth.cat === 'stormy' && g5 > L * 0.6 - 0.4) cat = 'stormy';
      const chance = clamp(Math.floor((wet * 1.5 + 0.05) * 10 + 0.5) * 10, 0, 100);
      const gust = Math.floor(truth.gust * (1 + g5 * 0.1 * spread) + 0.5);
      const lines = CAT_TEXT[cat];
      days.push({ day: target, date: ymd(target), lead: L, cat, max, min, chance, gust, dir: truth.dir,
        text: lines[Math.floor(g6 * lines.length)] + ' ' + windPhrase(gust, truth.dir),
        confidence: L <= 1 ? 'High' : L <= 3 ? 'Moderate' : 'Low' });
    }
    const out = { issued: issueDay + 6 * H, by: FORECASTER.name, days };
    fcCache.set(issueDay, out);
    return out;
  }
  function forecastAt(t) {
    const d = dayOf(t);
    const issue = t >= d + 6 * H ? d : d - DAY;
    return issue < EPOCH ? null : forecast(issue);
  }
  /** How the day-ahead forecast for day d compared with what happened. */
  function verify(d) {
    if (d - DAY < EPOCH) return null;
    const f = forecast(d - DAY).days[1], a = day(d);
    const err = rd1(f.max - a.max);
    const adjacent = (f.cat === 'fine' && a.cat === 'cloudy') || (f.cat === 'cloudy' && a.cat === 'fine') || (f.cat === 'wet' && a.cat === 'stormy') || (f.cat === 'stormy' && a.cat === 'wet');
    const hit = f.cat === a.cat && abs(err) <= 2;
    const bust = (f.cat === 'fine' || f.cat === 'cloudy') && (a.rain >= 15 || a.cat === 'stormy');
    return { day: d, date: ymd(d), forecast: f, actual: a, err, hit, near: !hit && (f.cat === a.cat || adjacent), bust };
  }

  // ---------------------------------------------------------------- events and records
  const START_RECORDS = EPOCH + 30 * DAY;
  function freshHistory() {
    return { day: EPOCH, rec: { max: null, min: null, rain: null, gust: null }, heat: 0, cold: 0, dry: 0, frostYear: 0, streak: 0, best: 0, week: [] };
  }
  function emit(out, t, type, importance, idPart, data, headline) {
    out.push({ id: 'weather:' + idPart, time: iso(t), ms: t, source: 'weather', type, importance, data, headline });
  }
  const SEASON_START = { 11: 'Summer', 2: 'Autumn', 5: 'Winter', 8: 'Spring' };
  /** Everything that happened on day d. Daily statistics are published at 23:59. */
  function processDay(h, d, out) {
    const date = new Date(d), month = date.getUTCMonth(), dom = date.getUTCDate(), te = d + DAY - MIN;
    if (dom === 1 && SEASON_START[month]) emit(out, d, 'season.start', 2, 'season:' + ymd(d), { season: SEASON_START[month] }, SEASON_START[month] + ' begins in Pixel City');
    ensureSystems(d + 3 * DAY);
    for (const s of systems) {
      if (s.arrive > d + 3 * DAY) break;
      if (s.named) {
        const watch = s.arrive - 2 * DAY;
        if (watch >= d && watch < d + DAY) emit(out, watch, 'storm.watch', 3, s.id + ':watch', { storm: s.named, arrives: iso(s.arrive) },
          'The Bureau is watching a deepening low. It has been named ' + s.named + ' and should arrive in about two days');
        if (s.arrive >= d && s.arrive < d + DAY) emit(out, s.arrive, 'storm.arrives', 4, s.id + ':arrives', { storm: s.named },
          s.named + ' reaches Pixel City');
        if (s.end >= d && s.end < d + DAY) {
          let gust = 0, rain = 0;
          for (let t = s.arrive; t <= s.end; t += H) { const x = sample(t); if (x.gust > gust) gust = x.gust; rain += x.rain; }
          emit(out, s.end, 'storm.clears', 3, s.id + ':clears', { storm: s.named, gust, rain: rd1(rain) },
            s.named + ' clears after gusts of ' + gust + ' km/h and ' + rd1(rain) + ' mm of rain');
        }
      } else if (s.arrive >= d && s.arrive < d + DAY && ((s.type === 'southerly' && s.intensity > 0.75) || (s.type === 'northerly' && s.intensity > 0.85))) {
        emit(out, s.arrive, 'weather.change', 2, s.id + ':arrives', { type: s.type },
          s.type === 'southerly' ? 'A sharp southerly change sweeps through, and the temperature drops' : 'A hot, gusty northwesterly sets in');
      }
    }
    const x = day(d);
    // records
    if (d >= START_RECORDS) {
      if (h.rec.max && x.max > h.rec.max.v) emit(out, te, 'weather.record', 4, 'record:max:' + ymd(d), { kind: 'max', value: x.max, previous: h.rec.max.v }, 'Hottest day on record: ' + x.max + '\u00b0C, beating ' + h.rec.max.v + '\u00b0C');
      if (h.rec.min && x.min < h.rec.min.v) emit(out, te, 'weather.record', 4, 'record:min:' + ymd(d), { kind: 'min', value: x.min, previous: h.rec.min.v }, 'Coldest night on record: ' + x.min + '\u00b0C, beating ' + h.rec.min.v + '\u00b0C');
      if (h.rec.rain && x.rain > h.rec.rain.v) emit(out, te, 'weather.record', 4, 'record:rain:' + ymd(d), { kind: 'rain', value: x.rain, previous: h.rec.rain.v }, 'Wettest day on record: ' + x.rain + ' mm');
      if (h.rec.gust && x.gust > h.rec.gust.v) emit(out, te, 'weather.record', 4, 'record:gust:' + ymd(d), { kind: 'gust', value: x.gust, previous: h.rec.gust.v }, 'Strongest gust on record: ' + x.gust + ' km/h');
    }
    if (!h.rec.max || x.max > h.rec.max.v) h.rec.max = { v: x.max, d };
    if (!h.rec.min || x.min < h.rec.min.v) h.rec.min = { v: x.min, d };
    if (!h.rec.rain || x.rain > h.rec.rain.v) h.rec.rain = { v: x.rain, d };
    if (!h.rec.gust || x.gust > h.rec.gust.v) h.rec.gust = { v: x.gust, d };
    // spells
    if (x.max >= 27) { h.heat++; if (h.heat === 3) emit(out, te, 'heatwave.start', 3, 'heat:' + ymd(d), { days: 3 }, 'A heatwave: a third straight day above 27\u00b0C'); }
    else { if (h.heat >= 3) emit(out, te, 'heatwave.end', 2, 'heat-end:' + ymd(d), { days: h.heat }, 'The heatwave ends after ' + h.heat + ' days'); h.heat = 0; }
    if (x.max <= 11.5) { h.cold++; if (h.cold === 3) emit(out, te, 'coldsnap.start', 3, 'cold:' + ymd(d), { days: 3 }, 'A cold snap: a third straight day with highs below 12\u00b0C'); }
    else { if (h.cold >= 3) emit(out, te, 'coldsnap.end', 2, 'cold-end:' + ymd(d), { days: h.cold }, 'The cold snap ends after ' + h.cold + ' days'); h.cold = 0; }
    if (x.rain < 1) {
      h.dry++;
      if (h.dry === 14 || h.dry === 21) emit(out, te, 'dryspell', 3, 'dry:' + ymd(d), { days: h.dry }, h.dry + ' days without meaningful rain');
      if (h.dry === 30 || (h.dry > 30 && h.dry % 10 === 0)) emit(out, te, 'drought', 4, 'drought:' + ymd(d), { days: h.dry }, 'Drought: ' + h.dry + ' days without meaningful rain');
    } else {
      if (h.dry >= 14) emit(out, te, 'dryspell.end', 3, 'dry-end:' + ymd(d), { days: h.dry, rain: x.rain }, 'The dry spell ends after ' + h.dry + ' days, with ' + x.rain + ' mm of rain');
      h.dry = 0;
    }
    if (x.rain >= 55) emit(out, te, 'weather.deluge', 4, 'deluge:' + ymd(d), { rain: x.rain }, 'Deluge: ' + x.rain + ' mm of rain in a single day');
    if (x.snow) emit(out, te, 'weather.snow', 4, 'snow:' + ymd(d), {}, 'Snow falls on Pixel City');
    const yr = date.getUTCFullYear();
    if (x.frost && month >= 2 && month <= 10 && h.frostYear !== yr) { h.frostYear = yr; emit(out, d + 7 * H, 'weather.frost', 3, 'frost:' + yr, {}, 'The first frost of the year'); }
    // the forecaster's day
    const v = verify(d);
    if (v) {
      h.week.push(v.hit ? 1 : 0);
      if (v.hit) {
        h.streak++;
        if (h.streak > h.best) h.best = h.streak;
        if (h.streak === 10 || h.streak === 20 || h.streak === 30) emit(out, te, 'forecaster.streak', 2, 'streak:' + ymd(d), { streak: h.streak },
          FORECASTER.name + ' has now called ' + h.streak + ' days in a row correctly');
      } else h.streak = 0;
      if (v.bust) emit(out, te, 'forecaster.bust', 3, 'bust:' + ymd(d), { forecast: v.forecast.cat, rain: v.actual.rain, cond: v.actual.cond },
        FORECASTER.name + ' forecast ' + (v.forecast.cat === 'fine' ? 'a fine day' : 'a dry, cloudy day') + '; ' + v.actual.rain + ' mm of rain fell');
      if (date.getUTCDay() === 0 && h.week.length) {
        let hits = 0;
        for (const w of h.week) hits += w;
        emit(out, te, 'forecaster.week', 1, 'week:' + ymd(d), { hits, of: h.week.length }, FORECASTER.name + ' called ' + hits + ' of the last ' + h.week.length + ' days correctly');
        h.week = [];
      }
    }
  }

  // ---------------------------------------------------------------- the public instance
  function createClimate() {
    const hist = freshHistory();
    const events = [];
    function ensure(toDay) {
      while (hist.day < toDay) { processDay(hist, hist.day, events); hist.day += DAY; }
    }
    function eventsBetween(from, to) {
      if (to < EPOCH) return [];
      const today = dayOf(to);
      ensure(today);
      const scratch = JSON.parse(JSON.stringify(hist)), partial = [];
      processDay(scratch, today, partial);
      return events.filter((e) => e.ms >= from && e.ms < today).concat(partial.filter((e) => e.ms >= from && e.ms <= to)).sort((a, b) => a.ms - b.ms);
    }
    function historyBetween(from, to) {
      const out = [];
      for (let d = dayOf(from) > EPOCH ? dayOf(from) : EPOCH; d + DAY <= to; d += DAY) out.push(day(d));
      return out;
    }
    function forecasterStats(t) {
      const last = dayOf(t) - DAY;
      let n = 0, hits = 0, near = 0, mae = 0, streak = 0, best = 0, n30 = 0, h30 = 0;
      const busts = [];
      for (let d = EPOCH + DAY; d <= last; d += DAY) {
        const v = verify(d);
        n++; mae += abs(v.err);
        if (v.hit) { hits++; streak++; if (streak > best) best = streak; } else streak = 0;
        if (v.near) near++;
        if (v.bust) busts.push(v);
        if (last - d < 30 * DAY) { n30++; if (v.hit) h30++; }
      }
      busts.sort((a, b) => b.actual.rain - a.actual.rain);
      return { forecaster: FORECASTER, days: n, hits, near, accuracy: n ? hits / n : NaN, last30: n30 ? h30 / n30 : NaN,
        maxTempError: n ? rd1(mae / n) : NaN, streak, best, busts: busts.slice(0, 8) };
    }
    function stateAt(t) {
      if (t < EPOCH) return { time: t, started: false, startDate: ymd(EPOCH) };
      const now = sample(t), d = dayOf(t), dl = dayLength(t);
      const before = sample(t - 3 * H);
      ensureSystems(t);
      const outlook = systems.filter((s) => s.end + FALL > t && s.arrive - s.ramp < t + 4 * DAY)
        .map((s) => ({ id: s.id, type: s.type, name: s.named || s.name, named: !!s.named, arrive: s.arrive, end: s.end, approach: s.arrive - s.ramp, intensity: s.intensity }));
      return {
        time: t, started: true, version: VERSION, season: seasonName(t), normals: normals(t), now,
        pressureTrend: rd1(now.pressure - before.pressure), today: summarise(d, t),
        sunrise: d + (12 - dl / 2) * H, sunset: d + (12 + dl / 2) * H, dayLength: rd1(dl),
        outlook, forecast: forecastAt(t), forecaster: FORECASTER
      };
    }
    return {
      version: VERSION, source: 'weather', startDate: ymd(EPOCH), epoch: EPOCH, forecaster: FORECASTER,
      stateAt, eventsBetween, historyBetween, sample, forecastAt, verify, forecasterStats, normals,
      dayAt: (d) => day(dayOf(d)),
      systemsBetween(from, to) {
        ensureSystems(to);
        return systems.filter((s) => s.arrive >= from && s.arrive < to).map((s) => Object.assign({}, s));
      },
      create: createClimate,
      _internals: { rng, hash, sin, cos, EPOCH, DAY, H }
    };
  }

  root.PixelUniverse = root.PixelUniverse || {};
  root.PixelUniverse.climate = createClimate();
})(typeof window !== 'undefined' ? window : globalThis);
