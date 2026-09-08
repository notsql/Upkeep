#!/usr/bin/env bash
# Formats a file right after Claude edits it, so lint noise never reaches review.
# Receives the PostToolUse hook payload as JSON on stdin.
set -euo pipefail

file="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
[ -n "$file" ] && [ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc|*.css)
    # Biome is a workspace devDependency; stay quiet if deps aren't installed yet.
    pnpm exec biome check --write --no-errors-on-unmatched "$file" >/dev/null 2>&1 || true
    ;;
esac
exit 0
