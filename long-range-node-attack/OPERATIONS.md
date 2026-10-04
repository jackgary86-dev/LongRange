# Long Range Node Attack: hosting, deploys and rebuilding from scratch

Everything needed to run, host, deploy or remake this game, in one place.
Last brought up to date 2026-10-03 (game at LRNA-181 and ART epic 3).

## Where everything lives

| What | Where |
|------|-------|
| Game source (one file, no build step) | `long-range-node-attack/index.html` on `jackgary86-dev/LongRange` `main` |
| Regression tests (Playwright) | `long-range-node-attack/tests/`, run by `.github/workflows/test.yml` on every push |
| Tickets and design history (LRNA-001 to LRNA-170, ART-1 to ART-8) | `long-range-node-attack/TICKETS.md` |
| Standalone installer (game packed inside, no server or download needed) | `long-range-node-attack/installer/longrange-installer.py`, rebuilt by `tools/build-installer.py` |
| Demo page build | `long-range-node-attack/tools/build-demo.sh` |
| Game Portal deploy copy | `jackgary86-dev/Alert`, branch `claude/practical-keller-49onif`: `games/long-range-node-attack/index.html` (byte-identical copy of LongRange `main`) and `portal-game.json` (port 2001, demo link) |
| Other pages on that Alert branch | `games/counter-grid/` (Counter Grid: Versus, portal :2010), `games/index.html` (demo landing page), `games/serve.py` |
| Game Portal build (Connor's server) | Alert branch `claude/zealous-bell-crkaru`: `game-portal/build_bundle.py` packs every game into `game-portal/portal.py` |
| Arcade 3000 (Nixon's :3000-3011) | `jackgary86-dev/gameportal`, `arcade3000/` |
| Play online (GitHub Pages, public) | https://jackgary86-dev.github.io/LongRange/, published from `main` by `.github/workflows/pages.yml` |
| Demo (Claude Artifact) | https://claude.ai/artifact/SatBvMP8LH2GaLJAs7z9ee (since 2026-10-03; the earlier one, Hkw2pPKhxc23GnaDzkGMHJ, stays at LRNA-170 and is no longer updated) |
| Cannon project's "Long Range" duel demo (a different game) | https://claude.ai/artifact/S9J6HgwNTPjHvuQ2LX4fYi, built from Alert `claude/loving-cray-ke6qxx` `templates/cannon.html` + `static/css/cannon.css` + `static/js/cannon-game.js` with the CSS/JS inlined |

`LongRange-1.0.0.html` and `FallBackCode.html` next to `index.html` are older
snapshots kept for reference; `index.html` is the game.

## Run it and test it

```sh
cd long-range-node-attack
python3 -m http.server 8000        # then open http://localhost:8000
```
Opening `index.html` directly as a file also works (the address line is
hidden then, see LRNA-170).

Tests:
```sh
cd long-range-node-attack
npm ci
npx playwright install chromium    # skip where Chromium is preinstalled
npm test                           # 102 tests as of LRNA-178
TEST_GREP=LRNA-178 npm test        # only the tests whose name contains the text
```
The 2-player tests (LRNA-178) open two pages and link them over WebRTC;
Chromium runs with `--disable-features=WebRtcHideLocalIpsWithMdns` so the
link uses plain local IPs (see `withTwoGames` in tests/lib.js).
Tests drive the game through `window.__TEST__`, which only exists with
`?test=1` in the URL (or `localStorage.lrna_test_mode = '1'`).

Balance simulation (bot vs Omega's AI, headless, fast-forwarded):
```sh
node tools/simulate.js 6 15 results.json   # games per setup, minutes per game
SIM_DIFFICULTIES=normal SIM_STRATEGIES=omega,missile-first SIM_SKILLS=sharp \
  SIM_GAME=/path/to/modified/index.html node tools/simulate.js 8 15 whatif.json
SIM_UNLOCKS=starter node tools/simulate.js 4 15 fresh.json   # a fresh player's kit (LRNA-175)
SIM_STRATEGIES=fast-nodes,buster-nodes,decoy-ghost node tools/simulate.js 6 15 new.json   # LRNA-177 missiles
```
The simulator and the test suite play with everything unlocked unless
told otherwise; unlocks are saved per browser in `lrna_unlocks_v1`.
180 games take about 2 minutes. See "Simulation findings" in TICKETS.md.

## Standalone installer

`installer/longrange-installer.py` is one file with the whole game packed
inside it (about 130 KB). It needs only Python 3.8 or newer; nothing is
downloaded and no server has to be up. Copy it to any computer (USB stick,
email, or download it from GitHub) and run it:

| Command | What it does |
|---------|--------------|
| `python3 longrange-installer.py` | Installs the game for this user, adds a shortcut and opens it. Plays offline in the browser. |
| `python3 longrange-installer.py --serve` | Hosts it on port 2001 for every device on the network, until Ctrl+C. Prints the addresses to open. |
| `python3 longrange-installer.py --service` | Linux with systemd: hosts it on every boot (asks for sudo). Run it again with a newer installer to update. |
| `python3 longrange-installer.py --uninstall` | Removes the install folder, the shortcuts and the service. |
| `python3 longrange-installer.py --extract game.html` | Just writes the game file. |
| `python3 longrange-installer.py --info` | Shows which game version is packed and where it installs. |

Options: `--port N`, `--dir FOLDER`, `--no-open`. On Windows run it with
`py` or `python` (Python from python.org, with "Add to PATH" ticked).

Where it installs, and the shortcut it makes:
- Windows: `%LOCALAPPDATA%\LongRangeNodeAttack`, a `Long Range Node Attack.url` on the Desktop
- macOS: `~/Library/Application Support/LongRangeNodeAttack`, a `.webloc` on the Desktop
- Linux: `~/.local/share/longrange-node-attack`, an applications-menu entry (and a Desktop launcher if there's a Desktop folder)

It also keeps a copy of itself in the install folder, so `--serve`,
`--service` and `--uninstall` keep working after the downloaded copy is
deleted. `--service` writes `/etc/systemd/system/longrange.service`, the
same service name the earlier NixonExpress setup used, so it replaces that
setup cleanly. Check it with `systemctl status longrange`.

Download the latest installer on any machine with internet:
```sh
python3 -c "import urllib.request as u; u.urlretrieve('https://raw.githubusercontent.com/jackgary86-dev/LongRange/main/long-range-node-attack/installer/longrange-installer.py', 'longrange-installer.py')"
```

**Keeping it current:** after any change to `index.html`, run
`python3 tools/build-installer.py` and commit the installer with it. CI runs
`tools/build-installer.py --check` (fails if the installer carries an older
game) and `tests/test_installer.py` (install, shortcuts on all three systems,
serving, uninstall).

Firewall: to reach `--serve` or `--service` from other devices, the port has
to be open, for example on Linux with ufw:
`sudo ufw allow from 192.168.1.0/24 to any port 2001 proto tcp`. On Windows,
allow Python when Windows Defender Firewall asks. Don't run it on the same
machine as the full Game Portal (`portal.py`), which wants port 2001 too, or
pick another `--port`.

## Deploying through the Game Portal (Connor's server, 192.168.1.36)

Only relevant once Connor's server is working again. Three steps:

1. **Deploy copy.** Copy `long-range-node-attack/index.html` from LongRange
   `main` over `games/long-range-node-attack/index.html` on Alert
   `claude/practical-keller-49onif`, commit ("Deploy copy: ... from
   LongRange main <sha>") and push.
2. **Rebuild the bundle.** On Alert `claude/zealous-bell-crkaru`:
   `git fetch origin && python3 game-portal/build_bundle.py`. That rewrites
   `game-portal/portal.py` (games zipped as base64) and `games.json`. Run the
   portal's own checks before pushing (compile, both Python test suites and
   `game-portal/test/smoke.mjs`). Known issue: the builder only removes
   cards for renamed games, so a card whose branch withdrew its game has to
   be removed from `games.json` by hand (Mega Chess, 2026-09-29).
3. **Server download.** Alert is private, so the server needs a GitHub
   token. Create one at https://github.com/settings/personal-access-tokens/new:
   resource owner `jackgary86-dev`, only the `Alert` repository,
   Contents: Read-only, short expiry. Then on the server, one line at a time:
   ```sh
   export GH=github_pat_...
   python3 -c "import os,urllib.request as u;r=u.Request('https://api.github.com/repos/jackgary86-dev/Alert/contents/game-portal/portal.py?ref=claude/zealous-bell-crkaru',headers={'Authorization':'token '+os.environ['GH'].strip(),'Accept':'application/vnd.github.raw'});d=u.urlopen(r).read();open('portal.py','wb').write(d);print('saved portal.py',len(d),'bytes')"
   pkill -f portal.py
   nohup python3 portal.py > portal.log 2>&1 &
   cat portal.log
   unset GH; history -c
   ```
   Skipping the `export` gives `KeyError: 'GH'`.

`admin/deploy.sh` in the gameportal repo sends gameportal's own copy of
`portal.py`, which is only as fresh as gameportal's last `sync.py` run, so
check that before using it.

## Arcade 3000 (Nixon's :3000)

Arcade serves its own copy of this game on :3001 (from gameportal's synced
`games/`), and the game posts scores to Arcade's board when it's served from
ports 3000-3011 (`postArcadeScore`, Alert #551). Alert #632 (both servers'
games on the :3000 page) is built on gameportal
`claude/browser-gaming-website-hatip4` (commit `6618200`, gameportal PR #14).
To run it: in `~/gameportal` on NixonExpress, check out that code (or
`main` once PR #14 is merged), stop `arcade3000`, run
`python3 arcade3000/test_arcade.py`, start `arcade3000` again.

## GitHub Pages

`.github/workflows/pages.yml` publishes `index.html` (and the standalone
installer, as `longrange-installer.py`) to
https://jackgary86-dev.github.io/LongRange/ on every push to `main` that
changes either file. It also runs from the Actions tab ("Publish to GitHub
Pages" -> Run workflow). It needs Pages turned on once, in the repo's
Settings -> Pages -> Build and deployment -> Source: **GitHub Actions**. The
page is public; anyone with the address can play. Players' scores and
settings stay in their own browser.

## Rebuilding the demo artifact

```sh
cd long-range-node-attack
tools/build-demo.sh            # writes dist/lrna_demo.html (git-ignored)
```
Then ask Claude to publish `dist/lrna_demo.html` with the Artifact tool,
passing `url: https://claude.ai/artifact/SatBvMP8LH2GaLJAs7z9ee` so it updates
the same page. The artifact host requires the live version to be read in
full before an update from a new conversation.

## Remaking everything from scratch

1. Clone `jackgary86-dev/LongRange`. Commit `8ec41ea` is the known-good
   game from 2026-09-30 (LRNA-170, 64 tests passing), and `a6e1864` adds
   this guide and the hosting files. `npm ci && npm test` inside
   `long-range-node-attack`.
2. Play or host it: the standalone installer above, on any computer with
   Python 3. It doesn't need GitHub or either server.
3. Game Portal listing: Alert `claude/practical-keller-49onif` holds the
   deploy copy and `portal-game.json`; if that branch were lost, recreate it
   with those two files and rerun the portal rebuild.
4. Demo: `tools/build-demo.sh`, then publish as above.
5. Working with Claude on it: the ticket history in `TICKETS.md` records
   every decision and why, and the tests pin the behavior. The development
   repo is LongRange (`main`); Alert only carries the deploy copy.

## State as of 2026-10-03

- All Long Range tickets are done or closed; no open GitHub issues.
- Recent behavior worth knowing: counters are limited per game (10 counter
  missiles, 10 counter planes, 5 emergency counters, the same for Omega);
  each game starts at 500/500/500 tokens with 20/s passive income and hits
  refunding a quarter of their damage; Siege Mode is gone.
- 2026-10-03: the menus were rebuilt (ART epic 2: home with PLAY and
  MISSIONS, setup, missions, how to play, an in-game MENU that pauses,
  shared result screens), and recon was removed entirely (LRNA-180): no
  opening lock, DRONE, RECON PLANE, INTEL currency, hidden nodes, forward
  defenses or Satellite. PLAY starts the fight at once with two
  currencies (ATTACK, COUNTER). Six missions, the first three built on
  the field targets. Then LRNA-181: one counter, EMERGENCY COUNTER, 10
  per game for each side, and ATTACK as the only currency. Then ART epic
  3 rebuilt the battle screen: corner health bars and one incoming
  warning, a compact icon bar, one strip instead of four, targeting from
  a short list, a camera that follows the action, a realistic military
  map look, and real explosions, hit markers, shake and sound.
- Connor's server (192.168.1.36) is down, and the NixonExpress hosting was
  down on 2026-09-30, so the game now ships as the standalone installer,
  which doesn't depend on either server.
