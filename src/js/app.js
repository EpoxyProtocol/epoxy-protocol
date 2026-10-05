// Runtime: live feeds, console, copy slots, and wiring for the visual layer.
import { DASH, createPoller, nextHealth, fmtInt, fmtCompact, fmtPrice, fmtMs } from './core.js';
import { rpcCall, parseBlock, pickChainTvl, topPairs, LLAMA_URL, DEX_URL } from './sources.js';
import { wireCopy } from './copy.js';
import { initMatrix, initScroll, initReveal, initSpy, numberCell } from './fx.js';
import { initLab } from './lab.js';

const $ = (id) => document.getElementById(id);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const cfg = JSON.parse($('epoxy-config').textContent);
const doc = document;
const doFetch = (...a) => fetch(...a);

// ---------- copy slots ----------
const live = $('copy-live');
doc.querySelectorAll('.copy[data-live="true"]').forEach((el) => wireCopy(el, { live }));

// ---------- visual layer ----------
initScroll(); initReveal(); initSpy(); initLab(reduced);
const matrix = initMatrix($('matrix'));

// ---------- cells ----------
const cell = (id, fmt) => numberCell($(id), fmt);
const cBlockTick = cell('tick-block', fmtInt), cBlockStat = cell('st-block', fmtInt), cBlockCard = cell('m-block', fmtInt);
const cTvlStat = cell('st-tvl', (v) => fmtCompact(v, '$')), cTvlCard = cell('m-tvl', (v) => fmtCompact(v, '$'));
const cPoolsStat = cell('st-pools', fmtInt), cPoolsCard = cell('m-pools', fmtInt);
const cVolStat = cell('st-vol', (v) => fmtCompact(v, '$'));
const cPullBlocks = cell('pull-blocks', fmtInt), cPullPools = cell('pull-pools', fmtInt), cPullTvl = cell('pull-tvl', fmtInt);
const setText = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };

// ---------- health ----------
const feeds = { rpc: 'wait', llama: 'wait', dex: 'wait' };
let health = 'connecting';
const LABEL = { live: 'Live', connecting: 'Connecting', offline: 'Offline' };
function paintHealth() {
  $('health').dataset.health = health;
  setText('health-label', LABEL[health]);
  $('chip-health').dataset.health = health;
  setText('chip-health-label', LABEL[health].toUpperCase());
}
function setFeed(name, st, latency) {
  feeds[name] = st;
  const li = doc.querySelector(`[data-feed="${name}"]`);
  li.dataset.st = st;
  li.querySelector('.st-tag').textContent = st === 'live' ? 'LIVE' : st === 'down' ? 'DOWN' : 'WAIT';
  $('lat-' + name).textContent = latency == null ? DASH : fmtMs(latency);
  const up = Object.values(feeds).filter((s) => s === 'live').length;
  setText('chip-feeds', up + '/3');
  setText('feeds-tag', up === 3 ? 'ALL LIVE' : Object.values(feeds).includes('down') ? 'DEGRADED' : 'WAITING');
}
const check = (name, ok) => { const el = doc.querySelector(`[data-check="${name}"]`); if (el) el.dataset.ok = String(ok); };
const timed = async (fn) => { const t = performance.now(); const v = await fn(); return [v, performance.now() - t]; };

// ---------- console ----------
const code = $('console-code'), feed = $('feed');
const cursor = code.querySelector('.cur');
let paused = false, queue = [], typing = null, typedLine = null, lineCount = 0;
const MAX_CODE_LINES = 11;
function enqueue(parts) { queue.push(parts); if (queue.length > 24) queue.splice(0, queue.length - 24); }
function typeNext() {
  if (typing || paused || !queue.length) return;
  const parts = queue.shift();
  const line = doc.createElement('div');
  code.insertBefore(line, cursor);
  while (code.querySelectorAll('div').length > MAX_CODE_LINES) code.querySelector('div').remove();
  const full = parts.map((p) => p[1]).join('');
  if (reduced()) { parts.forEach(([c, t]) => { const s = doc.createElement('span'); s.className = c; s.textContent = t; line.appendChild(s); }); lineCount++; setTimeout(typeNext, 0); return; }
  let i = 0; typing = true;
  const spans = parts.map(([c]) => { const s = doc.createElement('span'); s.className = c; line.appendChild(s); return s; });
  const bounds = []; let acc = 0; parts.forEach((p) => { acc += p[1].length; bounds.push(acc); });
  const tick = () => {
    if (paused) { typing = setTimeout(tick, 120); return; }
    i = Math.min(full.length, i + 3);
    let prev = 0;
    spans.forEach((s, k) => { s.textContent = full.slice(prev, Math.min(i, bounds[k])); prev = bounds[k]; });
    if (i < full.length) typing = setTimeout(tick, 18);
    else { typing = null; lineCount++; setTimeout(typeNext, queue.length > 4 ? 0 : 1500); }
  };
  tick();
}
const boot = [
  [['c-dim', '$ '], ['c-hot', 'epoxy attach ' + '--chain ' + cfg.chainId]],
  [['c-dim', 'rpc  '], ['', 'handshake with ' + new URL(cfg.rpc).host]],
  [['c-dim', 'rpc  '], ['', 'expecting chain id ' + cfg.chainIdHex]],
];
boot.forEach(enqueue); typeNext();
const pauseBtn = $('console-pause');
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.setAttribute('aria-pressed', String(paused));
  pauseBtn.querySelector('.b-txt').textContent = paused ? 'Resume' : 'Pause';
  if (!paused) typeNext();
});

let blocksRead = 0, poolsPriced = 0, tvlSyncs = 0;
function pushFeed(b, dtMs) {
  const li = doc.createElement('li');
  li.className = 'feed-row';
  const l = doc.createElement('span'); const n = doc.createElement('span'); n.className = 'fr-n'; n.textContent = '#' + fmtInt(b.number);
  const t = doc.createElement('b'); t.textContent = Number.isFinite(b.txs) ? b.txs + ' tx' : DASH;
  l.append(n, ' ', t);
  const r = doc.createElement('span'); r.textContent = dtMs == null ? DASH : '+' + (dtMs / 1000).toFixed(1) + 's';
  li.append(l, r);
  feed.prepend(li);
  while (feed.children.length > 24) feed.lastChild.remove();
}

// ---------- chain feed ----------
let prevBlock = null, prevAt = 0, rateWin = [], chainOk = false;
const rpcPoller = createPoller({
  interval: 2500, base: 2500, cap: 60000, doc,
  task: async () => {
    const [res, ms] = await timed(async () => {
      const blk = await rpcCall(doFetch, cfg.rpc, 'eth_getBlockByNumber', ['latest', false]);
      return parseBlock(blk);
    });
    if (!chainOk) {
      const id = await rpcCall(doFetch, cfg.rpc, 'eth_chainId');
      if (String(id).toLowerCase() !== cfg.chainIdHex.toLowerCase()) throw new Error('chain id mismatch');
      chainOk = true; check('chain', true);
    }
    const now = performance.now();
    cBlockTick.set(res.number); cBlockStat.set(res.number); cBlockCard.set(res.number);
    setText('m-txs', fmtInt(res.txs));
    setText('m-gas', fmtCompact(res.gasUsed));
    if (prevBlock !== null && res.number > prevBlock) {
      rateWin.push([now, res.number]); if (rateWin.length > 12) rateWin.shift();
      const a = rateWin[0], z = rateWin[rateWin.length - 1];
      if (z[0] > a[0]) setText('m-rate', ((z[1] - a[1]) / ((z[0] - a[0]) / 1000)).toFixed(1));
      blocksRead += res.number - prevBlock > 0 ? 1 : 0;
      cPullBlocks.set(blocksRead, { count: false });
      pushFeed(res, now - prevAt);
      enqueue([['c-dim', 'blk  '], ['c-hot', '#' + fmtInt(res.number)], ['', '  txs ' + (Number.isFinite(res.txs) ? res.txs : DASH) + '  gas ' + fmtCompact(res.gasUsed)]]);
      typeNext(); matrix && matrix.pulse();
    } else if (prevBlock === null) {
      blocksRead = 1; cPullBlocks.set(1, { count: false });
      pushFeed(res, null);
      enqueue([['c-dim', 'rpc  '], ['c-ok', 'chain id ok, head #' + fmtInt(res.number)]]); typeNext();
    }
    if (prevBlock === null || res.number > prevBlock) { prevBlock = res.number; prevAt = now; }
    setFeed('rpc', 'live', ms);
  },
  onResult: (ok, err, fails) => {
    health = nextHealth(health, ok, fails); paintHealth();
    if (!ok) { setFeed('rpc', fails >= 3 ? 'down' : 'wait', null); if (health === 'offline') { ['tick-block'].forEach((id) => setText(id, DASH)); } }
  },
});

// ---------- value locked ----------
const tvlPoller = createPoller({
  interval: 60000, base: 8000, cap: 300000, doc,
  task: async () => {
    const [list, ms] = await timed(async () => { const r = await fetch(LLAMA_URL); if (!r.ok) throw new Error('llama ' + r.status); return r.json(); });
    const tvl = pickChainTvl(list, cfg.chainId);
    if (tvl == null) throw new Error('chain id not listed');
    cTvlStat.set(tvl); cTvlCard.set(tvl);
    tvlSyncs += 1; cPullTvl.set(tvlSyncs, { count: false });
    check('tvl', true); setFeed('llama', 'live', ms);
    enqueue([['c-dim', 'tvl  '], ['', 'value locked ' + fmtCompact(tvl, '$')]]); typeNext();
  },
  onResult: (ok, err, fails) => { if (!ok) { setFeed('llama', fails >= 2 ? 'down' : 'wait', null); if (fails >= 2) { setText('st-tvl', DASH); setText('m-tvl', DASH); } } },
});

// ---------- pairs ----------
const list = $('pairs-list');
let lastRows = [], pairsAt = 0, pairsEvery = 30000, order = '';
function logoNode(r) {
  const d = doc.createElement('span'); d.className = 'logo';
  if (r.logo) { const im = doc.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; im.src = r.logo; im.addEventListener('error', () => { im.remove(); d.textContent = r.symbol.slice(0, 1).toUpperCase(); }); d.appendChild(im); }
  else d.textContent = r.symbol.slice(0, 1).toUpperCase();
  return d;
}
function rowNode(r, i, total, isNew) {
  const a = doc.createElement(r.url ? 'a' : 'div');
  a.className = 'pair-row' + (isNew ? ' is-new' : '');
  if (r.url) { a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', `${r.symbol} on DexScreener`); }
  const rk = doc.createElement('span'); rk.className = 'rk'; rk.textContent = String(i + 1);
  const who = doc.createElement('span'); who.className = 'who';
  const nm = doc.createElement('span'); nm.className = 'nm';
  const b = doc.createElement('b'); b.textContent = r.symbol;
  const q = doc.createElement('span'); q.textContent = r.quote ? '/ ' + r.quote : DASH;
  nm.append(b, q); who.append(logoNode(r), nm);
  const px = doc.createElement('span'); px.className = 'px'; px.textContent = fmtPrice(r.priceUsd);
  const vol = doc.createElement('span'); vol.className = 'vol'; vol.textContent = fmtCompact(r.volume24, '$');
  a.append(rk, who, px, vol);
  a.style.setProperty('--sh', total > 0 && r.volume24 != null ? Math.min(1, r.volume24 / total).toFixed(3) : '0');
  const li = doc.createElement('li'); li.appendChild(a); return li;
}
function paintPairs(rows) {
  const total = rows.reduce((s, r) => s + (r.volume24 || 0), 0);
  const key = rows.map((r) => r.key).join('|');
  const orderChanged = key !== order; order = key;
  const prevKeys = new Set(lastRows.map((r) => r.key));
  list.replaceChildren(...rows.map((r, i) => rowNode(r, i, total, orderChanged && lastRows.length > 0 && !prevKeys.has(r.key))));
  lastRows = rows;
  return total;
}
function paintPairsFailed() {
  if (lastRows.length) return;
  list.replaceChildren(...Array.from({ length: 4 }, (_, i) => { const li = doc.createElement('li'); li.className = 'pair-row is-dash'; for (const t of [String(i + 1), '', DASH, DASH]) { const s = doc.createElement('span'); s.textContent = t; if (!t) s.className = 'who'; li.appendChild(s); } li.children[2].className = 'px'; li.children[3].className = 'vol'; return li; }));
  setText('st-pools', DASH); setText('st-vol', DASH); setText('m-pools', DASH); setText('m-covbadge', '24h ' + DASH); setText('m-sharev', DASH);
}
const pairsPoller = createPoller({
  interval: pairsEvery, base: 6000, cap: 240000, doc,
  task: async () => {
    const [json, ms] = await timed(async () => { const r = await fetch(DEX_URL); if (!r.ok) throw new Error('dex ' + r.status); return r.json(); });
    const rows = topPairs(json, { limit: 8 });
    if (!rows.length) throw new Error('no tagged pairs');
    const total = paintPairs(rows);
    const all = (json.pairs || []).filter((p) => p.chainId === 'robinhood');
    const allVol = all.reduce((s, p) => s + (Number(p.volume && p.volume.h24) || 0), 0);
    cPoolsStat.set(all.length); cPoolsCard.set(all.length); cVolStat.set(allVol);
    setText('m-covbadge', '24h ' + fmtCompact(allVol, '$'));
    const share = allVol > 0 ? (rows[0].volume24 || 0) / allVol : 0;
    $('m-share').style.setProperty('--w', (share * 100).toFixed(1));
    setText('m-sharev', (share * 100).toFixed(1) + '%');
    poolsPriced = all.length; cPullPools.set(poolsPriced, { count: false });
    pairsAt = performance.now(); check('pairs', true); setFeed('dex', 'live', ms);
    enqueue([['c-dim', 'dex  '], ['', all.length + ' pools tagged, top ' + rows[0].symbol + ' ' + fmtCompact(rows[0].volume24, '$')]]); typeNext();
    void total;
  },
  onResult: (ok, err, fails) => { if (!ok) { setFeed('dex', fails >= 2 ? 'down' : 'wait', null); if (fails >= 2) paintPairsFailed(); } },
});

// board freshness
setInterval(() => {
  if (doc.hidden) return;
  if (!pairsAt) return;
  const age = (performance.now() - pairsAt) / 1000;
  setText('board-age', 'Last sync ' + Math.round(age) + 's ago');
  $('board-bar').style.setProperty('--w', Math.min(100, (age / (pairsEvery / 1000)) * 100).toFixed(0));
}, 1000);

rpcPoller.start(); tvlPoller.start(); pairsPoller.start();
