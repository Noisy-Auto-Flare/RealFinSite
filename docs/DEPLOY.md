# Deployment Guide

## Prerequisites

- Ubuntu 22.04+ server
- Docker + Docker Compose (v2)
- Nginx
- Domain name pointing to the server
- Git

## Quick Deploy

```bash
# Clone and enter project
git clone https://github.com/your-org/RealFinSite.git /root/fintracker
cd /root/fintracker

# Configure environment
cp .env.example .env
nano .env

# Option A: Automated deploy script
sudo ./deploy.sh your-domain.com

# Option B: Manual deploy
docker compose build --no-cache
docker compose up -d
```

The automated script (`deploy.sh`) will:
1. Back up the current database to `./backups/pre-deploy-*.db`
2. Save `docker-compose.yml.bak` and tag current image for rollback
3. Pull the latest code from `origin/main`
4. Build a new Docker image
5. Start the container with health check
6. Run database migrations inside the container
7. Configure Nginx reverse proxy (if domain provided)
8. Optionally set up SSL via Certbot
9. Send Telegram notification on success (if `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` set)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_PORT` | No | `3000` | Host port — change if 3000 conflicts with other projects on this server |
| `NEXTAUTH_SECRET` | **Yes** | — | Auth session secret (generate: `openssl rand -base64 32`) |
| `AUTH_SECRET` | **Yes** | — | Auth secret (generate: `openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | **Yes** | — | API key encryption (generate: `openssl rand -base64 32 \| cut -c1-32`) |
| `MASTER_PASSWORD` | **Yes** | — | Initial admin password |
| `NEXTAUTH_URL` | No | `http://localhost:3000` | Public app URL |
| `DATABASE_URL` | No | `/data/finance.db` | DB path inside container (absolute path, NO `file:` prefix) |
| `MASTER_USERNAME` | No | `admin` | Initial admin username |
| `LOG_DIR` | No | `/logs` | Log output directory inside container |

## Manual Nginx Setup

If not using `deploy.sh`, set up Nginx manually.

Replace `PORT` with the value of `APP_PORT` from `.env` (default `3000`):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:PORT;  # 3000 by default
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then enable it and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

> **Multi-site pattern:** Each project on the same server needs a unique `APP_PORT` (e.g., `3000` for FinTracker, `8082` for another app). NGINX proxies each domain to its respective port. See `docs/ARCHITECTURE.md` for the full architecture.

## Backup & Restore

### Automatic (cron)
```bash
# Daily backup at 3 AM
crontab -e
0 3 * * * cd /root/fintracker && ./scripts/backup.sh >> /var/log/fintracker-backup.log 2>&1
```

### Manual
```bash
# Create backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backups/2026-07-03_fintracker.db.gz
```

### What gets backed up
- The SQLite database file (`fintracker.db`) → gzip compressed
- Stored in `./backups/` with date prefix
- Old backups auto-cleaned after 7 days (configurable via `RETENTION_DAYS`)

### Restore process
1. Stops the running Docker container
2. Backs up the current database (just in case)
3. Decompresses and replaces the database file
4. Restarts the container
5. Verify: run `curl http://localhost:3000/api/health`

## Monitoring

- **Health:** `curl https://your-domain.com/api/health`
- **Container logs:** `docker logs fintracker`
- **Deploy logs:** `cat /var/log/fintracker-deploy.log`
- **App logs:** `ls -lh /root/fintracker/logs/`
- **Resource usage:** `docker stats fintracker`
- **DB size:** `docker exec fintracker ls -lh /data/finance.db`

## Updating

```bash
cd /root/fintracker
sudo ./deploy.sh your-domain.com
```

Or manually:

```bash
git pull
docker compose build --no-cache
docker compose down --timeout 30
docker compose up -d
# Wait 20s for health check
curl http://localhost:3000/api/health
```

## Rollback

If the health check fails after deploy, `deploy.sh` automatically:

1. Tags the previous Docker image (`fintracker-fintracker:rollback`)
2. Re-deploys with the old image
3. Restores the previous `docker-compose.yml.bak`

Manual rollback:

```bash
# Option 1: Restore previous image
docker tag fintracker-fintracker:rollback fintracker-fintracker:latest
docker compose up -d

# Option 2: Restore database from backup
./scripts/restore.sh backups/pre-deploy-20260703_120000.db
```

## FAQ / Common Issues

### `EACCES: permission denied` on `/data`

**Cause:** Docker volumes are created with `root:root` ownership, but the app runs as `nextjs` user (UID 1001).

**Fix:** Already handled in Dockerfile (runner stage creates `/data`, `/logs`, `/backups` and `chown`s them to `nextjs:nodejs`). If you see this error, delete the old volumes and re-deploy:

```bash
docker compose down -v   # WARNING: deletes all data!
```

Or fix permissions manually:

```bash
docker compose exec fintracker sh -c "chown -R 1001:1001 /data /logs /backups"
```

### `SqliteError: no such table: operations`

**Cause:** Migrations haven't run. The health endpoint calls `initializeApp()` which runs migrations, but only on first request. If the container was started before the fix, migrations may not have run.

**Fix:** Migrations run automatically on container start. If still seeing this, run manually:

```bash
docker exec fintracker node /app/server.js --migrate
```

### `better-sqlite3` fails to compile

**Cause:** The `node:20-alpine` image lacks Python and build tools needed to compile the native `better-sqlite3` addon.

**Fix:** The Dockerfile now installs `python3` and `build-base` in the `deps` stage, compiles the addon, then removes them. The runner stage stays lean.

### `DATABASE_URL` with `file:` prefix fails

**Cause:** `better-sqlite3` expects a plain file path, not a `file:` URI. Setting `DATABASE_URL=file:./data/finance.db` causes `mkdir 'file:./data'` errors.

**Fix:** Use a plain path: `DATABASE_URL=/data/finance.db` (absolute, inside container). No `file:` prefix.

### Health check fails with `wget: unrecognized option: spider`

**Cause:** The `node:20-alpine` image uses busybox `wget` which does not support `--spider`.

**Fix:** Dockerfile now installs `curl` and uses it: `curl -f http://localhost:3000/api/health`.

### Container exits immediately

```bash
docker logs fintracker
```

Common causes:
- Database path is wrong (check `DATABASE_URL`)
- Port 3000 already in use (check `lsof -i :3000`)
- Environment variables missing (check `.env`)
- Volume permissions (see EACCES above)

## Docker Compose Reference

```yaml
services:
  fintracker:
    build: .
    container_name: fintracker
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - fintracker_data:/data      # SQLite database
      - fintracker_logs:/logs      # Application logs
      - fintracker_backups:/backups # Backup storage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```
