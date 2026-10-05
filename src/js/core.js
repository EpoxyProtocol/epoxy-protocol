export const DASH = '—';
// Wrapped so the globals are never called with a foreign receiver.
export const realTimers = { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t) };

// Equal-jitter exponential backoff: the delay lands in [ceiling/2, ceiling].
export function backoffDelay(fails, { base = 2000, cap = 60000, rand = Math.random } = {}) {
  const ceiling = Math.min(cap, base * 2 ** Math.max(0, fails - 1));
  return Math.round(ceiling / 2 + rand() * (ceiling / 2));
}

// Poller: runs `task`, schedules the next run, backs off on failure, parks while
// the document is hidden and resumes with an immediate run when it is visible.
export function createPoller({ task, interval, base, cap, timers = realTimers, doc = null, rand = Math.random, onResult = () => {} }) {
  let fails = 0, timer = null, running = false, stopped = true, parked = false;
  const hidden = () => !!doc && doc.hidden === true;
  const clear = () => { if (timer != null) { timers.clear(timer); timer = null; } };
  const schedule = (ms) => {
    clear();
    if (stopped) return;
    if (hidden()) { parked = true; return; }
    timer = timers.set(run, ms);
  };
  async function run() {
    timer = null;
    if (stopped || running) return;
    if (hidden()) { parked = true; return; }
    running = true;
    try {
      await task();
      fails = 0;
      running = false;
      onResult(true, null, fails);
      schedule(Math.round(interval * (0.9 + rand() * 0.2)));
    } catch (err) {
      fails += 1;
      running = false;
      onResult(false, err, fails);
      schedule(backoffDelay(fails, { base: base ?? interval, cap, rand }));
    }
  }
  const onVis = () => {
    if (!doc) return;
    if (hidden()) { clear(); parked = true; }
    else if (parked && !stopped) { parked = false; clear(); run(); }
  };
  if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVis);
  return {
    start() { stopped = false; parked = false; run(); },
    stop() {
      stopped = true; clear();
      if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVis);
    },
    get fails() { return fails; },
    get parked() { return parked; },
  };
}

// connecting -> live on success; offline after three straight failures.
export function nextHealth(prev, ok, fails) {
  if (ok) return 'live';
  if (fails >= 3) return 'offline';
  return prev === 'live' ? 'live' : 'connecting';
}

const num = (v) => (v == null || v === '' ? NaN : Number(v));
export const fmtInt = (v) => { const n = num(v); return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : DASH; };
export const fmtCompact = (v, prefix = '') => {
  const n = num(v);
  if (!Number.isFinite(n)) return DASH;
  const abs = Math.abs(n);
  const [d, s] = abs >= 1e12 ? [1e12, 'T'] : abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : abs >= 1e3 ? [1e3, 'K'] : [1, ''];
  const x = n / d;
  return prefix + (s ? x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2) : x.toFixed(0)) + s;
};
export const fmtPrice = (v) => {
  const n = num(v);
  if (!Number.isFinite(n) || n <= 0) return DASH;
  return '$' + n.toLocaleString('en-US', { maximumSignificantDigits: n >= 1 ? 6 : 4, maximumFractionDigits: 12 });
};
export const fmtMs = (v) => { const n = num(v); return Number.isFinite(n) ? Math.round(n) + ' ms' : DASH; };
