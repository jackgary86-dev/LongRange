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
async function withGame(fn, { viewport, skipStart } = {}) {
  const browser = await chromium.launch({
    executablePath,
    args: ['--disable-background-timer-throttling'],
  });
  const page = await browser.newPage({ viewport: viewport || { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  try {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.clear());
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

// Registers a named test. Collected by `run()` below rather than executed
// immediately, so a summary can be printed after every test has run
// (instead of stopping at the first failure).
const registry = [];
function test(name, fn) {
  registry.push({ name, fn });
}

async function run() {
  let passed = 0, failed = 0;
  for (const { name, fn } of registry) {
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

module.exports = { withGame, assert, assertEqual, test, run, GAME_URL };
