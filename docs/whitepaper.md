# Epoxy Whitepaper

## Abstract

Robinhood Chain produces more data than any person can follow: blocks arrive in fractions of a second, pools open and drain, and volume swings between a handful of pairs. Raw numbers are loud and easy to misread. Epoxy is a bonding layer for Robinhood Chain. It collects the loud parts, weighs them against each other, and publishes readings only when the evidence holds together.

The name is the method. Resin and hardener are inert apart. Mixed in the right proportion they set into something stronger than either. Epoxy treats flow and depth the same way: trading flow tells you what happened, pool depth tells you whether it mattered, and a reading is released only when both agree.

## 1. The problem

Three habits make on-chain dashboards unreliable.

1. **Headline rates.** A hit rate of 70 percent sounds strong until you learn it came from ten observations.
2. **Stale volume.** Yesterday's burst keeps inflating today's totals because nothing ages it out.
3. **Single sources.** One feed disagrees with another, and the dashboard silently picks the louder one.

Epoxy answers each with a rule that is written down, testable and visible in the product.

## 2. Readings

A reading is a number plus the evidence under it. Epoxy computes five building blocks.

### 2.1 Lower-bound rate

For a hit rate `p` over `n` observations at confidence `z`, Epoxy reports the Wilson lower bound:

```
L = ( p + z²/2n − z·√( p(1−p)/n + z²/4n² ) ) / ( 1 + z²/n )
```

`L` is the level the real rate is unlikely to fall below. It is always at or under `p`, it rises as `n` grows, and it falls as the requested confidence rises. The Cure Lab on the site lets you move all three inputs and watch the floor respond.

### 2.2 Freshness decay

Each trade is weighted by `w(t) = 2^(−t/h)`, where `t` is its age and `h` is a half-life. Old trades fade instead of disappearing at a hard cutoff, so a reading never jumps because one trade crossed a window edge.

### 2.3 Depth weighting

A trade only counts up to a slice of the pool's depth:

```
S = Σ wᵢ · min(vᵢ, c·Dᵢ) / Σ wᵢ
```

`D` is the pool's depth and `c` is a cap fraction. One oversized swap cannot repaint a whole reading, and a thin pool cannot fake a trend.

### 2.4 Flow balance

`B = (buys − sells) / (buys + sells)` squeezes pressure on each side into a single number between −1 and 1.

### 2.5 Source agreement

`A = 1 − |x₁ − x₂| / max(x₁, x₂)` compares two feeds that measure the same thing. When agreement is low, the reading waits.

## 3. The release rule

A reading is released when its lower-bound value clears a published bar and source agreement is high enough. Until then it is shown as unset. The site's vial is a small model of this: the liquid is the floor, the dashed line is the bar, and the verdict says how many more observations would lift one over the other.

Nothing in this paper predicts price. Readings describe what already happened on chain, with honest error bars.

## 4. Inputs

| Input | Source | Used for |
|---|---|---|
| Head block, chain id | Robinhood Chain RPC | liveness, cadence, chain check |
| Value locked | DefiLlama, matched on chain id 4663 | headline TVL |
| Pools and volume | DexScreener, pools tagged `robinhood` | pair board, coverage |

All three are public endpoints queried from the visitor's browser. Epoxy stores nothing on a server. Every figure on the site is as old as its last successful poll and shows a dash when a source fails.

## 5. Honesty rules

- A value that cannot be verified is shown as a dash, never estimated.
- A record that has not been published is shown as a label with an inert slot.
- The contract address, repository and any other external fact are published by editing one register file, and the page follows it.
- Release thresholds and half-lives are published with the readings that use them.

## 6. Limits

Public indexers lag and sometimes disagree. Pools can be created and abandoned in minutes. A lower bound protects against small samples, not against a market that changes character. Epoxy is a reading tool, not financial advice.

## 7. Status

The site, its live feeds and the Cure Lab are built. No contract has been published. When one is, it appears in the register first and on the page second; see `tokenomics.md` for the rules that govern what will be disclosed and when.
