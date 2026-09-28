# Long Range Node Attack — Tickets

A running ticket log for this game: what's shipped, in what order, and what's
queued up next. Written for two audiences — a human catching up on the
project's history, and future auto-dev passes (mine or anyone else's) picking
a scoped next task without re-deriving all of this from the git log.

Conventions: `LRNA-###`, numbered in ship order. `DONE` tickets are shipped on
`claude/practical-keller-49onif` and live at the Artifact
(https://claude.ai/artifact/VsNis2X4icPuC9DacQxd4m) and in
`games/long-range-node-attack/index.html`. `OPEN` tickets are backlog, roughly
ordered by priority within each section. Pick ONE OR TWO scoped `OPEN` tickets
per pass — see the workflow note at the bottom.

Frozen references (never edit): `FallBackCode.html` (pre-coin-economy
snapshot), `LongRange-1.0.0.html` (post-coin-economy, pre-v1.0.1 snapshot).

---

## OPEN — Art Remodel (Epic)

Tracked as GitHub issues, not LRNA-numbered (separate ticket prefix: `ART-#`)
since this is purely visual/rendering work, orthogonal to the gameplay
ticket backlog below. Epic: jackgary86-dev/LongRange#53. The game is
currently 100% procedural Canvas2D drawing with zero external image
assets - see the epic issue for the full rendering-approach writeup handed
to whoever picks these up.

- **ART-1** — Redesign plane sprites (jackgary86-dev/LongRange#54)
- **ART-2** — Redesign missile/warhead sprites and trails (jackgary86-dev/LongRange#55)
- **ART-3** — Redesign map/battlefield background and minimap (jackgary86-dev/LongRange#56)
- **ART-4** — Redesign HUD buttons and UI chrome (jackgary86-dev/LongRange#57)
- **ART-5** — Recon-gated opening phase visuals: zone markers, lock
  banner, unlock moment (jackgary86-dev/LongRange#58). Follow-up from
  LRNA-080's placeholder `drawReconZone()`/`#openingLockedBanner`.
- **ART-6** — Base loadout node visuals: multi-target volley
  (jackgary86-dev/LongRange#59). Follow-up from LRNA-049's Base node
  shipping with the same placeholder dot rendering as the other loadout
  nodes.

---

## OPEN — Medium Priority Improvements

(none currently - LRNA-115 through LRNA-117 shipped; see the resolution log below)

---

## OPEN — Low Priority / Quality of Life

- **LRNA-122** — Dragging the map with the mouse doesn't work on mobile (only touch pinch/pan)
  - Current: Only `touchmove` is handled for panning
  - Improve: Add `pointerdown`/`pointermove` for cross-platform compatibility

---

## OPEN — Balance Issues (High Impact)

(none currently - LRNA-137 through LRNA-142 all resolved, see the resolution log below)

---

## OPEN — Code Quality Issues (Refactoring)

(All resolved - LRNA-143/144/146/149/150/151/152 shipped, LRNA-145/147/148/153
investigated with no reproducible bug found - see the resolution log below)

---

## Shipped

- **LRNA-001** — DONE — Initial scaffold: two-player spectator radar demo,
  served locally on port 2001 (`games/serve.py`).
- **LRNA-002** — DONE — Ballistic launch arcs and launch effects for missiles
  (parabolic altitude curve, launch ring/particle burst).
- **LRNA-003** — DONE — Rebalanced flight times to fast/medium/large =
  10s/20s/30s.
- **LRNA-004** — DONE — Replaced the auto-fire spectator loop with manual
  launch buttons; player takes direct control.
- **LRNA-005** — DONE — Pixel-art bases (erosion-order damage mask), enemy
  counter-fire, 3-rockets-per-turn ammo economy.
- **LRNA-006** — DONE — Coin economy: passive income + hit/kill rewards,
  persisted to `localStorage`.
- **LRNA-007** — DONE — v1.0.1: real rocket-silhouette missile icons,
  coin-gated launches, counter-token economy, doubled map length. Snapshot
  saved as `FallBackCode.html`, then `LongRange-1.0.0.html`.
- **LRNA-008** — DONE — Pure attacker/defender pivot: player is sole
  attacker, Node Omega auto-defends with seeking counter-missiles. Omega's
  base rebuilt as a 1,000,000-node raster damage grid (`buildOmegaBase` /
  `damageOmegaAt`) instead of percentage health, with continuous smoke
  trails and scaled explosions on every warhead impact.
- **LRNA-009** — DONE — Full sci-fi reskin: orbital-siege palette
  (cyan/magenta/violet/orange), starfield + nebula backdrop, energy-conduit
  rivers, renamed Launch Silo → Strike Platform.
- **LRNA-010** — DONE — Fixed camera-follow lag: fast missiles were outrunning
  the fixed-rate lerp and sliding off-screen. Camera now matches the
  followed missile's own velocity, lerp only corrects the residual.
- **LRNA-011** — DONE — 12 attackable field targets (4 infantry, 3 vehicles,
  3 launchers, 2 sub-bases) scattered along the corridor; TARGETS panel to
  select one; launchers/sub-bases defend themselves via the same
  interceptor system as Omega.
- **LRNA-012** — DONE — Reactor Upgrades: first coin sink beyond ammo.
  Overcharged Warheads (+20% dmg), Expanded Ammo Bay (+1 in-flight),
  Reactor Boost (+1 cell/sec), one-time purchases persisted separately from
  the coin balance.
- **LRNA-013** — DONE — Entrance screen "sales art" pass: live game world
  visible through a vignette behind the title, pulsing glow, loadout chips,
  featuring line.
- **LRNA-014** — DONE — CLUSTER warhead: 4th missile type, splits into 3
  smaller impacts (450 total dmg) scattered across the target on hit.
- **LRNA-015** — DONE — Player-side defense: 5 AM (anti-missile) batteries
  evenly spaced across the player's half of the corridor, each independently
  intercepting inbound threats at 15% (vs. Omega's 50%). Omega now
  periodically launches its own offensive strikes at the Strike Platform
  (`TYPES.enemyStrike`), scaled to nodeA's 0-100 health pool.
- **LRNA-016** — DONE — Flak: every point-defense node sprays tracer fire at
  passing warheads within range, purely cosmetic, layered on top of the
  interceptor mechanic.
- **LRNA-017** — DONE — Player/enemy corridor sides cleanly separated (field
  targets confined to Omega's half, mirroring the AM-battery zone on the
  player's half); interception chance now scales with target speed
  (slower = easier to hit); decoys are now mechanically real via a
  `DEFENSE_ENGAGE_CAP` independent of the player's own ammo cap; flak fixed
  to only target the opposing faction; ACTIVE CONTACTS rows are click-to-track
  for the camera.
- **LRNA-018** — DONE — Redesigned `games/index.html` (the LAN demo launch
  page): matching sci-fi palette, real SVG hero art, accurate copy, "slot
  reserved" placeholder card.
- **LRNA-019** — DONE — Game Portal registration: `portal-game.json` at the
  repo root per `game-portal/SUBMIT.md`'s schema (port 2001, `static_dir`
  pointing at this folder, demo = the Artifact URL).
- **LRNA-020** — DONE — Base damage art overhaul: each crater now bakes a
  permanent scorch ring into Omega's raster canvas (`damageOmegaAt`, a
  radial-gradient `source-over` pass after the `destination-out` cut),
  tracked craters (`omegaCraters`) drip persistent rising smoke for several
  seconds after impact (`omegaSmolders` / `updateOmegaSmolders`), and Omega
  now slowly self-repairs its most recent craters over time
  (`updateOmegaRepair`, re-drawing clipped patches of `drawOmegaBaseShapes`
  and crediting nodes back), with a spark + flash-particle burst at each
  heal tick.
- **LRNA-021** — DONE — Interceptor (AM battery) visual redesign:
  `drawAmNode` rebuilt as a proper turret — dashed coverage ring, tripod
  mount, twin gun barrels angled up into the sky toward the corridor,
  radar dish on a stalk, pulsing status light.
- **LRNA-022** — DONE — Machine-gun-clarity flak: `spawnFlak` now fires a
  denser burst (4-6 tracers, up from 3-4) plus a synced muzzle-flash
  particle (new `flash` particle type, physics + glowing render branch) at
  the firing node's barrel tip, so every burst visibly originates from the
  shooting unit.
- **LRNA-032** — DONE — Emergency Counter: a manual backup intercept the
  player can trigger from a top-left HUD button, stacking on top of (not
  replacing) the automatic AM-battery defense. Omega's `enemyStrike`
  attacks now roll a FAST/MEDIUM/LARGE `sizeKey`
  (`ENEMY_STRIKE_SIZES`/`pickEnemyStrikeSize`/`launchEnemyStrike`); the
  button (`findEmergencyTarget`/`fireEmergencyCounter`) can manually
  re-engage any inbound MEDIUM/LARGE strike up to twice
  (`EMERGENCY_MAX_PER_TARGET`) — FAST strikes are explicitly untrackable by
  it — firing a counter-missile from the Strike Platform itself, gated by a
  short cooldown (`EMERGENCY_COOLDOWN`) and disabled with no eligible
  target. Refined with a real reaction window: the button only lights up
  once a threat is within `EMERGENCY_WINDOW` (5s) of impact, rather than
  for its whole flight, and its label now shows the target's size, live
  speed, and time to impact (`EMERGENCY — NAME [SIZE] · SPD n · IMPACT
  m:ss (charges left)`).
- **LRNA-034** — DONE — FAST/MEDIUM warheads now weave gently side to side
  on screen as they fly (`weaveOffset`, a per-missile sine wobble on top of
  the fixed `laneY`), reading as small nimble planes; LONG RANGE/CLUSTER
  stay level. Purely a drawn/trail-position cosmetic — real `laneY` used
  for targeting and hit resolution is untouched.
- **LRNA-036** — DONE — Field targets and AM batteries no longer render
  pinned to one perfectly straight line: `layout()` was forcing every
  node's `.y` to the exact same `vh() / 2`. Each now gets its own random
  `yOffset` (new `NODE_SCATTER` band) applied on top of that in `layout()`,
  and AM batteries also picked up the same x-position jitter field targets
  already had (plus a re-sort by `x` after jitter, matching how field
  targets already handle it) so both rows of installations read as spread
  out rather than mechanical.
- **LRNA-023** — DONE — EMP warhead: a 5th launch-bar type (45 cells, 18s
  flight, no splash damage) that jams its target's defenses for
  `EMP_JAM_DURATION` (6s) on impact — `getDefender` returns no defender and
  `updateFlak` stops firing for a jammed node, opening a window to land a
  real strike unopposed. Works on Node Omega and any defending field
  target (`jamTimer` on both); shown with a pulsing dashed ring
  (`drawJamIndicator`) and a `[JAMMED]` label suffix.
- **LRNA-024** — DONE — Richer LAUNCHER/SUB-BASE art in `drawFieldTarget`,
  matching the AM-battery visual family (LRNA-021): both now get a dashed
  coverage ring and a pulsing status light. LAUNCHER is a tracked chassis
  with twin angled launch tubes and a small dish on a stalk (was a single
  tube on a plain rect). SUB-BASE keeps its dome-and-footing silhouette but
  adds a mast (matching Node Omega's own mast) and scattered vent studs
  echoing Omega's raster vent texture. Purely visual — health/damage/AI
  behavior unchanged.
- **LRNA-025** — DONE — Siege Mode: an optional timed challenge, toggled
  from a new GAME MODE section in the Operations Center (`siegeActive`).
  START SIEGE resets the board and starts a 5-minute countdown
  (`SIEGE_DURATION`) shown in the top-center HUD; destroying Node Omega
  before time runs out shows a SIEGE COMPLETE banner, running out the clock
  shows SIEGE FAILED, and the button becomes ABORT SIEGE to quietly drop
  back to sandbox mid-run. Sandbox (the default) is completely unaffected
  when no siege is active.
- **LRNA-026** — DONE — Two new Reactor Upgrade tiers: REINFORCED HULL
  (+0.4 hp/sec Strike Platform regen, `currentHullRegen()`) and
  INTERCEPTOR CALIBRATION (+10% AM battery hit chance,
  `interceptorHitBonus()`, applied live in `fireCounter` rather than
  mutated onto the AM node objects, so it works regardless of purchase
  timing or page reload). Both follow the existing owned-upgrade pattern
  (`UPGRADES`/`ownedUpgrades`, persisted separately from the coin
  balance).
- **LRNA-027** — DONE — Sound design: a lightweight synthesized SFX system,
  pure WebAudio (`initAudio`/`playTone`/`playNoiseBurst`), no external
  audio files, consistent with the rest of the game's no-external-
  dependency build. `AudioContext` is created lazily in `startDemo` (a
  real user gesture, since browsers block audio before interaction).
  Wired in: launch whoosh (`sfxLaunch`, every `spawnLaunchFx` call —
  covers player/enemy missiles, counters, and Emergency Counter shots
  alike), impact thump (`sfxImpact`, scales with blast size),
  intercept/miss (`sfxIntercept`/`sfxMiss`), EMP zap (`sfxEmp`), UI blips
  (`sfxUi` on Operations Center open/close and target select), upgrade
  purchase chime (`sfxPurchase`), and a Siege Mode win/lose
  jingle/stinger (`sfxSiegeWin`/`sfxSiegeLose`).
- **LRNA-028** — DONE — RUN STATS panel: a new Operations Center section
  (`renderStats`, called every `updateHud`) surfacing `stats.fired`/
  `.hits`/`.intercepts`, nodes chipped off Omega
  (`OMEGA_TOTAL_NODES - omegaRemainingNodes`), and a new lifetime-earned
  coin counter (`lifetimeCoins`, persisted separately from the spendable
  `coins` balance — unlike it, never decreases, tracked in both
  `earnCoins` and the passive-income accrual).
- **LRNA-029** — DONE (audited, no code changes needed) — Mobile
  touch-control audit. No real touch hardware is available in this
  environment, so this was audited via Playwright's mobile/touch emulation
  (`devices['iPhone 13']`, `hasTouch: true`) rather than a physical device
  — a genuine gap from a true hardware audit, noted rather than glossed
  over. Verified working: tapping the entrance overlay starts the game,
  single-finger drag pans the camera (`touchstart`/`touchmove`/`touchend`
  on `canvas`), tapping a launch button fires a warhead, tapping
  OPERATIONS CENTER opens the panel and its rows/buttons are tappable, no
  horizontal page overflow, and all 5 launch-bar buttons (`.launchBtn`)
  stay comfortably touch-sized (~170×58 CSS px, well over the ~44px
  minimum) without wrapping awkwardly. One thing worth flagging plainly:
  the ticket's "pinch" premise doesn't match the actual code — there is no
  pinch-to-zoom gesture at all, on touch or any other input; `ZOOM` is a
  hardcoded constant (`const ZOOM = 0.5`) with no zoom control anywhere in
  the game. Nothing to verify there since the feature doesn't exist; if
  zoom is actually wanted, that's new scope for a separate ticket, not a
  touch-support bug in this one.
- **LRNA-030** — DONE — Battlefield terrain pass: creeks (`CREEKS`/
  `creekXAt`/`drawCreeks`, thinner/shorter tributary variants of the
  existing river sine-wave system, only spanning a partial vertical band
  so they visibly start/stop rather than crossing the whole screen), alien
  flora clusters (`TREE_CLUSTERS`/`drawTrees`, small scattered triangular
  copses), a distant parallax mountain ridgeline (`MOUNTAIN_POINTS`/
  `drawMountains`, kept deliberately thin and hugging the very top of the
  screen after an initial pass was far too dominant and ate into the
  missile flight band), and scattered structure wreckage
  (`WRECKAGE`/`drawWreckage`, pillars/rubble). Resolved the open framing
  question from the original ticket by keeping the sci-fi palette but
  rendering literal terrain forms, per that ticket's own suggested
  resolution. All purely cosmetic backdrop, layered alongside
  `STARS`/`terrainPatches`/`RIVERS` — none of it is attackable.
- **LRNA-031** — DONE — Per-type missile silhouettes: replaced the shared
  rocket body for FAST/MEDIUM/LONG RANGE/CLUSTER. `drawAttackPlane` (short
  swept-wing fighter) for FAST/MEDIUM; `drawBomber` (long fuselage, broad
  straight wings) for LONG RANGE; CLUSTER now draws its existing 3-body
  split-telegraph formation using small `drawBomber` copies instead of
  small rocket bodies, per the resolution already noted in this ticket.
  `drawMissileBody` (the original rocket silhouette) is kept as the
  fallback for COUNTER/EMP/enemyStrike, which this ticket didn't cover.
- **LRNA-033** — DONE — Missile burn/coast speed profile: FAST/MEDIUM/LONG
  RANGE/CLUSTER now accelerate for their first `burn` seconds (5/10/15/15,
  a new `TYPES` field) then decelerate for the rest of the flight
  (`rawSpeedMultiplier`/`computeSpeedNorm`, applied live each frame in the
  main physics loop), instead of holding one constant velocity for the
  whole trip. The curve is normalized per-missile so its time-average
  speed stays ~1x, keeping total travel time close to the original
  `dist/eta` and the ballistic altitude arc synced with actual position —
  verified directly (instrumented build sampling live `m.vx`): a LONG
  RANGE shot ramped from 364 to a peak of ~723 right around its burn
  midpoint (age 15s of 30s eta) then eased back down, landing on schedule.
  `m.vx` stays the live instantaneous velocity throughout, so
  `speedInterceptFactor` (intercept chance) and the Emergency Counter's
  live `SPD` readout now genuinely vary within a single flight, not just
  per type. COUNTER/EMP/enemyStrike are unchanged (no `burn` field, out of
  this ticket's scope).
- **LRNA-035** — DONE — Counter Attack Planes: a 6th launch-bar button
  (`#counterPlanesBtn`, `.launchBtn[data-type]` deliberately excludes it
  from the generic TYPES-driven launch flow since it isn't a `TYPES` entry
  — it's a dedicated action). Costs 1000 cells; launches 2 planes at the
  two soonest-to-impact inbound `enemyStrike` missiles (no size gate,
  unlike Emergency Counter), each a `fireCounter` call at a flat 75% hit
  chance. If only one threat exists, both planes target it, stacking to a
  ~94% effective kill chance rather than wasting a plane on nothing.
  Verified directly: button enables only once a real threat exists, fires
  two named counter-missiles at the target on click.
- **LRNA-037** — DONE — EMP upgraded from a single-target jam to a global
  one: `empGlobalJamTimer` (15s, `EMP_JAM_DURATION`) replaces the old
  per-node `jamTimer` field entirely (removed from `nodeO`/field targets).
  `getDefender` and `updateFlak` both check it for any enemy-faction
  target, so one landed EMP blacks out Node Omega *and* every defending
  field target at once, not just whichever one it happened to hit. The
  `[JAMMED]` label/ring now shows on every affected enemy node while
  active. Verified directly (instrumented build): `[JAMMED]` appears
  body-wide after a single EMP impact.
- **LRNA-034 addendum** — DONE — FAST/MEDIUM planes now roll one of 5
  distinct flight-path shapes at launch (`PLANE_PATHS`, varying
  amp/freq — nearly-straight, wide swoop, tight zigzag, gentle S-curve,
  aggressive double-S) instead of every plane of a type flying the exact
  same fixed weave. Verified directly: 8 sampled FAST launches showed 4 of
  the 5 distinct path amplitudes in play.
- **LRNA-040** — DONE — Counter Attack Planes now sends only 1 plane at
  half price (500 cells) when just 1 live threat exists, instead of
  stacking both planes on it — matches "one kill per plane, 2 max
  missiles" literally. Button label/cost (`counterPlanesPlan`,
  `updateCounterPlanesBtn`) update live to reflect 1-plane vs. 2-plane
  mode. Verified directly: with a single inbound threat the button read
  "1 plane · 75% kill · 500 cells."
- **LRNA-041** — DONE — Counter Missile: a 7th launch-bar button, 500
  cells, one shot at the single soonest-to-impact inbound enemy strike,
  75% hit chance, no size gate — resolved the ticket's open questions by
  matching Counter Attack Planes' rate/no-gate design for consistency.
  Verified directly: fires a named counter-missile at the live threat on
  click.
- **LRNA-042** — DONE — Cost rebalance: FAST 10→100, MEDIUM 25→300, LONG
  RANGE 50→500 cells (`TYPES` + launch-bar `.btnDmg` labels). Counter
  Missile/Counter Attack Planes already matched the requested 500/1000.
- **LRNA-043** — DONE — Widened the existing scatter rather than replacing
  it: `NODE_SCATTER` 110→160, field target/AM battery x-jitter multiplier
  0.6→0.9, and `TREE_CLUSTERS` given a wider y-spread (280→420), bigger
  per-tree offset range, and more size variance per cluster (2-8 trees,
  was 3-7). Verified visually — trees and defense nodes read noticeably
  more organic/less mechanically spaced.
- **LRNA-044** — DONE — Shipped: CLUSTER cost 35→750 with dmg
  450→1400 (now the single heaviest hit in the arsenal, ahead of LONG
  RANGE's 1000, justifying the higher price); EMP cost 45→500. The
  "stop enemy ability to Counter plane or counter missile" half sat
  PARTIAL for a long time as a real ambiguity (EMP is player-fired at
  enemy targets; "Counter plane"/"counter missile" are the *player's*
  own ability names, and Omega had no such abilities yet to jam) -
  resolved by GitHub issue #432, which gave Omega its own mirrored
  Counter Missile + Counter Attack Planes (LRNA-075) and a genuinely
  separate 15s jam for them, confirming LRNA-037's existing global EMP
  jam was correctly left as-is rather than reused for this.
- **LRNA-038** — DONE — DRONE warhead: an 8th launch-bar type, 5 cells,
  120s flight (`TYPES.drone`), 10 dmg. Two things make it more than a
  re-skinned slow missile, per the ticket's own requirement:
  - Flight path: `weaveOffset` gets a dedicated drone branch returning
    `m.wanderOffset`, a real random-walk value evolved every frame by the
    new `updateDroneWander` (picks a fresh lateral velocity every
    0.8-1.6s, integrates it, clamps to +/-90) - genuinely wanders rather
    than following any fixed periodic curve like FAST/MEDIUM's weave.
    Verified directly (instrumented build): sampled `wanderOffset` drifted
    non-monotonically over a full flight (e.g. -1.2 -> -34.0 -> -24.0
    across 6s).
  - Recon information: `updateDroneRecon` fires every ~1.4-2.0s, finds
    whichever field target or Node Omega the drone is currently passing
    nearest to (within `DRONE_RECON_RANGE`), and calls out a real live
    readout - exact hp/maxHp for a field target, exact node count for
    Omega - via a floating text callout, not flavor text.
  Also fixed a real pre-existing bug found while wiring this up:
  `nameCounters` (used by `nextName` for the ACTIVE CONTACTS list) was
  missing `emp` and `drone` keys, so naming any EMP or DRONE produced
  "undefined-NaN" instead of a real name - added both keys. `drone: 3`
  was already present in `COIN_REWARDS`, avoiding the historical NaN-coin
  bug. Verified directly: DRONE button fires, costs 5 cells, live contact
  shows a correct name (e.g. "SCOUT-01"), zero console errors.
- **LRNA-039** — DONE — Recon/Hunt/Destroy: hidden AntiPlane lane
  defenses, discovered and destroyed via drones, built on LRNA-038.
  - **Lanes.** `launchAttack` now also quantizes its existing continuous
    `laneY` into a discrete `laneIndex` (0-9, `ANTIPLANE_LANES`) on every
    missile - a layer on top of the existing positioning system, not a
    replacement. Never drawn or labeled - purely a hidden targeting
    dimension.
  - **AntiPlane nodes.** `initAntiPlaneNodes` (called from `reset`) places
    2 hidden enemy nodes (`antiPlaneNodes`), each bound to one random,
    distinct lane, 75% hit chance. `updateAntiPlaneNodes` is a real
    parallel interception check, separate from `getDefender`/the
    per-destination auto-defense loop: each frame, any live FAST/MEDIUM
    *player* missile sharing an AntiPlane node's lane and within
    `ANTIPLANE_ENGAGE_RANGE` gets engaged exactly once
    (`m.antiPlaneEngaged`), firing a real seeking `fireCounter` shot at it
    - LONG RANGE/CLUSTER/EMP/DRONE are excluded by typeKey, matching the
    "these are planes" framing. Also respects the existing global EMP jam
    (`empGlobalJamTimer`), consistent with every other enemy defense.
    Undiscovered nodes render nothing (`drawAntiPlaneNode` no-ops) and are
    absent from all UI. Verified directly (instrumented build): a
    same-lane FAST missile placed in range gets `antiPlaneEngaged: true`
    and a real `counter`-typeKey missile in the AntiPlane node's color is
    confirmed created via `fireCounter`.
  - **Discovery.** `updateDroneDiscovery`, called from the DRONE's own
    per-frame update, rolls a real per-second chance
    (`ANTIPLANE_DISCOVERY_CHANCE_PER_SEC`) to flip a node to
    `discovered: true` whenever a recon drone is within
    `ANTIPLANE_DISCOVERY_RANGE`. Once discovered: a floating "ANTIPLANE
    DETECTED" callout, a small hostile-turret map marker at its real
    position (`drawAntiPlaneNode`), and an entry in the Intelligence
    panel's known-threats list. Verified directly: a drone placed next to
    an undiscovered node flips it to `discovered: true` within ~1s at the
    real per-second roll rate.
  - **Attack Drone.** A dedicated `TYPES.attackDrone` (60 cells, 70s
    flight, 0 splash dmg - not on the launch bar, no `data-type` button)
    fired via `fireAttackDrone(apId)`, purely coin-gated like Counter
    Missile/Counter Attack Planes, only against a *discovered*,
    non-destroyed AntiPlane node. Resolves entirely outside the generic
    launchAttack/impact pipeline (its own physics-loop branch, like
    `counter`): 80% (`ATTACK_DRONE_HIT_CHANCE`) chance to destroy the node
    on arrival, awarding its own `COIN_REWARDS.attackDrone` (80). Verified
    directly: fireAttackDrone spends 60 cells, spawns a real missile
    targeting the node's id; with hit chance forced to 100% for a
    deterministic check, the node flips to `destroyed: true` and coins
    jump by the reward on arrival.
  - **Intelligence panel.** New "INTELLIGENCE" Operations Center section:
    a RECON DRONE button (reuses the exact `drone` typeKey/mechanic from
    LRNA-038 - a second entry point, not a duplicate system) and a
    known-threats list rendered by `renderIntel`, one row per discovered
    node with an inline ATTACK button (`fireAttackDrone`) or a NEUTRALIZED
    label once destroyed. Resolved the ticket's own open framing question
    (one Operations Center tab vs. two full separate top-level windows)
    with the pragmatic default it already named: a new Operations Center
    section, keeping one unified control panel rather than a larger
    screen-layout redesign. Also resolved "two new buttons" pragmatically
    as one RECON DRONE button plus a per-node ATTACK button (rather than
    one generic LAUNCH ATTACK DRONE button needing a separate target
    picker), since Attack Drone's target is a specific discovered node,
    not a free choice.
  Also fixed a real pre-existing bug while wiring the naming pool:
  `nameCounters` was still missing `attackDrone` - added it (same class of
  bug as LRNA-038's `emp`/`drone` fix).
- **LRNA-045** — DONE — Click-to-track a missile directly on the
  battlefield, not just its ACTIVE CONTACTS row. `canvas`'s mousedown no
  longer clears `followId` immediately on press; the click-vs-drag
  decision is deferred to mouseup/touchend (`dragConfirmed`, tracked
  against `CLICK_MOVE_THRESHOLD`). A genuine drag still clears `followId`
  the instant it's confirmed (as soon as movement exceeds the threshold,
  not waiting for release) so the camera-follow lerp never fights the
  manual pan. A genuine click/tap hit-tests against each live missile's
  actual on-screen position (`hitTestMissile`, reusing the exact
  `m.x - camX` / `vh()/2 + m.laneY + weaveOffset(m) - altitude(m)` math
  `render()` already uses to draw it) within `MISSILE_HIT_RADIUS` - a hit
  sets `followId` (identical effect to clicking its ACTIVE CONTACTS row);
  no hit falls back to the previous deselect behavior. Same treatment on
  `touchstart`/`touchmove`/`touchend` for mobile parity, with a larger
  hit radius for touch. Verified directly (instrumented build): clicking
  a missile's drawn screen position sets `followId` to that missile;
  clicking empty space clears it; a real drag starting exactly on a
  tracked missile still clears tracking rather than fighting the pan;
  confirmed on both desktop mouse and mobile touch emulation, zero
  console errors.
- **LRNA-059** — DONE — Smoke trail graphics upgrade. Picked two concrete
  effects from the ticket's own candidate list rather than leaving
  "accurate" undefined: trail density/puff-lifetime now scale with the
  missile's live speed (`Math.abs(m.vx) / 700`, already varying per-frame
  since LRNA-033's burn/coast profile - faster puffs spawn more often and
  last longer), and burn/coast-profile missiles (FAST/MEDIUM/LONG
  RANGE/CLUSTER) trail a visibly different color per phase: thicker,
  darker, warmer smoke (`#5a4a42`, occasionally double-puffing at high
  speed) while accelerating, fading to a thin, pale trail (`#c9e8ff`)
  once coasting. Missiles without a burn profile keep the original pale
  trail throughout. Verified directly (instrumented build + screenshots):
  a LONG RANGE shot showed the dark burn-phase color exclusively at
  age 2s (within its 15s burn), and only the pale coast-phase color at
  age 22s (well past burn) - visually confirmed as a dense dark trail
  early and a thin pale dotted trail late, zero console errors.
- **LRNA-064** — DONE — Player 1 manual control + resource + HP-parity
  pass, direct request: "remove all auto play on player 1 - add coins so
  I can launch missiles - make player 1 and 2 have same hp on base."
  - **No more automatic player-side defense.** `getDefender('A')` now
    always returns `null` - AM batteries no longer auto-engage inbound
    enemy strikes. Every player-side counter is now manual only
    (Emergency Counter, Counter Missile's intercept window from LRNA-051,
    Counter Attack Planes) - verified directly: forcing an enemy strike
    and waiting 3s (well past the old 1.1s auto-engage delay) produced
    zero auto-fired counters, while the manual tools still work exactly
    as before (Counter Missile button still opens its window and fires
    correctly). Enemy-side auto-defense (Omega, field targets) is
    unchanged - this was specifically about removing automation from
    the player's own side.
  - **More coins.** `STARTING_COINS` 150 -> 2000 (the whole arsenal is
    reachable immediately instead of grinding up to it) and
    `COIN_PASSIVE_RATE` 2 -> 8 coins/sec, so ongoing play keeps flowing
    too, not just the one-time first-visit grant.
  - **Player 1 / Player 2 HP parity.** Node Omega's HUD readout (top
    bar, the drone recon callout, and the TARGETS list) now shows the
    same 0-100 scale as the Strike Platform instead of its raw
    million-node count - both read e.g. "100/100" side by side. Omega's
    actual underlying damage model (the full raster node-count driving
    its crater visuals) is unchanged; only the *displayed* number is
    normalized so the two bases read as symmetric at a glance.
  Verified directly (instrumented build + screenshot): fresh game shows
  STRIKE PLATFORM 100/100 and NODE OMEGA 100/100 side by side, ~2,000
  starting coins with every launch-bar button enabled immediately, zero
  console errors.
- **LRNA-064 follow-up** — DONE — two of LRNA-064's three changes got
  walked back after live playtesting feedback:
  - **AM battery auto-defense restored as a weak fallback.**
    `getDefender('A')` went back to `amNodes.find(...)` - fully manual
    defense read as "too punishing" under a real enemy wave. AM
    batteries only hit 15% of the time (`AM_NODE_HIT_CHANCE`), well
    below the manual tools' 75%, so this is a real safety net, not a
    return to auto-solving encounters - the manual tools (Emergency
    Counter, Counter Missile, Counter Attack Planes) are still where the
    real defense happens. Verified directly: forcing an enemy strike now
    produces an auto-fired counter attempt again.
  - **Omega's big node count is back, alongside the 0-100 parity
    number**, not instead of it - "the epic scale of chipping away at a
    million-node base" was worth keeping. HUD now reads e.g. "NODE OMEGA
    — 100/100 (478,575 nd)" - both numbers, side by side, same spot the
    single normalized number used to be alone.
  - **Base node's role in SEEK AND DESTROY confirmed as-is** (toughest
    target alongside Attack/Counter, nothing more) - no change needed,
    noted here since it was asked about in the same feedback round.
  Verified directly (instrumented build + screenshot): repo copy shows
  "NODE OMEGA — 100/100 (478,575 nd)" and a real auto-fired counter
  missile after forcing an enemy strike, zero console errors.
- **LRNA-069** — DONE — Remove passive healing from the Strike Platform,
  direct request. `nodeA.health` no longer regenerates over time -
  damage taken is now permanent for the rest of the run. The REINFORCED
  HULL upgrade (`hullrepair`, +0.4 hp/sec) only ever bought more of this
  regen, so it's removed too rather than left as a dead purchase that
  does nothing - `currentHullRegen()` and the upgrade entry are both
  gone. Node Omega's own crater self-repair (`updateOmegaRepair`,
  LRNA-020) is a different, separate mechanic and untouched - this was
  specifically about the player's own base ("healing from base," and
  the Strike Platform is what's consistently meant by "base" throughout
  this session). Verified directly: forcing the Strike Platform's health
  to 40 and waiting 4s in a live session left it at exactly 40 (no
  regen), and REINFORCED HULL no longer appears in the Reactor Upgrades
  list, zero console errors.
- **LRNA-070** — DONE — Node loadout screen: pick 3 Counter nodes, place
  them at 25%/50%/75% corridor (GitHub `owner-action/Alert#427`, spec
  LRNA-046/LRNA-049). First of 6 owner-authored issues (#427-432)
  answering most of the open Attack/Counter/Intel backlog below - built
  in the suggested order, pushed after each one.
  - **Start screen**: the old "click/press any key to open Strike
    Control" overlay gesture is gone. The overlay now shows a loadout
    picker (3 `<select>`s, one per slot) and an explicit START MISSION
    button right under the title/tag line - nothing launches, no enemy
    timer runs, and no stray click/keypress/touch can skip it (all the
    `if (!running) startDemo()` shortcuts on the launch bar, canvas,
    minimap and keydown handlers were changed to a plain no-op while the
    Start screen is up). Loadout choices persist to `localStorage`
    (`lrna_loadout_v1`) and are changeable any time from the Start
    screen.
  - **3 node kinds** (`LOADOUT_NODE_TYPES`), duplicates allowed:
    - Ground Missile Launcher (`gml`) — 40% hit — engages FAST/MEDIUM
      enemy strikes only, not LONG RANGE-sized ones.
    - Machine Gun Anti-Air (`mgaa`) — 35% hit — engages every inbound
      size (FAST/MEDIUM/LONG RANGE), the only one of the 3 that can
      touch LONG RANGE strikes alongside Counter Battery.
    - Counter Battery (`cb`) — 60% hit — engages every size, but only
      while cycled "on"; `COUNTER_BATTERY_CYCLE = 30` seconds on, 30 off,
      repeating, shown on its label under the sprite (`ON`/`OFF`) and via
      a solid vs. faded coverage ring.
    - Resolved reading of the reference table: the game currently only
      has one inbound enemy archetype (`enemyStrike`, sized
      fast/medium/large via `sizeKey`) - "missiles"/"planes" collapse
      onto fast+medium, "large planes (bombers/LONG RANGE)" is the
      `large` sizeKey, and "drones" has no inbound analog yet (moot for
      now, both drone-aware nodes simply never see one). This is the
      concrete rule going forward: `LOADOUT_NODE_TYPES[key].engages
      (sizeKey)`.
  - **Placement**: 3 fixed corridor slots at `nodeA.x + f * (nodeO.x -
    nodeA.x)` for f = 0.25/0.5/0.75 (`LOADOUT_SLOT_FRACS`), independent
    of the 5 always-on AM batteries. No range gating, same as those AM
    batteries (`getDefender` isn't distance-checked either) - a
    placed node can engage anything inbound regardless of how far it
    is from the threat.
  - **Mechanic**: reuses `fireCounter` (LRNA-017's shared seeking-missile
    pattern), not the flak system. Each node independently tracks a
    small per-node fire cooldown (1.1-1.6s, `LOADOUT_NODE_TYPES[key]
    .cooldown`) and picks the soonest-to-impact still-eligible-and-
    unengaged-by-it `enemyStrike`; `m.loadoutHitBy[node.id]` stops the
    same node double-engaging one missile but lets different nodes each
    take their own shot at it (they stack, they don't share one attempt).
  - New sprite (`drawLoadoutNode`) - a squat bunker silhouette, distinct
    from the AM batteries' tripod turret, with the ON/OFF label under
    Counter Battery instances.
  - Explicitly out of scope here (later issues in the set): tokens
    (#429), waves (#430), the new Attack/Counter/Intel button bar
    (#431), difficulty (#428, see LRNA-071 next), Omega's own counters +
    new EMP jam (#432), Counter Measures Zone, Radar Lane.
  - Verified with an instrumented Playwright build: Start screen blocks
    play until START (stray clicks/keys no-op while it's up); changing a
    slot's `<select>` persists to `localStorage`; loadout nodes land at
    the exact expected x (4660/9000/13340 on this map); forcing one
    `enemyStrike` of each `sizeKey` shows GML+MGAA+CB all engage FAST and
    MEDIUM, but only MGAA+CB (not GML) engage LARGE; forcing Counter
    Battery's cycle timer to flip confirms it stops engaging while OFF
    and a second CB instance in another slot keeps engaging on its own
    independent cycle; zero console errors on both the scratch build and
    the shipped repo copy. Portal card and `/play/longrange/` unaffected
    (`portal-game.json` untouched).
- **LRNA-071** — DONE — Easy/Normal/Hard difficulty on the Start screen
  (GitHub `owner-action/Alert#428`). Second of the 6 owner-authored
  issues. A row of 3 buttons under DIFFICULTY (above the LRNA-070
  loadout picker) picks the mode, persisted to `localStorage`
  (`lrna_difficulty_v1`), default NORMAL.
  - `DIFFICULTIES` map holds all 4 multipliers from the issue's table;
    NORMAL's own numbers are byte-for-byte what the game already did
    before this ticket, so a NORMAL run is unchanged:
    - `intervalMult` scales `ENEMY_STRIKE_INTERVAL` (1.6/1.0/0.6).
    - `sizeMix` replaces `pickEnemyStrikeSize`'s hardcoded 0.4/0.75 cut
      points with a per-difficulty `[fastCut, mediumCut]` pair - Easy
      [0.75, 0.95] (mostly FAST), Hard [0.15, 0.55] (mostly
      MEDIUM/LARGE).
    - `resourceMult` scales the *one-time* `STARTING_COINS` grant a
      genuinely fresh player gets. Scoped decision: this game's coin
      balance already persists across resets (LRNA-069's economy,
      unlike a re-granted per-run currency), so there's no "starting
      resources" moment on every run to scale yet - that lands
      naturally once #429 replaces this with a real 3-token economy
      that's earned per wave.
    - `interceptMult` scales Omega's own interceptor hit chance against
      the player's outgoing missiles (`nodeO.hitChance`, set in
      `reset()` from `COUNTER.hitChance * interceptMult` - previously
      nodeO had no explicit hit chance and silently fell back to
      `COUNTER.hitChance` for every difficulty).
  - Mode shown in the HUD (`GAME MODE` panel, e.g. "SANDBOX — free play,
    no timer · HARD DIFFICULTY") and in RUN STATS (`Difficulty: HARD`
    row).
  - Wave-size scaling noted in the issue as a follow-up once #430 lands
    - not attempted here, no wave system exists yet.
  - Verified with an instrumented Playwright build: 3 difficulty buttons
    render with NORMAL active by default; picking HARD persists to
    `localStorage` and immediately shows in both the HUD and RUN STATS;
    `nodeO.hitChance` reads exactly `0.5 * 1.2 = 0.6` on HARD; a 4,000-
    sample `pickEnemyStrikeSize` run on HARD skews clearly toward
    MEDIUM/LARGE (569 FAST vs. 3,431 MEDIUM+LARGE); a simulated
    (non-realtime, `update()` driven) 2-minute run launched 7 Omega
    strikes on HARD vs. 4 on EASY under the same budget - the
    "clearly more" bar from the issue's done-when; zero console errors
    on both the scratch build and the shipped repo copy.
- **LRNA-072** — DONE — Waves of Battle: endless waves, score = waves
  survived (GitHub `owner-action/Alert#430`). Third of the 6
  owner-authored issues, built ahead of #429 per the suggested order
  (waves land before tokens so token payouts have a wave to attach to).
  - Replaced the continuous `ENEMY_STRIKE_INTERVAL` trickle with a wave
    director (`updateWaveDirector`, `startWave`, `waveStrikesInFlight`).
    Wave N sends `round((3 + N) * DIFFICULTIES[difficulty].waveSizeMult)`
    strikes (new multiplier: easy 0.75, normal 1.0, hard 1.35), spaced by
    `ENEMY_STRIKE_INTERVAL()` - repurposed from "gap between every
    standalone strike" (16-30s) to "gap between strikes within one wave"
    (3-7s, same `intervalMult` scaling as before) so a wave actually
    arrives as a wave instead of trickling in over minutes.
  - Size mix shifts toward MEDIUM/LARGE as the wave number climbs:
    `pickEnemyStrikeSize` now applies a small shift on top of the
    difficulty's own `sizeMix` cut points, capped at 0.35, zero at wave 1
    (so LRNA-071's already-verified wave-1 distribution is unchanged).
  - A wave "clears" once every strike in it has both launched and
    resolved (impacted, intercepted, or expired), verified via
    `waveStrikesInFlight()` rather than a fixed timer. `WAVE_CLEAR_COINS`
    (150) pays out - until #429's token economy lands this is coins, as
    the issue says to do. A ~10s break (`WAVE_BREAK_SECONDS`) follows,
    shown as a "WAVE N CLEARED — NEXT WAVE IN Xs" banner in the new
    `#waveHud` element (top-center HUD, under the coin display).
  - Endless: destroying Node Omega is a bonus (`WAVE_OMEGA_BONUS_COINS`,
    600 coins) and a rebuild, not a win - `onOmegaDestroyedForWaves()`
    restores `omegaRemainingNodes` to full and nudges Omega's own
    interceptor hit chance up slightly (`nodeO.hitChance`, capped at
    0.85) each time it comes back, so later rebuilds are measurably
    tougher. The run only ends when the Strike Platform falls
    (`nodeA.health <= 0`, caught at the same impact-resolution site the
    coin-reward/destroy-bonus logic already lived at).
  - Run end (`triggerRunEnd`) shows a new "MISSION FAILED" screen
    (`#waveResultScreen`, styled like the existing SIEGE result screen
    but its own always-on modal, independent of SIEGE mode) - "SURVIVED
    WAVE N", best wave, warheads fired, intercepts. Best wave persists to
    `localStorage` (`lrna_best_wave_v1`) and shows both on the Start
    screen (`BEST WAVE: N`, above the difficulty picker) and in RUN
    STATS. RETURN TO START goes back through the Start screen (loadout +
    difficulty still there, LRNA-070/071 unaffected) rather than
    auto-restarting, consistent with "new run always opens Start screen."
  - Verified with an instrumented Playwright build, driving `update()`
    directly (not real wall-clock) to fast-forward: wave 1 sent exactly
    4 strikes, wave 2 sent 5, wave 3 sent 6 on NORMAL (matches `3+N`);
    forcing Omega's rebuild restored it to full nodes, incremented its
    hit chance (0.50 → 0.55), and bumped a rebuild counter; forcing the
    Strike Platform to 0 HP and triggering run-end showed "SURVIVED WAVE
    3" with the right best-wave/stats text, stopped `running`, and
    RETURN TO START correctly reopened the Start screen with "BEST WAVE:
    3" now showing. Zero console errors on both the scratch build and
    the shipped repo copy.
- **LRNA-073** — DONE — Three token types replace the single coin
  (GitHub `owner-action/Alert#429`). Fourth of the 6 owner-authored
  issues, built after waves (LRNA-072) per the suggested order so wave
  clears have something to pay out into.
  - Three pillars replace `coins`: **Attack** (red `#ff5a36`), **Counter**
    (yellow `#ffe066`), **Intel** (blue `#35e6ff`) - `tokens = {attack,
    counter, intel}`, `TOKEN_META`/`ABILITY_PILLARS`/`TOKEN_REWARDS` are
    the single source of truth for which pillar everything spends from
    or earns into.
  - **Spending** (`ABILITY_PILLARS`): FAST/MEDIUM/LONG RANGE/CLUSTER/EMP
    → Attack; DRONE and ATK DRONE → Intel; Counter Missile/Counter
    Attack Planes → Counter. **Emergency Counter now costs 150 Counter**
    (`EMERGENCY_COUNTER_COST`) - it was free before this ticket, but the
    issue explicitly lists it alongside the other two Counter abilities.
    Reactor Upgrades each got a `pillar`: overcharge/ammobay → Attack
    (boost the player's own offense), interceptor → Counter (boosts a
    defensive stat), reactor → Intel (repurposed, see below).
  - **Earning** (`TOKEN_REWARDS`, applied literally by action type per
    the issue's wording): every warhead hit/kill pays Attack (even a
    recon DRONE's small hit or an ATK DRONE's kill); every successful
    intercept pays Counter; a fresh AntiPlane/Seek&Destroy node
    **discovery** pays Intel (`INTEL_DISCOVERY_REWARD`, 25) - a genuinely
    new earn trigger this ticket adds, since discovery itself paid
    nothing before. Wave clears (LRNA-072) pay all three pillars
    (`WAVE_CLEAR_TOKEN_REWARD`, 60 each); Omega's rebuild bonus
    (`WAVE_OMEGA_BONUS_TOKENS`, 600) is a kill bonus, so it's Attack only.
  - **Starting amounts**: a genuinely fresh player's grant is still
    `STARTING_TOKENS_TOTAL` (2000) scaled by difficulty's `resourceMult`
    (LRNA-071), same total as before, now split evenly 3 ways - matches
    the issue's "starting total ≈ today's 2000 on Normal."
  - **Migration**: an existing single-coin save (`lrna_coins_v1`)
    converts once, split evenly, on first load after this ticket, then
    the old key is deleted so it can't re-trigger. `lrna_lifetime_coins_v1`
    migrates the same way into the new combined `lifetimeTokensTotal`
    (RUN STATS still shows one combined "Lifetime tokens earned" number,
    not a 3-way breakdown - scoped down, not asked for).
  - **Passive trickle - recorded choice**: kept, not removed, but cut
    from the old single-currency 8/sec down to 1/sec per pillar
    (`TOKEN_PASSIVE_RATE`) - waves and per-action rewards now carry most
    of the economy, but this game has a real prior bug (a genuinely
    fresh player stuck at 0 spendable currency before their first
    reward) that a full removal risked reintroducing, especially with
    the balance now split 3 ways. REACTOR BOOST's old "+1 cell/sec"
    doesn't mean anything with 3 separate balances, so it's repurposed
    as "+1 Intel/sec" (`currentIntelPassiveRate`), priced from Intel.
  - HUD: the old single `#coinDisplay` is now `#tokenHud`, three
    colored chips (top-center, under the title). Every button's static
    cost label (launch bar, reactor upgrades, Counter Missile window,
    recon drone buttons) now names its pillar so the color-coding reads
    without hovering.
  - Verified with an instrumented Playwright build: a fresh profile
    split ~2000 into 666/666/668; a seeded legacy `lrna_coins_v1=900`
    save converted to exactly 300/300/300 and the old key was gone
    afterward; the FAST button was disabled at 0 Attack tokens and
    enabled at 5000, while DRONE stayed disabled on 0 Intel in the same
    state (each button gated only by its own pillar); a Counter-pillar
    earn and an Intel-pillar earn both landed in the right balance;
    buying the REACTOR BOOST upgrade spent exactly 250 from Intel, not
    another pillar; Emergency Counter refused to fire at 0 Counter
    tokens and fired (spending exactly 150) once funded. Zero console
    errors on both the scratch build and the shipped repo copy.
- **LRNA-074** — DONE — Attack/Counter/Intel button bar replaces the
  launch bar, with an INCOMING alert (GitHub `owner-action/Alert#431`).
  Fifth of the 6 owner-authored issues, built after tokens (LRNA-073)
  so each group has its own live token count to show.
  - The old flat `#launchButtons` row is gone. `#abilityGroups` now
    holds 3 `.abilityGroup` columns, one per pillar, each with a colored
    header (`ATTACK` red / `COUNTER` yellow / `INTEL` blue) showing that
    pillar's live token count (`groupTokenAttack/Counter/Intel`,
    mirrored from the same `updateTokenHud()` that already drives the
    top-center HUD chips - one source of truth, two render targets).
    ATTACK holds FAST/MEDIUM/LONG RANGE/CLUSTER/EMP; COUNTER holds
    Counter Missile, Counter Attack Planes, and **Emergency Counter**
    (moved out of its old floating top-left position into this group,
    same button/id/logic, just relocated and restyled to match the
    other launch-bar buttons); INTEL holds DRONE (Satellite joins
    later, per the issue).
  - **INCOMING alert** (`#incomingAlert`, above the groups): shows the
    soonest inbound `enemyStrike`'s name/size/ETA, colored green (>20s)
    /yellow (5-20s)/red (<5s) - matching Emergency Counter's own 5s
    reaction window - or a dark "NO INBOUND THREATS" with nothing
    inbound. Clicking it sets `followId` to that threat, same as
    clicking its ACTIVE CONTACTS row. Refreshed every frame alongside
    `updateWaveHud()`. Note for later tuning: today's enemy strikes cap
    at 20s ETA (`large`, LRNA-072/071's `ENEMY_STRIKE_SIZES`), which is
    exactly the yellow/green boundary - in practice the alert will
    almost always start in yellow at best and never actually reach
    green until something inbound flies longer than 20s.
  - **Keyboard shortcuts**: none existed on any launch-bar button before
    this ticket (checked directly - the issue's "keeps its keyboard
    shortcut" presumed something that wasn't actually there), so this
    adds 1-9 across the 9 buttons in reading order (ATTACK group, then
    COUNTER, then INTEL) rather than "preserving" anything, and shows
    the assigned digit in each button's corner (`.btnKey`).
  - Every button kept its existing cost/cooldown/ETA display text and
    disabled-state logic untouched - only its container moved.
  - Phone width: `.abilityGroup` wraps into its own column via flexbox
    (`flex: 1 1 260px`), same as the old bar's own button-wrapping.
  - Verified with an instrumented Playwright build: 3 groups render
    with the right buttons in each (5 ATTACK / 3 COUNTER including
    `emergencyBtn` / 1 INTEL); a group header's token count matches the
    top HUD chip exactly; the alert shows nothing with no inbound
    threats, green on a synthetic 30s-remaining inbound (isolating the
    tier boundary the real 20s-cap strikes can't reach), and red on a
    forced close one, with a click correctly tracking it
    (`followId` matched); shortcuts "1" and "9" fired real FAST/DRONE
    launches through the normal `attemptFire` pipeline (`stats.fired`
    incremented each time); shortcut "8" correctly dispatches to the
    relocated Emergency Counter button; at 375px width the page's
    scrollWidth never exceeded the viewport width (no sideways scroll).
    Zero console errors on both the scratch build and the shipped repo
    copy. Screenshot: https://claude.ai/artifact/VsNis2X4icPuC9DacQxd4m
- **LRNA-075** — DONE — Omega gets Counter Missile + Counter Attack
  Planes; a new, separate EMP jam shuts them off for 15s (GitHub
  `owner-action/Alert#432`, finishes **LRNA-044**). Last of the 6
  owner-authored issues.
  - Omega now mirrors the player's own Counter Missile (LRNA-041/051)
    and Counter Attack Planes (LRNA-035/040) exactly: same 75% hit
    chance each, no size gate (neither player ability has one - that
    exclusion belongs to Emergency Counter alone, which Omega doesn't
    get a mirror of). Free - Omega doesn't spend from the player's
    token economy, it's gated by its own cooldowns instead
    (`OMEGA_COUNTER_MISSILE_COOLDOWN` 6s, `OMEGA_COUNTER_PLANES_COOLDOWN`
    10s), defined beside the player's own constants so they're easy to
    tune together.
  - **AI reaction delay**: "~1-2s after a player warhead enters range"
    is tracked per-missile (`m.omegaReactionDelay`, randomized
    1-2s the first time a missile is seen) and checked against the
    missile's own `age` - the same shape the AM batteries already use
    (`m.age > 1.1`) rather than a new mechanic. `omegaCounterCandidates()`
    is the shared soonest-to-impact target list both abilities draw
    from, re-fetched between the two so they never claim the same
    target in one tick.
  - **New, separate jam** (`omegaCountersJamTimer`, `OMEGA_COUNTERS_JAM_
    DURATION` = 15s): set alongside (not replacing) the existing
    `empGlobalJamTimer` (LRNA-037) whenever a player EMP lands - that
    older jam still covers Omega's point defense/field targets exactly
    as it did before this ticket. While jammed, Omega's counter
    cooldowns keep ticking down (so an ability can fire again promptly
    once the jam lifts rather than needing a full extra cooldown on top
    of the 15s) but no new counter fires. Shown as "COUNTERS JAMMED
    0:15" near the NODE OMEGA HUD panel (`#omegaJamStatus`) and as a
    second, pink pulsing ring around Omega on the map (distinct from
    the existing yellow point-defense jam ring - both can be up at
    once and both read clearly; the name label under Omega also lists
    both jams by name when they overlap).
  - Drawn in Omega's own palette (`#ff2ea6`, reusing the generic
    `drawIcon`/counter-missile render path unchanged) and listed in
    ACTIVE CONTACTS automatically - that list and its `DEF` role label
    were already origin-agnostic, no changes needed there.
  - **Bug found and fixed along the way**: `updateLoadoutNodes` (LRNA-070)
    was checking `empGlobalJamTimer` unconditionally, so a player's own
    landed EMP was wrongly jamming their *own* loadout nodes too - the
    AM batteries got this right from the start (`updateFlak` only
    checks that jam for `faction === 'enemy'`), loadout nodes now match.
  - Verified with an instrumented Playwright build: a player LARGE
    launch drew an Omega counter well within the reaction window;
    ACTIVE CONTACTS listed it with role DEF in Omega's pink; forcing an
    EMP-style jam set the new timer to 15, showed the HUD countdown,
    and produced zero new Omega counters across a further 10 simulated
    seconds with fresh targets available; after the jam fully expired
    the HUD cleared and Omega resumed firing (confirmed reaching a
    freshly-launched target, working through a backlog of targets that
    had piled up during the jam first - correct priority-order
    behavior, not a bug); a forced player EMP jam no longer stopped the
    player's own loadout nodes from engaging a fresh inbound strike
    (the bug fix above, confirmed directly). Zero console errors on
    both the scratch build and the shipped repo copy.

**All 6 owner-authored GitHub issues (#427-432) shipped**, in the
suggested order: #427 (LRNA-070), #428 (LRNA-071), #430 (LRNA-072), #429
(LRNA-073), #431 (LRNA-074), #432 (LRNA-075/LRNA-044). Each was claimed,
built, verified with an instrumented Playwright build, shipped to
`claude/practical-keller-49onif`, and closed individually the same night.
Three more followed the same night (#433-435, below).
- **LRNA-076** — DONE — Radar Lane: every contact with its distance on
  the 0-1000 scale (GitHub `owner-action/Alert#433`). 7th of 9
  owner-authored issues overall (first of a second batch of 3). The
  **Counter Measures Zone half of LRNA-046 is explicitly dropped**
  (marked there) — the owner wants no automatic play on the player's
  side (LRNA-064), and an always-on auto-intercept zone runs directly
  against that.
  - Absorbs the old ACTIVE CONTACTS panel rather than sitting beside
    it — same panel, retitled, with a distance/speed/type breakdown per
    contact plus a new thin lane strip (`#radarLaneTrack`) with one dot
    per contact, positioned by the same 0-1000 scale.
  - `dist1000(x)` maps map coordinates to the 0-1000 scale (0 = Strike
    Platform `nodeA`, 1000 = Node Omega `nodeO`), the same proportional
    mapping LRNA-046 already specified for the loadout slots.
    `radarContacts()` is the single source of truth both the list and
    the lane track render from.
  - **Visible contacts**: every live missile (unconditional, exactly as
    ACTIVE CONTACTS always showed them - nothing about flight objects
    was ever gated by discovery) plus AntiPlane (LRNA-039) and SEEK AND
    DESTROY (LRNA-063) nodes, but **only once `.discovered`** - genuinely
    new: those static threats were never listed in a HUD panel before
    this ticket. This is what gives "visible" and "discovered" real
    meaning here, per the issue's done-when about nothing hidden
    showing early.
  - Click-to-track extended, not replaced: a missile contact still sets
    `followId` exactly as before; a static node contact (not a missile,
    nothing for the camera to "follow") instead centers the camera on
    it directly. Works from both the list row and its lane dot.
  - Verified with an instrumented Playwright build: a forced LARGE
    enemy strike's listed distance decreased smoothly and monotonically
    from ~950 toward 0 as it closed in; zero node-kind contacts appeared
    before a forced discovery, exactly one afterward (the discovered
    one); clicking a missile row set `followId` correctly, clicking a
    node row panned the camera and left `followId` null; both the real
    DOM row click and its matching lane dot worked; no horizontal
    scroll at 375px width. Zero console errors on both the scratch
    build and the shipped repo copy.
- **LRNA-077** — DONE — Satellite: a 4th loadout node, reveals the whole
  map (GitHub `owner-action/Alert#434`, finishes the Satellite half of
  **LRNA-048**). 8th of 9 owner-authored issues overall.
  - `LOADOUT_NODE_TYPES.satellite` — a genuinely different 4th choice
    from the 3 combat nodes (LRNA-070/#427): `vision: true` instead of
    `hitChance`/`engages`/`cooldown`, and `updateLoadoutNodes` skips any
    node with that flag entirely, so it has zero combat behavior by
    construction rather than by a bunch of disabled stats.
  - **Global effect, any slot**: `hasSatellite()` is a plain "is
    'satellite' anywhere in `loadout`" check, not tied to which of the 3
    slots it's placed in. `initAntiPlaneNodes()`/`initSeekDestroyNodes()`
    (LRNA-039/063) now seed `discovered: hasSatellite()` instead of
    always `false` - a write-once fix at node creation, so every
    existing `.discovered` read throughout the game (Intelligence panel,
    SEEK AND DESTROY panel, the Radar Lane from LRNA-076) picks it up
    automatically with no further changes needed anywhere else.
  - **Drone discoveries with a Satellite in play — recorded decision:
    worth nothing.** Not a special case: `updateDroneDiscovery`'s own
    existing skip (`if (ap.discovered || ap.destroyed) continue`)
    already excludes every node once a Satellite has set `discovered`
    true from the start, so the Intel-token discovery reward
    (LRNA-073's `INTEL_DISCOVERY_REWARD`) simply never has anything left
    to trigger on - there's nothing left to discover. DRONE itself still
    flies, still costs Intel, and other Intel-pillar effects are
    untouched.
  - **A second Satellite adds nothing, and the picker says so**: a new
    `#satelliteWarning` line appears on the Start screen the moment 2+
    slots hold `'satellite'`, and disappears again the moment they don't
    - checked on every loadout `<select>` change, not just at load.
  - Drawn distinctly (`drawSatelliteLoadoutNode`) rather than reusing the
    bunker sprite: a ground uplink dish at its slot plus a small
    satellite silhouette (body + two solar panels) high in the sky above
    the same x, joined by a faint dashed downlink beam - the "sees the
    whole battlefield" effect made visible on the map itself, in the
    Intel pillar's blue.
  - Verified with an instrumented Playwright build: without a Satellite,
    every AntiPlane/SEEK AND DESTROY node starts undiscovered and the
    Radar Lane shows zero node-kind contacts, exactly today's rules;
    with one in the loadout (persisted through a reload to confirm it
    survives a real run start, not just an in-memory flag), all 5 nodes
    (2 AntiPlane + 3 SEEK AND DESTROY) read `discovered: true` and
    appear on the Radar Lane from the very first frame; the loadout-node
    list itself confirmed the Satellite entry as `vision: true` with no
    combat stats; the duplicate-Satellite warning toggled correctly on
    (2 selected) and back off (reverted to 1) across real `<select>`
    interactions. Zero console errors on both the scratch build and the
    shipped repo copy.
- **LRNA-078** — DONE — Plane arsenal: attack, intel and counter planes
  that fly back and rearm (GitHub `owner-action/Alert#435`, finishes
  LRNA-047's "Plane Class"). 9th and last of the owner-authored issues
  from tonight.
  - **Resolved ambiguity**: LRNA-047 had flagged "Plane Class" as either
    a labeling change (FAST/MEDIUM/LARGE already render as attack
    planes/bombers) or a genuinely separate parallel arsenal. Owner
    decision: separate arsenal, with its own scoping choice on this end
    - **one aircraft per type, not an infinite-fire button**. "Fly back
    and rearm" reads as a persistent, limited asset, not a spam-fire
    consumable like the missile `TYPES`, so each plane button is
    disabled while its one aircraft is away or rearming, not gated by a
    per-shot cost check alone.
  - **Final tuned roster** (`PLANE_TYPES`, tuned during build/test, not
    left at the issue's starting-point numbers):

    | Plane | Pillar | Out/back | Job | Cost |
    |---|---|---|---|---|
    | Strike Fighter | Attack | 10s | 300 dmg; dodges Omega's first shot at it each flight | 150 |
    | Strike Bomber | Attack | 20s | 700 dmg | 350 |
    | Heavy Bomber | Attack | 30s | 1200 dmg; Omega gets +15% hit chance vs. it (easy target) | 550 |
    | Recon Plane | Intel | 20s | force-discovers the nearest undiscovered AntiPlane/SEEK AND DESTROY node | 40 |
    | Interceptor Jet | Counter | 10s | chases the soonest inbound enemy strike, 75% kill | 250 |

    Rewards follow the same rules #429 already set: attack planes earn
    Attack tokens on a landed hit (`dmg/10`, plus the usual destroy
    bonus on a kill), Recon Plane's discovery earns Intel
    (`INTEL_DISCOVERY_REWARD`), Interceptor Jet's kill earns Counter
    (`TOKEN_REWARDS.intercept`) - reusing #429's existing pillar-reward
    machinery rather than inventing a parallel one.
  - **Flight model**: represented as `missiles` entries (`typeKey:
    'plane'`), a genuinely different physics branch from every ballistic
    missile type - constant-velocity out to its job (or, for Interceptor
    Jet, chasing its live target rather than a fixed point), then a
    second return leg back to the Strike Platform, landing safely frees
    the slot for `PLANE_REARM_COOLDOWN` (5s) before it's `ready` again.
    Being represented as ordinary missiles means Radar Lane visibility,
    camera-tracking, minimap dots and the smoke-trail system all came
    for free from existing shared code - no parallel rendering/tracking
    path needed.
  - **Shot down by Omega's defences, with the same plane/missile filters
    #427's nodes have**: `omegaCounterCandidates()` (LRNA-075/#432) now
    takes an `includePlanes` flag - Omega's Counter Missile stays
    missiles-only (mirrors GML), Counter Planes takes both (mirrors
    MGAA/the player's own Counter Attack Planes having no restriction).
    Strike Fighter's dodge and Heavy Bomber's easy-target bonus are
    applied right where Counter Planes picks its targets.
  - **Real bugs found and fixed while building this** (both would have
    made planes function incorrectly, not cosmetically):
    - The older generic per-destination auto-defend loop
      (`getDefender(m.destId)`, pre-dates the pillar system) had no
      typeKey concept and was catching planes too, shooting most of them
      down within ~1s of launch - well before Omega's own new dedicated
      counters (with their proper 1-2s reaction delay) ever got a turn.
      Excluded `typeKey === 'plane'` from that older loop; planes are
      now defended against by Omega's Counter Missile/Planes alone.
    - `fireCounter`'s seeking-interceptor window (`COUNTER.totalSeconds`,
      6s) was tuned around missiles that have already closed most of the
      map by the time anything shoots at them. A plane launched fresh
      from the Strike Platform can still be a near-full-map away when
      Omega's counter fires, and a slow Heavy Bomber's closing time with
      an interceptor is ~12s - well past the old 6s window, so every
      shot at a plane reliably timed out before ever reaching it. Planes
      now get a 20s window instead (confirmed by direct measurement:
      worst case closes in ~12-13s, comfortably inside 20s).
  - Verified with an instrumented Playwright build: all 5 plane types
    launched successfully and appeared on the Radar Lane with their
    correct type label; with Omega's counters temporarily jammed to
    isolate job-resolution from interception, attack planes landed
    (Omega's node count dropped), the recon plane force-discovered a
    hidden node, and the interceptor jet logged a real intercept, all
    earning the right pillar's tokens; every surviving plane returned
    and rearmed back to `ready`, then launched again; a deterministic
    guaranteed-hit Omega Counter Planes shot destroyed a fresh Heavy
    Bomber outright and correctly freed its slot for a rearm, same as a
    safe landing. Zero console errors on both the scratch build and the
    shipped repo copy.
- **LRNA-079** — DONE — Both players' health pool bumped from 100 to 250
  (direct request after live playtest: "fix both players health to
  250"). New shared constant `PLAYER_MAX_HEALTH = 250` replaces every
  hardcoded 100-scale reference for the HUD readout, bar-width math, the
  Counter Missile Intercept window, drone-recon float text, and the
  target-list display, for both the Strike Platform (`nodeA.health`,
  which is real/authoritative) and Node Omega (whose real damage model
  is still `omegaRemainingNodes`/`OMEGA_TOTAL_NODES` — its 0-250 number
  is a display-only normalization onto the same scale, unchanged
  underneath).
  - **Real bug found and fixed while building this**: `drawNode()` (the
    Strike Platform's pixel-art crumble effect) computed its
    visible-pixel fraction as `node.health / 100` — a second hardcoded
    100-scale reference the initial sweep almost missed, since it isn't
    HUD text. Left un-fixed, the platform wouldn't visually crumble
    until health dropped under 100 (frac stayed clamped at/above 1 for
    the first 150 points of damage). Now divides by `PLAYER_MAX_HEALTH`.
  - **Left alone on purpose**: the static `nodeO.health: 100` field on
    the `nodeO` object literal — confirmed via grep to have zero readers
    anywhere in the file (Omega's real health model is entirely
    `omegaRemainingNodes`-based). It's vestigial/dead, not wired to
    anything this ticket touches, so it was left as-is rather than
    edited for cosmetic consistency. Damage-tier values (`dmg:` on each
    missile/plane type) were also left untouched — the request was to
    raise the health pool, not to rebalance how fast it drains.
  - **Follow-up, DONE (2026-09-25, direct request: "the wealth to
    coordinate with that new base health size"):** closed exactly the
    gap flagged above. Audited every damage number that drains a
    `PLAYER_MAX_HEALTH`-scale pool (grep for `nodeA.health`/`dest.health`
    writers) and found only one: `ENEMY_STRIKE_SIZES.dmg` (fast/medium/
    large, the only source of damage to `nodeA.health` — Omega's own
    Counter Missile/Planes intercept the player's outgoing shots, they
    don't deal impact damage back). Everything else that looked
    health-adjacent turned out NOT to be on this scale and was correctly
    left alone: the player's own `TYPES` dmg values (FAST/MEDIUM/LARGE/
    CLUSTER) drain `omegaRemainingNodes`, a completely separate raw
    pixel-count scale (`OMEGA_TOTAL_NODES`) unrelated to
    `PLAYER_MAX_HEALTH`; field targets (LRNA-011) and SEEK AND DESTROY/
    AntiPlane nodes (LRNA-063) have their own independent hp pools; no
    Reactor Upgrade grants a flat HP amount (REINFORCED HULL, the one
    that used to, was removed entirely by LRNA-069). Scaled
    `ENEMY_STRIKE_SIZES.dmg` by the same 2.5x ratio LRNA-079 itself used
    (100->250): fast 8->20, medium 16->40, large 26->65 - preserves the
    exact original hits-to-kill (fast ~12.5, medium ~6.25, large ~3.85)
    instead of the Strike Platform quietly becoming 2.5x tankier. Verified
    directly (instrumented build, live gameplay, real waves - no
    shortcuts): captured every hit landing on `nodeA` over ~100s of play,
    observed exactly 20/40/65-point hits (five real hits: 20, 40, 65, 40,
    65 - health tracked 250 down to 20, matching the sum precisely), zero
    console/page errors.
  - Verified with an instrumented Playwright build: Strike Platform
    starts at 250/250, Node Omega's HUD shows 250/250 alongside its raw
    node count, both health bars render at a clean 100% with no
    overflow, the Counter Missile Intercept window shows 250/250, and
    after live combat damage the HUD number and bar width both track the
    new 250 scale correctly (e.g. 234/250 → 93.6% bar). Zero console
    errors on both the scratch build and the shipped repo copy.
- **LRNA-081** — DONE — Fixed the bottom menu bar covering the bottom of
  the map on PC screens. `#bottomBar` (minimap + launch bar + ability
  groups) is an opaque panel absolutely positioned over the canvas, not a
  letterboxed-off strip - `canvas.height = window.innerHeight` had no
  idea a good chunk of its own bottom (150-250px+, more on wider/shorter
  windows where ability buttons wrap into extra rows) was about to be
  visually replaced by that panel. Every world-space vertical position
  (`nodeA`/`nodeO`, field targets, missile lanes, the radar-lane
  centerline) was built from `vh()/2` using the *full* window height, so
  the corridor's centerline - and anything drawn below it - could end up
  partly or fully hidden under the menu depending on window size.
  - **Fix**: `resize()` now measures `bottomBarEl.offsetHeight` (its
    actual current rendered height - already varies with content
    wrap/window width) into `bottomBarPx`, and `vh()` returns
    `(H - bottomBarPx) / ZOOM` instead of the raw full height. Every
    piece of gameplay built on `vh()/2` (nodes, lanes, missiles, float
    text, background grid/terrain) now centers within the band that's
    actually visible above the bar, instead of the full window.
  - Scoped to the bottom bar only, per the specific complaint ("cut off
    by menu") - the top `#hud` overlay is small/translucent by
    comparison and wasn't reported as a problem, so it's untouched.
  - Verified with an instrumented Playwright build at two viewport sizes
    (1600×900 and a 1366×768 laptop-style window, where the bottom bar
    covers ~44% of the screen height): both bases, the full radar lane,
    and all field-target markers render fully above the bar with no part
    of the play field hidden underneath it. Zero console errors on both
    the scratch build and the shipped repo copy.
- **LRNA-082** — DONE — Stopped unwanted auto-fire on the player's side
  from holding down a numeric shortcut key. The 1-9 shortcut listener
  (`LRNA-074`) called `btn.click()` on every `keydown` matching a
  shortcut key, with no guard against the browser's own OS-level
  key-repeat - holding a key sends repeated `keydown` events (`repeat:
  true`) for as long as it's held, so a single held keypress fired the
  bound launch/counter button over and over (throttled only by
  `attemptFire`'s existing 350ms/shots-remaining/cost checks), reading
  as the game auto-firing on its own. This is distinct from - and does
  not reopen - `LRNA-064`'s "no auto-play on the player's side," which
  was about a scripted auto-defend loop; there was no such loop for the
  player's side in the current code (confirmed: no `setInterval`, and
  `launchAttack`'s only two call sites are Omega's own strikes and this
  same player-click path), so the fix here is narrowly a key-repeat
  guard - `if (e.repeat) return;` - not a wider defense-economy change.
  - Verified with an instrumented Playwright build: one real keydown
    (`repeat: false`) plus five simulated OS-repeat keydowns (`repeat:
    true`) on the same key now triggers exactly one button click, down
    from six before the fix. Zero console errors on both the scratch
    build and the shipped repo copy.
- **LRNA-083** — DONE — Attack pillar starts at zero and is no longer a
  free grant: it's earned only once a hidden target has been recon'd
  (direct request, delivered in three follow-up messages building on the
  still-open `LRNA-080` recon-opening concept: "Start with Zero Attack
  points - only give attack points once Drone or Plane recon finds a
  target", then "Each target found gives 25 attack coins per second").
  This is a real, playable slice of `LRNA-080`'s spirit - the player
  genuinely can't attack (0 Attack tokens buys nothing) until something's
  been found - without needing that ticket's full 4-zone rework.
  - **Zero starting grant**: the fresh-player and legacy-coin-migration
    paths in `loadTokens()` now force `tokens.attack = 0` after their
    normal split, instead of Attack getting its usual ~1/3 share of
    `STARTING_TOKENS_TOTAL`. Not redistributed to Counter/Intel - their
    shares are unchanged, Attack's share simply isn't granted. A
    returning player's *saved* balance (loaded from `localStorage`) is
    left alone - this governs the starting grant, not a wipe of existing
    progress, consistent with tokens being persistent currency elsewhere
    in this economy (never reset by 'R', etc).
  - **No passive trickle for Attack**: `TOKEN_PASSIVE_RATE` (the small
    1/sec-per-pillar trickle from `LRNA-073`) now only applies to
    Counter/Intel. A new `FOUND_TARGET_ATTACK_RATE = 25` replaces it for
    Attack specifically: every currently-discovered, non-destroyed node
    in `allHuntableNodes()` (SEEK AND DESTROY's 3 + AntiPlane's 2 - the
    game's existing discoverable-target pool) generates 25 Attack tokens/
    sec, stacking per simultaneously-found target, for as long as it
    stays found and alive.
  - **Wave-clear bonus excluded from Attack** (a real loophole caught
    during verification, not explicitly requested but a direct
    consequence of the stated rule): `WAVE_CLEAR_TOKEN_REWARD` (60/
    pillar, `LRNA-073`) fires whenever a wave's incoming strikes are all
    resolved - a defensive survival bonus, not conditioned on ever having
    attacked or recon'd anything. Left paying into Attack, it would let a
    purely defensive player rack up Attack currency for free every wave,
    defeating the entire point of gating it behind recon. Now skips the
    Attack pillar; Counter/Intel are unaffected. `WAVE_OMEGA_BONUS_TOKENS`
    (600, paid on fully destroying Node Omega) was deliberately left
    alone - reaching that point requires having already spent real,
    recon-earned Attack currency to get there, so it's a reward for
    successful attacking, not an unconditioned grant.
  - **Left alone on purpose**: every per-hit/destroy `TOKEN_REWARDS` earn
    (landing a FAST/MEDIUM/LONG RANGE/etc. hit, a destroy bonus, the ATK
    DRONE's discovery-hit reward) still pays into Attack same as before.
    These require the player to already be spending Attack currency to
    attack something in the first place, which - with the zero starting
    grant and no passive trickle - is only possible once the new
    recon-income has bootstrapped some; they read as a partial refund on
    combat already paid for, not a free "give," so they're not in
    conflict with the stated rule and weren't touched.
  - **Verified with an instrumented Playwright build**: fresh Attack
    balance is exactly 0 at game start and stays 0 through 3+ seconds of
    idle time (no passive leak); directly forcing a hidden node's
    `.discovered` flag confirmed the new accrual is a clean, continuous
    25/sec (25, 50, 75, 101, 126... climbing every second) for as long as
    it stays discovered and alive. Separately confirmed (and worked
    around in the test harness) that the in-game Recon Plane is itself
    genuinely at risk of being shot down by Omega's defenses before ever
    reaching its target and discovering anything - consistent with
    `LRNA-078`'s existing "shot down by Omega's defences" design, not a
    bug, but worth noting since it means recon is a real risk/reward
    play, not a guaranteed unlock. Zero console errors on both the
    scratch build and the shipped repo copy.

## Open / backlog

### Backlog (unscoped, pick next)
- **LRNA-080** — DONE (2026-09-28, shipped `351ea1f`) — Recon-gated
  opening phase: 4 intel zones hiding the base
  + 3 nodes, scan before you can attack. Live-playtest feedback, given
  across several messages in the same sitting: combat currently starts
  immediately (Wave 1 fires right on `startGame`) with no recon beat
  first, and the owner wants a real opening where you have to go find
  the enemy before you can hit it - "like i have to find your base and 3
  nodes to destroy them by checking their zone without getting shot
  down." Concretely requested: **4 distinct recon/intel zones** that
  planes or drones are sent to scan; Node Omega's base + 3 nodes (this
  reads as SEEK AND DESTROY's existing Attack/Counter/Base trio,
  `LRNA-063`, ids `sd-attack`/`sd-counter`/`sd-base`) are hidden inside
  those zones rather than placed free-roaming as they are today; those
  targets stay non-attackable until scanned/recon'd; and scouting itself
  carries real risk of being shot down, not a free look. Explicitly
  requested as a ticket only, not to be built this pass.
  - **Partially delivered by `LRNA-083`**: the same conversation's
    follow-up messages ("start with zero attack points... only give
    attack points once recon finds a target... 25 attack coins per
    second") asked for a narrower, concrete slice of this - built and
    shipped separately as `LRNA-083`. The player genuinely can't attack
    until something's been found now, but this ticket's actual "4 zones"
    concept, hiding the base+nodes inside them, and non-attackability of
    specific hidden targets (as opposed to the whole Attack pillar) are
    all still unbuilt - the open questions below still stand.
  - **Builds on, and likely subsumes, existing discovery mechanics**
    rather than starting from nothing: SEEK AND DESTROY's `.discovered`
    flag + recon DRONE reveal (`LRNA-063`), the Recon Plane's
    force-discover-nearest-undiscovered-node behavior (`LRNA-078`),
    Radar Lane only rendering discovery-gated contacts once
    `.discovered` (`LRNA-076`), and AntiPlane's similar hidden-until-
    found lane defenses (`LRNA-039`). Satellite (`LRNA-077`)
    force-discovers everything globally on landing - whether that
    should still be an instant global bypass of a *required* recon
    opening, or needs its own rework here, is one of the open questions
    below.
  - **Genuinely open, not guessed at** (per this log's own convention of
    flagging ambiguity rather than presuming an answer):
    - Does "you can't attack until you recon" mean only the 4 hidden
      targets (base + 3 nodes) are non-targetable pre-scan while the
      rest of combat proceeds as today, or does it mean *no* attacking
      at all - a hard opening phase that gates the whole game, delaying
      Wave 1 itself?
    - "4 recon and intel zones" - fixed regions of the map (like lanes),
      or four specific coordinates/areas the base+nodes are placed
      within, revealed only by scanning that zone? Do all 4 zones
      always get one hidden thing each (1 zone per target, 4 targets
      including the base), or is it more like "scan zones until you
      happen to find all 4"?
    - "without getting shot down" - is this a new threat that fires at
      recon aircraft specifically during the opening (a new Omega
      behavior), or reuses/extends Omega's existing counter-plane
      defenses (`LRNA-075`) to also threaten Recon Planes/drones, which
      today fly to a fixed nearest-undiscovered target largely
      unopposed?
    - Does this replace SEEK AND DESTROY's current free-roaming hidden-
      node placement outright, or add a new zone layer on top of it?
    - Should Satellite (`LRNA-077`)'s instant-global-discovery still work
      unchanged against a phase whose whole point is "you have to work
      for this," or does it need gating/nerfing/removing here?
  - **Resolved directly (2026-09-28), each of the above answered in
    turn rather than guessed at:** hard opening phase gating everything
    including Wave 1, lifting on the FIRST of the 3 targets found (not
    all 4/3); "4 zones" confirmed to just mean the existing 3 SEEK AND
    DESTROY nodes (Node Omega itself stays visible/attackable as today,
    not a 4th hidden thing); the 3 zones are fixed regions replacing
    the prior free-roaming corridor-thirds placement (in practice the
    same underlying thirds math, now with a visible boundary and no
    per-run reshuffling of *where* the thirds are); recon risk extends
    Omega's existing Counter Planes ability rather than a new dedicated
    threat, and - a real conflict surfaced and confirmed during this
    discussion - that meant reversing `LRNA-095`'s own explicit
    exemption protecting recon DRONE from those defenses (superseded by
    direct request, not silently dropped); Satellite nerfed rather than
    left unchanged (no longer reveals SEEK AND DESTROY nodes
    specifically, AntiPlane untouched). Shipped as described in the
    DONE line above.

- **LRNA-084** — Remove the Counter Window and SEEK AND DESTROY window as
  separate pop-up overlays; consolidate into one main screen showing the
  attack/counter/recon map. Direct request: "Remove the two side window
  Counter and Intel stuff - just make it one main screen for now that
  shows the attack/counter/recon map." Explicitly a ticket only, not to
  be built this pass.
  - **What exists today, concretely** (so the removal is scoped against
    the real UI, not guessed at): two separate full-panel overlays, each
    hidden by default and opened on demand, both built the same way the
    Operations Center panel already is (a status/stat card, not a
    duplicate battlefield renderer - `LRNA-051`'s own deliberate choice
    at the time):
    - **Counter Window** (`#counterWindow`) - opens when the COUNTER
      group's "COUNTER MISSILE" button is clicked (`LRNA-051`, direct
      request at the time: "I open to only see MY SIDE of the map and
      the incoming threat"). Shows Strike Platform HP, the live inbound
      threat's name/stats/countdown bar, and FIRE COUNTER MISSILE / HOLD
      FIRE buttons.
    - **SEEK AND DESTROY window** (`#seekDestroyWindow`) - opens via the
      Operations Center's "OPEN SEEK AND DESTROY" button, under its
      INTELLIGENCE section (`LRNA-063`). Shows located/neutralized counts
      for the 3 hidden nodes, a RECON DRONE button, and the node list.
    - Both are separate from - and today block/overlay - the main canvas
      (battlefield, radar lane, bottom ability bar), which already always
      shows all 3 pillars (ATTACK/COUNTER/INTEL) side by side as
      launch-bar button groups (`LRNA-074`).
  - **Genuinely open, not guessed at**:
    - "One main screen" - does this mean fold these two windows' actual
      functionality (fire-counter-missile-at-this-threat,
      locate/neutralize-hidden-nodes) directly into the always-visible
      main HUD/bottom bar (e.g. an inline threat card, an inline SEEK AND
      DESTROY status strip), or does it mean something more literal - a
      single new full-screen map view that replaces the main canvas
      itself, showing attack/counter/recon information all at once in
      one dedicated screen the player switches to? The two readings lead
      to very different builds (extend the existing always-on HUD vs. a
      genuinely new screen/mode).
    - Does "recon map" mean the existing Radar Lane (`LRNA-076`,
      distance-based contact strip) gets extended to show recon/intel
      status too, or is this a new, different kind of map (e.g. a literal
      top-down/zone map, which would also bear on `LRNA-080`'s "4 recon
      zones" concept above - these two tickets may end up wanting the
      same new map surface)?
    - Does the Operations Center panel (`#opsCenterPanel` - Game Mode,
      Run Stats, Targets, Reactor Upgrades, plus the Intelligence section
      that currently links to SEEK AND DESTROY) stay as its own separate
      panel, or does "one main screen" fold that in too? The request
      names "Counter and Intel stuff" specifically, which reads as the
      two windows above, not the whole Ops Center - but Ops Center's own
      Intelligence section is where SEEK AND DESTROY is opened from today,
      so removing that window leaves a dangling entry point to fix either
      way.
    - Once the Counter Window is gone, does clicking COUNTER MISSILE go
      back to firing instantly (undoing `LRNA-051`'s own explicit
      direct-request change), or does the new main screen's counter view
      serve the same "see my side + the threat before firing" purpose
      `LRNA-051` was built for?

- **LRNA-065** — DONE (accepting its own stated default resolution,
  2026-09-28) — Build genuine two-player Attacker vs Defender play - the
  game's actual *original* spec, not a new idea. `LRNA-001` (the very
  first ticket in this log) was "Initial scaffold: two-player spectator
  radar demo." `LRNA-004` replaced its auto-fire spectator loop with
  manual launch buttons, then `LRNA-008` ("Pure attacker/defender pivot")
  explicitly committed to single-player-vs-AI: "player is sole attacker,
  Node Omega auto-defends." Everything shipped since (LRNA-009 through
  LRNA-064) has built on that single-player foundation - the original
  two-sided concept was never actually finished, just abandoned early.
  This directly overlaps the port-2006 "attacker vs defender" rebuild
  already discussed in chat - confirmed so far: real two-player (not a
  relabeled single-player mode), built fresh from today's shipped game
  rather than the unbuilt Attack/Counter/Intel backlog, on its own
  dedicated branch (matching how Cannon/Rocket Builder/IMPACT/Pulse are
  each on their own branch per the Game Portal's convention). Still
  genuinely open, not guessed at: **local (same device, no server) vs.
  networked (two devices, needs a real WebSocket relay - a materially
  bigger build than anything shipped in this game so far)** - the
  question was asked directly and dismissed without an answer; needs
  confirming before this can actually start, since the two are
  different architectures, not a scope dial.
  - **Substantially resolved by `LRNA-085`'s Counter Grid: Versus**,
    built later the same day: real local two-player (one shared screen,
    keyboard for the Attacker, mouse for the Defender), genuinely fresh
    (not a relabeled single-player mode), shipped as its own thing at
    its own port (2010) - the exact shape this ticket asked for,
    including resolving the local-vs-networked question this ticket
    itself had flagged as blocking (answered: local, no server/relay
    needed, matching this ticket's own precedent). One real gap from a
    literal reading of this ticket's own text: Counter Grid is a new,
    separate game built from scratch (its own arsenal/economy/map),
    not literally *this* game (Long Range Node Attack) with an
    attacker/defender mode bolted onto its existing Strike Platform/
    Node Omega/warhead roster - "built fresh from today's shipped game"
    reads more like forking or extending this game's own code than
    building a sibling. If what's still wanted is specifically *this*
    game's own systems (FAST/MEDIUM/LONG RANGE/CLUSTER/EMP, reactor
    upgrades, the Attack/Counter/Intel token economy, SEEK AND DESTROY,
    etc.) made two-player rather than a new game built in the same
    spirit, that's still open - otherwise Counter Grid: Versus is this
    ticket's answer.
  - **Closing this out**: no further request for a two-player mode
    built into *this specific* game's own systems has come in since
    Counter Grid: Versus shipped - taking the ticket's own stated
    fallback ("otherwise Counter Grid: Versus is this ticket's answer")
    at face value rather than leaving it open indefinitely on a
    hypothetical. Reopen with a concrete ask if that's still wanted.
- **LRNA-066** — N/A in this repo (2026-09-28). Portal listing accuracy. `portal-game.json`'s
  description reads "Orbital siege: a lone Strike Platform vs. Node
  Omega and the 12 armed installations guarding it" - accurate when
  written (LRNA-011's 12 field targets: 4 infantry, 3 vehicles, 3
  launchers, 2 sub-bases), but the corridor has grown real hostile
  content since that the description doesn't count: 2 hidden AntiPlane
  lane defenses (LRNA-039) and 3 SEEK AND DESTROY objective nodes
  (LRNA-063), plus "a lone Strike Platform" undersells LRNA-015's 5 AM
  batteries defending the player's own side. Update the public
  description (and the entrance screen's own "12 FIELD TARGETS" claim,
  if it makes the same claim - check `.featuring`) to reflect what's
  actually in the game today, or explicitly scope "12" to mean visible
  field targets only vs. total hostile installations - just make the
  claim accurate either way rather than leaving stale marketing copy.
  - **Doesn't apply here.** `portal-game.json` and `games/index.html`
    live in the Game Portal repo (`jackgary86-dev/alert`), not this
    standalone repo - this game has no portal listing of its own to
    correct. For the record: that exact fix already shipped on the
    Alert side (commit `c5bbaca`, "LRNA-062/066/067: correct stale
    portal claims"), before this repo split off from it. Confirmed the
    two repos are meant to stay separate (2026-09-28) rather than synced,
    so not porting that fix here.
- **LRNA-067** — DONE (resolved by later work, no build needed) —
  Reconcile the original "counter-token economy" against today's
  economy. `LRNA-007` (v1.0.1) shipped "coin-gated launches,
  counter-token economy" as two separate resource systems - a distinct
  currency specifically for counter/defense actions, apart from the
  coins spent on attacks. That distinction was genuinely missing at the
  time this ticket was written (Counter Missile/Counter Attack Planes/
  Attack Drone all spent one single `coins` balance, same as every
  warhead) - but `LRNA-073` (three-pillar tokens: attack/counter/intel,
  shipped after this ticket was opened, independently of it) already
  gives Counter its own real, distinct resource: every counter ability
  spends from the `counter` pool specifically
  (`spendTokens('counter', ...)` - `EMERGENCY_COUNTER_COST`,
  `COUNTER_MISSILE_COST`, Counter Attack Planes' cost), never `attack`
  or `intel`. This is a real second currency, historically-grounded in
  exactly the shape v1.0.1 first described (just a 3-way split instead
  of a strict 2-way one, since Intel also needed its own pool once
  `LRNA-046`'s pillars existed) - so nothing needs building here, this
  ticket is purely correcting a stale claim: the counter-token economy
  is not missing, it already shipped under a different ticket number.
  Also resolves the analogous open question this ticket flagged in
  `LRNA-046` ("Tokens for Recon / Damage missiles / Counter measures")
  the same way, for the same reason.
- **LRNA-068** — DONE (audited, no problem found) — Performance/
  regression audit. The game has grown from `LRNA-001`'s "initial
  scaffold" to 85+ shipped tickets' worth of layered systems (AntiPlane
  lane interception, SEEK AND DESTROY, DRONE's wander/recon/discovery,
  the Counter Window's per-frame live update, `renderIntel` rebuilding
  its panel's `innerHTML` from scratch every single `updateHud()` call,
  itself called every frame from `update(dt)`) on the same core render/
  update loop from the original build. No dedicated profiling pass had
  been done since the early game was simple.
  **Measured, not assumed**: an instrumented Playwright build sampled
  1,200 consecutive `requestAnimationFrame` deltas (~20s) during a
  genuinely loaded scenario - Operations Center panel open, drones and
  missiles firing on a loop, both hunt systems (AntiPlane discovery,
  SEEK AND DESTROY) active. Result: average frame time 16.7ms (the
  60fps budget is 16.67ms - this is right at target, not degraded),
  only 3 of 1,200 frames (0.25%) exceeded 20ms, and none exceeded
  33.4ms (i.e. no frame dropped below ~30fps even in the worst case).
  Zero console errors during the run.
  **Conclusion**: `renderIntel`'s per-frame unconditional `innerHTML`
  rebuild - the specific hot path this ticket's own text flagged as a
  suspect - is not actually a measurable problem in practice, because
  the list it rebuilds is tiny (at most 2 AntiPlane nodes) - a 0-2 row
  DOM diff costs microseconds, not milliseconds, regardless of how
  often it reruns. No optimization made; speculative work here would be
  exactly what this ticket's own text warned against doing without
  measurement first. Worth re-auditing if a future ticket adds a
  panel that re-renders something genuinely large (the full
  `TREE_CLUSTERS`/`RIVERS` terrain arrays, say) on the same
  every-frame cadence - the risk model then would be different from
  what was measured here.
- **LRNA-046** — DONE (fully resolved, across many later tickets) — Node System Framework: pre-game loadout + the
  "Attack / Counter / Intel" theme. Design intent from the request: a very
  fun Player 1 experience built around three pillars — attacking, countering,
  and running intel missions — realized as a new pre-game loadout step
  layered in front of the existing sandbox/siege flow, not a replacement
  for the existing missile arsenal or Operations Center. Scope, worked out
  over several rounds of diagram + chat clarification (ASCII summary of the
  reference diagrams below):
  ```
  [Base]--[Node1]-------[Node2]-------[Node3]--[COUNTER MEASURES ZONE]
    0       250           500           750         750 to 1000
  ```
  - **Start Game screen.** Before a run begins, the player picks 3 node
    loadout slots, each independently chosen from the full roster defined
    in LRNA-047/048/049 (Weapons/Intel/Counter) — duplicates allowed (e.g.
    three Ground Missile Launchers is valid). This is a new screen, not an
    Operations Center section like LRNA-039's Intelligence panel — it gates
    the start of a run, not something opened mid-game.
  - **Fixed distance slots.** Exactly 3 placement slots exist, at fixed
    distances from the player's own base: 250 / 500 / 750 on the diagram's
    0-1000 unit scale. The player assigns their picked node to whichever
    slot they want (this was the one real contradiction across the two
    requests — "automatically placed" vs. "I select which" — resolved by
    the diagram: placement is manual, distance is fixed per slot).
    Implementation mapping: the 0-1000 scale is the corridor between
    `nodeA` (Strike Platform) and `nodeO` (Node Omega) — slot distance
    250/500/750 → `nodeA.x + 0.25/0.5/0.75 * (nodeO.x - nodeA.x)` — a
    straightforward proportional mapping, not something needing
    confirmation.
  - **Counter Measures Zone (750-1000 units) — DROPPED.** Owner decision
    (GitHub `owner-action/Alert#433`, 2026-09-25): not built. The owner
    wants no automatic play on the player's side (LRNA-064's whole
    reason for existing) - an always-on passive auto-intercept zone runs
    directly against that. Nothing here is planned; if vision/early-
    warning for the deep corridor is wanted later it needs its own
    ticket, decoupled from any auto-intercept effect.
  - **Radar Lane — DONE as LRNA-076** (GitHub `owner-action/Alert#433`).
    See the Shipped section - absorbs ACTIVE CONTACTS as this bullet
    originally suggested, on the 0-1000 scale with distance/speed/type
    per contact.
  - **Redesigned button bar.** Bottom bar reorganized around the three
    pillars: ATTACK (red), COUNTER (yellow), INTEL (blue), plus an
    INCOMING FLASHING ALERT indicator (green/yellow/red, presumably
    severity or time-to-impact based on existing patterns like
    Emergency Counter's reaction window). Confirm before building whether
    this replaces today's single launch bar (LRNA-004 onward) outright or
    sits alongside it.
  **All of the above is now shipped, verified against the actual code
  rather than left as an open plan:**
  - **Start Game screen + fixed distance slots**: DONE as `LRNA-070`
    (`owner-action/Alert#427`) - 3 `<select>`s, `LOADOUT_SLOT_FRACS`
    mapping slot distance to `nodeA.x + f * (nodeO.x - nodeA.x)` for
    f = 0.25/0.5/0.75, exactly as this ticket specified.
  - **Redesigned button bar**: DONE as `LRNA-074` - the bottom bar was
    replaced outright (not left sitting alongside the old one, resolving
    this ticket's own open question) with the ATTACK(red)/COUNTER
    (yellow)/INTEL(blue) grouped layout.
  - **INCOMING FLASHING ALERT**: DONE as `LRNA-054` - green/yellow/red,
    reusing the Emergency Counter reaction-window signal exactly as this
    ticket's diagram called for.
  - **"Tokens for Recon / Damage missiles / Counter measures"**:
    resolved as three separate currencies, not additive on top of one -
    DONE as `LRNA-073` (attack/counter/intel token split), independently
    confirmed still real and distinct as of `LRNA-067`'s audit.
  - **"Waves of Battle"**: resolved as a real discrete-wave
    restructuring, not flavor text - DONE as `LRNA-072` (the wave
    director replaced the old continuous `ENEMY_STRIKE_INTERVAL`
    trickle outright).
  - **Counter Measures Zone**: DROPPED, owner decision (unchanged from
    this ticket's own note above).
  None of this was built *as* LRNA-046 - each piece landed under its own
  later ticket number, mostly from directly owner-authored GitHub issues
  rather than this backlog text. Recorded here so this entry reflects
  reality instead of reading as a large, still-open design doc.
- **LRNA-047** — DONE — Attack/Weapons node & missile roster (Attack pillar of
  LRNA-046). Reconciles the requested roster against what already exists:
  - **Fast/Medium/Large Missile** (10s/20s/30s map crossing) — already
    shipped as `TYPES.fast/medium/large` (LRNA-002/003/042). No new work;
    listed here only because the request re-specified them as part of the
    new Attack roster's framing.
  - **Plane Class — DONE as LRNA-078** (GitHub `owner-action/Alert#435`,
    2026-09-25). Owner decision resolved the ambiguity: a genuinely
    separate parallel arsenal, not a labeling change. See the Shipped
    section for the full writeup and final tuned roster.
- **LRNA-048** — DONE — Intel node & unit roster (Intel pillar of LRNA-046).
  - **Intel Class** (2-minute map crossing) — matches the already-shipped
    DRONE exactly (`TYPES.drone`, `eta: 120`, LRNA-038's recon/wander/
    discovery mechanic). Treat as the same thing under the new pillar
    framing, not a second new type, unless told otherwise.
  - **Satellite — DONE as LRNA-077** (GitHub `owner-action/Alert#434`,
    2026-09-25). Owner decision: reveals the whole map - every
    AntiPlane/SEEK AND DESTROY node discovered from the first second, no
    DRONE needed. See the Shipped section for the full writeup.
- **LRNA-049** — DONE (2026-09-28) — Counter node & unit roster (Counter pillar of LRNA-046).
  - **Counter Class** (intercepts incoming threats) — already shipped as
    the shared `COUNTER`/`fireCounter` mechanic underlying AM batteries
    (LRNA-015), Emergency Counter (LRNA-032), Counter Attack Planes
    (LRNA-035/040), and Counter Missile (LRNA-041). No new work; listed
    here as the existing baseline the new nodes below extend.
  - **Ground Missile Launcher — DONE as part of `LRNA-070`**
    (`LOADOUT_NODE_TYPES.gml`, `owner-action/Alert#427`): engages
    FAST/MEDIUM enemy strikes only (not LARGE), 40% hit chance - the
    exact "shoots down missiles and planes, not drones, needs a concrete
    hit chance" spec this bullet was still waiting on, resolved with a
    real number by the time LRNA-070 shipped.
  - **Machine Gun Anti-Aircraft** — already shipped as `mgaa` (LRNA-070/
    #427): engages everything (fast/medium/large-sized inbound strikes),
    35% hit chance, resolved as "large planes (bombers/LONG RANGE)"
    being the `large` sizeKey - no separate large-tier Plane Class unit
    exists to shoot down (issue #435/LRNA-078 gave Omega no planes of
    its own; only the player's planes exist, and those are engaged by
    Omega's own Counter Missile/Counter Planes with matching missile/
    plane filters, not by the player's own MGAA node).
  - **Counter Battery — DONE as part of `LRNA-070`**
    (`LOADOUT_NODE_TYPES.cb`): engages every size, 60% hit chance,
    `COUNTER_BATTERY_CYCLE = 30` seconds on / 30 off, shown via an
    ON/OFF label and a solid-vs-faded coverage ring - exactly the
    duty-cycle blanket-coverage mechanic this bullet asked for, with the
    hit-chance question it had left open (100%, or some rate?) resolved
    as 60%, not guaranteed.
  - **Ground Units — DONE.** Owner-answered the open mechanic question
    directly ("Reduce its impact damage" - 2026-09-25): a successful
    Ground Units hit chips the target's own impact damage instead of
    destroying it, so it needed no new "mid-flight health" stat after
    all - it reuses the existing `m.dmg`/`applyDamage` pipeline every
    other strike already has. Shipped as `LOADOUT_NODE_TYPES.gu`: engages
    every size (fast/medium/large, matching `cb`'s "vs everything"
    coverage), 50% hit chance, 1.3s cooldown, `chipOnly: true`. On a
    successful hit, `target.dmg *= CHIP_DAMAGE_MULT` (0.6, i.e. -40% per
    hit, floored at 1 so it can never zero out), the target is left in
    flight (not added to `toRemove`), a `DAMAGED — N DMG LEFT` float-text
    and a distinct orange burst play instead of the purple intercept FX,
    and it does not count toward `stats.intercepts` (that stat stays
    reserved for full destroys) though it does earn a reduced Counter
    token reward. Multiple Ground Units nodes in the 3-slot loadout can
    each land one hit on the same missile as it passes each emplacement
    in turn, so the reduction stacks multiplicatively. Verified directly
    (instrumented build, all 3 loadout slots set to `gu`, 20s of live
    play): observed real hits stacking exactly as designed - a MEDIUM
    strike (16 dmg) chipped twice down to 6, a FAST strike (8 dmg)
    chipped twice down to 3, a LARGE strike (26 dmg) chipped once to 16 -
    and zero destroy events fired for any Ground-Units-only hit, zero
    console errors.
  - **Base (Base Node) — DONE (2026-09-28).** Resolved directly: a real
    4th buildable loadout node, not a restatement of the Strike Platform
    itself. Asked for its concrete mechanic (matching every other node's
    own resolved-with-a-real-number pattern); answered "multi-target
    volley" - rather than picking one best target like every other node,
    it engages every currently-inbound threat at once each cycle.
    Shipped as `LOADOUT_NODE_TYPES.base`: engages every size, 35% hit
    chance per target, 6s cycle (0.3s retry if nothing's inbound that
    tick). Implemented as a distinct `volley` branch in
    `updateLoadoutNodes` alongside the existing single-target-pick path
    the other 4 nodes share, so it doesn't touch `m.loadoutHitBy` (that
    bookkeeping only matters for nodes taking turns on one target).
    Covered by a new regression test (`LRNA-049`) verifying 3
    differently-sized threats are all engaged in the same tick and the
    cooldown behaves correctly both with and without targets present.
- **LRNA-051** — PARTIAL — Counter Window. **Shipped**: the core, fully
  unambiguous part — a real second overlay window (not an Operations
  Center tab), opened by the existing COUNTER MISSILE button (LRNA-041)
  instead of firing instantly. Clicking it now opens `#counterWindow`
  showing the Strike Platform's live health and the soonest inbound
  threat (name, class, speed, live impact countdown via
  `findInboundEnemyMissiles()`), with FIRE COUNTER MISSILE (calls the
  existing `fireCounterMissile()`, then closes) and HOLD FIRE (closes,
  no spend) actions. Auto-closes if the threat resolves while open
  (destroyed, or reset() mid-session). Deliberately scoped as a focused
  stat/status panel, not a duplicate battlefield canvas renderer - same
  pattern the Operations Center already uses, not a new rendering
  system. Verified directly (instrumented build): opening the window
  does not fire (0 counter missiles in flight), the threat's impact
  countdown visibly ticks down live while open, FIRE spends the 500
  cells and launches, HOLD FIRE closes with no spend, zero console
  errors.
  **Still open / not built** — the rest of the reference mockup's
  content, each needing its own answer before building (unchanged from
  before, listed below): the Counter Weapons roster (Missile/Plane/Drone
  × tiers), the weapon stat card's undefined hit-rate formula, the
  flight/impact visualization pane, the Incoming Enemy Intel list (vs.
  the Radar Lane), and the symmetric Player 2 arsenal dependency. Also
  still open: whether Counter Attack Planes/Emergency Corner get the same
  window treatment.
  Original ticket text, for the still-open pieces (confirmed directly
  across two follow-up messages: "Make a ticket to build a Second Window
  called COUNTER!!! - IT Opens this window," then refined: "The Counter
  Missile Button now opens to a counter mission page to intercept the
  inbound weapons - I open to only see MY SIDE of the map and the
  incoming threat."):
  - **Player 2 header.** The window is framed around the opposing side
    (mockup labels it "player 2") - a context header identifying who/what
    is being countered.
  - **Counter Weapons roster panel.** Three categories - Missile, Plane,
    Drone - each broken into Fast/Medium/Large speed tiers (the mockup
    draws 3 tier icons for Missile and Plane, but only 2 for Drone -
    confirm the exact tier count for Drone before building rather than
    assuming parity with the other two). This is the concrete resolution
    to LRNA-047's open "Plane Class" question: Plane is a parallel arsenal
    class to Missile, not a reskin of it, each with its own Fast/Medium/
    Large entries - and it further extends LRNA-049's Counter roster,
    since today only one DRONE speed exists (LRNA-038's 120s variant) and
    this implies DRONE itself needs multiple speed tiers too.
  - **Weapon stat card.** A reusable info panel per weapon/unit, listing:
    Average Speed, Max Speed, Class, "Impact formula average for weapons
    hit rate," and "Success Rate this Mission." The hit-rate/impact
    formula named here isn't defined anywhere yet in the design so far -
    needs its own concrete spec (inputs, output range) before building;
    don't invent one.
  - **Flight/impact visualization pane.** The mockup's hand-drawn center
    panel shows a desired visual treatment for a missile's flight and
    impact: a color-phased trail (launch puff → boost → coast, distinct
    colors per phase) arcing to a starburst impact that spreads damage
    tendrils to multiple nearby targets. Closest existing analog is
    CLUSTER's multi-point splash (LRNA-014), but drawn as connected
    tendrils to specific hit targets rather than 3 independent impact
    points - confirm whether this is describing CLUSTER's existing splash
    rendered differently, or a new shared "impact spread" visual for any
    weapon that can hit multiple nearby targets, before building.
  - **Incoming Enemy Intel / Targets list.** Top-right readout of inbound
    threats: target name, speed, and a "threat formula of Base Impact
    Class" per target (again, an unspecified formula - needs its own
    definition). Possibly the same concept as LRNA-046's Radar Lane,
    possibly a distinct panel scoped to just this window - confirm which
    rather than assuming they're identical.
  - **Symmetric Player 2 arsenal (dependency, likely its own ticket).**
    The "player 2" framing over the Counter Weapons panel implies Omega
    (the enemy) draws from the same Missile/Plane/Drone x Fast/Medium/
    Large roster as the player, not today's single `enemyStrike` type
    with a `sizeKey`. That's a large, separate scope on its own (AI
    target/weapon selection logic, balance across 9+ enemy weapon
    variants instead of 3) - flagged as a real dependency this window's
    "Counter Weapons" panel implies, not assumed in-scope for the window
    UI alone.
  Map terrain flavor text in the mockup ("Trees rivers creeks mountains
  heavily wooded") already matches shipped terrain (LRNA-030) - no new
  work there, just confirms the window reuses the existing battlefield
  visuals rather than a distinct art style.
- **LRNA-052** — DONE (resolved: no dedicated window) — ATTACK button
  (Attack pillar of LRNA-050's button bar). Per-button counterpart to
  LRNA-051 (Counter) and LRNA-053 (Intel) — requested as "tickets for
  each button." **Resolved by LRNA-050's review**: Attack does not get
  a Counter-Window-style dedicated screen. The premise itself doesn't
  hold up under review - Counter's window exists because one specific
  button (Counter Missile) needed a focused decision moment before
  firing (LRNA-051, direct request: "I open to only see MY SIDE of the
  map and the incoming threat"). Attack has no equivalent single
  choke-point action: it's inherently a 6+ button roster
  (FAST/MEDIUM/LONG RANGE/CLUSTER/EMP/DRONE, plus planes), each already
  fired directly from the always-visible bar, and the TARGETS panel
  (now recolored Attack red per LRNA-050) already serves as the "pick
  what to hit" step a dedicated window would otherwise exist for.
  Building a second, redundant Attack window on top of an already-
  functional always-visible bar would add a click without adding a
  real decision - the asymmetry between Counter (one window) and Attack
  (none) is a real difference in the two pillars' interaction shapes,
  not an inconsistency to fix.
- **LRNA-053** — DONE (resolved: no dedicated window) — INTEL button
  (Intel pillar of LRNA-050's button bar). Per-button counterpart to
  LRNA-051/052. **Resolved the same way as LRNA-052, for the same
  reason**: the existing Operations Center Intelligence section
  (RECON DRONE button, known-threats list, LRNA-039) plus the Radar
  Lane (LRNA-076) and Satellite (LRNA-077) already cover Intel's actual
  actions across the bar and panels that already exist - there's no
  single specific Intel action that needs a focused pre-commit decision
  screen the way Counter Missile did. No new window built; nothing here
  needed relabeling beyond what LRNA-050's review already covered
  (Radar Lane was already Intel-colored; the Operations Center
  INTELLIGENCE section was reviewed and deliberately left unstyled, per
  LRNA-050's flagged INTEL-color-collision finding, not overlooked).
- **LRNA-054** — DONE (superseded, not duplicated) — Incoming Flashing Alert indicator. A distinct
  HUD element shown consistently across the reference mockups, separate
  from the three pillar buttons: "INCOMING FLASHING ALERT - Green -
  yellow - Red." A three-stage threat-level indicator that flashes to
  draw attention. **Concrete rules (this review's output), grounded in
  the existing Emergency Counter precedent rather than a new detection
  system:**
  1. **Green** - no live `enemyStrike` missile in flight at all
     (`findInboundEnemyMissiles()` returns empty).
  2. **Yellow** - at least one inbound `enemyStrike` exists, but none are
     within `EMERGENCY_WINDOW` (5s, LRNA-032) of impact yet.
  3. **Red, flashing** - at least one inbound threat has entered
     `EMERGENCY_WINDOW` - the exact same moment Emergency Counter's own
     button already lights up (`findEmergencyTarget`). This makes the
     indicator a generalized, always-visible companion to a signal the
     game already computes, not a new threshold to invent.
  4. **Not itself a button.** The mockups consistently show it as its own
     labeled HUD element, separate from the three actual pillar buttons
     (Attack/Counter/Intel) - a passive status light, not a 4th
     clickable action. Clicking it does nothing.
  **Resolution, checked against the actual shipped HUD rather than
  waiting on LRNA-050**: `#incomingAlert` (in the bottom bar, shown in
  every screenshot this whole session) already is a three-state
  green/yellow/red flashing threat indicator, wired to
  `findInboundEnemyMissiles()` - close enough to this ticket's spirit
  that building a second, near-identical light right next to it would
  be redundant clutter, not an improvement. It differs from this
  review's rules in two ways, checked directly against its code
  (`updateIncomingAlert`): its red threshold is a plain `remaining <= 5`
  cutoff rather than reusing `findEmergencyTarget()`/`EMERGENCY_WINDOW`
  by name (though `EMERGENCY_WINDOW` is itself 5s, so in practice the
  two thresholds already agree - not a real behavioral gap); and its
  "no threat" state has no explicit color at all rather than this
  ticket's specified green (a real, minor gap), and it's clickable
  (`hasThreat` → click-to-follow the tracked threat) rather than this
  ticket's "not itself a button" - a deliberate, useful difference this
  ticket's mockup-driven review didn't have visibility into, not an
  oversight worth undoing. Fixed the one real gap rather than leaving
  it or building a duplicate: `updateIncomingAlert` now adds the
  `green` class in the no-threat branch too, so "no inbound threats"
  reads as an explicit green light rather than default/uncolored text -
  the one-line change this review's rule 1 actually called for.
  Verified with an instrumented Playwright build: with no enemy strikes
  in flight, `#incomingAlert` shows the `green` class and "NO INBOUND
  THREATS"; once a strike is inbound it turns yellow with a live ETA;
  once that ETA drops under 5s it turns red and starts the existing
  pulse animation. Zero console errors.
- **LRNA-055** — PARTIAL — New icon art for Missile / Drone / Plane
  classes. **Shipped**: the real, unblocked gap - DRONE (LRNA-038) never
  got bespoke art and fell through to the generic rocket-body fallback.
  New `drawDrone(r)`: a small quadcopter silhouette (central hub, 4 arms
  to rotor rings) that reads instantly as "drone" instead of a re-colored
  missile, wired in for both `drone` and `attackDrone` typeKeys (the
  SEEK AND DESTROY/AntiPlane hunt-kill drone gets the same shape,
  distinguished by its own color). Verified directly (instrumented
  build, zoomed screenshot): the quadcopter shape renders clearly and
  distinctly from `drawAttackPlane`/`drawBomber`/`drawMissileBody`, zero
  console errors.
  **Still open / not built**: the Plane-class and multi-tier Drone icons
  described below - both depend on Plane actually existing as a real
  launchable type first (it doesn't yet - LRNA-051's Counter Weapons
  roster is still just documented, not built), so there's nothing to
  draw icons for yet.
  Today's art: `drawMissileBody` (rocket silhouette, fallback for
  COUNTER/EMP/enemyStrike), `drawAttackPlane` (FAST/MEDIUM), `drawBomber`
  (LONG RANGE/CLUSTER, and CLUSTER's 3-body split) — all from LRNA-031.
  New need created by LRNA-051's
  Counter Weapons roster: Plane is now a parallel arsenal class to
  Missile (not a reskin), each with Fast/Medium/Large tiers, and DRONE
  itself needs multiple speed-tier icons too (2 or 3 per LRNA-051's still-
  open tier-count question) — none of that art exists yet. Scope: a
  distinct icon per class/tier combination (confirm exact count once
  LRNA-047/048/049's rosters are settled) rather than reusing one
  silhouette across tiers with only a color change, matching how FAST vs.
  LONG RANGE already read as visually distinct classes, not just
  differently-colored copies of one shape.
- **LRNA-056** — Base/structure art for the new loadout nodes (LRNA-046's
  3 placement slots, populated from LRNA-047/048/049's roster - Ground
  Missile Launcher, Satellite, Counter Battery, etc.). Precedent: every
  existing placeable already has its own distinct silhouette (AM battery
  turret art LRNA-021, LAUNCHER/SUB-BASE art LRNA-024, AntiPlane node's
  angular hostile-turret marker LRNA-039) rather than sharing one generic
  shape - the new loadout nodes should follow the same pattern, one
  recognizable silhouette per node type. Ambiguous, flagged rather than
  assumed: "build the bases" could instead (or also) mean revisiting the
  main Strike Platform/Node Omega art itself, which is already fairly
  developed (LRNA-008's raster damage grid, erosion-order pixel base) -
  confirm which reading is intended, or if both, scope them as separate
  passes given how different "new node icons" vs. "rework the existing
  main bases" are as tasks.
- **LRNA-057** — PARTIALLY RESOLVED — Map(s) for the new windows. Was
  flagged as two unrelated readings: (1) each new window needs its own
  scoped map/camera view, or (2) literally multiple distinct battlefield
  layouts/terrain sets for replay variety. **Reading (1) is now answered
  per-window rather than needing its own ticket**: LRNA-051 specifies the
  Counter Window shows only the player's own side plus the incoming
  threat, and LRNA-063 specifies SEEK AND DESTROY shows the enemy's map
  instead (the deliberate inverse) - each window's own ticket is where
  its view scope belongs, not a shared LRNA-057 task; LRNA-052/053
  (Attack/Intel) should get the same treatment directly in their own
  tickets once their window-vs-panel question resolves, rather than
  waiting on this one. **Reading (2) - multiple distinct terrain/
  battlefield layouts for replay variety, beyond today's single corridor
  (`MAP_W`, LRNA-030) - remains genuinely open**, and isn't something to
  resolve by inference from existing code the way reading (1) was; it's
  a scope/content decision. Confirm before building.
- **LRNA-058** — Simulator/demo mode for each window. A way to preview
  and iterate on the Counter Window (LRNA-051), Attack window (LRNA-052),
  and Intel window (LRNA-053) in isolation, without needing a full live
  run in progress to reach them - useful both for design review and for
  this project's existing Playwright-based verification pattern (every
  prior ticket in this log has been verified with an instrumented live
  build; a dedicated demo entry point would make that easier for these
  new windows specifically). Needs scoping once LRNA-051/052/053 have
  concrete enough content to demo - sequence after those, or at least
  after LRNA-051 since it's the most fleshed-out so far.
- **LRNA-060** — DONE — Sound design rework, matched to what plays well
  with players. Owner answered the open direction question directly
  (2026-09-25): "Punchier impacts, more per-weapon variety" - exactly the
  two candidate qualities this ticket had flagged, both built. Baseline
  stays LRNA-027's synthesized WebAudio SFX system, pure synthesis, no
  external audio files.
  - **Punchier impacts.** `sfxImpact` gained a dedicated sub-bass sine
    layer (`subFreq`/`subGain`, 28-60Hz depending on weapon class)
    underneath the existing noise-burst + mid tone, scaling louder with
    blast size - the low end no longer relies on one shared 90Hz tone for
    every explosion regardless of size.
  - **Per-weapon variety.** New `LAUNCH_PROFILES` and `IMPACT_PROFILES`
    tables give each weapon class its own frequency/waveform/duration
    character instead of one shared `sfxLaunch()`/`sfxImpact(scale)` for
    everything: FAST is a bright, short snap; MEDIUM a balanced boom;
    LARGE a deep, slow boom with the heaviest sub-bass; CLUSTER a higher-
    pitched, lighter crack (so 3 stacked sub-impacts don't just triple one
    boom); EMP keeps its zap but gained a low crackle layer underneath;
    DRONE/attackDrone/each plane kind (strikeFighter/strikeBomber/
    heavyBomber/reconPlane/interceptorJet) and COUNTER each got their own
    launch tone. `spawnLaunchFx`/`spawnExplosion` now take a `kind`
    param threaded through from every call site's already-known
    `typeKey`/`sizeKey`/`planeKind`.
  - **Less repetition on rapid-fire.** A `pitchJitter()` helper (±6%
    random detune) is applied to every launch/impact/intercept/miss
    call, so spamming one launch button or a cluster's 3 near-
    simultaneous sub-impacts no longer sounds like the identical sample
    looping.
  Verified directly (instrumented build): all 6 launch-bar weapon types
  plus recon drone fired repeatedly, planes launched, ~40s of active
  play with sustained impacts of every class, zero console/page errors.
- **LRNA-061** — DONE (review complete, 2026-09-25) — Review pass:
  missile travel/flight-phase visual "fun." Distinct from LRNA-059
  (smoke trail accuracy specifically) - this is about the broader
  experience of watching a missile cross the map mid-flight. This ticket
  asked for a review output, not a pre-built feature ("Output should be a
  concrete set of proposed upgrades ... not a single guessed
  implementation") - the review below is that deliverable. No gameplay
  code changed by LRNA-061 itself.
  **What's already in play during the travel phase** (read directly from
  the current build, not assumed): the burn/coast speed profile
  (`rawSpeedMultiplier`, LRNA-033) gives most types a real accelerate-
  then-decelerate curve rather than constant velocity; the ballistic
  altitude arc (`altitude(m) = peak * sin(pi*t)`) is purely a sine bow,
  same shape for every type just at a different `peak`; FAST/MEDIUM
  (and DRONE, via its own wander) get a per-launch weave offset
  (`PLANE_PATHS`, 5 preset amplitude/frequency shapes) layered onto the
  drawn position only, never the real lane; the camera's follow (`update()`,
  the `followId` branch) already velocity-matches the tracked missile's
  `vx` and lerps the residual at `dt*6` - smooth by design, but also
  static: it never reacts to what's happening (launch, boost, impact),
  it only tracks position.
  **Assessment**: the flight phase is mechanically rich (real speed
  curves, per-type arcs, weave) but the *camera and screen* stay flat
  through all of it - nothing marks a launch's kick or an impact's
  weight the way the game's own physics already implies. That's the
  single biggest gap, and it's a presentation-layer fix, not a physics
  one (none of the proposals below touch `vx`/`altitude`/hit resolution).
  **Proposed follow-ups** (concrete, scoped, NOT built - each needs
  confirmation before work starts, consistent with this log's standing
  practice of not shipping unconfirmed new features):
  - **LRNA-086 - Boost/impact camera shake.** A short, decaying
    positional offset added on top of `camX` (and a matching vertical
    jitter) for ~0.2-0.3s, triggered when the currently-followed missile
    is in its boost window (`m.boost > 0`, already exists on every type)
    at launch, and again the instant its flight resolves (impact,
    intercept, or miss) while it's the followed contact. Purely additive
    to the existing lerp - doesn't change how `followId` tracking works,
    only adds a temporary wobble on top of it.
  - **LRNA-087 - Motion trail / speed lines, distinct from smoke.** A
    new short-lived streak particle (thin bright line along the current
    velocity vector, ~0.15-0.25s life, decaying alpha) layered in front
    of the existing smoke trail, spawned only once live speed crosses a
    threshold (proposed: |vx| > 500, i.e. roughly MEDIUM's cruise speed
    and above). Smoke reads as propulsion exhaust; this reads as
    velocity specifically - the two aren't redundant, and coasting FAST/
    MEDIUM shots would gain a cue LARGE/CLUSTER's slower cruise wouldn't
    trigger as often, which doubles as a passive "how fast is this thing
    really going" tell.
  - **LRNA-088 - Foreground parallax scroll tied to altitude.** LRNA-030's
    terrain (rivers/creeks/tree clusters) already scrolls under a
    missile at world/camera speed (1x). Add a second, nearer terrain
    band that scrolls faster (proposed 1.3x) and fades/shrinks with
    `altitude(m)` - so a missile climbing through its ballistic arc
    visibly "rises above" the foreground layer and a missile near the
    ground (start/end of flight, or DRONE's low-altitude wander) reads
    as closer to the terrain passing under it. Ties the existing
    altitude number to something legible at a glance instead of only
    the drawn height offset.
  Not proposed as a follow-up: zoom tied to speed (one of the original
  candidate directions). Re-scoping camera zoom mid-flight touches the
  whole rendering scale (every sprite, particle, and UI overlay
  positioned off `camX`), a materially bigger change than the three
  above, which are all additive. Worth its own ticket if wanted, not
  bundled in here.
- **LRNA-062** — DONE — Randomize hidden ground-base placement.
  Current baseline is LRNA-039's `initAntiPlaneNodes` - 2 AntiPlane
  nodes, each bound to one random distinct lane (of `ANTIPLANE_LANES`,
  10) and a random x position within a single fixed corridor band
  (`MAP_W / 2 + 300` to `nodeO.x - 700`), with no spacing guarantee
  between them - two nodes could legally land right next to each other.
  **Superseded by LRNA-063**: the original "vary the count per run"
  candidate no longer applies - SEEK AND DESTROY fixed the count and
  composition directly ("hide 3 nodes total - Attack - Counter - Base"),
  so placement only needs to cover exactly those 3, not an open-ended
  AntiPlane-style roster.
  **Concrete placement rules (this review's output):**
  1. **Guaranteed spacing via corridor thirds.** Split the existing
     placement band into 3 roughly-equal thirds and place exactly one
     node per third (each still at a random x within its own third,
     keeping runs varied) - guarantees the 3 nodes are always spread
     across the corridor instead of the current no-spacing random draw
     that could cluster them.
  2. **Base placed deepest (closest to Omega).** Base is the toughest
     node (1000 hp vs. 500 each for Attack/Counter, per the confirmed
     health split) and reads as the most defended asset - place it in
     the third nearest Node Omega. Attack and Counter fill the remaining
     two thirds, their order randomized between runs (no fixed pattern
     for which of the two is closer to the player).
  3. **Lane assignment unchanged.** Keep `initAntiPlaneNodes`'s existing
     random-distinct-lane logic (each of the 3 still gets one of the 10
     lanes, no two sharing a lane) - nothing about the lane system itself
     needed revising.
  **Verified shipped, as part of LRNA-063's `initSeekDestroyNodes`**:
  rules 1 and 2 are implemented exactly as specified - the placement
  band is split into 3 thirds (`third = (end - start) / 3`), Base is
  always placed in the last (deepest, nearest-Omega) third, and
  Attack/Counter fill the other two with their order randomized
  (`if (Math.random() < 0.5) order.reverse()`). Rule 3 (lane
  assignment) was correctly left out rather than blindly copied -
  confirmed by grep that nothing anywhere reads a `.lane` field on
  `seekDestroyNodes`: unlike AntiPlane nodes, which use their lane to
  decide which passing missiles/planes they can engage
  (`ANTIPLANE_ENGAGE_RANGE`/`ANTIPLANE_LANES`), SEEK AND DESTROY nodes
  are pure find-and-destroy targets with no engagement role of their
  own, so the concept doesn't apply to them - not a gap.
- **LRNA-063** — PARTIAL — "SEEK AND DESTROY" window. **Shipped**: the
  core mechanic and window. `initSeekDestroyNodes` places exactly 3
  nodes (Attack/Counter 500 hp each, Base 1000 hp) using LRNA-062's
  resolved placement rules (corridor split into 3 thirds, Base always in
  the third nearest Omega, Attack/Counter order randomized between the
  other two, one node per third). Discovery and destruction reuse
  LRNA-039's existing tools rather than duplicating them: `allHuntableNodes`/
  `findHuntableNode` merge `antiPlaneNodes` and `seekDestroyNodes` into
  one lookup, so the recon DRONE's discovery roll and Attack Drone
  targeting work across both node sets unchanged. AntiPlane nodes keep
  their original single-hit destroy (no `maxHealth` field); SEEK AND
  DESTROY nodes take real damage per hit instead (`ATTACK_DRONE_DAMAGE`,
  250/hit - a new concrete balance number, not previously specified: 2
  hits kill Attack/Counter, 4 kill Base). A new "OPEN SEEK AND DESTROY"
  button in the Intelligence Operations Center panel opens `#seekDestroyWindow`,
  which lists all 3 nodes (UNKNOWN until discovered, then name/hp/an
  ATTACK button once found) plus its own RECON DRONE button (reuses the
  same `drone` missile as LRNA-038/039). Scoped as a status-list window,
  not a duplicate battlefield renderer - same simplification LRNA-051
  already established for the Counter Window. Verified directly
  (instrumented build): nodes place in the correct order (Base deepest),
  the window opens/shows all 3 as UNKNOWN at a fresh start, force-hitting
  a 500 hp node twice destroys it exactly on the 2nd hit (250 hp
  remaining after hit 1, 0/destroyed after hit 2) while an AntiPlane node
  still dies on a single hit (regression-checked), zero console errors.
  **Also shipped since**: the weaving-trail-smoke visual from the
  reference mockup. `fireAttackDrone` now assigns a randomized
  `pathProfile` (reusing LRNA-034's `PLANE_PATHS` system, the same one
  FAST/MEDIUM fly) so the hunt-kill drone visibly curves in rather than
  beelining, and its physics-loop branch now spawns the same speed-
  scaled smoke trail every other warhead gets (LRNA-059) instead of
  leaving no trail at all between the launch boost and impact. Verified
  directly (instrumented build + screenshot): a fired Attack Drone shows
  a real, visibly weaving smoke trail behind it in flight.
  **Still open / not built**: the fog-of-war recon-trail reveal mechanic
  (vs. the existing radius-based discovery roll, reused here), tiered
  Recon/Threat options, and whether regular launch-bar warheads (not
  just Attack Drone) can target a discovered node - all still need their
  own answer before building.
  Original ticket text, for the still-open pieces: find and destroy
  hidden enemy nodes using Intel / Drones / Attack together. Directly extends
  LRNA-039's Recon/Hunt/Destroy (2 hidden AntiPlane nodes, discovered via
  recon DRONE, destroyed via a dedicated Attack Drone) into its own named
  sub-game/window - confirmed directly, with a name and exact scope now
  given: "Convert this into a Long Range Game Window - Called SEEK AND
  DESTROY - This will open a window just like Counter - It will show the
  enemies map - It will only hide 3 nodes total - Attack - Counter - Base
  - I have to find the attack and Counter nodes using intel to kill them
  using threat options."
  - **Trigger & structure.** Opens as a real second window, same pattern
    as LRNA-051's Counter Window (not an Operations Center panel).
  - **View scope - the inverse of Counter's.** LRNA-051's Counter Window
    shows only the player's own side of the map; SEEK AND DESTROY shows
    the *enemy's* map instead - confirmed directly, and a deliberate
    contrast between the two windows (defense-focused vs. recon-focused
    framing) rather than an oversight.
  - **Exactly 3 hidden nodes, one of each kind: Attack / Counter / Base -
    all three are legitimate find-and-kill targets.** This resolves the
    previously-open "which ground bases are huntable" question and the
    node-count discrepancy the last mockup raised (2 shipped vs. 3
    drawn) - it's 3, one of each named category, not 3 of the same
    AntiPlane-style node repeated. Directly confirmed: Base is also a
    real target (not a passive/untouchable 3rd node as the "find the
    attack and Counter nodes" wording alone had suggested) - "Make all
    three targets but they have different healths based on use."
  - **Per-node-type health, not a shared pool - concrete numbers given:**
    Base = 1000 hp; Attack and Counter = 500 hp each. Base is tougher
    (double), matching it being the node whose loss presumably matters
    most/ends the mission, while Attack and Counter share the same lower
    HP as each other.
  - **The three named tools working together**, not just the existing
    recon-then-attack-drone pair: Intel (Satellite from LRNA-048, or the
    existing recon DRONE) to discover, Drones (the existing Attack Drone,
    or new Fast/Medium/Large drone tiers per LRNA-051's Counter Weapons
    roster) to soften/destroy, and Attack (the main FAST/MEDIUM/LARGE/
    CLUSTER arsenal) potentially able to finish off a discovered base
    too, not just dedicated drones - confirm whether regular warheads
    should be able to target a discovered ground base at all, since
    today's launch-bar targeting only supports `getTarget`'s existing id
    space (nodeA/nodeO/fieldTargets), which doesn't include AntiPlane-
    style hidden nodes.
  - **Does this replace or sit alongside LRNA-039's existing Intelligence
    Operations Center section** - same open question LRNA-051 already
    raised and answered for Counter Missile (dedicated window instead of
    a panel); confirm whether Hunt gets the same treatment or stays as a
    panel, rather than assuming symmetry with Counter.
  Sequence after LRNA-062 (placement review) and LRNA-051 (Counter
  Window, the closest structural precedent) are further along.
  **Layout and mechanics, per a follow-up reference mockup:**
  - **Window layout.** Framed player 1 / player 2 (same pattern as
    LRNA-051's Counter Window), split into two side-by-side panes: an
    "Intel Stream - Recon" pane and an "Intel Stream - Threat" pane -
    Recon and Threat get their own dedicated halves of the window rather
    than sharing one list.
  - **Fog-of-war recon trail (bigger than LRNA-039/062's current
    mechanic).** The mockup shows the map starting fully hidden, revealed
    progressively along the actual path a recon asset travels - a
    persistent, growing revealed-area trail, not LRNA-039's current
    instant-ish per-second discovery-chance-within-a-radius
    (`ANTIPLANE_DISCOVERY_CHANCE_PER_SEC`/`_RANGE`). Confirm before
    building whether this replaces that existing roll-based discovery
    outright or is specific to this new Hunt window's presentation -
    a real fog-of-war reveal (tracking and drawing everywhere a recon
    unit has ever flown) is a meaningfully bigger system than a
    probability check.
  - **Tiered Recon/Threat options.** Bottom of the mockup shows "Recon
    Options -> used to Find" and "Threat Options -> used to destroy," each
    drawn as multiple escalating-size arrows (tiers) rather than one
    option - consistent with the Fast/Medium/Large tiering already
    established elsewhere (LRNA-051's Counter Weapons roster). Implies
    Recon and Threat/Attack tools both need multiple strength tiers here
    too, not a single find-tool and single destroy-tool.
  - **Ground-node kill effect — DONE (2026-09-25).** New `spawnGroundKillFx(x, y)`:
    a dark burst (charcoal shrapnel + a small ember core) with drifting
    dark-smoke tendril particles and its own scorch mark, deliberately
    distinct from every other impact FX in the game (which all read
    bright/warm) since this specifically marks a ground base's permanent
    death. Reuses LRNA-060's `sfxImpact('large')` profile for the sound
    (heaviest/lowest impact tone available) rather than inventing a new
    one. Wired into both destroy paths that share `fireAttackDrone`'s hit
    resolution - the SEEK AND DESTROY multi-hit branch (`ap.health <= 0`)
    and the AntiPlane single-hit branch - each guarded by `!ap.destroyed`
    so it fires exactly once, precisely on the killing blow, never on a
    non-lethal partial hit. Verified directly (instrumented build, real
    gameplay, no shortcuts): discovered a live SEEK AND DESTROY node,
    landed a first Attack Drone hit (500/500 hp -> 250/500 hp, correctly
    no kill-FX fired), landed a second hit (250 hp -> destroyed,
    "NEUTRALIZED"), confirmed the kill FX fired exactly once and only on
    that second, lethal hit, zero console/page errors.
  - **Weaving trail smoke on approach.** The attacking weapon's flight
    path curves/weaves visibly (labeled "Weaving Trail SMoke") before
    reaching its target, tying together LRNA-034's existing weave/
    `PLANE_PATHS` system and LRNA-059's smoke trail upgrade ticket - worth
    building those two together for this window rather than separately.
  - **Node count shown as 3** (Enemy Node 1/2, plus a third partially
    visible near Player 2), vs. LRNA-039's shipped count of 2 - now
    confirmed as intentional, not illustrative: exactly 3, one each of
    Attack/Counter/Base per the direct confirmation above.
- **LRNA-050** — DONE — GUI theme review: base the whole interface around
  Attack / Counter / Intel. A dedicated design-review pass, broader than
  LRNA-046's single button-bar bullet: audit every existing player-facing
  UI element and explicitly (re)categorize it under one of the three
  functional pillars, rather than reorganizing only the new node loadout
  screen. Sequenced after LRNA-047/048/049 as this ticket originally
  asked - now safe to review since that roster is resolved (see above).
  **The review, section by section:**
  - **Launch bar** - already sorted cleanly by LRNA-074 (FAST/MEDIUM/
    LONG RANGE/CLUSTER/EMP/DRONE + planes = Attack red, Counter Missile/
    Counter Attack Planes = Counter yellow). No change needed.
  - **Emergency Counter** - Counter (yellow), already grouped under the
    COUNTER header in LRNA-074's bar. No change needed.
  - **Radar Lane** - Intel, already the case per LRNA-046. No change
    needed.
  - **TARGETS** (Operations Center) - Attack: this is literally what
    Attack picks a target from. Was unstyled default color; now
    recolored to the exact `#ff5a36` LRNA-074 already established for
    Attack, so the categorization is visible, not just documented.
  - **INTELLIGENCE** (Operations Center) - Intel, obviously - but
    deliberately left unstyled rather than recolored. A real, flagged
    palette gap: LRNA-074's established INTEL color (`#35e6ff`) is also
    this entire theme's base/default color, so applying it here would
    look identical to "no pillar," the opposite of what this review is
    for. Using a different, non-canonical blue just for this one panel
    would fix visibility but break the one-color-per-pillar consistency
    the review is meant to establish. Needs a real second Intel accent
    color reserved for contexts where it must stand out against the
    base theme - a genuine design decision, not something to invent
    unilaterally here.
  - **REACTOR UPGRADES** - meta, deliberately kept outside the
    three-pillar frame rather than folded into Counter. It already had
    its own established amber (`#ffe066`, pre-dating the pillar system)
    - which happens to collide with Counter's own established color,
    also `#ffe066`. Flagged as a real, pre-existing inconsistency, not
    silently resolved either way (recoloring Reactor Upgrades away from
    its long-standing color, or accepting the collision, are both real
    tradeoffs for a person to weigh in on).
  - **GAME MODE, RUN STATS** - meta (game state and post-hoc reporting,
    not an action tied to any one pillar) - reviewed and deliberately
    left at the default color, not an oversight.
  Verified with an instrumented Playwright build: TARGETS now renders
  in Attack red in the Operations Center; every other section's color
  is unchanged from before this review. Zero console errors.
- **LRNA-085** — PARTIAL — Portal: fill the reserved "TRANSMISSION
  PENDING / NEXT UP / Slot Reserved" placeholder card in `games/index.html`
  with two real slots - one to start a COUNTER game, one to start an INTEL
  game - making 3 total portal entries alongside today's single Long
  Range Node Attack card, one per pillar (Attack/Counter/Intel). Direct
  request, delivered across two messages (the first got cut off/garbled
  in transit, the second confirmed the concrete ask): "make a Slot to
  start a counter game and a slot to start a intel game," then narrowed
  further ("Start with just the Counter for now") and finally made
  concrete ("This is a similar game type but I intercept Missiles... Make
  a game and gui to go with it to intercept missiles as player 1 and
  player 2 - One attack and one defends").
  - **Shipped: COUNTER GRID: VERSUS** (`games/counter-grid/index.html`,
    own directory/portal card, sibling to Long Range Node Attack - the
    "separate standalone game" reading of this ticket's own open question,
    below, resolved by the follow-up messages rather than guessed at).
    Built live across a long sequence of direct follow-up messages in one
    sitting, each superseding or extending the last - final shipped shape:
    - **Roles, confirmed directly**: Player 2 is the Attacker (keyboard),
      Player 1 is the Defender (mouse) and owns the base - "player 2 is
      attacking player 1 base -- player 1 is only defending." Local
      two-player, one shared screen, split input (keyboard vs. mouse)
      rather than split screen.
    - **Layout**: left-to-right, not the original top-to-bottom draft -
      "This need to be a left to right missile defense and atack game
      style." Player 2 launches from world x=0; Player 1's base sits at
      the far end.
    - **A very long map, real-time-accurate**: "Make this a very long
      map...It takes a long time to cross map giving me time to plan
      ahead - fast 60 seconds medium 100 seconds and large 160 seconds."
      A `MAP_W` world-space corridor (12,000 units) with per-tier speed
      derived as `MAP_W / travelSeconds`, so crossing time is exact
      regardless of viewport size - not a screen-width-dependent speed.
      A follow camera (mirroring the main game's camX pattern,
      LRNA-010/017) tracks whichever contact is nearest the base, easing
      back to resting on the base when nothing is in flight.
    - **Two parallel attacker arsenals**: "Use missile and plane nodes
      onlys... There are 3 planes and 3 missiles... Planes use different
      coins - They are also 100 150 250 fast Medium Large." Missiles and
      planes share identical FAST/MEDIUM/LARGE cost/speed/damage tiers
      but draw from separate coin pools. Player 1 (Defender) counters
      both categories with missile-interceptors only - "Player 1 counters
      planes with missiles just like missiles incoming" - so there is no
      separate plane-interceptor roster.
    - **Coin economy, final numbers** (superseding two earlier drafts - a
      charge-based system, then an asymmetric 750/500 split - each
      overtaken before shipping): missile coins start at 2,000 for both
      players, regen 20/sec each ("We each start with 2000 points and
      earn 20 coins per second"); plane coins are Attacker-only, starting
      at 1,000 ("Player starts with 1000 plane coins").
    - **HP/damage model**: a missile or plane's hit points equal its own
      coin cost; an interceptor deals flat damage equal to its own coin
      cost on impact, no hit-chance roll - "It gets 1 hp per coin spent
      on it - The counter weapon does 1 dmg on impact per coin spent on
      it." Verified against the exact worked example given (3 FAST
      interceptor hits to kill a LARGE, 2 for a MEDIUM, 1 for a FAST).
    - **Base-impact damage multiplier**: FAST deals 1x its coin cost to
      the base on impact, MEDIUM 2x, LARGE 3x - "Fast missiles and
      Planes...Deliver dmg based on their coin cost...Medium...do twice
      their coin cost damage...Large planes...do 3 times their coin cost
      worth of dmg." Identical for both missiles and planes ("Planes and
      missiles follow the same time to cross map and cost and dmg
      stats"). Base HP is 2,500 ("player 1 base is 2500 Hit points").
    - **In-flight cap**: max 3 of each category per player at once -
      "But we can only launch 3 rockets at any one time...I cant have
      more than 3 missiles per player at any time."
    - **INCOMING alert list**: a real DOM panel (not just canvas-click)
      listing every live contact by ETA and remaining HP, each with
      FAST/MEDIUM/LARGE buttons to fire a specific interceptor at that
      specific contact - "I see incoming alerts for missiles and select
      how to intercept them." A plain canvas click still fires a quick
      FAST intercept at the nearest contact.
    - **No win condition**: "There is no win condition yet -- Just give
      me a reset game button." The earlier base-HP/timer win-condition
      draft was removed outright; a RESET GAME button restarts the board
      in place, no overlay/transition. The match clock is now a plain
      elapsed-time readout, not a countdown tied to any outcome.
    - **Juice pass** (direct request: "build the interface to be a fun
      modern browser [game]"): synthesized WebAudio SFX (no external
      files, same constraint as the main game's LRNA-027), screen shake
      on base hits, glow/shadow-blur on every sprite, particle bursts and
      floating damage/intercept text, an animated crosshair reticle that
      lights up amber over a valid target, a pulsing low-HP warning, and
      a distinct delta-wing silhouette for planes vs. a dart silhouette
      for missiles.
    - **Two real bugs caught during verification and fixed before
      shipping, not guessed away**:
      1. The very first `draw()` call (before START is pressed) ran
         before `reset()` had initialized the missile/particle arrays,
         throwing on load and silently preventing the whole script
         (including its test hooks) from finishing evaluation - fixed by
         initializing those arrays at declaration.
      2. Interceptors were fire-and-forget: velocity was computed once
         at launch toward the target's position *at that instant*, then
         held constant. Since both missiles/planes keep moving for the
         (now very long) remainder of their flight, a fixed-velocity shot
         systematically undershot a still-moving target and could never
         connect except at point-blank range - confirmed directly: a
         controlled test firing at a target still ~40% of the map away
         left 3 interceptors stuck in flight with zero hits registered
         after a generous wait. Fixed by re-aiming at the target's
         current position every frame (true homing) instead of a static
         launch-time heading. Re-verified after the fix: the exact
         3-FAST-hits-to-kill-a-LARGE example above now resolves
         correctly end to end.
    - Verified with an instrumented Playwright build throughout, using a
      test-only `advanceTime()` hook that calls the real `update(dt)` in
      small synchronous steps to fast-forward the (now real-time-accurate,
      60-160s) simulation without waiting minutes per test. Zero console
      errors on the final shipped build. Published as an Artifact
      (`https://claude.ai/artifact/4PaXZSJeM6sa6MoGpwuqMu`) alongside the
      repo copy.
    - `games/index.html` now has 3 cards: Long Range Node Attack, Counter
      Grid: Versus, and one remaining `.soon` placeholder for the
      still-unbuilt INTEL slot.
  - **Terrain and ground-follow pass, shipped in a follow-up round**
    (direct request: "Make this map have terrain and the bases on the
    ground - Make the map scroll and follow missiles as they are
    launched - show trees and rivers and creeks flying by the missiles
    on the ground to show speed," then "Make this map very similar to
    the other game mode"). A direct port of the main Long Range Node
    Attack game's own terrain system (`LRNA-030`) - parallax mountain
    ridgeline, river crossings with a relay bridge, thinner creek
    crossings, and tree clusters, all generated once across the full
    `MAP_W` corridor and scrolling with `camX` exactly like that game's
    `drawMountains`/`drawRivers`/`drawCreeks`/`drawTrees`. A solid ground
    strip was added at a new `groundY()` line, and both the Attacker's
    launch pad and the Defender's base were redrawn to actually stand on
    it (tapered tower shapes with a ground shadow, replacing the
    floating diamond markers that straddled the old vertical corridor
    line) - missiles/planes now spawn in the flight band above the
    ground instead of across nearly the full screen height. The follow
    camera was also changed to track whichever contact was launched most
    recently, not simply whichever is closest to the base - direct
    request: "follow missiles as they are launched."
    Verified with an instrumented Playwright build: fired a FAST
    missile, confirmed the camera panned away from its resting position
    to follow it (world-space `camX` moved from the rest value toward
    the launch point), confirmed a second, newer launch pulled the
    camera onto itself instead; screenshots at each stage show the
    ground/terrain scrolling correctly under the flight path and the
    INCOMING panel's live ETA countdown staying accurate throughout (e.g.
    a FAST missile's ETA read 58.5s at t=1.5s into its 60s flight).
    Zero console errors. Republished to the same Artifact
    (`https://claude.ai/artifact/4PaXZSJeM6sa6MoGpwuqMu`).
  - **Submitted to the live Game Portal** (`http://192.168.1.36:2000`,
    the `jackgary86-dev/gameportal` repo's hourly-rebuilt aggregator):
    added `games/counter-grid/portal-game.json` pointing `static_dir` at
    `games/counter-grid`, alongside the existing root `portal-game.json`
    that already publishes Long Range Node Attack at port 2001. Same
    branch, same submission mechanism (`SUBMIT.md`: "commit a
    `portal-game.json` to your own `claude/*` branch and push" - the
    portal itself pulls on its own schedule, nothing further to do from
    here). **Port assignment corrected twice after shipping**, both times
    per the Backend Connector/Game Portal session's own routine check-ins,
    not guessed at locally: first submitted as 2010 (the next-free port
    per a live assignment table given at the time), reassigned to
    **2011** once the portal reported 2010 was already taken by
    IMPACT Arcade, then reassigned back to **2010** a second time once
    IMPACT Arcade itself moved to 2011 and freed 2010 back up. Current
    (as of this second correction): **`"port": 2010`**, live at
    `http://192.168.1.36:2010/` on the portal's next hourly rebuild -
    confirm against the portal's own live list if this changes again
    rather than assuming either number is final.
  - **Still open / not built**: the INTEL slot/game - no gameplay for it
    has been specified yet beyond the pillar name, same gap noted below.
  - **Genuinely open, not guessed at** (for the still-open INTEL slot):
    are COUNTER and INTEL meant to be
    genuinely separate standalone games/demos - their own directories,
    own `index.html`, own portal card with real art/description, sibling
    to Long Range Node Attack the way Cannon/Rocket Builder/IMPACT/Pulse
    are each their own thing (the precedent `LRNA-065` already names for
    "build a new game on its own branch") - or modes/entry points *within*
    the existing Long Range Node Attack game (e.g. a Counter-focused start
    screen and an Intel-focused start screen, linking into the same game
    file with a mode flag)? The portal's existing pattern (each card is a
    fully separate game with its own art/chips/description) leans toward
    "separate games," but that's a much bigger build than a mode toggle -
    confirm before starting.
  - If separate games: what's the actual gameplay for each - is COUNTER a
    defense-only spin on the existing Counter Missile/Counter Attack
    Planes/AM battery mechanics (playing as Node Omega, or as a pure
    defender), and is INTEL a recon/discovery-only spin on the DRONE/
    Recon Plane/SEEK AND DESTROY mechanics? Nothing concrete was given
    for either beyond the pillar name - needs real scope (what does the
    player actually do, win/lose condition, is it built on this game's
    existing code or fresh) before either can be built.
  - Relates to, but is distinct from, the still-open `LRNA-046`/`LRNA-050`
    Attack/Counter/Intel *button-bar* theming inside this one game - this
    ticket is about the *portal listing* (which games exist to play), not
    that in-game UI reorganization; the two shouldn't be conflated even
    though they share the same three pillar names.
- **LRNA-086** — Boost/impact camera shake. Spun off from LRNA-061's
  flight-phase review. A short, decaying positional offset on top of
  `camX` (plus a small vertical jitter), triggered when the currently-
  followed missile is in its boost window at launch and again the
  instant its flight resolves (impact/intercept/miss) while still the
  followed contact. Additive only - doesn't touch how `followId`
  tracking itself works. Concrete enough to build; not started pending
  confirmation this is wanted (a new feature, not a fix).
- **LRNA-087** — Motion trail / speed lines, distinct from the smoke
  trail. Spun off from LRNA-061. A new short-lived streak particle (thin
  bright line along the live velocity vector, ~0.15-0.25s life, fading),
  layered in front of the existing smoke trail, spawned only once live
  speed crosses a threshold (proposed |vx| > 500). Concrete enough to
  build; not started pending confirmation.
- **LRNA-088** — Foreground parallax scroll tied to altitude. Spun off
  from LRNA-061. A second, nearer terrain band beyond LRNA-030's existing
  rivers/creeks/tree clusters, scrolling faster (proposed 1.3x world/
  camera speed) and fading/shrinking with `altitude(m)`, so a missile's
  ballistic arc and low-altitude phases read against something closer
  than today's single terrain layer. Concrete enough to build; not
  started pending confirmation.
- **LRNA-089** — DONE — Post scores to the Arcade 3000 scoreboard
  (`owner-action/Alert#551`, filed by the Arcade 3000/Nixon session,
  agent-ready). New `postArcadeScore(score)` in the scratch source,
  called once from `triggerRunEnd()` with `currentWave` - this mode's
  existing score, "waves survived" (LRNA-072). Gated to a same-origin
  `POST /api/scores` that only fires when actually served by Arcade 3000
  (`location.port` matches `300[0-9]`/`301[01]`, i.e. 3000-3011) and a
  player name cookie is set; everywhere else (this game's own Game
  Portal listing on :2001, a bare file:// open, local dev) it's a silent
  no-op, wrapped in `.catch(() => {})` so a missing/offline Arcade
  endpoint never breaks the game. Implemented verbatim to the issue's
  given code, not reinvented. Scoping note (issue asked to state this if
  ambiguous): only the core endless-Waves mode's score posts, not Siege
  Mode's separate win/lose-with-time-remaining outcome - Siege is an
  optional secondary challenge without a comparable accumulating score,
  and the issue's "game's existing score" points at the game's default
  mode. Verified: (1) isolated logic test of the exact function against
  8 cases (Game Portal port 2001, bare file:// empty port, in-range
  ports 3000/3001/3011 with and without a name cookie, an out-of-range
  port 3012, and a negative-score clamp-to-0 case) - every case gated
  and shaped its POST body exactly as specified; (2) live instrumented
  build on file:// (empty port, this repo's own serving path) played for
  8s with network-request capture on `/api/scores` - zero requests sent,
  zero console/page errors, confirming the no-op path is genuinely inert
  during every other test this session already runs against this file.
- **LRNA-090** — DONE — Fixed: Interceptor Jets flying through/past the
  Strike Platform on return instead of landing (direct bug report:
  "INceptor planes are turning back and hitting the base when they
  collide with the incoming missile or plane"). Root cause: an
  Interceptor Jet's trip home always takes exactly `def.eta` (10s)
  regardless of how far out it engaged (`m.vx = backDist / def.eta`), so
  one recalled from deep in enemy territory returns at a much higher
  speed than one recalled from nearby - fast enough, at a long enough
  `backDist`, that a single frame's step (up to the game's own 0.05s dt
  cap) could jump clean over the 40-unit-wide `homeDist <= 20` arrival
  window without ever landing inside it, reading as the jet flying
  straight through the base instead of stopping there. Fixed by also
  checking whether that frame's move crossed `nodeA.x` (a sign change in
  `nodeA.x - m.x` before vs. after the step), not just whether it's
  currently close to it - and snapping `m.x` to `nodeA.x` on arrival so
  the landing burst always renders exactly at the base regardless of how
  far the raw step overshot. Verified two ways: (1) captured real
  backDist/vx pairs from live gameplay (e.g. backDist=11053,
  vx=-1105/s) and confirmed the game's own dt cap (0.05s) is genuinely
  reached in practice (`maxDtSeen: 0.05`); (2) a deterministic unit test
  of the exact step logic using one of those real captured velocities,
  engineered to land just outside the arrival window on both sides of a
  single step (55.25-unit jump vs. a 40-unit window) - the old check
  provably misses it (`arrived: false`), the new check provably catches
  it via the crossing test (`arrived: true, crossedHome: true`); plus a
  live instrumented regression pass (15 real Interceptor Jet launches
  over ~40s), zero console/page errors.
- **LRNA-091** — DONE, SUPERSEDED BY LRNA-093 — Flat 100 starting coins for every category
  (direct request: "Start with only 100 coins of each catergory").
  Fresh-player initialization is now `tokens = { attack: 100,
  counter: 100, intel: 100 }` - no difficulty scaling, replacing the old
  `splitEvenly(STARTING_TOKENS_TOTAL * difficulty.resourceMult)` grant
  (~2000 total, scaled per difficulty, LRNA-071/#428). Also supersedes
  LRNA-083's zero-starting-grant rule for Attack specifically - Attack
  now gets the same flat 100 as the other two, though it still earns
  nothing further passively beyond that until a hidden target is
  recon'd (`FOUND_TARGET_ATTACK_RATE`, unchanged). Removed the now-dead
  `STARTING_TOKENS_TOTAL` constant (its only reference was this block).
  Left alone on purpose: the legacy-migration path (an existing old
  single-currency save converting once, pre-#429) - that's carrying over
  an existing balance fairly, not a "starting" grant, so it wasn't in
  scope here. Verified directly (instrumented build, fresh localStorage,
  both NORMAL and HARD difficulty): saved tokens read exactly
  `attack: 100` (no passive trickle exists for Attack) and
  `counter`/`intel` at 100 plus a few tenths from the existing 1/sec
  passive trickle during the verification wait, identical across both
  difficulties (confirming no scaling crept back in), zero console
  errors.
- **LRNA-092** — DONE — Node Omega's displayed 250/250 isn't a real matching
  health pool the way the Strike Platform's is (direct report: "its not
  250 points vs 250 points on player 1 and player 2 -- fix this with a
  ticket... make BOTH have 250"). Confirmed by reading the actual
  mechanics, not guessed at: `nodeA.health` is a real, directly-tracked
  0-`PLAYER_MAX_HEALTH` (250) integer - every hit subtracts from it
  directly (`applyDamage`). Node Omega has no equivalent value at all;
  its HUD's "250/250" is `Math.round(omegaRemainingNodes /
  OMEGA_TOTAL_NODES * PLAYER_MAX_HEALTH)` - a *display-only*
  normalization of a completely separate, much larger scale
  (`omegaRemainingNodes`/`OMEGA_TOTAL_NODES`, a raw count in the
  hundreds of thousands, e.g. the "(478,500 nd)" readout next to the
  bar). That raw scale is what every player weapon's `dmg` value
  (FAST 50, MEDIUM 250, LARGE 1000, CLUSTER 1400 - LRNA-042/044) actually
  drains, what gates Omega's real alive/dead state
  (`omegaRemainingNodes <= 0`), what its flak/counter systems check
  before engaging, and what its erosion-order pixel-art crumble
  (`buildOmegaBase`/`damageOmegaAt`, LRNA-008/020) renders from directly
  - the two players are not mechanically symmetric today, only their
  HUD numbers coincidentally both read "250".
  **Why it's built this way, and the real fork this needs a decision
  on, rather than guessing:** the raw large-number scale exists
  specifically to drive the pixel-erosion crumble art - collapsing
  Omega's *real* tracked value down to a literal 0-250 integer (to
  match `nodeA.health`'s granularity exactly) would mean either (a)
  driving the crumble visual off a coarse 0-250 value instead of its
  current fine-grained pixel count, visibly changing how gradual/smooth
  the crumble looks, or (b) adding a second, genuinely new 0-250
  `omegaHealth` value tracked in parallel with the existing pixel system
  (keeping the crumble exactly as fine-grained as it is today, driven
  by the same underlying proportion) and rewiring every one of the
  checks above to read the new value instead. Either way, there's a
  concrete number this needs that doesn't exist yet: how much of a
  250-point pool one hit from each weapon type should cost - today's
  `dmg` values (50/250/1000/1400) were tuned entirely against the huge
  raw scale (LRNA-042/044's cost rebalance), with no established
  conversion to a 250-point scale to extend, unlike LRNA-079's own
  follow-up rescale of `ENEMY_STRIKE_SIZES` above, which had a clear
  existing ratio (100->250) to reuse.
  **Player answered both open questions directly**: fork (b) - a
  genuinely separate real `omegaHealth` (0-250), keeping the pixel-
  crumble art exactly as fine-grained as before - and a target of
  5-8 hits to destroy Omega with a single CLUSTER (the strongest
  warhead).
  **Shipped**: `omegaHealth`, a real 0-`PLAYER_MAX_HEALTH` value with no
  regen (matching `nodeA.health`'s own no-heal design, LRNA-069),
  tracked entirely separately from `omegaRemainingNodes`/
  `OMEGA_TOTAL_NODES` (which are now purely cosmetic - still drive
  `damageOmegaAt`'s crumble art and `updateOmegaRepair`'s slow visual
  patching, untouched, but no longer gate anything gameplay-real).
  `applyDamage`'s Omega branch now drains `omegaHealth` by
  `Math.max(1, Math.round(dmg * OMEGA_HEALTH_DMG_RATIO))` on every hit
  alongside the unchanged cosmetic crumble call.
  `OMEGA_HEALTH_DMG_RATIO = 0.03` (42/1400) was picked to land CLUSTER
  exactly at 6 hits (`250/42 = 5.95`, floor of the requested 5-8 range),
  giving FAST 125 hits, MEDIUM 32, LARGE 9, strikeFighter 28,
  strikeBomber 12, heavyBomber 7 - the existing relative weapon-tier
  ordering preserved, just now against a real, meaningful pool. Every
  other alive/dead/targetable check in the file that used to read
  `omegaRemainingNodes <= 0`/`> 0` as Omega's "is it dead" gate now
  reads `omegaHealth` instead (wave director, `getTarget`, Omega's own
  Counter Missile/Planes, flak, Siege Mode's win condition, the target
  list/radar readout, the death-grayscale render check, the targeting
  reticle) - the two players are now mechanically symmetric, not just
  display-normalized to look that way. HUD's `oHealth`/`oBar` now read
  `omegaHealth` directly; `oHealthNodes`'s "(478,xxx nd)" parenthetical
  keeps showing the separate raw pixel count as flavor/epic-scale info,
  now clearly cosmetic rather than the real model. Save/restore
  (`reset()`'s `initial.omegaHealth`, the save-state's `omegaHealth`
  field) added alongside the existing raw-node persistence.
  **Notable finding surfaced while verifying, not in scope to fix
  here**: Omega's own Counter Missile (`OMEGA_COUNTER_MISSILE_HIT_CHANCE`
  75%, 6s cooldown) gets up to 4 shots at a single 24s CLUSTER's flight -
  cumulative interception odds near 99.6%, so CLUSTER is very likely to
  never land at all against Omega's active defenses today, independent
  of this ticket's health-pool fix. Worth its own ticket if that feels
  like it should be rebalanced.
  Verified two ways: (1) a deterministic unit test of the exact
  `applyDamage` conversion formula against every weapon type, confirming
  CLUSTER kills in exactly 6 launches (within the requested 5-8) and
  each concrete before/after health value matches by hand; (2) live
  instrumented gameplay - captured real hits landing on `omegaHealth`
  through Omega's own defenses (which intercepted the large majority of
  shots, as expected/designed), observed `oHealth` tracking exactly
  250->248->246 for two real FAST hits (dmg=50 each, matching the
  formula precisely), zero console/page errors across all verification
  passes.
- **LRNA-093** — DONE — Full economy rework (direct request, refined
  across two clarifying answers): "Change the money to Start at 1000
  1000 1000 -- earn 100 per second -- only get extra coins from DMG
  impact of missiles and planes on base." The "only" was taken literally
  - this replaces the whole reward system from LRNA-073/LRNA-083 on, not
  an addition to it.
  - **Starting grant**: `tokens = { attack: 1000, counter: 1000,
    intel: 1000 }`, no difficulty scaling - supersedes LRNA-091's flat
    100 (superseded-not-deleted, see that entry).
  - **Passive income**: flat `TOKEN_PASSIVE_RATE = 100`/sec, identically
    for all three pillars (player answer: "100 coins per second to each
    catergory") - replaces LRNA-083's whole recon-gated Attack model
    (`FOUND_TARGET_ATTACK_RATE`, the "zero until a target is found, then
    stacks per target" mechanic) and the old small counter/intel
    trickle (`TOKEN_PASSIVE_RATE` was 1). The Reactor Boost upgrade's
    existing "+1 Intel/sec" still applies on top, unchanged, just
    proportionally smaller now (100->101) - not in scope to touch.
  - **Damage-based Attack income**: `DMG_TO_COIN_RATIO = 1` (player
    answer, refining the option offered: "how much dmg was done back in
    coins one for one") - every Attack-pillar weapon impact (main
    arsenal hit, plane bombing run, Attack Drone hitting a hidden ground
    node) pays back exactly the damage it just dealt, 1:1, replacing the
    old flat per-type reward table (`TOKEN_REWARDS`, e.g. FAST paid a
    flat 5 regardless of its actual 50 damage). EMP (0 damage) now earns
    0 and skips the popup entirely rather than showing a "+0".
  - **Removed entirely** (no longer earn anything, per "only"):
    discovery bonuses (both the recon DRONE's and Recon Plane's,
    `INTEL_DISCOVERY_REWARD`), destroy/kill bonuses on top of the
    damage-based reward (`TOKEN_REWARDS.destroy`, `destroyBonus` on
    field targets - the field-target definitions and object literal
    fields were removed too, now fully dead), wave-clear and
    Omega-destroyed bonuses (`WAVE_CLEAR_TOKEN_REWARD`,
    `WAVE_OMEGA_BONUS_TOKENS`), and every Counter-pillar intercept
    reward (Ground Units chip hits, full Counter intercepts, Interceptor
    Jet kills) - Counter's only income now is the flat passive rate,
    since intercepting doesn't deal damage to the enemy's base.
  - Left untouched, out of scope: `ABILITY_PILLARS`/weapon `cost`
    values (what things cost to launch, not what they earn) and the
    Reactor Upgrades system itself.
  Verified: (1) fresh localStorage, `#startGameBtn`, tokens read exactly
  `1000/1000/1000` before any time passes, then all three track
  identically at +100/sec (confirmed via repeated localStorage reads);
  (2) a captured live FAST volley, reconciled by hand against the
  turn-based shot limit and launch cost (`tokens.attack` matched
  `counter`'s passive-only trajectory exactly once the 3 actual
  launches' 100-cost-each spend and 2 confirmed 50-damage hits' 50-coin
  rewards were accounted for - both landed hits paid exactly their
  damage value, 1:1); (3) a broad regression across every weapon type
  plus recon plus a plane launch, zero console/page errors throughout.
- **LRNA-094** — DONE — LRNA-093 follow-up: reset stale saved balances
  to the new economy (direct report: "Fix the money... its showing very
  large numbers instead of the current coin I can spend"). Root cause
  confirmed, not guessed at: `updateTokenHud` was already correctly
  displaying the real spendable `tokens[pillar]` - no display bug - the
  large numbers were a genuine, previously-accumulated balance
  (`lrna_tokens_v1`) from before LRNA-093 shipped, which `loadTokens()`
  correctly kept honoring (existing saves aren't supposed to silently
  vanish) while the new flat 100/sec rate kept compounding on top of it.
  Player confirmed this was the issue and asked for a reset. Fixed by
  bumping the storage key (`TOKENS_KEY`: `lrna_tokens_v1` ->
  `lrna_tokens_v2`) - the standard versioning pattern this same key
  already used once before (pre-#429's `LEGACY_COIN_KEY` migration) - so
  any existing save becomes invisible to `loadTokens()` and every
  returning player falls through to the genuine-fresh-player branch,
  getting the new `1000/1000/1000` grant exactly once. Deliberately
  narrow: only the spendable token balance resets - best wave, Reactor
  Upgrades, and the lifetime-earned stat are untouched, and the old v1
  data is left in place (harmless, simply no longer read) rather than
  deleted. Verified directly (instrumented build): seeded a stale
  `lrna_tokens_v1` save matching real numbers seen in play
  (40,126/384/1,676) plus an unrelated best-wave save, started a fresh
  game, confirmed the new `lrna_tokens_v2` save reads ~1000 each (plus
  a fraction of a second's passive income), the old v1 save is
  untouched byte-for-byte, and the unrelated best-wave save is
  untouched, zero console/page errors.
- **LRNA-095** — DONE — Let recon DRONEs actually survive to eventually
  attack the base (direct request: "Let me Drones eventually attack the
  base"). Confirmed by reading the code, not guessed at: DRONE already
  flies through the same shared `launchAttack`/impact pipeline as every
  other warhead, so it was always technically capable of reaching and
  landing its (small, 10-point) hit on Node Omega after its full 120s
  flight - but `omegaCounterCandidates` never excluded it, and Omega's
  Counter Missile (6s cooldown, 75% hit chance) gets up to ~20 shot
  opportunities across a 120s flight, making interception before arrival
  functionally certain (1-0.25^20 is effectively 100%). `updateFlak`
  (the tracer-spray point defense) was checked too and confirmed
  cosmetic-only - it never destroys anything - so it wasn't the real
  blocker.
  Fixed with a single exclusion in `omegaCounterCandidates` (shared by
  both Omega's Counter Missile and Counter Planes systems): `if
  (m.typeKey === 'drone') continue;`. A drone in flight is now simply
  never offered as a target, so a surviving one can complete its recon
  run and go on to land its hit exactly as the existing pipeline already
  allowed for.
  Verified directly (instrumented build): launched a single recon drone
  as Omega's only possible target and captured every Counter Missile
  targeting check for 30s (~5 full cooldown cycles) - all 99 checks
  logged 0 candidates, explicitly confirmed with the drone actually
  showing as in-flight (`inFlightTypes=[drone]`) rather than just
  absent; plus a broad regression across every other weapon type, zero
  console/page errors.
- **LRNA-096** — DONE — Removed the raw pixel-crumble count from Node
  Omega's HUD readout (direct request, after asking whether to keep it
  as flavor or drop it now that `oHealth` is the real number - answer:
  "Remove it"). The "(478,xxx nd)" parenthetical next to Node Omega's
  health - originally added back by an earlier direct request as
  flavor/epic-scale text - is gone from both the HTML (`#oHealthNodes`
  span removed) and `updateHud()` (the line writing to it removed).
  `omegaRemainingNodes`/`OMEGA_TOTAL_NODES` are untouched and keep
  driving the actual crumble art (`damageOmegaAt`/`updateOmegaRepair`)
  exactly as before - this only removes the HUD text, not the
  underlying cosmetic pixel system. Verified directly (instrumented
  build, screenshot): HUD now reads "NODE OMEGA — 250/250" with no
  trailing parenthetical, zero console/page errors.
- **LRNA-097** — DONE — Removed CLUSTER and EMP from the launch bar "for
  now" (direct request). Both `<button>` elements pulled from the
  ATTACK group's HTML; `TYPES.cluster`/`TYPES.emp` and every code path
  that resolves them (splitCount sub-hit loop, EMP jam effect) are left
  completely untouched, so re-adding the two buttons later is a pure
  HTML change, not a rebuild. Renumbered the remaining launch-bar
  keyboard shortcuts (LRNA-074) to stay contiguous 1-7 instead of
  leaving gaps: FAST=1, MEDIUM=2, LONG RANGE=3, COUNTER MISSILE=4,
  COUNTER ATTACK PLANES=5, EMERGENCY COUNTER=6, DRONE=7 - both the
  visible `.btnKey` labels and the `SHORTCUT_KEYS`/`shortcutButtons`
  array driving the actual keydown handler were updated together so
  they stay in sync. Verified directly (instrumented build): neither
  button exists in the DOM, the 7 remaining keys read in the correct
  new order, zero console/page errors.
- **LRNA-098** — DONE — Removed Interceptor Jet "for now" (direct
  request: "Remove INtercept Jet"). Plane buttons are generated
  entirely from `PLANE_TYPES` (`Object.values(PLANE_TYPES)`), so
  dropping the `interceptorJet` entry was the single point of removal -
  every code path that resolves it (`firePlane`'s interceptorJet
  branch, the outbound-chase-a-moving-missile logic, its own SFX
  profile) gates on `planeKind === 'interceptorJet'` or reads
  `PLANE_TYPES.interceptorJet` only inside that same gate, so it's now
  simply unreachable dead code rather than needing its own edits -
  re-adding the entry later restores the whole feature. Left alone on
  purpose: the vestigial `interceptorJet` entries in the plane-name-list
  and counters lookup objects, harmless and not part of the button-
  generation path (same "don't touch what isn't broken" call LRNA-079
  made for `nodeO.health`). Verified directly (instrumented build): the
  Counter pillar's PLANES row is empty (Interceptor Jet was its only
  entry), zero console/page errors.
- **LRNA-099** — DONE — Counter Attack Planes window, matching LRNA-051's
  Counter Missile window (direct request: "Make a Counter Missile and
  Counter PLane windows" - the Counter Missile one already existed from
  LRNA-051; this builds the missing sibling). Same status-panel pattern
  exactly: a real second overlay (`#counterPlanesWindow`), not an
  Operations Center tab, showing the Strike Platform's live health plus
  up to 2 live inbound threats (`counterPlanesPlan()`'s own existing
  scramble-1-or-2 logic, unchanged) each with name/class, speed, and a
  live impact countdown bar. The COUNTER ATTACK PLANES launch-bar button
  now opens this window instead of firing instantly - SCRAMBLE PLANES
  (calls the existing `fireCounterAttackPlanes()`, then closes) and HOLD
  FIRE (closes, no spend) mirror the Counter Missile window's actions
  exactly. Auto-closes if every threat it was opened for resolves while
  open (same rule as the Counter Missile window), and closes on `reset()`
  alongside it. Verified directly (instrumented build): confirmed the
  pre-existing Counter Missile window is unaffected by this change,
  opened the new window against a real inbound threat (base HP and cost
  populated correctly), fired it and confirmed real Counter tokens were
  spent and the window closed afterward, zero console/page errors.

- **LRNA-123** — DONE — Plane Overshoot Fix: Planes Never Land/Rearm
  Issue: Planes returning from deep enemy territory could overshoot landing
  zone and get stuck in 'returning' phase forever, leaving plane slot
  permanently blocked and unrecoverable. Root cause: Transition to 'returning'
  phase assumed `PLANE_TYPES[m.planeKind]` was always valid; if missing (edge
  case), `m.totalSeconds` became undefined and `m.vx` became NaN, freezing the
  plane mid-flight with no landing condition ever true (landing gates are
  `homeDist <= 20 || crossedHome || m.age >= m.totalSeconds * 1.5`, and
  `m.totalSeconds` being undefined failed all of them).
  
  Fixes applied: (1) Guard check on outbound-to-returning transition — if plane
  type definition not found in PLANE_TYPES, force-land plane immediately, reset
  slot to 'rearming' state, and mark for removal. (2) Invalid velocity check on
  returning frame — if `m.vx` is NaN or zero (indicating a broken state), force
  landing immediately. Both safeguards ensure plane slots reset properly for
  reuse and broken planes never jam the system.
  
  Verified: Playwright test confirmed planes complete 30+ second journeys and
  land correctly; zero NaN-velocity planes stuck in returning phase; all plane
  slots properly cycle through 'ready' → 'flying' → 'rearming' → 'ready' states.

- **LRNA-124** — DONE — Loadout Satellite Selection Duplication Exploit fixed.
  Selecting Satellite in a slot where it's already selected elsewhere now
  shows an alert and reverts the selection, instead of allowing duplicates
  that stacked its map-reveal effect for free. Verified with an instrumented
  Playwright build.
- **LRNA-125** — DONE — Omega rebuild invulnerability window added
  (`OMEGA_REBUILD_INVULN`, 0.5s). Previously, missiles already in flight
  toward Omega at the moment of its death would still land on the freshly
  rebuilt Omega, dealing "free" damage across the death/rebuild handoff.
  Verified: forcing a killing blow then an immediate follow-up hit shows the
  follow-up dealing zero damage during the window.
- **LRNA-126** — DONE — Missiles no longer "ghost hit" a target destroyed
  mid-flight. Hit/miss used to be decided once at launch and stored on the
  missile; now the target's existence is revalidated and the hit chance is
  rerolled fresh at the moment of arrival. Verified: destroying a field
  target right after launching a missile at it produces zero ghost hits on
  arrival, while a live control target still takes hits normally.
- **LRNA-127** — DONE — Emergency Counter's per-target cap
  (`EMERGENCY_MAX_PER_TARGET`) was being tripped by *other* systems' counters
  (AM batteries, loadout nodes) also in flight against the same target, not
  just Emergency's own shots - `findEmergencyTarget()`'s "already engaged"
  check now only looks for Emergency's own tagged counter
  (`fireCounter(..., 'emergency')`). Verified: with 4 concurrent unrelated
  counters also chasing the same target, Emergency's second shot still fires
  correctly once its own first counter resolves.
- **LRNA-128** — Investigated, not a bug. The cited `TOKEN_PASSIVE_RATE * 2`
  is the correct sum across two token pillars sharing that rate (attack +
  counter), not a double-count of one - `lifetimeTokensTotal`'s delta exactly
  matched the real sum of all three pillars' gains over a 5s live check.
- **LRNA-129** — DONE — Counter Plane chase timeout now uses the target's own
  remaining flight time (`target.totalSeconds - target.age`) instead of a
  flat 20s, fixing Heavy Bomber's 30s legs (previously undercut) and
  correctly shortening the window for planes near the end of a leg. Regular
  missile targets are unaffected (still `COUNTER.totalSeconds`).
- **LRNA-130** — Investigated, not a bug. `dist1000()` already clamps to
  [0, 1000] at the source for every Radar Lane contact type; verified
  missiles spawned far outside the corridor still render exactly at the 0%/
  100% edges, never off-scale.
- **LRNA-131** — Investigated, by design (LRNA-092). `omegaRemainingNodes`
  is documented as a purely cosmetic pixel-erosion count driving crumble
  art; `omegaHealth` is the sole real gate on alive/dead/targetable. The
  main HUD only displays `omegaHealth` now, not the raw node count.
- **LRNA-132** — Investigated, not a bug. Flak (`updateFlak`/`spawnFlak`) is
  purely cosmetic tracer fire with no `applyDamage`/hit-chance roll of its
  own; it has no bearing on actual interception effectiveness to "fix."
- **LRNA-133** — Investigated, not a bug. `updateHud()` already calls
  `renderSeekDestroy()` every frame while the window is open (61 calls
  measured in 1s live), not just on a drone hit.
- **LRNA-134** — DONE — Ground Units chip stacking now gets a persistent
  visual indicator (dashed ring + "xN" badge) on the missile for the rest of
  its flight, not just the fading "DAMAGED" callout at the moment of the
  hit. Verified: chipHits and the 0.6x damage multiplier stay in sync across
  two successive chips (50 → 30 → 18).
- **LRNA-135** — DONE — Counter Attack Planes' window now shows a "+N more
  inbound - not covered by this scramble" note when more threats exist than
  the 2 planes being sent can cover (each plane can only kill one target, so
  this was always an accurate 2-of-N preview, not an arbitrary truncation).
- **LRNA-136** — DONE — Hard cap added (`MAX_PARTICLES = 5000`), trimming
  the oldest excess each frame. Verified: flooding 8000 particles in one
  burst settles to exactly 5000 on the next tick.
- **LRNA-101** — Investigated, by design. The FAST-missile exclusion is
  already documented at the source ("FAST ones move too quick for the
  system to lock onto"); Counter Missile/Counter Attack Planes have no size
  gate and can engage FAST threats, so excess Counter tokens aren't stuck.
- **LRNA-102** — DONE — Omega's Counter Missile is now capped at 2 attempts
  per target (`OMEGA_COUNTER_MAX_PER_TARGET`, matching Emergency Counter's
  own convention), so a LARGE/CLUSTER's longer flight time no longer buys
  Omega more cumulative shots (previously ~98%/~93% interception odds vs.
  FAST/MEDIUM's fewer-shots-fit advantage). Verified: forcing 6 consecutive
  engagement cycles at the same target shows the counter climb to exactly 2
  and hold there.
- **LRNA-103** — Investigated, not a bug. The described `counterPopupShown`
  auto-popup mechanic doesn't exist in the current Counter Missile window
  (LRNA-051 rewrote it); `renderCounterWindow()` re-fetches the live soonest
  threat every frame while open, so it already switches to a fresh threat
  automatically rather than sitting stale.
- **LRNA-104** — Investigated, by design (LRNA-070). Loadout nodes having no
  range gate is documented as intentional at ship time, explicitly matching
  AM batteries' own equally range-agnostic behavior.
- **LRNA-105** — Investigated, not a bug. `COUNTER_WINDOW_SECONDS` doesn't
  exist anywhere in the codebase; no weapon type (missiles, drones, planes)
  has a launch-time distance/time-to-impact gate to be asymmetric with.
- **LRNA-106** — Investigated, stale. Built entirely on a "10/sec passive
  income" figure; the current rate is 100/sec per pillar (10x higher, from
  the LRNA-073 economy rework) - e.g. Counter Planes now recharges in 10s,
  not the cited "~10 waves of doing nothing."
- **LRNA-107** — Already resolved via LRNA-072. `resetGame(false)` no longer
  exists; the Waves of Battle system already ships the "survival time score
  metric" this ticket asked for, measured in waves survived (`bestWave`)
  rather than a flat timer.
- **LRNA-108** — DONE — Loadout nodes now prefer a target no other loadout
  node currently has an in-flight shot against, falling back to the
  original any-eligible-target search only when nothing else qualifies.
  Verified: with 2 simultaneous threats and 3 active nodes, fire spreads
  across both instead of all 3 landing on one; a lone threat still draws
  fire from every node (fallback intact).
- **LRNA-109** — DONE — Enemy strike contacts in the Radar Lane list now
  append their size (e.g. "STRIKE [MEDIUM]"), matching the INCOMING alert's
  existing size distinction instead of collapsing all sizes into one label.
- **LRNA-110** — DONE — A floating "INTERCEPTED BY ..." callout now names
  the defender on every successful intercept. `fireCounter()` takes an
  optional `source` tag (used by Emergency Counter, Counter Missile,
  Counter Attack Planes, loadout nodes, AntiPlane nodes, Omega); a
  `describeDefender()` helper resolves a name from that tag or falls back
  to a live origin-id lookup (AM battery/field target/Omega) for the
  untagged generic auto-defend path. Verified: all 8 defender-naming cases
  (4 tagged abilities, an untagged Omega fallback, real loadout/AM-battery
  names, and a graceful unknown-origin fallback) resolve correctly.
- **LRNA-111** — Investigated, not a bug. The `followVel` variable this
  ticket describes doesn't exist; camera-follow (LRNA-010) recomputes the
  missile's live `vx` and the live `vw()` (updated on window resize) fresh
  every frame, with nothing cached from launch time to go stale.
- **LRNA-112** — DONE — Recon Drone now shows its own discovery detection
  radius (`ANTIPLANE_DISCOVERY_RANGE`) as a dashed circle while flying,
  drawn around the drone itself rather than around hidden nodes (which
  stay intentionally invisible per LRNA-039) - helps gauge detection range
  without revealing hidden positions.
- **LRNA-113** — Investigated, not a bug. Reactor Boost (and every Reactor
  Upgrade) persists via its own dedicated `ownedUpgrades`/`lrna_upgrades_v1`
  storage, completely separate from the `loadout` array this ticket
  describes. Verified across a full page reload, not just a game reset.
- **LRNA-114** — Investigated, not a bug. `findInboundEnemyMissiles()` has
  no window filter at all - every inbound enemy strike is a candidate
  regardless of remaining time, so "NO INBOUND THREATS" (green) only shows
  when the list is genuinely empty; a real threat always shows as
  INCOMING, colored by its actual remaining time.

- **LRNA-115** — DONE — Every 5th wave (and every multiple of 5) is now
  announced as an "⚠ ELITE WAVE", deals 2x damage per strike
  (`ELITE_WAVE_DMG_MULT`), and gets a pulsing ring on each elite strike
  plus a flagged wave HUD for its duration.

- **LRNA-116** — DONE — Added `#omegaCounterStatus` to the HUD, showing
  live "CM READY"/"CM 0:0X" and "PLANES READY"/cooldown text for both of
  Omega's counter abilities, driven by `updateOmegaCountersHud()`.

- **LRNA-117** — DONE, but not as literally described. Recon Plane
  actually force-discovers the next undiscovered hidden node in a fixed
  deterministic order (`resolvePlaneOutboundJob`) - there's no
  player-chosen destination to preview a line toward, and drawing one to
  the real node position would leak it before discovery (violates
  LRNA-039). The real underlying complaint (wasted INTEL) was that
  launching Recon Plane after every node is already found silently wastes
  a full sortie for nothing; `updatePlaneButtons()` now disables the
  button and shows "ALL LOCATED" once nothing is left to discover.

- **LRNA-118** — Closed, not planned. `TYPES.cluster`/`TYPES.emp` are
  still fully implemented; only their launch-bar buttons were removed,
  deliberately ("direct request", per an existing code comment). Building
  a player-facing way to re-enable them would reverse that explicit prior
  decision rather than fix a defect, so not doing that without a new
  explicit instruction. The dead-code-cleanliness half of this ticket is
  the same complaint as LRNA-143, tracked there instead.

- **LRNA-119** — DONE — Added an explicit PAUSE/RESUME button (separate
  `paused` flag, not reusing `running` since that also means "game over").
  Gates the real update loop in `loop()` plus every token-spending action
  function directly, so a stray click can't sneak an action through while
  paused. Centered "PAUSED" banner makes the state visible.

- **LRNA-120** — DONE — Added a MUTE/UNMUTE button. Every sound effect
  already routed through one `masterGain` GainNode, so muting is just
  zeroing that node's gain; preference persists to localStorage and is
  read before the first user gesture creates the AudioContext. Also fixed
  a pre-existing dead `@media (max-width: 560px)` block (declared before
  the base rules it was meant to override, so same-specificity cascade
  order always picked the base rule regardless of viewport) - moved it to
  the end of the stylesheet so it and the new mobile button positions
  actually apply.

- **LRNA-121** — DONE — The ability-bar buttons now swap to short text
  below 560px (`isMobileViewport()`) instead of wrapping the full desktop
  text across 3-5 lines: Emergency Counter drops to time-to-impact + cost,
  Counter Missile/Counter Planes subtext drops to "Nx · 75%", and "COUNTER
  ATTACK PLANES" drops the redundant "COUNTER" prefix.

- **LRNA-122** — Investigated, not reproducing. Both mouse-drag
  (`mousedown`/`mousemove`/`mouseup`) and single-finger touch-drag
  (`touchstart`/`touchmove`/`touchend`) panning already exist as a
  symmetric handler pair sharing the same drag state - verified by
  dispatching synthetic touch events and confirming the camera actually
  panned. No pinch-to-zoom exists either way, so the ticket's description
  of current behavior doesn't match the code.

- **LRNA-137** — DONE — EMP now deals 200 real damage (via the same
  `applyDamage()` path every other warhead uses) on top of its existing
  15s counter-jam, instead of being a pure 0-damage utility weapon.
  Against Node Omega specifically this converts through
  `OMEGA_HEALTH_DMG_RATIO` (0.03) same as every other weapon, landing as
  6 points of Omega's 0-250 health.

- **LRNA-138** — DONE — Starting tokens cut from 1000/1000/1000 to
  500/500/500; passive income (100/sec/category) left unchanged.

- **LRNA-139** — DONE — Omega's rebuild hit-chance escalation now caps
  at `OMEGA_HIT_CHANCE_CAP = 0.70` instead of 0.85, so the late game
  never fully closes the gap with the player's own fixed 0.85 hit chance.

- **LRNA-140** — DONE — Enemy strike damage now scales by difficulty via
  a new `dmgMult` per `DIFFICULTIES` entry (0.75x/1.0x/1.5x for
  easy/normal/hard), applied in `launchEnemyStrike()` on top of the
  existing size-mix scaling and stacking correctly with the elite-wave
  2x multiplier (LRNA-115). No "Impossible" tier exists in this game
  (only easy/normal/hard), so the ticket's suggested 2.0x figure for it
  doesn't apply.

- **LRNA-141** — DONE — Strike Fighter's dodge now refreshes when the
  plane transitions from its outbound leg to its return leg
  (`dodgesLeft` was never phase-gated in code - Omega's Counter Planes
  just typically got its first shot at it outbound, spending the single
  charge and leaving it defenseless on the way back).

- **LRNA-142** — Investigated, duplicate of LRNA-131 (issue #8). Verified
  live by forcing 3 consecutive rebuilds: `omegaHealth` reads exactly 250
  (full) after every one, matching the reset crumble - there's no
  persistent damage history that survives a rebuild. The one thing that
  does escalate across rebuilds is `nodeO.hitChance` (tougher defense),
  the opposite of "fragile."

- **LRNA-143** — DONE — `TYPES.cluster`/`TYPES.emp` stay fully defined
  deliberately (launch bar buttons are static HTML, not generated from
  `TYPES`, so there's nothing to gate a `DISABLED_WEAPONS` array against
  without a much larger refactor). Added `UI_DISABLED_TYPES = ['cluster',
  'emp']` at the `TYPES` definition instead - one discoverable, named
  place recording the exclusion, replacing an implicit one previously
  only visible in a comment ~3800 lines away.

- **LRNA-144** — DONE — Every `localStorage.setItem` call now goes
  through a shared `trySaveStorage()` helper instead of its own silent
  catch. On failure it logs once and flips `storageWriteFailed`, which a
  new HUD banner ("⚠ PROGRESS NOT SAVING") watches, clearing once a write
  succeeds again. Load failures untouched - falling back to defaults
  there is already correct.

- **LRNA-145** — Investigated, no bug found. Cross-checked every
  `getElementById`/`querySelector` call (80 distinct ids) against the
  actual HTML: zero mismatches. Since this is a single file where HTML
  and JS are always edited together, there's no live path where a lookup
  actually returns null today - adding `?.` across ~70 sites would be
  pure future-proofing, not a fix for anything currently broken.

- **LRNA-146** — DONE — Contact/target/upgrade list render throttle
  bumped from 0.2s (5fps) to 0.05s (20fps), cutting worst-case staleness
  vs. the unthrottled canvas by 4x without rebuilding those DOM lists on
  every single frame.

- **LRNA-147** — Declined. The ticket's own cited examples
  (`ZOOM`/`BASE_BLOCK`/`OMEGA_RES`) are already named, commented
  constants near their point of use - not unnamed magic numbers. A
  `CONFIG` object consolidating ~50+ of these would touch a large
  fraction of the file for a purely stylistic change, with real risk and
  likely worse readability (each constant's context comment would either
  get dropped or pile up disconnected from its usage). No functional bug
  to fix here.

- **LRNA-148** — Investigated, not reproducing. Every field-target
  destruction funnels through the single shared `applyDamage()`, whose
  callers all synchronously reset `selectedTargetId` in the same tick if
  needed - no async gap, no race window. `getTarget('A'|'O')` always
  returns a real object, and destroyed field targets stay in
  `fieldTargets` (never spliced), so `getTarget(selectedTargetId)` never
  returns null for a previously-valid id either. Could only reproduce the
  described bad state by directly mutating `.destroyed`, bypassing
  `applyDamage()` entirely - not a path real gameplay ever takes.

- **LRNA-149** — DONE — Emergency Counter's cost used to only appear
  embedded in its dynamic status string, vanishing entirely with no
  target selected. Restructured to the same `.btnLabel`/`.btnEta`/
  `.btnDmg` markup every sibling ability uses, so "● 150 COUNTER" is now
  always visible regardless of target state.

- **LRNA-150** — DONE — Incoming alert now appends "(+N more)" when more
  than one enemy strike is inbound, instead of always reading identically
  to a single lone threat.

- **LRNA-151** — DONE — Added a separate `#pointDefenseJamStatus` HUD
  line for `empGlobalJamTimer` ("POINT DEFENSE JAMMED"), distinct from
  the existing `#omegaJamStatus` line for `omegaCountersJamTimer`
  ("COUNTERS JAMMED") - previously only the latter had any HUD
  indicator at all.

- **LRNA-152** — DONE — Contact list now appends "+N more contacts not
  shown" once the list exceeds its 20-item cap, instead of silently
  dropping the rest with zero indication.

- **LRNA-153** — Investigated, not reproducing. `renderTargetList()`
  includes Node Omega whenever `omegaHealth > 0`, and Omega's rebuild
  runs synchronously in the same tick as the damage that kills it, so
  there's no observable frame where it's unavailable - the list can
  never actually render empty. Verified live: destroyed every field
  target and force-killed Omega in the same tick, list still showed
  "NODE OMEGA 250/250" as the sole, already-selected row.

- **Missile tunneling past its target (found while chasing LRNA-137 test
  flakiness, not its own LRNA ticket)** — DONE. Impact resolution only
  checked `distToTarget <= 14`; a fast missile can cover tens of units
  per tick (dt is clamped to 0.05s in real play too, not just
  fast-forwarded tests), so its sampled position could skip clean over
  the 14-unit hit window without ever landing inside it, then fly past
  forever - unlike planes, nothing expired it by age. Added the same
  `age >= totalSeconds` fallback planes already use. Verified with a
  regression test that deterministically reproduces the exact
  single-tick overshoot (30 units short, ~48-unit step) rather than
  relying on the original chance discovery.

---

## Workflow note (for auto-dev passes)

Follow the established pipeline for every change: edit the scratch source in
the scratchpad → `node --check` → Playwright-verify (screenshot, zero
console/page errors) → regenerate `games/long-range-node-attack/index.html`
via the font-stripping conversion script → verify the repo file too →
publish the scratch file to the Artifact (`url` set, never omitted) → commit
+ push `index.html` only, straight to `claude/practical-keller-49onif`. Move
a ticket from `OPEN`/`IN PROGRESS` to `DONE` in this file as part of the same
commit once it ships, and append new backlog tickets here as ideas come up
rather than letting them live only in a routine prompt or chat history.
