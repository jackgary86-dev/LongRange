# Regression tests

A small, dependency-light Playwright suite that reproduces the exact
scenarios behind previously-fixed bugs, so a future change that
reintroduces one of them fails here instead of shipping unnoticed.

## Running

```
cd long-range-node-attack
npm ci
npx playwright install chromium   # first time only
npm test
```

Runs automatically on every push/PR via `.github/workflows/test.yml`.

## How it works

`index.html` exposes a `window.__TEST__` API (state getters, deterministic
scenario helpers, direct access to internal functions) but **only** when
`?test=1` is in the URL or `localStorage.lrna_test_mode === '1'` - normal
play never loads or sees any of this. Look for `TEST_MODE` near the end of
the game's `<script>` block to see or extend the exposed surface.

Tests fast-forward game time by calling `T.tickUpdate(dt)` directly in a
loop instead of waiting on real wall-clock time - `update(dt)` takes an
explicit delta and doesn't care whether it's driven by
`requestAnimationFrame` or a test, so simulating 30 seconds of gameplay
costs a handful of synchronous calls, not 30 real seconds.

## Adding a test

1. Add whatever you need to `window.__TEST__` in `index.html` (a getter for
   new state, or a passthrough to an existing internal function).
2. Add a `test('name', async () => { await withGame(async (page, errors) => { ... }); })`
   block to `regression.js`. See `lib.js` for `assert`/`assertEqual`.
3. If your scenario needs *only* the defender/system under test to act
   (many bugs here were "system A's fix works, but system B also fires at
   the same target and confuses the test"), check whether you need to
   neutralize other auto-defense systems: `T.neutralizeAutoDefense()`
   (AM batteries + loadout nodes), `T.disableOmegaCounters()` (Omega's
   Counter Missile + Counter Planes), `T.antiPlaneNodes.length = 0`
   (hidden lane defenses - these engage FAST/MEDIUM player missiles
   regardless of discovery status), or `m.defended = true` on a specific
   missile (skips the generic `getDefender()` auto-defend loop). Several
   tests in this suite hit exactly this while being written - it's the
   most common source of a flaky-seeming new test, not a real bug.
