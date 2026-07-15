# Sprint 6 Report - Controles operativos para piloto

**Fecha:** 12 de julio de 2026  
**Rama:** `feat/payment-orchestration`  
**Estado:** implementación terminada y verificada; migración preparada pero no ejecutada

## Objetivo

Resolver los bloqueadores operativos P0/P1 identificados en `PILOT_READINESS_AUDIT.md` para que un restaurante pueda abrir, pausar, cerrar, recibir y atender pedidos con reglas consistentes. El documento de auditoría se usó como referencia y no fue modificado.

## Decisiones implementadas

### Estado operativo y horarios

- Se centralizaron `OPEN`, `PAUSED` y `CLOSED`.
- Un restaurante recibe pedidos únicamente si está aprobado, activo, listo, en estado `OPEN` y dentro de horario regular o con una apertura manual vigente.
- `manualOpenUntil` solo se acepta con `OPEN`, debe estar en el futuro y no puede superar 24 horas.
- Al vencer la apertura manual no se modifica `operationalStatus`; el resultado efectivo vuelve a depender del horario regular.
- `PAUSED` y `CLOSED` siempre bloquean pedidos, incluso si existe una fecha manual residual.
- Los horarios usan la zona configurada, con `America/Tijuana` como default, y soportan rangos que cruzan medianoche como `18:00-02:00`.
- El backend vuelve a validar disponibilidad al crear cada pedido; el frontend solo comunica el estado y no constituye la autoridad.

### Impacto obligatorio de la migración

La columna `Restaurant.operationalStatus` usa `DEFAULT 'CLOSED'`. Por ello, **todos los restaurantes existentes quedarán cerrados al aplicar la migración**.

Condiciones de despliegue:

1. No aplicar la migración en producción hasta confirmar que el dashboard desplegado contiene y permite usar el control de apertura.
2. Desplegar backend y frontend de forma coordinada.
3. Después del despliegue, cada restaurante o un administrador autorizado debe abrir explícitamente el negocio.
4. No ejecutar un backfill automático a `OPEN`.

### Operación de pedidos

- Aceptar un pedido exige elegir un estimado de 5 a 180 minutos y persiste `estimatedReadyAt`.
- Se agregaron notas del cliente con normalización y límite de 500 caracteres.
- El panel autorizado muestra nombre, teléfono, acceso a llamada/WhatsApp, dirección solo para delivery, notas, forma/estado de pago y estimado.
- La cancelación de restaurante y administrador usa un único servicio transaccional: transición, motivo, actor, timestamp, historial y evento seguro.
- Una cancelación repetida no duplica historial ni evento.
- Los pedidos pagados siguen requiriendo resolución manual y responden 409 en el flujo normal; no se implementaron reembolsos.
- `CUSTOMER_NO_SHOW` es terminal, solo aplica a pickup en `READY` y no incrementa métricas de venta.
- `CANCELLED` tampoco ejecuta contadores de venta; los contadores permanecen ligados exclusivamente a `DELIVERED`.

### Cancelación del cliente invitado

- La solicitud solo es posible mientras el pedido está `PENDING`.
- Un cliente autenticado debe ser propietario del pedido.
- Un invitado debe presentar el `trackingToken`; el UUID no autoriza por sí solo.
- La comparación del token usa longitud equivalente y `timingSafeEqual`.
- Los tracking tokens se generan con 32 bytes aleatorios y se ocultan de listados, dashboard y respuestas posteriores; se devuelven únicamente al crear el pedido para que el invitado pueda conservarlos.

### Alertas y conectividad

- Socket.IO emite únicamente `orderId`, `restaurantId` y `type`.
- El dashboard consulta el pedido completo mediante un endpoint autenticado y con ownership.
- No se envían nombres, teléfonos, dirección, notas, datos de pago o datos bancarios por Socket.IO.
- La alerta visual resalta pedidos nuevos y la sonora continúa mientras exista al menos un `PENDING`.
- La alerta se detiene al aceptar, cancelar o atender todos los pendientes.
- Si el navegador bloquea audio, el panel ofrece una acción explícita para activarlo.
- El panel muestra conectado, desconectado o sin internet; al reconectar vuelve a consultar la lista canónica.
- Las acciones usan actualización optimista en backend para rechazar conflictos y evitar dobles efectos.

## Migración preparada y no ejecutada

Archivo: `backend/prisma/migrations/20260712000300_sprint_6_operational_controls/migration.sql`.

La migración es aditiva: agrega las columnas aprobadas a `Restaurant` y `Order`; no contiene `UPDATE`, `DELETE`, `DROP`, backfill ni modificación de datos históricos. No se ejecutó `prisma migrate`, `prisma migrate deploy`, `db push` ni SQL contra una base.

## Archivos modificados

### Base de datos

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260712000300_sprint_6_operational_controls/migration.sql`

### Backend

- `backend/server.ts`
- `backend/src/routes.ts`
- `backend/src/adminRoutes.ts`
- `backend/src/core/order-events.ts`
- `backend/src/core/order-operations.ts`
- `backend/src/core/order-status.ts`
- `backend/src/core/payment-dtos.ts`
- `backend/src/core/restaurant-operational.ts`
- `backend/src/core/restaurant-readiness.ts`
- `backend/src/tests/regression.test.ts`

### Frontend

- `frontend/package.json`
- `frontend/src/components/RestaurantSettings.tsx`
- `frontend/src/pages/Cart.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/OrderTracking.tsx`
- `frontend/src/pages/RestaurantDashboard.tsx`
- `frontend/src/pages/RestaurantDetail.tsx`
- `frontend/src/utils/order-operations.ts`
- `frontend/src/tests/order-operations.test.ts`

### Documentación

- `CHANGELOG.md`
- `ARCHITECTURE.md`
- `VISION.md`
- `SPRINT_6_REPORT.md`
- `PILOT_READINESS_AUDIT.md` se incluyó como referencia y no se modificó.

## Pruebas agregadas

- Horario normal.
- Horario nocturno con continuidad al día siguiente.
- Día cerrado.
- Interpretación en `America/Tijuana` y contraste con otra zona.
- Apertura manual vigente, vencida, fuera de rango y bloqueada para PAUSED/CLOSED.
- Ownership al cambiar estado operativo.
- Validación de notas y estimado.
- Solicitud de cancelación invitada con token seguro y estado PENDING.
- Cancelación transaccional, auditoría única y evento sin datos sensibles.
- Rechazo de cancelación normal para pedidos pagados.
- `CUSTOMER_NO_SHOW` terminal y distinto de una venta entregada.
- Payload Socket.IO limitado a tres campos.
- Reconexión sin duplicar pedidos y continuidad/parada de la alerta según pendientes.

## Comandos ejecutados y resultados

- `npm test`: correcto; 25 pruebas backend y 3 frontend, 28/28 aprobadas.
- `npm run typecheck`: correcto en frontend y backend.
- `npm run build`: correcto; Vite compiló 1,824 módulos y esbuild generó el bundle backend.
- `npm run prisma:validate`: correcto usando una `DATABASE_URL` local ficticia solo para satisfacer el parser; no hubo conexión ni migración.
- `npm run prisma:generate`: correcto; Prisma Client 5.22.0 generado desde `backend/prisma/schema.prisma`.
- `git diff --check`: sin errores de whitespace; solo avisos de normalización LF/CRLF.

## Riesgos y pendientes

- La migración cierra todos los restaurantes existentes: el gate de despliegue coordinado es obligatorio.
- El sonido requiere una interacción del usuario por políticas del navegador; el panel no puede eludir esa restricción.
- No existe operación offline: al perder internet el panel advierte y sincroniza al volver, pero no puede garantizar pedidos durante la desconexión.
- Los estados y motivos permanecen como strings en PostgreSQL por compatibilidad; la lista canónica vive en backend y debe seguir siendo la autoridad.
- Los pedidos históricos conservan `null` en las columnas nuevas; no se infieren notas, estimados, modalidad ni motivos.
- La migración aún debe revisarse y aprobarse dentro del procedimiento de release antes de ejecutarse.

## Fuera de alcance respetado

No se agregó IA, lealtad, cupones, marketplace, pasarela de pagos, reembolsos, zonas avanzadas, mapas ni nueva infraestructura. No se ejecutaron migraciones, no se hizo deploy y no se creó commit.