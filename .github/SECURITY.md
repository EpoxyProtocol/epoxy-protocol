# Security Policy

Epoxy is a static site for Robinhood Chain that reads three public endpoints from the visitor's browser. It holds no keys, takes no payments and stores no user data. That keeps the attack surface small, but not empty.

## What is in scope

- The site served from the `dist/` build.
- The content security policy in `dist/_headers` and the matching meta tag.
- Any way for third-party data (RPC replies, DefiLlama, DexScreener, pair names, logo URLs, links) to inject markup, script or a navigation the visitor did not choose.
- Any way for the page to show a contract address that differs from the one in the register.
- Build tooling in `tools/` that could alter what gets deployed.

## What is out of scope

- Outages or wrong data at the upstream providers.
- Findings that need a modified browser, a malicious extension or physical access.
- Reports about a token contract's code or economics. Epoxy does not currently publish a contract.
- Denial of service through sheer volume.

## How to report

Please do not post vulnerabilities in a public thread. Send a direct message to the project account on X and say that it is a security report. Include:

1. What you found and where.
2. Steps to reproduce, with a browser name and version.
3. The impact as you understand it.
4. Whether you plan to publish, and when.

You will get an acknowledgement, a status update when we have reproduced the issue, and a note when a fix ships. Reports that are specific, reproducible and kind get credit in the fix notes unless you prefer otherwise.

## What we do on our side

- Third-party strings are only written with `textContent`. URLs from third parties are validated for scheme and host before use.
- Pair links must start with the DexScreener origin. Logo URLs must be https on the DexScreener image host.
- The policy forbids inline script except one hashed line, forbids inline styles and handlers, and limits connections to the chain RPC, DefiLlama and DexScreener.
- Gates fail the build when a live origin is missing from the policy or when an unexpected origin appears in the bundle.
- The contract slot only turns live for a value shaped like a real address, and the address on the page is exactly the register value.

## Verifying what you see

If the contract slot shows an address, compare it with the register in the repository and confirm on the chain. The chain id must read `0x1237` (4663). An address shown anywhere else, such as a reply, a screenshot or a pinned post, should be treated as unverified until it matches the register.

## Supported versions

Only the most recent build served at the production domain is supported.
