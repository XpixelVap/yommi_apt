# Sprint 5 Report — Deployment Foundation

Fecha: 12 de julio de 2026
Rama: `feat/payment-orchestration`

## Resultado ejecutivo

Yommi dispone de una base reproducible para desarrollo local y artefactos neutrales de despliegue futuro. No se contrató hosting, no se creó infraestructura remota, no se aplicaron migraciones y no se desplegó la aplicación.

## Cambios principales

### Entorno

`backend/src/config/env.ts` valida con Zod variables, tipos, PostgreSQL, longitud mínima del JWT y requisitos productivos. `frontend/src/config/env.ts` valida variables públicas durante el arranque/build. Los errores enumeran nombres inválidos, nunca valores. Localhost se permite solo en desarrollo. Producción exige allowlist y prohíbe filesystem local.

Se separaron `backend/.env.example` y `frontend/.env.example`; el ejemplo raíz sirve como índice. No contienen secretos reales.

### Operabilidad

- `/health`: confirma proceso vivo sin dependencias.
- `/ready`: ejecuta `SELECT 1`; responde 503 cerrado ante fallo PostgreSQL.
- Las respuestas no revelan versiones, URLs, credenciales ni errores de conexión.
- CORS HTTP y Socket.IO usan la misma allowlist.

### PostgreSQL y migraciones

Compose ofrece PostgreSQL 16 local con volumen y healthcheck. Se generó, sin ejecutarlo, `20260711000000_baseline` desde el schema canónico de Sprint 2. Esto completa la cadena para bases vacías:

1. baseline Sprint 2;
2. migración aditiva Sprint 3;
3. migración aditiva Sprint 4.

Bases existentes deben comparar schema y marcar el baseline aplicado mediante un procedimiento manual aprobado antes de `migrate deploy`.

### Archivos

`FileStorage` desacopla rutas de upload. `LocalFileStorage` escribe solo en desarrollo, normaliza rutas y crea URLs desde `API_URL`. `DisabledFileStorage` bloquea uploads en producción hasta integrar almacenamiento persistente. No se integraron S3, R2 ni GCS.

### Docker y CI

- Backend multi-stage: dependencias, Prisma/build, dependencias productivas y runtime no-root.
- Frontend multi-stage: build Vite y Nginx con fallback SPA.
- `.dockerignore` excluye secretos, dependencias, builds, uploads y bases.
- CI ejecuta instalación, tests, typecheck, build y Prisma; no migra ni despliega.

## Archivos creados

- `.dockerignore`
- `.github/workflows/ci.yml`
- `backend/.env.example`
- `frontend/.env.example`
- `frontend/src/config/env.ts`
- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `backend/src/config/env.ts`
- `backend/src/storage/storage.ts`
- `backend/src/storage/local-storage.ts`
- `backend/src/storage/disabled-storage.ts`
- `backend/src/storage/index.ts`
- `backend/prisma/migrations/20260711000000_baseline/migration.sql`
- `DEPLOYMENT.md`
- `LOCAL_DEVELOPMENT.md`
- `SPRINT_5_REPORT.md`

## Archivos modificados

- `.env.example`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `frontend/package.json`
- `frontend/src/main.tsx`
- `backend/package.json`
- `backend/server.ts`
- `backend/src/db.ts`
- `backend/src/routes.ts`
- `backend/src/adminRoutes.ts`
- `CHANGELOG.md`

## Comandos y resultados

- `npm run prisma:generate`: correcto.
- `npm run prisma:validate`: correcto.
- `npm run typecheck`: correcto en ambos workspaces.
- `npm test`: 17/17 pruebas exitosas.
- `npm run build`: frontend y backend correctos; Vite transformó 1,823 módulos.
- `docker compose config --quiet`: correcto.
- Smoke test con PostgreSQL inaccesible: `/health` 200, `/ready` 503.
- `git diff --check`: correcto, sin errores de whitespace.
- `docker build --check`: no ejecutable porque Docker Desktop/Linux Engine no estaba iniciado.

## Riesgos pendientes

- Antes del primer despliegue sobre una base existente debe aprobarse la adopción del baseline.
- `STORAGE_DRIVER=disabled` significa que producción no admite uploads hasta integrar almacenamiento de objetos.
- Los dominios yommigo están documentados, pero no se asumen activos ni se permiten automáticamente.
- El build frontend incorpora variables `VITE_*`; deben tratarse como públicas.
- Deben validarse ambos Dockerfiles con un daemon activo y realizarse smoke tests de sus imágenes.
- Los health checks no reemplazan observabilidad, backups, TLS, rotación de secretos ni estrategia de rollback.

## Acciones no realizadas

- No se ejecutaron migraciones, `db push` ni `migrate deploy`.
- No se levantó PostgreSQL con Compose.
- No se hizo deploy.
- No se configuró hosting o cloud storage.
- No se ejecutó `npm audit fix`; `npm install` reportó 10 vulnerabilidades existentes (2 bajas, 2 moderadas y 6 altas) para revisión separada.
- No se creó commit de Sprint 5.