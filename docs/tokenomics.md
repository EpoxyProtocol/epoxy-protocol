# Epoxy Tokenomics Framework

## Status

No contract address has been published for Epoxy on Robinhood Chain. Because of that, **no supply, allocation, vesting schedule or launch parameter is final**, and none appears on the site. This document fixes the rules that will govern those numbers, so that nobody has to take a promise on trust when the numbers arrive.

The site reads one register file. While the contract record is `absent`, the contract slot is a label with an inert box. The moment the record becomes `stated`, the top bar, the info tile and the footer chip turn into click-to-copy controls carrying the full address.

## Principles

1. **Publish the address first.** Any statement about supply or distribution follows the contract, not the other way round. People should be able to check a claim against the chain on the day it is made.
2. **Everything checkable on chain stays on chain.** Total supply, holder balances, vesting contracts and pool positions are read from the RPC, not quoted from a slide.
3. **No hidden allocation.** Every wallet that holds tokens at launch is listed with its purpose before trading opens.
4. **Locked means locked in code.** A lock or vest is only called one if a contract enforces it and the contract address is published.
5. **No numbers before they are final.** Draft figures stay out of public material. A number on the site is a number that can be verified.

## Parameters

Each parameter below is a record. Until a record is stated, the page shows nothing for it.

| Parameter | State | How it will be disclosed |
|---|---|---|
| Contract address | absent | register, then page |
| Total supply | absent | read from the contract, quoted with the block it was read at |
| Initial pool pairing | absent | pool address and the quote asset |
| Team allocation | absent | wallet list and vesting contract |
| Treasury | absent | wallet list and spending policy |
| Community and ecosystem | absent | wallet list and distribution rules |
| Taxes or fees on transfer | absent | stated explicitly, including zero |
| Owner or admin permissions | absent | listed function by function |

## Buckets

Epoxy expects to use these five buckets. The size of each is intentionally not set here.

- **Pool liquidity.** The part that makes the token tradable on day one. Its pool address is public and its position is verifiable.
- **Builders.** Supports tools, integrations and research that make Robinhood Chain easier to read.
- **Treasury.** Pays for infrastructure and audits. Spending categories are published.
- **Team.** Always behind a vesting contract with a cliff. The contract address is public.
- **Community.** Distributed under rules that are written down before the first transfer.

## What the token is for

Epoxy is a reading layer. If a token is attached to it, its role must be explainable in two sentences and must not depend on price going up. Candidate roles under review are access to higher request limits on the readings interface and weighting in decisions about which pools are monitored. Neither is promised. Any role that ships will be described in the whitepaper with the exact contract calls involved.

## Verification recipe

Once an address is published, anyone can verify the basics with three read-only calls against `https://rpc.mainnet.chain.robinhood.com`:

1. `eth_getCode` at the address returns non-empty bytecode.
2. `totalSupply()` returns the figure the project quotes.
3. `balanceOf(wallet)` for each listed wallet matches the disclosed table.

The chain id must read `0x1237` (4663). Anything else is a different network.

## What changes on the site when the address lands

- The top bar shows the full address in large type, with a copy control and a visible confirmation.
- The Contract tile and footer chip show the same value.
- Nothing else on the page changes. In particular no price, market cap or return figure is added.

## Risk notes

Tokens are volatile and can go to zero. A published address proves that a contract exists, not that it is safe. Read the code, check the permissions, and never size a position by anything on this site. Epoxy is a reading tool, not financial advice.
