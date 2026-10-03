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

test('LRNA-102/181: Omega\'s counter is capped at 2 attempts per target', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      const m = T.launchAttack(T.nodeA, T.nodeO, 'large');
      m.age = m.totalSeconds - 3; // inside the last-seconds window
      const usedOverTime = [];
      for (let i = 0; i < 6; i++) {
        T.setOmegaEmergencyCooldown(0);
        T.tickOmegaCounters(0.016);
        // drop any resulting shot so the next cycle can try again, isolating the cap
        T.missiles.splice(0, T.missiles.length, ...T.missiles.filter((mm) => mm.typeKey !== 'counter'));
        const target = T.missiles.find((mm) => mm.id === m.id);
        usedOverTime.push(target ? target.omegaEmergencyUsed || 0 : null);
      }
      return usedOverTime;
    });
    const maxUsed = Math.max(...result.filter((v) => v != null));
    assert(maxUsed <= 2, `omegaEmergencyUsed should never exceed 2, saw ${maxUsed}`);
    assert(result.filter((v) => v === 2).length >= 2, 'the cap should hold steady at 2 across later cycles');
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

test('LRNA-116/181: Omega\'s counter readiness is shown in the HUD', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.setOmegaEmergencyCooldown(0); // ready
      T.updateOmegaCountersHud();
      const readyHtml = document.getElementById('omegaCounterStatus').innerHTML;
      T.setOmegaEmergencyCooldown(4.2); // on cooldown
      T.updateOmegaCountersHud();
      const cooldownHtml = document.getElementById('omegaCounterStatus').innerHTML;
      return { readyHtml, cooldownHtml };
    });
    assert(/EC 15 READY/.test(result.readyHtml), `expected "EC 15 READY" while off cooldown, got: ${result.readyHtml}`);
    assert(/EC 15 0:0?4/.test(result.cooldownHtml), `expected a countdown while on cooldown, got: ${result.cooldownHtml}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
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

test('LRNA-119/ART-14: the in-game menu pause freezes real-time simulation and blocks actions', async () => {
  await withGame(async (page, errors) => {
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
      strike.defended = true; // keep the generic getDefender() auto-defend loop off it too
      // Emergency Counter only targets threats within EMERGENCY_WINDOW (5s)
      // of impact - fast-forward close to that without letting it land.
      const steps = Math.round((strike.totalSeconds - 3) / 0.05);
      for (let i = 0; i < steps; i++) T.tickUpdate(0.05);
      T.updateEmergencyBtn();
    });

    const desktop = await page.evaluate(() => ({
      emergency: document.getElementById('emergencyBtn').textContent,
    }));
    assert(desktop.emergency.includes('SPD') && desktop.emergency.includes('IMPACT'), 'desktop Emergency Counter text should stay fully descriptive');

    await page.setViewportSize({ width: 375, height: 800 });
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.updateEmergencyBtn();
    });
    const mobile = await page.evaluate(() => ({
      emergency: document.getElementById('emergencyBtn').textContent,
    }));
    assert(mobile.emergency.length < desktop.emergency.length, 'mobile Emergency Counter text should be shorter than the desktop version');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-137: EMP deals real damage on top of its jam effect', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.disableOmegaCounters();
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

test('LRNA-138: fresh players start with 500 ATTACK, not 1000', async () => {
  await withGame(async (page, errors) => {
    const tokens = await page.evaluate(() => window.__TEST__.tokens);
    // withGame waits ~200ms after clicking start before handing control
    // back, and passive income accrues the whole time (100/sec/category),
    // so allow a little headroom above the exact starting value.
    assert(tokens.attack >= 500 && tokens.attack < 550, `starting attack tokens should be ~500: got ${tokens.attack}`);
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

test('LRNA-165/181/185: the player gets 15 Emergency Counters per game, at any size of threat', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      T.neutralizeAutoDefense();
      T.disableOmegaCounters();
      const counters = () => T.missiles.filter(m => m.typeKey === 'counter' && m.source === 'emergency').length;
      const start = { ...T.counterAmmo };
      const sizes = ['fast', 'medium', 'large'];
      for (let i = 0; i < 20; i++) {
        const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
        m.sizeKey = sizes[i % 3];
        m.age = m.totalSeconds - 3;
      }
      for (let i = 0; i < 20; i++) { T.setEmergencyCooldown(0); T.fireEmergencyCounter(); }
      T.updateEmergencyBtn();
      const fastEngaged = T.missiles.some(c => c.typeKey === 'counter' && c.source === 'emergency' &&
        T.missiles.find(t => t.id === c.seekTargetId && t.sizeKey === 'fast'));
      return { start, fired: counters(), fastEngaged, badge: document.getElementById('emergencyAmmo').textContent,
        disabled: document.getElementById('emergencyBtn').disabled, end: { ...T.counterAmmo } };
    });
    assertEqual(JSON.stringify(result.start), JSON.stringify({ emergency: 15 }), 'a new game starts with 15 (LRNA-185)');
    assertEqual(result.fired, 15, 'only 15 can be fired');
    assert(result.fastEngaged, 'FAST threats can be countered too');
    assertEqual(result.badge, 'NONE LEFT', 'the button says none are left');
    assert(result.disabled, 'and is disabled');
    assertEqual(JSON.stringify(result.end), JSON.stringify({ emergency: 0 }), 'all used up');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-165/181/185: Omega gets the same 15 Emergency Counters', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.clearMissiles();
      const start = { ...T.omegaCounterAmmo };
      for (let i = 0; i < 20; i++) { const m = T.launchAttack(T.nodeA, T.nodeO, i % 2 ? 'fast' : 'medium'); m.age = m.totalSeconds - 3; }
      for (let i = 0; i < 30; i++) { T.setOmegaEmergencyCooldown(0); T.tickOmegaCounters(0.01); }
      T.updateOmegaCountersHud();
      return { start, fired: T.missiles.filter(m => m.typeKey === 'counter' && m.originId === 'O' && m.source === 'omegaEmergency').length,
        hud: document.getElementById('omegaCounterStatus').textContent, end: { ...T.omegaCounterAmmo } };
    });
    assertEqual(JSON.stringify(result.start), JSON.stringify({ emergency: 15 }), 'Omega starts with 15');
    assertEqual(result.fired, 15, 'Omega fires only 15');
    assertEqual(JSON.stringify(result.end), JSON.stringify({ emergency: 0 }), 'all used up');
    assert(/EC 0/.test(result.hud), `the HUD shows Omega is out: ${result.hud}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-165: a new game refills both sides\' counters', async () => {
  await withGame(async (page, errors) => {
    // leftovers as if from an earlier game, then a real START MISSION click
    await page.evaluate(() => {
      const T = window.__TEST__;
      T.counterAmmo.emergency = 1;
      T.omegaCounterAmmo.emergency = 0;
    });
    await page.click('#startGameBtn');
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
      return { player: { ...T.counterAmmo }, omega: { ...T.omegaCounterAmmo }, badge: document.getElementById('emergencyAmmo').textContent };
    });
    assertEqual(JSON.stringify(result.player), JSON.stringify({ emergency: 15 }), 'player refilled');
    assertEqual(JSON.stringify(result.omega), JSON.stringify({ emergency: 15 }), 'Omega refilled');
    assertEqual(result.badge, '15 LEFT', 'button badge refreshed');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-166: tokens reset each game instead of carrying over', async () => {
  await withGame(async (page, errors) => {
    // a big balance left over from an earlier game, then a real START
    await page.evaluate(() => { const T = window.__TEST__; T.tokens.attack = 50000; });
    await page.click('#startGameBtn');
    const t = await page.evaluate(() => ({ ...window.__TEST__.tokens }));
    for (const k of ['attack']) {
      assert(t[k] >= 500 && t[k] < 520, `${k} should restart at 500, not carry over: got ${t[k]}`);
    }
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-166/184: passive income is 35/s and a hit pays back a quarter of its damage', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
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
    assertEqual(result.rate, 35, 'passive income should be 35/s (LRNA-184)');
    assertEqual(result.ratio, 0.25, 'hits should pay back a quarter of their damage');
    assert(Math.abs(result.hitReward - 63) < 1, `a 250-damage MEDIUM hit should pay back 63 (was 250): got ${result.hitReward}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-143/175: CLUSTER and EMP are back on the bar once unlocked, on keys 5 and 6', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      T.tokens.attack = 5000;
      const visible = Array.from(document.querySelectorAll('#planeButtons-attack .launchBtn')).filter((b) => !b.hidden).length;
      return { visible, cluster: !document.querySelector('.launchBtn[data-type="cluster"]').hidden,
        emp: !document.querySelector('.launchBtn[data-type="emp"]').hidden };
    });
    await page.waitForTimeout(150); // the bar re-enables on the next frame
    await page.keyboard.press('5');
    await page.waitForTimeout(400);
    await page.keyboard.press('6');
    await page.waitForTimeout(100);
    const fired = await page.evaluate(() => window.__TEST__.missiles.filter((m) => m.originId === 'A').map((m) => m.typeKey));
    assert(r.cluster && r.emp, 'both buttons show when unlocked');
    assertEqual(r.visible, 11, 'all 3 missiles, CLUSTER, EMP, the 3 LRNA-177 missiles and the 3 planes');
    assert(fired.includes('cluster') && fired.includes('emp'), 'keys 5 and 6 fire them: ' + fired);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-179: each weapon explodes its own way', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const boom = (kind) => {
        T.clearParticles(); T.launchRings.length = 0; T.pendingFx.length = 0;
        T.spawnExplosion(1000, 300, '#ffffff', kind === 'large' ? 2.6 : kind === 'fast' ? 1 : 1.7, kind);
        const now = { smoke: T.particles.filter((p) => p.smoke).length, sparks: T.particles.filter((p) => p.tracer).length,
          rings: T.launchRings.length, pending: T.pendingFx.length, debris: T.particles.filter((p) => p.debris).length };
        for (let i = 0; i < 10; i++) T.tickUpdate(0.05); // 0.5s: the delayed blasts land
        return { ...now, ringsLater: T.launchRings.length, pendingLater: T.pendingFx.length };
      };
      return { fast: boom('fast'), medium: boom('medium'), large: boom('large'), buster: boom('buster'), heavy: boom('heavyBomber'), ghost: boom('ghost') };
    });
    assert(r.fast.sparks >= 14 && r.medium.sparks === 0, 'FAST cracks with sparks: ' + JSON.stringify(r.fast));
    assert(r.fast.smoke < r.medium.smoke / 2, 'FAST leaves little smoke');
    assertEqual(r.large.pending, 2, 'LONG RANGE: two follow-up blasts');
    assert(r.large.ringsLater > r.large.rings && r.large.pendingLater === 0, 'they land within half a second');
    assert(r.large.smoke > r.medium.smoke + 14, 'and a mushroom cap of smoke');
    assertEqual(r.buster.pending, 1, 'BUNKER BUSTER: the deep blast comes after');
    assert(r.buster.debris > r.medium.debris + 20, 'earth thrown straight up first');
    assert(r.buster.ringsLater >= r.buster.rings + 2, 'then the deep blast');
    assertEqual(r.heavy.pending, 4, 'HEAVY BOMBER: a line of 4 bombs');
    assertEqual(r.ghost.rings, r.medium.rings + 1, 'GHOST: a pale flash ring');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-179: Omega smokes from 75%, burns from 50% and shows its core from 25%', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.neutralizeAutoDefense(); T.disableOmegaCounters();
      const at = (frac) => {
        T.omegaHealthForTest = Math.floor(T.PLAYER_MAX_HEALTH * frac);
        T.clearParticles();
        for (let i = 0; i < 30; i++) T.tickUpdate(0.05);
        const fx = T.particles.filter((p) => p.omegaFx).map((p) => p.omegaFx);
        return { state: T.omegaDamageState(), smoke: fx.filter((f) => f === 'smoke').length, fire: fx.filter((f) => f === 'fire').length, spark: fx.filter((f) => f === 'spark').length };
      };
      return { full: at(1), s1: at(0.7), s2: at(0.45), s3: at(0.2) };
    });
    assertEqual(r.full.state, 0, 'untouched'); assertEqual(r.full.smoke + r.full.fire + r.full.spark, 0, 'no damage effects at full health');
    assertEqual(r.s1.state, 1, 'state 1'); assert(r.s1.smoke > 0 && r.s1.fire === 0, 'smoke only: ' + JSON.stringify(r.s1));
    assertEqual(r.s2.state, 2, 'state 2'); assert(r.s2.fire > 0 && r.s2.spark === 0, 'fires: ' + JSON.stringify(r.s2));
    assertEqual(r.s3.state, 3, 'state 3'); assert(r.s3.spark > 0, 'the core throws sparks: ' + JSON.stringify(r.s3));
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-179: an interceptor draws its path, and a kill leaves it on screen in its side\'s color', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.neutralizeAutoDefense(); T.disableOmegaCounters();
      const m = T.launchAttack(T.nodeA, T.nodeO, 'large');
      m.defended = true;
      for (let i = 0; i < 480; i++) T.tickUpdate(0.05); // 24s: close to Omega, inside an interceptor's reach
      const c = T.fireCounter({ id: 'O', x: T.nodeO.x, y: T.nodeO.y, hitChance: 1 }, m.id, 'omega');
      c.seekSuccess = true;
      let maxPath = 0;
      for (let i = 0; i < 200 && T.missiles.some((x) => x.id === c.id); i++) { T.tickUpdate(0.05); const cc = T.missiles.find((x) => x.id === c.id); if (cc && cc.path) maxPath = cc.path.length; }
      const trail = T.killTrails[0];
      const info = trail && { len: trail.path.length, color: trail.color };
      for (let i = 0; i < 40; i++) T.tickUpdate(0.05);
      return { maxPath, killed: !T.missiles.some((x) => x.id === m.id), info, after: T.killTrails.length };
    });
    assert(r.killed, 'the missile was shot down');
    assert(r.maxPath >= 3, 'the interceptor records its path in flight: ' + r.maxPath);
    assert(r.info && r.info.len >= 4, 'the kill leaves its trail: ' + JSON.stringify(r.info));
    assertEqual(r.info.color, '#e8735a', "Omega's interceptor (shooting your missile) is red");
    assertEqual(r.after, 0, 'the kill trail fades after ~2s');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-176: at 75% Omega goes to RAPID FIRE - announced, on the HUD, and its wave strikes come 15% faster', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.clearMissiles();
      T.startWave(1);
      const real = Math.random;
      Math.random = () => 0.5;
      T.waveStrikeTimer = 0; T.tickUpdate(0.05);
      const gap0 = T.waveStrikeTimer;
      T.omegaHealthForTest = Math.floor(T.PLAYER_MAX_HEALTH * 0.74);
      T.tickUpdate(0.05);
      const phase = T.omegaPhase;
      T.waveStrikeTimer = 0; T.tickUpdate(0.05);
      const gap1 = T.waveStrikeTimer;
      Math.random = real;
      T.updateOmegaCountersHud && T.updateOmegaCountersHud();
      return { phase, gap0, gap1, texts: T.floatingTexts.map((f) => f.text),
        objective: document.getElementById('objectiveHud').textContent,
        tag: document.getElementById('omegaPhaseTag').textContent, tagShown: !document.getElementById('omegaPhaseTag').hidden };
    });
    assertEqual(r.phase, 1, 'phase II');
    assert(r.texts.includes('OMEGA PHASE II — RAPID FIRE'), 'announced: ' + r.texts);
    assert(r.objective.includes('RAPID FIRE'), 'objective line: ' + r.objective);
    assert(r.tagShown && r.tag === 'RAPID FIRE', 'HUD tag: ' + r.tag);
    assert(Math.abs(r.gap1 / r.gap0 - 0.85) < 0.02, `strike gap x0.85: ${r.gap0} -> ${r.gap1}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-176: at 50% SHIELD BURST blocks all damage for 6 seconds', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      T.omegaHealthForTest = Math.floor(T.PLAYER_MAX_HEALTH * 0.49); // crosses 75% and 50% in one go
      T.tickUpdate(0.05);
      const phase = T.omegaPhase, shield = T.omegaShieldTimer;
      const hp0 = T.omegaHealth;
      T.applyDamage(T.nodeO, T.nodeO.x, 0, 1000);
      const hpShielded = T.omegaHealth;
      const tag = (T.updateOmegaCountersHud && T.updateOmegaCountersHud(), document.getElementById('omegaPhaseTag').textContent);
      for (let i = 0; i < 125; i++) T.tickUpdate(0.05);
      T.applyDamage(T.nodeO, T.nodeO.x, 0, 100);
      return { phase, shield, hp0, hpShielded, hpAfter: T.omegaHealth, shieldAfter: T.omegaShieldTimer, tag };
    });
    assertEqual(r.phase, 2, 'phase III (both thresholds crossed)');
    assert(r.shield > 5.9, 'a 6 second shield: ' + r.shield);
    assertEqual(r.hpShielded, r.hp0, 'a hit on the shield does nothing');
    assert(/^SHIELD \d+s$/.test(r.tag), 'HUD shows the shield countdown: ' + r.tag);
    assertEqual(r.shieldAfter, 0, 'the shield drops after 6s');
    assert(r.hpAfter < r.hp0, 'damage lands again after it drops');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-176: at 25% LAST STAND fires a 2-strike salvo, and a rebuilt Omega starts over', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.neutralizeAutoDefense(); T.disableOmegaCounters();
      T.omegaHealthForTest = Math.floor(T.PLAYER_MAX_HEALTH * 0.2);
      for (let i = 0; i < 50; i++) T.tickUpdate(0.05); // 2.5s: both out
      const salvo = T.missiles.filter((m) => m.typeKey === 'enemyStrike');
      const phase = T.omegaPhase;
      T.onOmegaDestroyedForWaves();
      return { phase, salvo: salvo.length, toPlatform: salvo.every((m) => m.destId === 'A'),
        waveCounted: salvo.some((m) => m.waveNum != null),
        after: { phase: T.omegaPhase, shield: T.omegaShieldTimer, salvo: T.omegaSalvoLeft } };
    });
    assertEqual(r.phase, 3, 'phase IV');
    assertEqual(r.salvo, 2, 'two salvo strikes');
    assert(r.toPlatform, 'aimed at the Strike Platform');
    assert(!r.waveCounted, 'not part of the wave count');
    assertEqual(JSON.stringify(r.after), JSON.stringify({ phase: 0, shield: 0, salvo: 0 }), 'a rebuilt Omega starts at phase I');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-177: DECOY has no warhead and draws Omega\'s fire unless its radar sees through it', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const real = Math.random;
      Math.random = () => 0.9; // above DECOY_SEEN[2] = 0.7: not seen through
      const fooled = T.launchAttack(T.nodeA, T.nodeO, 'decoy');
      Math.random = () => 0.1; // seen through
      const seen = T.launchAttack(T.nodeA, T.nodeO, 'decoy');
      Math.random = real;
      fooled.age = seen.age = 2;
      T.tickUpdate(0.05);
      const engaged = { fooled: !!fooled.defended, seen: !!seen.defended };
      // in Omega's Emergency Counter window: only the fooling one is a target
      fooled.age = seen.age = fooled.totalSeconds - 3;
      const ec = T.findOmegaEmergencyTarget();
      T.clearMissiles();
      const d = T.launchAttack(T.nodeA, T.nodeO, 'decoy');
      const hp = T.omegaHealth;
      d.age = d.totalSeconds;
      T.tickUpdate(0.05);
      return { engaged, ecTarget: ec && (ec.id === fooled.id ? 'fooled' : ec.id === seen.id ? 'seen' : 'other'),
        flags: [fooled.decoySeen, seen.decoySeen], hpBefore: hp, hpAfter: T.omegaHealth,
        gone: !T.missiles.some((m) => m.id === d.id), decoyText: T.floatingTexts.some((f) => f.text === 'DECOY') };
    });
    assertEqual(JSON.stringify(r.flags), '[false,true]', 'the radar roll decides which decoys are seen');
    assert(r.engaged.fooled, "Omega's defenses fire at a decoy they don't see through");
    assert(!r.engaged.seen, 'a seen decoy is ignored');
    assertEqual(r.ecTarget, 'fooled', "Omega's Emergency Counter goes for the fooling decoy only");
    assertEqual(r.hpAfter, r.hpBefore, 'a decoy does no damage');
    assert(r.gone && r.decoyText, 'it ends with a DECOY marker');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-177: GHOST slips past Omega\'s automatic defenses but not its Emergency Counter', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const g = T.launchAttack(T.nodeA, T.nodeO, 'ghost');
      const m = T.launchAttack(T.nodeA, T.nodeO, 'medium');
      g.age = m.age = 2;
      T.tickUpdate(0.05);
      const auto = { ghost: !!g.defended, medium: !!m.defended };
      T.clearMissiles();
      const g2 = T.launchAttack(T.nodeA, T.nodeO, 'ghost');
      g2.age = g2.totalSeconds - 3;
      const ec = T.findOmegaEmergencyTarget();
      return { auto, ec: ec && ec.id === g2.id };
    });
    assert(!r.auto.ghost, 'the automatic defenses never engage a GHOST');
    assert(r.auto.medium, '...but do engage a MEDIUM fired alongside it');
    assert(r.ec, "Omega's Emergency Counter can take it in the last 5 seconds");
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-177: BUNKER BUSTER kills a node in one hit and is easier to shoot down', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const node = T.fieldTargets.find((t) => t.baseNode && t.kind === 'radarNode');
      const real = Math.random;
      Math.random = () => 0.01; // a sure hit
      const b = T.launchAttack(T.nodeA, node, 'buster');
      b.age = b.totalSeconds;
      T.tickUpdate(0.05);
      Math.random = real;
      // hit chance of the same counter against each, at the same speed: count
      // the rolls (0.00..0.99) that succeed
      const rate = (type) => {
        T.clearMissiles();
        const m = T.launchAttack(T.nodeA, T.nodeO, type);
        m.vx = 1e6; // same (capped) speed factor for both
        let n = 0;
        for (let i = 0; i < 100; i++) {
          Math.random = () => i / 100;
          const c = T.fireCounter({ id: 'test', x: 0, y: 0, hitChance: 0.5 }, m.id, 'test');
          if (c.seekSuccess) n += 1;
        }
        Math.random = real;
        return n;
      };
      return { destroyed: node.destroyed, buster: rate('buster'), medium: rate('medium') };
    });
    assert(r.destroyed, 'one BUNKER BUSTER hit destroys a 400 HP node');
    assert(Math.abs(r.buster - r.medium * 1.3) <= 1.5, `1.3x easier to hit: buster ${r.buster} vs medium ${r.medium}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-177: the three new missiles are ARMORY unlocks (DECOY, then GHOST; BUSTER after LONG RANGE)', async () => {
  await withGame(async (page, errors) => {
    await page.click('#armoryBtn');
    const state = (k) => page.evaluate((k) => document.querySelector(`.unlockBtn[data-unlock="${k}"] .uState`).textContent, k);
    const before = { ghost: await state('ghost'), buster: await state('buster'), decoy: await state('decoy') };
    await page.click('.unlockBtn[data-unlock="decoy"]');
    const ghostAfter = await state('ghost');
    assertEqual(before.decoy, 'UNLOCK · 10 MERIT', 'DECOY is open to everyone');
    assertEqual(before.ghost, 'NEEDS DECOY', 'GHOST needs DECOY');
    assertEqual(before.buster, 'NEEDS LONG RANGE', 'BUNKER BUSTER needs LONG RANGE');
    assertEqual(ghostAfter, 'UNLOCK · 30 MERIT', 'GHOST opens once DECOY is bought');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { unlocks: 'starter', merit: 40, skipStart: true });
});

test('LRNA-175: a fresh player starts with FAST, MEDIUM and the 3 starter defenses only', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      T.tokens.attack = 5000;
      const shown = Array.from(document.querySelectorAll('#planeButtons-attack .launchBtn')).filter((b) => !b.hidden)
        .map((b) => b.dataset.type || b.dataset.plane);
      T.attemptFire('large');
      T.firePlane('heavyBomber');
      const sel = document.querySelector('.loadoutSelect[data-slot="0"]');
      const locked = Array.from(sel.options).filter((o) => o.disabled).map((o) => o.value);
      return { shown, fired: T.missiles.filter((m) => m.originId === 'A').length,
        locked, merit: T.unlockState.merit, cols: getComputedStyle(document.getElementById('planeButtons-attack')).getPropertyValue('--attackCols').trim() };
    });
    await page.keyboard.press('3');
    await page.waitForTimeout(100);
    const afterKey = await page.evaluate(() => window.__TEST__.missiles.filter((m) => m.originId === 'A').length);
    assertEqual(r.shown.join(','), 'fast,medium', 'only FAST and MEDIUM on the bar');
    assertEqual(r.cols, '2', 'the phone grid sizes to what is shown');
    assertEqual(r.fired, 0, 'locked LONG RANGE and HEAVY BOMBER do not fire from code');
    assertEqual(afterKey, 0, 'key 3 does nothing while LONG RANGE is locked');
    assertEqual(r.locked.join(','), 'gu,base', 'GROUND UNITS and BASE are locked in setup');
    assertEqual(r.merit, 0, 'no merit yet');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { unlocks: 'starter' });
});

test('LRNA-175: endless runs pay 1 merit per wave cleared and 3 per Omega kill', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      T.currentWaveForTest = 6;
      T.omegaRebuildCount = 2;
      T.triggerRunEnd();
      return { merit: T.unlockState.merit, saved: JSON.parse(localStorage.getItem('lrna_unlocks_v1')).merit,
        body: document.getElementById('waveResultBody').textContent };
    });
    assertEqual(r.merit, 11, '5 waves cleared + 2 kills x 3');
    assertEqual(r.saved, 11, 'merit is saved');
    assert(r.body.includes('MERIT EARNED+11 (11 total) · ARMORY READY'), r.body);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { unlocks: 'starter' });
});

test('LRNA-175: missions pay 5 merit per new star, nothing for a replay at the same stars', async () => {
  await withGame(async (page, errors) => {
    const win = async () => {
      await page.click('#missionsBtn');
      await page.click('.missionBtn[data-mission="first-strike"]');
      await page.waitForTimeout(150);
      return page.evaluate(() => {
        const T = window.__TEST__;
        T.freezeWaves();
        const nodes = T.fieldTargets.filter((t) => t.baseNode);
        T.damageNode(nodes[0].id, 1000); T.damageNode(nodes[1].id, 1000); T.tickUpdate(0.05);
        return T.unlockState.merit;
      });
    };
    const first = await win();
    await page.click('#waveResultClose');
    const again = await win();
    assertEqual(first, 15, '3 new stars x 5');
    assertEqual(again, 15, 'the same 3 stars again pay nothing');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { unlocks: 'starter', skipStart: true });
});

test('LRNA-175: the ARMORY sells unlocks in order, and they reach the bar and setup', async () => {
  await withGame(async (page, errors) => {
    await page.click('#armoryBtn');
    const before = await page.evaluate(() => ({
      merit: document.getElementById('armoryMerit').textContent,
      cards: Array.from(document.querySelectorAll('.unlockBtn')).map((b) => [b.dataset.unlock, b.disabled, b.querySelector('.uState').textContent]),
    }));
    await page.click('.unlockBtn[data-unlock="large"]');
    await page.click('.unlockBtn[data-unlock="cluster"]');
    await page.click('.unlockBtn[data-unlock="gu"]');
    const after = await page.evaluate(() => ({
      merit: window.__TEST__.unlockState.merit,
      owned: window.__TEST__.unlockState.owned.join(','),
      emp: document.querySelector('.unlockBtn[data-unlock="emp"] .uState').textContent,
      saved: JSON.parse(localStorage.getItem('lrna_unlocks_v1')).owned.join(','),
      guLocked: document.querySelector('.loadoutSelect option[value="gu"]').disabled,
    }));
    await page.click('#menuArmory .mHead .mLink');
    const home = await page.evaluate(() => ({ merit: document.getElementById('meritTotal').textContent, btn: document.getElementById('armoryBtn').textContent }));
    await page.click('#startGameBtn');
    await page.waitForTimeout(200);
    const bar = await page.evaluate(() => Array.from(document.querySelectorAll('#planeButtons-attack .launchBtn')).filter((b) => !b.hidden).map((b) => b.dataset.type || b.dataset.plane).join(','));
    const card = (k) => before.cards.find((c) => c[0] === k);
    assertEqual(before.merit, '40', 'merit shown');
    assert(!card('large')[1] && card('large')[2].includes('UNLOCK · 10 MERIT'), 'LONG RANGE is buyable: ' + card('large'));
    assert(card('cluster')[1] && card('cluster')[2] === 'NEEDS LONG RANGE', 'CLUSTER needs LONG RANGE first: ' + card('cluster'));
    assert(card('heavyBomber')[1] && card('heavyBomber')[2] === 'NEEDS STRIKE BOMBER', 'HEAVY BOMBER needs the STRIKE BOMBER');
    assertEqual(after.owned, 'large,cluster,gu', 'bought in order');
    assertEqual(after.merit, 0, '40 - 10 - 20 - 10');
    assertEqual(after.saved, 'large,cluster,gu', 'saved');
    assert(after.emp.includes('20 MERIT') && !after.emp.startsWith('UNLOCK'), 'EMP is now unlocked for purchase but unaffordable: ' + after.emp);
    assert(!after.guLocked, 'GROUND UNITS can be picked in setup now');
    assertEqual(home.merit, '0', 'home shows the merit left');
    assertEqual(home.btn, 'ARMORY', 'nothing affordable left');
    assertEqual(bar, 'fast,medium,large,cluster', 'the new weapons are on the bar');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { unlocks: 'starter', merit: 40, skipStart: true });
});

test('LRNA-175: a returning player is credited for stars and best wave already earned', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => {
      localStorage.removeItem('lrna_unlocks_v1');
      localStorage.setItem('lrna_mission_stars_v1', JSON.stringify({ 'first-strike': 3, 'blind-omega': 1 }));
      localStorage.setItem('lrna_best_wave_v1', '9');
      localStorage.setItem('lrna_loadout_v1', JSON.stringify(['base', 'mgaa', 'gu']));
    });
    await page.reload();
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ merit: window.__TEST__.unlockState.merit, home: document.getElementById('meritTotal').textContent,
      loadout: window.__TEST__.loadout.join(','), btn: document.getElementById('armoryBtn').textContent }));
    assertEqual(r.merit, 28, '4 stars x 5 + 8 waves');
    assertEqual(r.home, '28', 'shown on the home screen');
    assertEqual(r.btn, 'ARMORY · READY', 'the ARMORY button says something is affordable');
    assertEqual(r.loadout, 'gml,mgaa,cb', 'locked defenses in a saved loadout go back to the defaults');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
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

test('LRNA-149/181: Emergency Counter always shows its terms, even with no target', async () => {
  await withGame(async (page, errors) => {
    const idle = await page.evaluate(() => {
      window.__TEST__.updateEmergencyBtn();
      return document.getElementById('emergencyBtn').textContent;
    });
    assert(idle.includes('LAST 5s'), `its terms should be visible with no target: "${idle}"`);

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
    assert(withTarget.includes('LAST 5s'), `its terms should still be visible with a target: "${withTarget}"`);
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

test('LRNA-049: Base loadout node fires a volley at every inbound threat at once, not just one', async () => {
  await withGame(async (page, errors) => {
    await page.click('#menuHome [data-goto="setup"]');
    await page.selectOption('.loadoutSelect[data-slot="0"]', 'base');
    await page.click('#menuSetup .mBtn[data-goto="home"]');
    await page.click('#startGameBtn');
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const T = window.__TEST__;
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

test('LRNA-168/ART-18/175/177: on a phone all the attack buttons share one row, the counter spans the width, and the bar stays slim', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const rect = (el) => el.getBoundingClientRect();
      const tops = Array.from(document.querySelectorAll('.abilityGroup[data-pillar="attack"] .launchBtn')).map((b) => Math.round(rect(b).top));
      const em = rect(document.getElementById('emergencyBtn'));
      return { barHeight: document.getElementById('bottomBar').offsetHeight, viewport: window.innerHeight,
        attackRows: new Set(tops).size, attackButtons: tops.length, emWidth: em.width, scrollWidth: document.documentElement.scrollWidth };
    });
    assert(r.barHeight < r.viewport * 0.28, `the bottom bar should take under 28% of an 844px phone screen (was ~40%): ${r.barHeight}px`);
    assertEqual(r.attackButtons, 11, 'ATTACK has its 8 missiles and 3 planes (all unlocked, LRNA-175/177)');
    assertEqual(r.attackRows, 1, 'all in one row (it scrolls sideways past 8)');
    assert(r.emWidth > 300, `EMERGENCY spans the width: ${r.emWidth}px`);
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
        const covers = ['menuBtn'].filter((id) => panels.some((p) => overlaps(rect(id), p)));
        return { covers, omegaStatus: document.getElementById('omegaCounterStatus').textContent };
      });
      assertEqual(r.covers.length, 0, `these sit on top of the HUD panels: ${r.covers}`);
      assert(/EC \d+/.test(r.omegaStatus), `Omega's counter readout should be filled in: ${r.omegaStatus}`);
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

test('LRNA-172/183: on a phone a tap on one of Omega\'s nodes targets it', async () => {
  await withGame(async (page, errors) => {
    const pos = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const node = T.fieldTargets.find((t) => t.baseNode && !t.destroyed);
      T.setCamX(node.x - (window.innerWidth / T.ZOOM) / 2);
      const rect = document.getElementById('game').getBoundingClientRect();
      return { x: rect.left + (node.x - T.camX) * T.ZOOM, y: rect.top + node.y * T.ZOOM, id: node.id };
    });
    await page.mouse.click(pos.x, pos.y);
    const sel = await page.evaluate(() => window.__TEST__.selectedTargetId);
    assertEqual(sel, pos.id, 'tapping the node targets it');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { viewport: { width: 390, height: 844 } });
});

test('LRNA-174: the start screen lists the missions with saved stars', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => localStorage.setItem('lrna_mission_stars_v1', JSON.stringify({ 'blind-omega': 2 })));
    await page.reload();
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => Array.from(document.querySelectorAll('#missionList .missionBtn')).map((b) => ({
      id: b.dataset.mission, stars: b.querySelector('.mStars').textContent })));
    assertEqual(r.length, 6, 'six missions listed');
    assertEqual(r.find((m) => m.id === 'blind-omega').stars, '★★☆', 'saved stars shown');
    assertEqual(r.find((m) => m.id === 'first-strike').stars, '☆☆☆', 'unplayed mission shows empty stars');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-174: running out of time fails the mission and saves nothing', async () => {
  await withGame(async (page, errors) => {
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="first-strike"]');
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

test('LRNA-174: mission setups - HOLD THE LINE, NO SAFETY NET has no Emergency Counters; endless clears the mission', async () => {
  await withGame(async (page, errors) => {
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="hold-the-line"]');
    await page.waitForTimeout(200);
    const hold = await page.evaluate(() => ({ mission: window.__TEST__.activeMission?.id }));
    await page.evaluate(() => { window.__TEST__.missionStats.time = 0; });
    await page.keyboard.press('r');  // restart keeps the mission and its setup
    const afterR = await page.evaluate(() => ({ mission: window.__TEST__.activeMission?.id }));
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
    assertEqual(hold.mission, 'hold-the-line', 'HOLD THE LINE starts');
    assertEqual(afterR.mission, 'hold-the-line', 'R restarts the same mission');
    assertEqual(net.emergency, 0, 'NO SAFETY NET starts with no Emergency Counters');
    assertEqual(net.badge, 'NONE LEFT', 'its badge says so');
    assertEqual(endless.mission, null, 'PLAY ENDLESS runs no mission');
    assertEqual(endless.hud, 'DESTROY NODE OMEGA', `endless shows its one-line objective: ${endless.hud}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
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
        allInsideStats: ['modeStatus', 'statsList'].every(inside), // ART-21: TARGETS moved to the target label's list
        allVisible: ['modeStatus', 'statsList'].every(visible),
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

test('LRNA-159: Reactor Upgrades removed entirely - no UI remnants, and every mechanic it used to boost is back to its plain base value', async () => {
  await withGame(async (page, errors) => {
    const result = await page.evaluate(async () => {
      const T = window.__TEST__;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      T.tokens.attack = 99999;
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

      // no +1/sec from the old Reactor Boost upgrade (it fed the Intel
      // currency, gone since LRNA-180; ATTACK accrues at the same rate)
      const tokenBefore = T.tokens.attack;
      T.tickUpdate(1);
      const tokenGain = T.tokens.attack - tokenBefore;

      return {
        dmg: m.dmg,
        activeAtCap, activeAfterOneMore,
        tokenGain,
        upgradeListGone: !document.getElementById('upgradeList'),
        dataUpgradeGone: !document.querySelector('[data-upgrade]'),
      };
    });
    assertEqual(result.dmg, 50, `FAST warhead damage should be its plain base value (TYPES.fast.dmg = 50), no Overcharged Warheads multiplier: got ${result.dmg}`);
    assertEqual(result.activeAtCap, 3, 'active-shot cap should be the plain MAX_ACTIVE (3), no Expanded Ammo Bay bonus');
    assertEqual(result.activeAfterOneMore, 3, 'a 4th shot should still be refused at the plain cap');
    // LRNA-166 lowered TOKEN_PASSIVE_RATE from 100/s to 20/s; LRNA-184 raised it to 35/s
    assert(Math.abs(result.tokenGain - 35) < 1, `tokens should accrue at the plain TOKEN_PASSIVE_RATE (35/s), no Reactor Boost bonus: got ${result.tokenGain}/s`);
    assert(result.upgradeListGone, '#upgradeList should not exist anywhere in the DOM');
    assert(result.dataUpgradeGone, 'no [data-upgrade] button should exist anywhere in the DOM');
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

test('ART-10: the home screen is PLAY + MISSIONS + ARMORY on a solid backdrop and fits one screen', async () => {
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
      assertEqual(JSON.stringify(r.big), JSON.stringify(['PLAY', 'MISSIONS', 'ARMORY']), `${size}: the main buttons (ARMORY since LRNA-175)`);
      assert(r.controls <= 5, `${size}: home has at most 5 controls (was 13; ARMORY added in LRNA-175): ${r.controls}`);
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
    await page.click('.missionBtn[data-mission="first-strike"]');
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
    for (const word of ['ATTACK', 'DEFEND', 'BREAK', 'CURRENCY', 'CONTROLS']) assert(howto.includes(word), `how to play covers ${word}`);
    assert(howto.length < 1400, `how to play stays short: ${howto.length} chars`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('ART-11: setup changes show on the home summary line, with each slot\'s role under its pick', async () => {
  await withGame(async (page, errors) => {
    const before = await page.$eval('#setupSummary', (e) => e.textContent);
    await page.click('#menuHome [data-goto="setup"]');
    await page.click('.difficultyBtn[data-difficulty="hard"]');
    await page.selectOption('.loadoutSelect[data-slot="1"]', 'base');
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
    assertEqual(after, 'HARD · GML / BASE / CTR BTY', 'summary follows the picks');
    assertEqual(reloaded, after, 'and survives a reload');
    assert(r.options.every((t) => !t.includes('—')), `options are plain names now: ${r.options.join(', ')}`);
    assert(r.role1.length > 5, `the role line describes the pick: ${r.role1}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('ART-12: home shows the mission stars total', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => localStorage.setItem('lrna_mission_stars_v1', JSON.stringify({ 'blind-omega': 2, 'first-strike': 3 })));
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
    await page.click('.missionBtn[data-mission="blind-omega"]');
    await page.waitForTimeout(150);
    const win = async () => page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      for (const t of T.fieldTargets.filter((f) => f.baseNode && f.kind === 'radarNode')) T.damageNode(t.id, 1000);
      T.tickUpdate(0.05);
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
    assertEqual(retried, 'blind-omega', 'RETRY replays the same mission');
    assertEqual(next, 'cut-the-supply', 'NEXT MISSION starts mission 3');
    assertEqual(last.title, 'MISSION COMPLETE', 'last mission won');
    assert(!last.next, 'the last mission has no NEXT MISSION');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-180: PLAY starts the fight at once - attacks fire and Wave 1 launches, nothing recon is left', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 99999;
      T.attemptFire('fast');
      const fired = T.missiles.filter((m) => m.originId === 'A' && m.typeKey === 'fast').length;
      const plane = T.firePlane('strikeFighter');
      for (let i = 0; i < 40; i++) T.tickUpdate(0.05); // 2s: Wave 1's first strike leaves at 0.6s
      const menuText = document.getElementById('overlay').textContent + document.getElementById('bottomBar').textContent;
      return {
        fired, plane: !!plane,
        // counted at launch: the ground defenses can already have shot the first one down
        inbound: T.waveStrikesLaunched,
        gone: ['[data-type="drone"]', '[data-plane="reconPlane"]', '[data-pillar="intel"]', '#openingLockedBanner', '#tokenIntel',
          '#omegaGuardStatus', '#missionMapZones', '#satelliteWarning', '.loadoutSelect option[value="satellite"]']
          .filter((sel) => document.querySelector(sel)),
        words: ['RECON', 'DRONE', 'INTEL', 'SATELLITE', 'HIDDEN'].filter((w) => menuText.toUpperCase().includes(w)),
        tokens: Object.keys(T.tokens),
        objective: document.getElementById('objectiveHud').textContent,
      };
    });
    assertEqual(r.fired, 1, 'a missile fires from the first second');
    assert(r.plane, 'an attack plane launches from the first second');
    assert(r.inbound >= 1, `Omega's Wave 1 is already on its way: ${r.inbound}`);
    assertEqual(r.gone.length, 0, `recon UI left over: ${r.gone}`);
    assertEqual(r.words.length, 0, `recon words left in the menus or bottom bar: ${r.words}`);
    assertEqual(r.tokens.join(','), 'attack', 'one currency (LRNA-181)');
    assertEqual(r.objective, 'DESTROY NODE OMEGA', 'one-line objective');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-180: a saved loadout with a Satellite falls back to that slot\'s default', async () => {
  await withGame(async (page, errors) => {
    await page.evaluate(() => localStorage.setItem('lrna_loadout_v1', JSON.stringify(['satellite', 'base', 'satellite'])));
    await page.reload();
    await page.waitForTimeout(300);
    const picks = await page.evaluate(() => [...document.querySelectorAll('.loadoutSelect')].map((s) => s.value));
    assertEqual(picks.join(','), 'gml,base,cb', 'Satellite slots go back to their defaults');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-183: FIRST STRIKE needs 2 of Omega\'s nodes; CUT THE SUPPLY all 3 missile nodes', async () => {
  await withGame(async (page, errors) => {
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="first-strike"]');
    await page.waitForTimeout(150);
    const first = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      const nodes = T.fieldTargets.filter((t) => t.baseNode);
      T.damageNode(nodes[0].id, 1000); T.tickUpdate(0.05);
      const mid = { active: T.activeMission?.id, hud: document.getElementById('objectiveHud').textContent };
      T.damageNode(nodes[1].id, 1000); T.tickUpdate(0.05);
      return { mid, title: document.getElementById('waveResultTitle').textContent };
    });
    await page.click('#waveResultClose');
    await page.click('#missionsBtn');
    await page.click('.missionBtn[data-mission="cut-the-supply"]');
    await page.waitForTimeout(150);
    const supply = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves();
      const ms = T.fieldTargets.filter((t) => t.baseNode && t.kind === 'missileNode');
      T.damageNode(ms[0].id, 1000); T.damageNode(ms[1].id, 1000); T.tickUpdate(0.05);
      const two = T.activeMission?.id;
      T.damageNode(ms[2].id, 1000); T.tickUpdate(0.05);
      return { two, title: document.getElementById('waveResultTitle').textContent };
    });
    assertEqual(first.mid.active, 'first-strike', 'one down, still running');
    assert(first.mid.hud.includes('NODES 1/2'), first.mid.hud);
    assertEqual(first.title, 'MISSION COMPLETE', 'the second completes it');
    assertEqual(supply.two, 'cut-the-supply', 'two missile nodes are not enough');
    assertEqual(supply.title, 'MISSION COMPLETE', 'all three complete it');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  }, { skipStart: true });
});

test('LRNA-181: one counter button - EMERGENCY COUNTER - on key 4, no COUNTER currency', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.neutralizeAutoDefense(); T.disableOmegaCounters();
      const m = T.launchEnemyStrike(T.nodeO, T.nodeA);
      m.age = m.totalSeconds - 3;
      T.updateEmergencyBtn();
      const group = document.querySelector('.abilityGroup[data-pillar="counter"]');
      return {
        buttons: [...group.querySelectorAll('button')].map((b) => b.id),
        gone: ['#counterMissileBtn', '#counterPlanesBtn', '#tokenCounter', '#groupTokenCounter'].filter((sel) => document.querySelector(sel)),
        tokens: Object.keys(T.tokens),
      };
    });
    await page.keyboard.press('4');
    const fired = await page.evaluate(() => window.__TEST__.missiles.filter((m) => m.source === 'emergency').length);
    assertEqual(r.buttons.join(','), 'emergencyBtn', 'COUNTER holds just EMERGENCY COUNTER');
    assertEqual(r.gone.length, 0, `removed counters left over: ${r.gone}`);
    assertEqual(r.tokens.join(','), 'attack', 'ATTACK is the only currency');
    assertEqual(fired, 1, 'key 4 fires the Emergency Counter');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`ART-17: two big health bars in the top corners and one incoming warning at ${viewport.width}px`, async () => {
    await withGame(async (page, errors) => {
      const r = await page.evaluate(() => {
        const T = window.__TEST__;
        T.freezeWaves(); T.clearMissiles();
        const m = T.launchEnemyStrike(T.nodeO, T.nodeA); m.age = m.totalSeconds - 4;
        T.tickUpdate(0.05);
        const box = (id) => document.getElementById(id).getBoundingClientRect();
        const hud = document.getElementById('hud');
        return {
          a: box('aBar'), o: box('oBar'), alert: box('incomingAlert'),
          alertText: document.getElementById('incomingAlert').textContent,
          alertClass: document.getElementById('incomingAlert').className,
          clutter: ['aImpacts', 'oImpacts', 'tokenHud', 'tokenAttack', 'centerLabel'].filter((id) => document.getElementById(id)),
          hostInMenu: document.getElementById('gameMenu').contains(document.getElementById('hudHost')),
          hudHeight: hud.offsetHeight, vw: innerWidth,
        };
      });
      const size = `${viewport.width}px`;
      assert(r.a.left < 20 && r.a.top < 60, `${size}: your bar sits top-left: ${JSON.stringify(r.a)}`);
      assert(r.o.right > r.vw - 20 && r.o.top < 60, `${size}: Omega's bar sits top-right: ${JSON.stringify(r.o)}`);
      assert(r.a.height >= 10 && r.a.width >= 150, `${size}: the bars are big: ${r.a.width}x${r.a.height}`);
      assert(Math.abs((r.alert.left + r.alert.right) / 2 - r.vw / 2) < 30, `${size}: the warning is centered`);
      assert(/IMPACT 0:0[34]/.test(r.alertText) && /red/.test(r.alertClass), `${size}: it shows time to impact, red under 5s: ${r.alertText} ${r.alertClass}`);
      assertEqual(r.clutter.length, 0, `${size}: HUD clutter left: ${r.clutter}`);
      assert(r.hostInMenu, 'the served-from address moved into the in-game menu');
      assert(r.hudHeight < 120, `${size}: the HUD stays short: ${r.hudHeight}px`);
      assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
    }, { viewport });
  });
}

test('ART-18: desktop bar - one row of icon buttons with cost, a cooldown fill, and details on long-press', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.tokens.attack = 5000;
      const btns = [...document.querySelectorAll('#abilityGroups .launchBtn, #emergencyBtn')];
      T.firePlane('strikeFighter');
      for (let i = 0; i < 260; i++) T.tickUpdate(0.05); // 10s flight done, now rearming
      T.updatePlaneButtons();
      const fighter = document.querySelector('[data-plane="strikeFighter"]');
      return {
        count: btns.length,
        tops: new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top))).size,
        icons: btns.filter((b) => b.querySelector('svg.btnIcon')).length,
        costs: [...document.querySelectorAll('#abilityGroups .launchBtn .btnDmg')].map((e) => e.textContent),
        tips: btns.filter((b) => b.dataset.tip && b.title).length,
        cd: parseFloat(fighter.style.getPropertyValue('--cd')), fighterEta: fighter.querySelector('.btnEta').textContent,
        bar: document.getElementById('bottomBar').offsetHeight,
      };
    });
    assertEqual(r.count, 12, 'eleven attack buttons (all unlocked, LRNA-175/177) and the counter');
    assertEqual(r.tops, 1, 'all in one row');
    assertEqual(r.icons, 12, 'every button has an icon');
    assertEqual(r.costs.join(','), '100,300,500,750,500,60,400,350,150,350,550', 'each attack button shows its cost');
    assertEqual(r.tips, 12, 'every button carries its details');
    assert(r.cd > 0 && r.cd <= 1 && /REARM/.test(r.fighterEta), `a rearming plane shows a cooldown fill: ${r.cd} ${r.fighterEta}`);
    assert(r.bar < 800 * 0.22, `the bar is slim: ${r.bar}px`);
    // long-press: the details show and the weapon doesn't fire
    const before = await page.evaluate(() => window.__TEST__.missiles.filter((m) => m.typeKey === 'fast').length);
    await page.evaluate(() => document.querySelector('.launchBtn[data-type="fast"]').dispatchEvent(new Event('touchstart', { bubbles: true })));
    await page.waitForTimeout(550);
    const tip = await page.evaluate(() => ({ shown: !document.getElementById('btnTip').hidden, text: document.getElementById('btnTip').textContent }));
    await page.evaluate(() => document.querySelector('.launchBtn[data-type="fast"]').click());
    const after = await page.evaluate(() => window.__TEST__.missiles.filter((m) => m.typeKey === 'fast').length);
    assert(tip.shown && /FAST/.test(tip.text) && /flight/.test(tip.text), `long-press shows the details: ${JSON.stringify(tip)}`);
    assertEqual(after, before, 'the click after a long-press does not fire');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-19: one strip replaces the four - tap a dot to follow it, anywhere else to move the camera', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.tokens.attack = 5000;
      const m = T.launchAttack(T.nodeA, T.nodeO, 'large');
      m.x = 9000;
      T.setFollowId(null);
      const strip = document.getElementById('minimap').getBoundingClientRect();
      return {
        gone: ['contacts', 'counterOpsBar', 'counterLaneCanvas', 'missionMapStrip', 'radarLaneTrack'].filter((id) => document.getElementById(id)),
        strips: document.querySelectorAll('#minimap').length,
        id: m.id, dotX: strip.left + strip.width * (9000 / 18000), y: strip.top + strip.height / 2,
        emptyX: strip.left + strip.width * 0.9,
      };
    });
    await page.mouse.click(r.dotX, r.y);
    const followed = await page.evaluate(() => window.__TEST__.followId);
    await page.mouse.click(r.emptyX, r.y);
    const after = await page.evaluate(() => ({ follow: window.__TEST__.followId, camX: window.__TEST__.camX }));
    assertEqual(r.gone.length, 0, `old strips left over: ${r.gone}`);
    assertEqual(r.strips, 1, 'one strip');
    assertEqual(followed, r.id, 'tapping the dot follows that missile');
    assertEqual(after.follow, null, 'tapping empty strip stops following');
    assert(after.camX > 18000 * 0.6, `and moves the camera there: ${after.camX}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-183: only three targets - OMEGA, RADAR, MISSILE buttons; scenery cannot be targeted', async () => {
  await withGame(async (page, errors) => {
    const start = await page.evaluate(() => ({
      buttons: [...document.querySelectorAll('.targetBtn')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      checked: document.querySelector('.targetBtn[aria-checked="true"]').dataset.pick,
      list: !!document.getElementById('targetMenu') || !!document.getElementById('targetLabel'),
      scenery: (() => { const T = window.__TEST__; const sc = T.fieldTargets.find((t) => !t.baseNode); return { target: T.getTarget ? T.getTarget(sc.id) : null, defends: T.fieldTargets.some((t) => t.defends) }; })(),
    }));
    await page.click('.targetBtn[data-pick="radarNode"]');
    const radar = await page.evaluate(() => ({ sel: window.__TEST__.selectedTargetId, checked: document.querySelector('.targetBtn[aria-checked="true"]').dataset.pick }));
    // destroying it moves the aim to the other radar node, then back to Omega
    const after = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.disableOmegaCounters();
      const kill = (id) => {
        const t = T.fieldTargets.find((f) => f.id === id);
        const m = T.launchAttack(T.nodeA, t, 'large'); m.defended = true; m.targetX = t.x;
        const real = Math.random; Math.random = () => 0.01;
        for (let i = 0; i < 2000 && T.missiles.some((x) => x.id === m.id); i++) T.tickUpdate(0.05);
        Math.random = real;
        return T.selectedTargetId;
      };
      const first = T.selectedTargetId;
      const second = kill(first);
      const third = kill(second);
      return { first, second, third, radarDisabled: document.querySelector('.targetBtn[data-pick="radarNode"]').disabled };
    });
    await page.click('.targetBtn[data-pick="O"]');
    const back = await page.evaluate(() => window.__TEST__.selectedTargetId);
    assertEqual(start.buttons.join('|'), 'OMEGA|RADAR 2|MISSILE 3', 'three buttons with node counts');
    assertEqual(start.checked, 'O', 'Omega to start');
    assert(!start.list, 'the old target label and list are gone');
    assert(!start.scenery.defends, 'scenery does not shoot');
    assertEqual(start.scenery.target, null, 'scenery cannot be targeted');
    assert(/^er\d$/.test(radar.sel) && radar.checked === 'radarNode', `RADAR aims at the nearest radar node: ${JSON.stringify(radar)}`);
    assert(/^er\d$/.test(after.second) && after.second !== after.first, `after a kill it moves to the next radar node: ${JSON.stringify(after)}`);
    assertEqual(after.third, 'O', 'with none left it goes back to Omega');
    assert(after.radarDisabled, 'and RADAR greys out');
    assertEqual(back, 'O', 'OMEGA picks Omega');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-20: the camera follows your newest shot, then the most urgent threat, and back', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.disableOmegaCounters(); T.neutralizeAutoDefense();
      T.tokens.attack = 5000;
      const plane = T.firePlane('strikeBomber');
      T.tickUpdate(0.05);
      const onShot = T.followId === plane.id;
      const threat = T.launchAttack(T.nodeO, T.nodeA, 'enemyStrike', T.ENEMY_STRIKE_SIZES.medium);
      threat.defended = true;
      threat.age = threat.totalSeconds - 12; // not urgent yet
      T.tickUpdate(0.05);
      const stillShot = T.followId === plane.id;
      threat.age = threat.totalSeconds - 6;   // inside 8s of impact
      T.tickUpdate(0.05);
      const onThreat = T.followId === threat.id;
      for (let i = 0; i < 40; i++) T.tickUpdate(0.05); // let the camera catch up
      const camNearThreat = Math.abs((T.camX + innerWidth / T.ZOOM / 2) - threat.x) < innerWidth / T.ZOOM;
      T.removeMissile(threat.id);
      T.tickUpdate(0.05);
      return { onShot, stillShot, onThreat, camNearThreat, backToShot: T.followId === plane.id };
    });
    assert(r.onShot, 'launching follows the new shot');
    assert(r.stillShot, 'a far-off threat does not steal the camera');
    assert(r.onThreat, 'a threat inside 8s of impact takes the camera');
    assert(r.camNearThreat, 'and the camera actually gets there');
    assert(r.backToShot, 'once it is gone the camera goes back to your shot');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-20: a manual move holds the camera for 4s; a missile you picked stays followed', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.disableOmegaCounters(); T.neutralizeAutoDefense();
      T.tokens.attack = 5000;
      T.firePlane('strikeFighter');
      T.setCamX(4000); // like a drag
      for (let i = 0; i < 40; i++) T.tickUpdate(0.05); // 2s
      const held = { follow: T.followId, camX: T.camX };
      for (let i = 0; i < 50; i++) T.tickUpdate(0.05); // 2.5s more: past the hold
      const resumed = T.followId;
      // a missile picked by hand outranks an urgent threat
      const mine = T.launchAttack(T.nodeA, T.nodeO, 'large');
      return { held, resumed, mineId: mine.id };
    });
    const strip = await page.evaluate((id) => {
      const T = window.__TEST__;
      const m = T.missiles.find((x) => x.id === id); m.x = 9000;
      const rect = document.getElementById('minimap').getBoundingClientRect();
      return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height / 2 };
    }, r.mineId);
    await page.mouse.click(strip.x, strip.y);
    const picked = await page.evaluate((id) => {
      const T = window.__TEST__;
      const threat = T.launchAttack(T.nodeO, T.nodeA, 'enemyStrike', T.ENEMY_STRIKE_SIZES.medium);
      threat.defended = true; threat.age = threat.totalSeconds - 4;
      T.tickUpdate(0.05);
      return { follow: T.followId, byUser: T.followByUser, id };
    }, r.mineId);
    assertEqual(r.held.follow, null, 'nothing is followed during the hold');
    assertEqual(r.held.camX, 4000, 'and the camera stays where you put it');
    assert(r.resumed, 'after 4s the camera follows the action again');
    assertEqual(picked.follow, picked.id, 'the missile you picked stays followed, even with a threat about to land');
    assert(picked.byUser, 'marked as your pick');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-16: the battlefield is open ground in earth tones, not deep space', async () => {
  await withGame(async (page, errors) => {
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const c = document.getElementById('game');
      const ctx = c.getContext('2d');
      const pts = [[0.2, 0.3], [0.5, 0.25], [0.8, 0.35], [0.3, 0.6], [0.7, 0.62]];
      const px = pts.map(([fx, fy]) => Array.from(ctx.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data));
      return { px, bg: getComputedStyle(c).backgroundImage };
    });
    for (const [rr, g, b] of r.px) {
      assert(rr + g + b > 120, `ground is lit, not night sky: ${[rr, g, b]}`);
      assert(g >= b && rr >= b * 0.9, `earth tones (green/brown over blue): ${[rr, g, b]}`);
    }
    assert(!/radial-gradient/.test(r.bg), 'no deep-space gradient behind the canvas');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-22: a hit shows HIT and the damage in health-bar units, shakes and flashes; craters stay; a miss says MISS', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.disableOmegaCounters(); T.neutralizeAutoDefense();
      for (const f of T.fieldTargets) f.defends = false;
      const realRandom = Math.random;
      const fly = (m, roll) => {
        m.defended = true; m.targetX = m.dest.x;
        T.setCamX(m.dest.x - innerWidth / T.ZOOM / 2);
        Math.random = () => roll;
        for (let i = 0; i < 2000 && T.missiles.some(x => x.id === m.id); i++) T.tickUpdate(0.05);
        Math.random = realRandom;
      };
      const big = T.launchAttack(T.nodeA, T.nodeO, 'large');
      fly(big, 0.01);
      const hit = { texts: T.floatingTexts.map(f => f.text), shake: T.camShakeMag, flash: T.impactFlash, craters: T.scorchMarks.length };
      for (let i = 0; i < 400; i++) T.tickUpdate(0.05); // 20s later
      const cratersLater = T.scorchMarks.length;
      const miss = T.launchAttack(T.nodeA, T.nodeO, 'fast');
      fly(miss, 0.99);
      const missTexts = T.floatingTexts.map(f => f.text);
      // an enemy hit on your platform
      const strike = T.launchAttack(T.nodeO, T.nodeA, 'enemyStrike', T.ENEMY_STRIKE_SIZES.large);
      strike.dmg = 40;
      fly(strike, 0.01);
      return { hit, cratersLater, missTexts, home: { texts: T.floatingTexts.map(f => f.text), flash: T.impactFlash } };
    });
    assert(r.hit.texts.includes('HIT -30'), `a 1000-damage LONG RANGE shows as HIT -30 on Omega's 250 bar: ${r.hit.texts}`);
    assert(r.hit.shake >= 6, `a big hit kicks the camera: ${r.hit.shake}`);
    assert(r.hit.flash > 0, 'and flashes the screen');
    assert(r.hit.craters >= 1 && r.cratersLater >= 1, `the crater is still there 20s later: ${r.cratersLater}`);
    assert(r.missTexts.includes('MISS'), `a miss says MISS: ${r.missTexts}`);
    assert(r.home.texts.includes('-40'), `a hit on your platform shows its damage: ${r.home.texts}`);
    assert(r.home.flash > 0.15, `and flashes red: ${r.home.flash}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('ART-22: the siren sounds once when a threat is 3 seconds out', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.disableOmegaCounters(); T.neutralizeAutoDefense();
      const m = T.launchAttack(T.nodeO, T.nodeA, 'enemyStrike', T.ENEMY_STRIKE_SIZES.medium);
      m.defended = true;
      m.age = m.totalSeconds - 5;
      T.tickUpdate(0.05);
      const early = !!m.sirenPlayed;
      m.age = m.totalSeconds - 2.9;
      T.tickUpdate(0.05);
      return { early, sounded: !!m.sirenPlayed };
    });
    assert(!r.early, 'not at 5 seconds');
    assert(r.sounded, 'at 3 seconds');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-182: both bases have 3 missile and 2 radar nodes; the bar buttons aim at Omega\'s nearest, and grey out when they\'re gone', async () => {
  await withGame(async (page, errors) => {
    const before = await page.evaluate(() => {
      const T = window.__TEST__;
      const count = (list, kind) => list.filter((n) => n.kind === kind).length;
      const om = T.fieldTargets.filter((t) => t.baseNode);
      return { om: [count(om, 'missileNode'), count(om, 'radarNode')], pl: [count(T.playerNodes, 'missileNode'), count(T.playerNodes, 'radarNode')],
        omNearOmega: om.every((n) => n.x > T.nodeO.x - 600), plNearHome: T.playerNodes.every((n) => n.x < T.nodeA.x + 600),
        tag: document.getElementById('omegaNodeStatus').textContent };
    });
    await page.click('.targetBtn[data-pick="radarNode"]');
    const aimed = await page.evaluate(() => window.__TEST__.selectedTargetId);
    const after = await page.evaluate(() => {
      const T = window.__TEST__;
      for (const n of T.fieldTargets.filter((t) => t.baseNode && t.kind === 'radarNode')) T.damageNode(n.id, 1000);
      return { disabled: document.querySelector('.targetBtn[data-pick="radarNode"]').disabled,
        tag: document.getElementById('omegaNodeStatus').textContent };
    });
    assertEqual(before.om.join(','), '3,2', "Omega's nodes");
    assertEqual(before.pl.join(','), '3,2', 'your nodes');
    assert(before.omNearOmega && before.plNearHome, 'each side\'s nodes sit in front of its own base');
    assertEqual(before.tag, 'MSL 3/3 · RDR 2/2', 'HUD readout');
    assert(/^er\d$/.test(aimed), `RADAR NODES aims at an enemy radar node: ${aimed}`);
    assert(after.disabled, 'the button greys out once they are all destroyed');
    assertEqual(after.tag, 'MSL 3/3 · RDR 0/2', 'and the readout follows');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-182: Omega\'s missile nodes feed its waves, its radar nodes its defenses', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const om = (kind) => T.fieldTargets.filter((t) => t.baseNode && t.kind === kind);
      T.startWave(10); const full = T.waveStrikesTotal;
      for (const n of om('missileNode')) T.damageNode(n.id, 1000);
      T.startWave(10); const weak = T.waveStrikesTotal;
      const waveFactor = T.omegaWaveFactor();
      const sight = [T.omegaSight()];
      T.damageNode(om('radarNode')[0].id, 1000); sight.push(T.omegaSight());
      T.damageNode(om('radarNode')[1].id, 1000); sight.push(T.omegaSight());
      const m = T.launchAttack(T.nodeA, T.nodeO, 'medium');
      m.age = m.totalSeconds - 3;
      T.setOmegaEmergencyCooldown(0);
      T.tickOmegaCounters(0.05);
      return { full, weak, waveFactor, sight, omegaFired: T.missiles.filter((x) => x.source === 'omegaEmergency').length };
    });
    assert(Math.abs(r.waveFactor - 0.4) < 1e-9, `all 3 missile nodes gone: waves at 40% (${r.waveFactor})`);
    assert(r.weak < r.full, `the next wave is smaller: ${r.full} -> ${r.weak}`);
    assertEqual(r.sight.join(','), '1,0.6,0', "Omega's defenses lose sight radar by radar");
    assertEqual(r.omegaFired, 0, 'blind, Omega\'s counter does not fire');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-182: your missile nodes feed your income, your radar nodes how early you see threats', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.neutralizeAutoDefense(); T.disableOmegaCounters();
      const mine = (kind) => T.playerNodes.filter((n) => n.kind === kind);
      for (const n of mine('missileNode')) n.destroyed = true;
      const before = T.tokens.attack; T.tickUpdate(1); const gain = T.tokens.attack - before;
      const strike = T.launchAttack(T.nodeO, T.nodeA, 'enemyStrike', T.ENEMY_STRIKE_SIZES.large);
      strike.defended = true;
      strike.age = strike.totalSeconds * 0.5; // half its flight left
      const seen = [T.threatSeen(strike)];
      mine('radarNode')[0].destroyed = true; seen.push(T.threatSeen(strike));
      mine('radarNode')[1].destroyed = true; seen.push(T.threatSeen(strike));
      T.tickUpdate(0.05);
      const alert = document.getElementById('incomingAlert').textContent;
      strike.age = strike.totalSeconds - 4; T.tickUpdate(0.05);
      return { factor: T.playerIncomeFactor(), gain, seen, alert, late: document.getElementById('incomingAlert').textContent };
    });
    assertEqual(r.factor, 0.25, 'three missile nodes lost: a quarter of the income');
    assert(Math.abs(r.gain - 8.75) < 0.5, `passive income drops to a quarter of 35/s: ${r.gain}`);
    assertEqual(r.seen.join(','), 'true,true,false', 'one radar down still sees it at half flight; both down does not');
    assert(/NO INBOUND/.test(r.alert), `blind, the warning stays quiet: ${r.alert}`);
    assert(/INCOMING/.test(r.late), `in its last 5s it shows up: ${r.late}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-182: Omega sends some strikes at your nodes', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.clearMissiles();
      T.startWave(3);
      const realRandom = Math.random;
      Math.random = () => 0.1; // under the 25% share
      for (let i = 0; i < 40; i++) T.tickUpdate(0.05);
      Math.random = realRandom;
      return T.missiles.filter((m) => m.typeKey === 'enemyStrike').map((m) => m.destId);
    });
    assert(r.length > 0 && r.every((id) => /^p[mr]\d$/.test(id)), `strikes aimed at your nodes: ${r}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-185: Omega\'s strikes hit for 12/24/40 and each side has 15 Emergency Counters', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => ({ sizes: ['fast', 'medium', 'large'].map((k) => window.__TEST__.ENEMY_STRIKE_SIZES[k].dmg),
      mine: window.__TEST__.counterAmmo.emergency, omega: window.__TEST__.omegaCounterAmmo.emergency }));
    assertEqual(r.sizes.join(','), '12,24,40', 'enemy strike damage x0.6');
    assertEqual(r.mine, 15, 'your counters');
    assertEqual(r.omega, 15, "Omega's counters");
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-186: each Omega radar lost costs it 4 counters and makes its strikes miss more', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.neutralizeAutoDefense(); T.disableOmegaCounters();
      // a strike that arrives with a fixed roll of 0.75: lands at 85% aim, misses at 70% and 50%
      const lands = () => {
        const m = T.launchAttack(T.nodeO, T.nodeA, 'enemyStrike', T.ENEMY_STRIKE_SIZES.fast);
        m.defended = true; m.targetX = T.nodeA.x;
        const hp = T.nodeA.health;
        const real = Math.random; Math.random = () => 0.75;
        for (let i = 0; i < 400 && T.missiles.some((x) => x.id === m.id); i++) T.tickUpdate(0.05);
        Math.random = real;
        const landed = T.nodeA.health < hp; T.nodeA.health = 250; return landed;
      };
      const radars = T.fieldTargets.filter((t) => t.baseNode && t.kind === 'radarNode');
      const out = { counters: [T.omegaCounterAmmo.emergency], lands: [lands()] };
      T.damageNode(radars[0].id, 1000); out.counters.push(T.omegaCounterAmmo.emergency); out.lands.push(lands());
      T.damageNode(radars[1].id, 1000); out.counters.push(T.omegaCounterAmmo.emergency); out.lands.push(lands());
      return out;
    });
    assertEqual(r.counters.join(','), '15,11,7', 'each radar lost costs Omega 4 Emergency Counters');
    assertEqual(r.lands.join(','), 'true,false,false', 'a roll of 0.75 lands at 85% aim but misses at 70% and 50%');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-187: your nodes have 60 HP and Omega works the most damaged one', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.clearMissiles();
      const hp = T.playerNodes.map((n) => n.maxHealth);
      const weak = T.playerNodes[3]; weak.health = 20;
      T.startWave(3);
      const real = Math.random; Math.random = () => 0.1; // under the node share
      for (let i = 0; i < 40; i++) T.tickUpdate(0.05);
      Math.random = real;
      return { hp, dests: [...new Set(T.missiles.filter((m) => m.typeKey === 'enemyStrike').map((m) => m.destId))], weak: weak.id };
    });
    assert(r.hp.every((h) => h === 60), `your nodes have 60 HP: ${r.hp}`);
    assertEqual(r.dests.join(','), r.weak, 'every strike goes at the most damaged node');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-189: when Omega falls it rebuilds its radar and missile nodes too', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles();
      const nodes = T.fieldTargets.filter((t) => t.baseNode);
      for (const n of nodes) T.damageNode(n.id, 1000);
      const down = nodes.filter((n) => n.destroyed).length;
      T.forceOmegaDamage(1e6);
      return { down, back: nodes.filter((n) => !n.destroyed && n.health === n.maxHealth).length,
        tag: document.getElementById('omegaNodeStatus').textContent };
    });
    assertEqual(r.down, 5, 'all five down first');
    assertEqual(r.back, 5, 'all five rebuilt with Omega');
    assertEqual(r.tag, 'MSL 3/3 · RDR 2/2', 'the readout shows them back');
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

test('LRNA-190: FAST hits nodes four times harder (200), but not Omega', async () => {
  await withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      T.freezeWaves(); T.clearMissiles(); T.disableOmegaCounters();
      const fly = (dest) => {
        const m = T.launchAttack(T.nodeA, dest, 'fast'); m.defended = true; m.targetX = dest.x;
        const real = Math.random; Math.random = () => 0.01;
        for (let i = 0; i < 1000 && T.missiles.some((x) => x.id === m.id); i++) T.tickUpdate(0.05);
        Math.random = real;
      };
      const node = T.fieldTargets.find((t) => t.baseNode && t.kind === 'missileNode');
      fly(node);
      const nodeHp = node.health;
      const before = T.omegaHealth; fly(T.nodeO);
      return { nodeHp, omegaLoss: before - T.omegaHealth, tip: document.querySelector('.launchBtn[data-type="fast"]').dataset.tip };
    });
    assertEqual(r.nodeHp, 200, 'a FAST takes 200 off a 400 HP node');
    assertEqual(r.omegaLoss, 2, 'and still the plain 50 (2 HP on the bar) off Omega');
    assert(/200 against radar and missile nodes/.test(r.tip), `the button says so: ${r.tip}`);
    assertEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
  });
});

run();
