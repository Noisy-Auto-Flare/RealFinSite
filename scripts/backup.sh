#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATA_DIR="${DATA_DIR:-./data}"
DB_FILE="${DB_FILE:-fintracker.db}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE_STAMP=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
mkdir -p "$DATA_DIR"

SRC="$DATA_DIR/$DB_FILE"
DST="$BACKUP_DIR/${DATE_STAMP}_${DB_FILE}.gz"

if [ ! -f "$SRC" ]; then
  echo "[BACKUP] No database file found at $SRC — nothing to back up"
  exit 0
fi

gzip -c "$SRC" > "$DST"
echo "[BACKUP] Created: $DST ($(du -h "$DST" | cut -f1))"

# cleanup old backups
find "$BACKUP_DIR" -name "*_${DB_FILE}.gz" -mtime +$RETENTION_DAYS -delete
echo "[BACKUP] Cleaned up backups older than $RETENTION_DAYS days"
