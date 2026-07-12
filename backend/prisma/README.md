# Prisma canónico de Yommi 2.0

`backend/prisma/schema.prisma` es la única fuente canónica del modelo PostgreSQL usado por el backend.

Reglas:

- Ejecutar Prisma desde el workspace backend o mediante los scripts raíz `prisma:generate` y `prisma:validate`.
- Todos los comandos deben declarar `--schema=prisma/schema.prisma` dentro del workspace backend.
- No ejecutar `prisma db push` ni migraciones destructivas sobre producción.
- `DeliveryDriver` y `Commission` son modelos **legacy/frozen**. Se mantienen para compatibilidad; no deben recibir nuevas reglas de negocio ni nuevas relaciones.
- Su retiro requiere análisis de datos, migración revisada y rollback independiente.