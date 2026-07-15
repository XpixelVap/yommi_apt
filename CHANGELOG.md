# Changelog


## Sprint 6 - Controles operativos para piloto - 2026-07-12

### Apertura y horarios

- Se centralizaron los estados `OPEN`, `PAUSED` y `CLOSED`, con auditoría de actor y timestamp.
- La recepción de pedidos exige aprobación, activación, readiness, estado OPEN y horario regular o apertura manual vigente.
- Los horarios soportan rangos nocturnos como `18:00-02:00`, días cerrados y zonas IANA; el default es `America/Tijuana`.
- La apertura manual solo funciona con OPEN, debe vencer dentro de las siguientes 24 horas y no altera el estado al expirar.
- El dashboard permite abrir por horario, abrir temporalmente, pausar y cerrar; las vistas públicas muestran el estado efectivo y el backend bloquea pedidos fuera de operación.

### Pedidos y atención

- Se añadieron notas del cliente, contacto autorizado y estimado obligatorio al aceptar.
- Se creó una cancelación transaccional compartida por restaurante y administración con motivo, actor, fecha, historial, idempotencia y evento seguro.
- La solicitud de cancelación invitada requiere tracking token seguro y pedido PENDING; el UUID no autoriza.
- `CUSTOMER_NO_SHOW` es terminal para pickup READY y, al igual que CANCELLED, no incrementa ventas.
- Los tracking tokens se ocultan de listados y respuestas posteriores; solo se entregan al crear el pedido invitado.

### Alertas y privacidad

- Socket.IO dejó de aceptar comandos de estado o ubicación y emite únicamente `orderId`, `restaurantId` y `type`.
- El dashboard obtiene el detalle mediante endpoint autorizado, alerta mientras existan pedidos PENDING y resincroniza al reconectar.
- Los eventos no contienen datos personales, dirección, notas, pago ni información bancaria.

### Prisma y despliegue

- Se preparó la migración aditiva `20260712000300_sprint_6_operational_controls`; no fue ejecutada.
- `operationalStatus` usa default CLOSED: todos los restaurantes existentes quedarán cerrados al aplicar la migración.
- No debe aplicarse en producción hasta confirmar el control de apertura y coordinar backend/frontend. No se realizará backfill automático a OPEN.

### Calidad

- 28/28 pruebas aprobadas, typecheck y build correctos en ambos workspaces.
- Prisma validate y generate correctos contra el schema PostgreSQL canónico.
- No se ejecutó migrate, migrate deploy ni db push; no se hizo commit.

Todos los cambios relevantes de Yommi 2.0 se documentarán en este archivo.

## Sprint 2 - Consolidación del núcleo técnico - 2026-07-11

### Prisma y base de datos

- Se definió `backend/prisma/schema.prisma` como única fuente canónica PostgreSQL.
- Los scripts raíz y backend de `generate` y `validate` declaran el schema canónico explícitamente.
- El postinstall genera Prisma únicamente desde el workspace backend.
- El schema SQLite raíz se conservó sin pérdida y se renombró a `prisma/schema.sqlite.legacy.prisma`, evitando su autodetección accidental.
- Se documentaron las carpetas Prisma canónica y legacy.
- Se agregaron `*.db`, journals y variantes SQLite a `.gitignore`; `prisma/dev.db` no fue borrado.
- No se ejecutó ninguna migración ni `db push`.

### Estados de pedido

- Se creó `backend/src/core/order-status.ts` con los estados canónicos y la matriz de transiciones permitidas.
- El flujo canónico es `PENDING -> ACCEPTED -> PREPARING -> READY -> ON_THE_WAY -> DELIVERED`, con cancelación solo antes de entrega.
- `IN_TRANSIT` se acepta temporalmente como alias legacy de `ON_THE_WAY`; `COMPLETED` se interpreta como `DELIVERED` para lectura/compatibilidad.
- Las rutas operativa y administrativa rechazan transiciones arbitrarias, regresivas o desde estados terminales con HTTP 409.
- El frontend envía `ON_THE_WAY` y sigue representando datos legacy `IN_TRANSIT`/`COMPLETED` sin cambios de diseño.

### Reglas críticas reutilizables

- Se extrajo el schema de roles públicos y la resolución segura del rol de registro.
- Se extrajo el cálculo de pedidos con precios exclusivos de base de datos.
- Se extrajo la comprobación común de ownership por restaurante y se conectó a categorías/productos.
- Se añadieron pruebas unitarias de regresión para roles públicos, pricing, ownership y transiciones.

### Comisión y repartidores

- `Commission` y `DeliveryDriver` quedaron marcados como `LEGACY/FROZEN` en el schema canónico.
- Se conservaron tablas, relaciones, rutas y pantallas por compatibilidad.
- No se añadieron reglas de comisión ni flota Yommi; la ruta admin de drivers quedó documentada como compatibilidad legacy.

### Calidad

- Se añadieron scripts raíz/workspace para `test`, `typecheck`, `prisma:validate` y `prisma:generate`.
- Se creó `backend/tsconfig.json` estricto, alineado con TypeScript + esbuild/tsx.
- Prisma validate y generate finalizaron correctamente contra el schema PostgreSQL canónico.
- Las 5 pruebas de regresión pasaron.
- Typecheck de frontend y backend pasó sin errores.
- Build de frontend y backend pasó sin errores.
- No se ejecutó `npm audit fix`.
## Verificación de dependencias y compilación - 2026-07-11

### Dependencias

- Se ejecutó `npm install` en la raíz del monorepo y se generó Prisma Client 5.22.0.
- Se añadieron `@google/genai` 2.11.0 y `google-auth-library` 10.9.0 a las dependencias runtime de `backend/package.json` porque el backend ya las importaba, pero el manifiesto no las declaraba.
- Se actualizó `package-lock.json` con el árbol instalado.
- La instalación final reportó 12 vulnerabilidades: 1 baja, 7 moderadas y 4 altas. No se ejecutó `npm audit fix` para evitar actualizaciones automáticas o breaking changes fuera del alcance.

### Compilación

- Se ejecutó `npm run build` para ambos workspaces.
- Frontend: Vite 6.4.1 compiló correctamente 1,742 módulos y generó `frontend/dist`.
- Backend: esbuild 0.27.4 compiló correctamente y generó `backend/server.js`.
- No fue necesario modificar código fuente, interfaz ni diseño para resolver errores de compilación.
- El primer intento de Vite falló con `spawn EPERM` por las restricciones del sandbox de Windows; al ejecutar el mismo build con permiso para iniciar el proceso auxiliar de esbuild, finalizó correctamente.

### Archivos afectados

- `backend/package.json`: declaración de las dos dependencias runtime ya utilizadas por el código.
- `package-lock.json`: actualización reproducible del árbol de dependencias.
- `frontend/dist/*`: artefactos generados por el build de frontend.
- `backend/server.js`: artefacto generado por el build de backend.
- `CHANGELOG.md`: documentación de instalación y compilación.
## Sprint 1 - Correcciones críticas P0 - 2026-07-11

### Seguridad de registro público

- El esquema de `POST /api/auth/register` ahora solo acepta los roles `CLIENT` y `RESTAURANT`.
- Se eliminó del registro público la creación de cuentas `DRIVER`.
- Se eliminó la posibilidad de solicitar o persistir el rol `ADMIN` desde el payload público.
- Las cuentas de usuario creadas por la rama pública no-restaurante persisten explícitamente el rol `CLIENT`, aunque el cliente intente alterar el cuerpo de la solicitud.
- Se corrigió el manejo de errores Zod para que un rol rechazado produzca una respuesta `400` en vez de provocar un error interno.

### Seguridad de JWT

- Se eliminó el valor por defecto conocido de `JWT_SECRET` en las rutas generales y administrativas.
- El backend carga la configuración de entorno antes de inicializar los módulos de autenticación.
- El proceso ahora falla al iniciar con un mensaje explícito cuando `JWT_SECRET` no está configurado.
- La misma política se aplica tanto a la emisión/verificación general de tokens como al middleware administrativo.
- `.env.example` ya no sugiere la clave conocida de desarrollo y exige reemplazarla por un secreto aleatorio.

### Integridad de pedidos

- `POST /api/orders` ya no consume ni persiste `totalAmount` ni precios enviados por el frontend.
- El backend valida con Zod que exista al menos un item, que cada `productId` sea válido y que cada cantidad sea un entero positivo.
- Los productos se consultan en Prisma antes de crear el pedido.
- Se rechaza el pedido si un producto no existe, no está disponible o pertenece a otro restaurante.
- El precio unitario persistido en cada `OrderItem` proviene de la base de datos.
- El total del pedido se calcula en el backend con los precios vigentes y las cantidades validadas, redondeado a dos decimales.
- El contrato de respuesta y la interfaz existente permanecen sin cambios.

### Ownership de categorías y productos

- La actualización de categorías valida que la categoría pertenezca al restaurante autenticado.
- La creación de productos valida que la categoría destino pertenezca al mismo restaurante.
- La actualización de productos valida primero el ownership del producto.
- Si se mueve un producto de categoría, también se valida el ownership de la categoría destino.
- Las validaciones de borrado existentes se conservaron y fueron revisadas.

### Endpoints con riesgo de escalación

- `GET /api/orders` ahora falla de forma cerrada para roles no soportados.
- Si el JWT declara un restaurante o repartidor que no tiene entidad asociada, el endpoint devuelve `403` en lugar de ejecutar una consulta sin filtro.
- Las consultas de pedidos de cliente, restaurante y repartidor mantienen su comportamiento autorizado actual.

### Archivos modificados

- `backend/src/routes.ts`: registro público, validación JWT, ownership de catálogo, integridad de pedidos y autorización fail-closed.
- `backend/src/adminRoutes.ts`: eliminación del secreto JWT por defecto y validación obligatoria de configuración.
- `.env.example`: reemplazo del ejemplo de secreto JWT inseguro.
- `CHANGELOG.md`: documentación de las correcciones del Sprint 1.

### Fuera de alcance y sin cambios

- No se modificó el frontend, la interfaz ni el diseño.
- No se agregaron funcionalidades nuevas.
- No se modificaron esquemas Prisma, base de datos, seeds, uploads, WebSockets, tracking ni integración de IA.
- No se creó ningún commit.

### Verificación

- Se realizaron comprobaciones estáticas sobre roles públicos, referencias a secretos por defecto, cálculo de totales, precios de items y ownership.
- Posteriormente se instalaron las dependencias por solicitud expresa y el build completo de frontend y backend finalizó correctamente; véase la sección de verificación de dependencias y compilación.
- La inconsistencia de `@google/genai` y `google-auth-library` quedó corregida posteriormente durante la instalación y verificación de compilación solicitada.
## Sprint 3 - Activación segura del restaurante - 2026-07-12

### Acceso, readiness y publicación

- Los restaurantes pendientes reciben sesión válida y pueden acceder únicamente a perfil, menú y estado de readiness; no pueden consultar ni operar pedidos.
- Se centralizó el readiness con seis requisitos: nombre, contacto, ubicación, horarios, modalidad y menú mínimo disponible.
- Se agregó `GET /api/restaurant/readiness` con checklist, porcentaje, bloqueadores y capacidad operativa.
- Las rutas públicas de restaurantes, directorio, slug, id y tendencias filtran por aprobación, actividad y readiness; los perfiles no aptos fallan cerrado.
- El alta propia crea su entrada de directorio como `PENDING`, evitando exposición indirecta como negocio no reclamado.
- La aprobación administrativa rechaza con HTTP 409 cualquier restaurante incompleto.

### Registro, menú y funnel

- El registro de restaurante crea la cuenta y sesión antes de intentar el logo; un fallo de imagen no revierte ni oculta el alta terminada.
- El CRUD de categorías y productos valida payload, precio positivo, disponibilidad y ownership, y propaga errores del backend en la interfaz existente.
- Se agregaron logs JSON estructurados para registro, primer login, perfil mínimo, primer producto, readiness, aprobación y primer pedido, con clave de deduplicación para el consumidor de logs.

### Pedidos pickup/delivery

- Los pedidos nuevos exigen `PICKUP` o `DELIVERY`; el cliente solo envía producto y cantidad, nunca precio, total ni tarifa.
- Pickup fuerza tarifa cero. Delivery usa exclusivamente `Restaurant.deliveryFeeCents` y valida que la modalidad esté habilitada.
- El backend calcula subtotal más tarifa y persiste modalidad y tarifa aplicada.
- La lectura histórica conserva `fulfillmentType = null` como `LEGACY/UNKNOWN`, sin inferir modalidad.

### Prisma y calidad

- Se creó una migración SQL aditiva no destructiva para `Restaurant.deliveryFeeCents`, `Order.deliveryFeeCents` y `Order.fulfillmentType` nullable.
- La migración no fue ejecutada y no se modificaron datos históricos.
- Prisma generate y validate finalizaron correctamente; 9 pruebas pasaron; typecheck y build de frontend/backend pasaron.
- No se ejecutaron `prisma migrate`, `db push`, migraciones destructivas, cambios de dependencias ni commits.
## Sprint 4 - Orquestación de métodos de pago - 2026-07-12

### Principio de producto

- Yommi coordina el proceso de venta, pero no procesa, recibe, retiene, valida ni concilia dinero.
- Se mantuvo la separación entre cobros restaurante-cliente y facturación de la mensualidad SaaS.

### Configuración y privacidad

- El restaurante puede configurar pago al recoger, efectivo contra entrega y transferencia bancaria anticipada.
- Transferencia exige banco, titular, cuenta/CLABE y teléfono de confirmación.
- Se añadieron DTOs explícitos que eliminan contraseña y datos bancarios de respuestas públicas, listados, búsquedas, WebSockets y pedidos no-transferencia.
- Administradores reciben la referencia bancaria enmascarada; solo el propietario puede editarla completa.
- El tracking específico exige sesión autorizada o token de seguimiento antes de entregar instrucciones bancarias.

### Reglas operativas

- Pickup solo admite `PAY_AT_RESTAURANT`; delivery admite efectivo/transferencia según configuración.
- Transferencia comienza en `AWAITING_CONFIRMATION` y bloquea `PREPARING` hasta confirmación.
- Efectivo y pago al recoger comienzan en `PENDING` y pueden prepararse sin confirmación previa.
- Ningún pedido puede llegar a `DELIVERED` sin `PAID`.
- Se agregó confirmación idempotente y acción transaccional para cobrar y entregar efectivo/pickup.
- Cancelar un pedido no pagado cambia el pago a `CANCELLED`; pedidos pagados devuelven HTTP 409 y requieren resolución manual.
- Históricos conservan método/estado null y se leen como `LEGACY_UNKNOWN`.

### Migración y calidad

- Se creó una migración aditiva con configuración de restaurante y auditoría de pago en pedidos.
- No se ejecutaron `prisma migrate`, `db push`, migraciones destructivas, reembolsos ni integraciones de pasarela.
- Se ampliaron pruebas de pricing, métodos, ownership, privacidad, idempotencia, históricos y transiciones.
## Sprint 5 - Deployment Foundation - 2026-07-12

### Configuración y operación

- Se centralizó la validación backend con Zod; el proceso falla antes de escuchar tráfico si faltan `DATABASE_URL`, `JWT_SECRET`, `API_URL` o configuración productiva obligatoria.
- Se separaron ejemplos backend/frontend y se documentó que `VITE_*` siempre es información pública.
- El frontend valida `VITE_API_URL` con Zod durante arranque/build y falla temprano ante configuración inválida.
- HTTP y Socket.IO comparten una allowlist CORS; localhost se agrega únicamente en desarrollo.
- Se añadieron `GET /health` para liveness y `GET /ready` para readiness PostgreSQL sin exponer detalles internos.

### Desarrollo y migraciones

- Se añadió PostgreSQL 16 local mediante `docker-compose.yml`, volumen persistente y healthcheck.
- Se añadieron scripts raíz para desarrollo separado/conjunto, validación, Prisma y operación local de PostgreSQL.
- Se añadió una migración baseline generada desde el schema Sprint 2 para que bases nuevas puedan aplicar baseline -> Sprint 3 -> Sprint 4.
- Bases preexistentes requieren adopción manual y revisada del baseline; no se ejecutó `migrate`, `migrate deploy` ni `db push`.

### Storage, Docker y CI

- Los uploads consumen `FileStorage`; el adaptador local usa buffers procesados y queda limitado a desarrollo.
- Producción rechaza `STORAGE_DRIVER=local` y permanece en `disabled` hasta integrar almacenamiento de objetos.
- Se añadieron Dockerfiles multi-stage para backend y frontend/Nginx, `.dockerignore` y configuración SPA.
- Se añadió CI de GitHub para `npm ci`, tests, typecheck, build y Prisma validate/generate, sin deploy ni secretos externos.

### Calidad

- Prisma generate/validate, typecheck, 17 pruebas y build frontend/backend finalizaron correctamente.
- `docker compose config --quiet` validó el Compose.
- `/health` respondió 200 y `/ready` 503 de forma cerrada con PostgreSQL deliberadamente inaccesible.
- Dockerfiles no pudieron comprobarse con `docker build --check` porque Docker Desktop no estaba iniciado; su sintaxis fue revisada y queda pendiente validación con daemon.