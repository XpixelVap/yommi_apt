# Deployment Foundation

Yommi no está ligado todavía a un proveedor de hosting. Esta guía define contratos de despliegue reproducibles sin crear infraestructura externa.

## Artefactos

- Backend: imagen multi-stage desde `backend/Dockerfile`.
- Frontend: build Vite estático servido por Nginx desde `frontend/Dockerfile`.
- PostgreSQL: servicio administrado futuro o PostgreSQL compatible; `docker-compose.yml` es solo local.
- Uploads: filesystem local exclusivamente en desarrollo. Producción queda en `disabled` hasta implementar S3, R2, GCS u otro adaptador compatible con `FileStorage`.

## Variables backend

Obligatorias:

- `NODE_ENV=production`
- `DATABASE_URL` PostgreSQL con TLS según el proveedor.
- `JWT_SECRET` aleatorio, mínimo 32 caracteres.
- `API_URL` URL pública del backend.
- `CORS_ORIGINS` lista CSV de orígenes autorizados.
- `STORAGE_DRIVER=disabled` hasta integrar almacenamiento persistente.

Opcionales: `PORT`, `GOOGLE_CLIENT_ID`, `GEMINI_API_KEY`, `UPLOAD_DIR`.

Los dominios `yommigo.com`, `www.yommigo.com`, `app.yommigo.com` y `api.yommigo.com` están preparados como ejemplos, pero no se consideran activos hasta verificar DNS y TLS. No se permiten automáticamente: deben declararse en `CORS_ORIGINS`.

## Variables frontend

- `VITE_API_URL`: endpoint público de API, por ejemplo `https://api.yommigo.com` cuando exista.
- `VITE_GOOGLE_CLIENT_ID`: identificador público opcional.

Ningún secreto puede usar prefijo `VITE_`.

## Orden obligatorio de despliegue

1. Backup y comprobación de compatibilidad.
2. `npm run prisma:validate` y `npm run prisma:generate` en CI/build.
3. Aplicar migraciones con `npm run prisma:migrate:deploy` desde una tarea única y controlada.
4. Desplegar backend y esperar `/ready = 200`.
5. Desplegar frontend con `VITE_API_URL` correcto.
6. Ejecutar smoke tests de `/health`, `/ready`, CORS, login y creación de pedido.

Nunca despliegues frontend antes de que el contrato backend y sus migraciones estén disponibles.

## Adopción del baseline

La migración `20260711000000_baseline` representa el schema previo a Sprint 3 y permite bases nuevas reproducibles. Las bases existentes que ya contienen esas tablas no deben ejecutar el baseline: primero se compara el schema real y, con aprobación operativa, se marca el baseline como aplicado usando el mecanismo oficial de Prisma. Este paso es manual y específico del ambiente.

Las migraciones Sprint 3 y Sprint 4 continúan siendo aditivas. Este sprint no ejecutó ninguna migración.

## Health checks

- `GET /health`: liveness, sin consultas externas.
- `GET /ready`: valida disponibilidad de PostgreSQL con una consulta mínima.

Las respuestas no incluyen versiones, URLs, secretos, stack traces ni detalles de infraestructura.

## CORS

HTTP y Socket.IO usan la misma allowlist. Peticiones sin `Origin` se permiten para health checks y comunicación servidor-servidor. Localhost solo se agrega en desarrollo. Producción falla al iniciar si no declara `CORS_ORIGINS`.

## Imágenes y secretos

`.dockerignore` excluye `.env`, bases, uploads, dependencias y builds locales. Los secretos se inyectan en runtime; nunca se copian ni se usan como `ARG`. Solo `VITE_*`, que son públicos, pueden ser argumentos del build frontend.

## CI

`.github/workflows/ci.yml` ejecuta instalación reproducible, tests, typecheck, build y Prisma validate/generate. No aplica migraciones ni despliega. Usa únicamente placeholders de CI, no depende de secretos configurados en GitHub.

## Almacenamiento en producción

Antes de habilitar uploads se debe implementar un adaptador `FileStorage` con:

- persistencia externa;
- URLs públicas o firmadas;
- límites y tipos equivalentes;
- ownership y autorización;
- lifecycle/retención;
- observabilidad sin registrar contenido sensible.

El cambio debe realizarse en el binding `backend/src/storage/index.ts`, sin reescribir las rutas consumidoras.

## Bootstrap oficial del primer administrador

Ejecutar este procedimiento una sola vez por ambiente, después de aplicar las migraciones y antes de habilitar la administración:

```bash
npm run bootstrap-admin
```

El comando requiere una terminal interactiva y una conexión válida en `DATABASE_URL`. Primero comprueba que no exista ningún usuario con rol `ADMIN`; si ya existe uno, termina antes de solicitar credenciales y no modifica datos. Si el ambiente no está inicializado, solicita correo y contraseña sin mostrar la contraseña.

La contraseña debe tener entre 12 y 72 caracteres e incluir mayúscula, minúscula, número y carácter especial, sin espacios. La creación se protege con un bloqueo transaccional PostgreSQL y una segunda comprobación para impedir dos administradores iniciales concurrentes. El usuario queda con `role=ADMIN`, `provider=email` e `isSuspended=false`. Las ejecuciones posteriores se rechazan; este comando no sirve para administrar o reemplazar usuarios existentes.

No ejecutes el comando desde CI, un Dockerfile o un proceso no interactivo. Nunca pases la contraseña mediante argumentos, variables de entorno, logs o historial de shell.

## Stack productivo manual

La base de Sprint 5 se conserva para desarrollo y CI. El procedimiento de VPS, Caddy, backups, restauración, migraciones, rollback y smoke tests está en `PRODUCTION_DEPLOYMENT.md`.

Validar con:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
```

Solo Caddy publica 80/443. PostgreSQL nunca publica puertos. Migraciones y `bootstrap-admin` son manuales mediante el perfil `operations`; nunca forman parte del arranque.
