/* The Weather Bureau's pages. Reads PixelUniverse.climate; never changes it. Times are city time (UTC). */
(function () {
  const C = PixelUniverse.climate;
  const DAY = 86400000, H = 3600000, MIN = 60000, E = C.epoch;
  const main = document.getElementById('main');

  // ---------------------------------------------------------------- clock (?at= for testing)
  const q = new URLSearchParams(location.search);
  const at = q.get('at');
  const parsed = at ? Date.parse(at.length <= 16 ? at + ':00Z' : at) : NaN;
  const offset = isNaN(parsed) ? 0 : parsed - Date.now();
  const now = () => Date.now() + offset;
  const AT = isNaN(parsed) ? '' : '?at=' + encodeURIComponent(at);

  // ---------------------------------------------------------------- formatting
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dayOf = (ms) => ms - (ms % DAY);
  const utc = (o) => new Intl.DateTimeFormat(undefined, Object.assign({ timeZone: 'UTC' }, o));
  const fTime = utc({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), fSec = utc({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const fDate = utc({ weekday: 'long', day: 'numeric', month: 'long' }), fShort = utc({ weekday: 'short', day: 'numeric', month: 'short' });
  const fDay = utc({ weekday: 'short' }), fYear = utc({ day: 'numeric', month: 'short', year: 'numeric' }), fMonth = utc({ month: 'long', year: 'numeric' });
  // times are shown on the city's clock: UTC until the Renewal, City Standard Time (UTC+12) after it
  const cityMs = (ms) => ms + (window.PixelUniverse.climate.offsetAt ? window.PixelUniverse.climate.offsetAt(ms) : 0);
  const ct = (ms) => fTime.format(cityMs(ms)), date = (ms) => fDate.format(ms), short = (ms) => fShort.format(ms), dateY = (ms) => fYear.format(ms);
  const link = (route, text) => '<a href="' + AT + '#/' + route + '">' + text + '</a>';
  const deg = (v) => (v > 0 ? '' : '') + v.toFixed(1) + '\u00b0';
  const WORD = { N: 'northerly', NE: 'northeasterly', E: 'easterly', SE: 'southeasterly', S: 'southerly', SW: 'southwesterly', W: 'westerly', NW: 'northwesterly' };
  const eight = (c) => (c.length === 3 ? c.slice(1) : c);
  function windWords(x) {
    const w = WORD[eight(x.compass)] || 'westerly';
    let s = x.wind < 6 ? 'barely a breath of wind' : x.wind < 20 ? 'a light ' + w : x.wind < 40 ? 'a fresh ' + w : x.wind < 62 ? 'a strong ' + w : 'a gale-force ' + w;
    if (x.gust >= 60 && x.wind >= 6) s += ' gusting to ' + x.gust + ' km/h';
    return s;
  }
  function statusLine(x) {
    if (x.storm && x.cond === x.storm) return esc(x.storm) + ': ' + x.temp.toFixed(1) + '\u00b0C and ' + (x.rain >= 4 ? 'heavy rain' : 'rain') + ', with ' + windWords(x) + '.';
    return esc(x.cond) + ' and ' + x.temp.toFixed(1) + '\u00b0C, with ' + windWords(x) + '.';
  }

  // ---------------------------------------------------------------- pixel icons
  const PAL = { y: '#F2B33D', c: '#A9B8C1', d: '#6E7F8A', b: '#4DA3FF', w: '#BFD8EA', g: '#9AA9B2', m: '#D9CB8E', r: '#E5484D' };
  const ICONS = {
    clear: ['....y....', '.y..y..y.', '..yyyyy..', '..yyyyy..', 'yyyyyyyyy', '..yyyyy..', '..yyyyy..', '.y..y..y.', '....y....'],
    moon: ['...mmm...', '..mm.....', '.mm......', '.mm......', '.mm......', '.mm......', '..mm...m.', '...mmmm..', '.........'],
    part: ['.y.......', 'yyy......', '.yyy.....', '..y.ccc..', '...ccccc.', '..cccccc.', '.ccccccc.', 'ccccccccc', '.........'],
    cloud: ['.........', '.........', '...ccc...', '..ccccc..', '.ccccccc.', 'ccccccccc', 'ccccccccc', '.........', '.........'],
    showers: ['...ccc...', '..ccccc..', '.ccccccc.', 'ccccccccc', '.........', '.b...b...', '....b...b', '.b.......', '.....b...'],
    rain: ['...ddd...', '..ddddd..', '.ddddddd.', 'ddddddddd', '.........', 'b.b.b.b.b', '.b.b.b.b.', 'b.b.b.b.b', '.........'],
    storm: ['...ddd...', '..ddddd..', '.ddddddd.', 'ddddddddd', '....yy...', '...yy....', '..yyyy...', '...yy....', '..y......'],
    snow: ['...ccc...', '..ccccc..', '.ccccccc.', 'ccccccccc', '.........', '.w...w...', '...w...w.', '.w...w...', '.........'],
    fog: ['.........', 'ggggggg..', '.........', '..ggggggg', '.........', 'ggggggg..', '.........', '..ggggggg', '.........']
  };
  function icon(key, night, big, label) {
    const rows = ICONS[key === 'clear' && night ? 'moon' : key] || ICONS.cloud;
    let r = '';
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + PAL[row[x]] + '"/>'; });
    return '<svg class="icon' + (big ? ' big' : '') + '" viewBox="0 0 9 9" shape-rendering="crispEdges"' + (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"') + '>' + r + '</svg>';
  }
  const CAT = { fine: ['clear', 'Fine'], cloudy: ['cloud', 'Cloudy'], wet: ['rain', 'Wet'], stormy: ['storm', 'Stormy'] };

  // ---------------------------------------------------------------- shared bits
  const head = (title, lede, kicker) => '<section class="page-head">' + (kicker ? '<p class="kicker">' + kicker + '</p>' : '') + '<h1>' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : '') + '</section>';
  const fact = (k, v, small) => '<div><dt>' + k + '</dt><dd>' + v + (small ? ' <small>' + small + '</small>' : '') + '</dd></div>';
  const table = (cols, rows) => '<div class="table-wrap"><table class="data"><thead><tr>' + cols.map((c) => '<th' + (c.n ? ' class="n"' : '') + '>' + c.l + '</th>').join('') + '</tr></thead><tbody>' +
    (rows.length ? rows.join('') : '<tr><td class="muted" colspan="' + cols.length + '">Nothing yet.</td></tr>') + '</tbody></table></div>';
  const td = (v, n) => '<td' + (n ? ' class="n"' : '') + '>' + v + '</td>';
  const notYet = () => head('The Weather Bureau', 'Records begin on ' + dateY(E) + ', the day of the first Daily Crawl.');

  const V = {};

  // ================================================================ now
  V.now = {
    title: '',
    render() {
      if (now() < E) return notYet();
      return '<section class="page-head" style="padding-bottom:16px"><p class="kicker" id="kicker">\u00a0</p><h1 class="status" id="status">\u00a0</h1></section>' +
        '<figure class="screen"><canvas id="sky" width="960" height="380" role="img" aria-label="The sky over Pixel City, as it is now"></canvas>' +
        '<figcaption class="screen-bar"><span id="barleft"></span><span class="clock" id="clock"></span></figcaption></figure>' +
        '<div class="live-body"><section><h2>Right now</h2><dl class="facts" id="facts"></dl></section>' +
        '<aside><h2>From the forecaster</h2><div id="bulletin"></div></aside></div>' +
        '<h2>The next five days</h2><div class="days" id="days"></div>' +
        '<h2>Outlook</h2><p class="hint">Weather systems on the Bureau\u2019s charts, from yesterday to four days ahead. Faded bars are systems still approaching. What the forecaster makes of them is another matter.</p><figure class="outlook" id="outlook" style="margin:0"></figure>' +
        '<div class="two-col"><section><h2>Bulletins</h2><ul class="timeline" id="bulletins"></ul></section>' +
        '<section><h2>Today so far</h2><dl class="facts" id="today" style="grid-template-columns:1fr 1fr"></dl><h2>Air quality</h2>' +
        '<div class="aq">Pixel City has not been built yet, so it has no smog to measure. Air-quality reports begin when the city opens.</div></section></div>';
    },
    mount() {
      if (now() < E) return null;
      const sky = new window.Sky(document.getElementById('sky'));
      let st = C.stateAt(now()), raf = 0, slow = 0;
      const set = (id, html) => { const el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
      function frame() { sky.draw(Object.assign({ dayLength: st.dayLength }, st.now), now()); raf = requestAnimationFrame(frame); }
      function tick() {
        const t = now();
        st = C.stateAt(t);
        const x = st.now;
        set('clock', fSec.format(cityMs(t)) + ' PCT'); // Pixel City Time
        set('kicker', 'Pixel City, ' + esc(date(t)) + '. ' + (st.pixel && t >= C.pixel.adopted ? 'Year ' + st.pixel.year + ', day ' + (st.pixel.dayOfYear + 1) + '. ' : '') + esc(st.season) + '.');
        set('status', statusLine(x));
        set('barleft', icon(x.icon, !x.isDay) + ' ' + esc(x.cond) + ', ' + x.temp.toFixed(1) + '\u00b0C');
        const trend = st.pressureTrend > 0.6 ? 'rising' : st.pressureTrend < -0.6 ? 'falling' : 'steady';
        set('facts', [
          fact('Temperature', x.temp.toFixed(1) + '\u00b0C', 'feels like ' + x.feels.toFixed(1) + '\u00b0'),
          fact('Wind', x.wind + ' km/h ' + x.compass, 'gusts ' + x.gust),
          fact('Rain', x.rain.toFixed(1) + ' mm/h'),
          fact('Humidity', x.humidity + '%'),
          fact('Pressure', x.pressure.toFixed(1) + ' hPa', trend),
          fact('Cloud cover', Math.round(x.cloud * 100) + '%'),
          fact('Sunrise', ct(st.sunrise)), fact('Sunset', ct(st.sunset)),
          fact('Day length', Math.floor(st.dayLength) + 'h ' + String(Math.round((st.dayLength % 1) * 60)).padStart(2, '0') + 'm')
        ].join(''));
        const td0 = st.today;
        if (td0) set('today', [fact('High so far', td0.max.toFixed(1) + '\u00b0', 'normal ' + st.normals.max + '\u00b0'), fact('Low so far', td0.min.toFixed(1) + '\u00b0', 'normal ' + st.normals.min + '\u00b0'),
          fact('Rain so far', td0.rain.toFixed(1) + ' mm'), fact('Strongest gust', td0.gust + ' km/h'), fact('Sunshine', td0.sunshine.toFixed(1) + ' h')].join(''));
        if (++slow % 30 !== 1) return;
        // the slower panels
        const fc = st.forecast, today = dayOf(t);
        if (fc) {
          const d0 = fc.days.find((d) => d.day === today), d1 = fc.days.find((d) => d.day === today + DAY);
          const F = C.forecaster;
          set('bulletin', '<blockquote class="bulletin" style="--c:' + F.color + '">' + (d0 ? '<b>Today:</b> ' + esc(d0.text) + ' High ' + Math.round(d0.max) + '\u00b0, low ' + Math.round(d0.min) + '\u00b0. Chance of rain ' + d0.chance + '%.' : '') +
            '<br>' + (d1 ? '<b>Tomorrow:</b> ' + esc(d1.text) + ' High ' + Math.round(d1.max) + '\u00b0. Chance of rain ' + d1.chance + '%.' : '') +
            '<cite>' + esc(F.name) + ', ' + esc(F.title) + '. Issued ' + ct(fc.issued) + ', ' + esc(short(fc.issued)) + '. ' + link('forecaster', 'Their record') + '.</cite></blockquote>');
          set('days', fc.days.filter((d) => d.day >= today).map((d) => '<article class="day"><h3>' + (d.day === today ? 'Today' : esc(fDay.format(d.day))) + '</h3>' +
            icon(CAT[d.cat][0], false, true, CAT[d.cat][1]) + '<div class="temps">' + Math.round(d.max) + '\u00b0 <small>' + Math.round(d.min) + '\u00b0</small></div>' +
            '<div class="chance">' + d.chance + '% chance of rain</div><p>' + esc(d.text) + '</p></article>').join(''));
        }
        set('outlook', outlookSvg(t));
        set('bulletins', C.eventsBetween(t - 21 * DAY, t).filter((e) => e.importance >= 2).reverse().slice(0, 18)
          .map((e) => '<li><time>' + esc(short(e.ms)) + '</time><span>' + esc(e.headline) + '</span></li>').join('') || '<li class="muted">No bulletins in the last three weeks.</li>');
      }
      tick();
      const timer = setInterval(tick, 1000);
      raf = requestAnimationFrame(frame);
      return () => { clearInterval(timer); cancelAnimationFrame(raf); };
    }
  };
  const SYS_COL = { high: '#F2B33D', northerly: '#E8743B', front: '#4DA3FF', low: '#6E7F8A', southerly: '#7FB8E8', drizzle: '#9AA9B2' };
  function outlookSvg(t) {
    const W = 960, Hh = 112, from = dayOf(t) - DAY, to = dayOf(t) + 5 * DAY;
    const X = (ms) => ((ms - from) / (to - from)) * W;
    let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Weather systems from yesterday to four days ahead">';
    for (let d = from; d <= to; d += DAY) {
      s += '<line x1="' + X(d) + '" x2="' + X(d) + '" y1="0" y2="' + (Hh - 18) + '" stroke="currentColor" stroke-opacity="0.15"/>';
      if (d < to) s += '<text x="' + (X(d) + 6) + '" y="' + (Hh - 4) + '" font-size="12" fill="currentColor" opacity="0.65">' + (d === dayOf(t) ? 'Today' : esc(fDay.format(d))) + '</text>';
    }
    const list = C.systemsBetween(t - 8 * DAY, to).filter((x) => x.end > from && x.arrive - x.ramp < to);
    list.forEach((x, i) => {
      const y = 14 + (i % 2) * 34, col = x.named ? '#E5484D' : SYS_COL[x.type];
      const a0 = X(Math.max(from, x.arrive - x.ramp)), a1 = X(Math.max(from, x.arrive)), b1 = X(Math.min(to, x.end));
      if (a1 > a0) s += '<rect x="' + a0 + '" y="' + y + '" width="' + (a1 - a0) + '" height="26" fill="' + col + '" opacity="0.3"/>';
      if (b1 > a1) s += '<rect x="' + a1 + '" y="' + y + '" width="' + (b1 - a1) + '" height="26" fill="' + col + '"/>';
      const label = x.named || x.name;
      if (b1 - Math.max(a0, 0) > label.length * 7) s += '<text x="' + (Math.max(a0, 0) + 6) + '" y="' + (y + 18) + '" font-size="13" font-weight="600" fill="#0A1115">' + esc(label) + '</text>';
    });
    s += '<line x1="' + X(t) + '" x2="' + X(t) + '" y1="0" y2="' + (Hh - 18) + '" stroke="currentColor" stroke-width="2"/><text x="' + (X(t) + 4) + '" y="10" font-size="11" fill="currentColor">Now</text></svg>';
    return s;
  }

  // ================================================================ forecast
  V.forecast = {
    title: 'Forecast',
    render() {
      const t = now();
      if (t < E + DAY) return notYet();
      const fc = C.forecastAt(t), F = C.forecaster;
      const rows = fc.days.filter((d) => d.day >= dayOf(t)).map((d) => '<tr>' + td(esc(short(d.day))) + td(icon(CAT[d.cat][0]) + ' ' + esc(d.text)) + td(Math.round(d.max) + '\u00b0', 1) + td(Math.round(d.min) + '\u00b0', 1) +
        td(d.chance + '%', 1) + td(d.gust + ' km/h', 1) + td(esc(d.confidence)) + '</tr>');
      const ver = [];
      for (let d = dayOf(t) - DAY; d >= Math.max(E + DAY, dayOf(t) - 14 * DAY); d -= DAY) {
        const v = C.verify(d);
        ver.push('<tr>' + td(esc(short(d))) + td(icon(CAT[v.forecast.cat][0]) + ' ' + CAT[v.forecast.cat][1] + ', ' + Math.round(v.forecast.max) + '\u00b0') +
          td(icon(v.actual.icon) + ' ' + esc(v.actual.cond) + ', ' + v.actual.max.toFixed(1) + '\u00b0' + (v.actual.rain >= 0.2 ? ', ' + v.actual.rain + ' mm' : '')) +
          td(v.hit ? '<span class="hit">Hit</span>' : v.near ? 'Close' : '<span class="miss">Miss</span>') + '</tr>');
      }
      return head('Forecast', 'Issued by ' + esc(F.name) + ', ' + esc(F.title) + ', at ' + ct(fc.issued) + ' city time on ' + esc(date(fc.issued)) + '.') +
        table([{ l: 'Day' }, { l: 'Outlook' }, { l: 'High', n: 1 }, { l: 'Low', n: 1 }, { l: 'Rain', n: 1 }, { l: 'Gusts', n: 1 }, { l: 'Confidence' }], rows) +
        '<h2>How the last fortnight went</h2><p class="hint">Each day\u2019s forecast as issued the morning before, against what happened. A hit needs the right kind of day and a high within 2\u00b0.</p>' +
        table([{ l: 'Day' }, { l: 'Forecast' }, { l: 'Actual' }, { l: 'Verdict' }], ver);
    }
  };

  // ================================================================ almanac
  function lineChart(days, key) {
    const W = 960, Hh = 220, P = 34, n = days.length;
    if (n < 2) return '';
    const vals = [];
    days.forEach((d) => vals.push(d.max, d.min));
    const lo = Math.floor(Math.min(...vals) / 5) * 5, hi = Math.ceil(Math.max(...vals) / 5) * 5;
    const X = (i) => P + (i / (n - 1)) * (W - P - 10), Y = (v) => Hh - 24 - ((v - lo) / (hi - lo || 1)) * (Hh - 40);
    let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Daily highs and lows">';
    for (let v = lo; v <= hi; v += 5) s += '<line x1="' + P + '" x2="' + (W - 10) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="currentColor" stroke-opacity="0.12"/><text x="' + (P - 6) + '" y="' + (Y(v) + 4) + '" font-size="11" text-anchor="end" fill="currentColor" opacity="0.6">' + v + '\u00b0</text>';
    const line = (f, col) => '<polyline fill="none" stroke="' + col + '" stroke-width="2" points="' + days.map((d, i) => X(i).toFixed(1) + ',' + Y(f(d)).toFixed(1)).join(' ') + '"/>';
    const nm = days.map((d) => C.normals(d.day + 12 * H));
    s += '<polyline fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-dasharray="4 4" points="' + nm.map((m, i) => X(i).toFixed(1) + ',' + Y(m.max).toFixed(1)).join(' ') + '"/>';
    s += '<polyline fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-dasharray="4 4" points="' + nm.map((m, i) => X(i).toFixed(1) + ',' + Y(m.min).toFixed(1)).join(' ') + '"/>';
    s += line((d) => d.max, '#E8743B') + line((d) => d.min, '#4DA3FF');
    // rain bars along the bottom
    const rmax = Math.max(10, ...days.map((d) => d.rain));
    days.forEach((d, i) => { if (d.rain >= 0.2) { const h = (d.rain / rmax) * 50; s += '<rect x="' + (X(i) - 3) + '" y="' + (Hh - 20 - h) + '" width="6" height="' + h + '" fill="#4DA3FF" opacity="0.45"/>'; } });
    return s + '</svg>';
  }
  V.almanac = {
    title: 'Almanac',
    render(arg) {
      const t = now();
      if (t < E + DAY) return notYet();
      const cur = new Date(t), first = new Date(E);
      let y = cur.getUTCFullYear(), m = cur.getUTCMonth();
      if (arg && /^\d{4}-\d{2}$/.test(arg)) { y = +arg.slice(0, 4); m = +arg.slice(5) - 1; }
      let start = Date.UTC(y, m, 1);
      if (start < Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)) { y = first.getUTCFullYear(); m = first.getUTCMonth(); start = Date.UTC(y, m, 1); }
      const end = Date.UTC(y, m + 1, 1), days = C.historyBetween(Math.max(start, E), Math.min(end, dayOf(t)));
      const key = (yy, mm) => yy + '-' + String(mm + 1).padStart(2, '0');
      const prev = Date.UTC(y, m - 1, 1) >= Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1) ? link('almanac/' + key(new Date(Date.UTC(y, m - 1, 1)).getUTCFullYear(), new Date(Date.UTC(y, m - 1, 1)).getUTCMonth()), '\u2190 Previous month') : '';
      const next = end <= t ? link('almanac/' + key(new Date(end).getUTCFullYear(), new Date(end).getUTCMonth()), 'Next month \u2192') : '';
      const cells = [];
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d) => cells.push('<div class="dow">' + d + '</div>'));
      const lead = (new Date(start).getUTCDay() + 6) % 7;
      for (let i = 0; i < lead; i++) cells.push('<div class="cell blank"></div>');
      const byDay = {};
      days.forEach((d) => (byDay[d.day] = d));
      for (let d = start; d < end; d += DAY) {
        const x = byDay[d];
        cells.push(x ? '<div class="cell"><div class="num">' + new Date(d).getUTCDate() + '</div><span class="ic">' + icon(x.icon, false, false, x.cond) + '</span><div class="t">' + Math.round(x.max) + '\u00b0 <span class="muted">' + Math.round(x.min) + '\u00b0</span></div>' +
          (x.rain >= 0.2 ? '<div class="r">' + x.rain + ' mm</div>' : '') + (x.storm ? '<div class="miss">' + esc(x.storm.replace('Storm ', '')) + '</div>' : '') + '</div>'
          : '<div class="cell ' + (d < E ? 'blank' : 'future') + '"><div class="num">' + (d < E ? '' : new Date(d).getUTCDate()) + '</div></div>');
      }
      let summary = '';
      if (days.length) {
        const avg = (f) => days.reduce((a, d) => a + f(d), 0) / days.length;
        const nm = C.normals(start + 15 * DAY);
        const hot = days.reduce((a, d) => (d.max > a.max ? d : a)), cold = days.reduce((a, d) => (d.min < a.min ? d : a)), wet = days.reduce((a, d) => (d.rain > a.rain ? d : a));
        const rain = days.reduce((a, d) => a + d.rain, 0);
        const anom = avg((d) => d.max) - nm.max;
        summary = '<dl class="facts">' + fact('Average high', avg((d) => d.max).toFixed(1) + '\u00b0', (anom >= 0 ? '+' : '') + anom.toFixed(1) + '\u00b0 on normal') + fact('Average low', avg((d) => d.min).toFixed(1) + '\u00b0', 'normal ' + nm.min + '\u00b0') +
          fact('Rain', rain.toFixed(0) + ' mm', days.filter((d) => d.rain >= 1).length + ' wet days') + fact('Hottest', hot.max.toFixed(1) + '\u00b0', esc(short(hot.day))) +
          fact('Coldest', cold.min.toFixed(1) + '\u00b0', esc(short(cold.day))) + fact('Wettest', wet.rain.toFixed(1) + ' mm', esc(short(wet.day))) +
          fact('Sunshine', avg((d) => d.sunshine).toFixed(1) + ' h', 'a day') + fact('Strongest gust', Math.max(...days.map((d) => d.gust)) + ' km/h') + fact('Days recorded', days.length) + '</dl>';
      }
      return head(esc(fMonth.format(start)), 'Every day on record in Pixel City. Dashed lines are the normal high and low for the time of year.', 'Almanac') +
        '<p class="monthnav">' + prev + ' ' + next + '</p>' + summary + '<h2>Day by day</h2><div class="cal">' + cells.join('') + '</div>' +
        (days.length > 1 ? '<h2>Highs, lows and rain</h2><figure class="chart" style="margin:0">' + lineChart(days) + '</figure>' : '');
    }
  };

  // ================================================================ storms
  const stormStats = {};
  function stormStat(s, t) {
    const endT = Math.min(s.end, t);
    const key = s.id + ':' + (endT === s.end ? 'done' : Math.floor(endT / H));
    if (stormStats[key]) return stormStats[key];
    let gust = 0, rain = 0, pmin = 9999;
    for (let x = s.arrive; x <= endT; x += H) { const w = C.sample(x); gust = Math.max(gust, w.gust); rain += w.rain; pmin = Math.min(pmin, w.pressure); }
    return (stormStats[key] = { gust, rain: Math.round(rain * 10) / 10, pmin });
  }
  V.storms = {
    title: 'Storms',
    render() {
      const t = now();
      if (t < E) return notYet();
      const list = C.systemsBetween(E - 5 * DAY, t + 3 * DAY).filter((s) => s.named);
      const coming = list.filter((s) => s.arrive > t && s.arrive - 2 * DAY <= t);
      const past = list.filter((s) => s.arrive <= t).reverse();
      const rows = past.map((s) => { const x = stormStat(s, t); return '<tr>' + td('<b>' + esc(s.named) + '</b>' + (s.end > t ? ' <span class="tag">Now</span>' : '')) + td(esc(dateY(s.arrive))) +
        td(Math.round(Math.min(s.end, t) - s.arrive) / H > 0 ? Math.round((Math.min(s.end, t) - s.arrive) / H) + ' h' : '\u2013', 1) + td(x.gust + ' km/h', 1) + td(x.rain + ' mm', 1) + td(x.pmin.toFixed(0) + ' hPa', 1) + '</tr>'; });
      return head('Named storms', 'The deepest lows are named, in alphabetical order, when the Bureau first sees them coming, about two days before they arrive.') +
        (coming.length ? '<p class="banner">Storm watch: ' + coming.map((s) => '<b>' + esc(s.named) + '</b> is expected around ' + ct(s.arrive) + ' on ' + esc(date(s.arrive))).join('; ') + '.</p>' : '') +
        table([{ l: 'Storm' }, { l: 'Arrived' }, { l: 'Lasted', n: 1 }, { l: 'Peak gust', n: 1 }, { l: 'Rain', n: 1 }, { l: 'Lowest pressure', n: 1 }], rows);
    }
  };

  // ================================================================ records
  V.records = {
    title: 'Records',
    render() {
      const t = now();
      if (t < E + DAY) return notYet();
      const days = C.historyBetween(E, dayOf(t));
      const best = (f) => days.reduce((a, d) => (f(d) > f(a) ? d : a));
      const hot = best((d) => d.max), cold = best((d) => -d.min), wet = best((d) => d.rain), windy = best((d) => d.gust);
      let dry = 0, run = 0, dryEnd = null, wetRun = 0, wr = 0;
      for (const d of days) {
        if (d.rain < 1) { run++; if (run > dry) { dry = run; dryEnd = d.day; } } else run = 0;
        if (d.rain >= 1) { wr++; if (wr > wetRun) wetRun = wr; } else wr = 0;
      }
      const months = {};
      for (const d of days) { const k = d.date.slice(0, 7); const o = (months[k] = months[k] || { rain: 0, n: 0, sun: 0 }); o.rain += d.rain; o.n++; o.sun += d.sunshine; }
      const full = Object.keys(months).filter((k) => months[k].n >= 28);
      const wetM = full.reduce((a, k) => (!a || months[k].rain > months[a].rain ? k : a), null), dryM = full.reduce((a, k) => (!a || months[k].rain < months[a].rain ? k : a), null);
      const sunM = full.reduce((a, k) => (!a || months[k].sun > months[a].sun ? k : a), null);
      const mlabel = (k) => fMonth.format(Date.UTC(+k.slice(0, 4), +k.slice(5) - 1, 1));
      const rec = (label, value, note) => '<div class="record"><dt>' + label + '</dt><dd class="rec-value">' + value + '</dd><dd class="rec-holder">' + note + '</dd></div>';
      const storms = C.systemsBetween(E - 5 * DAY, t).filter((s) => s.named).length;
      const items = [
        rec('Hottest day', hot.max.toFixed(1) + '\u00b0C', esc(dateY(hot.day))), rec('Coldest night', cold.min.toFixed(1) + '\u00b0C', esc(dateY(cold.day))),
        rec('Wettest day', wet.rain.toFixed(1) + ' mm', esc(dateY(wet.day))), rec('Strongest gust', windy.gust + ' km/h', esc(dateY(windy.day))),
        rec('Longest dry spell', dry + ' days', dryEnd ? 'ending ' + esc(dateY(dryEnd)) : ''), rec('Longest run of wet days', wetRun + ' days', ''),
        rec('Named storms', storms, 'since records began'), rec('Days with snow', days.filter((d) => d.snow).length, ''),
        rec('Days with thunder', days.filter((d) => d.thunder).length, ''), rec('Days with frost', days.filter((d) => d.frost).length, '')
      ];
      if (wetM) items.push(rec('Wettest month', months[wetM].rain.toFixed(0) + ' mm', esc(mlabel(wetM))), rec('Driest month', months[dryM].rain.toFixed(0) + ' mm', esc(mlabel(dryM))),
        rec('Sunniest month', (months[sunM].sun / months[sunM].n).toFixed(1) + ' h a day', esc(mlabel(sunM))));
      return head('Records', 'Since records began on ' + esc(dateY(E)) + '.') + '<dl class="records">' + items.join('') + '</dl>';
    }
  };

  // ================================================================ forecaster
  V.forecaster = {
    title: 'The forecaster',
    render() {
      const t = now();
      if (t < E + 2 * DAY) return notYet();
      const s = C.forecasterStats(t), F = s.forecaster;
      const busts = s.busts.map((v) => '<tr>' + td(esc(dateY(v.day))) + td(icon(CAT[v.forecast.cat][0]) + ' ' + CAT[v.forecast.cat][1]) + td(icon(v.actual.icon) + ' ' + esc(v.actual.cond)) + td(v.actual.rain + ' mm', 1) + '</tr>');
      return '<section class="profile-head"><div class="big-swatch" style="--c:' + F.color + '"><i></i></div><div><p class="kicker">' + esc(F.title) + ' since ' + esc(dateY(E)) + '</p><h1>' + esc(F.name) + '</h1><p class="lede">' + esc(F.bio) + '</p></div></section>' +
        '<dl class="facts" style="margin-top:20px">' + fact('Accuracy', Math.round(s.accuracy * 100) + '%', 'of ' + s.days + ' days') + fact('Last 30 days', Math.round(s.last30 * 100) + '%') +
        fact('Close calls', s.near, 'right kind of day, wrong temperature, or near enough') + fact('Average high-temperature error', s.maxTempError + '\u00b0') + fact('Current streak', s.streak + ' days') + fact('Best streak', s.best + ' days') + '</dl>' +
        '<h2>Biggest busts</h2><p class="hint">Days forecast to be dry that turned out otherwise, wettest first.</p>' + table([{ l: 'Day' }, { l: 'Forecast' }, { l: 'Actual' }, { l: 'Rain', n: 1 }], busts) +
        '<h2>Method</h2><div class="prose"><p>Each morning at 06:00 city time the forecaster studies the Bureau\u2019s charts and issues a forecast for the next five days. Accuracy falls with each day ahead. On balance, the forecaster expects things to turn out fine, and is a little more often wrong in that direction than the other.</p></div>';
    }
  };

  // ================================================================ about
  V.about = {
    title: 'About',
    render() {
      return head('About the Bureau', 'The Weather Bureau keeps Pixel City\u2019s weather records, publishes its forecasts and, eventually, will report its air quality.') +
        '<div class="prose"><p>The weather is part of the Pixel Universe, alongside Glacial, the world\u2019s slowest race, and the Pixel Senate. Like them, it is computed in your browser from the date, so every visitor sees the same sky at the same moment, and nothing is stored.</p>' +
        '<p>Pixel City has a mild maritime climate with Southern Hemisphere seasons. Since the Climate Reform of 1 December 2026, when the city adopted the Pixel Calendar, a full year of seasons passes every calendar month: summer peaks just after the Grand Prix on the 1st, winter around the 17th, and each season lasts about a week. Before the Reform, summer peaked in late January and winter in late July, and the records keep both. All times on this site are city time.</p>' +
        '<p>Weather arrives as systems: highs, cold fronts, lows, warm northwesterlies, southerly changes and muggy northeasterlies. Most take a day or two to arrive. The deepest lows are named.</p>' +
        '<p>Weather never affects a race. It sets the sky, and will one day decide how many residents turn up to watch.</p></div>';
    }
  };

  // ---------------------------------------------------------------- routing
  const ROUTES = { '': 'now', forecast: 'forecast', almanac: 'almanac', storms: 'storms', records: 'records', forecaster: 'forecaster', about: 'about' };
  let unmount = null;
  function render() {
    if (unmount) { unmount(); unmount = null; }
    const h = location.hash.replace(/^#\/?/, '');
    const [name, arg] = h.split('/');
    const key = ROUTES[name || ''] || 'now', view = V[key];
    main.innerHTML = view.render(arg);
    document.title = (view.title ? view.title + ' \u2013 ' : '') + 'The Weather Bureau';
    document.querySelectorAll('.nav a').forEach((a) => (a.dataset.view === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    if (view.mount) unmount = view.mount(arg) || null;
    window.scrollTo(0, 0);
  }
  if (AT) {
    document.querySelectorAll('.nav a, .brand').forEach((a) => (a.href = AT + a.getAttribute('href')));
    const b = document.getElementById('travel');
    b.hidden = false;
    b.innerHTML = 'Watching the weather from ' + esc(new Date(now()).toISOString().slice(0, 16).replace('T', ' ')) + ' city time onwards. <a href="' + location.pathname + location.hash + '">Return to the present</a>.';
  }
  window.addEventListener('hashchange', render);
  render();
})();
