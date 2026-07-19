# Despliegue productivo manual de Yommigo

## Arquitectura y alcance

Este procedimiento prepara un VPS Linux con Docker Compose. No ejecuta por sí mismo despliegues, migraciones, bootstrap, DNS ni cambios de servidor.

Caddy es el único servicio con puertos públicos. Se eligió frente a Nginx porque gestiona automáticamente certificados Let's Encrypt, redirección HTTPS y WebSockets con una configuración pequeña y auditable. Nginx permanece dentro del frontend solo para servir el build estático.

```text
Internet :80/:443
  |
Caddy
  |-- yommigo.com --------> frontend:80
  |-- www.yommigo.com ----> redirect yommigo.com
  `-- api.yommigo.com ----> backend:3001 ----> PostgreSQL:5432
```

- PostgreSQL pertenece únicamente a `app_private`, red interna, y no publica puertos.
- Frontend y backend usan `expose`, nunca puertos del host.
- Caddy une `edge` y `app_private`.
- `backend_egress` permite conexiones salientes sin publicar el backend.
- PostgreSQL y Caddy usan volúmenes persistentes.
- El límite externo de requests es 50 MB, alineado con Express.
- `operations` contiene Prisma y el bootstrap para tareas manuales; no recibe tráfico ni arranca con el stack normal.

## Requisitos y seguridad del VPS

Baseline sugerido para piloto, sujeto a medición: Linux x86_64, 2 vCPU, 4 GB RAM, 40 GB SSD, Docker Engine, Compose v2, Git y curl.

- Usuario no root; pertenecer al grupo Docker equivale prácticamente a root.
- SSH con llave. Desactivar root y contraseña solo después de verificar otro acceso.
- Firewall: 80/443 públicos y 22 restringido a IPs administrativas cuando sea viable.
- Nunca abrir 5432.
- Instalar actualizaciones de seguridad; fail2ban es opcional.
- Configurar rotación de logs Docker.
- `.env.production` debe pertenecer al usuario de despliegue y tener permisos `600`.
- Mantener secretos fuera de Git y backups protegidos fuera del VPS.

## DNS, HTTPS y dominios

Antes de levantar Caddy:

1. Crear registros A para `yommigo.com`, `www.yommigo.com` y `api.yommigo.com` hacia el VPS.
2. Crear AAAA solo si IPv6 está correctamente protegido.
3. Confirmar propagación desde una red externa.
4. Permitir 80/443 en firewall y proveedor.
5. Configurar un correo real en `LETSENCRYPT_EMAIL`.

Caddy emitirá certificados al arrancar únicamente si DNS y red son correctos. No levantar el proxy con placeholders.

## Variables productivas

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Reemplazar todos los `CHANGE_ME` y comprobar:

- `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD`;
- `DATABASE_URL` con host interno `postgres` y contraseña URL-encoded;
- `JWT_SECRET` aleatorio de al menos 32 caracteres;
- `API_URL` y `VITE_API_URL` iguales a `https://api.yommigo.com`;
- `CORS_ORIGINS=https://yommigo.com,https://www.yommigo.com`;
- dominios Caddy, correo y `TZ=America/Tijuana`;
- `STORAGE_DRIVER=disabled` mientras no exista almacenamiento externo.

`VITE_*` es público y queda incrustado en el bundle. Nunca colocar secretos allí.

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
```

El resultado expandido de `config` contiene secretos: no publicarlo ni guardarlo en tickets.

## Primer despliegue con base nueva

```bash
DC='docker compose --env-file .env.production -f docker-compose.production.yml'

$DC config --quiet
$DC up -d postgres
$DC ps postgres
$DC --profile operations build operations
$DC run --rm operations npm run prisma:validate --workspace=backend
$DC run --rm operations npm run prisma:migrate:deploy --workspace=backend
$DC build backend frontend
$DC up -d backend
$DC exec -T backend node -e "fetch('http://127.0.0.1:3001/ready').then(r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
$DC run --rm operations npm run bootstrap-admin
$DC up -d frontend reverse-proxy
```

El bootstrap es interactivo y se ejecuta una sola vez. No automatizarlo en CI, entrypoint o Compose.

Después:

```bash
FRONTEND_URL=https://yommigo.com API_URL=https://api.yommigo.com CORS_ORIGIN=https://yommigo.com ./scripts/smoke-test-production.sh
```

Nunca usar `prisma db push` ni `prisma migrate dev`. `migrate deploy` no forma parte del arranque del backend.

### Advertencia crítica: restaurantes cerrados

Sprint 6 añade `Restaurant.operationalStatus` con default `CLOSED`. Todos los restaurantes existentes quedan cerrados al aplicar la migración y no existe backfill automático a `OPEN`.

No aplicar esa migración hasta confirmar un despliegue coordinado de backend y frontend con control de apertura. Después, cada restaurante debe abrirse explícitamente antes de recibir pedidos.

## Base existente

Una base anterior al historial Prisma no debe tratarse como vacía:

1. Activar mantenimiento y crear un backup verificado.
2. Comparar el schema real con `backend/prisma/schema.prisma`.
3. Revisar `_prisma_migrations`.
4. Confirmar materialmente si existe el baseline `20260711000000_baseline`.
5. Solo con aprobación técnica, registrar el baseline:

```bash
$DC run --rm operations npx prisma migrate resolve --schema=backend/prisma/schema.prisma --applied 20260711000000_baseline
```

6. Revisar el SQL de cada migración pendiente.
7. Ejecutar manualmente `migrate deploy`.
8. Aplicar la advertencia `operationalStatus=CLOSED`.

`migrate resolve` solo registra estado; no corrige discrepancias. Nunca ejecutarlo por conveniencia.

## Backups

Linux:

```bash
chmod +x scripts/backup-postgres.sh scripts/restore-postgres.sh scripts/smoke-test-production.sh
./scripts/backup-postgres.sh
```

Windows:

```powershell
.scriptsackup-postgres.ps1
```

Los scripts usan `pg_dump` custom dentro del contenedor, nombres UTC y comprobación de archivo no vacío. No contienen credenciales. Copiar el resultado fuera del VPS y aplicar retención.

## Restauración y prueba

La restauración reemplaza datos y exige escribir exactamente `RESTAURAR`:

```bash
./scripts/restore-postgres.sh backups/yommigo-YYYYMMDDTHHMMSSZ.dump
```

```powershell
.scriptsestore-postgres.ps1 backupsyommigo-YYYYMMDDTHHMMSSZ.dump
```

Antes: mantenimiento, detener backend, crear otro backup, verificar checksum/espacio/versión. Después: levantar backend, comprobar `/ready`, consultar datos representativos y ejecutar smoke tests.

Probar mensualmente en staging o un proyecto aislado con credenciales propias:

```bash
COMPOSE_PROJECT_NAME=yommigo-restore-test ENV_FILE=.env.restore-test ./scripts/restore-postgres.sh backups/archivo.dump
```

Nunca probar una restauración sobre producción activa.

## Actualización

Local:

```bash
npm ci
npm run typecheck
npm test
npm run build
git diff --check
git commit
git push
```

Registrar un tag o commit aprobado.

VPS:

```bash
$DC up -d postgres
./scripts/backup-postgres.sh
git fetch --tags origin
git checkout <tag-o-commit-aprobado>
$DC config --quiet
$DC --profile operations build operations
$DC run --rm operations npm run prisma:validate --workspace=backend
$DC run --rm operations npm run prisma:migrate:deploy --workspace=backend
$DC build backend frontend
$DC up -d backend frontend reverse-proxy
./scripts/smoke-test-production.sh
```

Revisar siempre el SQL pendiente antes de migrar. No usar `git pull` sin confirmar qué commit será desplegado.

## Rollback

Sin cambios de base:

```bash
git checkout <tag-o-commit-anterior>
$DC build backend frontend
$DC up -d backend frontend reverse-proxy
./scripts/smoke-test-production.sh
```

Con migración: mantener servicio cerrado, no improvisar down migrations, evaluar compatibilidad hacia delante y restaurar el backup previo solo si es necesario y aprobado. Crear primero otro backup del estado fallido. Nunca hacer rollback destructivo sin backup.

## Smoke tests

`scripts/smoke-test-production.sh` verifica sin credenciales ni escrituras:

- frontend 200;
- `/health` 200;
- `/ready` 200;
- `/api/restaurants` 200 y JSON;
- preflight CORS;
- endpoint inexistente 404;
- handshake Socket.IO por polling.

No prueba pedidos, pagos ni acciones destructivas.

## Operación y troubleshooting

```bash
$DC ps
$DC logs --tail=200 backend
$DC logs --tail=200 reverse-proxy
$DC logs --tail=200 postgres
```

- Certificados: revisar DNS, 80/443, reloj y logs de Caddy.
- Backend unhealthy: revisar variables, URL PostgreSQL, salud y migraciones.
- CORS: comparar el Origin exacto; nunca usar `*`.
- URL frontend incorrecta: reconstruir; `VITE_API_URL` es build-time.
- Socket.IO: comprobar `https://api.yommigo.com/socket.io/`.
- Uploads: fallarán con `STORAGE_DRIVER=disabled`. No habilitar filesystem local en producción.
- Migración bloqueada: detenerse, conservar logs mínimos y solicitar revisión; no usar `db push`.

## Checklist antes de abrir tráfico

- [ ] Commit o tag aprobado y worktree limpio.
- [ ] Dockerfiles construidos y revisados.
- [ ] DNS resuelve los tres dominios.
- [ ] Firewall solo expone 80/443 y SSH restringido.
- [ ] `.env.production` completo, modo 600 y fuera de Git.
- [ ] Backup externo y restauración probada.
- [ ] Baseline adoptado solo si correspondía.
- [ ] SQL pendiente revisado y migraciones manuales exitosas.
- [ ] Control de apertura desplegado antes de Sprint 6.
- [ ] Primer ADMIN creado una sola vez.
- [ ] PostgreSQL sin puertos publicados.
- [ ] Certificados válidos.
- [ ] Health, ready, CORS, JSON, 404 y Socket.IO correctos.
- [ ] `STORAGE_DRIVER=disabled` aceptado o almacenamiento externo aprobado.
- [ ] Restaurantes abiertos explícitamente.
- [ ] Rotación de logs, monitoreo y responsable de guardia definidos.
