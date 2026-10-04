// Shared helpers for the regression suite. No test framework dependency
// beyond Playwright itself - a small `test()`/`assert()` pair is enough
// for a suite this size, and keeps the harness's own surface area small.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const GAME_PATH = path.join(__dirname, '..', 'index.html');
const GAME_URL = 'file://' + GAME_PATH + '?test=1';

// This sandbox pre-installs Chromium outside Playwright's normal cache;
// CI environments install it the standard way (`npx playwright install
// chromium`) and won't have this path, so fall back to Playwright's own
// resolution there.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = fs.existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;

class AssertionError extends Error {}

function assert(cond, msg) {
  if (!cond) throw new AssertionError(msg || 'assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new AssertionError(`${msg || 'values differ'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Launches a fresh, isolated page with a clean save, starts the game, and
// hands it to `fn(page, errors)`. `errors` collects any uncaught page
// exceptions so tests can assert zero-errors as part of their checks.
// LRNA-175: every unlockable item, which the suite gets by default so the
// older tests can fire any weapon; pass { unlocks: 'starter' } to play as
// a fresh player, or an array of keys for a partial set.
const ALL_UNLOCKS = ['large', 'cluster', 'emp', 'decoy', 'ghost', 'buster', 'strikeFighter', 'strikeBomber', 'heavyBomber', 'gu', 'base'];
async function withGame(fn, { viewport, skipStart, unlocks = 'all', merit = 0 } = {}) {
  const browser = await chromium.launch({
    executablePath,
    args: ['--disable-background-timer-throttling'],
  });
  const page = await browser.newPage({ viewport: viewport || { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  try {
    await page.goto(GAME_URL);
    const owned = unlocks === 'all' ? ALL_UNLOCKS : unlocks === 'starter' ? [] : unlocks;
    await page.evaluate(([owned, merit]) => {
      localStorage.clear();
      localStorage.setItem('lrna_unlocks_v1', JSON.stringify({ merit, owned }));
    }, [owned, merit]);
    await page.reload();
    await page.waitForTimeout(300);
    if (!skipStart) {
      await page.click('#startGameBtn');
      await page.waitForTimeout(200);
    }
    await fn(page, errors);
  } finally {
    await browser.close();
  }
}

// LRNA-178: two devices in one browser - each page has its own context (its
// own storage), both fully unlocked, menus showing. WebRTC host candidates
// stay plain IPs (no mDNS) so the two pages can reach each other here.
async function withTwoGames(fn) {
  const browser = await chromium.launch({
    executablePath,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows', '--disable-features=WebRtcHideLocalIpsWithMdns'],
  });
  const errors = [];
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(GAME_URL);
    await page.evaluate((owned) => { localStorage.clear(); localStorage.setItem('lrna_unlocks_v1', JSON.stringify({ merit: 0, owned })); }, ALL_UNLOCKS);
    await page.reload();
    await page.waitForTimeout(300);
    return page;
  };
  try {
    const host = await open();
    const guest = await open();
    await fn(host, guest, errors);
  } finally {
    await browser.close();
  }
}

// Registers a named test. Collected by `run()` below rather than executed
// immediately, so a summary can be printed after every test has run
// (instead of stopping at the first failure).
const registry = [];
function test(name, fn) {
  registry.push({ name, fn });
}

async function run() {
  let passed = 0, failed = 0;
  // TEST_GREP=text runs only the tests whose name contains it
  const only = process.env.TEST_GREP;
  for (const { name, fn } of registry.filter((t) => !only || t.name.includes(only))) {
    const start = Date.now();
    try {
      await fn();
      const ms = Date.now() - start;
      console.log(`  ✓ ${name} (${ms}ms)`);
      passed++;
    } catch (err) {
      const ms = Date.now() - start;
      console.log(`  ✗ ${name} (${ms}ms)`);
      console.log(`      ${err.message}`);
      if (!(err instanceof AssertionError) && err.stack) {
        console.log(err.stack.split('\n').slice(1, 4).map(l => '      ' + l.trim()).join('\n'));
      }
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed, ${registry.length} total`);
  process.exitCode = failed > 0 ? 1 : 0;
}

module.exports = {
  ALL_UNLOCKS, withTwoGames, withGame, assert, assertEqual, test, run, GAME_URL };
