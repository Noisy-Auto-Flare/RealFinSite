#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Run as root:  sudo $0"

DEPLOY_LOG="/var/log/fintracker-deploy.log"
exec > >(tee -a "$DEPLOY_LOG") 2>&1

command -v docker       >/dev/null 2>&1 || err "docker not found"
command -v docker compose >/dev/null 2>&1 || err "docker compose not found"
command -v nginx        >/dev/null 2>&1 || err "nginx not found"

info "Starting deploy at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  read -rp "Enter domain name (leave empty to skip nginx): " DOMAIN
fi

# --- backup database before deploy ---
BACKUP_DIR="${PROJ_PATH:-.}/backups"
mkdir -p "$BACKUP_DIR"
if [ -f "${PROJ_PATH:-.}/data/finance.db" ]; then
  cp "${PROJ_PATH:-.}/data/finance.db" "$BACKUP_DIR/pre-deploy-$(date +%Y%m%d_%H%M%S).db"
  ok "Database backed up"
fi

# --- save current compose + image for rollback ---
if [ -f "docker-compose.yml" ]; then
  cp docker-compose.yml docker-compose.yml.bak
  ok "Saved docker-compose.yml.bak for rollback"
fi

CURRENT_IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep fintracker | head -1) || true
if [ -n "$CURRENT_IMAGE" ]; then
  docker tag "$CURRENT_IMAGE" fintracker-fintracker:rollback 2>/dev/null || true
  ok "Tagged current image fintracker-fintracker:rollback"
fi

# --- git pull ---
info "Pulling latest code..."
cd "${PROJ_PATH:-.}"
git pull origin main || warn "git pull failed, continuing with local code"

# --- build ---
info "Building Docker image..."
docker compose build --no-cache

# --- stop old container ---
docker compose down --timeout 30 || true

# --- start new container ---
docker compose up -d

# --- healthcheck ---
info "Waiting for container to be healthy..."
for i in $(seq 1 30); do
  if docker inspect --format='{{.State.Health.Status}}' fintracker 2>/dev/null | grep -q healthy; then
    ok "Container is healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "Container failed healthcheck — rolling back"

    # Rollback to previous image
    if docker image inspect fintracker-fintracker:rollback >/dev/null 2>&1; then
      info "Rolling back to previous image..."
      docker tag fintracker-fintracker:rollback fintracker-fintracker:latest
      docker compose up -d
      ok "Rollback completed"
    else
      warn "No rollback image found — manual intervention required"
    fi

    # Restore previous docker-compose.yml
    if [ -f "docker-compose.yml.bak" ]; then
      cp docker-compose.yml.bak docker-compose.yml
      warn "Restored docker-compose.yml.bak"
    fi

    exit 1
  fi
  sleep 2
done

# --- run migrations inside container ---
info "Running database migrations..."
docker exec fintracker node /app/server.js --migrate 2>/dev/null || \
  docker exec fintracker sh -c "cd /app && node -e 'require(\"./server.js\")'" 2>/dev/null || \
  warn "Migration command failed — run manually: docker exec fintracker node /app/server.js --migrate"

# --- nginx ---
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
if [ -f "$NGINX_CONF" ]; then
  nginx -t && systemctl reload nginx && ok "Nginx reloaded"
fi

# --- notification (optional) ---
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
  MESSAGE="Deploy successful: fintracker on ${DOMAIN:-no-domain}
$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT_ID" \
    -d "text=$MESSAGE" >/dev/null 2>&1 && ok "Telegram notification sent" || warn "Telegram notification failed"
fi

info "Deploy complete at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
