#!/usr/bin/env bash
# Build the single-file page published as the Claude Artifact demo
# (https://claude.ai/artifact/SatBvMP8LH2GaLJAs7z9ee).
#
# The artifact host wraps the page in its own <!doctype>/<html>/<head>/<body>,
# so the demo is index.html with those outer tags removed: everything from
# the <title> line through the closing </script>. Publish the output with
# Claude's Artifact tool, passing the URL above as `url` so it updates the
# same artifact instead of creating a new one.
#
#   tools/build-demo.sh [output]      default output: dist/lrna_demo.html
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-dist/lrna_demo.html}"
mkdir -p "$(dirname "$out")"
awk '/<title>/ {on=1} on {print} /<\/script>/ {last=NR} END {}' index.html > "$out.tmp"
# keep only up to the last </script> (drops </body></html> and trailing blanks)
last=$(grep -n '</script>' "$out.tmp" | tail -1 | cut -d: -f1)
head -n "$last" "$out.tmp" > "$out" && rm "$out.tmp"
echo "wrote $out ($(wc -c < "$out") bytes): $(head -1 "$out") ... $(tail -1 "$out")"
