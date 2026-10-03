// Regression suite for previously-fixed bugs. Each test reproduces the
// exact scenario that used to fail, so a future change that reintroduces
// the bug fails CI instead of shipping unnoticed. Run with `npm test`.
//
// Tests fast-forward game time by calling T.tickUpdate(dt) directly in a
// loop instead of waiting on real wall-clock time - update(dt) takes an
// explicit delta and doesn't care whether it's driven by requestAnimationFrame
// or a test, so 30 simulated seconds costs a handful of synchronous calls,
// not 30 real ones.
const { withGame, assert, assertEqual, test, run } = require('./lib');

// ART-14: STATS and SOUND live in the in-game menu now; open it first.
async function menuClick(page, id) {
  if (!(await page.evaluate(() => window.__TEST__.gameMenuOpen))) await page.click('#menuBtn');
  await page.click('#' + id);
}

function advance(T, seconds, step = 0.05) {
  const steps = Math.round(seconds / step);
  for (let i = 0; i < steps; i++) T.tickUpdate(step);
}

test('LRNA-123: planes complete their flight and land (no NaN-velocity stuck planes)', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.forceOpeningUnlock(); // LRNA-080: a fresh game starts recon-locked, attack planes can't fire yet
      T.firePlane('strikeFighter'); // 10s one-way flight (no return leg since LRNA-164)
      return { firedCount: T.missiles.filter(m => m.typeKey === 'plane').length };
    });
    assert(result.firedCount === 1, 'plane should have launched');

    await page.evaluate((secs) => {
      const T = window.__TEST__;
      for (let i = 0; i < secs / 0.05; i++) T.tickUpdate(0.05);
    }, 25); // comfortably outlasts the flight

    const after = await page.evaluate(() => {
      const T = window.__TEST__;
      return {
        planesRemaining: T.missiles.filter(m => m.typeKey === 'plane').length,
        stuckWithBadVelocity: T.missiles.filter(m => m.typeKey === 'plane' && !isFinite(m.vx)).length,
      };
    });
    assertEqual(after.planesRemaining, 0, 'plane should have been removed once its flight finished');
    assertEqual(after.stuckWithBadVelocity, 0, 'no plane should have NaN/invalid velocity');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-124: Satellite can only be selected in one loadout slot at a time', async () => {
  await withGame(async (page) => {
    // the loadout selects live on the pre-start SETUP screen (ART-11)
    await page.click('#menuHome [data-goto="setup"]');
    await page.selectOption('.loadoutSelect[data-slot="0"]', 'satellite');
    let dialogMessage = null;
    page.once('dialog', async (d) => { dialogMessage = d.message(); await d.accept(); });
    await page.selectOption('.loadoutSelect[data-slot="1"]', 'satellite');
    await page.waitForTimeout(50);

    const slot1Value = await page.$eval('.loadoutSelect[data-slot="1"]', (el) => el.value);
    assert(slot1Value !== 'satellite', 'slot 1 should not have accepted a duplicate Satellite selection');
    assert(dialogMessage && /already selected|only be selected once/i.test(dialogMessage),
      'an explanatory alert should have fired: ' + dialogMessage);

    const loadout = await page.evaluate(() => JSON.parse(localStorage.getItem('lrna_loadout_v1') || '[]'));
    assertEqual(loadout.filter((k) => k === 'satellite').length, 1, 'persisted loadout should have exactly one satellite');
  }, { skipStart: true });
});

test('LRNA-125: Omega gets a brief invulnerability window right after rebuilding', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();

      while (T.omegaHealth > 1) T.forceOmegaDamage(1);
      const healthBeforeKill = T.omegaHealth;

      T.forceOmegaDamage(100); // killing blow -> triggers rebuild
      const healthAfterKill = T.omegaHealth;
      const invulnRightAfter = T.omegaInvulnTimer;

      T.forceOmegaDamage(1000); // should be blocked by the invuln window
      const healthAfterFollowup = T.omegaHealth;

      return { healthBeforeKill, healthAfterKill, invulnRightAfter, healthAfterFollowup };
    });

    assertEqual(result.healthBeforeKill, 1, 'setup: health should be brought down to 1 before the killing blow');
    assert(result.healthAfterKill > result.healthBeforeKill, 'killing blow should trigger a rebuild to full health');
    assert(result.invulnRightAfter > 0, 'invulnerability timer should be active immediately after rebuild');
    assertEqual(result.healthAfterFollowup, result.healthAfterKill,
      'a follow-up hit during the invulnerability window should deal zero damage');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-126: a missile cannot "ghost hit" a target destroyed mid-flight', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();

      const target = T.fieldTargets.find((t) => !t.defends);
      const impactsBefore = target.impacts;
      T.launchAttack(T.nodeA, target, 'fast');
      target.destroyed = true; // simulate something else destroying it mid-flight
      return { targetId: target.id, impactsBefore };
    });

    await page.evaluate(() => { for (let i = 0; i < 300; i++) window.__TEST__.tickUpdate(0.05); }); // 15s, past FAST's 10s eta

    const after = await page.evaluate((targetId) => {
      const T = window.__TEST__;
      const target = T.fieldTargets.find((t) => t.id === targetId);
      return { impactsAfter: target.impacts, missileGone: !T.missiles.find((m) => m.dest === target) };
    }, result.targetId);

    assertEqual(after.impactsAfter, result.impactsBefore, 'destroyed target should not register a ghost hit');
    assert(after.missileGone, 'the missile should have resolved and been removed');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-127: Emergency Counter is not blocked by unrelated auto-defense fire', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.counter = 999999;
      T.freezeWaves();
      T.clearMissiles();
      // Auto-defense stays active on purpose - this is the real contamination
      // scenario (AM batteries/loadout nodes also target the same threat).
      // Force every hit roll to miss (max hit chance anywhere is 0.92) so
      // the target survives long enough to observe the actual mechanism
      // under test, rather than getting destroyed early by one of the
      // several concurrent defenders by luck. A varying-but-always-high
      // value, not a true constant - a constant Math.random() breaks
      // Math.random().toString(36) id generation (every id collides).
      // Stashed on window (not a local const) so a later, separate
      // page.evaluate() call can restore it.
      window.__origRandom = Math.random;
      Math.random = () => 0.95 + window.__origRandom() * 0.04;

      const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
      m.sizeKey = 'medium';
      const desiredAge = m.totalSeconds - 4.9;
      const x0 = m.x;
      m.age = desiredAge;
      m.x = x0 + m.vx * desiredAge; // keep position/age physically consistent

      const target1 = T.findEmergencyTarget();
      const fired1 = target1 && target1.id === m.id ? T.fireEmergencyCounter() : false;
      return { fired1, targetId: m.id };
    });
    assert(result.fired1, 'first Emergency Counter shot should fire');

    // Poll until Emergency's own counter resolves (hit or miss), or the target dies.
    let found2 = false, fired2 = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(150);
      const state = await page.evaluate((targetId) => {
        const T = window.__TEST__;
        const stillAlive = !!T.missiles.find((m) => m.id === targetId);
        const emergencyCounterFlying = !!T.missiles.find((c) => c.typeKey === 'counter' && c.source === 'emergency' && c.seekTargetId === targetId);
        return { stillAlive, emergencyCounterFlying };
      }, result.targetId);
      if (!state.stillAlive) break;
      if (!state.emergencyCounterFlying) {
        while (await page.evaluate(() => window.__TEST__.emergencyCooldown) > 0) {
          await page.waitForTimeout(100);
        }
        const outcome = await page.evaluate((targetId) => {
          const T = window.__TEST__;
          const target2 = T.findEmergencyTarget();
          const isTarget = target2 && target2.id === targetId;
          return { found2: isTarget, fired2: isTarget ? T.fireEmergencyCounter() : false };
        }, result.targetId);
        found2 = outcome.found2;
        fired2 = outcome.fired2;
        break;
      }
    }
    await page.evaluate(() => { Math.random = window.__origRandom; });
    assert(found2, 'target should become re-eligible once Emergency\'s own counter resolves, despite other defenders still engaging it');
    assert(fired2, 'second Emergency Counter shot should fire successfully');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-129: Counter Plane chase timeout matches the target\'s real remaining flight time', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();

      const def = { eta: 30 }; // Heavy Bomber-equivalent leg length
      const plane = {
        id: 'test-plane-1', typeKey: 'plane', planeKind: 'heavyBomber', originId: 'A',
        x: T.nodeA.x, laneY: 0, vx: -1, totalSeconds: def.eta, age: 18,
        color: '#ff5a36', radius: 6, dmg: 0,
      };
      T.missiles.push(plane);
      const counter = T.fireCounter({ id: T.nodeO.id, x: T.nodeO.x, y: T.nodeO.y, color: '#ff2ea6', hitChance: 0.75 }, plane.id);
      return { counterTimeout: counter.totalSeconds, expectedRemaining: def.eta - plane.age };
    });
    assertEqual(result.counterTimeout, result.expectedRemaining,
      'chase timeout should equal the plane\'s real remaining flight time, not a flat guess');

    const regressionCheck = await page.evaluate(() => {
      const T = window.__TEST__;
      T.clearMissiles();
      const strike = T.launchEnemyStrike(T.nodeO, T.nodeA);
      const counter = T.fireCounter({ id: T.nodeO.id, x: T.nodeO.x, y: T.nodeO.y, color: '#ff2ea6', hitChance: 0.75 }, strike.id);
      return counter.totalSeconds;
    });
    assertEqual(regressionCheck, 6, 'regular missile-type targets should be unaffected (unchanged COUNTER.totalSeconds)');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-102: Omega Counter Missile is capped at 2 attempts per target', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();

      const m = T.launchAttack(T.nodeA, T.nodeO, 'large');
      m.age = 5; // past the reaction delay

      const usedOverTime = [];
      for (let i = 0; i < 6; i++) {
        T.setOmegaCounterMissileTimer(0);
        T.tickOmegaCounters(0.016);
        // Force any resulting shot to miss and resolve instantly, isolating
        // the per-target CAP from real chase-timing/RNG.
        for (const c of T.missiles) {
          if (c.typeKey === 'counter' && c.seekTargetId === m.id) c.seekSuccess = false;
        }
        T.missiles.splice(0, T.missiles.length, ...T.missiles.filter((mm) => mm.typeKey !== 'counter'));
        const target = T.missiles.find((mm) => mm.id === m.id);
        usedOverTime.push(target ? target.omegaCounterUsed || 0 : null);
        if (!target) break;
      }
      return usedOverTime;
    });
    const maxUsed = Math.max(...result.filter((v) => v != null));
    assert(maxUsed <= 2, `omegaCounterUsed should never exceed 2, saw ${maxUsed}`);
    assert(result.filter((v) => v === 2).length >= 2, 'the cap should hold steady at 2 across multiple subsequent cycles, not just touch it once');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-108: loadout nodes spread fire across multiple threats instead of all piling on one', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();

      const threatA = T.launchEnemyStrike(T.nodeO, T.nodeA);
      threatA.sizeKey = 'medium';
      threatA.age = 2;
      const threatB = T.launchEnemyStrike(T.nodeO, T.nodeA);
      threatB.sizeKey = 'medium';
      threatB.age = 2;

      for (const n of T.loadoutNodes) n.fireTimer = 0;
      T.tickLoadoutNodes(0.016);

      const engaged = new Set(T.missiles.filter((m) => m.typeKey === 'counter' && m.source === 'loadout').map((m) => m.seekTargetId));
      return { threatAId: threatA.id, threatBId: threatB.id, engaged: Array.from(engaged) };
    });
    assert(result.engaged.includes(result.threatAId) && result.engaged.includes(result.threatBId),
      `both threats should have a defender; engaged=${JSON.stringify(result.engaged)}`);

    const fallback = await page.evaluate(() => {
      const T = window.__TEST__;
      T.clearMissiles();
      const sole = T.launchEnemyStrike(T.nodeO, T.nodeA);
      sole.sizeKey = 'medium';
      sole.age = 2;
      for (const n of T.loadoutNodes) n.fireTimer = 0;
      T.tickLoadoutNodes(0.016);
      const activeNodes = T.loadoutNodes.filter((n) => !n.def.cycling || n.cycleOn).length;
      const engagedCount = T.missiles.filter((m) => m.typeKey === 'counter' && m.source === 'loadout' && m.seekTargetId === sole.id).length;
      return { activeNodes, engagedCount };
    });
    assertEqual(fallback.engagedCount, fallback.activeNodes,
      'with only one threat, every active node should still engage it (overkill fallback intact)');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }); // NOT skipStart: loadoutNodes/amNodes are only populated once the game actually starts
});

test('LRNA-134: Ground Units chip stacking shows a persistent hit counter', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();

      // Counter Missile AND Counter Planes (whose candidate list also
      // includes plain missiles, not just planes) can both independently
      // target this missile - silence both.
      T.disableOmegaCounters();
      T.antiPlaneNodes.length = 0; // hidden lane defenses engage FAST/MEDIUM regardless of discovery - keep them out of this test
      const m = T.launchAttack(T.nodeA, T.nodeO, 'fast');
      m.defended = true; // also skip the older, separate generic getDefender('O') auto-defend loop
      m.x = m.targetX - 500;
      m.vx = 0;
      m.burnFrac = null;
      const initialDmg = m.dmg;

      const c1 = T.fireCounter({ id: 'gu-test', x: T.nodeO.x, y: T.nodeO.y, color: '#ff8a5c', hitChance: 1, chipOnly: true }, m.id);
      c1.seekSuccess = true;
      return { missileId: m.id, initialDmg };
    });

    await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__TEST__.tickUpdate(0.05); }); // 2s, plenty for the counter to close a 500-unit gap

    const after1 = await page.evaluate((id) => {
      const T = window.__TEST__;
      const m = T.missiles.find((mm) => mm.id === id);
      return { chipHits: m.chipHits, dmg: m.dmg };
    }, result.missileId);
    assertEqual(after1.chipHits, 1, 'chipHits should be 1 after the first chip');
    assertEqual(after1.dmg, Math.round(result.initialDmg * 0.6), 'damage should be reduced to 60% after one chip');

    const fired2 = await page.evaluate((id) => {
      const T = window.__TEST__;
      const m = T.missiles.find((mm) => mm.id === id);
      const c2 = T.fireCounter({ id: 'gu-test', x: T.nodeO.x, y: T.nodeO.y, color: '#ff8a5c', hitChance: 1, chipOnly: true }, m.id);
      c2.seekSuccess = true;
      return true;
    }, result.missileId);
    assert(fired2, 'setup: second chip shot should have been fired');
    await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__TEST__.tickUpdate(0.05); });

    const after2 = await page.evaluate((id) => {
      const T = window.__TEST__;
      const m = T.missiles.find((mm) => mm.id === id);
      return { chipHits: m.chipHits, dmg: m.dmg };
    }, result.missileId);
    assertEqual(after2.chipHits, 2, 'chipHits should be 2 after a second chip');
    assertEqual(after2.dmg, Math.round(result.initialDmg * 0.6 * 0.6), 'damage should stack multiplicatively (0.6x again)');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-136: particle array is hard-capped regardless of burst size', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      for (let i = 0; i < 8000; i++) T.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 10, color: '#fff' });
      const immediatelyAfter = T.particles.length;
      T.tickUpdate(0.016);
      const afterOneFrame = T.particles.length;
      return { immediatelyAfter, afterOneFrame };
    });
    assertEqual(result.immediatelyAfter, 8000, 'setup: flood should have landed all 8000 particles before the cap runs');
    assert(result.afterOneFrame <= 5000, `particle count should be capped at 5000, saw ${result.afterOneFrame}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-115: every 5th wave is an announced "elite" wave with amplified damage', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.startWave(4);
      const wave4Elite = T.waveIsElite;
      const strike4 = T.launchEnemyStrike(T.nodeO, T.nodeA);
      const strike4Expected = T.ENEMY_STRIKE_SIZES[strike4.sizeKey].dmg;

      T.startWave(5);
      const wave5Elite = T.waveIsElite;
      const strike5 = T.launchEnemyStrike(T.nodeO, T.nodeA);
      const strike5Expected = T.ENEMY_STRIKE_SIZES[strike5.sizeKey].dmg;

      return {
        wave4Elite, strike4Dmg: strike4.dmg, strike4Expected, strike4Marked: !!strike4.elite,
        wave5Elite, strike5Dmg: strike5.dmg, strike5Expected, strike5Marked: !!strike5.elite,
      };
    });
    assert(!result.wave4Elite, 'wave 4 should not be elite');
    assert(!result.strike4Marked, 'a wave-4 strike should not carry the elite marker');
    assertEqual(result.strike4Dmg, result.strike4Expected, 'a non-elite strike should deal its normal, unmultiplied damage');

    assert(result.wave5Elite, 'wave 5 (multiple of 5) should be elite');
    assert(result.strike5Marked, 'a wave-5 strike should carry the elite marker');
    assertEqual(result.strike5Dmg, result.strike5Expected * 2, 'an elite strike should deal exactly 2x its base damage for its rolled size');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-116: Omega Counter Missile/Planes readiness is shown in the HUD', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      // Test the HUD rendering directly, not via tickUpdate - the real
      // updateOmegaCounters() reprocesses the timer within the same tick
      // (resetting a just-fired-and-empty cooldown to a short retry delay),
      // which would race with reading the value right back out.
      T.setOmegaCounterMissileTimer(0); // ready
      T.updateOmegaCountersHud();
      const readyHtml = document.getElementById('omegaCounterStatus').innerHTML;

      T.setOmegaCounterMissileTimer(4.2); // on cooldown
      T.updateOmegaCountersHud();
      const cooldownHtml = document.getElementById('omegaCounterStatus').innerHTML;

      return { readyHtml, cooldownHtml };
    });
    // LRNA-165: each entry now also carries how many are left this game
    assert(/CM 10 READY/.test(result.readyHtml), `expected "CM 10 READY" while off cooldown, got: ${result.readyHtml}`);
    assert(/CM 10 0:0?4/.test(result.cooldownHtml), `expected a countdown while on cooldown, got: ${result.cooldownHtml}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }); // NOT skipStart: the HUD element only reflects real timer state once the game has started
});

test('LRNA-110: intercepting defenders resolve to a readable name', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      return {
        emergency: T.describeDefender({ source: 'emergency' }),
        countermissile: T.describeDefender({ source: 'countermissile' }),
        counterplanes: T.describeDefender({ source: 'counterplanes' }),
        omegaTagged: T.describeDefender({ source: 'omega' }),
        omegaByOriginId: T.describeDefender({ originId: T.nodeO.id }),
        loadout: T.describeDefender({ source: 'loadout', originId: T.loadoutNodes[0].id }),
        amBattery: T.describeDefender({ originId: T.amNodes[0].id }),
        unknown: T.describeDefender({ originId: 'nonexistent-id-xyz' }),
      };
    });
    assertEqual(result.emergency, 'EMERGENCY COUNTER');
    assertEqual(result.countermissile, 'COUNTER MISSILE');
    assertEqual(result.counterplanes, 'COUNTER ATTACK PLANES');
    assertEqual(result.omegaTagged, 'NODE OMEGA');
    assertEqual(result.omegaByOriginId, 'NODE OMEGA');
    assert(result.loadout && result.loadout !== 'GROUND DEFENSE', 'loadout node should resolve to its own real name');
    assert(result.amBattery && result.amBattery !== 'DEFENSE GRID', 'AM battery should resolve to its own real name');
    assertEqual(result.unknown, 'DEFENSE GRID', 'a genuinely unknown origin should fall back gracefully, not crash');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }); // NOT skipStart: loadoutNodes/amNodes are only populated once the game actually starts
});

test('LRNA-117: Recon Plane button disables once every hidden node is already found', async () => {
  await withGame(async (page, errors) => {
    const before = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.intel = 99999;
      T.tickUpdate(0.05); // let updatePlaneButtons see the token top-up
      const btn = document.querySelector('[data-plane="reconPlane"]');
      return { disabled: btn.disabled, eta: btn.querySelector('.btnEta').textContent };
    });
    assert(!before.disabled, 'Recon Plane should be launchable while hidden nodes remain');
    assert(before.eta !== 'ALL LOCATED', 'button should still show its normal ETA before everything is found');

    const after = await page.evaluate(() => {
      const T = window.__TEST__;
      for (const n of [...T.antiPlaneNodes, ...T.seekDestroyNodes]) n.discovered = true;
      T.tickUpdate(0.05);
      const btn = document.querySelector('[data-plane="reconPlane"]');
      return { disabled: btn.disabled, eta: btn.querySelector('.btnEta').textContent };
    });
    assert(after.disabled, 'Recon Plane should disable once nothing is left to discover');
    assertEqual(after.eta, 'ALL LOCATED', 'button should tell the player why it is disabled');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }); // NOT skipStart: antiPlaneNodes/seekDestroyNodes are only populated once the game actually starts
});

test('LRNA-119/ART-14: the in-game menu pause freezes real-time simulation and blocks actions', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => window.__TEST__.forceOpeningUnlock()); // LRNA-080: this test fires attack-pillar weapons directly
    // sanity: passive token income should accrue in real time before pausing
    const t0 = await page.evaluate(() => window.__TEST__.tokens.attack);
    await page.waitForTimeout(700);
    const t1 = await page.evaluate(() => window.__TEST__.tokens.attack);
    assert(t1 > t0, 'tokens should accrue in real time while unpaused');

    await page.click('#menuBtn'); // ART-14: the in-game menu is the pause
    const afterClick = await page.evaluate(() => ({
      paused: window.__TEST__.paused,
      menuShown: !document.getElementById('gameMenu').classList.contains('hidden'),
    }));
    assert(afterClick.paused, 'opening the menu should actually pause the game');
    assert(afterClick.menuShown, 'the PAUSED menu should be visible');

    const t2 = await page.evaluate(() => window.__TEST__.tokens.attack);
    await page.waitForTimeout(700);
    const t3 = await page.evaluate(() => window.__TEST__.tokens.attack);
    assertEqual(t3, t2, 'tokens should not accrue while paused - the real update loop must be frozen');

    // action guard: firing while paused must be a no-op, not just invisible via a disabled button
    const firedWhilePaused = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.attemptFire('fast');
      return T.missiles.filter(m => m.typeKey === 'fast').length;
    });
    assertEqual(firedWhilePaused, 0, 'attemptFire should refuse to launch anything while paused');

    await page.click('#menuResume');
    const afterResume = await page.evaluate(() => ({
      paused: window.__TEST__.paused,
      menuShown: !document.getElementById('gameMenu').classList.contains('hidden'),
    }));
    assert(!afterResume.paused, 'clicking RESUME should unpause');
    assert(!afterResume.menuShown, 'the menu should close again');

    const firedAfterResume = await page.evaluate(() => {
      const T = window.__TEST__;
      T.attemptFire('fast');
      return T.missiles.filter(m => m.typeKey === 'fast').length;
    });
    assertEqual(firedAfterResume, 1, 'attemptFire should work normally again once resumed');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }); // NOT skipStart: relies on the real requestAnimationFrame loop and passive token income
});

test('LRNA-120: mute button silences audio and persists across reload', async () => {
  await withGame(async (page, errors) => {
    const initial = await page.evaluate(() => ({
      muted: window.__TEST__.muted,
      gain: window.__TEST__.masterGainValue,
      volume: window.__TEST__.MASTER_VOLUME,
      label: document.getElementById('muteBtn').textContent,
    }));
    assert(!initial.muted, 'should start unmuted by default');
    // GainNode.gain.value is a float32 AudioParam, so it round-trips with
    // tiny precision loss vs. the float64 MASTER_VOLUME constant - compare
    // with a tolerance instead of exact equality.
    assert(Math.abs(initial.gain - initial.volume) < 0.001, `audio should play at full volume when unmuted: ${initial.gain} vs ${initial.volume}`);
    assertEqual(initial.label, 'SOUND: ON');

    await menuClick(page, 'muteBtn');
    const afterMute = await page.evaluate(() => ({
      muted: window.__TEST__.muted,
      gain: window.__TEST__.masterGainValue,
      label: document.getElementById('muteBtn').textContent,
    }));
    assert(afterMute.muted, 'clicking MUTE should mute');
    assertEqual(afterMute.gain, 0, 'master gain should drop to 0 while muted');
    assertEqual(afterMute.label, 'SOUND: OFF');

    // the preference must survive a reload, and apply immediately to a
    // freshly-created audio context on the next game start - not just to
    // the AudioContext that happened to exist when it was set.
    await page.reload();
    await page.waitForTimeout(300);
    const beforeStart = await page.evaluate(() => window.__TEST__.muted);
    assert(beforeStart, 'muted preference should persist across reload, even before starting a new game');

    await page.click('#startGameBtn');
    await page.waitForTimeout(200);
    const afterReloadStart = await page.evaluate(() => ({
      gain: window.__TEST__.masterGainValue,
      label: document.getElementById('muteBtn').textContent,
    }));
    assertEqual(afterReloadStart.gain, 0, 'a freshly created audio context should honor the persisted mute preference immediately');
    assertEqual(afterReloadStart.label, 'SOUND: OFF');

    await menuClick(page, 'muteBtn');
    const afterUnmute = await page.evaluate(() => ({
      muted: window.__TEST__.muted,
      gain: window.__TEST__.masterGainValue,
      volume: window.__TEST__.MASTER_VOLUME,
    }));
    assert(!afterUnmute.muted, 'clicking UNMUTE should unmute');
    assert(Math.abs(afterUnmute.gain - afterUnmute.volume) < 0.001, `master gain should be restored on unmute: ${afterUnmute.gain} vs ${afterUnmute.volume}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-121: ability-bar buttons abbreviate on mobile instead of wrapping/reading as cut off', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.counter = 99999;
      T.freezeWaves(); // don't let the wave director spawn a second real strike while we fast-forward
      T.neutralizeAutoDefense();
      T.disableOmegaCounters();
      // Emergency Counter excludes 'fast' strikes entirely (too little
      // reaction time by design) - launch directly via launchAttack with
      // an explicit 'medium' override instead of launchEnemyStrike (whose
      // internal pickEnemyStrikeSize() RNG roll fixes the missile's real
      // vx/totalSeconds at creation; overwriting strike.sizeKey/
      // totalSeconds afterward doesn't touch vx, so a random 'fast' roll
      // would leave the missile physically arriving well before the tick
      // budget below expects it to, vanishing mid-test).
      const strike = T.launchAttack(T.nodeO, T.nodeA, 'enemyStrike', T.ENEMY_STRIKE_SIZES.medium);
      strike.sizeKey = 'medium';
      strike.weaponClass = 'plane'; // LRNA-158: Counter Attack Planes only engages plane-class threats
      strike.defended = true; // keep the generic getDefender() auto-defend loop off it too
      // Emergency Counter only targets threats within EMERGENCY_WINDOW (5s)
      // of impact - fast-forward close to that without letting it land.
      const steps = Math.round((strike.totalSeconds - 3) / 0.05);
      for (let i = 0; i < steps; i++) T.tickUpdate(0.05);
      T.updateEmergencyBtn();
      T.updateCounterMissileBtn();
      T.updateCounterPlanesBtn();
    });

    const desktop = await page.evaluate(() => ({
      emergency: document.getElementById('emergencyBtn').textContent,
      counterMissileEta: document.getElementById('counterMissileEta').textContent,
      counterPlanesLabel: document.getElementById('counterPlanesLabel').textContent,
      counterPlanesEta: document.getElementById('counterPlanesEta').textContent,
    }));
    assert(desktop.emergency.includes('SPD') && desktop.emergency.includes('IMPACT'), 'desktop Emergency Counter text should stay fully descriptive');
    assertEqual(desktop.counterMissileEta, '1 target · 75% kill');
    assertEqual(desktop.counterPlanesLabel, 'COUNTER ATTACK PLANES');
    assert(desktop.counterPlanesEta.includes('kill'), 'desktop Counter Planes subtext should stay fully descriptive');

    await page.setViewportSize({ width: 375, height: 800 });
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.updateEmergencyBtn();
      T.updateCounterMissileBtn();
      T.updateCounterPlanesBtn();
    });
    const mobile = await page.evaluate(() => ({
      emergency: document.getElementById('emergencyBtn').textContent,
      counterMissileEta: document.getElementById('counterMissileEta').textContent,
      counterPlanesLabel: document.getElementById('counterPlanesLabel').textContent,
      counterPlanesEta: document.getElementById('counterPlanesEta').textContent,
    }));
    assert(mobile.emergency.length < desktop.emergency.length, 'mobile Emergency Counter text should be shorter than the desktop version');
    assertEqual(mobile.counterMissileEta, '1x · 75%');
    assertEqual(mobile.counterPlanesLabel, 'ATTACK PLANES', '"COUNTER" is redundant with the group header once on one line');
    assertEqual(mobile.counterPlanesEta, '1x · 75%');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-137: EMP deals real damage on top of its jam effect', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.disableOmegaCounters();
      T.clearForwardDefenses(); // LRNA-172: measure Omega's full (unguarded) damage
      const before = T.omegaHealth;
      const m = T.launchAttack(T.nodeA, T.nodeO, 'emp');
      m.defended = true;
      // impact still rolls against the normal 85% HIT_CHANCE - force a
      // guaranteed hit instead of leaving this test to a 15% flake rate.
      // Safe to override for the rest of this test: the missile's own id
      // is already assigned, and nothing else needs a fresh random id
      // before this scenario finishes.
      const realRandom = Math.random;
      Math.random = () => 0.01;
      for (let i = 0; i < 1000 && T.missiles.some(x => x.id === m.id); i++) T.tickUpdate(0.05);
      Math.random = realRandom;
      return { before, after: T.omegaHealth };
    });
    assert(result.after < result.before, `EMP should deal real damage: ${result.before} -> ${result.after}`);
    // Omega's health is a 0-250 scale while warhead dmg values are in the
    // hundreds (see OMEGA_HEALTH_DMG_RATIO = 0.03, applyDamage()) - EMP's
    // configured 200 dmg lands as 200 * 0.03 = 6 points of Omega health,
    // same conversion every other warhead goes through against Omega.
    assertEqual(result.before - result.after, 6, "EMP's 200 configured damage should land as Omega's usual damage-to-health conversion");
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-138: fresh players start with 500 of each token, not 1000', async () => {
  await withGame(async (page, errors) => {
    const tokens = await page.evaluate(() => window.__TEST__.tokens);
    // withGame waits ~200ms after clicking start before handing control
    // back, and passive income accrues the whole time (100/sec/category),
    // so allow a little headroom above the exact starting value.
    assert(tokens.attack >= 500 && tokens.attack < 550, `starting attack tokens should be ~500: got ${tokens.attack}`);
    assert(tokens.counter >= 500 && tokens.counter < 550, `starting counter tokens should be ~500: got ${tokens.counter}`);
    assert(tokens.intel >= 500 && tokens.intel < 550, `starting intel tokens should be ~500: got ${tokens.intel}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-139: Omega hit-chance escalation caps at 70%, not 85%', async () => {
  await withGame(async (page, errors) => {
    const finalChance = await page.evaluate(() => {
      const T = window.__TEST__;
      // force enough rebuilds to blow well past any reasonable cap
      for (let i = 0; i < 20; i++) T.forceOmegaDamage(999999);
      return T.nodeO.hitChance;
    });
    assert(finalChance <= 0.70 + 1e-9, `Omega hit chance should cap at 0.70: got ${finalChance}`);
    assert(finalChance > 0.5, `sanity check - 20 rebuilds should have escalated it well above its starting value: got ${finalChance}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-140: enemy strike damage scales with difficulty', async () => {
  // one browser instance per difficulty, comparing the resulting damage
  // against the same size table's base dmg rather than against each
  // other, since the size roll is randomized independently each time.
  for (const [difficulty, expectedMult] of [['easy', 0.75], ['normal', 1.0], ['hard', 1.5]]) {
    await withGame(async (page, errors) => {
      await page.click('#menuHome [data-goto="setup"]'); // ART-11
      await page.click(`[data-difficulty="${difficulty}"]`);
      await page.click('#menuSetup .mBtn[data-goto="home"]');
      await page.click('#startGameBtn');
      await page.waitForTimeout(150);
      const result = await page.evaluate(() => {
        const T = window.__TEST__;
        T.freezeWaves();
        const strike = T.launchEnemyStrike(T.nodeO, T.nodeA);
        return { dmg: strike.dmg, sizeKey: strike.sizeKey, baseDmg: T.ENEMY_STRIKE_SIZES[strike.sizeKey].dmg };
      });
      assertEqual(result.dmg, Math.round(result.baseDmg * expectedMult),
        `${difficulty} enemy strike damage should be baseDmg * ${expectedMult}`);
      assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
    }, { skipStart: true });
  }
});

test('LRNA-164: planes vanish at the target and rearm - nothing flies back', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.forceOpeningUnlock(); // LRNA-080: a fresh game starts recon-locked, attack planes can't fire yet
      T.disableOmegaCounters(); // keep Omega from shooting it down mid-flight
      const plane = T.firePlane('strikeFighter');
      const startX = plane.x;
      const towardOmega = Math.sign(T.nodeO.x - startX);
      let reversed = false;
      let lastX = plane.x;
      let steps = 0;
      while (T.missiles.includes(plane) && steps < 400) {
        T.tickUpdate(0.05);
        steps++;
        if (T.missiles.includes(plane)) {
          if (Math.sign(plane.x - lastX) === -towardOmega) reversed = true;
          lastX = plane.x;
        }
      }
      return {
        removed: !T.missiles.includes(plane),
        reversed,
        lastDistToOmega: Math.abs(T.nodeO.x - lastX),
        slotState: T.planeSlots.strikeFighter.state,
        eta: plane.totalSeconds,
        flightSeconds: steps * 0.05,
      };
    });
    assert(result.removed, 'plane should be removed once it reaches its target');
    assert(!result.reversed, 'plane should never turn around and fly back toward the player');
    assert(result.flightSeconds <= result.eta + 0.2,
      `plane should be gone by the end of its one-way flight (${result.flightSeconds}s vs ${result.eta}s)`);
    assertEqual(result.slotState, 'rearming', 'slot should start rearming the moment the plane finishes its job');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-163: START MISSION and the title are reachable and tappable on short screens', async () => {
  for (const viewport of [{ width: 375, height: 560 }, { width: 375, height: 700 }, { width: 1280, height: 800 }]) {
    await withGame(async (page, errors) => {
      const before = await page.evaluate(() => {
        const btn = document.getElementById('startGameBtn').getBoundingClientRect();
        const title = document.querySelector('#overlay h1').getBoundingClientRect();
        return { titleTop: title.top, btnTop: btn.top };
      });
      const size = `${viewport.width}x${viewport.height}`;
      assert(before.titleTop >= 0, `${size}: title should not be pushed off the top (top=${before.titleTop})`);
      assert(before.btnTop >= 0, `${size}: START MISSION should not be pushed off the top (top=${before.btnTop})`);
      // a real click - Playwright refuses if anything (e.g. #bottomBar) covers the button
      await page.click('#startGameBtn', { timeout: 3000 });
      await page.waitForTimeout(200);
      const started = await page.evaluate(() => document.getElementById('overlay').classList.contains('hidden'));
      assert(started, `${size}: clicking START MISSION should start the run`);
      assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
    }, { viewport, skipStart: true });
  }
});

test('LRNA-165: the player gets 10 counter missiles, 10 counter planes and 5 emergency counters per game', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.forceOpeningUnlock();
      T.freezeWaves();
      T.clearMissiles();
      T.neutralizeAutoDefense();
      T.disableOmegaCounters();
      T.tokens.counter = 999999; // tokens are never the limit here - only the stock is
      const counters = (src) => T.missiles.filter(m => m.typeKey === 'counter' && m.source === src).length;
      const strike = (weaponClass, secondsLeft) => {
        const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
        m.weaponClass = weaponClass;
        m.sizeKey = 'medium'; // Emergency Counter skips FAST
        m.age = secondsLeft == null ? 2 : m.totalSeconds - secondsLeft;
        return m;
      };
      const start = { ...T.counterAmmo };

      // Counter Missile: one threat at a time so each press has a target
      for (let i = 0; i < 14; i++) { strike('missile'); T.fireCounterMissile(); }
      T.updateCounterMissileBtn();
      const missileFired = counters('countermissile');
      const missileBtnDisabled = document.getElementById('counterMissileBtn').disabled;
      const missileBadge = document.getElementById('counterMissileAmmo').textContent;

      // Counter Planes: counts planes, and sends only what's left
      for (let i = 0; i < 8; i++) strike('plane');
      T.fireCounterAttackPlanes(); T.fireCounterAttackPlanes(); T.fireCounterAttackPlanes(); T.fireCounterAttackPlanes(); // 2+2+2+2 = 8
      const planesAfterFour = T.counterAmmo.planes;
      T.fireCounterAttackPlanes(); // 2 left -> 2
      T.fireCounterAttackPlanes(); // 0 left -> nothing
      const planesFired = counters('counterplanes');

      // Emergency Counter: threats inside its last-seconds window
      for (let i = 0; i < 8; i++) strike('missile', 3);
      for (let i = 0; i < 8; i++) { T.setEmergencyCooldown(0); T.fireEmergencyCounter(); }
      const emergencyFired = counters('emergency');
      const emergencyBadge = document.getElementById('emergencyAmmo').textContent;
      return { start, missileFired, missileBtnDisabled, missileBadge, planesAfterFour, planesFired, emergencyFired, emergencyBadge, end: { ...T.counterAmmo } };
    });
    assertEqual(JSON.stringify(result.start), JSON.stringify({ missile: 10, planes: 10, emergency: 5 }), 'a new game starts with 10/10/5');
    assertEqual(result.missileFired, 10, 'only 10 counter missiles can be fired');
    assert(result.missileBtnDisabled, 'COUNTER MISSILE should be disabled once none are left');
    assertEqual(result.missileBadge, 'NONE LEFT', 'the button should say none are left');
    assertEqual(result.planesAfterFour, 2, 'each 2-plane launch should use 2 of the 10');
    assertEqual(result.planesFired, 10, 'only 10 counter planes can be sent');
    assertEqual(result.emergencyFired, 5, 'only 5 emergency counters can be fired');
    assertEqual(result.emergencyBadge, 'NONE LEFT', 'the emergency button should say none are left');
    assertEqual(JSON.stringify(result.end), JSON.stringify({ missile: 0, planes: 0, emergency: 0 }), 'all three should be used up');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-165: Omega gets the same 10/10/5, including a new Emergency Counter', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.forceOpeningUnlock();
      T.freezeWaves();
      T.clearMissiles();
      T.tokens.attack = 999999;
      const omegaCounters = (src) => T.missiles.filter(m => m.typeKey === 'counter' && m.originId === 'O' && m.source === src).length;
      const warhead = (secondsLeft) => {
        const m = T.launchAttack(T.nodeA, T.nodeO, 'medium');
        m.omegaReactionDelay = 0;
        m.age = secondsLeft == null ? 2 : m.totalSeconds - secondsLeft;
        return m;
      };
      const start = { ...T.omegaCounterAmmo };

      // Counter Missile only (planes and emergency held off)
      for (let i = 0; i < 16; i++) warhead();
      for (let i = 0; i < 30; i++) {
        T.setOmegaCounterMissileTimer(0); T.setOmegaCounterPlanesTimer(1e6); T.setOmegaEmergencyCooldown(1e6);
        T.tickOmegaCounters(0.01);
      }
      const missileFired = omegaCounters('omega');

      // Counter Planes: only 1 left, two candidates -> sends just 1
      T.clearMissiles();
      T.omegaCounterAmmo.planes = 1;
      warhead(); warhead();
      T.setOmegaCounterMissileTimer(1e6); T.setOmegaCounterPlanesTimer(0); T.setOmegaEmergencyCooldown(1e6);
      T.tickOmegaCounters(0.01);
      const planesWithOneLeft = omegaCounters('omega');

      // Emergency Counter: warheads in their last 3 seconds
      T.clearMissiles();
      for (let i = 0; i < 8; i++) warhead(3);
      for (let i = 0; i < 12; i++) {
        T.setOmegaCounterMissileTimer(1e6); T.setOmegaCounterPlanesTimer(1e6); T.setOmegaEmergencyCooldown(0);
        T.tickOmegaCounters(0.01);
      }
      const emergencyFired = omegaCounters('omegaEmergency');
      T.updateOmegaCountersHud();
      const hud = document.getElementById('omegaCounterStatus').textContent;
      return { start, missileFired, planesWithOneLeft, emergencyFired, hud, end: { ...T.omegaCounterAmmo } };
    });
    assertEqual(JSON.stringify(result.start), JSON.stringify({ missile: 10, planes: 10, emergency: 5 }), 'Omega starts with 10/10/5');
    assertEqual(result.missileFired, 10, 'Omega should fire only 10 counter missiles');
    assertEqual(result.planesWithOneLeft, 1, 'Omega should send only as many counter planes as it has left');
    assertEqual(result.emergencyFired, 5, 'Omega should fire only 5 emergency counters');
    assertEqual(JSON.stringify(result.end), JSON.stringify({ missile: 0, planes: 0, emergency: 0 }), 'all three of Omega\'s should be used up');
    assert(/CM 0/.test(result.hud) && /CP 0/.test(result.hud) && /EC 0/.test(result.hud), `the HUD should show Omega is out: ${result.hud}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-165: a new game refills both sides\' counters', async () => {
  await withGame(async (page, errors) => {
    // leftovers as if from an earlier game, then a real START MISSION click
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.counterAmmo.missile = 0; T.counterAmmo.emergency = 1;
      T.omegaCounterAmmo.planes = 0;
    });
    await page.click('#startGameBtn');
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      return { player: { ...T.counterAmmo }, omega: { ...T.omegaCounterAmmo }, badge: document.getElementById('counterMissileAmmo').textContent };
    });
    assertEqual(JSON.stringify(result.player), JSON.stringify({ missile: 10, planes: 10, emergency: 5 }), 'player refilled');
    assertEqual(JSON.stringify(result.omega), JSON.stringify({ missile: 10, planes: 10, emergency: 5 }), 'Omega refilled');
    assertEqual(result.badge, '10 LEFT', 'button badge refreshed');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-166: tokens reset each game instead of carrying over', async () => {
  await withGame(async (page, errors) => {
    // a big balance left over from an earlier game, then a real START
    await page.evaluate(() => { const T = window.__TEST__; T.tokens.attack = 50000; T.tokens.counter = 40000; T.tokens.intel = 30000; });
    await page.click('#startGameBtn');
    const t = await page.evaluate(() => ({ ...window.__TEST__.tokens }));
    for (const k of ['attack', 'counter', 'intel']) {
      assert(t[k] >= 500 && t[k] < 520, `${k} should restart at 500, not carry over: got ${t[k]}`);
    }
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-166: passive income is 20/s and a hit pays back a quarter of its damage', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.forceOpeningUnlock();
      T.freezeWaves();
      T.clearMissiles();
      T.disableOmegaCounters();
      T.setEmpGlobalJamTimer(1e6); // with every roll forced to succeed, a defending field target would otherwise shoot it down
      T.tokens.attack = 10000;
      const m = T.launchAttack(T.nodeA, T.nodeO, 'medium'); // 250 dmg
      m.defended = true;
      const before = T.tokens.attack;
      const realRandom = Math.random;
      Math.random = () => 0.01; // guaranteed hit
      let steps = 0;
      for (; steps < 1000 && T.missiles.some(x => x.id === m.id); steps++) T.tickUpdate(0.05);
      Math.random = realRandom;
      const passive = T.TOKEN_PASSIVE_RATE * steps * 0.05;
      return { rate: T.TOKEN_PASSIVE_RATE, ratio: T.DMG_TO_COIN_RATIO, hitReward: T.tokens.attack - before - passive };
    });
    assertEqual(result.rate, 20, 'passive income should be 20/s per category');
    assertEqual(result.ratio, 0.25, 'hits should pay back a quarter of their damage');
    assert(Math.abs(result.hitReward - 63) < 1, `a 250-damage MEDIUM hit should pay back 63 (was 250): got ${result.hitReward}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-143: UI_DISABLED_TYPES is the single source of truth for launch-bar-less weapon types', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      const launchBarTypes = Array.from(document.querySelectorAll('.launchBtn[data-type]')).map(b => b.dataset.type);
      return {
        disabled: T.UI_DISABLED_TYPES,
        launchBarTypes,
        clusterStillFunctional: !!T.TYPES.cluster && T.TYPES.cluster.dmg > 0,
        empStillFunctional: !!T.TYPES.emp && T.TYPES.emp.dmg > 0,
      };
    });
    for (const key of result.disabled) {
      assert(!result.launchBarTypes.includes(key), `${key} is listed as UI-disabled but still has a launch bar button`);
    }
    assert(result.clusterStillFunctional, 'CLUSTER should stay fully defined/usable even though it has no button');
    assert(result.empStillFunctional, 'EMP should stay fully defined/usable even though it has no button');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-144: a failed localStorage write surfaces a visible warning instead of failing silently', async () => {
  await withGame(async (page, errors) => {
    const before = await page.evaluate(() => ({
      failed: window.__TEST__.storageWriteFailed,
      hidden: document.getElementById('storageWarning').classList.contains('hidden'),
    }));
    assert(!before.failed, 'should start with no storage failure flagged');
    assert(before.hidden, 'warning banner should be hidden when storage is working');

    const afterFailure = await page.evaluate(() => {
      const realSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new DOMException('quota exceeded', 'QuotaExceededError'); };
      const ok = window.__TEST__.trySaveStorage('lrna_test_key', 'x');
      Storage.prototype.setItem = realSetItem; // restore immediately, this test only needs one failed write
      return {
        ok,
        failed: window.__TEST__.storageWriteFailed,
        hidden: document.getElementById('storageWarning').classList.contains('hidden'),
      };
    });
    assertEqual(afterFailure.ok, false, 'trySaveStorage should report the write failed');
    assert(afterFailure.failed, 'storageWriteFailed should flip to true on a thrown setItem');
    assert(!afterFailure.hidden, 'warning banner should become visible');

    const afterRecovery = await page.evaluate(() => {
      const ok = window.__TEST__.trySaveStorage('lrna_test_key', 'x');
      return {
        ok,
        failed: window.__TEST__.storageWriteFailed,
        hidden: document.getElementById('storageWarning').classList.contains('hidden'),
      };
    });
    assertEqual(afterRecovery.ok, true, 'a subsequent successful write should report success');
    assert(!afterRecovery.failed, 'storageWriteFailed should clear once a write succeeds again');
    assert(afterRecovery.hidden, 'warning banner should hide again once storage recovers');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-146: contact list refreshes at 20fps instead of the old 5fps', async () => {
  await withGame(async (page, errors) => {
    const interval = await page.evaluate(() => window.__TEST__.CONTACTS_RENDER_INTERVAL);
    assertEqual(interval, 0.05, 'render interval should be 0.05s (20fps), not the old 0.2s (5fps)');

    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.clearMissiles();
      // settle the render countdown into a steady state first (the very
      // first tick always renders immediately regardless of interval, so
      // it proves nothing on its own about how *often* it re-renders).
      T.tickUpdate(0.1);
      document.getElementById('contactList').innerHTML = ''; // clear out the settled render
      T.launchEnemyStrike(T.nodeO, T.nodeA);
      // one more tick, well under the old 0.2s interval but past the new
      // 0.05s one - only the new interval would re-render in time to
      // pick up this contact.
      T.tickUpdate(0.06);
      return document.getElementById('contactList').innerHTML;
    });
    assert(result.length > 0, 'contact list should reflect the new inbound strike within 0.06s of the previous render');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-149: Emergency Counter always shows its cost, even with no target', async () => {
  await withGame(async (page, errors) => {
    const idle = await page.evaluate(() => {
      window.__TEST__.updateEmergencyBtn();
      return document.getElementById('emergencyBtn').textContent;
    });
    assert(idle.includes('150') && idle.includes('COUNTER'), `cost should be visible with no target: "${idle}"`);

    const withTarget = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.neutralizeAutoDefense();
      T.disableOmegaCounters();
      // launch directly with a fixed 'medium' override (see LRNA-121's
      // test for why: launchEnemyStrike's internal RNG roll fixes the
      // missile's real vx from whatever size it happens to pick, so
      // relabeling sizeKey/totalSeconds afterward without launchAttack
      // recomputing vx to match risks the missile arriving early).
      const strike = T.launchAttack(T.nodeO, T.nodeA, 'enemyStrike', T.ENEMY_STRIKE_SIZES.medium);
      strike.sizeKey = 'medium';
      strike.defended = true;
      const steps = Math.round((strike.totalSeconds - 3) / 0.05);
      for (let i = 0; i < steps; i++) T.tickUpdate(0.05);
      T.updateEmergencyBtn();
      return document.getElementById('emergencyBtn').textContent;
    });
    assert(withTarget.includes('150') && withTarget.includes('COUNTER'), `cost should still be visible with a target: "${withTarget}"`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-150: incoming alert shows a count when multiple threats are inbound', async () => {
  await withGame(async (page, errors) => {
    const solo = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.launchEnemyStrike(T.nodeO, T.nodeA);
      T.tickUpdate(0.05);
      return document.getElementById('incomingAlert').textContent;
    });
    assert(!solo.includes('more'), `a single inbound threat should not show a "+N more" suffix: "${solo}"`);

    const wall = await page.evaluate(() => {
      const T = window.__TEST__;
      T.launchEnemyStrike(T.nodeO, T.nodeA);
      T.launchEnemyStrike(T.nodeO, T.nodeA);
      T.launchEnemyStrike(T.nodeO, T.nodeA);
      T.tickUpdate(0.05);
      return document.getElementById('incomingAlert').textContent;
    });
    assert(wall.includes('+3 more'), `4 inbound threats should show "+3 more": "${wall}"`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-151: point-defense jam and counters jam show separate HUD indicators', async () => {
  await withGame(async (page, errors) => {
    const neither = await page.evaluate(() => {
      window.__TEST__.updateOmegaCountersHud();
      return {
        pdHidden: document.getElementById('pointDefenseJamStatus').classList.contains('hidden'),
        cHidden: document.getElementById('omegaJamStatus').classList.contains('hidden'),
      };
    });
    assert(neither.pdHidden && neither.cHidden, 'both indicators should start hidden with nothing jammed');

    const pdOnly = await page.evaluate(() => {
      const T = window.__TEST__;
      T.setEmpGlobalJamTimer(10);
      T.updateOmegaCountersHud();
      return {
        pdHidden: document.getElementById('pointDefenseJamStatus').classList.contains('hidden'),
        pdText: document.getElementById('pointDefenseJamStatus').textContent,
        cHidden: document.getElementById('omegaJamStatus').classList.contains('hidden'),
      };
    });
    assert(!pdOnly.pdHidden, 'point-defense jam should show its own indicator');
    assert(pdOnly.pdText.includes('POINT DEFENSE'), `should be labeled distinctly: "${pdOnly.pdText}"`);
    assert(pdOnly.cHidden, 'counters-jam indicator should stay hidden - only point defense is jammed');

    const both = await page.evaluate(() => {
      const T = window.__TEST__;
      T.setOmegaCountersJamTimer(10);
      T.updateOmegaCountersHud();
      return {
        pdHidden: document.getElementById('pointDefenseJamStatus').classList.contains('hidden'),
        cHidden: document.getElementById('omegaJamStatus').classList.contains('hidden'),
        cText: document.getElementById('omegaJamStatus').textContent,
      };
    });
    assert(!both.pdHidden && !both.cHidden, 'both indicators should show when both jams are active simultaneously');
    assert(both.cText.includes('COUNTERS JAMMED'), `counters indicator should keep its own distinct label: "${both.cText}"`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-152: radar contact list shows an overflow indicator past 20 items', async () => {
  await withGame(async (page, errors) => {
    const under = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      for (let i = 0; i < 5; i++) T.launchEnemyStrike(T.nodeO, T.nodeA);
      T.tickUpdate(0.05);
      return document.getElementById('contactList').innerHTML;
    });
    assert(!under.includes('more contacts'), 'no overflow indicator should show with only 5 contacts');

    const over = await page.evaluate(() => {
      const T = window.__TEST__;
      for (let i = 0; i < 20; i++) T.launchEnemyStrike(T.nodeO, T.nodeA);
      T.tickUpdate(0.05);
      return {
        html: document.getElementById('contactList').innerHTML,
        rowCount: document.querySelectorAll('#contactList .contact-row').length,
      };
    });
    assert(over.html.includes('more contacts not shown'), `25 contacts should show an overflow indicator: missing from html`);
    assertEqual(over.rowCount, 20, 'should still render exactly the first 20 rows, not more');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-126-adjacent: a missile that tunnels past its 14-unit hit radius in one tick still resolves', async () => {
  // Found by chance while chasing LRNA-137 test flakiness: a fast enough
  // missile can move more than the 14-unit hit radius in a single tick
  // (dt is clamped to 0.05s, and most warheads cover tens of units in
  // that time), so its sampled position can skip clean over the target
  // zone and never register <=14 units away on any exact tick - and
  // unlike planes, nothing used to expire it by age, so it just flew
  // forever. This reproduces that precisely instead of relying on
  // chance: position the missile 30 units short of its target with a
  // single-tick step of ~48 units, guaranteed to jump clean over the
  // 14-unit window without ever landing inside it.
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.disableOmegaCounters();
      const before = T.omegaHealth;
      const m = T.launchAttack(T.nodeA, T.nodeO, 'fast');
      m.defended = true;
      m.x = m.targetX - 30; // 30 units short - inside the 48-unit step, outside the 14-unit hit radius
      m.age = m.totalSeconds - 0.001; // just under the age fallback, so only the distance/age check on the NEXT tick decides this
      const distBefore = Math.abs(m.targetX - m.x);
      const realRandom = Math.random;
      Math.random = () => 0.01; // guarantee the hit-chance reroll succeeds so this isolates the tunneling fix, not HIT_CHANCE
      T.tickUpdate(0.05); // one tick: covers ~48 units, jumping clean over the 14-unit window
      const distAfter = Math.abs(m.targetX - m.x);
      Math.random = realRandom;
      return { before, after: T.omegaHealth, distBefore, distAfter, stillPresent: T.missiles.some(x => x.id === m.id) };
    });
    assert(result.distBefore > 14, `sanity check - should start outside the hit radius: ${result.distBefore}`);
    assert(result.distAfter > 14, `sanity check - single tick should jump clean over the hit radius, landing outside it again: ${result.distAfter}`);
    assert(!result.stillPresent, 'missile should resolve (via the age fallback) instead of tunneling past forever');
    assert(result.after < result.before, `tunneling past the target should not mean it deals no damage: ${result.before} -> ${result.after}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-080: fresh game starts recon-locked - no Wave 1, no attacking, intel tools still work', async () => {
  await withGame(async (page, errors) => {
    const initial = await page.evaluate(() => {
      const T = window.__TEST__;
      return {
        locked: T.openingLocked,
        bannerHidden: document.getElementById('openingLockedBanner').classList.contains('hidden'),
      };
    });
    assert(initial.locked, 'a fresh game should start with the opening locked');
    assert(!initial.bannerHidden, 'the recon-required banner should be visible');

    const noWaveYet = await page.evaluate(() => {
      const T = window.__TEST__;
      for (let i = 0; i < 400; i++) T.tickUpdate(0.05); // 20 simulated seconds - plenty for Wave 1 to have started strikes normally
      return T.missiles.filter(m => m.typeKey === 'enemyStrike').length;
    });
    assertEqual(noWaveYet, 0, 'Wave 1 should not launch any strikes while the opening is locked, no matter how long real/simulated time passes');

    const attackBlocked = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.attemptFire('fast');
      T.firePlane('strikeFighter');
      return {
        fastCount: T.missiles.filter(m => m.typeKey === 'fast').length,
        planeCount: T.missiles.filter(m => m.typeKey === 'plane').length,
      };
    });
    assertEqual(attackBlocked.fastCount, 0, 'attack-pillar attemptFire should refuse to launch while locked');
    assertEqual(attackBlocked.planeCount, 0, 'attack-pillar firePlane should refuse to launch while locked');

    const intelStillWorks = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.intel = 99999;
      T.attemptFire('drone');
      return T.missiles.filter(m => m.typeKey === 'drone').length;
    });
    assertEqual(intelStillWorks, 1, 'intel-pillar attemptFire (recon drone) should still work while locked - it\'s the way OUT of the lock');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-080: discovering a hidden node unlocks the opening and Wave 1 begins', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      // exercise the real unlock condition (a discovered node) rather than
      // just flipping the lock flag directly - every real discovery path
      // (drone tick, recon plane) calls this same function.
      T.seekDestroyNodes[0].discovered = true;
      T.checkOpeningUnlock();
      const beforeAttack = T.missiles.filter(m => m.typeKey === 'fast').length;
      T.attemptFire('fast');
      const afterAttack = T.missiles.filter(m => m.typeKey === 'fast').length;
      for (let i = 0; i < 400; i++) T.tickUpdate(0.05);
      return {
        locked: T.openingLocked,
        bannerHidden: document.getElementById('openingLockedBanner').classList.contains('hidden'),
        beforeAttack, afterAttack,
        // LRNA-080/flake fix: checking live missile count at the end of a
        // fixed window is a race against the default loadout's own
        // defenses - they can (and, ~30% of the time in practice, do)
        // destroy all of Wave 1's few early strikes well before the
        // window ends, with Wave 2's 10s break not yet over either,
        // leaving a real but momentary 0 with nothing wrong. Checking
        // the wave director's own launch counter instead is immune to
        // that timing - it only asks "did a strike ever launch."
        waveStrikesLaunched: T.waveStrikesLaunched,
      };
    });
    assert(!result.locked, 'opening should no longer be locked');
    assert(result.bannerHidden, 'recon-required banner should hide once unlocked');
    assertEqual(result.afterAttack - result.beforeAttack, 1, 'attack-pillar attemptFire should work once unlocked');
    assert(result.waveStrikesLaunched > 0, 'Wave 1 should actually start producing strikes once unlocked');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-080: Satellite no longer auto-reveals SEEK AND DESTROY nodes (still reveals AntiPlane)', async () => {
  await withGame(async (page, errors) => {
    await page.click('#menuHome [data-goto="setup"]');
    await page.selectOption('.loadoutSelect[data-slot="0"]', 'satellite');
    await page.click('#menuSetup .mBtn[data-goto="home"]');
    await page.click('#startGameBtn');
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      return {
        seekDestroyDiscovered: T.seekDestroyNodes.map(n => n.discovered),
        antiPlaneDiscovered: T.antiPlaneNodes.map(n => n.discovered),
        locked: T.openingLocked,
      };
    });
    assert(result.seekDestroyDiscovered.every(d => d === false), `Satellite should not reveal SEEK AND DESTROY nodes: ${result.seekDestroyDiscovered}`);
    assert(result.antiPlaneDiscovered.every(d => d === true), `Satellite should still reveal AntiPlane nodes as before: ${result.antiPlaneDiscovered}`);
    assert(result.locked, 'the opening should still be locked even with Satellite equipped - no bypass');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-080: recon Drone is no longer exempt from Omega\'s Counter Planes candidates', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.intel = 99999;
      T.forceOpeningUnlock();
      T.disableOmegaCounters(); // don't let it actually get shot down while we age it past the reaction delay below
      T.attemptFire('drone');
      const drone = T.missiles.filter(m => m.typeKey === 'drone').pop();
      drone.defended = true; // skip the generic getDefender() auto-defend loop - a separate mechanism from Omega's own counters
      // Omega's candidates require a short reaction delay (1-2s) to have
      // elapsed since the missile appeared - age it past that first.
      // omegaCounterCandidates() itself doesn't consult the cooldown
      // timers disableOmegaCounters() freezes, so this is still a real
      // check of candidacy, just without Omega actually firing on it.
      for (let i = 0; i < 60; i++) T.tickUpdate(0.05); // 3s
      const candidates = T.omegaCounterCandidates(true);
      return { droneExists: !!drone, isCandidate: candidates.some(c => c.typeKey === 'drone') };
    });
    assert(result.droneExists, 'sanity check - a drone missile should exist');
    assert(result.isCandidate, 'drone should now be a valid Omega Counter Planes candidate, not exempt');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-080: SEEK AND DESTROY nodes carry a recon zone boundary for the pre-discovery map marker', async () => {
  await withGame(async (page, errors) => {
    const zones = await page.evaluate(() => window.__TEST__.seekDestroyNodes.map(n => ({ zoneStart: n.zoneStart, zoneEnd: n.zoneEnd, x: n.x })));
    for (const z of zones) {
      assert(typeof z.zoneStart === 'number' && typeof z.zoneEnd === 'number', `node should carry zone bounds: ${JSON.stringify(z)}`);
      assert(z.zoneEnd > z.zoneStart, `zone should be a real, non-empty range: ${JSON.stringify(z)}`);
      assert(z.x >= z.zoneStart && z.x <= z.zoneEnd, `node's own position should fall inside its own zone: ${JSON.stringify(z)}`);
    }
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-049: Base loadout node fires a volley at every inbound threat at once, not just one', async () => {
  await withGame(async (page, errors) => {
    await page.click('#menuHome [data-goto="setup"]');
    await page.selectOption('.loadoutSelect[data-slot="0"]', 'base');
    await page.click('#menuSetup .mBtn[data-goto="home"]');
    await page.click('#startGameBtn');
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.forceOpeningUnlock();
      T.freezeWaves();
      T.clearMissiles();
      const base = T.loadoutNodes.find(n => n.def.key === 'base');

      const threats = ['fast', 'medium', 'large'].map(sizeKey => {
        const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
        m.sizeKey = sizeKey;
        m.age = 2;
        return m;
      });
      base.fireTimer = 0;
      T.tickLoadoutNodes(0.016);
      const engaged = new Set(T.missiles.filter(m => m.typeKey === 'counter' && m.source === 'loadout' && m.originId === base.id).map(m => m.seekTargetId));
      const fireTimerAfterVolley = base.fireTimer;

      T.clearMissiles();
      base.fireTimer = 0;
      T.tickLoadoutNodes(0.016);
      const fireTimerWithNoTargets = base.fireTimer;

      return {
        baseExists: !!base,
        threatIds: threats.map(m => m.id),
        engaged: Array.from(engaged),
        fireTimerAfterVolley,
        fireTimerWithNoTargets,
      };
    });
    assert(result.baseExists, 'sanity check - a Base node should exist in slot 0');
    assert(result.threatIds.every(id => result.engaged.includes(id)),
      `all 3 threats should be engaged in the same tick; threatIds=${JSON.stringify(result.threatIds)} engaged=${JSON.stringify(result.engaged)}`);
    assertEqual(result.fireTimerAfterVolley, 6, 'firing a volley should reset the cooldown to the full 6s cycle');
    assertEqual(result.fireTimerWithNoTargets, 0.3, 'with nothing inbound, Base should retry soon rather than wait out the full cycle');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-158: COUNTER MISSILE fires directly from the bottom bar - no window, no popup', async () => {
  // Supersedes the old LRNA-084 version: "scrap the whole counter
  // operations window" reversed LRNA-084/154's "COUNTER MISSILE opens a
  // screen" behavior - it fires immediately now, same as every other
  // ability button.
  await withGame(async (page, errors) => {
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.forceOpeningUnlock();
      T.freezeWaves();
      T.clearMissiles();
      T.neutralizeAutoDefense(); // the live game loop keeps running between page.evaluate calls - without this, real AM batteries/loadout nodes can intercept this test's own manually-launched strike before its own click gets to it
      T.tokens.counter = 99999;
      const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
      m.age = 2;
      m.weaponClass = 'missile'; // LRNA-158: COUNTER MISSILE only engages its own matching class now
      T.updateCounterMissileBtn();
    });
    const before = await page.evaluate(() => ({
      missionMapOpen: window.__TEST__.missionMapOpen,
      counterMissilesBefore: window.__TEST__.missiles.filter((mm) => mm.typeKey === 'counter').length,
    }));
    await page.click('#counterMissileBtn');
    const after = await page.evaluate(() => ({
      missionMapOpen: window.__TEST__.missionMapOpen,
      counterMissilesAfter: window.__TEST__.missiles.filter((mm) => mm.typeKey === 'counter').length,
    }));
    assert(!before.missionMapOpen && !after.missionMapOpen, 'clicking COUNTER MISSILE should never open the STATS window');
    assert(after.counterMissilesAfter > before.counterMissilesBefore, 'clicking COUNTER MISSILE should fire a counter missile immediately, with no window or popup in between');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-160: COUNTER ATTACK PLANES fires directly from the bottom bar - no popup', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.forceOpeningUnlock();
      T.freezeWaves();
      T.clearMissiles();
      T.neutralizeAutoDefense();
      T.tokens.counter = 99999;
      const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
      m.age = 2;
      m.weaponClass = 'plane'; // Counter Attack Planes only engages plane-class threats (LRNA-158)
      T.updateCounterPlanesBtn();
    });
    const before = await page.evaluate(() => ({
      counterTokens: window.__TEST__.tokens.counter,
      countersInFlight: window.__TEST__.missiles.filter((mm) => mm.typeKey === 'counter').length,
    }));
    await page.click('#counterPlanesBtn');
    const after = await page.evaluate(() => ({
      counterTokens: window.__TEST__.tokens.counter,
      countersInFlight: window.__TEST__.missiles.filter((mm) => mm.typeKey === 'counter').length,
      popupExists: !!document.getElementById('counterPlanesWindow'),
    }));
    assert(!after.popupExists, 'there should be no Counter Attack Planes popup in the DOM at all');
    assert(after.countersInFlight > before.countersInFlight, 'clicking COUNTER ATTACK PLANES should launch its intercept immediately');
    assert(after.counterTokens < before.counterTokens, 'clicking COUNTER ATTACK PLANES should spend Counter tokens immediately');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-161: the Counter Lane lines up with the zone strip and dots each inbound strike at its position', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.forceOpeningUnlock();
      T.freezeWaves();
      T.clearMissiles();
      T.neutralizeAutoDefense();
      T.disableOmegaCounters();
      T.launchEnemyStrike(T.nodeO, T.nodeA);
    });
    await page.waitForTimeout(150); // let the rAF loop draw a few frames
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      const c = document.getElementById('counterLaneCanvas');
      const track = document.getElementById('missionMapStripTrack').getBoundingClientRect();
      const lane = c.getBoundingClientRect();
      const ctx = c.getContext('2d');
      const y = Math.floor(c.height / 2);
      const maxAlphaAround = (px) => {
        let best = 0;
        for (let x = Math.max(0, px - 5); x <= Math.min(c.width - 1, px + 5); x++) best = Math.max(best, ctx.getImageData(x, y, 1, 1).data[3]);
        return best;
      };
      const strike = T.missiles.find((m) => m.typeKey === 'enemyStrike');
      const pct = (strike.x - T.nodeA.x) / (T.nodeO.x - T.nodeA.x);
      const strikePx = Math.round(pct * c.width);
      const emptyPx = Math.round((pct > 0.5 ? 0.25 : 0.75) * c.width);
      return {
        size: [c.width, c.height],
        leftDiff: Math.abs(lane.left - track.left),
        widthDiff: Math.abs(lane.width - track.width),
        atStrike: maxAlphaAround(strikePx),
        atEmpty: maxAlphaAround(emptyPx),
      };
    });
    assert(r.size[0] > 0 && r.size[1] > 0, `the lane canvas should have a real drawing size: ${r.size}`);
    assert(r.leftDiff <= 1 && r.widthDiff <= 1, `the lane should span exactly the zone strip's track (left off by ${r.leftDiff}px, width off by ${r.widthDiff}px)`);
    assert(r.atStrike > 200, `an opaque dot should be drawn at the inbound strike's position (alpha ${r.atStrike})`);
    assert(r.atEmpty < 128, `nothing but the faint center line should be drawn where there's no contact (alpha ${r.atEmpty})`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-158: STATS button opens a pure reference window - GAME MODE/RUN STATS/TARGETS only, no COUNTER or RECON content', async () => {
  // Supersedes the old LRNA-084/154 versions of this test: #opsCenterBtn
  // is #statsBtn now, and the window it opens dropped COUNTER/RECON
  // entirely.
  await withGame(async (page, errors) => {
    const beforeOpen = await page.evaluate(() => ({
      missionMapOpen: window.__TEST__.missionMapOpen,
    }));
    await menuClick(page, 'statsBtn');
    const afterOpen = await page.evaluate(() => ({
      missionMapOpen: window.__TEST__.missionMapOpen,
      menuBtnHidden: document.getElementById('menuBtn').classList.contains('hidden'),
      noCounterSection: !document.getElementById('missionMapCounterSection'),
      noReconSection: !document.getElementById('missionMapReconSection'),
    }));
    assert(!beforeOpen.missionMapOpen, 'STATS should start closed');
    assert(afterOpen.missionMapOpen, 'the STATS button should open the window');
    assert(afterOpen.menuBtnHidden, 'opening STATS should hide the MENU button behind it');
    assert(afterOpen.noCounterSection, 'the old COUNTER section should no longer exist anywhere - it moved to the bottom bar (direct-fire) entirely');
    assert(afterOpen.noReconSection, 'the old RECON section should no longer exist inside the window');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-156: opening STATS pauses the battle and closing it resumes', async () => {
  await withGame(async (page, errors) => {
    await menuClick(page, 'statsBtn');
    const open = await page.evaluate(async () => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
      const x0 = m.x;
      await new Promise((r) => setTimeout(r, 300)); // several real frames of the main loop
      return {
        paused: T.paused,
        moved: m.x !== x0,
      };
    });
    await page.click('#missionMapClose');
    const closed = await page.evaluate(() => ({ paused: window.__TEST__.paused }));
    assert(open.paused, 'the battle should be paused while STATS is open');
    assert(!open.moved, 'an inbound strike should not move while STATS is open');
    assert(!closed.paused, 'closing STATS should resume the battle');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-156/ART-14: Esc closes STATS and resumes; a pause made outside STATS is left alone', async () => {
  await withGame(async (page, errors) => {
    await menuClick(page, 'statsBtn');
    await page.keyboard.press('Escape');
    const afterEsc = await page.evaluate(() => ({ open: window.__TEST__.missionMapOpen, paused: window.__TEST__.paused }));
    // already paused some other way before STATS opens: closing it leaves that pause
    await page.evaluate(() => { window.__TEST__.setPaused(true); document.getElementById('statsBtn').click(); });
    await page.click('#missionMapClose');
    const prePaused = await page.evaluate(() => window.__TEST__.paused);
    assert(!afterEsc.open && !afterEsc.paused, `Esc closes STATS and the battle runs again: ${JSON.stringify(afterEsc)}`);
    assert(prePaused, 'a pause STATS did not make survives closing it');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-167: a discovered hidden node joins TARGETS and a missile aimed at it can destroy it', async () => {
  await withGame(async (page, errors) => {
    const listIds = () => page.evaluate(() => Array.from(document.querySelectorAll('#targetList .target-row')).map((r) => r.dataset.target));
    await menuClick(page, 'statsBtn');
    const beforeDiscovery = await listIds();
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.seekDestroyNodes.find((n) => n.kind === 'attack').discovered = true;
      T.forceOpeningUnlock();
      T.tickUpdate(0.1); // refresh the list
    });
    const afterDiscovery = await listIds();
    await page.click('#targetList .target-row[data-target="sd-attack"]');
    const label = await page.evaluate(() => document.getElementById('targetLabel').textContent);
    await page.click('#missionMapClose');

    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      T.neutralizeAutoDefense();
      T.disableOmegaCounters();
      T.setEmpGlobalJamTimer(1e6); // AntiPlane nodes can't shoot it down
      T.tokens.attack = 99999;
      T.attemptFire('large');
      const shot = T.missiles.find((m) => m.originId === 'A');
      const node = T.seekDestroyNodes.find((n) => n.kind === 'attack');
      window.__origRandom = Math.random;
      Math.random = () => 0.01; // the shot lands
      for (let i = 0; i < 700 && T.missiles.includes(shot); i++) T.tickUpdate(0.05);
      Math.random = window.__origRandom;
      T.tickUpdate(0.1);
      return {
        destId: shot && shot.destId,
        destroyed: node.destroyed,
        health: node.health,
        stillListed: Array.from(document.querySelectorAll('#targetList .target-row')).some((row) => row.dataset.target === 'sd-attack'),
        label: document.getElementById('targetLabel').textContent,
      };
    });
    assert(!beforeDiscovery.some((id) => id.startsWith('sd-')), `undiscovered hidden nodes must not be targetable: ${beforeDiscovery}`);
    assert(afterDiscovery.includes('sd-attack'), `the discovered ATTACK NODE should be listed in TARGETS: ${afterDiscovery}`);
    assert(!afterDiscovery.includes('sd-counter') && !afterDiscovery.includes('sd-base'), 'the other two, still hidden, should stay off the list');
    assertEqual(label, 'TARGET: ATTACK NODE', 'picking it should make it the current target');
    assertEqual(r.destId, 'sd-attack', 'the LONG RANGE shot should be aimed at the hidden node');
    assert(r.destroyed && r.health === 0, `a 1000-damage hit should destroy the 500 hp node: ${JSON.stringify(r)}`);
    assert(!r.stillListed, 'a destroyed node should drop off TARGETS');
    assertEqual(r.label, 'TARGET: NODE OMEGA', 'the target should fall back to Omega once it is destroyed');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-168: on a phone the ability bar is a compact 3-column grid and leaves room for the battlefield', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const rect = (el) => el.getBoundingClientRect();
      const attack = document.querySelector('.abilityGroup[data-pillar="attack"]');
      const tops = Array.from(attack.querySelectorAll('.launchBtn')).map((b) => Math.round(rect(b).top));
      const counterSub = document.querySelector('.abilityGroup[data-pillar="counter"] .abilityGroupSub');
      return {
        barHeight: document.getElementById('bottomBar').offsetHeight,
        viewport: window.innerHeight,
        attackRows: new Set(tops).size,
        attackButtons: tops.length,
        counterPlanesLabelShown: !!counterSub.offsetParent,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    assert(r.barHeight < r.viewport * 0.45, `the bottom bar should take under 45% of an 844px phone screen: ${r.barHeight}px`);
    assertEqual(r.attackButtons, 6, 'ATTACK should have its 3 missiles and 3 planes');
    assertEqual(r.attackRows, 2, 'ATTACK\'s 6 buttons should sit in 2 rows of 3');
    assert(!r.counterPlanesLabelShown, 'COUNTER has no planes, so no empty PLANES label');
    assert(r.scrollWidth <= 390, `no sideways scroll: ${r.scrollWidth}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { viewport: { width: 390, height: 844 } });
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`LRNA-169: nothing covers the HUD panels at ${viewport.width}px (Omega's counter readout stays visible)`, async () => {
    await withGame(async (page, errors) => {
      const r = await page.evaluate(() => {
        const rect = (id) => document.getElementById(id).getBoundingClientRect();
        const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const panels = Array.from(document.querySelectorAll('#hud .panel')).map((p) => p.getBoundingClientRect());
        const covers = ['contacts', 'menuBtn'].filter((id) => panels.some((p) => overlaps(rect(id), p)));
        return { covers, omegaStatus: document.getElementById('omegaCounterStatus').textContent };
      });
      assertEqual(r.covers.length, 0, `these sit on top of the HUD panels: ${r.covers}`);
      assert(/CM \d+/.test(r.omegaStatus), `Omega's counter readout should be filled in: ${r.omegaStatus}`);
      assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
    }, { viewport });
  });
}

test('LRNA-170: the HUD shows the address the game was opened from', async () => {
  // ART-10 removed the start screen's ENTRANCE box; the HUD line keeps the address.
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  await withGame(async (page, errors) => {
    const read = () => page.evaluate(() => ({
      hud: document.getElementById('hudHost').textContent,
      hudShown: !document.getElementById('hudHostLine').hidden,
      stale: document.body.innerText.includes('192.168.1.36'),
    }));
    const asFile = await read(); // the harness opens it as file://
    const serve = (url) => page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: html }));
    await serve('http://192.168.1.89:2001/**');
    await page.goto('http://192.168.1.89:2001/');
    const atRoot = await read();
    await serve('http://gameserver.lan:8080/**');
    await page.goto('http://gameserver.lan:8080/long-range-node-attack/index.html');
    const inFolder = await read();
    assert(!asFile.hudShown, `opened as a file there is no address to show: ${JSON.stringify(asFile)}`);
    assert(!asFile.stale, 'the old fixed 192.168.1.36 address should be gone');
    assertEqual(atRoot.hud, '192.168.1.89:2001', 'HUD address');
    assert(atRoot.hudShown, `served over http the address shows: ${JSON.stringify(atRoot)}`);
    assertEqual(inFolder.hud, 'gameserver.lan:8080', 'any host and port');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-172: Omega takes a quarter of the damage while any forward defense stands', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      const nodes = [...T.antiPlaneNodes, ...T.seekDestroyNodes];
      const hit = () => { const b = T.omegaHealth; T.forceOmegaDamage(1000); return b - T.omegaHealth; };
      const guardedAll = hit();
      nodes.slice(0, -1).forEach((n) => { n.destroyed = true; });
      const guardedOne = hit();
      T.updateObjectiveHud();
      const guardText = document.getElementById('omegaGuardStatus').textContent;
      nodes[nodes.length - 1].destroyed = true;
      const open = hit();
      T.updateObjectiveHud();
      return { count: nodes.length, guardedAll, guardedOne, open, guardText,
        guardHidden: document.getElementById('omegaGuardStatus').classList.contains('hidden'),
        radarHealth: T.antiPlaneNodes.map((n) => n.maxHealth) };
    });
    assertEqual(r.count, 5, 'two radar defenses and three SEEK AND DESTROY nodes guard Omega');
    assertEqual(r.guardedAll, 8, '1000 damage is 30 health unguarded, a quarter of that (7.5, rounds to 8) while guarded');
    assertEqual(r.guardedOne, 8, 'still guarded with one forward defense left');
    assertEqual(r.open, 30, 'full damage once all of them are down');
    assert(/25% DAMAGE \(1 FORWARD DEFENSE UP\)/.test(r.guardText), `HUD names the guard: ${r.guardText}`);
    assert(r.guardHidden, 'the guard line disappears once Omega is open');
    assertEqual(JSON.stringify(r.radarHealth), '[300,300]', 'radar defenses have 300 hp each');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-172: a discovered radar defense is a target, and a missile can destroy it', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      const radar = T.antiPlaneNodes[0];
      radar.discovered = true;
      T.forceOpeningUnlock();
      T.freezeWaves(); T.clearMissiles(); T.neutralizeAutoDefense(); T.disableOmegaCounters();
      T.setEmpGlobalJamTimer(1e6); // its own lane intercept would otherwise fire at the shot
      T.tickUpdate(0.1);
      const listed = Array.from(document.querySelectorAll('#targetList .target-row')).map((x) => x.dataset.target);
      document.querySelector(`#targetList .target-row[data-target="${radar.id}"]`).click();
      T.tokens.attack = 99999;
      T.attemptFire('large');
      const shot = T.missiles.find((m) => m.originId === 'A');
      const real = Math.random; Math.random = () => 0.01;
      for (let i = 0; i < 700 && T.missiles.includes(shot); i++) T.tickUpdate(0.05);
      Math.random = real;
      return { listed, dest: shot.destId, destroyed: radar.destroyed, name: radar.name, after: T.selectedTargetId };
    });
    assert(r.listed.includes('ap0'), `the found radar defense is in TARGETS: ${r.listed}`);
    assert(!r.listed.includes('ap1'), 'the hidden one is not');
    assertEqual(r.dest, 'ap0', 'the shot is aimed at it');
    assert(r.destroyed, 'a 1000-damage LONG RANGE hit destroys the 300 hp radar defense');
    assertEqual(r.name, 'RADAR DEFENSE 01', 'named as a radar defense');
    assertEqual(r.after, 'O', 'the target falls back to Omega afterwards');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-172: tapping a discovered node on the battlefield targets it', async () => {
  await withGame(async (page, errors) => {
    const pos = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const node = T.seekDestroyNodes[0];
      node.discovered = true;
      T.setCamX(node.x - 600);
      const rect = document.getElementById('game').getBoundingClientRect();
      return { x: rect.left + (node.x - T.camX) * T.ZOOM, y: rect.top + node.y * T.ZOOM, id: node.id, name: node.name };
    });
    await page.mouse.click(pos.x, pos.y);
    const r = await page.evaluate(() => ({ sel: window.__TEST__.selectedTargetId, label: document.getElementById('targetLabel').textContent }));
    assertEqual(r.sel, pos.id, 'the tapped node becomes the target');
    assertEqual(r.label, `TARGET: ${pos.name}`, 'the launch bar names it');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-172/173: the objective line walks find -> destroy -> attack Omega, and recon buttons pulse while finding', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      const read = () => { T.updateObjectiveHud(); return document.getElementById('objectiveHud').textContent; };
      const pulsing = () => !!document.querySelector('.launchBtn[data-type="drone"].nextStep');
      const nodes = [...T.antiPlaneNodes, ...T.seekDestroyNodes];
      nodes.forEach((n) => { n.discovered = false; });
      const step1 = read(); const pulse1 = pulsing();
      nodes.forEach((n) => { n.discovered = true; });
      const step2 = read(); const pulse2 = pulsing();
      nodes.forEach((n) => { n.destroyed = true; });
      const step3 = read();
      return { step1, pulse1, step2, pulse2, step3 };
    });
    assert(r.step1.startsWith('STEP 1/3 · FIND THE FORWARD DEFENSES 0/5'), r.step1);
    assert(r.pulse1, 'DRONE pulses while there is something to find');
    assert(r.step2.startsWith('STEP 2/3 · DESTROY THE FORWARD DEFENSES (5 LEFT)'), r.step2);
    assert(!r.pulse2, 'the recon pulse stops once everything is found');
    assertEqual(r.step3, 'STEP 3/3 · ATTACK NODE OMEGA — FULL DAMAGE', 'step 3');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-172: each Omega rebuild hides a fresh set of forward defenses', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.clearForwardDefenses();
      const before = T.forwardDefensesStanding;
      let rebuilt = false;
      for (let i = 0; i < 50 && !rebuilt; i++) rebuilt = T.forceOmegaDamage(100000);
      const nodes = [...T.antiPlaneNodes, ...T.seekDestroyNodes];
      return { before, rebuilt, after: T.forwardDefensesStanding, hidden: nodes.filter((n) => !n.discovered).length,
        sel: T.selectedTargetId };
    });
    assertEqual(r.before, 0, 'all cleared before the kill');
    assert(r.rebuilt, 'Omega was destroyed and rebuilt');
    assertEqual(r.after, 5, 'five new forward defenses stand after the rebuild');
    assert(r.hidden >= 3, `the new set starts hidden (radar defenses only show with a Satellite): ${r.hidden}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-172: on a phone the contact list starts collapsed and a tap on a found node still targets it', async () => {
  await withGame(async (page, errors) => {
    const pos = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const node = T.antiPlaneNodes[0];
      node.discovered = true;
      T.setCamX(node.x - (window.innerWidth / T.ZOOM) / 2);
      const rect = document.getElementById('game').getBoundingClientRect();
      return { x: rect.left + (node.x - T.camX) * T.ZOOM, y: rect.top + node.y * T.ZOOM, id: node.id,
        listShown: !!document.getElementById('contactList').offsetParent };
    });
    await page.mouse.click(pos.x, pos.y);
    const sel = await page.evaluate(() => window.__TEST__.selectedTargetId);
    await page.click('#contacts h3');
    const opened = await page.evaluate(() => !!document.getElementById('contactList').offsetParent);
    assert(!pos.listShown, 'the contact list starts collapsed on a phone');
    assertEqual(sel, pos.id, 'tapping the radar defense targets it');
    assert(opened, 'tapping RADAR LANE opens the list');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { viewport: { width: 390, height: 844 } });
});

test('LRNA-172: a tap on the RADAR LANE panel\'s empty space reaches a forward defense under it', async () => {
  await withGame(async (page, errors) => {
    const pos = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const node = T.antiPlaneNodes[0];
      node.discovered = true;
      const panel = document.getElementById('contacts').getBoundingClientRect();
      const rect = document.getElementById('game').getBoundingClientRect();
      // put the node under the panel's bottom-left padding, clear of its header and lane dots
      const sx = panel.left + 4, sy = panel.bottom - 3;
      T.setCamX(node.x - (sx - rect.left) / T.ZOOM);
      node.y = (sy - rect.top) / T.ZOOM;
      const el = document.elementFromPoint(sx, sy);
      return { x: sx, y: sy, id: node.id, onPanel: document.getElementById('contacts').contains(el) };
    });
    await page.mouse.click(pos.x, pos.y);
    const sel = await page.evaluate(() => window.__TEST__.selectedTargetId);
    assert(pos.onPanel, 'the tap point is on the panel');
    assertEqual(sel, pos.id, 'the tap still targets the defense under the panel');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { viewport: { width: 390, height: 844 } });
});

test('LRNA-174: the start screen lists the missions with saved stars', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => localStorage.setItem('lrna_mission_stars_v1', JSON.stringify({ 'blind-the-radar': 2 })));
    await page.reload();
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => Array.from(document.querySelectorAll('#missionList .missionBtn')).map((b) => ({
      id: b.dataset.mission, stars: b.querySelector('.mStars').textContent })));
    assertEqual(r.length, 6, 'six missions listed');
    assertEqual(r.find((m) => m.id === 'blind-the-radar').stars, '★★☆', 'saved stars shown');
    assertEqual(r.find((m) => m.id === 'first-contact').stars, '☆☆☆', 'unplayed mission shows empty stars');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-174: BLIND THE RADAR completes when both radar defenses fall, with stars saved', async () => {
  await withGame(async (page, errors) => {
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="blind-the-radar"]');
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.updateObjectiveHud();
      const hudStart = document.getElementById('objectiveHud').textContent;
      T.damageNode('ap0', 1000);
      T.tickUpdate(0.05);
      const mid = { active: !!T.activeMission, hud: document.getElementById('objectiveHud').textContent };
      T.damageNode('ap1', 1000);
      T.tickUpdate(0.05);
      return { hudStart, mid, active: !!T.activeMission, running: T.running,
        title: document.getElementById('waveResultTitle').textContent,
        body: document.getElementById('waveResultBody').textContent,
        saved: JSON.parse(localStorage.getItem('lrna_mission_stars_v1') || '{}') };
    });
    assert(r.hudStart.startsWith('MISSION · BLIND THE RADAR · RADAR DEFENSES 0/2'), r.hudStart);
    assert(r.mid.active && r.mid.hud.includes('RADAR DEFENSES 1/2'), `one down, still running: ${JSON.stringify(r.mid)}`);
    assert(!r.active && !r.running, 'the mission ends when the second one falls');
    assertEqual(r.title, 'MISSION COMPLETE', 'result title');
    assert(r.body.includes('★★★'), `a quick finish earns 3 stars: ${r.body}`);
    assertEqual(r.saved['blind-the-radar'], 3, 'stars saved');
    await page.click('#waveResultClose');
    const listStars = await page.$eval('.missionBtn[data-mission="blind-the-radar"] .mStars', (e) => e.textContent);
    assertEqual(listStars, '★★★', 'the list shows the new best');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-174: running out of time fails the mission and saves nothing', async () => {
  await withGame(async (page, errors) => {
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="first-contact"]');
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.missionStats.time = 149.99;
      T.tickUpdate(0.05);
      return { title: document.getElementById('waveResultTitle').textContent,
        body: document.getElementById('waveResultBody').textContent, running: T.running,
        saved: localStorage.getItem('lrna_mission_stars_v1') };
    });
    assertEqual(r.title, 'MISSION FAILED', 'result title');
    assert(r.body.includes('Out of time.'), r.body);
    assert(!r.running, 'the game stops');
    assertEqual(r.saved, null, 'no stars saved for a failed mission');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-174: mission setups - HOLD THE LINE skips recon, NO SAFETY NET has no Emergency Counters; endless clears the mission', async () => {
  await withGame(async (page, errors) => {
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="hold-the-line"]');
    await page.waitForTimeout(200);
    const hold = await page.evaluate(() => ({ locked: window.__TEST__.openingLocked }));
    await page.evaluate(() => { window.__TEST__.missionStats.time = 0; });
    await page.keyboard.press('r');  // restart keeps the mission and its setup
    const afterR = await page.evaluate(() => ({ mission: window.__TEST__.activeMission?.id, locked: window.__TEST__.openingLocked }));
    await page.evaluate(() => window.__TEST__.missionStats.wavesCleared = 5);
    await page.waitForTimeout(200);
    await page.click('#waveResultClose');
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="no-safety-net"]');
    await page.waitForTimeout(200);
    const net = await page.evaluate(() => ({ emergency: window.__TEST__.counterAmmo.emergency,
      badge: document.getElementById('emergencyAmmo').textContent }));
    await page.evaluate(() => { const T = window.__TEST__; T.missionStats.omegaKills = 1; });
    await page.waitForTimeout(200);
    await page.click('#waveResultClose');
    await page.click('#startGameBtn');
    await page.waitForTimeout(200);
    const endless = await page.evaluate(() => { window.__TEST__.updateObjectiveHud();
      return { mission: window.__TEST__.activeMission, hud: document.getElementById('objectiveHud').textContent }; });
    assert(!hold.locked, 'HOLD THE LINE starts with attacks unlocked');
    assertEqual(afterR.mission, 'hold-the-line', 'R restarts the same mission');
    assert(!afterR.locked, 'and re-applies its setup');
    assertEqual(net.emergency, 0, 'NO SAFETY NET starts with no Emergency Counters');
    assertEqual(net.badge, 'NONE LEFT', 'its badge says so');
    assertEqual(endless.mission, null, 'PLAY ENDLESS runs no mission');
    assert(endless.hud.startsWith('STEP 1/3'), `endless shows the recon steps again: ${endless.hud}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-162: the Counter Operations bar holds only the two lanes - no recon lists', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      for (const n of T.seekDestroyNodes) n.discovered = true; // discovery would have filled the old lists
      for (const n of T.antiPlaneNodes) n.discovered = true;
      const bar = document.getElementById('counterOpsBar');
      return {
        children: Array.from(bar.children).map((el) => el.id),
        goneIds: ['counterOpsBarRecon', 'missionMapReconStatus', 'missionMapReconList', 'knownThreatsList']
          .filter((id) => document.getElementById(id)),
        attackDroneButtons: bar.querySelectorAll('[data-sd], [data-ap]').length,
      };
    });
    await page.waitForTimeout(100); // a few frames of the render loop with every node discovered
    assertEqual(JSON.stringify(r.children), JSON.stringify(['missionMapStrip', 'counterLaneRow']), 'the bar should contain just the zone strip and the Counter Lane');
    assertEqual(r.goneIds.length, 0, `these recon elements should no longer exist: ${r.goneIds}`);
    assertEqual(r.attackDroneButtons, 0, 'no per-node Attack Drone buttons should render in the bar');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-158: STATS carries GAME MODE/RUN STATS/TARGETS and drops every now-dead duplicate control', async () => {
  await withGame(async (page, errors) => {
    await menuClick(page, 'statsBtn');
    const result = await page.evaluate(() => {
      const mm = document.getElementById('missionMapWindow');
      const inside = (id) => mm.contains(document.getElementById(id));
      const visible = (id) => !!document.getElementById(id).offsetParent;
      return {
        opsCenterPanelGone: !document.getElementById('opsCenterPanel'),
        missionMapOpenBtnGone: !document.getElementById('missionMapOpenBtn'),
        reconDroneBtnGone: !document.getElementById('reconDroneBtn'),
        missionMapReconBtnGone: !document.getElementById('missionMapReconBtn'), // LRNA-158: the bottom bar's own DRONE button already covers this
        upgradeListGone: !document.getElementById('upgradeList'), // LRNA-159: Reactor Upgrades removed entirely
        counterPlanesWindowGone: !document.getElementById('counterPlanesWindow'), // LRNA-160: Counter Attack Planes fires directly now
        siegeGone: ['siegeToggleBtn', 'siegeTimer', 'siegeResult'].every((id) => !document.getElementById(id)), // LRNA-157: Siege Mode removed
        allInsideStats: ['modeStatus', 'statsList', 'targetList'].every(inside),
        allVisible: ['modeStatus', 'statsList', 'targetList'].every(visible),
      };
    });
    assert(result.opsCenterPanelGone, '#opsCenterPanel should no longer exist in the DOM');
    assert(result.missionMapOpenBtnGone, 'the OPEN MISSION MAP bridge button should no longer exist');
    assert(result.reconDroneBtnGone, 'the standalone #reconDroneBtn duplicate should no longer exist');
    assert(result.missionMapReconBtnGone, 'the merged-window RECON DRONE button should no longer exist - the bottom bar DRONE button already covers it');
    assert(result.upgradeListGone, '#upgradeList should no longer exist - LRNA-159 removed Reactor Upgrades entirely');
    assert(result.counterPlanesWindowGone, '#counterPlanesWindow should no longer exist - LRNA-160 made Counter Attack Planes fire directly');
    assert(result.siegeGone, 'the START SIEGE button, siege timer and siege result screen should no longer exist - LRNA-157 removed Siege Mode');
    assert(result.allInsideStats, 'GAME MODE/RUN STATS/TARGETS should all now live inside #missionMapWindow');
    assert(result.allVisible, 'the STATS sections should actually render visible once open, not just exist hidden in the DOM');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-158/156: the bottom bar DRONE button fires with STATS closed, and is held while STATS pauses the battle', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(async () => {
      const T = window.__TEST__;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      T.tokens.intel = 99999;
      const dronesBefore = T.missiles.filter((m) => m.typeKey === 'drone').length;
      document.querySelector('.launchBtn[data-type="drone"]').click();
      const dronesAfterClosed = T.missiles.filter((m) => m.typeKey === 'drone').length;
      T.clearMissiles();
      T.openMissionMap();
      await wait(360); // attemptFire's fire-rate cooldown is keyed on real wall-clock time
      document.querySelector('.launchBtn[data-type="drone"]').click();
      const dronesAfterOpen = T.missiles.filter((m) => m.typeKey === 'drone').length;
      T.closeMissionMap();
      await wait(360);
      document.querySelector('.launchBtn[data-type="drone"]').click();
      const dronesAfterClose = T.missiles.filter((m) => m.typeKey === 'drone').length;
      return { dronesBefore, dronesAfterClosed, dronesAfterOpen, dronesAfterClose };
    });
    assertEqual(result.dronesAfterClosed - result.dronesBefore, 1, 'DRONE should fire with STATS closed');
    assertEqual(result.dronesAfterOpen, 0, 'DRONE should not fire while STATS has the battle paused (LRNA-156)');
    assertEqual(result.dronesAfterClose, 1, 'DRONE should fire again once STATS is closed');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-159: Reactor Upgrades removed entirely - no UI remnants, and every mechanic it used to boost is back to its plain base value', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(async () => {
      const T = window.__TEST__;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      T.tokens.attack = 99999;
      T.forceOpeningUnlock();
      T.freezeWaves();
      T.clearMissiles();

      // no damage multiplier: a FAST warhead deals exactly its base TYPES.fast.dmg
      const m = T.launchAttack(T.nodeA, T.nodeO, 'fast');

      // no +1 active-shot cap from the old Ammo Bay upgrade: MAX_ACTIVE (3) blocks a 4th.
      // attemptFire's fire-rate cooldown is keyed on real wall-clock time
      // (performance.now()), not simulated dt, so wait real milliseconds
      // between attempts rather than calling it in a tight synchronous loop.
      T.clearMissiles();
      for (let i = 0; i < 3; i++) { T.attemptFire('fast'); await wait(360); }
      const activeAtCap = T.missiles.filter(mm => mm.originId === 'A').length;
      T.attemptFire('fast');
      const activeAfterOneMore = T.missiles.filter(mm => mm.originId === 'A').length;

      // no +1 Intel/sec from the old Reactor Boost upgrade
      const intelBefore = T.tokens.intel;
      T.tickUpdate(1);
      const intelGain = T.tokens.intel - intelBefore;

      return {
        dmg: m.dmg,
        activeAtCap, activeAfterOneMore,
        intelGain,
        upgradeListGone: !document.getElementById('upgradeList'),
        dataUpgradeGone: !document.querySelector('[data-upgrade]'),
      };
    });
    assertEqual(result.dmg, 50, `FAST warhead damage should be its plain base value (TYPES.fast.dmg = 50), no Overcharged Warheads multiplier: got ${result.dmg}`);
    assertEqual(result.activeAtCap, 3, 'active-shot cap should be the plain MAX_ACTIVE (3), no Expanded Ammo Bay bonus');
    assertEqual(result.activeAfterOneMore, 3, 'a 4th shot should still be refused at the plain cap');
    // LRNA-166 lowered TOKEN_PASSIVE_RATE from 100/s to 20/s
    assert(Math.abs(result.intelGain - 20) < 1, `Intel should accrue at the plain TOKEN_PASSIVE_RATE (20/s), no Reactor Boost bonus: got ${result.intelGain}/s`);
    assert(result.upgradeListGone, '#upgradeList should not exist anywhere in the DOM');
    assert(result.dataUpgradeGone, 'no [data-upgrade] button should exist anywhere in the DOM');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-084: the zone strip reflects each SEEK AND DESTROY zone\'s real bounds and updates on discovery', async () => {
  await withGame(async (page, errors) => {
    const before = await page.evaluate(() => {
      const T = window.__TEST__;
      T.openMissionMap();
      const zoneEls = Array.from(document.getElementById('missionMapZones').children);
      return {
        count: zoneEls.length,
        lefts: zoneEls.map(el => parseFloat(el.style.left)),
        expectedLefts: T.seekDestroyNodes.map(n => T.missionMapPct(n.zoneStart)),
        anyDiscoveredClass: zoneEls.some(el => el.classList.contains('discovered')),
      };
    });
    assertEqual(before.count, 3, 'the strip should carry a band for each of the 3 SEEK AND DESTROY zones');
    before.lefts.forEach((left, i) => {
      assert(Math.abs(left - before.expectedLefts[i]) < 0.01,
        `zone ${i} should be positioned at its own real zoneStart, mapped to the strip: got ${left}%, expected ${before.expectedLefts[i]}%`);
    });
    assert(!before.anyDiscoveredClass, 'no zone should read as discovered on a fresh game');

    const after = await page.evaluate(() => {
      const T = window.__TEST__;
      T.seekDestroyNodes[0].discovered = true;
      T.tickUpdate(0.016); // Mission Map re-renders itself every tick while open
      const zoneEls = Array.from(document.getElementById('missionMapZones').children);
      return { discoveredCount: zoneEls.filter(el => el.classList.contains('discovered')).length };
    });
    assertEqual(after.discoveredCount, 1, 'discovering a node should flip its own zone band to the discovered style');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-084: undiscovered AntiPlane nodes stay off the zone strip; discovered ones appear at their real position', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.openMissionMap();
      T.antiPlaneNodes[0].discovered = false;
      T.tickUpdate(0.016);
      const beforeCount = document.getElementById('missionMapMarkers').children.length;

      T.antiPlaneNodes[0].discovered = true;
      T.tickUpdate(0.016);
      const markerEls = Array.from(document.getElementById('missionMapMarkers').children);
      return {
        beforeCount,
        afterCount: markerEls.length,
        left: markerEls[0] && parseFloat(markerEls[0].style.left),
        expectedLeft: T.missionMapPct(T.antiPlaneNodes[0].x),
      };
    });
    assertEqual(result.beforeCount, 0, 'an undiscovered AntiPlane node must not leak its position onto the strip');
    assertEqual(result.afterCount, 1, 'a discovered AntiPlane node should get a marker');
    assert(Math.abs(result.left - result.expectedLeft) < 0.01,
      `the marker should sit at the node's own real x position: got ${result.left}%, expected ${result.expectedLeft}%`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-051: Omega\'s enemy strikes draw from a symmetric missile/plane class, not just size', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      const classes = new Set();
      const labels = new Set();
      for (let i = 0; i < 40; i++) {
        const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
        classes.add(m.weaponClass);
        labels.add(m.label);
      }
      return { classes: Array.from(classes).sort(), labels: Array.from(labels).sort() };
    });
    assertEqual(JSON.stringify(result.classes), JSON.stringify(['missile', 'plane']), `40 launches should produce both classes: ${JSON.stringify(result.classes)}`);
    assertEqual(JSON.stringify(result.labels), JSON.stringify(['BOMBER', 'STRIKE']), `label should reflect the weapon class: ${JSON.stringify(result.labels)}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-051: plane-classed enemy strikes are still engaged by size-based defenses same as missile-classed ones', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      // force a plane-classed strike by retrying until one lands (class is
      // random) - both classes must still be engageable by the exact same
      // sizeKey-based defense logic, since weaponClass is flavor-only.
      let m;
      for (let i = 0; i < 50; i++) {
        m = T.launchEnemyStrike(T.nodeO, T.nodeA);
        if (m.weaponClass === 'plane') break;
        T.removeMissile(m.id);
      }
      m.sizeKey = 'medium';
      m.age = 2;
      for (const n of T.loadoutNodes) n.fireTimer = 0;
      T.tickLoadoutNodes(0.016);
      const engaged = T.missiles.some(c => c.typeKey === 'counter' && c.source === 'loadout' && c.seekTargetId === m.id);
      return { foundPlaneClass: m.weaponClass === 'plane', engaged };
    });
    assert(result.foundPlaneClass, 'sanity check - should have found a plane-classed strike within 50 tries');
    assert(result.engaged, 'a plane-classed strike should be engaged by loadout defenses exactly like a missile-classed one (weaponClass is flavor-only)');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-086: firing a shot triggers boost-window camera shake', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.forceOpeningUnlock();
      T.tokens.attack = 99999;
      const before = { mag: T.camShakeMag, timer: T.camShakeTimer };
      T.attemptFire('fast');
      const after = { mag: T.camShakeMag, timer: T.camShakeTimer };
      return { before, after };
    });
    assertEqual(result.before.mag, 0, 'no shake before firing anything');
    assert(result.after.mag > 0 && result.after.timer > 0, `firing should trigger a launch shake: ${JSON.stringify(result.after)}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-086: the followed contact resolving triggers a fresh impact shake', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      T.neutralizeAutoDefense(); // don't let AM batteries/loadout nodes resolve this early for an unrelated reason
      const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
      T.setFollowId(m.id);
      // let the launch shake fully decay first, so the next shake we see
      // can only be the impact one, not a leftover from launch.
      T.tickUpdate(1); // well past CAM_SHAKE_LAUNCH_DURATION (0.25s)
      const beforeImpact = { mag: T.camShakeMag, timer: T.camShakeTimer };
      // resolve it through the real arrival path (not a manual removal,
      // which happens outside update(dt) and so can't be "seen" by the
      // same-frame before/after check the impact shake relies on).
      m.age = m.totalSeconds;
      T.tickUpdate(0.05);
      const afterImpact = { mag: T.camShakeMag, timer: T.camShakeTimer, stillTracked: T.missiles.some(mm => mm.id === m.id) };
      return { beforeImpact, afterImpact };
    });
    assertEqual(result.beforeImpact.mag, 0, `launch shake should have fully decayed by t=1s: ${JSON.stringify(result.beforeImpact)}`);
    assert(!result.afterImpact.stillTracked, 'sanity check - the strike should have actually resolved (arrived) by now');
    assert(result.afterImpact.mag > 0 && result.afterImpact.timer > 0,
      `the followed contact resolving should trigger a fresh impact shake: ${JSON.stringify(result.afterImpact)}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-087: a fast-moving missile spawns speed-line streak particles, a slow one doesn\'t', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      T.clearParticles();
      T.neutralizeAutoDefense(); // AM batteries' own cannon fire also spawns `tracer:true` particles - keep this test isolated to the missile's own speed-line trail
      const fast = T.launchEnemyStrike(T.nodeO, T.nodeA);
      fast.vx = 900; // well above the 500 threshold
      fast.smokeTimer = 0;
      fast.age = 1;
      T.tickUpdate(0.05);
      const tracersAfterFast = T.particles.filter(p => p.tracer).length;

      T.clearMissiles(); // the still-fast `fast` missile would otherwise keep re-triggering its own (legitimate) speed-line on later ticks, contaminating the slow case's count
      T.clearParticles();
      const slow = T.launchEnemyStrike(T.nodeO, T.nodeA);
      slow.vx = 100; // well below the threshold
      slow.smokeTimer = 0;
      slow.age = 1;
      T.tickUpdate(0.05);
      const tracersAfterSlow = T.particles.filter(p => p.tracer).length;

      return { tracersAfterFast, tracersAfterSlow };
    });
    assert(result.tracersAfterFast > 0, `a fast (900) missile should spawn a speed-line streak: ${JSON.stringify(result)}`);
    assertEqual(result.tracersAfterSlow, 0, `a slow (100) missile should not spawn a speed-line streak: ${JSON.stringify(result)}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-10: the home screen is PLAY + MISSIONS on a solid backdrop and fits one screen', async () => {
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await withGame(async (page, errors) => {
      const r = await page.evaluate(() => {
        const ov = document.getElementById('overlay');
        const visible = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent);
        const big = visible('#overlay .mBtn').map((b) => b.textContent.trim());
        const controls = visible('#overlay button, #overlay select').length;
        // a solid backdrop: the overlay itself is what sits under each corner, not the HUD
        const corners = [[2, 2], [innerWidth - 3, 2], [2, innerHeight - 3], [innerWidth - 3, innerHeight - 3]]
          .map(([x, y]) => ov.contains(document.elementFromPoint(x, y)));
        return { big, controls, scrolls: ov.scrollHeight > ov.clientHeight, corners,
          lore: !!document.querySelector('#overlay .tag, #overlay .featuring, #entrance, #loadout') };
      });
      const size = `${viewport.width}x${viewport.height}`;
      assertEqual(JSON.stringify(r.big), JSON.stringify(['PLAY', 'MISSIONS']), `${size}: the two main buttons`);
      assert(r.controls <= 4, `${size}: home has at most 4 controls (was 13): ${r.controls}`);
      assert(!r.scrolls, `${size}: home fits without scrolling`);
      assert(r.corners.every(Boolean), `${size}: the menu covers the screen: ${JSON.stringify(r.corners)}`);
      assert(!r.lore, `${size}: the old lore text, chips and ENTRANCE box are gone`);
      assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
    }, { viewport, skipStart: true });
  }
});

test('ART-10..13: menu screens open from home, BACK and Esc return, and a finished run lands on home', async () => {
  await withGame(async (page, errors) => {
    const shown = () => page.evaluate(() => [...document.querySelectorAll('#overlay .menuScreen')]
      .filter((s) => !s.hidden).map((s) => s.dataset.menu).join(','));
    const seen = {};
    for (const name of ['setup', 'missions', 'howto']) {
      await page.click(`#menuHome [data-goto="${name}"]`);
      seen[name] = await shown();
      await page.click(`#overlay .menuScreen[data-menu="${name}"] .mHead [data-goto="home"]`);
      seen[name + 'Back'] = await shown();
    }
    await page.click('#missionsBtn');
    await page.keyboard.press('Escape');
    seen.esc = await shown();
    await page.click('#menuHome [data-goto="howto"]');
    const howto = await page.$eval('#menuHowto', (e) => e.innerText);
    await page.click('#menuHowto [data-goto="home"]');
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="first-contact"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => { const T = window.__TEST__; T.freezeWaves(); T.missionStats.time = 149.99; T.tickUpdate(0.05); });
    await page.click('#waveResultClose');
    seen.afterRun = await shown();
    for (const name of ['setup', 'missions', 'howto']) {
      assertEqual(seen[name], name, `${name} opens on its own`);
      assertEqual(seen[name + 'Back'], 'home', `BACK from ${name}`);
    }
    assertEqual(seen.esc, 'home', 'Esc goes back home');
    assertEqual(seen.afterRun, 'home', 'closing a result shows the home screen');
    for (const word of ['FIND', 'DESTROY', 'ATTACK', 'DEFEND', 'CURRENCY', 'CONTROLS']) assert(howto.includes(word), `how to play covers ${word}`);
    assert(howto.length < 1400, `how to play stays short: ${howto.length} chars`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('ART-11: setup changes show on the home summary line, with each slot\'s role under its pick', async () => {
  await withGame(async (page, errors) => {
    const before = await page.$eval('#setupSummary', (e) => e.textContent);
    await page.click('#menuHome [data-goto="setup"]');
    await page.click('.difficultyBtn[data-difficulty="hard"]');
    await page.selectOption('.loadoutSelect[data-slot="1"]', 'satellite');
    const r = await page.evaluate(() => ({
      options: [...document.querySelectorAll('.loadoutSelect[data-slot="0"] option')].map((o) => o.textContent),
      role1: document.querySelector('.slotRole[data-role="1"]').textContent,
    }));
    await page.click('#menuSetup .mBtn[data-goto="home"]');
    const after = await page.$eval('#setupSummary', (e) => e.textContent);
    await page.reload();
    await page.waitForTimeout(300);
    const reloaded = await page.$eval('#setupSummary', (e) => e.textContent);
    assertEqual(before, 'NORMAL · GML / MG AA / CTR BTY', 'default summary');
    assertEqual(after, 'HARD · GML / SAT / CTR BTY', 'summary follows the picks');
    assertEqual(reloaded, after, 'and survives a reload');
    assert(r.options.every((t) => !t.includes('—')), `options are plain names now: ${r.options.join(', ')}`);
    assert(r.role1.length > 5, `the role line describes the pick: ${r.role1}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('ART-12: home shows the mission stars total', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => localStorage.setItem('lrna_mission_stars_v1', JSON.stringify({ 'blind-the-radar': 2, 'first-contact': 3 })));
    await page.reload();
    await page.waitForTimeout(300);
    assertEqual(await page.$eval('#missionStarsTotal', (e) => e.textContent), '5/18', 'stars total');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('ART-14: one MENU button pauses the battle and holds RESUME, STATS, SOUND, RESTART and QUIT', async () => {
  await withGame(async (page, errors) => {
    const r0 = await page.evaluate(() => ({
      oldGone: ['pauseBtn', 'pausedBanner'].every((id) => !document.getElementById(id)),
      floating: ['statsBtn', 'muteBtn'].map((id) => !!document.getElementById(id).offsetParent),
    }));
    await page.keyboard.press('Escape');
    const open = await page.evaluate(() => ({
      menu: window.__TEST__.gameMenuOpen, paused: window.__TEST__.paused,
      items: [...document.querySelectorAll('#gameMenu .mBtn')].map((b) => b.textContent),
      title: document.getElementById('gameMenuTitle').textContent,
    }));
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => ({ menu: window.__TEST__.gameMenuOpen, paused: window.__TEST__.paused }));
    // RESTART: a fresh run that isn't paused
    await page.evaluate(() => { const T = window.__TEST__; T.tokens.attack = 1; });
    await menuClick(page, 'menuRestart');
    const restarted = await page.evaluate(() => ({ menu: window.__TEST__.gameMenuOpen, paused: window.__TEST__.paused,
      running: window.__TEST__.running, attack: window.__TEST__.tokens.attack }));
    await menuClick(page, 'menuQuit');
    const quit = await page.evaluate(() => ({ running: window.__TEST__.running, paused: window.__TEST__.paused,
      overlay: !document.getElementById('overlay').classList.contains('hidden'),
      home: !document.getElementById('menuHome').hidden, menu: window.__TEST__.gameMenuOpen }));
    assert(r0.oldGone, 'the separate PAUSE button and PAUSED banner are gone');
    assert(r0.floating.every((v) => !v), 'STATS and SOUND no longer float over the battlefield');
    assert(open.menu && open.paused, `Esc opens the menu and pauses: ${JSON.stringify(open)}`);
    assertEqual(open.items.join(','), 'RESUME,STATS,SOUND: ON,RESTART,QUIT TO MENU', 'menu items');
    assert(open.title.startsWith('ENDLESS · WAVE'), `the menu says what is being played: ${open.title}`);
    assert(!closed.menu && !closed.paused, 'Esc again resumes');
    assert(!restarted.menu && !restarted.paused && restarted.running && restarted.attack > 1, `RESTART starts a fresh run: ${JSON.stringify(restarted)}`);
    assert(!quit.running && !quit.paused && quit.overlay && quit.home && !quit.menu, `QUIT goes to the home screen: ${JSON.stringify(quit)}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-14: on a phone the MENU button stays clear of the HUD and the menu fits', async () => {
  await withGame(async (page, errors) => {
    await page.click('#menuBtn');
    const r = await page.evaluate(() => {
      const panel = document.querySelector('#gameMenu .gmPanel').getBoundingClientRect();
      return { fits: panel.top >= 0 && panel.bottom <= innerHeight && panel.left >= 0 && panel.right <= innerWidth };
    });
    assert(r.fits, 'the menu panel fits on a 390x844 screen');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { viewport: { width: 390, height: 844 } });
});

test('ART-15: an endless run ends on one result layout with RETRY and MENU', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => { window.__TEST__.setPaused(false); });
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.triggerRunEnd();
      const vis = (id) => !document.getElementById(id).hidden && !!document.getElementById(id).offsetParent;
      return { kind: document.getElementById('resultKind').textContent, title: document.getElementById('waveResultTitle').textContent,
        head: document.querySelector('#waveResultBody .rHead').textContent, rows: document.querySelectorAll('#waveResultBody dt').length,
        retry: vis('resultRetry'), next: vis('resultNext'), menu: document.getElementById('waveResultClose').textContent };
    });
    await page.click('#resultRetry');
    const again = await page.evaluate(() => ({ running: window.__TEST__.running, mission: window.__TEST__.activeMission,
      result: !document.getElementById('waveResultScreen').classList.contains('hidden') }));
    assertEqual(r.kind, 'ENDLESS', 'kind line');
    assertEqual(r.title, 'STRIKE PLATFORM LOST', 'endless title');
    assert(/^WAVE \d+$/.test(r.head), `the wave reached is the headline: ${r.head}`);
    assert(r.rows >= 3 && r.rows <= 4, `3-4 stat lines: ${r.rows}`);
    assert(r.retry && !r.next && r.menu === 'MENU', `RETRY and MENU, no NEXT MISSION: ${JSON.stringify(r)}`);
    assert(again.running && !again.mission && !again.result, `RETRY starts a new endless run: ${JSON.stringify(again)}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-15: a mission win offers NEXT MISSION, RETRY replays the same mission', async () => {
  await withGame(async (page, errors) => {
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="blind-the-radar"]');
    await page.waitForTimeout(150);
    const win = async () => page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.damageNode('ap0', 1000); T.damageNode('ap1', 1000); T.tickUpdate(0.05);
      return { title: document.getElementById('waveResultTitle').textContent,
        next: !document.getElementById('resultNext').hidden };
    });
    const first = await win();
    await page.click('#resultRetry');
    const retried = await page.evaluate(() => window.__TEST__.activeMission?.id);
    await win();
    await page.click('#resultNext');
    const next = await page.evaluate(() => window.__TEST__.activeMission?.id);
    // the last mission has no NEXT
    await page.evaluate(() => { const T = window.__TEST__; T.missionStats.time = 0; });
    await page.keyboard.press('Escape');
    await page.click('#menuQuit');
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="no-safety-net"]');
    await page.waitForTimeout(150);
    const last = await page.evaluate(() => { const T = window.__TEST__; T.missionStats.omegaKills = 1; T.tickUpdate(0.05);
      return { title: document.getElementById('waveResultTitle').textContent, next: !document.getElementById('resultNext').hidden }; });
    assertEqual(first.title, 'MISSION COMPLETE', 'won');
    assert(first.next, 'NEXT MISSION shows after a win');
    assertEqual(retried, 'blind-the-radar', 'RETRY replays the same mission');
    assertEqual(next, 'break-the-line', 'NEXT MISSION starts mission 3');
    assertEqual(last.title, 'MISSION COMPLETE', 'last mission won');
    assert(!last.next, 'the last mission has no NEXT MISSION');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

run();
