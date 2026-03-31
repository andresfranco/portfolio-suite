#!/bin/bash
# PostToolUse hook: Auto-run ruff --fix after editing Python files in the backend
# Keeps code quality consistent without manual linting steps

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # PostToolUse wraps input under tool_input
    ti = d.get('tool_input', d)
    print(ti.get('file_path', ti.get('path', '')))
except:
    print('')
" 2>/dev/null)

# Only act on Python files inside the backend
if echo "$FILE" | grep -qE "portfolio-backend/.*\.py$"; then
  cd /home/andres/projects/portfolio-suite/portfolio-backend
  if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate 2>/dev/null
    ruff check --fix "$FILE" --quiet 2>/dev/null || true
    ruff format "$FILE" --quiet 2>/dev/null || true
  fi
fi

exit 0
