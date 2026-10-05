# Epoxy Roadmap

The roadmap is ordered, not dated. A phase opens when the one before it has met its exit test. Each exit test is something a person can check without asking us.

## Phase 0: Surface (shipped)

The public face of Epoxy on Robinhood Chain.

- Static site that builds into a single deployable folder.
- Live head block, health pill and console feed from the chain's RPC.
- Value locked from DefiLlama, matched on chain id 4663.
- Top pairs board from DexScreener, filtered to pools tagged `robinhood`.
- Backoff with jitter, dash fallbacks, polling that parks in hidden tabs.
- A register that decides what is published, and gates that prove both branches of every slot.
- The Cure Lab, an interactive explanation of lower-bound reading.

**Exit test:** `npm run build` and `npm run gates` both exit 0, and the page shows real figures from all three sources.

## Phase 1: Readings

Turn the building blocks in the whitepaper into numbers the page can show.

- Lower-bound rates on pool hit statistics.
- Freshness decay and depth weighting applied to pool volume.
- Flow balance per pool.
- Each reading shows its inputs, its floor and whether it has been released.

**Exit test:** every published reading can be recomputed by hand from the inputs shown beside it.

## Phase 2: Pool registry

A maintained list of pools the readings cover, with rules for entry and exit.

- Entry bar: minimum depth, minimum age, minimum number of distinct traders.
- Exit rule: pools that fall under the bar are marked, then removed, never silently dropped.
- Registry exported as plain JSON.

**Exit test:** the registry file and the pairs board agree on which pools are covered.

## Phase 3: Open interface

Make the readings usable outside the page.

- Read-only JSON feed of released readings.
- A short reference for every field, including its formula.
- Rate limits published up front.

**Exit test:** a developer can reproduce the page's top reading from the feed alone.

## Phase 4: Hardening

- Independent review of the readings maths.
- Second source for each input, with agreement scoring switched on.
- Public incident notes for any period where a source was wrong.

**Exit test:** a written review exists, and every finding is closed or explained.

## Contract milestones

The contract is tracked separately from the phases, because it depends on decisions that are not final.

| Milestone | State |
|---|---|
| Address published in the register | not yet |
| Framework in `tokenomics.md` filled with verified numbers | not yet |
| Contract tile shows the live address | follows the register |

## What is not on the roadmap

Price predictions, return targets and trading signals. Epoxy describes what happened on chain and how sure it is. It does not tell anyone what to buy.
