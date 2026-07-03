#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.gz>"
  echo ""
  echo "Restores a database from a gzipped backup file."
  echo "Stops the running container, replaces the DB, then restarts."
  exit 1
fi

BACKUP_FILE="$1"
DATA_DIR="${DATA_DIR:-./data}"
DB_FILE="${DB_FILE:-fintracker.db}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[RESTORE] Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[RESTORE] Restoring from $BACKUP_FILE..."

# stop container
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'fintracker'; then
  echo "[RESTORE] Stopping fintracker container..."
  docker compose -f "$COMPOSE_FILE" down --timeout 30 || docker stop fintracker
fi

# backup current db before restore
mkdir -p "$DATA_DIR"
if [ -f "$DATA_DIR/$DB_FILE" ]; then
  PRE_RESTORE_BACKUP="$DATA_DIR/pre-restore-$(date +%Y%m%d_%H%M%S).db"
  cp "$DATA_DIR/$DB_FILE" "$PRE_RESTORE_BACKUP"
  echo "[RESTORE] Current database backed up to $PRE_RESTORE_BACKUP"
fi

# restore
gunzip -c "$BACKUP_FILE" > "$DATA_DIR/$DB_FILE"
echo "[RESTORE] Database restored"

# restart
docker compose -f "$COMPOSE_FILE" up -d
echo "[RESTORE] Container restarted. Run healthcheck: curl http://localhost:3000/api/health"
