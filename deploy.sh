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

command -v docker          >/dev/null 2>&1 || err "docker not found"
command -v docker compose  >/dev/null 2>&1 || err "docker compose not found"

info "Starting deploy at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# --- source .env ---
if [ -f .env ]; then
  set -a; source .env; set +a
  info "Loaded .env"
fi
APP_PORT="${APP_PORT:-3000}"

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  read -rp "Enter domain name (leave empty to skip nginx/ssl): " DOMAIN
fi

if [ -n "$DOMAIN" ]; then
  command -v nginx >/dev/null 2>&1 || err "nginx not found — apt install nginx"
  # auto-set NEXTAUTH_URL for Auth.js host validation
  if grep -q "^NEXTAUTH_URL=" .env 2>/dev/null; then
    sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$DOMAIN|" .env
    info "Updated NEXTAUTH_URL to https://$DOMAIN in .env"
  else
    echo "NEXTAUTH_URL=https://$DOMAIN" >> .env
    info "Set NEXTAUTH_URL=https://$DOMAIN in .env"
  fi
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
else
  warn "No existing fintracker image found — rollback will not be available"
fi

# --- git pull ---
info "Pulling latest code..."
cd "${PROJ_PATH:-.}"
git pull origin main || warn "git pull failed, continuing with local code"

# git pull strips the executable bit; restore it
chmod +x "$0" 2>/dev/null || true

# --- build ---
info "Building Docker image..."
docker compose build --no-cache

# --- stop old container ---
docker compose down --timeout 30 || true

# --- start new container ---
docker compose up -d

# --- healthcheck ---
MAX_WAIT=300
HEALTH_START=$(date +%s)
info "Waiting for container to be healthy (up to ${MAX_WAIT}s)..."
while true; do
  ELAPSED=$(($(date +%s) - HEALTH_START))
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo ""
    warn "Container not healthy after ${MAX_WAIT}s — rolling back"

    docker compose down --timeout 10 || true
    if docker image inspect fintracker-fintracker:rollback >/dev/null 2>&1; then
      docker tag fintracker-fintracker:rollback fintracker-fintracker:latest
      docker compose up -d
      ok "Rollback completed"
    else
      warn "No rollback image found — manual intervention required"
    fi

    if [ -f "docker-compose.yml.bak" ]; then
      cp docker-compose.yml.bak docker-compose.yml
      warn "Restored docker-compose.yml.bak"
    fi

    exit 1
  fi

  STATUS=$(docker inspect --format='{{.State.Health.Status}}' fintracker 2>/dev/null || echo "missing")
  if [ "$STATUS" = "healthy" ]; then
    ok "Container is healthy after ${ELAPSED}s"
    break
  fi

  if [ $((ELAPSED % 15)) -eq 0 ] && [ "$STATUS" != "missing" ]; then
    printf "\r  [%ds] health status: %-10s" "$ELAPSED" "$STATUS"
  fi

  if [ "$STATUS" = "missing" ]; then
    EXIT_CODE=$(docker inspect --format='{{.State.ExitCode}}' fintracker 2>/dev/null || echo "-1")
    if [ "$EXIT_CODE" != "0" ] && [ "$EXIT_CODE" != "-1" ]; then
      echo ""
      err "Container exited with code $EXIT_CODE — check 'docker logs fintracker'"
    fi
  fi

  sleep 2
done

# --- run migrations inside container ---
info "Running database migrations..."
docker exec fintracker node /app/server.js --migrate 2>/dev/null || \
  docker exec fintracker sh -c "cd /app && node -e 'require(\"./server.js\")'" 2>/dev/null || \
  warn "Migration command failed — run manually: docker exec fintracker node /app/server.js --migrate"

# --- nginx ---
if [ -n "$DOMAIN" ]; then
  NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

  if [ ! -f "$NGINX_CONF" ]; then
    info "Creating nginx config for $DOMAIN → 127.0.0.1:$APP_PORT..."
    cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"
    ok "Nginx config created"
  fi

  nginx -t && systemctl reload nginx && ok "Nginx reloaded"
fi

# --- ssl (certbot) ---
if [ -n "$DOMAIN" ] && command -v certbot >/dev/null 2>&1; then
  if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    info "Obtaining SSL certificate for $DOMAIN..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" \
      && ok "SSL certificate obtained" \
      || warn "certbot failed — run manually: certbot --nginx -d $DOMAIN"
  else
    info "SSL certificate already exists for $DOMAIN"
  fi
else
  info "certbot not found — skipping SSL setup"
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
