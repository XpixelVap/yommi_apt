# Sprint 4 Report — Orquestación de métodos de pago

Fecha: 12 de julio de 2026
Rama: `feat/payment-orchestration`

## Resultado ejecutivo

Yommi ahora coordina métodos y estados de pago sin procesar ni recibir dinero. El restaurante configura sus opciones, confirma transferencias y registra el cobro de efectivo/pickup. Las reglas de pago protegen la máquina de estados del pedido y los datos bancarios quedan fuera de superficies públicas generales.

## Principio obligatorio

> Yommi no procesa pagos. Yommi coordina el proceso de venta. El restaurante conserva el control de sus cobros.

Una confirmación representa una declaración del restaurante, no validación bancaria. No se implementaron pasarelas, tarjetas, cobros automáticos, conciliación ni reembolsos.

## Migración propuesta y no ejecutada

Archivo: `backend/prisma/migrations/20260712000200_sprint_4_payment_orchestration/migration.sql`.

La migración añade únicamente:

- Flags y datos opcionales de transferencia en `Restaurant`.
- Método, estado y auditoría de confirmación nullable en `Order`.

No reescribe datos históricos. `paymentMethod` y `paymentStatus` históricos permanecen null. No se ejecutaron `prisma migrate` ni `db push`.

## Decisiones técnicas

- Valores canónicos y reglas centralizados en `payment-orchestration.ts`, sin enums Prisma.
- Defaults compatibles: pago al recoger y efectivo activos; transferencia desactivada.
- Nuevos pedidos siempre persisten método y estado canónicos.
- Adaptador temporal: un cliente antiguo sin `paymentMethod` usa pago en restaurante para pickup; delivery prefiere efectivo habilitado y, si no existe, transferencia válida.
- Transferencia sin confirmar bloquea `PREPARING`.
- Efectivo y pickup pendientes sí pueden prepararse.
- Todo `DELIVERED` exige `PAID`.
- Cobro y entrega de efectivo/pickup se actualizan en una sola transacción.
- La confirmación repetida retorna el estado existente y no duplica auditoría, logs ni eventos.
- Cancelar pago confirmado devuelve 409; no existen reembolsos automáticos.
- El paso `READY -> DELIVERED` queda permitido para entrega pickup; delivery conserva `READY -> ON_THE_WAY -> DELIVERED`.

## Privacidad y seguridad

- DTOs explícitos eliminan campos bancarios y password de restaurantes públicos.
- Pedidos no-transferencia nunca incluyen instrucciones bancarias.
- Listados, búsquedas, métricas, logs y WebSockets no contienen datos bancarios.
- Configuración administrativa enmascara cuenta/CLABE y no permite sobrescribirla desde esa pantalla.
- La cuenta completa se revela al propietario al editar o al cliente dentro de un pedido de transferencia autorizado.
- Tracking requiere sesión propietaria/admin o `trackingToken` del pedido.
- Solo propietario del restaurante o administrador puede confirmar; clientes y otros restaurantes son rechazados.

## Archivos modificados o creados

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260712000200_sprint_4_payment_orchestration/migration.sql`
- `backend/src/core/payment-orchestration.ts`
- `backend/src/core/payment-dtos.ts`
- `backend/src/core/order-status.ts`
- `backend/src/routes.ts`
- `backend/src/adminRoutes.ts`
- `backend/src/tests/regression.test.ts`
- `frontend/src/components/RestaurantSettings.tsx`
- `frontend/src/pages/Cart.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/OrderTracking.tsx`
- `frontend/src/pages/RestaurantDashboard.tsx`
- `VISION.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `SPRINT_4_REPORT.md`

## Pruebas cubiertas

- Pickup solo permite pago en restaurante.
- Delivery permite efectivo habilitado.
- Delivery permite transferencia habilitada y configurada.
- Métodos no habilitados se rechazan.
- Transferencia bloquea preparación sin confirmar.
- Efectivo/pickup pendiente permite preparación.
- Entrega exige pago confirmado.
- Propietario/admin puede confirmar; cliente u otro restaurante no.
- Confirmación repetida es idempotente y preserva auditoría original.
- Datos bancarios no aparecen en DTO público ni pedidos de efectivo.
- Históricos null permanecen `LEGACY_UNKNOWN` y no pueden confirmarse automáticamente.
- Pago confirmado no puede cancelarse por flujo normal.

## Riesgos y pendientes

- La migración debe revisarse y aplicarse antes de desplegar este código.
- Frontend y backend deben desplegarse coordinadamente; retirar el adaptador legacy cuando no existan clientes anteriores.
- El `trackingToken` existente es una capacidad de acceso y debe mantenerse secreto.
- `paymentConfirmedById/Role` es auditoría polimórfica temporal sin foreign key; una futura consolidación de identidad debe normalizarla.
- Se recomiendan pruebas HTTP/DB con PostgreSQL efímero para validar transacciones y carreras concurrentes.

## Comandos y resultados

- `npm run prisma:generate`: correcto; Prisma Client 5.22.0 generado desde el schema canónico.
- `npm run prisma:validate`: correcto; schema PostgreSQL válido.
- `npm test`: correcto; 1 prueba frontend y 16 backend, 17/17 exitosas.
- `npm run typecheck`: correcto en frontend y backend.
- `npm run build`: correcto; Vite compiló 1,743 módulos y esbuild generó el bundle backend.
- `git diff --check`: correcto, sin errores de whitespace.

Los bundles `frontend/dist` y `backend/server.js` son artefactos ignorados y no forman parte del código fuente del sprint.

No se creó commit ni se hizo push de Sprint 4.