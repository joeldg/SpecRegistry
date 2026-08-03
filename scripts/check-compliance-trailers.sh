#!/usr/bin/env bash
set -euo pipefail

RANGE="${1:-HEAD^..HEAD}"
FAILED=0

while IFS= read -r COMMIT; do
  [[ -z "$COMMIT" ]] && continue
  FILES="$(git diff-tree --no-commit-id --name-only -r "$COMMIT")"
  if ! printf '%s\n' "$FILES" | grep -Eq '^(packages/.+/src/|scripts/|\.github/actions/)'; then
    continue
  fi
  MESSAGE="$(git show -s --format=%B "$COMMIT")"
  for TRAILER in SpecRegistry-Compliance SpecRegistry-Signals SpecRegistry-Command; do
    if ! printf '%s\n' "$MESSAGE" | grep -q "^${TRAILER}:"; then
      echo "Missing ${TRAILER} trailer in implementation commit ${COMMIT}" >&2
      FAILED=1
    fi
  done
done < <(git rev-list --reverse "$RANGE")

exit "$FAILED"
