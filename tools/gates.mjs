// Gates: synthetic fixtures, fake clocks, no network. Run after `npm run build`.
// Every mutation anchor is read from the live register at runtime, so no gate
// depends on which state a record happens to be in today.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';
import sharp from 'sharp';
import { buildSite, loadRegister, root, publicRegister } from './build.mjs';
import { isAddress, contractLive, linkLive, handleOf } from '../src/js/ca.js';
import { createPoller, backoffDelay, nextHealth, fmtInt, fmtCompact, fmtPrice, fmtMs, DASH } from '../src/js/core.js';
import { pickChainTvl, topPairs, parseBlock, LLAMA_URL, DEX_URL, DEX_IMG_HOSTS } from '../src/js/sources.js';
import { wireCopy, copyText } from '../src/js/copy.js';
import { wilson, samplesToBar, BAR, Z } from '../src/js/lab.js';
import { buildCsp, connectOrigins } from '../src/csp.js';
import { BOOT } from '../src/page.js';

const t0 = Date.now();
const gates = [];
const gate = (name, fn) => gates.push({ name, fn });
const assert = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };
const eq = (a, b, msg) => assert(Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b), `${msg || 'eq'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const read = (p) => readFileSync(join(root, p), 'utf8');
const clone = (o) => JSON.parse(JSON.stringify(o));
const dom = (html) => parseHTML(html).document;
const SYN_ADDR = '0x' + 'aB'.repeat(20); // synthetic, mixed case
const SYN_X = 'https://x.com/Synthetic_Handle';
const SYN_GH = 'https://github.com/synthetic-org';
const texts = (d) => { d.querySelectorAll('script,style').forEach((n) => n.remove()); return d.body.textContent.replace(/\s+/g, ' ').trim(); };

function walk(dir, skip = ['node_modules', 'dist', '.git']) {
  const out = [];
  for (const f of readdirSync(dir)) {
    if (skip.includes(f)) continue;
    const p = join(dir, f);
    statSync(p).isDirectory() ? out.push(...walk(p, skip)) : out.push(p);
  }
  return out;
}
const srcFiles = () => walk(join(root, 'src')).filter((f) => ['.css', '.js', '.json', '.html'].includes(extname(f)));

const reg0 = loadRegister();
const render = (reg) => buildSite(reg, { themeColor: '' });

function fakeClock() {
  let t = 0, id = 0; const q = new Map(); const delays = [];
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  return {
    delays, timers: { set: (f, ms) => { const i = ++id; delays.push(ms); q.set(i, [t + ms, f]); return i; }, clear: (i) => q.delete(i) },
    pending: () => q.size,
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const next = [...q.entries()].filter(([, [at]]) => at <= end).sort((a, b) => a[1][0] - b[1][0])[0];
        if (!next) break;
        q.delete(next[0]); t = next[1][0]; await next[1][1](); await flush();
      }
      t = end; await flush();
    },
  };
}
function fakeDoc() {
  const ls = []; const d = { hidden: false, addEventListener: (t, f) => ls.push(f), removeEventListener: (t, f) => { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); }, fire() { ls.slice().forEach((f) => f()); } };
  return d;
}

// ---------------------------------------------------------------- register
gate('01 register: every record has one valid state and a consistent value', () => {
  const states = ['stated', 'absent', 'unconfirmed'];
  for (const [k, r] of Object.entries(reg0)) {
    assert(states.includes(r.state), `${k} state ${r.state}`);
    if (r.state === 'stated') assert(r.value != null && r.value !== '', `${k} stated without value`);
    else assert(r.value === null, `${k} ${r.state} must carry null`);
    assert('dated' in r && 'source' in r, `${k} missing provenance fields`);
  }
  eq(reg0.chain.value.chainId, 4663); eq(reg0.chain.value.chainIdHex, '0x1237');
  eq(parseInt(reg0.chain.value.chainIdHex, 16), reg0.chain.value.chainId, 'hex and decimal agree');
});

gate('02 contract absent: slot stays, label only, inert, no address, no handler target', () => {
  const r = clone(reg0); r.contract = { ...r.contract, state: 'absent', value: null };
  const d = dom(render(r).html);
  const bar = d.getElementById('ca');
  eq(bar.getAttribute('data-ca-state'), 'absent');
  assert(bar.querySelector('.ca-label').textContent.trim() === 'Contract', 'label');
  assert(!bar.querySelector('button') && !bar.querySelector('[data-copy]'), 'no copy control when absent');
  assert(bar.querySelector('.is-inert[aria-disabled="true"]'), 'inert slot present');
  assert(!/0x[0-9a-fA-F]{8}/.test(d.body.innerHTML.replace(/0x1237/g, '')), 'no hex address anywhere');
  eq(d.querySelectorAll('[data-ca-state="absent"] .is-inert').length >= 2, true, 'tile slot inert too');
});

gate('03 contract stated: full address in top slot, tile and footer, click-to-copy wired', () => {
  const r = clone(reg0); r.contract = { ...r.contract, state: 'stated', value: SYN_ADDR };
  const d = dom(render(r).html);
  const top = d.querySelector('#ca button.copy');
  assert(top, 'top slot button');
  eq(top.getAttribute('data-copy'), SYN_ADDR); eq(top.querySelector('.copy-val').textContent, SYN_ADDR, 'full address, not truncated');
  eq(top.getAttribute('data-live'), 'true');
  assert(top.querySelector('.copy-fb'), 'feedback node');
  eq(d.querySelectorAll('button[data-copy="' + SYN_ADDR + '"]').length, 3, 'top, tile, footer');
  eq(JSON.parse(d.getElementById('epoxy-config').textContent).contractLive, true);
});

gate('04 address gate never rejects valid hex (any case, odd patterns) and still rejects junk', () => {
  const ok = [SYN_ADDR, '0x' + 'a'.repeat(40), '0x' + 'A'.repeat(40), '0x' + '0'.repeat(40), '0x' + 'f'.repeat(40), '0x008Df4b3E857D06c4603Aeb11F267ccD32ce2005', '0x' + '1234567890'.repeat(4)];
  ok.forEach((a) => assert(isAddress(a), 'must accept ' + a));
  const bad = ['', null, undefined, 42, '0x', '0x' + 'a'.repeat(39), '0x' + 'a'.repeat(41), 'a'.repeat(40), '0x' + 'g'.repeat(40), '0x' + 'a'.repeat(20) + ' ' + 'a'.repeat(19), '0x' + 'a'.repeat(64)];
  bad.forEach((a) => assert(!isAddress(a), 'must reject ' + JSON.stringify(a)));
  // a stated record whose value is only partly address-shaped stays inert instead of crashing
  assert(!contractLive({ state: 'stated', value: '0xnot-an-address' }));
  assert(contractLive({ state: 'stated', value: ok[3] }));
  assert(!contractLive({ state: 'unconfirmed', value: SYN_ADDR }), 'unconfirmed stays inert');
});

gate('05 social links: both records, both branches, store URL / derive handle / no href unless stated', () => {
  for (const [key, label, synth] of [['x', 'Epoxy on X', SYN_X], ['github', 'Epoxy on GitHub', SYN_GH]]) {
    const r = clone(reg0);
    r[key] = { ...r[key], state: 'stated', value: synth };
    let d = dom(render(r).html);
    let el = d.querySelector(`[data-social="${key}"]`);
    eq(el.tagName, 'A'); eq(el.getAttribute('href'), synth, key + ' href follows the stored URL');
    assert(el.getAttribute('aria-label').includes(handleOf(synth)), 'handle derived from URL');
    assert(el.querySelector('svg'), 'icon');
    r[key] = { ...r[key], state: 'absent', value: null };
    d = dom(render(r).html); el = d.querySelector(`[data-social="${key}"]`);
    eq(el.tagName, 'SPAN'); assert(!el.hasAttribute('href'), 'no href when absent'); assert(el.querySelector('svg'), 'icon still rendered');
    eq(el.getAttribute('data-live'), 'false');
    r[key] = { ...r[key], state: 'unconfirmed', value: synth };
    d = dom(render(r).html); assert(!d.querySelector(`[data-social="${key}"]`).hasAttribute('href'), 'unconfirmed has no href');
    assert(!linkLive({ state: 'stated', value: 'javascript:alert(1)' }) && !linkLive({ state: 'stated', value: 'http://x.com/a' }), 'https only');
  }
  assert(!/Synthetic_Handle|synthetic-org/.test(render(reg0).html), 'fixtures never leak into the real build');
});

gate('06 social cluster: top-right, icon only, both at every breakpoint, official marks, 44px targets', () => {
  const d = dom(render(reg0).html);
  const tr = d.querySelector('.topright'); eq(tr.querySelectorAll('.soc').length, 2);
  eq(tr.textContent.replace(/\s+/g, ''), '', 'no text labels inside the cluster');
  const css = read('src/styles.css');
  assert(/\.topright\s*\{[^}]*grid-area:\s*soc/.test(css), 'top-right grid area');
  assert(!/(\.topright|\.soc)[^{}]*\{[^}]*display:\s*none/.test(css), 'never hidden');
  assert(!/hide-(xs|sm)[^"]*soc/.test(render(reg0).html), 'no hide class on icons');
  assert(/\.soc\s*\{[^}]*width:\s*var\(--tap\)[^}]*height:\s*var\(--tap\)/.test(css), '44px target');
  assert(/--tap:\s*44px/.test(css));
  const html = render(reg0).html;
  assert(html.includes('M18.901 1.153h3.68l-8.04 9.19L24 22.846'), 'X mark path');
  assert(html.includes('M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59'), 'GitHub octicon path');
});

gate('07 no dates render: register dates stay internal and absent from every shipped file', () => {
  const d = dom(render(reg0).html); const t = texts(d);
  assert(!/\b(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(t), 'iso-like date in text');
  assert(!/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(,\s*\d{4})?\b/i.test(t), 'month day in text');
  const dates = Object.values(reg0).map((r) => r.dated).filter(Boolean);
  const shipped = walk(join(root, 'dist')).filter((f) => ['.html', '.js', '.css', '.svg', '.txt', '', '.json'].includes(extname(f)) || f.endsWith('_headers'));
  for (const f of shipped) { const s = readFileSync(f, 'utf8'); dates.forEach((x) => assert(!s.includes(x), `${x} found in ${relative(root, f)}`)); }
  assert(!/data-dated|"dated"/.test(read('dist/index.html')), 'no dated field in markup');
});

gate('08 info tiles: exactly Chain, Contract, RPC; no social tiles', () => {
  const d = dom(render(reg0).html);
  const keys = [...d.querySelectorAll('.tiles .tile .tile-k')].map((n) => n.textContent.trim());
  eq(keys, ['Chain', 'Contract', 'RPC']);
  const t = d.querySelector('.tiles').textContent;
  assert(!/\bX\b|GitHub|twitter/i.test(t) && !d.querySelector('.tiles [data-social]') && !d.querySelector('.tiles a[href*="x.com"]'));
  eq(d.querySelector('.tiles .tile:nth-child(3) button').getAttribute('data-copy'), reg0.chain.value.rpc);
});

// ---------------------------------------------------------------- security
gate('09 CSP: header and meta cover every live origin; no inline style, handler or foreign host', () => {
  const site = render(reg0); const d = dom(site.html);
  const meta = d.querySelector('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  const pub = publicRegister(reg0);
  const connect = (c) => (c.match(/connect-src ([^;]*)/) || [])[1].split(' ');
  const wantConnect = [new URL(reg0.chain.value.rpc).origin, new URL(LLAMA_URL).origin, new URL(DEX_URL).origin];
  for (const h of [site.csp, meta]) {
    wantConnect.forEach((o) => assert(connect(h).includes(o), 'connect-src lacks ' + o));
    DEX_IMG_HOSTS.forEach((host) => assert(h.includes('img-src') && h.split('img-src')[1].split(';')[0].includes('https://' + host), 'img-src lacks ' + host));
    assert(/default-src 'none'/.test(h) && /object-src 'none'/.test(h) && /base-uri 'none'/.test(h));
    assert(!/unsafe-inline|unsafe-eval/.test(h), 'no unsafe directives');
  }
  assert(site.csp.includes("frame-ancestors 'none'") && !meta.includes('frame-ancestors'));
  const inline = d.querySelector('head script:not([src])').textContent;
  eq(inline, BOOT); eq(createHash('sha256').update(inline).digest('base64'), site.bootHash, 'boot script hash');
  assert(site.csp.includes(`'sha256-${site.bootHash}'`));
  assert(!d.querySelector('[style]') && !/\son[a-z]+\s*=/.test(site.html), 'no inline style attrs or handlers');
  const hosts = [...site.html.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].map((m) => new URL(m[1]).hostname);
  const okHosts = new Set(['epoxy.run', 'x.com']);
  hosts.forEach((h) => assert(okHosts.has(h), 'unexpected host in markup: ' + h));
  const headers = readFileSync(join(root, 'dist/_headers'), 'utf8');
  assert(headers.includes(buildCsp(pub, { bootHash: site.bootHash })), 'dist/_headers matches the policy');
  const js = readdirSync(join(root, 'dist/assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(root, 'dist/assets', f), 'utf8')).join('\n');
  const fetched = [...js.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]);
  const allowed = new Set([...wantConnect, 'https://cdn.dexscreener.com', 'https://dexscreener.com', 'https://x.com', 'https://epoxy.run']);
  fetched.forEach((o) => assert(allowed.has(o) || /^https:\/\/(www\.w3\.org|github\.com|reactjs\.org)/.test(o), 'bundle references origin outside the policy: ' + o));
});

gate('10 mutation: policy and RPC tile follow the register RPC (anchor read at runtime)', () => {
  const r = clone(reg0); const was = new URL(r.chain.value.rpc).origin;
  r.chain.value.rpc = 'https://rpc.synthetic-node.example/v1';
  const site = render(r); const d = dom(site.html);
  assert(site.csp.includes('https://rpc.synthetic-node.example') && !site.csp.includes(was), 'csp follows');
  eq(d.querySelector('.tiles .tile:nth-child(3) button').getAttribute('data-copy'), r.chain.value.rpc);
  eq(JSON.parse(d.getElementById('epoxy-config').textContent).rpc, r.chain.value.rpc);
  eq(connectOrigins(r)[0], 'https://rpc.synthetic-node.example');
});

// ---------------------------------------------------------------- palette & assets
gate('11 palette rule: colour literals live in tokens.css only', () => {
  const lit = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/;
  const tokens = read('src/tokens.css');
  for (const f of srcFiles()) {
    if (f.endsWith('tokens.css')) continue;
    const s = readFileSync(f, 'utf8').replace(/href="#[a-z]+"|data-tab="[a-z]+"|#(?:top|overview|pulse|pairs|lab|method|ca|progress-bar)\b/g, '');
    const m = s.match(lit); assert(!m, `${relative(root, f)} holds a colour literal: ${m && m[0]}`);
  }
  const html = read('dist/index.html');
  const theme = html.match(/theme-color" content="(#[0-9a-f]{6})"/)[1];
  assert(tokens.toLowerCase().includes(theme.toLowerCase()), 'theme-color comes from a token');
  const stripped = html.replace(/href="#[a-z-]+"|theme-color" content="#[0-9a-f]{6}"/g, '');
  assert(!/#[0-9a-fA-F]{3,8}\b/.test(stripped.replace(/<script[^>]*type="application\/json"[\s\S]*?<\/script>/, '')), 'no literal in built html');
});

gate('12 token provenance: every sampled value re-read from its source pixel', async () => {
  const css = read('src/tokens.css');
  const re = /--(px-[a-z-]+):\s*(#[0-9a-fA-F]{6});\s*\/\*\s*src=(.+?)\s+@(\d+),(\d+)\s*\*\//g;
  let m, n = 0; const cache = {};
  while ((m = re.exec(css))) {
    const [, name, hex, file, x, y] = m;
    cache[file] ||= await sharp(join(root, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = cache[file]; const i = (+y * info.width + +x) * 3;
    const got = '#' + [...data.subarray(i, i + 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
    eq(got, hex.toLowerCase(), `${name} at ${file} ${x},${y}`); n++;
  }
  const declared = (css.match(/--px-[a-z-]+:\s*#/g) || []).length;
  eq(n, declared, 'every --px token has a provenance marker'); assert(n >= 12, 'token count');
});

gate('13 logo: transparent source detected, premultiplied resize leaves no dark fringe', async () => {
  const rep = JSON.parse(read('tools/out/asset-report.json'));
  const logo = rep['brand/LOGO EPOXY PNG...png'];
  eq(logo.png.ihdr.colourType, 6); assert(logo.alpha.transparentPureBlack > 1e6 && logo.alpha.partial > 0 && logo.premultiplyRequired, 'premultiply condition detected');
  const made = JSON.parse(read('tools/out/assets-made.json')); assert(made.outputs.includes('logo-512.png'));
  for (const n of [64, 128, 256, 512]) {
    const { data } = await sharp(join(root, `src/assets/logo-${n}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let edge = 0, dark = 0, lit = 0;
    for (let i = 0; i < data.length; i += 4) { const a = data[i + 3]; if (a > 0 && a < 255) { edge++; const l = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114; if (l < 40) dark++; } else if (a === 0 && (data[i] || data[i + 1] || data[i + 2])) lit++; }
    assert(dark / Math.max(1, edge) < 0.05, `logo-${n}: dark fringe ${(dark / edge * 100).toFixed(1)}%`);
    assert(lit === 0, 'fully transparent pixels carry colour');
  }
});

gate('14 favicon: 32x32 SVG from the pixel grid, no comments, token colours only, linked', () => {
  const svg = read('src/assets/favicon.svg');
  assert(/viewBox="0 0 32 32"/.test(svg) && /width="32"/.test(svg) && /height="32"/.test(svg));
  assert(!svg.includes('<!--') && !svg.includes('--'), 'no XML comment / double hyphen');
  const d = parseHTML(svg).document; eq(d.documentElement.tagName.toLowerCase(), 'svg');
  const tokens = read('src/tokens.css').toLowerCase();
  [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].forEach((m) => assert(tokens.includes(m[1]), 'favicon colour not a token: ' + m[1]));
  assert(/rect|path/.test(svg) && svg.length > 1000, 'traced content');
  assert(render(reg0).html.includes('rel="icon" type="image/svg+xml" sizes="32x32" href="assets/favicon.svg"'));
  assert(existsSync(join(root, 'dist/favicon.svg')) && existsSync(join(root, 'dist/assets/favicon.svg')));
});

gate('15 responsive hygiene: no ch units anywhere, tap target token, 980px collapse, reduced motion', () => {
  for (const f of [...srcFiles(), join(root, 'dist/index.html'), ...walk(join(root, 'dist/assets')).filter((p) => p.endsWith('.css'))]) {
    const s = readFileSync(f, 'utf8'); assert(!/\d(?:\.\d+)?ch\b/.test(s), 'ch unit in ' + relative(root, f));
  }
  const css = read('src/styles.css');
  assert(/@media \(max-width: 980px\)[\s\S]*?\.hero-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/.test(css));
  const rm = css.slice(css.indexOf('prefers-reduced-motion'));
  ['animation-duration', 'transition-duration', '.js .reveal', '[data-depth]'].forEach((k) => assert(rm.includes(k), 'reduced motion lacks ' + k));
  const fx = read('src/js/fx.js'); assert((fx.match(/prefers-reduced-motion/g) || []).length >= 1 && /reduced\(\)/.test(fx), 'js honours reduced motion');
  assert(read('src/js/lab.js').includes('reduced()'));
});

// ---------------------------------------------------------------- live behaviour
gate('16 backoff: exponential ceilings, equal jitter, cap, reset on success (fake clock)', async () => {
  for (const [fails, ceil] of [[1, 2000], [2, 4000], [3, 8000], [4, 16000], [5, 32000], [6, 60000], [12, 60000]]) {
    const lo = backoffDelay(fails, { base: 2000, cap: 60000, rand: () => 0 }), hi = backoffDelay(fails, { base: 2000, cap: 60000, rand: () => 0.999999 });
    eq(lo, ceil / 2, 'floor at ' + fails); assert(hi >= ceil * 0.99 && hi <= ceil, 'ceiling at ' + fails);
  }
  const clock = fakeClock(); let ok = false; const seen = [];
  const p = createPoller({ task: async () => { if (!ok) throw new Error('down'); }, interval: 1000, base: 1000, cap: 8000, timers: clock.timers, rand: () => 0.5, onResult: (g, e, f) => seen.push([g, f]) });
  p.start(); await clock.advance(0);
  await clock.advance(60000); eq(p.fails >= 4, true, 'failures accumulate');
  const d = clock.delays.slice(0, 6); for (let i = 1; i < d.length; i++) assert(d[i] >= d[i - 1] * 0.74 || d[i] >= 6000, 'delays grow'); assert(Math.max(...clock.delays) <= 8000, 'cap holds');
  ok = true; await clock.advance(10000); eq(p.fails, 0, 'reset after success');
  const last = clock.delays[clock.delays.length - 1]; assert(last >= 900 && last <= 1100, 'back to the base interval, got ' + last);
  p.stop();
});

gate('17 poller with real timers: default scheduler works and survives a strict-receiver runtime', async () => {
  // Browsers throw "Illegal invocation" when a timer global is called as a method of another object; Node does not.
  // Shim the globals to behave like a browser so a receiver bug fails here instead of in production.
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  const guard = (fn) => function (...a) { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation'); return fn(...a); };
  globalThis.setTimeout = guard(realSet); globalThis.clearTimeout = guard(realClear);
  const rejected = []; const onRej = (e) => rejected.push(e); process.on('unhandledRejection', onRej);
  try {
    // fresh instance, evaluated after the shim exists, so module-level captures of the globals are guarded too
    const fresh = await import(pathToFileURL(join(root, 'src/js/core.js')).href + '?strict=' + Date.now());
    let n = 0, errs = []; const p = fresh.createPoller({ task: async () => { n++; }, interval: 8, base: 8, cap: 50, onResult: (ok, e) => e && errs.push(e) });
    p.start(); await new Promise((r) => realSet(r, 120)); p.stop(); assert(n >= 3, 'ran ' + n + ' times');
    const before = n; await new Promise((r) => realSet(r, 50)); eq(n, before, 'stopped means stopped'); await new Promise((r) => realSet(r, 10)); eq(errs.length + rejected.length, 0, 'no scheduler errors: ' + [...errs, ...rejected].map(String).join(';'));
    assert(/timers = realTimers/.test(read('src/js/copy.js')) && /timers = realTimers/.test(read('src/js/core.js')), 'default timers come from realTimers');
    let f = 0; const el = { getAttribute: (k) => ({ 'data-live': 'true', 'data-copy': 'x' })[k], setAttribute() {}, removeAttribute() { f++; }, addEventListener(t, h) { el.h = h; } };
    await wireCopy(el, { copy: async () => true, ms: 5, timers: fresh.realTimers })(); await new Promise((r) => realSet(r, 40)); eq(f, 1, 'copy feedback timer fires with default timers');
  } finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; process.off('unhandledRejection', onRej); }
});

gate('18 polling pauses while the tab is hidden and resumes at once when visible', async () => {
  const clock = fakeClock(), doc = fakeDoc(); doc.hidden = true; let calls = 0;
  const p = createPoller({ task: async () => { calls++; }, interval: 1000, timers: clock.timers, doc, rand: () => 0.5 });
  p.start(); await clock.advance(30000); eq(calls, 0, 'nothing runs while hidden'); eq(clock.pending(), 0, 'no timers armed'); assert(p.parked);
  doc.hidden = false; doc.fire(); await clock.advance(0); eq(calls, 1, 'immediate run on visible');
  await clock.advance(3000); assert(calls >= 3, 'cadence resumes');
  doc.hidden = true; doc.fire(); const at = calls; await clock.advance(60000); eq(calls, at, 'parked again'); eq(clock.pending(), 0);
  p.stop();
});

gate('19 sources: DefiLlama matched by chain id (name-independent), DexScreener filtered by tag', () => {
  const id = reg0.chain.value.chainId;
  const list = [{ name: 'Other', chainId: 1, tvl: 5 }, { name: 'Anything At All', chainId: id, tvl: 123456 }, { name: 'No id', tvl: 9 }];
  eq(pickChainTvl(list, id), 123456);
  eq(pickChainTvl(list.map((c) => ({ ...c, name: 'Robinhood Chain' })).filter((c) => c.chainId !== id), id), null, 'name match alone never counts');
  eq(pickChainTvl([{ chainId: String(id), tvl: '77' }], id), 77); eq(pickChainTvl(null, id), null); eq(pickChainTvl([{ chainId: id, tvl: 'x' }], id), null);
  const img = (h) => ({ imageUrl: `https://${h}/a.png` });
  const pairs = { pairs: [
    { chainId: 'solana', pairAddress: 's', baseToken: { symbol: 'SOL' }, volume: { h24: 9e9 } },
    { chainId: 'robinhood', pairAddress: 'a', baseToken: { symbol: 'AAA' }, quoteToken: { symbol: 'ETH' }, priceUsd: '0.5', volume: { h24: 10 }, info: img('cdn.dexscreener.com'), url: 'https://dexscreener.com/robinhood/a' },
    { chainId: 'robinhood', pairAddress: 'b', baseToken: { symbol: 'BBB' }, quoteToken: { symbol: 'USDG' }, priceUsd: '2', volume: { h24: 500 }, info: img('evil.example'), url: 'https://evil.example/x' },
    { chainId: 'robinhood', pairAddress: 'b', baseToken: { symbol: 'DUP' }, volume: { h24: 1 } },
    { chainId: 'robinhood', pairAddress: 'c', baseToken: { symbol: 'CCC' } },
  ] };
  const rows = topPairs(pairs, { limit: 8 });
  eq(rows.map((r) => r.symbol), ['BBB', 'AAA', 'CCC'], 'tag filter, de-dupe, volume order, missing volume last');
  eq(rows[0].logo, '', 'foreign image host dropped'); eq(rows[1].logo, 'https://cdn.dexscreener.com/a.png'); eq(rows[0].url, '', 'foreign link dropped');
  eq(topPairs({}, {}), []); eq(topPairs({ pairs: [] }), []);
  eq(parseBlock({ number: '0x10', timestamp: '0x5', gasUsed: '0xa', transactions: [1, 2] }).number, 16);
  let threw = false; try { parseBlock({ number: 'nope' }); } catch { threw = true; } assert(threw, 'bad block throws');
});

gate('20 dash fallback and health machine', () => {
  for (const f of [fmtInt, (v) => fmtCompact(v, '$'), fmtPrice, fmtMs]) [null, undefined, '', NaN, 'abc'].forEach((v) => eq(f(v), DASH, 'dash for ' + String(v)));
  eq(fmtPrice(0), DASH); eq(fmtInt(80640496), '80,640,496'); eq(fmtCompact(1048995695, '$'), '$1.05B'); eq(fmtCompact(37860.4, '$'), '$37.9K');
  eq(fmtPrice('0.000002035'), '$0.000002035');
  let h = 'connecting';
  h = nextHealth(h, false, 1); eq(h, 'connecting'); h = nextHealth(h, true, 0); eq(h, 'live');
  h = nextHealth(h, false, 1); eq(h, 'live', 'one miss does not flip a live feed'); h = nextHealth(h, false, 2); eq(h, 'live');
  h = nextHealth(h, false, 3); eq(h, 'offline'); h = nextHealth(h, true, 0); eq(h, 'live');
  const css = read('src/styles.css'); ['live', 'connecting', 'offline'].forEach((s) => assert(css.includes(`.pill[data-health="${s}"]`)));
  const d = dom(render(reg0).html); eq(d.getElementById('health').getAttribute('data-health'), 'connecting'); assert(d.querySelector('#health .dot'), 'pulsing dot');
  assert(/\.dot\s*\{[^}]*animation:\s*blip/.test(css));
});

gate('21 copy: feedback state appears and clears; legacy fallback; inert slot is never wired', async () => {
  const clock = fakeClock();
  const mk = (live) => { const a = { 'data-live': String(live), 'data-copy': SYN_ADDR }; const fn = {}; return { getAttribute: (k) => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; }, removeAttribute: (k) => { delete a[k]; }, addEventListener: (t, f) => { fn[t] = f; }, a, fn }; };
  const el = mk(true), live = { textContent: '' }; let got = null;
  const h = wireCopy(el, { copy: async (t) => { got = t; return true; }, timers: clock.timers, ms: 1600, live });
  await h(); eq(got, SYN_ADDR); eq(el.a['data-state'], 'copied'); eq(live.textContent, 'Copied to clipboard');
  await clock.advance(1700); assert(!('data-state' in el.a), 'feedback clears'); eq(live.textContent, '');
  const bad = mk(true); await wireCopy(bad, { copy: async () => false, timers: clock.timers })(); eq(bad.a['data-state'], 'failed');
  eq(wireCopy(mk(false), {}), null, 'inert slot not wired');
  let ran = false; const ta = { setAttribute() {}, select() {}, remove() {}, set value(v) { ran = v === 'xyz'; } };
  const env = { navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } }, document: { createElement: () => ta, body: { appendChild() {} }, execCommand: () => true } };
  eq(await copyText('xyz', env), true); assert(ran, 'legacy path used');
  eq(await copyText('x', { navigator: { clipboard: { writeText: async () => {} } } }), true);
});

// ---------------------------------------------------------------- copy & content
gate('22 copy novelty: no shared bigram with the reference page (stopword-only bigrams and brand nouns excluded)', () => {
  const STOP = new Set('a an and are as at be but by for from has have he her his i if in into is it its of on or our so that the their them then there these they this to too up us was we were what when which who will with you your not no do does did can could should would may might than also just more most much one all any each every how why while about over under again once only own same such very s t'.split(' '));
  const ALLOW = new Set(['robinhood chain']); // the chain's own name is a proper noun
  const tok = (x) => x.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  // bigrams are taken inside one text segment only, so neighbouring elements never fuse into a phrase
  const grams = (segs) => { const g = new Set(); for (const w of segs.map(tok)) for (let i = 0; i < w.length - 1; i++) { if ((STOP.has(w[i]) && STOP.has(w[i + 1])) || /\d/.test(w[i] + w[i + 1])) continue; g.add(w[i] + ' ' + w[i + 1]); } return g; };
  const refG = grams([read('tools/fixtures/reference-text.txt')]);
  const d = dom(render(reg0).html);
  d.querySelectorAll('script,style,svg').forEach((n) => n.remove());
  const segs = [];
  d.querySelectorAll('body *').forEach((el) => {
    const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').trim(); if (own) segs.push(own);
    ['aria-label', 'title'].forEach((a) => el.getAttribute(a) && segs.push(el.getAttribute(a)));
  });
  d.querySelectorAll('meta[name="description"],meta[property="og:description"],meta[property="og:title"]').forEach((n) => segs.push(n.getAttribute('content')));
  segs.push(d.querySelector('title').textContent);
  const shared = [...grams(segs)].filter((g) => refG.has(g) && !ALLOW.has(g));
  assert(shared.length === 0, 'shared bigrams: ' + shared.join(' | '));
  const forbidden = ['hourglass', 'epoch', 'sand', 'survival', 'golem'];
  const t = texts(dom(render(reg0).html)).toLowerCase(); forbidden.forEach((w) => assert(!t.includes(w), 'reference word ' + w));
});

gate('23 repo hygiene: no agent config, no tool attribution anywhere in the project', () => {
  for (const p of [['CLA', 'UDE.md'], ['.cla', 'ude'], ['AGE', 'NTS.md'], ['.cursor', 'rules'], ['.', 'git']].map((x) => x.join(''))) assert(!existsSync(join(root, p)), p + ' present');
  const pats = [['cla', 'ude'], ['anth', 'ropic'], ['chat', 'gpt'], ['open', 'ai'], ['co-', 'authored'], ['generated ', 'by'], ['copi', 'lot'], ['as an ', 'ai\\b']].map((p) => new RegExp(p.join(''), 'i'));
  for (const f of walk(root, ['node_modules', '.git'])) {
    if (!['.md', '.js', '.mjs', '.json', '.css', '.html', '.txt', '', '.svg', '.yml'].includes(extname(f)) || f.includes(join('tools', 'out')) || f.includes(join('tools', 'fixtures'))) continue;
    if (f.endsWith('package-lock.json')) continue;
    const s = readFileSync(f, 'utf8'); pats.forEach((re) => assert(!re.test(s), `${relative(root, f)} matches ${re}`));
  }
});

gate('24 deploy output: dist/ is complete, every reference resolves, nothing stray', () => {
  const html = read('dist/index.html'); const d = dom(html);
  const refs = [...d.querySelectorAll('[href],[src],[srcset]')].flatMap((n) => [n.getAttribute('href'), n.getAttribute('src'), ...(n.getAttribute('srcset') || '').split(',').map((s) => s.trim().split(' ')[0])]).filter(Boolean).filter((r) => !/^(#|https?:)/.test(r));
  refs.forEach((r) => assert(existsSync(join(root, 'dist', r)), 'dangling reference ' + r));
  const css = walk(join(root, 'dist/assets')).find((f) => /app\..*\.css$/.test(f)); const cs = readFileSync(css, 'utf8');
  [...cs.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, '')).filter((u) => !u.startsWith('#') && !u.startsWith('data:')).forEach((u) => assert(existsSync(join(root, 'dist/assets', u)), 'css url ' + u));
  ['_headers', 'index.html', 'favicon.svg', 'robots.txt'].forEach((f) => assert(existsSync(join(root, 'dist', f)), f));
  const all = walk(join(root, 'dist')); assert(!all.some((f) => f.endsWith('.map')), 'no sourcemaps');
  assert(all.reduce((s, f) => s + statSync(f).size, 0) < 2.5e6, 'dist under 2.5MB');
  eq(read('dist/index.html'), render(reg0).html.replace(/assets\/app\.css/, html.match(/assets\/app\.[0-9a-f]+\.css/)[0]).replace(/assets\/app\.js/, html.match(/assets\/app\.[0-9a-f]+\.js/)[0]).replace('content=""', html.match(/theme-color" content="([^"]*)"/) ? `content="${html.match(/theme-color" content="([^"]*)"/)[1]}"` : 'content=""'), 'dist/index.html is exactly what the renderer makes from the register');
});

gate('25 supporting files exist, are non-trivial and themed', () => {
  for (const f of ['README.md', 'docs/whitepaper.md', 'docs/tokenomics.md', 'docs/roadmap.md', 'docs/architecture.md', '.github/CONTRIBUTING.md', '.github/SECURITY.md', 'LICENSE']) {
    assert(existsSync(join(root, f)), f + ' missing'); const s = read(f); assert(s.length > 500, f + ' too short');
    if (f !== 'LICENSE') assert(/Epoxy/.test(s) && /Robinhood Chain/.test(s), f + ' not themed');
  }
  assert(!/\b(TODO|lorem|placeholder)\b/i.test(['README.md', 'docs/whitepaper.md', 'docs/tokenomics.md', 'docs/roadmap.md', 'docs/architecture.md'].map(read).join('\n')));
});

gate('26 mutation: contract flips both ways from whatever state the register holds today', () => {
  const now = contractLive(reg0.contract) ? 'stated' : 'absent';
  const flip = clone(reg0); flip.contract = now === 'stated' ? { ...reg0.contract, state: 'absent', value: null } : { ...reg0.contract, state: 'stated', value: SYN_ADDR };
  const a = render(reg0).html, b = render(flip).html; assert(a !== b, 'rendering ignores contract state');
  eq(dom(a).getElementById('ca').getAttribute('data-ca-state'), now); eq(dom(b).getElementById('ca').getAttribute('data-ca-state'), now === 'stated' ? 'absent' : 'stated');
  const back = clone(flip); back.contract = clone(reg0.contract); eq(render(back).html, a, 'flipping back restores the page byte for byte');
  const chain = clone(reg0); chain.chain.value.chainId = 1; assert(render(chain).html.includes('ID 1 '), 'chain tile reads the record');
});

gate('27 Cure Lab maths: Wilson floor is sane, monotone and the fill target is minimal', () => {
  const z = Z[2]; assert(Math.abs(wilson(0.64, 120, z) - 0.5509) < 0.002, 'reference value ' + wilson(0.64, 120, z));
  for (const p of [0.5, 0.64, 0.9]) { let prev = 0; for (const n of [20, 50, 120, 400, 2000, 5000]) { const L = wilson(p, n, z); assert(L <= p + 1e-9 && L >= prev - 1e-9, `monotone p=${p} n=${n}`); prev = L; } }
  assert(wilson(0.64, 120, Z[3]) < wilson(0.64, 120, Z[1]), 'higher confidence lowers the floor');
  const n = samplesToBar(0.7, z); assert(n && wilson(0.7, n, z) >= BAR && wilson(0.7, n - 10, z) < BAR, 'minimal n');
  eq(samplesToBar(0.55, z), null, 'unreachable bar reports null'); eq(wilson(0.5, 0, z), 0);
});

gate('28 premium visual checklist is present in the rendered page and styles', () => {
  const html = render(reg0).html, d = dom(html), css = read('src/styles.css'), js = read('src/js/fx.js') + read('src/js/app.js');
  assert(d.getElementById('matrix') && d.querySelector('#progress-bar'), 'canvas and progress bar');
  eq(new Set([...d.querySelectorAll('[data-depth]')].map((n) => n.getAttribute('data-depth'))).size >= 4, true, 'four parallax depths');
  assert(d.querySelectorAll('.reveal').length >= 12, 'scroll reveals'); assert(d.querySelectorAll('.pair-row.is-skel').length >= 8, 'skeleton rows');
  assert(d.querySelectorAll('section.theme-amber, section.theme-paper').length >= 1 && d.querySelector('.lab-paper.theme-paper'), 'light panels between dark ones');
  ['@keyframes flash', '@keyframes shimmer', '@keyframes blip', '@keyframes slideRow', '@keyframes ping', 'cubic-bezier(0.22, 1, 0.36, 1)'].forEach((k) => assert(css.includes(k) || read('src/tokens.css').includes(k), k));
  assert(/numberCell/.test(js) && /classList\.add\('flash'\)/.test(js) && /IntersectionObserver/.test(js) && /visibilitychange/.test(js), 'count-up, flash, observers');
  assert((css.match(/:hover/g) || []).length >= 25 && /:focus-visible/.test(css), 'hover and focus coverage');
  assert(/font-family: "JetBrains Mono"/.test(css) && /font-family: "Inter"/.test(css), 'mono plus sans');
  assert(d.querySelectorAll('.top, .ca-bar, .hero, .tiles, .stats, .telemetry, .lab, .method, .foot').length === 9, 'section stack');
});

gate('29 a11y basics: landmarks, labelled controls, live regions, one h1', () => {
  const d = dom(render(reg0).html);
  eq(d.querySelectorAll('h1').length, 1); assert(d.querySelector('main') && d.querySelector('header') && d.querySelector('footer') && d.querySelector('nav[aria-label]'));
  assert(d.getElementById('health').getAttribute('role') === 'status' && d.getElementById('copy-live').getAttribute('aria-live') === 'polite');
  d.querySelectorAll('button').forEach((b) => assert((b.textContent.trim() || b.getAttribute('aria-label')), 'unlabelled button'));
  d.querySelectorAll('input[type=range]').forEach((i) => assert(i.closest('label'), 'range without label'));
  d.querySelectorAll('img').forEach((i) => assert(i.hasAttribute('alt'), 'img without alt'));
  assert(d.querySelector('html').getAttribute('lang') === 'en' && d.querySelector('a.skip'));
});

gate('30 gate budget: fewer than 30 gates before this one is counted, run under 5 minutes', () => {
  assert(gates.length <= 30, 'too many gates: ' + gates.length);
  assert(Date.now() - t0 < 300000, 'over the five minute budget');
});

// ---------------------------------------------------------------- run
let failed = 0;
for (const g of gates) {
  const s = Date.now();
  try { await g.fn(); console.log(`PASS  ${g.name}  (${Date.now() - s} ms)`); }
  catch (e) { failed++; console.log(`FAIL  ${g.name}\n      ${String(e.message).split('\n')[0]}`); }
}
console.log(`\n${gates.length - failed}/${gates.length} gates passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
