#!/usr/bin/env bash
# Copia de seguridad semanal en Google Drive.
#
#   1. Genera un respaldo completo (base de datos + fotos + certificados) con
#      el comando de la API, en ./backups.
#   2. Lo sube a Google Drive con rclone y verifica que llegó completo (MD5).
#   3. Borra de Drive los respaldos más viejos que BACKUP_DRIVE_KEEP_DAYS y
#      deja en el servidor solo los últimos BACKUP_KEEP_LOCAL.
#
# Se ejecuta como root desde cron (ver docs/DEPLOY.md, "Copia semanal en
# Google Drive"). Sale con código distinto de 0 si algo falla, y todo queda
# en backups/drive.log.
#
# Variables (opcionales):
#   BACKUP_DRIVE_REMOTE     destino en rclone   (drive:santa-rosa-respaldos)
#   BACKUP_DRIVE_KEEP_DAYS  días en Drive       (90)
#   BACKUP_KEEP_LOCAL       copias en el VPS    (4)
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="${BACKUP_DRIVE_REMOTE:-drive:santa-rosa-respaldos}"
KEEP_DAYS="${BACKUP_DRIVE_KEEP_DAYS:-90}"
KEEP_LOCAL="${BACKUP_KEEP_LOCAL:-4}"
LOG="backups/drive.log"
PATTERN='santa-rosa-respaldo-*.tar.gz'

mkdir -p backups
exec >>"$LOG" 2>&1
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
trap 'log "ERROR: la copia en Drive falló (línea $LINENO)."' ERR

# Evita dos ejecuciones a la vez (por ejemplo, una manual y la de cron).
exec 9>/tmp/santa-rosa-backup-drive.lock
if ! flock -n 9; then
  log "Ya hay una copia en curso: se omite esta ejecución."
  exit 1
fi

log "Inicio. Destino: $REMOTE"

# 1. Respaldo
output="$(docker compose exec -T api node dist/modules/backups/cli/backup.cli.js backup)"
echo "$output"
file="$(printf '%s\n' "$output" | sed -n 's|^Respaldo guardado: .*/\(santa-rosa-respaldo-[0-9-]*\.tar\.gz\)$|\1|p')"
if [ -z "$file" ] || [ ! -f "backups/$file" ]; then
  log "ERROR: no se encontró el respaldo generado."
  exit 1
fi

# 2. Subida y verificación
rclone copy "backups/$file" "$REMOTE"
rclone check "backups" "$REMOTE" --one-way --include "$file"
log "Subido y verificado: $file ($(du -h "backups/$file" | cut -f1))"

# 3. Limpieza en Drive: solo respaldos de este script, más viejos que KEEP_DAYS.
rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d" --include "$PATTERN"

# 3b. Limpieza en el servidor: deja los últimos KEEP_LOCAL. No toca los
#     "antes-de-restaurar-*" que crea la restauración.
ls -1t backups/$PATTERN 2>/dev/null | tail -n +"$((KEEP_LOCAL + 1))" | while read -r old; do
  rm -f -- "$old"
  log "Borrado del servidor: $(basename "$old")"
done

log "Listo."
