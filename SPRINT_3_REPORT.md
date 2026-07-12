# Sprint 3 Report — Activación segura del restaurante

Fecha: 12 de julio de 2026

## Resultado ejecutivo

El restaurante pendiente ahora puede autenticarse, completar perfil y menú y consultar su readiness, pero permanece fuera de rutas públicas y pedidos hasta cumplir todos los requisitos y ser aprobado. El flujo de pedido persiste explícitamente pickup/delivery y calcula la tarifa exclusivamente en backend.

## Migración propuesta (no ejecutada)

Archivo: `backend/prisma/migrations/20260712000100_sprint_3_fulfillment/migration.sql`

```sql
ALTER TABLE "Restaurant"
ADD COLUMN "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD COLUMN "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fulfillmentType" TEXT;
```

Es aditiva: no borra, transforma ni rellena filas históricas. `fulfillmentType` permanece nullable; null significa `LEGACY/UNKNOWN`. No se ejecutaron `prisma migrate` ni `db push`.

## Decisiones tomadas

- Readiness centralizado en backend, no calculado por la interfaz.
- Publicación definida como `approved + isActive + ready` y aplicada fail-closed.
- Los pendientes pueden configurar perfil y catálogo, pero no leer, recibir ni gestionar pedidos.
- La aprobación administrativa exige readiness completo.
- Nuevos pedidos requieren modalidad válida; pickup vale cero y delivery toma la tarifa configurada en el restaurante.
- El registro termina y autentica antes del logo opcional.
- Los eventos del funnel son logs JSON estructurados; `dedupeKey` permite deduplicar “primer” evento en la plataforma de observabilidad sin añadir infraestructura fuera del MVP.

## Archivos modificados o creados

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma/migrations/20260712000100_sprint_3_fulfillment/migration.sql`
- `backend/src/adminRoutes.ts`
- `backend/src/routes.ts`
- `backend/src/core/order-pricing.ts`
- `backend/src/core/restaurant-access.ts`
- `backend/src/core/restaurant-readiness.ts`
- `backend/src/core/funnel-events.ts`
- `backend/src/tests/regression.test.ts`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/RestaurantDashboard.tsx`
- `frontend/src/pages/Cart.tsx`
- `frontend/src/components/MenuManager.tsx`
- `frontend/src/components/RestaurantSettings.tsx`
- `frontend/src/store.ts`
- `frontend/src/utils/optionalUpload.ts`
- `frontend/src/tests/registration-flow.test.ts`
- `frontend/package.json`
- `package.json`
- `CHANGELOG.md`
- `SPRINT_3_REPORT.md`

`RESTAURANT_FIRST_AUDIT.md` ya existía sin seguimiento al iniciar este sprint y no fue modificado.

## Pruebas y criterios cubiertos

- Registro público rechaza ADMIN y DRIVER.
- Pricing ignora datos económicos del cliente, recalcula subtotal y aplica tarifa backend.
- Pickup fuerza tarifa cero; delivery usa la tarifa configurada.
- Pendiente puede configurar, pero no operar/publicarse.
- Readiness cambia al completar los requisitos mínimos.
- Admin no puede aprobar un restaurante incompleto.
- Ownership de recursos de otro restaurante es rechazado.
- Transiciones inválidas/regresivas de pedido son rechazadas.
- Fallo del logo opcional no cancela un registro ya completado.

## Comandos ejecutados y resultados

- `npm run prisma:generate`: correcto; cliente 5.22.0 generado desde el schema canónico.
- `npm test`: correcto; 1 prueba frontend y 8 backend, 9/9 exitosas.
- `npm run typecheck`: correcto en frontend y backend.
- `npm run prisma:validate`: correcto con URL PostgreSQL ficticia solo para parseo; no hubo conexión ni escritura.
- `npm run build`: correcto; Vite y esbuild completaron ambos workspaces.

Los primeros intentos de tests/build/validate dentro del sandbox fallaron por `spawn EPERM` o bloqueo de descarga del binario; se repitieron con permisos de ejecución, sin cambiar código ni datos.

## Riesgos y compatibilidad

- La migración debe aplicarse antes de desplegar el backend; de lo contrario, las nuevas columnas no existirán en producción.
- `fulfillmentType = null` debe seguir mostrándose como legacy/desconocido hasta una migración basada en evidencia.
- Los eventos “first” requieren deduplicación por `dedupeKey` en el colector de logs; no se añadió una tabla de analytics.
- La entrada de directorio creada por auto-registro cambia de `UNCLAIMED` a `PENDING`; integraciones que consuman estados libres deben aceptar ese valor.
- La tarifa está en centavos y requiere configuración coherente por parte del restaurante.

## Pendientes posteriores

- Revisar y aprobar operacionalmente el SQL antes de ejecutar `prisma migrate deploy` en cada ambiente.
- Diseñar una migración histórica separada solo después de verificar datos de modalidad.
- Añadir pruebas HTTP/integración con una base PostgreSQL efímera cuando exista infraestructura de testing.
- Configurar el colector de logs para deduplicar y explotar métricas del funnel.

No se realizó commit.