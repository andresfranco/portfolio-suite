#!/bin/bash
# PreToolUse hook: Block git add/commit operations on .env files
# Prevents accidental secret exposure

INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null)

# Check if it's a git add or commit touching .env files
if echo "$CMD" | grep -qE "git (add|commit)" && echo "$CMD" | grep -qE "(^|\s)\.env(\s|$|[^.])" ; then
  echo "BLOCKED: Attempted to stage/commit a .env file. Secrets must never be committed." >&2
  exit 2
fi

# Also block if someone does: git add . or git add -A without explicit exclusion
# and we're in a directory with .env files
if echo "$CMD" | grep -qE "git add (\.|--all|-A|-u)" ; then
  if ls .env* 2>/dev/null | grep -qE "^\.env$"; then
    echo "WARNING: 'git add .' detected with .env present. Ensure .gitignore excludes .env files." >&2
    # Don't block — just warn, let git's own .gitignore handle it
  fi
fi

exit 0
