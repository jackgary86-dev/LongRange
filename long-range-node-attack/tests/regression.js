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

function advance(T, seconds, step = 0.05) {
  const steps = Math.round(seconds / step);
  for (let i = 0; i < steps; i++) T.tickUpdate(step);
}

test('LRNA-123: planes complete their flight and land (no NaN-velocity stuck planes)', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.firePlane('strikeFighter'); // 10s outbound + 10s return = ~20s round trip
      return { firedCount: T.missiles.filter(m => m.typeKey === 'plane').length };
    });
    assert(result.firedCount === 1, 'plane should have launched');

    await page.evaluate((secs) => {
      const T = window.__TEST__;
      for (let i = 0; i < secs / 0.05; i++) T.tickUpdate(0.05);
    }, 25); // outlasts the full round trip

    const after = await page.evaluate(() => {
      const T = window.__TEST__;
      return {
        planesRemaining: T.missiles.filter(m => m.typeKey === 'plane').length,
        stuckWithBadVelocity: T.missiles.filter(m => m.typeKey === 'plane' && !isFinite(m.vx)).length,
      };
    });
    assertEqual(after.planesRemaining, 0, 'plane should have landed and been removed after its full round trip');
    assertEqual(after.stuckWithBadVelocity, 0, 'no plane should have NaN/invalid velocity');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-124: Satellite can only be selected in one loadout slot at a time', async () => {
  await withGame(async (page) => {
    // the loadout selects only exist on the pre-start screen
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
        x: T.nodeA.x, laneY: 0, vx: -1, totalSeconds: def.eta, age: 18, phase: 'returning',
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
    assert(/CM READY/.test(result.readyHtml), `expected "CM READY" while off cooldown, got: ${result.readyHtml}`);
    assert(/CM 0:0?4/.test(result.cooldownHtml), `expected a countdown while on cooldown, got: ${result.cooldownHtml}`);
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

test('LRNA-119: pause button freezes real-time simulation and blocks actions', async () => {
  await withGame(async (page, errors) => {
    // sanity: passive token income should accrue in real time before pausing
    const t0 = await page.evaluate(() => window.__TEST__.tokens.attack);
    await page.waitForTimeout(700);
    const t1 = await page.evaluate(() => window.__TEST__.tokens.attack);
    assert(t1 > t0, 'tokens should accrue in real time while unpaused');

    await page.click('#pauseBtn');
    const afterClick = await page.evaluate(() => ({
      paused: window.__TEST__.paused,
      bannerHidden: document.getElementById('pausedBanner').classList.contains('hidden'),
      btnLabel: document.getElementById('pauseBtn').textContent,
    }));
    assert(afterClick.paused, 'clicking PAUSE should actually pause the game');
    assert(!afterClick.bannerHidden, 'PAUSED banner should be visible');
    assertEqual(afterClick.btnLabel, 'RESUME', 'button should flip to RESUME while paused');

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

    await page.click('#pauseBtn');
    const afterResume = await page.evaluate(() => ({
      paused: window.__TEST__.paused,
      bannerHidden: document.getElementById('pausedBanner').classList.contains('hidden'),
      btnLabel: document.getElementById('pauseBtn').textContent,
    }));
    assert(!afterResume.paused, 'clicking RESUME should unpause');
    assert(afterResume.bannerHidden, 'PAUSED banner should hide again');
    assertEqual(afterResume.btnLabel, 'PAUSE');

    const firedAfterResume = await page.evaluate(() => {
      const T = window.__TEST__;
      T.attemptFire('fast');
      return T.missiles.filter(m => m.typeKey === 'fast').length;
    });
    assertEqual(firedAfterResume, 1, 'attemptFire should work normally again once resumed');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }); // NOT skipStart: relies on the real requestAnimationFrame loop and passive token income
});

run();
