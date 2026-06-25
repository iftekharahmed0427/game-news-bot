#!/usr/bin/env bash
#
# Deploy the game-news bot on the VPS. Run after each change:
#
#   cd game-news-bot
#   ./deploy.sh
#
# It pulls the latest code (if this is a git checkout), then rebuilds and
# restarts the container. Your .env and the posted-state volume are untouched.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pick the available Docker Compose command (v2 plugin or legacy binary).
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: docker compose is not installed." >&2
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "ERROR: $SCRIPT_DIR/.env not found." >&2
  echo "Create it from .env.example and set DISCORD_WEBHOOK_URL." >&2
  exit 1
fi

# Pull only when this is a git checkout (skip cleanly if the folder was copied up).
if git -C "$SCRIPT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "==> Pulling latest from GitHub"
  git -C "$SCRIPT_DIR" pull --ff-only
fi

echo "==> Rebuilding and restarting"
cd "$SCRIPT_DIR"
$DC up -d --build

echo "==> Removing dangling images"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Done. Recent logs:"
$DC logs --tail=20 bot
echo "==> Follow live logs with: $DC logs -f bot"
