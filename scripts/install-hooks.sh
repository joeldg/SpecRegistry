#!/usr/bin/env bash
# install-hooks.sh — install local git hooks for this repository.
#
# Run once after cloning:
#   bash scripts/install-hooks.sh
#
# The hooks are stored in scripts/ (tracked) and symlinked or copied into
# .git/hooks/ (not tracked). Re-running is safe and idempotent.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
HOOKS_SRC="$REPO_ROOT/scripts"
HOOKS_DST="$REPO_ROOT/.git/hooks"

install_hook() {
  local name="$1"
  local src="$HOOKS_SRC/$name"
  local dst="$HOOKS_DST/$name"

  if [[ ! -f "$src" ]]; then
    echo "WARNING: $src not found — skipping $name hook." >&2
    return
  fi

  chmod +x "$src"

  # Prefer a symlink so updates to the source file take effect without reinstalling.
  if ln -sf "$src" "$dst" 2>/dev/null; then
    echo "Installed $name hook (symlink: $dst -> $src)"
  else
    # Fallback: copy if symlinks aren't supported (e.g. some Windows setups).
    cp "$src" "$dst"
    chmod +x "$dst"
    echo "Installed $name hook (copy: $dst)"
  fi
}

echo "Installing git hooks from scripts/ into .git/hooks/ ..."
install_hook prepare-commit-msg
echo ""
echo "Done. Hooks installed:"
ls -la "$HOOKS_DST" | grep -v '\.sample$'
echo ""
echo "The prepare-commit-msg hook runs 'specreg comply --no-write' before each commit and"
echo "appends SpecRegistry-Compliance/Signals/Command trailers automatically."
echo ""
echo "Requirements:"
echo "  - specreg CLI on PATH (npm install -g @specregistry/cli, or via npx)"
echo "  - SPECREG_SERVER env var set, or a .env file with SPECREG_SERVER=<url>"
echo "  - A local SpecRegistry server running at that URL"
echo ""
echo "If the server is unreachable, the hook warns but does not block the commit."
echo "CI enforces the trailers for implementation commits."
