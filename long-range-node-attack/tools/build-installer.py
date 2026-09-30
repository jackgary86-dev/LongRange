#!/usr/bin/env python3
"""Pack index.html into installer/longrange-installer.py.

  python3 tools/build-installer.py           rewrite the installer's payload from index.html
  python3 tools/build-installer.py --check   exit 1 if the installer doesn't carry the current index.html

Run it after every change to index.html (CI runs --check). Only the lines
between "# BEGIN PAYLOAD" and "# END PAYLOAD" are rewritten, and the gzip
timestamp is fixed, so the same index.html always gives the same installer.
"""
import base64
import gzip
import hashlib
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = ROOT / "index.html"
INSTALLER = ROOT / "installer" / "longrange-installer.py"
BLOCK = re.compile(r"# BEGIN PAYLOAD\n.*?# END PAYLOAD\n", re.S)


def source_label():
    try:
        sha = subprocess.run(["git", "log", "-1", "--format=%h %cs", "--", str(GAME)], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout.strip()
        return f"main {sha}" if sha else "working copy"
    except (OSError, subprocess.CalledProcessError):
        return "working copy"


def payload_block(data, label):
    packed = base64.b64encode(gzip.compress(data, compresslevel=9, mtime=0)).decode()
    lines = "\n".join(packed[i:i + 76] for i in range(0, len(packed), 76))
    return ("# BEGIN PAYLOAD\n"
            f"PAYLOAD_SOURCE = {label!r}\n"
            f"PAYLOAD_SIZE = {len(data)}\n"
            f"PAYLOAD_SHA256 = {hashlib.sha256(data).hexdigest()!r}\n"
            f'PAYLOAD = """\n{lines}\n"""\n'
            "# END PAYLOAD\n")


def main():
    data = GAME.read_bytes()
    text = INSTALLER.read_text(encoding="utf-8")
    if not BLOCK.search(text):
        sys.exit(f"{INSTALLER} has no BEGIN/END PAYLOAD block")
    if "--check" in sys.argv:
        m = re.search(r"PAYLOAD_SHA256 = '([0-9a-f]*)'", text)
        want = hashlib.sha256(data).hexdigest()
        if not m or m.group(1) != want:
            sys.exit("installer/longrange-installer.py is out of date: run python3 tools/build-installer.py")
        print("installer carries the current index.html")
        return
    new = BLOCK.sub(lambda _: payload_block(data, source_label()), text)
    INSTALLER.write_text(new, encoding="utf-8")
    INSTALLER.chmod(0o755)
    print(f"packed {GAME.name} ({len(data)} bytes) into {INSTALLER.relative_to(ROOT)} "
          f"({INSTALLER.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
