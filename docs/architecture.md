# Epoxy Architecture

Epoxy is a static site with a live layer that runs entirely in the visitor's browser. There is no application server and no database. The deployable output is the `dist/` folder.

## Components

```
                         build time
  src/register.json ─┐
  src/tokens.css ────┼─▶ tools/build.mjs ─▶ dist/index.html
  src/page.js ───────┤                      dist/assets/app.<hash>.css
  src/styles.css ────┤                      dist/assets/app.<hash>.js
  src/js/* ──────────┘                      dist/_headers

                         run time (browser)
  index.html ─▶ app.js ─┬─▶ RPC poller      ─▶ rpc.mainnet.chain.robinhood.com
                        ├─▶ value poller    ─▶ api.llama.fi
                        ├─▶ pairs poller    ─▶ api.dexscreener.com
                        ├─▶ console + feed  (typed log, block rows)
                        └─▶ fx (canvas, scroll, reveal, count-up)
```

### Register

`src/register.json` holds one record per external fact with a `state` of `stated`, `absent` or `unconfirmed`. The build passes the page a stripped copy that carries only `state` and `value`, so sources and dates cannot reach the markup.

### Renderer

`src/page.js` is a pure function from register to HTML. It has no clock and no network, which is what lets the gates render it with synthetic registers and compare branches byte for byte.

### Runtime modules

| Module | Job |
|---|---|
| `core.js` | backoff, poller, health state machine, number formatting with dash fallback |
| `sources.js` | RPC call, block parsing, chain-id match for TVL, pair filtering |
| `copy.js` | clipboard write with a legacy fallback and the copied-state loop |
| `lab.js` | Wilson lower bound and the Cure Lab controls |
| `fx.js` | matrix canvas, scroll progress, parallax, reveals, tab spy, count-up cells |
| `app.js` | wires the modules to the DOM |

## Polling policy

| Source | Interval | Base for backoff | Cap |
|---|---|---|---|
| Chain RPC | 2.5 s | 2.5 s | 60 s |
| DefiLlama | 60 s | 8 s | 300 s |
| DexScreener | 30 s | 6 s | 240 s |

After a failed poll the next delay is drawn from the upper half of `min(cap, base · 2^(n−1))`, which spreads out clients that failed at the same moment. A success resets the counter. Each success schedules the next poll at the interval plus or minus ten percent.

Polling parks while `document.hidden` is true and resumes with an immediate run when the tab becomes visible.

## Health

The pill is driven by the RPC poller only: `connecting` until the first success, `live` after it, and `offline` after three failures in a row. A single miss on a live feed does not change the pill.

The RPC task also checks `eth_chainId` once. A value other than `0x1237` counts as a failure, so the page never presents another network as Robinhood Chain.

## Failure behaviour

| Failure | What the page does |
|---|---|
| RPC unreachable | ticker shows a dash, pill moves to offline after three misses |
| DefiLlama unreachable or chain id missing | TVL cells show a dash, feed row shows DOWN |
| DexScreener unreachable | last good board stays; if none exists the board shows dash rows |
| Pair logo fails to load | the logo is replaced by the first letter of the symbol |
| Clipboard blocked | legacy copy path; if that fails the control shows a failed state |

## Security

`dist/_headers` carries a content security policy built from the same module that the gates test. Scripts load from the same origin plus one hashed inline line that adds a class to the root element. Connections are limited to the chain RPC, DefiLlama and DexScreener. Images come from the same origin and the DexScreener image host. No inline styles, no inline handlers, no frames, no forms, no plugins.

Data from third parties is only ever written with `textContent` or as validated URLs: pair links must start with the DexScreener origin and logo URLs must be https on the allowed image host.

## Visual layer

Colour comes from CSS custom properties defined in one file. The hero canvas reads them at start-up, so the matrix colours track the same tokens as everything else. Motion honours `prefers-reduced-motion`: the canvas draws a single still frame, reveals show immediately, parallax and count-up are skipped.

## Gates

`npm run gates` renders the page with synthetic registers and fixtures, drives the pollers with a fake clock, and checks the built output. It never touches the network and finishes in seconds. Gates anchor their mutations on whatever the register holds when they run, so they keep passing when a record changes state.
