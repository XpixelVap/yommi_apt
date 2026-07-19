#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-backups}"

command -v docker >/dev/null 2>&1 || { echo "Error: docker no está disponible." >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Error: no existe $ENV_FILE." >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/yommigo-$timestamp.dump"
container_file="/tmp/yommigo-$timestamp.dump"

[ ! -e "$backup_file" ] || { echo "Error: el backup ya existe: $backup_file" >&2; exit 1; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

cleanup() {
  compose exec -T postgres rm -f "$container_file" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

compose exec -T postgres sh -eu -c   'pg_dump --format=custom --no-owner --no-privileges --file "$1" --username "$POSTGRES_USER" "$POSTGRES_DB"'   backup "$container_file"
compose cp "postgres:$container_file" "$backup_file"

[ -s "$backup_file" ] || { echo "Error: el archivo de backup está vacío." >&2; exit 1; }
echo "Backup creado: $backup_file"
