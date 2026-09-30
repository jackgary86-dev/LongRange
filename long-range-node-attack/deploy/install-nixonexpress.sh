#!/usr/bin/env bash
# Host Long Range Node Attack on NixonExpress (192.168.1.89:2001).
#
# Run as the normal user (nixon), not root; it asks for sudo only to
# install the systemd service. Safe to run again: it re-downloads the game
# and leaves the service running. Updating later only needs the download
# step (the game is one static file), so `install-nixonexpress.sh --update`
# skips the service part.
#
#   bash install-nixonexpress.sh            first install
#   bash install-nixonexpress.sh --update   fetch the latest game only
set -euo pipefail

PORT="${PORT:-2001}"
DIR="${DIR:-$HOME/longrange}"
REF="${REF:-main}"   # a branch, tag or commit of jackgary86-dev/LongRange
URL="https://raw.githubusercontent.com/jackgary86-dev/LongRange/$REF/long-range-node-attack/index.html"
SERVICE_URL="https://raw.githubusercontent.com/jackgary86-dev/LongRange/$REF/long-range-node-attack/deploy/longrange.service"

if [ "$(id -u)" = 0 ]; then echo "Run this as nixon, not root." >&2; exit 1; fi

mkdir -p "$DIR"
python3 - "$URL" "$DIR/index.html" <<'PY'
import sys, urllib.request
url, dest = sys.argv[1], sys.argv[2]
data = urllib.request.urlopen(url, timeout=30).read()
if b"LONG RANGE NODE ATTACK" not in data:
    sys.exit("downloaded file doesn't look like the game, not saving it")
open(dest + ".tmp", "wb").write(data)
import os; os.replace(dest + ".tmp", dest)
print(f"saved {dest} ({len(data)} bytes)")
PY

if [ "${1:-}" = "--update" ]; then
  echo "Updated. Players get the new version when they reload."
  exit 0
fi

if ss -ltn "( sport = :$PORT )" | grep -q LISTEN && ! systemctl is-active --quiet longrange; then
  echo "Port $PORT is already used by something else:" >&2
  ss -ltnp "( sport = :$PORT )" >&2 || true
  exit 1
fi

python3 -c "import sys,urllib.request; open('/tmp/longrange.service','wb').write(urllib.request.urlopen(sys.argv[1], timeout=30).read())" "$SERVICE_URL"
sed -i "s#/home/nixon/longrange#$DIR#; s#User=nixon#User=$(id -un)#; s#http.server 2001#http.server $PORT#" /tmp/longrange.service
sudo install -m 644 /tmp/longrange.service /etc/systemd/system/longrange.service
sudo systemctl daemon-reload
sudo systemctl enable --now longrange
sleep 1
systemctl is-active longrange
python3 -c "import sys,urllib.request; print('HTTP', urllib.request.urlopen(sys.argv[1], timeout=5).status)" "http://127.0.0.1:$PORT/"
echo "Open http://$(hostname -I | awk '{print $1}'):$PORT from the home network."
