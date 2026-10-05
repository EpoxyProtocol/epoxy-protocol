# Contributing to Epoxy

Thanks for helping make Epoxy clearer to read. Epoxy is a bonding layer for Robinhood Chain, and every change should make what it shows easier to trust. This project is small on purpose, so a few ground rules keep it that way.

## Set up

```bash
npm install
npm run build
npm run gates
```

Both commands must exit 0 before you open a change. The gates take a few seconds and never touch the network.

## Ground rules

1. **One register.** Every external fact (contract address, social links, chain details) is a record in `src/register.json` with a state of `stated`, `absent` or `unconfirmed`. Do not hard-code these anywhere else.
2. **Store the URL, derive the handle.** Never write an `href` for a record that is not `stated`.
3. **Valid hex is valid.** Address checks test the full shape, `0x` plus 40 hex digits in any case. Do not add prefix tests, checksum rejections or length shortcuts that could refuse a real address.
4. **Colour literals live in `src/tokens.css` only,** and each one must be a real pixel sampled from the supplied artwork. Add the source file and coordinate in the marker comment; a gate re-reads the pixel.
5. **No dates on the page.** Dates stay inside the register.
6. **No `ch` units.** Use pixels, rems or the grid.
7. **Every control is at least 44 by 44 pixels** on touch devices.
8. **Respect reduced motion.** New animation needs a rule in the reduced-motion block.

## Changing live behaviour

If you touch a poller, a parser or the content security policy:

- Add or update a gate that uses a synthetic fixture and the fake clock from `tools/gates.mjs`.
- Anchor any mutation on the current register value, read at run time. A gate that only passes while a record sits in one particular state is a bug.
- Keep the total under 30 gates and the run under five minutes.

## Writing

Copy on the page is original. Keep sentences short and concrete, and skip superlatives. If a figure cannot be verified, show a dash.

## Commits and reviews

- Keep each change focused on one thing.
- Explain why in the description, not only what.
- Include before and after screenshots at 360, 390, 430, 1366 and 1440 pixels for visual changes.

## Reporting problems

Bugs and ideas are welcome. For anything security related, follow `SECURITY.md` instead of posting publicly.

## Licence

By contributing you agree that your work is released under the MIT licence in `LICENSE`.
