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

# --- backup database before deploy ---
BACKUP_DIR="${PROJ_PATH:-.}/backups"
mkdir -p "$BACKUP_DIR"
if [ -f "${PROJ_PATH:-.}/data/finance.db" ]; then
  cp "${PROJ_PATH:-.}/data/finance.db" "$BACKUP_DIR/pre-deploy-$(date +%Y%m%d_%H%M%S).db"
  ok "Database backed up"
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
    docker compose down
    docker compose -f docker-compose.yml.bak up -d 2>/dev/null || warn "Rollback failed — manual intervention required"
  fi
  sleep 2
done

# --- run migrations inside container ---
info "Running database migrations..."
docker exec fintracker node .next/standalone/server.js --migrate 2>/dev/null || \
  docker exec fintracker sh -c "cd /app && node -e 'require(\"./server.js\")'" 2>/dev/null || \
  warn "Migration command failed — run manually: docker exec fintracker node server.js --migrate"

# --- nginx ---
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
if [ -f "$NGINX_CONF" ]; then
  nginx -t && systemctl reload nginx && ok "Nginx reloaded"
fi

info "Deploy complete at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
