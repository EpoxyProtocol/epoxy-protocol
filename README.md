# Epoxy

Epoxy is a bonding layer for Robinhood Chain. It reads blocks, liquidity and trading flow from public endpoints and joins them into one surface that stays legible while the chain moves at speed.

This repository holds the site, the register that feeds it, and the gates that keep both honest. The deployable output is `dist/`.

| | |
|---|---|
| Chain | Robinhood Chain |
| Chain id | 4663 (`0x1237`) |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Contract | not published yet; the page renders its slot and waits |
| Domain | epoxy.run |

## What the page does

- Follows the head block through the chain's own RPC and shows it in a ticker, a console feed and the stat strip.
- Shows a health pill (Live, Connecting, Offline) that reacts to real poll results, not to a timer.
- Pulls value locked from DefiLlama and matches the chain by its numeric id, never by display name.
- Ranks pools tagged `robinhood` on DexScreener by 24h volume, with logo, price and a volume share bar.
- Lets visitors drag three sliders in the Cure Lab to see why a hit rate must be read at its lower bound.

Every live figure falls back to a dash when its source fails. Polling backs off with jitter after a miss and parks while the tab is hidden.

## Commands

```bash
npm install
npm run assets   # read every file in brand/ and reference/, write tools/out/asset-report.json
npm run build    # src/ to dist/
npm run gates    # 30 gates on synthetic fixtures, no network, a few seconds
```

`tools/make-assets.mjs` regenerates logo sizes, the 32x32 favicon, the touch icon and the share image from the files in `brand/` and `reference/`. `tools/serve.mjs` serves `dist/` locally and applies `dist/_headers`, so the content security policy is enforced while you look at the page.

## Deploy

Drag the `dist/` folder into Cloudflare Pages. `dist/_headers` carries the content security policy, cache rules and transport headers. Nothing else needs configuring.

## The register

Every external fact lives in `src/register.json` as one record:

```json
{ "state": "stated | absent | unconfirmed", "value": "...", "source": "...", "dated": "..." }
```

- A record with state `stated` renders live. `absent` and `unconfirmed` render as a label with an inert slot.
- Links store the URL. The handle shown to assistive technology is derived from it.
- No `href` is ever written for a record that is not `stated`.
- Source and date stay inside the register. The renderer receives a stripped copy, so neither can reach the page.

To publish the contract, set `contract.state` to `stated` and put the address in `contract.value`. The next build turns the top slot, the info tile and the footer chip into click-to-copy controls. The address check accepts any `0x` plus 40 hex characters in any letter case.

To publish a repository, set `github.state` to `stated` and store the URL. The icon is already in the header; it becomes a link.

## Layout

```
brand/        logo files as supplied
reference/    banner and slide artwork as supplied
src/          page renderer, styles, tokens, runtime modules, register
tools/        asset analysis, build, gates, local server
docs/         whitepaper, tokenomics, roadmap, architecture
dist/         deploy output
```

## Colour

Colour literals exist only in `src/tokens.css`, and every one is a real pixel from the supplied artwork. The file records the source image and coordinate beside each value, and a gate re-reads that pixel on every run.

## Licence

MIT. See `LICENSE`.
