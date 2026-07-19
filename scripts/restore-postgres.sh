#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

[ "$#" -eq 1 ] || { echo "Uso: $0 <archivo.dump>" >&2; exit 1; }
backup_file="$1"

command -v docker >/dev/null 2>&1 || { echo "Error: docker no está disponible." >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Error: no existe $ENV_FILE." >&2; exit 1; }
[ -s "$backup_file" ] || { echo "Error: backup inexistente o vacío: $backup_file" >&2; exit 1; }

printf 'Esta restauración reemplazará la base actual. Escribe RESTAURAR para continuar: '
IFS= read -r confirmation
[ "$confirmation" = "RESTAURAR" ] || { echo "Restauración cancelada."; exit 1; }

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
container_file="/tmp/yommigo-restore-$timestamp.dump"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

cleanup() {
  compose exec -T postgres rm -f "$container_file" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

compose cp "$backup_file" "postgres:$container_file"
compose exec -T postgres sh -eu -c   'pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" "$1"'   restore "$container_file"

echo "Restauración completada desde: $backup_file"
