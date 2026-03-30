#!/bin/bash
# restart.sh — Kill dev server, update DB/Prisma, clear cache, restart

set -e

PORT=1776
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Worldview Dev Server Restart ==="
echo ""

# 1. Kill existing server on port
echo "→ Killing processes on port $PORT..."
PIDS=$(lsof -i :$PORT -t 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  echo "  Killed: $PIDS"
  sleep 1
else
  echo "  No processes found on port $PORT"
fi

# 2. Clear Next.js cache
echo "→ Clearing .next cache..."
rm -rf "$PROJECT_DIR/.next"

# 3. Generate Prisma client + push schema
echo "→ Syncing Prisma schema..."
cd "$PROJECT_DIR"
npx prisma generate 2>&1 | grep -E "Generated|Error" || true
npx prisma db push --skip-generate 2>&1 | grep -E "applied|already in sync|Error" || true

# 4. Start dev server
echo "→ Starting dev server on port $PORT..."
echo ""
npm run dev
