#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# FinTracker deploy script
# Automates: folder → docker-compose → nginx → certbot
# ──────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*" >&2; exit 1; }
prompt(){ echo -en "${CYAN}→${NC} $1 "; }

# ── root check ────────────────────────────────────────────
[[ $EUID -eq 0 ]] || err "Run as root:  sudo $0"

# ── prerequisites ─────────────────────────────────────────
command -v docker       >/dev/null 2>&1 || err "docker not found"
command -v docker compose >/dev/null 2>&1 || err "docker compose not found"
command -v nginx        >/dev/null 2>&1 || err "nginx not found"

# ── find first free port after 8080 ───────────────────────
find_free_port() {
  local start=$1
  while ss -tlnp "sport = :$start" 2>/dev/null | grep -q ":$start"; do
    ((start++))
  done
  # also check docker-compose files in ~/*/docker-compose.yml
  while grep -q "127.0.0.1:$start" ~/*/docker-compose.yml 2>/dev/null; do
    ((start++))
    while ss -tlnp "sport = :$start" 2>/dev/null | grep -q ":$start"; do
      ((start++))
    done
  done
  echo "$start"
}

PORT=$(find_free_port 8080)
info "First available port: $PORT"

# ── gather domains already in use ─────────────────────────
USED_DOMAINS=()
for f in /etc/nginx/sites-enabled/*; do
  [[ -f "$f" ]] || continue
  while IFS=';' read -ra parts; do
    for p in "${parts[@]}"; do
      p="${p#"${p%%[![:space:]]*}"}"  # trim
      if [[ $p =~ ^server_name\  ]]; then
        p="${p#server_name }"
        # shellcheck disable=SC2206
        arr=($p)
        USED_DOMAINS+=("${arr[@]}")
      fi
    done
  done < <(grep server_name "$f" | tr -d ';')
done

# ── ask domain ────────────────────────────────────────────
while :; do
  prompt "Domain (e.g. mysite.ru):"
  read -r DOMAIN
  DOMAIN="${DOMAIN,,}"  # lowercase
  [[ -z "$DOMAIN" ]] && continue
  # strip protocol
  DOMAIN="${DOMAIN#https://}"
  DOMAIN="${DOMAIN#http://}"
  DOMAIN="${DOMAIN%%/*}"
  if [[ " ${USED_DOMAINS[*]} " =~ " $DOMAIN " ]]; then
    err "Domain $DOMAIN is already configured in Nginx"
  fi
  break
done

# ── ask project name (folder) ─────────────────────────────
default_name="${DOMAIN%%.*}"
default_name="${default_name^}"  # Capitalise
prompt "Project folder name [~/$default_name]:"
read -r PROJ_NAME
[[ -z "$PROJ_NAME" ]] && PROJ_NAME="$default_name"

[[ -d ~/"$PROJ_NAME" ]] && err "Folder ~/$PROJ_NAME already exists"

# ── project type ──────────────────────────────────────────
echo ""
info "Project type:"
echo "  1) Next.js only"
echo "  2) Next.js + Caddy (frontend + backend)"
prompt "[1/2]:"
read -r PROJ_TYPE
[[ "$PROJ_TYPE" != "2" ]] && PROJ_TYPE="1"

# ── create folder ─────────────────────────────────────────
PROJ_PATH=~/"$PROJ_NAME"
mkdir -p "$PROJ_PATH"
ok "Folder created: $PROJ_PATH"

# ── generate files ────────────────────────────────────────
if [[ "$PROJ_TYPE" == "1" ]]; then
  # Simple Next.js
  cat > "$PROJ_PATH/docker-compose.yml" <<EOF
version: '3.8'
services:
  frontend:
    build: .
    container_name: ${PROJ_NAME,,}_frontend
    restart: always
    ports:
      - "127.0.0.1:${PORT}:3000"
EOF
  ok "docker-compose.yml (Next.js only) — port $PORT"
else
  # With Caddy
  cat > "$PROJ_PATH/docker-compose.yml" <<EOF
version: '3.8'
services:
  frontend:
    build: .
    container_name: ${PROJ_NAME,,}_frontend
    restart: always
    expose:
      - "3000"

  backend:
    image: your-backend-image
    container_name: ${PROJ_NAME,,}_backend
    restart: always
    expose:
      - "8000"

  caddy:
    image: caddy:alpine
    container_name: ${PROJ_NAME,,}_caddy
    restart: always
    ports:
      - "127.0.0.1:${PORT}:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
EOF

  cat > "$PROJ_PATH/Caddyfile" <<'CADDY'
:80 {
    request_body {
        max_size 10GB
    }
    reverse_proxy /api/* backend:8000
    reverse_proxy /uploads/* backend:8000
    reverse_proxy * frontend:3000
}
CADDY
  ok "docker-compose.yml (with Caddy) — port $PORT"
  ok "Caddyfile created"
fi

# ── Nginx config (HTTP-only initially ── certbot adds SSL) ─
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/"
ok "Nginx config: $NGINX_CONF"

# ── test & reload nginx ───────────────────────────────────
nginx -t || err "Nginx config test failed"
systemctl reload nginx
ok "Nginx reloaded"

# ── SSL via certbot ───────────────────────────────────────
echo ""
prompt "Run certbot to get SSL? [y/N]:"
read -r DO_SSL
if [[ "${DO_SSL,,}" == "y" ]]; then
  if command -v certbot >/dev/null 2>&1; then
    cp "$NGINX_CONF" "$NGINX_CONF.bak"
    if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN"; then
      systemctl reload nginx
      ok "SSL certificates installed"
    else
      cp "$NGINX_CONF.bak" "$NGINX_CONF"
      systemctl reload nginx
      info "certbot failed — restored original config"
      info "Retry manually:  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    fi
  else
    info "certbot not found. Install:  apt install certbot python3-certbot-nginx"
    info "Then run:  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  fi
fi

# ── summary ───────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}  Site ready!${NC}"
echo ""
echo "  Domain:      $DOMAIN"
echo "  Folder:      $PROJ_PATH"
echo "  Port:        $PORT"
echo "  Nginx conf:  $NGINX_CONF"
echo ""
echo "  Next steps:"
echo "    1. cd $PROJ_PATH"
echo "    2. Put your code + Dockerfile in place"
echo "    3. docker compose up -d --build"
echo "    4. Visit https://$DOMAIN"
echo "═══════════════════════════════════════════════════════"
