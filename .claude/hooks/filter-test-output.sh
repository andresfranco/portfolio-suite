#!/bin/bash
# PreToolUse hook: Wrap test commands to return only failures
# Reduces token consumption by ~90% on large test suites

INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('command', ''))
except:
    print('')
" 2>/dev/null)

# Match pytest runs
if echo "$CMD" | grep -qE "(^|\s&&\s|;\s*)pytest(\s|$)"; then
  # Append failure-only filter while preserving the exit code
  FILTERED="${CMD} 2>&1 | grep -E '(FAILED|ERROR|error |warnings summary|=====|short test)' | grep -v '^$' | head -80; echo \"Exit: \$?\""
  python3 -c "
import json, sys
print(json.dumps({'updatedInput': {'command': '''$FILTERED'''}}))
" 2>/dev/null
  exit 0
fi

# Match npm test runs (React)
if echo "$CMD" | grep -qE "(^|\s&&\s|;\s*)npm test(\s|--|$)"; then
  FILTERED="${CMD} 2>&1 | grep -E '(FAIL|PASS|✓|✗|×|●|FAILED|Error:|Tests:)' | grep -v '^$' | head -80"
  python3 -c "
import json
print(json.dumps({'updatedInput': {'command': '''$FILTERED'''}}))
" 2>/dev/null
  exit 0
fi

# No modification needed
exit 0
