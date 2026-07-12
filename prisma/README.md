# Prisma SQLite legacy

Esta carpeta raíz ya no forma parte del flujo activo de desarrollo.

- `schema.prisma` y `dev.db` se conservan temporalmente como artefactos legacy para evitar una eliminación irreversible.
- No deben usarse para `generate`, `db push`, seed ni migraciones.
- La única fuente canónica es `backend/prisma/schema.prisma` con PostgreSQL.
- Cuando se confirme que no contienen datos necesarios, podrán archivarse o eliminarse en una tarea de migración separada.