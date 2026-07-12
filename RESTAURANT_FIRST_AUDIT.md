# Auditoría Restaurant-First de Yommi 2.0

**Fecha:** 11 de julio de 2026
**Alcance:** recorrido del restaurante desde registro hasta métricas básicas.
**Referencias:** `VISION.md`, `ARCHITECTURE.md`, `YOMMI_AUDIT.md`, `SPRINT_2_REPORT.md` y código actual.

## 1. Resumen ejecutivo

Yommi ya contiene registro, login, perfil, menú, aprobación, pedidos y operación, pero estas piezas no forman un recorrido continuo de activación.

El bloqueo principal es estructural: el registro crea un Restaurant `pending_verification`, no devuelve token y el login rechaza al restaurante pendiente. Hasta una aprobación administrativa externa, el dueño no puede entrar, configurar el negocio ni crear el menú. Sin SLA, consulta de estado o notificación, vender en menos de 15 minutos es imposible.

Otros bloqueadores:

- `Register.tsx` intenta subir el logo con `data.token`, pero el backend de registro restaurante devuelve solo `{message}`.
- `GET /api/restaurants/slug/:slug` no filtra `status/isActive` y fuerza `status: approved`; puede exponer pending/suspended por URL directa.
- No existe readiness, preview, URL visible ni acción de publicar. La aprobación puede hacer visible un restaurante vacío.
- Pickup/delivery se configuran, pero checkout siempre exige dirección y muestra un costo fijo de envío no incluido por backend.
- No existe dashboard de métricas del restaurante ni instrumentación del onboarding.

La prioridad es crear una sesión privada inmediata, separar configuración/moderación/publicación y definir un checklist mínimo. No se necesita rediseño visual ni funciones fuera del MVP.

## 2. Mapa del recorrido actual

| Etapa | Pantalla | Endpoint/estado | Resultado real |
|---|---|---|---|
| Registro | `/register`, `Register.tsx` | `POST /api/auth/register` | Crea Restaurant + Directory pending, sin sesión |
| Espera | Mensaje y redirect de 5 s | Sin endpoint de estado | Envía al usuario a login |
| Login pending | `/login` | `POST /api/auth/login` -> 403 | No puede configurar ni crear menú |
| Aprobación | AdminDashboard | `PATCH /api/admin/restaurants/:id/approve` | approved/isActive; match de Directory por nombre |
| Login aprobado | `/login` | JWT role RESTAURANT | Navega a `/dashboard` |
| Inicio dashboard | Pedidos | `GET /api/restaurant/orders` | Pantalla vacía sin guía |
| Configuración | `RestaurantSettings` | GET/PUT profile + uploads | Edita perfil/horarios; sin readiness |
| Menú | `MenuManager` | CRUD categorías/productos | Creación manual, uno por uno |
| Publicación | Sin pantalla/acción | Depende de approved + isActive | Implícita; puede publicar vacío |
| Descubrimiento | Home/Directory/`/r/:slug` | Endpoints públicos | Reglas inconsistentes por slug |
| Primer pedido | Detail -> Cart | `POST /api/orders` | Crea pedido y después abre WhatsApp |
| Recepción | RestaurantDashboard | Socket global + GET orders | Refetch ante eventos globales |
| Gestión | Tarjeta de pedido | PATCH status | Estados secuenciales; fallos sin feedback |
| Métricas | Pedidos/historial | Sin endpoint de stats propio | Solo conteo activo y 5 recientes |

```text
Registro -> pending sin token -> login 403 -> aprobación manual
-> login -> pedidos vacíos -> configuración -> categoría -> productos
-> visibilidad implícita -> pedido -> operación -> sin métricas
```

## 3. Pantallas y endpoints involucrados

### Identidad

| Archivo | Ruta UI | Endpoint | Hallazgo |
|---|---|---|---|
| `Register.tsx` | `/register` | `POST /api/auth/register` | Formulario cliente/restaurante; contrato asimétrico |
| `Login.tsx` | `/login` | `POST /api/auth/login` | Pending/rejected/suspended reciben 403 |
| `App.tsx` | `/dashboard` | `GET /api/auth/me` | Selecciona dashboard por role |
| `store.ts` | global | — | Token y usuario en localStorage |

Google login siempre crea CLIENT. No hay recuperación de contraseña, verificación de email ni consulta de solicitud. `/auth/me` retorna la entidad Restaurant mediante spread y puede exponer `password_hash`.

### Configuración

- `RestaurantSettings.tsx`
- `GET/PUT /api/restaurant/profile`
- `POST /api/upload/restaurant`
- `POST /api/upload/restaurant/cover`

Gestiona nombre, teléfono, descripción, dirección, ciudad, imágenes y horarios. Repite datos del registro, asume horarios default sin confirmación, hace `JSON.parse(opening_hours)` sin fallback local y no muestra modalidad, publicación, readiness o URL pública.

### Menú

- `MenuManager.tsx`
- `GET /api/restaurant/menu`
- CRUD `/api/restaurant/categories`
- CRUD `/api/restaurant/products`
- `POST /api/upload/menu`

Nombre/precio son mínimos; descripción/imagen son opcionales. Crear o editar no comprueba `res.ok`: puede cerrar el modal y aparentar éxito ante un 4xx/5xx. No hay menú mínimo, preview o progreso.

### Publicación

| Endpoint | Regla |
|---|---|
| `GET /api/restaurants` | approved + isActive |
| `GET /api/directory` | registrados approved + isActive |
| `GET /api/restaurants/:id` | approved + isActive |
| `GET /api/restaurants/slug/:slug` | sin filtro; fuerza approved |
| `PATCH /api/admin/restaurants/:id/approve` | activa y aprueba |

`status` e `isActive` mezclan moderación, publicación y disponibilidad. El restaurante no puede ver/controlar su publicación ni conoce su URL. Slugs por nombre pueden colisionar.

### Pedido y operación

- `RestaurantDetail.tsx` carga `/r/:slug`.
- `Cart.tsx` crea `POST /api/orders`.
- `RestaurantDashboard.tsx` consume `GET /api/restaurant/orders`.
- Estados cambian con `PATCH /api/orders/:id/status`.
- Cliente sigue `GET /api/orders/:id/tracking`.

El checkout exige entrega aun si hay pickup, suma `$2.50` que backend no persiste y llama “Pedir por WhatsApp” a un flujo que ya creó el pedido. El socket `newOrder` es global; como el user restaurante no incluye `restaurantId`, normalmente se hace refetch ante cada pedido global.

### Métricas

La UI muestra pedidos activos y cinco pedidos pasados. No existe endpoint/vista para pedidos de hoy, completados, cancelados, ventas directas, ticket promedio, clientes únicos, tiempos operativos o funnel. `/api/admin/stats` es global y no sirve al restaurante.

## 4. Fricciones y pasos redundantes

### Registro/login

- Se debe cambiar manualmente tipo de cuenta desde CLIENT.
- Se piden dueño, teléfono, ciudad, categoría, dirección, Instagram, logo, modalidad, email y contraseña de una vez.
- No hay progreso, guardado parcial ni duración estimada.
- Se puede registrar sin pickup ni delivery.
- Logo se ofrece en una etapa donde no existe token.
- El mensaje no da SLA ni canal de aprobación.
- La redirección lleva a un login que responderá 403.
- Google login visible no crea restaurante.

### Configuración/menú

- Datos de registro se recapturan.
- Horarios se escriben como strings con formato técnico.
- Imágenes reciben prioridad aunque no son necesarias para vender.
- Dashboard abre Pedidos vacío en vez de la siguiente tarea.
- Categoría y producto son pasos separados; cada producto requiere modal.
- Los errores de create/update pueden parecer éxito.
- No hay definición de “listo para publicar”.

### Publicación/pedido

- Aprobación y publicación son el mismo efecto.
- Se puede aprobar sin menú, horario o modalidad operable.
- No hay link “Ver mi restaurante”.
- Pickup configurado no existe en checkout.
- El total visual y backend difieren.
- WhatsApp parece una segunda confirmación obligatoria.
- Transiciones fallidas no muestran error.

## 5. Datos obligatorios que podrían posponerse

### Para crear cuenta

- Obligatorios: nombre del negocio, email, contraseña y teléfono de contacto.
- El nombre del responsable puede completarse antes de publicar si soporte no lo requiere al crear cuenta.

### Antes de publicar

- Ciudad.
- Al menos una modalidad: pickup o delivery propio.
- Dirección/zona según modalidad.
- Horarios confirmados.
- Una categoría.
- Tres productos disponibles con nombre y precio positivo.
- Confirmación de aceptar pedidos.

### Después de publicar

- Instagram.
- Logo y portada.
- Descripción extensa.
- Imágenes de producto.
- Coordenadas exactas sin uso geográfico.
- Opciones avanzadas y contenido promocional.

No pedir en MVP: repartidor/vehículo, comisión, IA, WhatsApp automatizado, lealtad, cupones, QR, fiscalidad o pagos.
## 6. Problemas de permisos, estados y navegación

### P0

1. **Bypass por slug:** devuelve pending/suspended como approved. Debe usar la misma política pública que ID/listados.
2. **DTO sensible:** `/auth/me` y profile devuelven entidad completa; `password_hash` no debe llegar al navegador.
3. **Pending sin sesión:** impide cualquier onboarding privado.
4. **Upload imposible:** registro usa un token que el contrato no devuelve.
5. **Estados mezclados:** `pending_verification`, approved e `isActive` no distinguen borrador, moderación y publicación.
6. **Directory ambiguo:** aprobación empareja por nombre, no por relación única.

### P1

- `/dashboard` abre Pedidos aunque el negocio no esté activado.
- No existe ruta de onboarding/estado, checklist, preview o URL.
- Login ofrece Google al restaurante aunque produce CLIENT.
- CRUD menú no conserva formulario/explica error.
- Socket recibe eventos globales y refetch innecesario.
- Checkout no respeta modalidad.
- UI solo permite cancelar PENDING, aunque backend permite hasta READY.

## 7. Riesgos para publicar o recibir el primer pedido

| Riesgo | Probabilidad | Impacto | Severidad |
|---|---:|---:|---|
| Aprobación manual bloquea dashboard | Alta | Crítico | P0 |
| Registro no devuelve token | Cierta | Alto | P0 |
| Slug expone pending/suspended | Alta con URL | Crítico | P0 |
| Aprobación publica menú vacío | Alta | Alto | P0 |
| DTO expone password hash | Alta al autenticarse | Crítico | P0 |
| Sin URL/preview/readiness | Alta | Alto | P1 |
| CRUD menú trata error como éxito | Media | Alto | P1 |
| Slug colisiona por nombre | Media | Alto | P1 |
| Ninguna modalidad seleccionada | Media | Alto | P1 |
| Pickup exige dirección de delivery | Alta | Alto | P1 |
| Envío visual no coincide con total | Alta | Alto | P1 |
| Horario inválido rompe carga | Media | Medio | P1 |
| Socket global degrada recepción | Media | Medio | P1 |
| Sin métricas de funnel | Cierta | Alto para producto | P1 |

## 8. Onboarding para vender en menos de 15 minutos

### Decisión de producto necesaria

Acceso privado, readiness, moderación y publicación deben ser conceptos separados. El dueño debe entrar inmediatamente aunque esté pending.

Para prometer publicación real en menos de 15 minutos se requiere aprobación automática de bajo riesgo o moderación posterior. Si la aprobación humana sigue siendo previa, la promesa honesta es “listo para revisión en menos de 15 minutos”, no “vendiendo”.

### Paso 1 — Crear acceso (2 min)

Pedir nombre del negocio, email, contraseña y teléfono. Crear Restaurant pending, devolver JWT + DTO seguro y abrir onboarding privado. Nada público todavía. Posponer logo, portada, Instagram y descripción.

### Paso 2 — Modalidad y ubicación (2 min)

Elegir pickup, delivery propio o ambos; al menos uno obligatorio. Pedir ciudad y dirección/zona solo cuando aplique. No mostrar un costo de envío inventado.

### Paso 3 — Menú mínimo (7 min)

Crear categoría inicial y tres productos consecutivos. Solo nombre y precio obligatorios; descripción e imagen opcionales. Disponibilidad activa por defecto con indicación clara.

```text
Categoría: lista
Productos disponibles: 3/3
```

### Paso 4 — Horarios y revisión (2 min)

Ofrecer defaults explícitos para confirmar, no asumir. Mostrar resumen y preview privado.

### Paso 5 — Publicar/enviar a revisión (1 min)

Comprobar identidad/contacto, modalidad, horarios y menú mínimo. Mostrar estado y URL estable. La acción será “Publicar” o “Enviar a revisión” según la política elegida.

| Paso | p50 objetivo | Límite p90 |
|---|---:|---:|
| Acceso | 2 min | 3 min |
| Modalidad | 2 min | 3 min |
| Menú | 7 min | 8 min |
| Horarios/revisión | 2 min | 3 min |
| Acción final | 1 min | 1 min |
| **Total** | **14 min** | **18 min** |

## 9. Checklist de activación

### Cuenta

- [ ] Email único y contraseña válida.
- [ ] Sesión de restaurante creada.
- [ ] Teléfono operativo.
- [ ] Estado de moderación visible.

### Negocio

- [ ] Nombre y ciudad confirmados.
- [ ] Pickup/delivery propio seleccionado.
- [ ] Dirección/zona requerida completada.
- [ ] Horarios válidos y confirmados.

### Menú

- [ ] Una categoría.
- [ ] Tres productos disponibles.
- [ ] Nombre y precio positivo en cada producto.
- [ ] Ownership correcto y API recuperable.

### Publicación

- [ ] Readiness completo.
- [ ] Moderación satisfecha.
- [ ] Estado/publicación coherentes.
- [ ] URL pública única.
- [ ] Slug aplica política de visibilidad.
- [ ] Preview accesible al dueño.

### Primer pedido

- [ ] Modalidad coincide con checkout.
- [ ] Total UI coincide con backend.
- [ ] Pedido de prueba se crea.
- [ ] Solo el restaurante propietario lo recibe.
- [ ] Estados se completan y cliente ve tracking.

## 10. Métricas

### Tiempo hasta publicar menú

```text
time_to_publish = publishedAt - onboardingStartedAt
```

Medir p50/p75/p90 y separar tiempo activo del usuario de espera administrativa. Complementos: primera categoría, primer producto, tercer producto, ready-for-review y published.

### Tiempo hasta primer pedido

```text
time_to_first_order = firstValidOrder.createdAt - publishedAt
```

Medir primer pedido creado, aceptado y completado; restaurantes sin pedido a 1/3/7 días. Excluir pedidos de prueba de la métrica comercial.

### Abandono por paso

Eventos mínimos:

- `restaurant_registration_started/completed`
- `onboarding_fulfillment_started/completed`
- `onboarding_menu_started`
- `onboarding_first_category_created`
- `onboarding_first_product_created`
- `onboarding_menu_minimum_reached`
- `onboarding_hours_completed`
- `restaurant_ready_for_review`
- `restaurant_published`
- `restaurant_first_order_created/accepted/completed`

```text
dropoff_rate = 1 - completed_step / started_step
```

Ventanas: sesión, 24 horas y 7 días.

### Errores de onboarding

Registrar paso, endpoint, código estable, status HTTP, timestamp, correlation ID, dispositivo, reintento y recuperación. No registrar contraseñas, tokens, bodies completos o PII innecesaria.

KPIs: error por paso, top códigos, recuperación, uploads fallidos, 401/403 inesperados y latencia p95.

### Métricas visibles MVP

- Pedidos de hoy.
- Completados y cancelados.
- Ventas directas de pedidos completados.
- Ticket promedio.
- Clientes únicos, si el dato es confiable.

## 11. Recomendaciones priorizadas

### P0 — bloqueadores

1. Sesión restringida inmediata para restaurante pending; acceso a perfil/menú, nunca público.
2. Separar configuración, readiness, moderación y publicación.
3. Cerrar bypass por slug y centralizar política pública.
4. Corregir logo: posponer hasta sesión o devolver sesión antes.
5. Impedir publicación con checklist incompleto.
6. DTOs seguros sin `password_hash` ni campos internos.
7. Eliminar `$2.50` fijo o modelarlo server-side para que los totales coincidan.

### P1 — necesarias

1. Entrada dedicada “Registrar mi negocio” y pasos con estilos existentes.
2. Dashboard inicial guiado por checklist.
3. Estado, preview y URL visibles.
4. Comprobar `res.ok`; conservar formularios ante error.
5. Editar modalidad en Settings y respetarla en checkout.
6. Slug estable/único o URL canónica por ID.
7. Socket autenticado/canal por restaurante.
8. Feedback en transiciones y cancelación consistente.
9. Endpoint de métricas básicas.
10. Instrumentación de funnel/correlation IDs.
11. Vínculo Restaurant/Directory por ID.
12. Mensajes de aprobación/login consistentes.

### P2 — posteriores

- Alta consecutiva más eficiente de productos.
- Guardado y recuperación de progreso.
- Preview responsivo.
- Preferencias operativas/sonido.
- Orden de categorías/productos.
- Mejor progreso de uploads.
- Comparativas simples por periodo.

No incluir IA, WhatsApp automatizado, lealtad, cupones o QR.
## 12. Propuesta del siguiente sprint

### Sprint 3 — Activación segura y primer menú

**Objetivo:** permitir registro, acceso privado inmediato, menú mínimo y estado verificable “listo para publicar” sin exposición pública prematura.

### Backend

1. DTO seguro de sesión/restaurante.
2. Emitir sesión al registrar restaurante.
3. Permitir pending en perfil, menú y readiness; no en operación pública.
4. Política central por estado:
   - pending: onboarding;
   - approved/published: operación;
   - rejected/suspended: acceso limitado explicativo.
5. Unificar visibilidad de listados, ID y slug.
6. Calcular readiness con datos actuales.
7. Bloquear publicación/aprobación si falta el mínimo, con razones estructuradas.
8. Relacionar Directory/Restaurant sin nombre ambiguo.
9. Resumen de activación y métricas mínimas.
10. Pruebas de integración estado/visibilidad/ownership.

### Frontend

1. Entrada dedicada de restaurante sin renovación visual.
2. Cuenta mínima en el primer paso.
3. Guardar sesión y navegar al onboarding, no al login.
4. Reutilizar Settings/MenuManager dentro del checklist.
5. Mostrar readiness, bloqueadores y moderación.
6. Mostrar preview/URL bajo reglas seguras.
7. Manejar respuestas no-OK sin perder formulario.
8. Mover logo a una etapa autenticada opcional.
9. Corregir total y modalidades del checkout sin crear motor logístico.

### Criterios de aceptación

#### Registro/acceso

- Registro válido devuelve token y DTO sin password hash.
- Pending entra al onboarding privado inmediatamente.
- Pending/rejected/suspended no aparece por home, directory, ID o slug.
- ADMIN y DRIVER siguen rechazados públicamente.

#### Onboarding/menú

- Pending completa perfil, modalidad, horarios y menú.
- Logo, portada, Instagram, descripción e imágenes son opcionales.
- API devuelve requisitos faltantes deterministas.
- Readiness exige una categoría y tres productos activos con precio positivo.
- Éxito UI solo tras 2xx; un error mantiene datos y explica acción.
- Ownership continúa protegido.

#### Publicación

- Una política única protege todos los endpoints públicos.
- URL estable sin colisión por nombres.
- Checklist incompleto impide publicación.
- “Listo para revisión” y “publicado” son distinguibles.

#### Primer pedido/métricas

- Total mostrado coincide con `order.totalAmount` o separa importes no incluidos.
- Checkout solo ofrece modalidades configuradas.
- Pedido end-to-end aparece solo al restaurante propietario.
- Se registran inicio/completado/error por paso sin PII.
- Se calculan tiempo a menú mínimo y publicación.
- `npm test`, typecheck y build pasan.

### Fuera del sprint

Rediseño visual, billing, pagos, importación masiva, IA, WhatsApp automatizado, lealtad, cupones, QR, app móvil y flota.

## 13. Archivos probablemente involucrados después

### Frontend

- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/RestaurantDashboard.tsx`
- `frontend/src/components/RestaurantSettings.tsx`
- `frontend/src/components/MenuManager.tsx`
- `frontend/src/pages/RestaurantDetail.tsx`
- `frontend/src/pages/Cart.tsx`
- `frontend/src/App.tsx`
- `frontend/src/store.ts`
- Nuevo módulo/página gradual de onboarding de restaurantes.

### Backend

- `backend/src/routes.ts`
- `backend/src/adminRoutes.ts`
- `backend/src/core/public-registration.ts`
- `backend/src/core/ownership.ts`
- `backend/src/core/order-pricing.ts`
- Nuevos módulos pequeños de session/readiness/visibility.

### Datos y pruebas

- `backend/prisma/schema.prisma` si se persisten `publishedAt`, slug único, vínculo Directory o eventos.
- Migración PostgreSQL no destructiva con rollback si se aprueba.
- `backend/src/tests/regression.test.ts`
- Nuevas pruebas HTTP/PostgreSQL.
- `CHANGELOG.md` y reporte de sprint.

## 14. Cinco problemas más importantes

1. **Pending no puede entrar:** la aprobación manual bloquea configuración y hace imposible vender en 15 minutos.
2. **Visibilidad insegura:** la ruta slug puede exponer un restaurante no aprobado como aprobado.
3. **No hay readiness/publicación explícita:** admin puede publicar un perfil vacío y el dueño desconoce estado/URL.
4. **Errores engañosos:** logo usa token inexistente y CRUD menú puede cerrar aunque falle.
5. **Primer pedido incoherente:** pickup no existe en checkout, envío difiere del total backend y no hay métricas de activación.

## 15. Veredicto

Yommi tiene las piezas funcionales del MVP restaurant-first, pero el dueño atraviesa herramientas aisladas, no un onboarding. El siguiente sprint debe resolver continuidad, permisos y publicación antes de ampliar alcance o estética.

La decisión clave es la aprobación: si la promesa es vender en menos de 15 minutos, la revisión humana previa no puede ser indefinida. En cualquier política, el restaurante debe entrar inmediatamente a un espacio privado, completar su menú y saber exactamente qué falta para publicar.