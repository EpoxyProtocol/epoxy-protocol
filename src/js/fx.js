// Visual layer: matrix canvas, scroll progress, parallax, reveals, tab spy, count-up.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function initMatrix(canvas) {
  const ctx = canvas.getContext('2d');
  const glyphs = '0123456789abcdef0x<>/=+*'.split('');
  const colors = { head: css('--px-ember-hi'), mid: css('--px-gold'), body: css('--px-orange'), tail: css('--px-rust'), ground: css('--px-void') };
  let w = 0, h = 0, cols = [], size = 16, raf = 0, visible = true, last = 0, kick = 0, running = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(r.width)); h = Math.max(1, Math.floor(r.height));
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = w < 480 ? 14 : 16;
    const n = Math.ceil(w / size);
    cols = Array.from({ length: n }, (_, i) => ({ y: Math.random() * h * 1.1 - h * 0.1, v: 0.4 + Math.random() * 0.9, len: 10 + Math.floor(Math.random() * 22), seed: i }));
    ctx.fillStyle = colors.ground; ctx.globalAlpha = 1; ctx.fillRect(0, 0, w, h);
  }
  function step(dt) {
    ctx.globalAlpha = 0.16; ctx.fillStyle = colors.ground; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1; ctx.font = `600 ${size}px "JetBrains Mono", monospace`; ctx.textBaseline = 'top';
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i], x = i * size;
      c.y += c.v * size * dt * 0.012 * (1 + kick);
      if (c.y - c.len * size > h) { c.y = -Math.random() * size * 4; c.v = 0.4 + Math.random() * 0.9; c.len = 10 + Math.floor(Math.random() * 22); }
      for (let j = 0; j < c.len; j++) {
        const y = c.y - j * size;
        if (y < -size || y > h) continue;
        const t = j / c.len;
        ctx.fillStyle = j === 0 ? colors.head : t < 0.25 ? colors.mid : t < 0.6 ? colors.body : colors.tail;
        ctx.globalAlpha = j === 0 ? 1 : Math.max(0.2, 1 - t);
        ctx.fillText(glyphs[(((c.seed * 7 + j * 3 + Math.floor(y / size)) % glyphs.length) + glyphs.length) % glyphs.length], x, y);
      }
    }
    ctx.globalAlpha = 1;
  }
  function loop(t) {
    if (!running) return;
    const dt = Math.min(48, t - (last || t)); last = t;
    kick *= 0.94;
    step(dt);
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (running || reduced() || document.hidden || !visible) return; running = true; last = 0; raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  resize();
  if (reduced()) { for (let i = 0; i < 60; i++) step(32); } else start();
  new ResizeObserver(() => { resize(); if (reduced()) for (let i = 0; i < 60; i++) step(32); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  return { pulse() { kick = 2.2; } };
}

export function initScroll() {
  const bar = document.getElementById('progress-bar');
  const layers = [...document.querySelectorAll('[data-depth]')];
  const hero = document.getElementById('overview');
  let ticking = false;
  const apply = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = scrollY;
    if (bar) bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : '0');
    if (reduced()) return;
    const top = hero ? hero.getBoundingClientRect().top : 0;
    if (top < innerHeight && top > -hero.offsetHeight) {
      const off = -top;
      for (const el of layers) el.style.setProperty('--py', (off * parseFloat(el.dataset.depth)).toFixed(1) + 'px');
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }, { passive: true });
  addEventListener('resize', apply);
  apply();
}

export function initReveal() {
  const items = [...document.querySelectorAll('.reveal')];
  if (reduced() || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('in')); return; }
  const groups = new Map();
  items.forEach((el) => { const p = el.parentElement; const n = groups.get(p) || 0; el.style.setProperty('--d', Math.min(n, 5) * 70 + 'ms'); groups.set(p, n + 1); });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach((el) => io.observe(el));
}

export function initSpy() {
  const tabs = new Map([...document.querySelectorAll('[data-tab]')].map((a) => [a.dataset.tab, a]));
  const set = (id) => tabs.forEach((a, k) => a.classList.toggle('is-on', k === id));
  const ids = [...tabs.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const io = new IntersectionObserver((es) => {
    const vis = es.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (vis) set(vis.target.id);
  }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.2, 0.5] });
  ids.forEach((el) => io.observe(el));
}

// Number element that counts toward its target and flashes when the value changes.
export function numberCell(el, format) {
  let shown = null, raf = 0, settle = 0;
  return {
    set(next, { count = true } = {}) {
      if (next == null || !Number.isFinite(next)) { cancelAnimationFrame(raf); clearTimeout(settle); el.textContent = format(NaN); shown = null; return; }
      if (shown === next) return;
      const from = shown, to = next;
      const changed = shown !== null;
      shown = next;
      cancelAnimationFrame(raf);
      if (reduced() || !count || (from === null && to === 0)) { el.textContent = format(to); }
      else {
        const start = performance.now(), dur = from === null ? 900 : 600, a = from === null ? 0 : from;
        const tick = (now) => {
          const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 4);
          el.textContent = format(a + (to - a) * e);
          if (p < 1) raf = requestAnimationFrame(tick); else el.textContent = format(to);
        };
        raf = requestAnimationFrame(tick);
        // frames are throttled in background tabs: land on the final value regardless
        clearTimeout(settle); settle = setTimeout(() => { cancelAnimationFrame(raf); el.textContent = format(to); }, dur + 120);
      }
      if (changed && !reduced()) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    },
  };
}
