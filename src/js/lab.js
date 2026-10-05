// Cure Lab: Wilson lower bound of a hit rate, plus the interactive panel.
export const Z = { 1: 1.645, 2: 1.96, 3: 2.576 };
export const CONF = { 1: '90%', 2: '95%', 3: '99%' };
export const BAR = 0.6;

export function wilson(p, n, z) {
  if (!(n > 0)) return 0;
  const z2 = z * z;
  const centre = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return Math.max(0, Math.min(1, (centre - spread) / (1 + z2 / n)));
}

// Smallest sample size (step 10) that lifts the floor over the bar; null when out of reach.
export function samplesToBar(p, z, bar = BAR, max = 5000) {
  for (let n = 20; n <= max; n += 10) if (wilson(p, n, z) >= bar) return n;
  return null;
}

export function initLab(reduced) {
  const $ = (id) => document.getElementById(id);
  const inN = $('in-n'), inP = $('in-p'), inZ = $('in-z');
  if (!inN) return;
  const state = { timer: 0 };
  const fillRange = (el) => { const f = ((el.value - el.min) / (el.max - el.min)) * 100; el.style.setProperty('--fill', f.toFixed(1) + '%'); };

  function render() {
    const n = +inN.value, p = +inP.value, zi = +inZ.value, z = Z[zi];
    const L = wilson(p, n, z), gap = p - L, ok = L >= BAR;
    $('out-n').textContent = n.toLocaleString('en-US');
    $('out-p').textContent = p.toFixed(3);
    $('out-z').textContent = CONF[zi];
    $('r-p').textContent = p.toFixed(3);
    $('r-gap').textContent = gap.toFixed(3);
    $('r-l').textContent = L.toFixed(3);
    $('duo-raw').textContent = p.toFixed(3);
    $('duo-bar').textContent = BAR.toFixed(3);
    const pct = (L * 100).toFixed(1);
    $('vial-big').innerHTML = pct + '<span>%</span>';
    $('lab-pct').textContent = 'FLOOR ' + pct + '%';
    const y = (v) => 232 - v * 208;
    $('vial').style.setProperty('--ly', y(L).toFixed(1));
    const bl = $('bar-line'); bl.setAttribute('y1', y(BAR).toFixed(1)); bl.setAttribute('y2', y(BAR).toFixed(1));
    $('f-ex').textContent = `n = ${n.toLocaleString('en-US')}   p = ${p.toFixed(3)}   z = ${z}`;
    $('f-ex2').textContent = `L = ${L.toFixed(3)}   gap = p − L = ${gap.toFixed(3)}`;
    const v = $('verdict');
    v.dataset.ok = String(ok);
    if (ok) v.innerHTML = `Floor <b>${L.toFixed(3)}</b> clears the bar of <b>${BAR.toFixed(3)}</b>. The reading has set and can be released.`;
    else {
      const need = samplesToBar(p, z);
      v.innerHTML = `Raw rate <b>${p.toFixed(3)}</b>, but the floor sits at <b>${L.toFixed(3)}</b>. ` + (need ? `Roughly <b>${need.toLocaleString('en-US')}</b> samples would lift it over the bar.` : `No sample size under 5,000 lifts it over the bar at this rate.`);
    }
    [inN, inP, inZ].forEach(fillRange);
  }
  const stop = () => { clearInterval(state.timer); state.timer = 0; };
  [inN, inP, inZ].forEach((el) => el.addEventListener('input', () => { stop(); render(); }));
  $('btn-drip').addEventListener('click', () => {
    stop(); inN.value = inN.min;
    if (reduced()) { inN.value = 1500; render(); return; }
    state.timer = setInterval(() => {
      inN.value = Math.min(+inN.max, +inN.value + 60);
      render();
      if (+inN.value >= 1500) stop();
    }, 60);
  });
  $('btn-fill').addEventListener('click', () => {
    stop();
    const need = samplesToBar(+inP.value, Z[+inZ.value]);
    inN.value = need ?? inN.max; render();
  });
  $('btn-reset').addEventListener('click', () => { stop(); inN.value = 120; inP.value = 0.64; inZ.value = 2; render(); });
  render();
}
