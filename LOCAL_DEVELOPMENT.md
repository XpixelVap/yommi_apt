# Desarrollo local de Yommi 2.0

## Requisitos

- Node.js 20 LTS y npm.
- Docker Desktop o Docker Engine con Compose v2.
- Git.

## 1. Variables de entorno

Copia `backend/.env.example` a `backend/.env` y `frontend/.env.example` a `frontend/.env`. Los archivos `.env` reales están ignorados.

Genera `JWT_SECRET` local con al menos 32 caracteres aleatorios. No reutilices el placeholder ni secretos de otros ambientes. Las variables `VITE_*` son públicas y quedan embebidas en el navegador; nunca deben contener secretos.

Backend obligatorio: `DATABASE_URL`, `JWT_SECRET`, `API_URL`. En producción también es obligatorio declarar `CORS_ORIGINS`. Localhost se añade automáticamente solo con `NODE_ENV=development`.

## 2. PostgreSQL local

```bash
npm run db:up
docker compose ps
```

Compose publica PostgreSQL en `localhost:5432` y usa credenciales exclusivamente locales documentadas en el compose. El volumen `yommi_postgres_data` conserva datos entre reinicios.

## 3. Dependencias y Prisma

```bash
npm ci
npm run prisma:generate
npm run prisma:validate
```

Para una base local nueva, la cadena ahora contiene un baseline pre-Sprint 3, seguido por las migraciones aditivas de Sprint 3 y Sprint 4. Cuando exista aprobación para aplicar migraciones:

```bash
npm run prisma:migrate:deploy
```

No uses `db push`. Este sprint no ejecutó migraciones.

Una base existente creada antes del historial versionado requiere adoptar el baseline con un procedimiento revisado (`prisma migrate resolve`) antes de `migrate deploy`; no lo ejecutes automáticamente.

## 4. Aplicación

En una terminal:

```bash
npm run dev:backend
```

En otra:

```bash
npm run dev:frontend
```

También puede usarse `npm run dev` para ambos procesos. Frontend: `http://localhost:5173`. Backend: `http://localhost:3001`.

## 5. Comprobaciones

```bash
curl http://localhost:3001/health
curl http://localhost:3001/ready
npm run validate
npm run build
```

`/health` solo confirma que el proceso vive. `/ready` devuelve 200 únicamente si la configuración ya fue validada al arrancar y PostgreSQL responde; devuelve 503 sin detalles internos cuando no está listo.

## 6. Uploads

`STORAGE_DRIVER=local` guarda archivos bajo `UPLOAD_DIR` y se admite únicamente en desarrollo. No es apropiado para producción, réplicas o despliegues efímeros. Con `NODE_ENV=production`, la validación rechaza almacenamiento local. Hasta integrar un adaptador de objetos, producción debe usar `STORAGE_DRIVER=disabled`, lo que deshabilita escrituras de archivos.

## 7. Detener servicios

```bash
npm run db:down
```

No agregues `-v` salvo que quieras eliminar deliberadamente el volumen local.

## 8. Crear el primer administrador

Con PostgreSQL levantado, las migraciones aplicadas y el backend configurado mediante `backend/.env`, ejecuta desde la raíz:

```bash
npm run bootstrap-admin
```

El comando:

1. aborta inmediatamente si ya existe un usuario `ADMIN`;
2. solicita un correo válido;
3. solicita una contraseña oculta de 12 a 72 caracteres con mayúscula, minúscula, número y carácter especial, sin espacios;
4. crea exclusivamente el primer administrador con proveedor `email`;
5. muestra solo el resultado mínimo y nunca imprime la contraseña.

La operación es de una sola ejecución por base de datos. No borres ni cambies usuarios para volver a ejecutarla. Para comprobar el acceso, inicia backend y frontend y usa el login actual con las credenciales introducidas.
