/*
 * The sky over Pixel City. Everything here is display: it draws the current weather from the climate layer.
 * Cloud shapes, raindrops, stars and lightning flickers are decoration and use ordinary randomness.
 */
(function () {
  const W = 960, HGT = 380, GROUND = 318;
  const DAY = 86400000, H = 3600000;
  const lerp = (a, b, t) => a + (b - a) * t;
  function mix(c1, c2, t) {
    const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const a = p(c1), b = p(c2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], Math.max(0, Math.min(1, t)))).toString(16).padStart(2, '0')).join('');
  }
  /** A tiny deterministic generator for the skyline, so it never changes between visits. */
  function lcg(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function buildSkyline() {
    const r = lcg(7), out = [];
    let x = 0;
    while (x < W) {
      const w = 26 + Math.floor(r() * 46), h = 22 + Math.floor(r() * 62);
      out.push({ x, w, h, kind: 'block', lit: [] });
      x += w + 2 + Math.floor(r() * 6);
    }
    // three landmarks: the stadium where Glacial races, the Senate, and the Bureau's own tower
    out.splice(3, 2, { x: out[3].x, w: 120, h: 26, kind: 'stadium', lit: [] });
    const mid = Math.floor(out.length / 2);
    out[mid] = { x: out[mid].x, w: 84, h: 44, kind: 'senate', lit: [] };
    out[mid + 3] = { x: out[mid + 3].x, w: 30, h: 104, kind: 'bureau', lit: [] };
    for (const b of out) for (let y = GROUND - b.h + 6; y < GROUND - 6; y += 8) for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += 8) if (r() < 0.32) b.lit.push([wx, y]);
    return out;
  }
  function moonPhase(t) {
    const syn = 29.530588 * DAY, ref = Date.UTC(2000, 0, 6, 18, 14);
    return (((t - ref) % syn) + syn) % syn / syn; // 0 new, 0.5 full
  }

  window.Sky = function (canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = HGT * dpr;
    ctx.scale(dpr, dpr);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const skyline = buildSkyline();
    const stars = [];
    { const r = lcg(3); for (let i = 0; i < 70; i++) stars.push({ x: r() * W, y: r() * (GROUND - 90), p: r() * 6.28 }); }
    let clouds = [], drops = [], fog = [0, 320, 640], flash = 0, nextBolt = 0, bolt = null, last = performance.now();
    function newCloud(x, dark) {
      const cells = [], w = 6 + Math.floor(Math.random() * 9), h = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const edge = Math.abs(i - w / 2) / (w / 2) + j / h * 0.6;
        if (Math.random() > edge * 0.7) cells.push([i, -j]);
      }
      return { x, y: 30 + Math.random() * 170, cells, size: 7 + Math.floor(Math.random() * 4), shade: dark ? 0.25 + Math.random() * 0.2 : 0.55 + Math.random() * 0.35, speed: 0.6 + Math.random() * 0.8 };
    }

    this.draw = function (x, t) {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const h = (t % DAY) / H, dl = x.dayLength, rise = 12 - dl / 2, set = 12 + dl / 2;
      const f = (h - rise) / (set - rise);
      const alt = f > 0 && f < 1 ? 4 * f * (1 - f) : 0;
      const twilight = Math.max(0, 1 - Math.min(Math.abs(h - rise), Math.abs(h - set)) / 1.2);
      const cloud = x.cloud, wet = Math.min(1, x.rain / 3);
      // the sky
      const clearDay = '#24506F', greyDay = '#3E4C55', stormDay = '#232D33', night = '#0A1115';
      const dayCol = cloud < 0.6 ? mix(clearDay, greyDay, cloud / 0.6) : mix(greyDay, stormDay, Math.min(1, (cloud - 0.6) / 0.4 + wet * 0.5));
      const light = Math.min(1, Math.sqrt(alt) * 1.1);
      const g = ctx.createLinearGradient(0, 0, 0, GROUND);
      g.addColorStop(0, mix(night, dayCol, light * 0.85));
      g.addColorStop(1, mix(mix(night, '#5A3A2E', twilight * (1 - cloud) * 0.9), dayCol, light));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, HGT);
      // stars and moon
      const dark = 1 - light;
      if (dark > 0.2) {
        for (const s of stars) {
          const a = dark * (1 - cloud) * (0.5 + 0.5 * Math.sin(now / 700 + s.p));
          if (a <= 0.02) continue;
          ctx.fillStyle = 'rgba(230,240,245,' + a.toFixed(3) + ')';
          ctx.fillRect(s.x, s.y, 2, 2);
        }
        const nf = h >= set ? (h - set) / (24 - dl) : (h + 24 - set) / (24 - dl);
        const mx = 60 + nf * (W - 120), my = 230 - 4 * nf * (1 - nf) * 190;
        const ph = moonPhase(t), lit = 1 - Math.abs(ph - 0.5) * 2;
        ctx.globalAlpha = dark * (1 - cloud * 0.85);
        ctx.fillStyle = '#E8E0BE';
        ctx.fillRect(mx - 7, my - 7, 14, 14);
        ctx.fillStyle = '#0A1115';
        const cover = Math.round((1 - lit) * 14);
        if (cover) ctx.fillRect(ph < 0.5 ? mx - 7 : mx + 7 - cover, my - 7, cover, 14);
        ctx.globalAlpha = 1;
      }
      // the sun
      if (alt > 0) {
        const sx = 60 + f * (W - 120), sy = GROUND - 20 - alt * 240;
        ctx.globalAlpha = Math.max(0.12, 1 - cloud * 0.9);
        ctx.shadowColor = '#FFD25A'; ctx.shadowBlur = 30;
        ctx.fillStyle = '#FFD25A';
        ctx.fillRect(sx - 9, sy - 9, 18, 18);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      // clouds drift with the wind: a westerly blows them to the right
      const east = -Math.sin(x.dir * Math.PI / 180) * x.wind;
      const target = Math.round(cloud * 16 + (cloud > 0.8 ? (cloud - 0.8) * 40 : 0));
      while (clouds.length < target) clouds.push(newCloud(Math.random() * W, wet > 0.2));
      if (clouds.length > target) clouds.length = target;
      const lightCloud = Math.round(lerp(60, 205, light)), darkCloud = Math.round(lerp(25, 110, light));
      for (const c of clouds) {
        if (!reduce) c.x += east * 0.35 * c.speed * dt;
        const span = c.cells.length ? 15 * c.size : 0;
        if (c.x > W + 40) c.x = -span - 20; else if (c.x < -span - 40) c.x = W + 20;
        const v = Math.round(lerp(darkCloud, lightCloud, Math.max(0, c.shade - wet * 0.4)));
        ctx.fillStyle = 'rgba(' + v + ',' + (v + 6) + ',' + (v + 10) + ',0.92)';
        for (const [i, j] of c.cells) ctx.fillRect(c.x + i * c.size, c.y + j * c.size, c.size - 1, c.size - 1);
      }
      // a heavy sky: an overcast layer behind the clouds
      if (cloud > 0.7) {
        const a = Math.min(0.75, (cloud - 0.7) * 2.2 + wet * 0.2);
        const v = Math.round(lerp(28, 120, light));
        const og = ctx.createLinearGradient(0, 0, 0, 230);
        og.addColorStop(0, 'rgba(' + v + ',' + (v + 6) + ',' + (v + 10) + ',' + a.toFixed(3) + ')');
        og.addColorStop(1, 'rgba(' + v + ',' + (v + 6) + ',' + (v + 10) + ',0)');
        ctx.fillStyle = og;
        ctx.fillRect(0, 0, W, 230);
      }
      // rain and snow
      const want = reduce ? 0 : Math.min(520, Math.round(x.rain * (x.snow ? 50 : 110)));
      while (drops.length < want) drops.push({ x: Math.random() * W, y: Math.random() * GROUND });
      if (drops.length > want) drops.length = want;
      ctx.fillStyle = x.snow ? 'rgba(235,242,247,0.9)' : 'rgba(120,180,240,0.65)';
      const fall = x.snow ? 45 : 520, slant = east * (x.snow ? 1.2 : 2.4);
      for (const d of drops) {
        d.y += fall * dt; d.x += slant * dt;
        if (d.y > GROUND) { d.y = -6; d.x = Math.random() * W; }
        if (d.x > W) d.x -= W; else if (d.x < 0) d.x += W;
        if (x.snow) ctx.fillRect(d.x, d.y, 3, 3); else ctx.fillRect(d.x, d.y, 1, 7);
      }
      // lightning
      if (x.thunder && !reduce && now > nextBolt) {
        flash = 1; nextBolt = now + 2500 + Math.random() * 6000;
        const bx = 80 + Math.random() * (W - 160), pts = [[bx, 40]];
        let yy = 40, xx = bx;
        while (yy < GROUND - 40) { yy += 18 + Math.random() * 20; xx += (Math.random() - 0.5) * 40; pts.push([xx, yy]); }
        bolt = pts;
      }
      if (flash > 0) {
        ctx.fillStyle = 'rgba(235,240,255,' + (flash * 0.35).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, HGT);
        if (bolt && flash > 0.6) { ctx.fillStyle = '#FFF6C8'; for (const [px, py] of bolt) ctx.fillRect(px - 2, py - 2, 4, 20); }
        flash -= dt * 3;
      }
      // the skyline
      const lightsOn = dark > 0.5;
      for (const b of skyline) {
        const top = GROUND - b.h;
        ctx.fillStyle = mix('#05090B', '#1A252C', light * 0.6);
        if (b.kind === 'stadium') {
          ctx.fillRect(b.x, top + 8, b.w, b.h - 8);
          ctx.fillRect(b.x + 4, top - 30, 4, 38); ctx.fillRect(b.x + b.w - 8, top - 30, 4, 38);
          if (lightsOn) { ctx.fillStyle = '#FFF2C2'; ctx.fillRect(b.x + 2, top - 34, 8, 4); ctx.fillRect(b.x + b.w - 10, top - 34, 8, 4); }
        } else if (b.kind === 'senate') {
          ctx.fillRect(b.x, top + 10, b.w, b.h - 10);
          ctx.fillRect(b.x + 10, top + 4, b.w - 20, 6);
          ctx.fillRect(b.x + b.w / 2 - 12, top - 8, 24, 12);
        } else if (b.kind === 'bureau') {
          ctx.fillRect(b.x, top, b.w, b.h);
          ctx.fillRect(b.x + b.w / 2 - 1, top - 22, 2, 22);
          // the anemometer spins with the wind; the windsock streams downwind
          const spin = (now / 1000) * x.wind * 0.25;
          ctx.fillStyle = '#9AA9B2';
          for (let k = 0; k < 3; k++) { const a = spin + k * 2.094; ctx.fillRect(b.x + b.w / 2 + Math.cos(a) * 7 - 2, top - 24 + Math.sin(a) * 2, 4, 3); }
          const len = Math.min(26, 4 + x.wind * 0.35), dirSign = east >= 0 ? 1 : -1;
          ctx.fillStyle = '#E8743B';
          for (let k = 0; k < len; k += 4) ctx.fillRect(b.x + b.w / 2 + dirSign * (2 + k), top - 12 + Math.sin(now / 150 + k) * (x.wind > 30 ? 1 : 2), 3, 3 - k / 16);
        } else ctx.fillRect(b.x, top, b.w, b.h);
        if (lightsOn) { ctx.fillStyle = 'rgba(255,214,120,0.75)'; for (const [wx, wy] of b.lit) if (wy > top + 2) ctx.fillRect(wx, wy, 3, 3); }
      }
      ctx.fillStyle = mix('#05090B', '#1A252C', light * 0.5);
      ctx.fillRect(0, GROUND, W, HGT - GROUND);
      if (x.frost) { ctx.fillStyle = 'rgba(220,235,245,0.8)'; for (let i = 0; i < 90; i++) ctx.fillRect((i * 97) % W, GROUND + 4 + (i * 37) % 50, 2, 2); }
      if (x.snow) { ctx.fillStyle = 'rgba(235,242,247,0.85)'; ctx.fillRect(0, GROUND, W, 4); }
      // fog
      if (x.fog) {
        for (let i = 0; i < fog.length; i++) {
          if (!reduce) fog[i] = (fog[i] + 8 * dt) % (W + 400);
          ctx.fillStyle = 'rgba(190,200,205,0.18)';
          ctx.fillRect(fog[i] - 400, GROUND - 90 + i * 22, 560, 26);
        }
      }
      // scanlines, as on Glacial's screen
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let y = 0; y < HGT; y += 3) ctx.fillRect(0, y, W, 1);
    };
  };
})();
