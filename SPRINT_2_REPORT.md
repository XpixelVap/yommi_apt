# Sprint 2 Report — Consolidación del núcleo técnico

**Fecha:** 11 de julio de 2026
**Alcance:** Prisma, estados de pedido, congelamiento de comisión/repartidores, pruebas mínimas y calidad.
**Referencias:** `YOMMI_AUDIT.md`, `ARCHITECTURE.md`, `VISION.md`, `CHANGELOG.md`.

## 1. Resultado ejecutivo

Sprint 2 consolidó las reglas críticas existentes sin añadir funcionalidades de producto ni modificar el diseño.

Resultados:

- `backend/prisma/schema.prisma` es la única fuente canónica PostgreSQL.
- El schema SQLite raíz ya no puede ser autodetectado como schema activo; se conservó renombrado.
- Los estados y transiciones de pedidos están centralizados y protegidos contra saltos/regresiones.
- `IN_TRANSIT` y `COMPLETED` tienen compatibilidad legacy explícita.
- `Commission` y `DeliveryDriver` están congelados sin borrar datos o romper rutas/pantallas.
- Se añadieron 5 pruebas de regresión y todas pasan.
- Prisma validate/generate, typecheck y build pasan.
- No se ejecutaron migraciones, `db push`, `npm audit fix` ni commits.

## 2. Decisiones tomadas

### Prisma canónico

El backend realmente usa el schema ubicado en `backend/prisma/schema.prisma` porque:

- `npm postinstall` se ejecuta en el workspace backend.
- Prisma resuelve `prisma/schema.prisma` relativo a ese workspace.
- Ese schema declara `provider = "postgresql"` y `DATABASE_URL`.
- El backend importa el Prisma Client generado desde ese flujo.

Decisión:

- Mantener `backend/prisma/schema.prisma` como única fuente canónica.
- Hacer explícito `--schema=prisma/schema.prisma` en cada script backend.
- Exponer scripts raíz que delegan únicamente al workspace backend.
- Renombrar el schema raíz a `prisma/schema.sqlite.legacy.prisma` para impedir autodetección accidental.
- Conservar `prisma/dev.db` y el schema legacy para una retirada posterior revisada.

Impacto del renombrado:

- `npx prisma ...` desde la raíz ya no encuentra automáticamente un schema SQLite activo.
- Los scripts oficiales siguen funcionando porque apuntan al backend.
- No hay pérdida de datos ni cambio en PostgreSQL.
- El movimiento es reversible.

### Estados de pedido

Estados canónicos:

1. `PENDING`
2. `ACCEPTED`
3. `PREPARING`
4. `READY`
5. `ON_THE_WAY`
6. `DELIVERED`
7. `CANCELLED`

Transiciones permitidas:

| Estado actual | Siguientes estados permitidos |
|---|---|
| `PENDING` | `ACCEPTED`, `CANCELLED` |
| `ACCEPTED` | `PREPARING`, `CANCELLED` |
| `PREPARING` | `READY`, `CANCELLED` |
| `READY` | `ON_THE_WAY`, `CANCELLED` |
| `ON_THE_WAY` | `DELIVERED` |
| `DELIVERED` | ninguno |
| `CANCELLED` | ninguno |

Compatibilidad:

- Input/dato `IN_TRANSIT` se normaliza a `ON_THE_WAY`.
- Dato `COMPLETED` se normaliza a `DELIVERED` para reglas y se representa como entregado en frontend.
- Las nuevas escrituras usan estados canónicos.
- No se convirtió el campo Prisma a enum porque eso requiere una migración y existe riesgo de datos legacy.

Las rutas operativa y admin utilizan la misma función `resolveOrderTransition`. Una transición inválida devuelve HTTP 409.

### Reglas críticas extraídas

Se crearon funciones puras, previas a una modularización completa:

- `public-registration.ts`: roles permitidos y rol por defecto.
- `order-pricing.ts`: validación de producto/restaurante/disponibilidad y total server-side.
- `ownership.ts`: comparación de tenant/ownership.
- `order-status.ts`: estados, aliases y transiciones.

Las rutas siguen conservando sus URLs y respuestas actuales, pero delegan estas reglas en las funciones comunes.

### Commission y DeliveryDriver

Decisión de congelamiento:

- No eliminar modelos, claves foráneas, rutas o pantallas.
- No crear nuevas relaciones, reglas comerciales o casos de uso.
- No usar `Commission` para pricing, pedidos, reporting o suscripción.
- No ampliar `DeliveryDriver` como flota Yommi.
- Mantener solo compatibilidad con datos y usuarios existentes.

Su eliminación requiere una tarea posterior con inventario de datos, migración expand/contract, comunicación y rollback.

## 3. Archivos modificados

### Configuración y flujo Prisma

- `.gitignore`
- `package.json`
- `backend/package.json`
- `frontend/package.json`
- `backend/tsconfig.json` — nuevo
- `backend/prisma/schema.prisma`
- `backend/prisma/README.md` — nuevo
- `prisma/README.md` — nuevo
- `prisma/schema.prisma` -> `prisma/schema.sqlite.legacy.prisma` — renombrado reversible

### Backend

- `backend/src/routes.ts`
- `backend/src/adminRoutes.ts`
- `backend/src/core/public-registration.ts` — nuevo
- `backend/src/core/order-pricing.ts` — nuevo
- `backend/src/core/ownership.ts` — nuevo
- `backend/src/core/order-status.ts` — nuevo
- `backend/src/tests/regression.test.ts` — nuevo

### Frontend — solo compatibilidad de estados

- `frontend/src/pages/RestaurantDashboard.tsx`
- `frontend/src/pages/ClientDashboard.tsx`
- `frontend/src/pages/OrderTracking.tsx`
- `frontend/src/pages/AdminDashboard.tsx`

No se modificaron layout, estilos, componentes visuales ni navegación.

### Documentación

- `CHANGELOG.md`
- `SPRINT_2_REPORT.md` — nuevo

### Artefactos regenerados

- `backend/server.js`
- `frontend/dist/*`
- Prisma Client dentro de `node_modules`

## 4. Pruebas creadas

Archivo: `backend/src/tests/regression.test.ts`.

Casos:

1. Registro público rechaza `ADMIN` y `DRIVER` y permite `CLIENT`/`RESTAURANT`.
2. Pricing ignora un precio manipulado en el item y calcula desde productos backend.
3. Ownership distingue recursos del restaurante autenticado y de otro restaurante.
4. Transiciones arbitrarias/regresivas se rechazan.
5. `IN_TRANSIT` legacy se normaliza y puede avanzar correctamente a `DELIVERED`.

Resultado:

```text
Tests: 5
Passed: 5
Failed: 0
```

Estas son pruebas unitarias de reglas críticas. Las pruebas de integración HTTP + PostgreSQL quedan pendientes; no se levantó ni modificó una base de datos en este sprint.

## 5. Comandos ejecutados

### Auditoría estática

```text
rg --files ...
rg -n "estados..." backend frontend prisma
rg -n "Commission|DeliveryDriver..." backend frontend prisma
```

Resultado: identificados dos schemas, estados inconsistentes y referencias legacy.

### Prisma

```text
npm run prisma:validate
DATABASE_URL=<url PostgreSQL ficticia> npm run prisma:validate
DATABASE_URL=<url PostgreSQL ficticia> npm run prisma:generate
```

Resultados:

- Primer intento sandbox: falló al intentar verificar el binario Prisma sin red.
- Segundo intento: confirmó el schema backend, pero falló correctamente porque no existe `DATABASE_URL` local.
- Ejecución final con URL PostgreSQL ficticia solo para configuración: schema válido y Prisma Client generado.
- No hubo conexión a base, migración, `db push` ni escritura de datos.

### Pruebas

```text
npm test
```

Resultados:

- Primer intento sandbox: `spawn EPERM` del test runner de Node.
- Ejecución autorizada fuera del sandbox: 5/5 pruebas aprobadas.

### Typecheck

```text
npm run typecheck
```

Resultados:

- Primera ejecución detectó que `NodeNext` no correspondía al toolchain esbuild/tsx y exigía extensiones `.js`.
- Se cambió únicamente `backend/tsconfig.json` a `module: ESNext` y `moduleResolution: Bundler`, manteniendo `strict: true`.
- Ejecución final: frontend y backend sin errores.

### Build

```text
npm run build
```

Resultado final:

- Frontend Vite: 1,742 módulos transformados, build exitoso.
- Backend esbuild: `server.js` generado, build exitoso.

No se ejecutó `npm audit fix`.

## 6. Riesgos actuales

### Alto

- Las rutas de transición operativa y administrativa comparten validación, pero todavía duplican efectos secundarios. La ruta admin no reutiliza aún un servicio transaccional único para métricas, historial y sockets.
- El campo `Order.status` sigue siendo `String`; la base no impone el conjunto canónico hasta una futura migración segura.
- Las operaciones de transición, historial y contadores aún no están agrupadas en una única transacción.

### Medio

- `prisma/dev.db` ahora está ignorado, pero si ya estaba tracked deberá retirarse del índice Git en una acción explícita posterior; no se ejecutó porque Git no está disponible y no se hacen commits automáticos.
- El schema SQLite legacy continúa en el repositorio renombrado. Debe confirmarse si contiene información necesaria antes de eliminarlo.
- `Commission` y `DeliveryDriver` permanecen en Prisma Client y pueden ser usados accidentalmente si no se mantiene la política de frozen en revisión de código.
- `COMPLETED` e `IN_TRANSIT` permanecen como aliases mientras existan datos legacy; mantenerlos indefinidamente aumenta complejidad.
- Las pruebas de ownership son unitarias; todavía se necesitan pruebas de integración contra PostgreSQL que demuestren el filtro tenant en cada endpoint.

### Bajo

- El frontend conserva la pantalla de repartidor y compatibilidad visual legacy. Está congelada, no eliminada.
- El schema canónico documenta estados en comentario, no en enum de base.

## 7. Cambios pendientes

No forman parte de Sprint 2:

1. Inventariar valores reales de `Order.status` en PostgreSQL.
2. Migrar aliases legacy a estados canónicos y posteriormente retirar compatibilidad.
3. Crear un servicio transaccional único de transición de pedido usado por restaurante, driver legacy y admin.
4. Añadir idempotencia/optimistic concurrency a cambios de estado.
5. Crear migraciones versionadas iniciales y pipeline `prisma migrate deploy`.
6. Añadir tests de integración con PostgreSQL efímero.
7. Retirar `dev.db` del índice Git si estuviera tracked.
8. Diseñar migración de `Commission` y `DeliveryDriver` antes de borrar tablas/rutas.
9. Convertir dinero de `Float` a Decimal/unidad mínima mediante migración revisada.
10. Continuar modularización solo después de cerrar los riesgos transaccionales anteriores.

## 8. Compatibilidad preservada

- No cambió ninguna URL pública o administrativa.
- No cambió el diseño ni la estructura visual.
- Pedidos nuevos conservan el mismo flujo visible.
- `IN_TRANSIT` continúa aceptado temporalmente, pero se persiste como `ON_THE_WAY` al avanzar.
- `COMPLETED` se muestra como entregado.
- Rutas y dashboard de repartidor continúan disponibles para datos existentes.
- No se borraron tablas, bases locales ni datos.

## 9. Veredicto

El núcleo cuenta ahora con una fuente Prisma inequívoca, reglas críticas comprobables y un vocabulario de pedido único. El proyecto está mejor preparado para modularizar, pero la siguiente prioridad técnica debe ser unificar la transición de pedidos en una transacción y añadir pruebas de integración multi-tenant antes de ampliar el producto.
