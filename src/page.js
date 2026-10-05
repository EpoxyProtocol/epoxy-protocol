// Pure page renderer: register in, HTML string out. No clock, no network.
import { contractLive, linkLive, handleOf } from './js/ca.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const ICONS = {
  // official X mark, 24x24 viewBox
  x: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>',
  // official GitHub Octicon mark-github, 16x16 viewBox
  github: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>',
  copy: '<svg class="ico-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg class="ico-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg class="ico-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  play: '<svg class="ico-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  arrow: '<svg class="ico-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  drip: '<svg class="ico-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3c3.5 4.4 6 7.2 6 10.5a6 6 0 0 1-12 0C6 10.2 8.5 7.4 12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  reset: '<svg class="ico-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export const BOOT = "document.documentElement.className+=' js'";

const NAV = [
  ['overview', 'Overview'],
  ['pulse', 'Pulse'],
  ['pairs', 'Pairs'],
  ['lab', 'Cure Lab'],
  ['method', 'Method'],
];

function social(kind, rec, label) {
  const on = linkLive(rec);
  if (on) {
    const handle = handleOf(rec.value);
    const name = handle ? `${label} (${handle})` : label;
    return `<a class="soc" data-social="${kind}" data-live="true" href="${esc(rec.value)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)}" title="${esc(name)}">${ICONS[kind]}</a>`;
  }
  return `<span class="soc is-inert" data-social="${kind}" data-live="false" role="img" aria-label="${esc(label)}">${ICONS[kind]}</span>`;
}

function contractSlot(rec, variant) {
  if (contractLive(rec)) {
    const a = rec.value.trim();
    return `<button type="button" class="copy ${variant}" data-live="true" data-copy="${esc(a)}" aria-label="Copy contract address ${esc(a)}">` +
      `<span class="copy-val" translate="no">${esc(a)}</span>` +
      `<span class="copy-ico"><span class="i-copy">${ICONS.copy}</span><span class="i-done">${ICONS.check}</span></span>` +
      `<span class="copy-fb" aria-hidden="true">Copied</span></button>`;
  }
  return `<span class="copy ${variant} is-inert" data-live="false" aria-disabled="true"><span class="ghost" aria-hidden="true"></span></span>`;
}

export function renderPage(reg, files = { css: 'assets/app.css', js: 'assets/app.js', themeColor: '' }) {
  const chain = reg.chain.value;
  const caOn = contractLive(reg.contract);
  const xOn = linkLive(reg.x);
  const xHandle = xOn ? handleOf(reg.x.value) : '';
  const config = { rpc: chain.rpc, chainId: chain.chainId, chainIdHex: chain.chainIdHex, contractLive: caOn };
  const site = 'https://epoxy.run/';
  const desc = 'Epoxy joins blocks, liquidity and trading flow on Robinhood Chain into one live, readable surface.';
  const title = 'Epoxy | Build on Robinhood Chain';

  const rpcTile = `<button type="button" class="copy tile-copy" data-live="true" data-copy="${esc(chain.rpc)}" aria-label="Copy RPC endpoint ${esc(chain.rpc)}">` +
    `<span class="copy-val" translate="no">${esc(chain.rpc)}</span>` +
    `<span class="copy-ico"><span class="i-copy">${ICONS.copy}</span><span class="i-done">${ICONS.check}</span></span>` +
    `<span class="copy-fb" aria-hidden="true">Copied</span></button>`;

  const skeletonRows = Array.from({ length: 8 }, (_, i) =>
    `<li class="pair-row is-skel" aria-hidden="true"><span class="rk">${i + 1}</span><span class="who"><i class="sk sk-logo"></i><span class="sk sk-w1"></span></span><span class="sk sk-w2 px"></span><span class="sk sk-w2 vol"></span></li>`).join('');

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">${files.cspMeta ? `
<meta http-equiv="Content-Security-Policy" content="${esc(files.cspMeta)}">` : ''}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${site}">
<meta name="theme-color" content="${esc(files.themeColor || '')}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Epoxy">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${site}">
<meta property="og:image" content="${site}assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="400">
<meta name="twitter:card" content="summary_large_image">${xOn ? `\n<meta name="twitter:site" content="${esc(xHandle)}">` : ''}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${site}assets/og.jpg">
<link rel="icon" type="image/svg+xml" sizes="32x32" href="assets/favicon.svg">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="preload" href="assets/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/jetbrains-mono.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${files.css}">
<script>${BOOT}</script>
</head>
<body>
<div class="progress" aria-hidden="true"><i id="progress-bar"></i></div>
<a class="skip" href="#overview">Skip to content</a>
<div class="wrap">

<header class="top glass" id="top">
  <div class="top-id">
    <a class="wordmark" href="#top" aria-label="Epoxy, back to top">
      <img class="wm-logo" src="assets/logo-128.png" srcset="assets/logo-128.png 1x, assets/logo-256.png 2x" width="72" height="72" alt="Epoxy logo">
      <span class="wm-text"><span class="wm-name">Epoxy</span><span class="wm-sub">Chain ${esc(chain.chainId)}</span></span>
    </a>
    <p class="top-blurb">One bonding layer for ${esc(chain.name)}. Blocks, liquidity and trading flow are joined into a single surface that stays readable at speed.</p>
  </div>
  <nav class="tabs" aria-label="Sections">
    ${NAV.map(([id, l], i) => `<a class="tab${i === 0 ? ' is-on' : ''}" href="#${id}" data-tab="${id}"><span>${l}</span></a>`).join('\n    ')}
  </nav>
  <div class="topright" aria-label="Social links">
    ${social('x', reg.x, 'Epoxy on X')}
    ${social('github', reg.github, 'Epoxy on GitHub')}
  </div>
  <div class="top-live">
    <span class="ticker" title="Latest block"><span class="k">Block</span><span class="v num" id="tick-block" data-num>—</span></span>
    <span class="pill" id="health" data-health="connecting" role="status" aria-live="polite"><i class="dot"></i><b id="health-label">Connecting</b></span>
  </div>
</header>

<div class="ca-bar" id="ca" data-ca-state="${caOn ? 'stated' : 'absent'}">
  <span class="ca-label">Contract</span>
  ${contractSlot(reg.contract, 'ca-copy')}
  <span class="sr-only" id="copy-live" role="status" aria-live="polite"></span>
</div>

<main>
<section class="hero hero-grid" id="overview" data-spy>
  <div class="scene">
    <div class="scene-fx" aria-hidden="true">
      <div class="orb orb-a" data-depth="0.34"></div>
      <div class="orb orb-b" data-depth="0.22"></div>
      <img class="backdrop" data-depth="0.14" src="assets/hero-backdrop.webp" alt="" width="1500" height="500" decoding="async">
      <canvas class="matrix" id="matrix" data-depth="0.28"></canvas>
      <div class="scene-vignette"></div>
    </div>
    <div class="scene-tag"><i class="dot"></i>Chain feed, live</div>
    <div class="scene-copy" data-depth="-0.07">
      <p class="eyebrow">Build on ${esc(chain.name)}</p>
      <h1 class="display"><span class="dl">Fuse the chain</span> <span class="dl dl-hot">into one clear signal.</span></h1>
      <p class="lede">Epoxy follows every block, pool and swap on ${esc(chain.name)} and sets them into readings you can lean on. No guesswork, just flow that has held.</p>
      <div class="cta">
        <a class="btn btn-solid" href="#pulse"><span>Watch the pulse</span>${ICONS.arrow}</a>
        <a class="btn btn-ghost" href="#lab"><span>Try the cure lab</span></a>
      </div>
    </div>
    <p class="scene-cap">Resin alone stays soft, hardener alone does nothing. A reading is only called final once both sides agree.</p>
  </div>

  <div class="screen" id="console">
    <div class="scr-bar">
      <span class="lamp-wrap"><i class="lamp"></i><span class="scr-t">epoxy : tailing</span></span>
      <span class="scr-chip hide-xs">rpc · ${esc(chain.name.toLowerCase())}</span>
      <button type="button" class="scr-btn" id="console-pause" aria-pressed="false"><span class="b-ico">${ICONS.pause}</span><span class="b-txt">Pause</span></button>
    </div>
    <div class="code" id="console-code" aria-hidden="true"><span class="cur"></span></div>
    <div class="pull">
      <span>blocks read <b class="num" id="pull-blocks" data-num>0</b></span>
      <span>pools priced <b class="num" id="pull-pools" data-num>0</b></span>
      <span>value syncs <b class="num" id="pull-tvl" data-num>0</b></span>
    </div>
    <div class="feedbox"><ol class="feedin" id="feed" aria-live="off" aria-label="Recent blocks"></ol></div>
  </div>
</section>

<section class="tiles" aria-label="Network facts">
  <article class="tile reveal"><h2 class="tile-k">Chain</h2><p class="tile-v">${esc(chain.name)}</p><p class="tile-s num">ID ${esc(chain.chainId)} · ${esc(chain.chainIdHex)}</p></article>
  <article class="tile reveal" data-ca-state="${caOn ? 'stated' : 'absent'}"><h2 class="tile-k">Contract</h2>${contractSlot(reg.contract, 'tile-copy')}</article>
  <article class="tile reveal"><h2 class="tile-k">RPC</h2>${rpcTile}</article>
</section>

<section class="stats theme-amber" id="pulse" data-spy aria-label="Live figures">
  <div class="st reveal"><div class="st-k">Head block</div><div class="st-v num" id="st-block" data-num>—</div></div>
  <div class="st reveal"><div class="st-k">Value locked</div><div class="st-v num" id="st-tvl" data-num>—</div></div>
  <div class="st reveal"><div class="st-k">Pools tracked</div><div class="st-v num" id="st-pools" data-num>—</div></div>
  <div class="st reveal"><div class="st-k">24h volume</div><div class="st-v num" id="st-vol" data-num>—</div></div>
</section>

<section class="telemetry">
  <div class="tele-head reveal">
    <div>
      <div class="tag"><i class="dot"></i><span>Pulse &amp; telemetry</span></div>
      <h2 class="h2">Everything Epoxy is reading, live</h2>
      <p class="p-dim">Public endpoints polled straight from your browser. Nothing is stored on our side, so every figure here is only as old as its last good poll.</p>
    </div>
    <div class="chips">
      <div class="chip"><span class="faint">FEEDS</span><b class="acc num" id="chip-feeds">0/3</b></div>
      <div class="chip chip-hot" id="chip-health" data-health="connecting"><i class="dot"></i><b id="chip-health-label">CONNECTING</b></div>
    </div>
  </div>

  <div class="cards">
    <article class="card reveal" data-hue="amber"><div class="card-top"><span class="k">Head block</span><span class="badge">On chain</span></div><div class="card-v num" id="m-block" data-num>—</div><div class="card-f"><span>Txs in latest</span><b class="num" id="m-txs">—</b></div></article>
    <article class="card reveal" data-hue="gold"><div class="card-top"><span class="k">Block cadence</span><span class="badge">Measured</span></div><div class="card-v"><span class="num" id="m-rate">—</span><span class="unit">blk/s</span></div><div class="card-f"><span>Gas in latest</span><b class="num" id="m-gas">—</b></div></article>
    <article class="card reveal" data-hue="orange"><div class="card-top"><span class="k">Value locked</span><span class="badge">DefiLlama</span></div><div class="card-v num" id="m-tvl" data-num>—</div><div class="card-f"><span>Matched on chain id</span><b class="num">${esc(chain.chainId)}</b></div></article>
    <article class="card reveal" data-hue="rust"><div class="card-top"><span class="k">Pool coverage</span><span class="badge" id="m-covbadge">24h —</span></div><div class="card-v num" id="m-pools" data-num>—</div><div class="meter" aria-hidden="true"><i id="m-share"></i></div><div class="card-f"><span>Top pool share</span><b class="num" id="m-sharev">—</b></div></article>
  </div>

  <div class="tele-grid">
    <div class="col-left">
      <article class="panel reveal">
        <div class="panel-h"><h3 class="h3">Feed channels</h3><span class="tagline" id="feeds-tag">WAITING</span></div>
        <p class="p-dim sm">Three public sources on independent schedules. Each backs off with jitter after a miss and parks while this tab is hidden.</p>
        <ul class="feeds">
          <li class="feed" data-feed="rpc" data-st="wait"><i class="ping"></i><div class="feed-m"><b>Chain RPC</b><span>height and chain id</span></div><div class="feed-r"><b class="num" id="lat-rpc">—</b><span class="st-tag">WAIT</span></div></li>
          <li class="feed" data-feed="llama" data-st="wait"><i class="ping"></i><div class="feed-m"><b>DefiLlama</b><span>value locked by chain id</span></div><div class="feed-r"><b class="num" id="lat-llama">—</b><span class="st-tag">WAIT</span></div></li>
          <li class="feed" data-feed="dex" data-st="wait"><i class="ping"></i><div class="feed-m"><b>DexScreener</b><span>pools tagged robinhood</span></div><div class="feed-r"><b class="num" id="lat-dex">—</b><span class="st-tag">WAIT</span></div></li>
        </ul>
      </article>
      <article class="panel reveal">
        <div class="panel-h"><h3 class="h3">Readiness checks</h3></div>
        <ul class="checks">
          <li class="check" data-check="chain" data-ok="false"><i class="tick"></i><span>RPC answers with chain id ${esc(chain.chainIdHex)}</span></li>
          <li class="check" data-check="tvl" data-ok="false"><i class="tick"></i><span>Value locked matched on id ${esc(chain.chainId)}</span></li>
          <li class="check" data-check="pairs" data-ok="false"><i class="tick"></i><span>Pools carry the robinhood tag</span></li>
          <li class="check" data-check="park" data-ok="true"><i class="tick"></i><span>Polling parks while the tab is hidden</span></li>
        </ul>
      </article>
    </div>

    <article class="panel board reveal" id="pairs" data-spy>
      <div class="panel-h"><h3 class="h3">Top pairs board</h3><span class="tagline">TAGGED ROBINHOOD</span></div>
      <p class="p-dim sm">Pools ranked by 24h volume, straight from the exchange feed. Rows slide in when the order changes.</p>
      <div class="board-head" aria-hidden="true"><span>#</span><span>Pair</span><span class="px">Price</span><span class="vol">24h volume</span></div>
      <ol class="pairs" id="pairs-list" aria-live="off">${skeletonRows}</ol>
      <div class="board-foot">
        <div><div class="k acc">Board freshness</div><div class="p-dim sm" id="board-age">No sync yet</div></div>
        <div class="board-prog" aria-hidden="true"><i id="board-bar"></i></div>
      </div>
    </article>
  </div>
</section>

<section class="lab tex-diag" id="lab" data-spy>
  <div class="lab-bar"><span class="lab-t">The Cure Lab</span><span class="tagline" id="lab-pct">FLOOR 0.0%</span></div>
  <div class="lab-grid">
    <div class="lab-vial">
      <i class="br br-tl"></i><i class="br br-tr"></i><i class="br br-bl"></i><i class="br br-br"></i>
      <div class="vial-k"><i class="dot"></i>Bond vial</div>
      <div class="vial" id="vial">
        <svg viewBox="0 0 120 220" role="img" aria-label="Bond vial filled to the confidence floor" class="vial-svg">
          <defs>
            <clipPath id="vial-clip"><path d="M30 14h60v22l16 24c4 6 6 12 6 19v103a22 22 0 0 1-22 22H30a22 22 0 0 1-22-22V79c0-7 2-13 6-19l16-24Z"/></clipPath>
            <linearGradient id="resin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--px-gold)"/><stop offset=".55" stop-color="var(--px-orange)"/><stop offset="1" stop-color="var(--px-ember-lo)"/></linearGradient>
          </defs>
          <g clip-path="url(#vial-clip)">
            <rect class="vial-bg" x="0" y="0" width="120" height="220"/>
            <g class="liquid" id="liquid"><path class="wave wave-b" d="M-60 6c20-8 40 8 60 0s40-8 60 0 40 8 60 0 40-8 60 0V230h-240Z"/><path class="wave wave-a" d="M-60 6c20 8 40-8 60 0s40 8 60 0 40-8 60 0 40 8 60 0V230h-240Z"/></g>
            <line class="bar-line" id="bar-line" x1="0" x2="120" y1="0" y2="0"/>
          </g>
          <path class="vial-edge" d="M30 14h60v22l16 24c4 6 6 12 6 19v103a22 22 0 0 1-22 22H30a22 22 0 0 1-22-22V79c0-7 2-13 6-19l16-24Z"/>
        </svg>
      </div>
      <div class="vial-read"><div class="k faint">Confidence floor</div><div class="big num" id="vial-big">0.0<span>%</span></div></div>
      <div class="duo"><div><div class="faint">Raw rate</div><b class="acc num" id="duo-raw">0.500</b></div><div class="r"><div class="faint">Bar</div><b class="live num" id="duo-bar">0.600</b></div></div>
    </div>

    <div class="lab-paper theme-paper">
      <h3 class="h3 big-h">Trust the floor, not the headline</h3>
      <p class="p-dim sm">A hit rate taken from few observations can flatter itself. Epoxy shrinks every rate to its Wilson lower bound, the level the real rate is unlikely to dip under at the confidence you pick.</p>
      <div class="formula" id="formula">
        <div class="f-eq" translate="no">L = ( p + z²/2n − z·√( p(1−p)/n + z²/4n² ) ) / ( 1 + z²/n )</div>
        <div class="f-ex" id="f-ex" translate="no"></div>
        <div class="f-ex" id="f-ex2" translate="no"></div>
      </div>
      <p class="p-dim xs">Epoxy releases a reading at its floor L and keeps the unadjusted rate p out of the headline. A strong rate on few samples leaves the vial low, by design.</p>
    </div>

    <div class="lab-ctl">
      <div class="trio">
        <div class="tri"><div class="k faint">raw rate p</div><div class="v live num" id="r-p">0.500</div></div>
        <div class="tri"><div class="k faint">gap</div><div class="v acc num" id="r-gap">—</div></div>
        <div class="tri"><div class="k faint">floor L</div><div class="v acc num" id="r-l">0.000</div></div>
      </div>
      <div class="ctrl">
        <label class="sr-row" for="in-n"><span class="lbl">samples n</span><input type="range" id="in-n" min="20" max="5000" step="10" value="120"><output id="out-n" for="in-n">120</output></label>
        <label class="sr-row" for="in-p"><span class="lbl">raw rate p</span><input type="range" id="in-p" min="0.5" max="0.95" step="0.005" value="0.64"><output id="out-p" for="in-p">0.640</output></label>
        <label class="sr-row" for="in-z"><span class="lbl">confidence</span><input type="range" id="in-z" min="1" max="3" step="1" value="2"><output id="out-z" for="in-z">95%</output></label>
      </div>
      <div class="verdict" id="verdict" aria-live="polite"></div>
      <div class="btnrow">
        <button type="button" class="btn-s btn-s-solid" id="btn-drip">${ICONS.drip}<span>Drip samples</span></button>
        <button type="button" class="btn-s" id="btn-fill">${ICONS.arrow}<span>Reach the bar</span></button>
        <button type="button" class="btn-s btn-s-ghost" id="btn-reset">${ICONS.reset}<span>Reset</span></button>
      </div>
    </div>
  </div>
</section>

<section class="method theme-paper tex-paper" id="method" data-spy>
  <div class="method-in">
    <div class="m-head reveal">
      <div><div class="m-tag">Method notes</div><h2 class="h2">How a pool earns its place</h2></div>
    </div>
    <div class="m-grid">
      <article class="m-card reveal"><header><span class="m-t">Lower-bound reading</span><span class="m-n">(1.1)</span></header><div class="m-f" translate="no">L = wilson(p, n, z)</div><p>Every rate shown here sits at its floor. The unadjusted figure is only a starting point.</p></article>
      <article class="m-card reveal"><header><span class="m-t">Freshness decay</span><span class="m-n">(2.1)</span></header><div class="m-f" translate="no">w(t) = 2<sup>−t/h</sup></div><p>Older trades count for less. A half-life h keeps stale volume from posing as flow.</p></article>
      <article class="m-card m-wide reveal"><header><span class="m-t">Depth weighting</span><span class="m-n">(2.2)</span></header><div class="m-f" translate="no">S = Σ wᵢ · min(vᵢ, c·Dᵢ) / Σ wᵢ</div><p>A trade is only counted up to a slice of the pool depth D. One outsized swap cannot repaint a whole reading, and thin pools cannot fake a trend.</p></article>
      <article class="m-card reveal"><header><span class="m-t">Flow balance</span><span class="m-n">(3.1)</span></header><div class="m-f" translate="no">B = (buys − sells) / (buys + sells)</div><p>Pressure on each side, squeezed into a single number between −1 and 1.</p></article>
      <article class="m-card reveal"><header><span class="m-t">Source agreement</span><span class="m-n">(3.2)</span></header><div class="m-f" translate="no">A = 1 − |x₁ − x₂| / max(x₁, x₂)</div><p>When two feeds disagree, the reading waits instead of picking a favourite.</p></article>
    </div>
  </div>
</section>
</main>

<footer class="foot">
  <div class="foot-l"><span>Live data from public endpoints. Epoxy is a reading tool, not financial advice.</span><span class="foot-w">Readings describe what already happened on chain. They do not predict price.</span></div>
  <div class="foot-r"><span class="foot-k">Contract</span>${contractSlot(reg.contract, 'foot-copy')}</div>
</footer>
</div>
<script type="application/json" id="epoxy-config">${JSON.stringify(config)}</script>
<script type="module" src="${files.js}"></script>
</body>
</html>
`;
}
