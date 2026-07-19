#!/usr/bin/env sh
set -eu

FRONTEND_URL="${FRONTEND_URL:-https://yommigo.com}"
API_URL="${API_URL:-https://api.yommigo.com}"
CORS_ORIGIN="${CORS_ORIGIN:-$FRONTEND_URL}"

command -v curl >/dev/null 2>&1 || { echo "Error: curl no está disponible." >&2; exit 1; }

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT INT TERM

assert_status() {
  expected="$1"
  url="$2"
  output="$3"
  actual="$(curl --silent --show-error --location --output "$output" --write-out '%{http_code}' "$url")"
  [ "$actual" = "$expected" ] || {
    echo "Error: $url devolvió HTTP $actual; se esperaba $expected." >&2
    exit 1
  }
  echo "OK $expected $url"
}

assert_status 200 "$FRONTEND_URL/" "$work_dir/frontend"
assert_status 200 "$API_URL/health" "$work_dir/health"
assert_status 200 "$API_URL/ready" "$work_dir/ready"

restaurants_headers="$work_dir/restaurants.headers"
restaurants_body="$work_dir/restaurants.json"
restaurants_status="$(curl --silent --show-error --location --dump-header "$restaurants_headers" --output "$restaurants_body" --write-out '%{http_code}' "$API_URL/api/restaurants")"
[ "$restaurants_status" = "200" ] || { echo "Error: /api/restaurants devolvió HTTP $restaurants_status." >&2; exit 1; }
grep -Eiq '^content-type:[[:space:]]*application/json' "$restaurants_headers" || { echo "Error: /api/restaurants no devolvió JSON." >&2; exit 1; }
first_char="$(sed 's/^[[:space:]]*//' "$restaurants_body" | cut -c1)"
case "$first_char" in
  '{'|'[') ;;
  *) echo "Error: respuesta JSON vacía o inválida." >&2; exit 1 ;;
esac
echo "OK 200 JSON $API_URL/api/restaurants"

cors_headers="$work_dir/cors.headers"
cors_status="$(curl --silent --show-error --output /dev/null --dump-header "$cors_headers" --write-out '%{http_code}' --request OPTIONS --header "Origin: $CORS_ORIGIN" --header 'Access-Control-Request-Method: GET' "$API_URL/api/restaurants")"
case "$cors_status" in
  200|204) ;;
  *) echo "Error: preflight CORS devolvió HTTP $cors_status." >&2; exit 1 ;;
esac
grep -Fiq "access-control-allow-origin: $CORS_ORIGIN" "$cors_headers" || { echo "Error: CORS no autorizó $CORS_ORIGIN." >&2; exit 1; }
echo "OK CORS $CORS_ORIGIN"

assert_status 404 "$API_URL/api/__smoke_test_missing__" "$work_dir/not-found"

socket_body="$work_dir/socket"
socket_status="$(curl --silent --show-error --output "$socket_body" --write-out '%{http_code}' "$API_URL/socket.io/?EIO=4&transport=polling")"
[ "$socket_status" = "200" ] || { echo "Error: Socket.IO devolvió HTTP $socket_status." >&2; exit 1; }
grep -Eq '^0' "$socket_body" || { echo "Error: handshake Socket.IO no reconocido." >&2; exit 1; }
echo "OK Socket.IO polling"

echo "Smoke tests productivos completados."
