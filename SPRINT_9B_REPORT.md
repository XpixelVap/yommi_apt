# Sprint 9B Report — Production Deployment Foundation

Fecha: 19 de julio de 2026
Rama: `feat/payment-orchestration`

## Resultado ejecutivo

Yommigo dispone de una base declarativa para un despliegue manual en VPS con Docker Compose, Caddy, PostgreSQL privado, healthchecks, persistencia, rotación limitada de logs, backups, restauración, actualización, rollback y smoke tests.

No se desplegó, no se inició el stack, no se tocaron DNS o servidores, no se ejecutaron migraciones, `db push`, bootstrap ADMIN, backups ni restauraciones. No se creó commit ni push.

## Archivos creados

- `.env.production.example`
- `Caddyfile`
- `docker-compose.production.yml`
- `PRODUCTION_DEPLOYMENT.md`
- `scripts/backup-postgres.sh`
- `scripts/restore-postgres.sh`
- `scripts/backup-postgres.ps1`
- `scripts/restore-postgres.ps1`
- `scripts/smoke-test-production.sh`
- `SPRINT_9B_REPORT.md`

## Archivos modificados por Sprint 9B

- `.gitignore`: permite solo el ejemplo productivo e ignora backups.
- `.dockerignore`: excluye backups del contexto.
- `backend/Dockerfile`: añade target manual `operations`.
- `DEPLOYMENT.md`: enlaza el procedimiento productivo.
- `LOCAL_DEVELOPMENT.md`: corrige frontend local a puerto 3000 y separa compose local/productivo.

Los cambios pendientes de Sprint 9A permanecen en el working tree y no se mezclaron conceptualmente con esta implementación. `UX_UI_AUDIT.md` permanece fuera del alcance.

## Arquitectura productiva

- Caddy publica exclusivamente TCP 80, TCP 443 y UDP 443.
- Frontend y backend se construyen desde sus Dockerfiles y solo usan `expose`.
- PostgreSQL 16 no publica puertos y pertenece a una red `internal`.
- Backend conserva una red de egress separada.
- Volúmenes: datos PostgreSQL y estado/certificados de Caddy.
- Restart `unless-stopped` y healthchecks para los cuatro servicios persistentes.
- Dependencias condicionadas por salud.
- Logs `json-file` limitados a cinco archivos de 10 MB por servicio.
- `operations` es un perfil manual con Prisma CLI, migraciones y bootstrap; no forma parte del runtime público.

## Reverse proxy

Se eligió Caddy por HTTPS automático con Let's Encrypt, renovación, redirección `www` y soporte WebSocket sin configuración adicional. Se añadieron compresión, HSTS, anti-sniffing, protección de frame, referrer policy, permissions policy y límite de request de 50 MB.

No se emitieron certificados. La configuración ejecutable de Caddy queda pendiente de validación con su imagen cuando Docker Desktop esté iniciado.

## Validaciones ejecutadas

- `docker compose --env-file .env.production.example -f docker-compose.production.yml config --quiet`: correcto.
- Revisión de puertos renderizados: únicamente 80/443 del reverse proxy.
- Parser PowerShell para ambos scripts `.ps1`: correcto.
- Git Bash `sh -n` para los tres scripts `.sh`: correcto.
- `npm run typecheck`: correcto en frontend y backend.
- `npm test`: 40/40 pruebas correctas.
- `npm run build`: frontend y backend correctos.
- `git diff --check`: correcto antes del reporte; repetido al cierre.
- Búsqueda de `localhost:5173`: cero referencias.
- Prisma schema y migraciones: sin cambios.
- Archivos `.env` reales: no modificados ni incluidos.
- Secretos: no detectados; el ejemplo usa placeholders `CHANGE_ME`.
- Desarrollo local: scripts y compose local conservados; frontend oficial documentado en puerto 3000.

## Validaciones Docker pendientes

Docker CLI 28.2.2 y Compose 2.37.1 están instalados, pero el daemon `desktop-linux` no está iniciado:

```text
open //./pipe/dockerDesktopLinuxEngine: El sistema no puede encontrar el archivo especificado
```

Por ello no se inventan resultados para:

```bash
docker build -f backend/Dockerfile --target runtime .
docker build -f backend/Dockerfile --target operations .
docker build -f frontend/Dockerfile .
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2.10-alpine caddy validate --config /etc/caddy/Caddyfile
```

Los Dockerfiles requieren contexto raíz porque usan workspaces y el `package-lock.json` raíz; por eso el comando canónico termina en `.`, no en `backend` o `frontend`.

Tampoco se ejecutaron smoke tests contra los dominios porque no existe despliegue.

## Riesgos

- Una base existente necesita auditoría y adopción controlada del baseline antes de `migrate deploy`.
- Sprint 6 deja todos los restaurantes existentes en `CLOSED`; el despliegue debe ser coordinado y la apertura explícita.
- `STORAGE_DRIVER=disabled` bloquea uploads en producción hasta integrar almacenamiento externo.
- No hay todavía monitoreo, alertas externas ni centralización de logs.
- Backups requieren retención, cifrado/protección, copia externa y pruebas periódicas.
- El límite de 50 MB debe revisarse antes de habilitar uploads.
- El target `operations` contiene herramientas de desarrollo y debe usarse solo bajo acceso administrativo.
- Los healthchecks no validan pedidos, pagos ni integridad completa.
- El tamaño sugerido de VPS necesita medición bajo carga real.

## Decisiones que requieren aprobación antes del VPS

- Proveedor, región, tamaño y sistema operativo del VPS.
- Dominio/DNS activos y correo operativo para Let's Encrypt.
- Valores y proceso de rotación de secretos.
- Clasificación de la base como nueva o existente.
- Ventana de mantenimiento y plan para `operationalStatus=CLOSED`.
- Retención, ubicación externa y cifrado de backups.
- Proveedor de almacenamiento de imágenes.
- Monitoreo, alertas y responsable de guardia.
- Aceptación o reducción del límite de 50 MB.
- Commit/tag exacto autorizado para desplegar.

## Checklist propuesto para Sprint 9C

- [ ] Iniciar Docker Desktop y construir las tres imágenes/targets.
- [ ] Validar Caddy con su imagen oficial.
- [ ] Ejecutar un ensayo aislado con secretos temporales.
- [ ] Levantar PostgreSQL de ensayo y comprobar healthcheck.
- [ ] Validar migraciones sobre una copia o base vacía, nunca producción.
- [ ] Probar backup y restauración en el entorno aislado.
- [ ] Ejecutar smoke tests contra dominios de staging.
- [ ] Revisar tamaños y vulnerabilidades de imágenes.
- [ ] Aprobar estrategia de base existente/baseline.
- [ ] Aprobar almacenamiento productivo o aceptar uploads deshabilitados.
- [ ] Aprobar DNS, firewall, monitoreo y backups externos.
- [ ] Preparar runbook de ventana productiva y responsables.
