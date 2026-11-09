#!/usr/bin/env bash
set -e

# Navigate to project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

PORT="${PORT:-3000}"

echo "==========================================="
echo "🍵 Himalayan Tea House - Dev Server Launcher"
echo "==========================================="

# Check if any process is already occupying the port
PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)

if [ -n "$PIDS" ]; then
  echo "⚠️  Port $PORT is already in use by process ID(s): $PIDS"
  echo "🛑 Terminating existing process(es)..."

  # Terminate child processes and parent process gracefully
  for PID in $PIDS; do
    pkill -P "$PID" 2>/dev/null || true
  done
  kill -15 $PIDS 2>/dev/null || true

  # Wait up to 3 seconds for graceful exit
  for i in {1..3}; do
    sleep 1
    PIDS_REMAINING=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -z "$PIDS_REMAINING" ]; then
      break
    fi
  done

  # Force kill if still listening
  PIDS_REMAINING=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS_REMAINING" ]; then
    echo "⚠️  Force killing lingering process(es): $PIDS_REMAINING"
    for PID in $PIDS_REMAINING; do
      pkill -9 -P "$PID" 2>/dev/null || true
    done
    kill -9 $PIDS_REMAINING 2>/dev/null || true
    sleep 1
  fi

  echo "✓ Port $PORT is now cleared."
fi

echo "🚀 Starting dev server (http://localhost:$PORT)..."
echo "-------------------------------------------"

rm -rf .next
exec npm run dev
