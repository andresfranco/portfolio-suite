#!/bin/bash
# PreCompact hook: Save a session snapshot before context compression
# Preserves key working context so it can be referenced after compaction

SNAPSHOT_DIR="/home/andres/projects/portfolio-suite/.claude/session-snapshots"
mkdir -p "$SNAPSHOT_DIR"

SAVE_FILE="$SNAPSHOT_DIR/$(date +%Y%m%d-%H%M%S).md"

cat > "$SAVE_FILE" << EOF
# Session Snapshot — $(date '+%Y-%m-%d %H:%M:%S')

## Context
This snapshot was saved automatically before context compaction.

## Active branch
$(cd /home/andres/projects/portfolio-suite && git branch --show-current 2>/dev/null || echo "unknown")

## Recent git changes
$(cd /home/andres/projects/portfolio-suite && git diff --stat HEAD 2>/dev/null | head -20 || echo "none")

## Recently modified files
$(cd /home/andres/projects/portfolio-suite && git status --short 2>/dev/null | head -20 || echo "none")

## Notes
(Add notes about current task here if needed)
EOF

echo "Session snapshot saved: $SAVE_FILE" >&2
exit 0
