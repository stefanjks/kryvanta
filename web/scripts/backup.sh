#!/usr/bin/env bash
# ✦ KRYVANTA ✦ — резервная копия PostgreSQL.
# Использование: DATABASE_URL=... BACKUP_DIR=/var/backups/kryvanta KEEP_DAYS=14 bash scripts/backup.sh
# Cron (ежедневно в 04:17): 17 4 * * * cd /opt/kryvanta/web && set -a && . ./.env && set +a && bash scripts/backup.sh >> /var/log/kryvanta-backup.log 2>&1
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
URL="${DATABASE_URL%%\?*}"   # pg_dump не понимает ?schema=public
FILE="$BACKUP_DIR/kryvanta-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --file="$FILE" "$URL"
chmod 600 "$FILE"
# проверка, что архив читается
pg_restore --list "$FILE" > /dev/null
find "$BACKUP_DIR" -name 'kryvanta-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
# Восстановление: pg_restore --clean --if-exists --no-owner -d "$URL" "$FILE"
