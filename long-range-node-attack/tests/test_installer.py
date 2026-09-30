#!/usr/bin/env python3
"""Checks for installer/longrange-installer.py (stdlib only, no browser).

  python3 tests/test_installer.py

Runs every mode against a throwaway home folder: install and shortcuts
(Linux for real, Windows and macOS simulated), --serve over real HTTP,
--extract, --uninstall, and that the packed game is the current index.html.
--service needs systemd and sudo, so only its refusal paths are checked.
"""
import contextlib
import importlib.util
import io
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
INSTALLER = ROOT / "installer" / "longrange-installer.py"
GAME = (ROOT / "index.html").read_bytes()
failures = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def run(*args, home):
    env = dict(os.environ, HOME=str(home), XDG_DATA_HOME=str(home / ".local" / "share"))
    return subprocess.run([sys.executable, str(INSTALLER), *args], env=env,
                          capture_output=True, text=True, timeout=60)


def load(system, home):
    spec = importlib.util.spec_from_file_location(f"inst_{system}", INSTALLER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.SYSTEM = system
    os.environ["HOME"] = str(home)
    os.environ["LOCALAPPDATA"] = str(home / "AppData" / "Local")
    os.environ.pop("XDG_DATA_HOME", None)
    return mod


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)

    print("packed game")
    r = run("--extract", str(tmp / "out.html"), home=tmp / "h0")
    check(r.returncode == 0 and (tmp / "out.html").read_bytes() == GAME,
          "--extract writes exactly the current index.html (run tools/build-installer.py if not)")

    print("install (Linux)")
    home = tmp / "h1"
    (home / "Desktop").mkdir(parents=True)
    dl = tmp / "Downloads"
    dl.mkdir()
    copy = dl / "longrange-installer.py"
    copy.write_bytes(INSTALLER.read_bytes())
    env = dict(os.environ, HOME=str(home), XDG_DATA_HOME=str(home / ".local" / "share"))
    r = subprocess.run([sys.executable, str(copy), "--no-open"], env=env, capture_output=True, text=True, timeout=60)
    inst = home / ".local" / "share" / "longrange-node-attack"
    check(r.returncode == 0, f"install exits 0 ({r.stderr.strip()[-200:]})")
    check((inst / "index.html").read_bytes() == GAME, "game written to ~/.local/share/longrange-node-attack")
    check((inst / "longrange-installer.py").is_file(), "installer keeps a copy of itself next to the game")
    menu = home / ".local" / "share" / "applications" / "longrange-node-attack.desktop"
    desk = home / "Desktop" / "longrange-node-attack.desktop"
    check(menu.is_file() and desk.is_file(), "menu entry and desktop shortcut created")
    check(menu.is_file() and (inst / "index.html").as_uri() in menu.read_text(), "shortcut opens the installed game")
    copy.unlink()
    r = subprocess.run([sys.executable, str(inst / "longrange-installer.py"), "--info"], env=env,
                       capture_output=True, text=True, timeout=60)
    check(r.returncode == 0 and "sha256" in r.stdout, "the installed copy still runs after the download is deleted")

    print("serve")
    port = free_port()
    proc = subprocess.Popen([sys.executable, str(inst / "longrange-installer.py"), "--serve", "--port", str(port)],
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    body = b""
    for _ in range(50):
        try:
            body = urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2).read()
            break
        except OSError:
            time.sleep(0.1)
    check(body == GAME, f"--serve answers http://127.0.0.1:{port}/ with the game")
    r2 = run("--serve", "--port", str(port), home=home)
    check(r2.returncode != 0 and "Something else is using it" in (r2.stderr + r2.stdout),
          "a second --serve on a busy port explains the clash instead of a traceback")
    proc.terminate()
    out, _ = proc.communicate(timeout=10)
    check(f":{port}/" in out, "--serve prints the address to open")

    print("service (refusal paths only)")
    r = run("--service", home=home)
    check(r.returncode != 0 or "starts on every boot" in r.stdout,
          "--service either sets up systemd or explains why it can't")

    print("uninstall")
    r = run("--uninstall", home=home)
    check(r.returncode == 0, "uninstall exits 0")
    check(not inst.exists() and not menu.exists() and not desk.exists(), "install folder and both shortcuts removed")

    print("Windows and macOS shortcuts (simulated)")
    whome = tmp / "hw"
    mod = load("Windows", whome)
    game = mod.write_game(mod.default_dir())
    made = mod.make_shortcuts(game)
    check(str(mod.default_dir()).endswith(os.path.join("AppData", "Local", "LongRangeNodeAttack")),
          "Windows installs to %LOCALAPPDATA%\\LongRangeNodeAttack")
    check(len(made) == 1 and made[0].suffix == ".url" and f"URL={game.as_uri()}" in made[0].read_text(),
          "Windows gets a Desktop .url shortcut to the game")
    mhome = tmp / "hm"
    mod = load("Darwin", mhome)
    game = mod.write_game(mod.default_dir())
    made = mod.make_shortcuts(game)
    check("Library/Application Support/LongRangeNodeAttack" in str(mod.default_dir()),
          "macOS installs to ~/Library/Application Support")
    check(len(made) == 1 and made[0].suffix == ".webloc" and game.as_uri() in made[0].read_text(),
          "macOS gets a Desktop .webloc shortcut to the game")

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED"))
sys.exit(1 if failures else 0)
