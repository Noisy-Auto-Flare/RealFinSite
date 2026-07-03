# Deployment Guide

## Prerequisites

- Ubuntu 22.04+ server
- Docker + Docker Compose
- Nginx
- Domain name pointing to server

## One-command Setup

```bash
# Download and run deploy script
sudo ./deploy.sh
```

The script will:
1. Ask for domain name
2. Create project directory
3. Generate docker-compose.yml
4. Configure Nginx reverse proxy
5. Optionally set up SSL via Certbot

## Manual Setup

### 1. Server Preparation

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker nginx
```

### 2. Deploy

```bash
# Create project directory
mkdir -p ~/fintracker && cd ~/fintracker

# Clone repository
git clone <your-repo-url> .

# Environment
cp .env.example .env
# Edit .env with your secrets:
#   - Generate NEXTAUTH_SECRET: openssl rand -base64 32
#   - Generate AUTH_SECRET: openssl rand -base64 32
#   - Generate ENCRYPTION_KEY: openssl rand -base64 32 | cut -c1-32

# Build and start
docker compose build
docker compose up -d

# Verify
curl http://localhost:3000/api/health
```

### 3. Nginx + SSL

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo certbot --nginx -d your-domain.com
```

## Updating

```bash
cd ~/fintracker
git pull
docker compose build
docker compose down
docker compose up -d
```

Or use `deploy.sh` which automates this.

## Backups

### Automatic (cron)

```bash
# Daily backup at 3 AM
crontab -e
0 3 * * * cd ~/fintracker && ./scripts/backup.sh >> /var/log/fintracker-backup.log 2>&1
```

### Manual

```bash
./scripts/backup.sh                    # creates backup
./scripts/restore.sh backups/2024-01-01_fintracker.db.gz  # restore
```

## Monitoring

- Health: `curl https://your-domain.com/api/health`
- Logs: `docker logs fintracker`
- DB size: `ls -lh ~/fintracker/data/`
- Backups: `ls -lh ~/fintracker/backups/`
