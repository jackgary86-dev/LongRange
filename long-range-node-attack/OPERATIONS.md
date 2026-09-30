# Long Range Node Attack: hosting, deploys and rebuilding from scratch

Everything needed to run, host, deploy or remake this game, in one place.
Last brought up to date 2026-09-30 (game at LRNA-170).

## Where everything lives

| What | Where |
|------|-------|
| Game source (one file, no build step) | `long-range-node-attack/index.html` on `jackgary86-dev/LongRange` `main` |
| Regression tests (Playwright) | `long-range-node-attack/tests/`, run by `.github/workflows/test.yml` on every push |
| Tickets and design history (LRNA-001 to LRNA-170, ART-1 to ART-8) | `long-range-node-attack/TICKETS.md` |
| NixonExpress hosting | `long-range-node-attack/deploy/` (service file and install script) |
| Demo page build | `long-range-node-attack/tools/build-demo.sh` |
| Game Portal deploy copy | `jackgary86-dev/Alert`, branch `claude/practical-keller-49onif`: `games/long-range-node-attack/index.html` (byte-identical copy of LongRange `main`) and `portal-game.json` (port 2001, demo link) |
| Other pages on that Alert branch | `games/counter-grid/` (Counter Grid: Versus, portal :2010), `games/index.html` (demo landing page), `games/serve.py` |
| Game Portal build (Connor's server) | Alert branch `claude/zealous-bell-crkaru`: `game-portal/build_bundle.py` packs every game into `game-portal/portal.py` |
| Arcade 3000 (Nixon's :3000-3011) | `jackgary86-dev/gameportal`, `arcade3000/` |
| Demo (Claude Artifact) | https://claude.ai/artifact/Hkw2pPKhxc23GnaDzkGMHJ |
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
npm test                           # 64 tests as of LRNA-170
```
Tests drive the game through `window.__TEST__`, which only exists with
`?test=1` in the URL (or `localStorage.lrna_test_mode = '1'`).

## Hosting on NixonExpress (192.168.1.89:2001)

This is the live home since Connor's server (192.168.1.36) went down on
2026-09-29. It's a plain `python3 -m http.server` serving the single file,
run by systemd so it restarts after a crash or reboot. The LongRange repo is
public, so no GitHub token is needed.

First install, as `nixon` (not root):
```sh
python3 -c "import urllib.request as u; u.urlretrieve('https://raw.githubusercontent.com/jackgary86-dev/LongRange/main/long-range-node-attack/deploy/install-nixonexpress.sh', 'install-longrange.sh')"
bash install-longrange.sh
```
It downloads the game to `~/longrange/index.html`, refuses if something else
already holds port 2001, installs `/etc/systemd/system/longrange.service`,
starts it, and prints `active` and `HTTP 200`.

Update to the latest `main` (players just reload; nothing restarts):
```sh
bash install-longrange.sh --update
```
Pin a version instead of `main` with `REF=<commit or tag>`, for example
`REF=backup-2026-09-30 bash install-longrange.sh --update`.

Other settings: `PORT` (default 2001) and `DIR` (default `~/longrange`).

Useful commands: `systemctl status longrange`, `journalctl -u longrange -f`,
`sudo systemctl restart longrange`. To remove it:
`sudo systemctl disable --now longrange && sudo rm /etc/systemd/system/longrange.service`.

Firewall: NixonExpress's ufw already allows `2000:2005/tcp` from
`192.168.1.0/24`, which covers 2001. Don't also run the full Game Portal
(`portal.py`) on NixonExpress, because it wants port 2001 too.

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

## Rebuilding the demo artifact

```sh
cd long-range-node-attack
tools/build-demo.sh            # writes dist/lrna_demo.html (git-ignored)
```
Then ask Claude to publish `dist/lrna_demo.html` with the Artifact tool,
passing `url: https://claude.ai/artifact/Hkw2pPKhxc23GnaDzkGMHJ` so it updates
the same page. The artifact host requires the live version to be read in
full before an update from a new conversation.

## Remaking everything from scratch

1. Clone `jackgary86-dev/LongRange`. The tag `backup-2026-09-30` marks this
   known-good state. `npm ci && npm test` inside `long-range-node-attack`.
2. Host it: the NixonExpress install above (any Linux box with Python 3 and
   systemd works; set `DIR` and `PORT`).
3. Game Portal listing: Alert `claude/practical-keller-49onif` holds the
   deploy copy and `portal-game.json`; if that branch were lost, recreate it
   with those two files and rerun the portal rebuild.
4. Demo: `tools/build-demo.sh`, then publish as above.
5. Working with Claude on it: the ticket history in `TICKETS.md` records
   every decision and why, and the tests pin the behavior. The development
   repo is LongRange (`main`); Alert only carries the deploy copy.

## State as of 2026-09-30

- All Long Range tickets are done or closed; no open GitHub issues.
- Recent behavior worth knowing: counters are limited per game (10 counter
  missiles, 10 counter planes, 5 emergency counters, the same for Omega);
  each game starts at 500/500/500 tokens with 20/s passive income and hits
  refunding a quarter of their damage; opening STATS pauses the battle;
  Siege Mode is gone; discovered hidden nodes are attacked from TARGETS.
- Connor's server (192.168.1.36) is down. The game is hosted on
  NixonExpress :2001.
