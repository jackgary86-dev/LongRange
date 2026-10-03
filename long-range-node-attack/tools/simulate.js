#!/usr/bin/env node
// Bot-vs-Omega simulation: drives the real game (index.html) headless and
// fast-forwarded, with a scripted player against Omega's built-in AI, and
// reports how games actually play out. Used to find balance problems.
//
//   node tools/simulate.js [runsPerCell=6] [minutes=15] [out.json]
//
// The page's clock (performance.now) and render loop are replaced, so the
// game only advances when the bot calls tickUpdate - 15 game minutes take
// a few seconds. Each run: one strategy x one difficulty x one skill.
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'))); }

const RUNS = +process.argv[2] || 6;
const MINUTES = +process.argv[3] || 15;
const OUT = process.argv[4] || null;
// filters for what-if runs: SIM_STRATEGIES=omega,nodes-first SIM_DIFFICULTIES=normal SIM_SKILLS=sharp
// and SIM_GAME=path/to/a/modified/index.html
const pickList = (env, all) => (process.env[env] ? process.env[env].split(',') : all);
const STRATEGIES = pickList('SIM_STRATEGIES', ['omega', 'fast-spam', 'radar-first', 'missile-first', 'nodes-first', 'fast-nodes']);
const DIFFICULTIES = pickList('SIM_DIFFICULTIES', ['easy', 'normal', 'hard']);
const ALL_SKILLS = { sharp: 1.0, casual: 0.35 }; // chance per decision to react with the Emergency Counter
const SKILLS = Object.fromEntries(pickList('SIM_SKILLS', Object.keys(ALL_SKILLS)).map((k) => [k, ALL_SKILLS[k]]));
// LRNA-175: SIM_UNLOCKS=starter plays as a fresh player (FAST, MEDIUM and the
// starter defenses only); the default is everything unlocked
const UNLOCKS = process.env.SIM_UNLOCKS === 'starter' ? [] : ['large', 'cluster', 'emp', 'strikeFighter', 'strikeBomber', 'heavyBomber', 'gu', 'base'];
const GAME = 'file://' + path.resolve(process.env.SIM_GAME || path.join(__dirname, '..', 'index.html')) + '?test=1';

// runs inside the page: one whole game
async function playGame({ strategy, reflex, minutes }) {
  const T = window.__TEST__;
  const DT = 0.05, DECIDE = 0.25;
  const pick = (kind) => { const b = document.querySelector(`.targetBtn[data-pick="${kind}"]`); if (b && !b.disabled) b.click(); };
  const standing = (list, kind) => list.filter((n) => n.kind === kind && !n.destroyed).length;
  const omegaNodes = () => T.fieldTargets.filter((t) => t.baseNode);
  const statsRow = (label) => {
    const row = [...document.querySelectorAll('#statsList .stats-row')].find((r) => r.querySelector('.stats-label').textContent === label);
    return row ? parseInt(row.querySelector('.stats-value').textContent.replace(/,/g, ''), 10) : 0;
  };
  const ev = [];
  const r = { strategy, deathAt: null, wave: 1, omegaKills: [], lowTokenTime: 0, tokenSum: 0, samples: 0,
    emergencyUsed: 0, emergencyWasted: 0, omegaHpMin: 250, firstOmegaHpLossAt: null };
  let t = 0, decideTimer = 0, lastKills = 0;
  let seenNodes = new Set();
  while (t < minutes * 60) {
    if (!T.running) { r.deathAt = t; break; }
    decideTimer -= DT;
    if (decideTimer <= 0) {
      decideTimer = DECIDE;
      // 1. counter: fire the Emergency Counter when there's something in its window
      const threat = T.findEmergencyTarget();
      if (threat && T.emergencyCooldown <= 0 && T.counterAmmo.emergency > 0 && Math.random() < reflex) {
        const before = T.counterAmmo.emergency;
        T.fireEmergencyCounter();
        if (T.counterAmmo.emergency < before) r.emergencyUsed += 1;
      }
      // 2. target
      const om = omegaNodes();
      let want = 'O';
      if (strategy === 'radar-first' && standing(om, 'radarNode')) want = 'radarNode';
      if (strategy === 'missile-first' && standing(om, 'missileNode')) want = 'missileNode';
      if (strategy === 'nodes-first') want = standing(om, 'radarNode') ? 'radarNode' : standing(om, 'missileNode') ? 'missileNode' : 'O';
      if (strategy === 'fast-nodes') want = standing(om, 'missileNode') ? 'missileNode' : standing(om, 'radarNode') ? 'radarNode' : 'O';
      const cur = T.getTarget(T.selectedTargetId);
      const curKind = !cur || cur.id === 'O' ? 'O' : cur.kind;
      if (curKind !== want) pick(want);
      // 3. fire: planes when ready, then the biggest missile affordable (fast-spam: only FAST)
      if (strategy === 'fast-nodes' && want !== 'O') {
        T.attemptFire('fast'); // LRNA-190: FAST at the nodes, planes and heavy missiles at Omega
      } else if (strategy !== 'fast-spam') {
        for (const k of ['heavyBomber', 'strikeBomber', 'strikeFighter']) if (T.isUnlocked(k) && T.planeSlots[k].state === 'ready') T.firePlane(k);
        const a = T.tokens.attack;
        // the biggest unlocked missile affordable
        T.attemptFire(a >= 500 && T.isUnlocked('large') ? 'large' : a >= 300 ? 'medium' : 'fast');
      } else {
        T.attemptFire('fast');
      }
    }
    const hpBefore = T.nodeA.health;
    T.tickUpdate(DT);
    if (T.nodeA.health < hpBefore) r.platformHits = (r.platformHits || 0) + 1;
    window.__simClock += DT * 1000;
    t += DT;
    // bookkeeping
    r.samples += 1;
    r.tokenSum += T.tokens.attack;
    if (T.tokens.attack < 100) r.lowTokenTime += DT;
    r.omegaHpMin = Math.min(r.omegaHpMin, T.omegaHealth);
    if (r.firstOmegaHpLossAt == null && T.omegaHealth < 250) r.firstOmegaHpLossAt = t;
    if (T.missionStats.omegaKills > lastKills) { lastKills = T.missionStats.omegaKills; r.omegaKills.push(+t.toFixed(1)); }
    for (const n of [...omegaNodes(), ...T.playerNodes]) {
      if (n.destroyed && !seenNodes.has(n.id)) { seenNodes.add(n.id); ev.push([+t.toFixed(1), n.id]); }
    }
  }
  r.time = +t.toFixed(1);
  r.wave = T.currentWave;
  r.nodeLoss = ev;
  r.playerHp = Math.round(T.nodeA.health);
  r.avgTokens = Math.round(r.tokenSum / Math.max(1, r.samples));
  r.lowTokenShare = +(r.lowTokenTime / Math.max(1, t)).toFixed(2);
  r.fired = statsRow('Warheads fired');
  r.hits = statsRow('Hits landed');
  r.intercepted = statsRow('Enemy shots intercepted');
  r.omegaCountersLeft = T.omegaCounterAmmo.emergency;
  r.emergencyLeft = T.counterAmmo.emergency;
  r.omegaNodesLeft = { radar: standing(omegaNodes(), 'radarNode'), missile: standing(omegaNodes(), 'missileNode') };
  r.playerNodesLeft = { radar: standing(T.playerNodes, 'radarNode'), missile: standing(T.playerNodes, 'missileNode') };
  delete r.tokenSum; delete r.samples; delete r.lowTokenTime;
  return r;
}

async function runOne(browser, cfg) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(([difficulty, owned]) => {
    window.__simClock = 0;
    performance.now = () => window.__simClock;
    window.requestAnimationFrame = () => 0; // no render loop: the bot drives time
    try {
      localStorage.setItem('lrna_difficulty_v1', difficulty); localStorage.setItem('lrna_muted_v1', '1');
      localStorage.setItem('lrna_unlocks_v1', JSON.stringify({ merit: 0, owned }));
    } catch (e) {}
  }, [cfg.difficulty, UNLOCKS]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(GAME);
  await page.evaluate(() => document.getElementById('startGameBtn').click());
  const res = await page.evaluate(playGame, { strategy: cfg.strategy, reflex: SKILLS[cfg.skill], minutes: MINUTES });
  await ctx.close();
  return { ...cfg, ...res, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const jobs = [];
  for (const difficulty of DIFFICULTIES) for (const strategy of STRATEGIES) for (const skill of Object.keys(SKILLS))
    for (let i = 0; i < RUNS; i++) jobs.push({ difficulty, strategy, skill, run: i });
  const results = [];
  const started = Date.now();
  let next = 0;
  const worker = async () => { while (next < jobs.length) { const j = jobs[next++]; results.push(await runOne(browser, j)); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  await browser.close();
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log(`${results.length} games, ${MINUTES} min cap, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  const errs = results.flatMap((r) => r.errors);
  if (errs.length) console.log('page errors:', [...new Set(errs)].slice(0, 5));
})();
