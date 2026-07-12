# Auditoría técnica de Yommi 2.0

**Fecha:** 11 de julio de 2026
**Alcance:** revisión estática de arquitectura, frontend, backend, Prisma, base de datos, APIs, autenticación, dependencias, seguridad, escalabilidad, reutilización, duplicación, bugs, pedidos, dashboards e IA.
**Restricciones respetadas:** no se modificó código, configuración, dependencias ni base de datos; no se ejecutaron migraciones, seeds, servidores ni procesos con escritura. El único archivo creado es este informe.

## 1. Resumen ejecutivo

Yommi es un MVP funcional de marketplace/directorio y pedidos para restaurantes, construido como monorepo npm con React/Vite en frontend, Express/Socket.IO en backend, Prisma y PostgreSQL como objetivo de producción. Cubre cuatro perfiles (cliente, restaurante, repartidor y administrador), descubrimiento de restaurantes, carrito, pedidos, tracking, menús, directorio, reclamaciones, banners y dos usos de Gemini.

La base tiene valor para Yommi 2.0, especialmente el modelo de dominio inicial, la separación frontend/backend, el flujo de aprobación de restaurantes, el menú por categorías, el historial de estados y los dashboards ya diseñados. Sin embargo, **no está lista para producción ni para escalar sin una fase de estabilización previa**.

Los bloqueadores principales son:

1. **Escalación de privilegios en registro:** el cliente puede solicitar el rol `ADMIN` (o `DRIVER`) y el backend lo persiste sin autorización (`backend/src/routes.ts:254`, `:320`). Esto es crítico.
2. **Integridad económica inexistente:** el backend confía en `totalAmount` y en el precio de cada item enviados por el navegador (`backend/src/routes.ts:1169`, `:1190`, `:1200`). Permite alterar importes y pedir productos de otro restaurante o no disponibles.
3. **IDOR y exposición de datos:** el tracking de un pedido es público usando el UUID en la URL y devuelve datos de restaurante, repartidor e items; el `trackingToken` generado no se usa (`backend/src/routes.ts:1330`).
4. **WebSockets sin autenticación ni autorización:** cualquier conexión puede unirse a cualquier sala y emitir ubicación/estado arbitrarios (`backend/server.ts:111-126`).
5. **Autorización incompleta:** actualizar categorías y productos no verifica que pertenezcan al restaurante autenticado (`backend/src/routes.ts:1058`, `:1121`).
6. **Pedidos no transaccionales ni idempotentes:** creación, cambio de estado, historial y contadores se ejecutan por separado. Repetir `DELIVERED` vuelve a incrementar métricas (`backend/src/routes.ts:1298`).
7. **Build backend probablemente roto:** se importan `@google/genai` y `google-auth-library`, pero no aparecen declarados en `backend/package.json` ni en `package-lock.json`.
8. **Prisma dividido:** hay dos esquemas casi duplicados, uno SQLite en raíz y otro PostgreSQL en backend, sin migraciones versionadas. La base `prisma/dev.db` está incluida en el repositorio.
9. **Secretos y credenciales inseguras por defecto:** fallback JWT conocido y seeds/altas administrativas con contraseñas fijas.
10. **Ausencia de pruebas y controles de calidad:** no hay tests, lint, formatter, CI, OpenAPI ni estrategia de migraciones visible.

**Decisión CTO recomendada:** conservar el producto y la experiencia acumulada, pero tratar el código actual como un **prototipo validado**, no como el núcleo definitivo. Ejecutar primero un hardening P0, luego modularizar gradualmente hacia un monolito modular. No se recomienda una reescritura total ni microservicios en esta etapa.

## 2. Arquitectura actual

### 2.1 Vista general

```text
Navegador / PWA
  React 19 + Vite + React Router + Zustand
        | REST (fetch/JWT) y Socket.IO
        v
Express 4 (server.ts)
  routes.ts + adminRoutes.ts
        | Prisma Client
        v
PostgreSQL (objetivo backend) / SQLite (artefacto raíz)

Servicios externos:
- Google OAuth
- Google Gemini / Google Maps grounding
- Geolocalización del navegador
- WhatsApp mediante enlaces
```

Es un monorepo npm con workspaces `frontend` y `backend`. El despliegue está separado: Vite genera el cliente y Express expone API, uploads y Socket.IO. No hay capa formal de dominio o servicios: los routers contienen validación parcial, autorización, reglas de negocio, persistencia y eventos.

### 2.2 Frontend

- React 19, TypeScript, Vite, Tailwind CSS 4 y componentes con clases utilitarias.
- Enrutamiento lazy-loaded y protección básica por rol en `App.tsx`.
- Estado global mínimo con Zustand: autenticación, carrito y ciudad.
- PWA básica mediante manifest y service worker.
- Páginas principales: home, directorio, detalle, carrito, último pedido, tracking, login/registro y cuatro dashboards.
- Componentes relevantes: `MenuManager`, `RestaurantSettings`, `RestaurantExtractor`, `AIAssistant`, `Layout`, `Toast`, `Skeleton` y fallback de WhatsApp.

Problemas estructurales:

- `AdminDashboard.tsx` (1,260 líneas), `RestaurantDetail.tsx` (739), `Home.tsx` (555) y `MenuManager.tsx` (465) concentran demasiadas responsabilidades.
- Uso extendido de `any`, contratos duplicados y ausencia de tipos compartidos con el backend.
- Acceso a API disperso con `fetch`; existen dos implementaciones de `fetchWithAuth` (`frontend/src/utils.ts` y `frontend/src/utils/fetchWithAuth.ts`).
- Token JWT persistido en `localStorage`, expuesto ante XSS.
- El carrito no se persiste y distingue items solo por `productId`, por lo que no modela correctamente variantes/opciones distintas del mismo producto.
- `clearCache()` sin prefijo ejecuta `localStorage.clear()`, pudiendo eliminar token, ciudad y otros datos no relacionados.
- El asistente IA genera enlaces `/restaurant/:id`, mientras el router público usa `/r/:slug`; la navegación resultante es inconsistente.
- La protección del frontend aporta UX, no seguridad; correctamente debe depender siempre del backend, donde hoy hay huecos.

### 2.3 Backend y APIs

Stack: Express 4, TypeScript, Prisma, JWT, bcrypt, Zod, Multer/Sharp, Helmet, rate limiting, node-cron y Socket.IO.

Familias de endpoints observadas:

- Autenticación: registro, login, Google y sesión actual.
- Público: banners, restaurantes, tendencias, productos populares, directorio, invitaciones, claims, ratings y tracking.
- Restaurante: perfil, menú, categorías, productos y pedidos.
- Pedidos: creación, listado y cambio de estado.
- Administración: métricas, restaurantes, directorio, claims, pedidos, usuarios, repartidores, banners y extractor IA.
- IA: recomendador de restaurantes y consulta con Maps grounding.
- Uploads: menú, restaurante, portada y banner.

Fortalezas del backend:

- Rate limiting global y específico de autenticación.
- Helmet, límites de archivos, allowlist MIME y procesamiento con Sharp.
- Validación Zod presente en autenticación y teléfono de invitado.
- Autorización del router admin consulta el usuario en base de datos.
- En cambios de pedido, restaurante/repartidor sí validan pertenencia del pedido.
- Historial de estados y eventos de tiempo real ya están contemplados.

Debilidades del backend:

- `routes.ts` tiene 1,350 líneas y `adminRoutes.ts` 555; mezclan transporte, negocio y persistencia.
- Validación de entrada es parcial; la mayoría de endpoints administrativos, perfiles, menús, claims, IA y pedidos aceptan cuerpos sin esquema.
- CORS REST y Socket.IO permiten cualquier origen; CSP está desactivada y el body JSON permite 50 MB.
- `trust proxy = 1` es una suposición de infraestructura que debe configurarse por entorno.
- El fallback `JWT_SECRET` permite arrancar con una clave pública conocida.
- JWT de siete días, sin refresh token, rotación, revocación ni gestión de sesiones.
- Usuarios suspendidos pueden seguir autenticándose y los tokens existentes no validan suspensión en cada operación.
- El registro imprime el body completo, potencialmente incluyendo contraseñas y datos personales (`backend/src/routes.ts:267`).
- Uploads autorizados solo requieren un JWT válido; no hay control de rol por tipo de upload, cuotas, ownership del recurso ni eliminación/retención.
- Los errores frecuentemente se convierten en `500` genérico, ocultando conflictos y errores de validación, pero el registro concatena `error.message`, con posible filtración interna.
- `adminRoutes.ts` crea un segundo `PrismaClient` en vez de reutilizar el singleton de `db.ts`.
- La tarea cron para contadores diarios corre en cada réplica; al escalar horizontalmente se duplica y depende de la zona horaria del proceso.
- No hay paginación en listados administrativos ni en varios endpoints operativos.
- No existe versionado de API, documentación OpenAPI, correlation IDs, métricas ni logging estructurado.

### 2.4 Prisma y base de datos

El esquema modela correctamente las entidades iniciales: usuarios, restaurantes, directorio, claims, categorías, productos/opciones, pedidos/items/historial/tracking, repartidores, ratings, banners, invitaciones y comisiones.

Hallazgos:

- `prisma/schema.prisma` usa SQLite; `backend/prisma/schema.prisma` usa PostgreSQL. Mantener dos fuentes de verdad genera drift.
- No existe directorio de migraciones. `prisma generate` no sustituye `prisma migrate deploy`.
- `prisma/dev.db` es un binario SQLite versionado: riesgo de datos residuales, divergencia y falsa confianza entre entornos.
- Dinero y porcentajes usan `Float`; para importes debe usarse `Decimal` o enteros en la unidad mínima.
- Roles, estados, providers y estados de pedido son `String`; deben ser enums o tablas controladas.
- El comentario del modelo dice `ON_THE_WAY`, mientras la API/UI usan `IN_TRANSIT`; además la UI introduce `ACCEPTED`, no documentado en Prisma.
- `OrderItem.product` usa `onDelete: Cascade`: borrar un producto puede borrar items históricos del pedido y degradar auditoría/contabilidad.
- La relación `Order.restaurant` no define una política explícita de borrado; el admin implementa borrados manuales no transaccionales.
- `ProductOption` existe, pero el item guarda opciones como string JSON y el frontend no integra un flujo completo de variantes.
- Campos duplicados o heredados (`coverUrl`/`cover_image`, `imageUrl`/`product_image`, `phone`/`whatsapp`/`phone_optional`) indican deuda de migración.
- Contadores derivados (`total_orders`, `orders_today`, `order_count*`, ratings) pueden desincronizarse.
- Faltan restricciones de dominio: rating 1-5, cantidades positivas, precios no negativos, una reseña por usuario/restaurante si esa es la regla, transición válida de estados, etc.
- Faltan índices explícitos para consultas por ciudad/estado/fecha, `restaurantId + createdAt`, `clientId + createdAt`, `driverId + status`, invitaciones y directorio.
- No hay tenant/owner explícito separado del registro `Restaurant`; el restaurante actúa como credencial y entidad comercial a la vez, dificultando múltiples sucursales y usuarios por negocio.
- `Commission` no se relaciona con pedidos ni conserva el snapshot aplicado; no hay ledger, pagos, impuestos, descuentos o reembolsos.

### 2.5 Autenticación y autorización

Hay dos identidades separadas: `User` para cliente/admin/repartidor y `Restaurant` como cuenta autenticable. Esto funciona para el MVP, pero complica RBAC y evolución B2B.

Riesgos concretos:

- **Crítico:** registro público acepta `ADMIN` y crea ese usuario directamente.
- **Alto:** registro público permite `DRIVER` sin proceso de aprobación.
- **Alto:** login no bloquea `User.isSuspended`.
- **Alto:** endpoints PUT de categorías/productos no validan ownership; POST de producto tampoco valida que `categoryId` sea del restaurante.
- **Alto:** endpoints admin de estado aceptan valores arbitrarios en varias entidades.
- **Medio:** roles se confían desde JWT en rutas generales; no existe middleware RBAC centralizado.
- **Medio:** Google OAuth usa una variable con prefijo `VITE_` en servidor, mezclando configuración pública y privada.
- **Medio:** no hay verificación de email, recuperación de contraseña, MFA para admin, expiración forzada, revocación o auditoría de accesos.
- **Medio:** mensajes distintos pueden facilitar enumeración de cuentas/restaurantes.

### 2.6 Flujo de pedidos

Flujo actual:

1. Cliente agrega productos a Zustand; el carrito se reinicia silenciosamente al cambiar de restaurante.
2. Checkout envía restaurante, items, precios, total, dirección y datos de invitado.
3. Backend persiste el pedido como `PENDING`, crea items/historial y emite `newOrder` globalmente.
4. Restaurante avanza `PENDING -> ACCEPTED -> PREPARING -> READY -> IN_TRANSIT -> DELIVERED`, o cancela desde pendiente.
5. Tracking consulta públicamente por ID y escucha una sala Socket.IO.
6. Al entregar, se incrementan métricas de productos/restaurante.

Fallos de negocio:

- El servidor no recalcula el total desde productos/opciones vigentes.
- No valida que todos los productos existan, estén disponibles, pertenezcan al mismo restaurante ni que cantidad/precio sean válidos.
- No captura snapshot suficiente de nombre, impuestos, cargo de entrega, descuento o comisión.
- No hay máquina de estados: puede saltarse o retroceder estados y repetir `DELIVERED`.
- Creación y transición no usan transacción.
- No hay clave de idempotencia; reintentos pueden crear pedidos duplicados.
- No hay asignación real de repartidor ni endpoint observado para tomar/asignar pedidos.
- El restaurante puede marcar `IN_TRANSIT` y `DELIVERED` aunque el diseño sugiera repartidor.
- Los eventos Socket.IO globales filtran actividad entre tenants y no son fuente confiable; algunos eventos del cliente ni persisten ubicación.
- `trackingToken` no es criptográficamente fuerte y no participa en autorización.
- El admin tiene una ruta alternativa de estado sin validación, historial, eventos ni actualización de métricas, creando dos reglas de negocio incompatibles.
- WhatsApp/localStorage representa un segundo flujo de “intento de pedido” paralelo al pedido transaccional, con métricas solo locales y no confiables.

### 2.7 Dashboards existentes

**Admin:** es el más amplio: overview, restaurantes, directorio, invitaciones/demanda, claims, pedidos, usuarios, drivers, banners y extractor IA. Debe conservarse como referencia funcional, pero dividirse por módulos. Hay listados sin paginación, tipos `any`, confirmaciones y fetching repetidos. Algunas respuestas incluyen entidades completas y potencialmente hashes de contraseña: `findMany()` de usuarios/restaurantes no selecciona campos seguros.

**Restaurante:** pedidos en tiempo real, historial, gestión de menú y configuración. Es una buena base de UX. Falta aislamiento robusto, métricas, horarios/zonas horarias consistentes, manejo de errores, estados de carga y reglas de operación.

**Cliente:** lista historial de pedidos. Es básico; falta detalle, reordenar, cancelación conforme a política, direcciones, favoritos, soporte y reseña vinculada a compra.

**Repartidor:** contempla pedidos activos, geolocalización y estados. El feature flag global `DRIVERS_ENABLED = false` confirma que está incompleto. No se observa asignación segura, persistencia de tracking desde sockets, disponibilidad geoespacial, prueba de entrega o manejo de permisos/consumo de batería.

### 2.8 Integración de IA

Casos actuales:

1. Recomendador público que deja al modelo proponer un término y consulta restaurantes.
2. Consulta Google Maps con coordenadas fijas de Ciudad de México.
3. Extractor admin que estructura texto y genera enlace de invitación.

Valor: el extractor administrativo puede acelerar adquisición de oferta y el recomendador puede mejorar descubrimiento.

Riesgos y carencias:

- Dependencias de IA/OAuth no declaradas, bloqueando compilación reproducible.
- Endpoints públicos de IA no tienen límite específico por usuario, cuota, longitud de prompt ni protección de presupuesto; el rate limit genérico es insuficiente contra abuso costoso.
- No se valida `query`, la respuesta de herramienta ni la salida del modelo con Zod antes de usarla.
- Coordenadas hardcoded y ausencia de ciudad/posición real degradan relevancia.
- No hay observabilidad de costo, latencia, tokens, tasa de error o calidad.
- No hay fallback determinista cuando Gemini falla ni caché semántica.
- La IA no debe decidir reglas comerciales; debe limitarse a búsqueda, clasificación y extracción con datos verificados.
- El componente público está comentado en `Home.tsx`, por lo que la capacidad existe pero no está activa en la experiencia principal.
- El extractor interpreta texto pegado, no recupera realmente una URL de Maps; el copy puede inducir una expectativa incorrecta.
- Deben definirse políticas de privacidad y retención para prompts/datos de negocios.

## 3. Fortalezas

- Cobertura funcional amplia para un MVP y cuatro perfiles definidos.
- Monorepo simple de levantar y separación clara entre cliente y servidor.
- Lazy loading de páginas y PWA básica.
- Modelo de dominio inicial útil y extensible.
- Aprobación/reclamación de restaurantes y directorio no registrado: diferenciador de adquisición.
- Menú jerárquico, disponibilidad, opciones y conteos contemplados.
- Historial de estados y tracking modelados desde el inicio.
- Google OAuth, hashing bcrypt, JWT, Helmet, rate limits, Zod parcial y procesamiento seguro de imágenes ya introducidos.
- Admin RBAC valida el rol contra base de datos en cada request.
- Separación de componentes reutilizables incipiente y utilidades de slug, WhatsApp, caché y auth.
- Uso de Socket.IO para experiencia operativa en tiempo real.
- IA enfocada en casos con valor de negocio, especialmente adquisición y descubrimiento.

## 4. Debilidades

- Monolito de routers y componentes gigantes, sin límites de módulo.
- Reglas de negocio duplicadas entre rutas normales y admin.
- Contratos no tipados entre frontend/backend; abundancia de `any`.
- Autorización fragmentada y vulnerable.
- Integridad financiera y de pedidos confiada al cliente.
- Dos esquemas Prisma y sin migraciones.
- Sin pruebas automatizadas, CI, lint, OpenAPI ni estrategia de despliegue documentada.
- Manejo de errores, loading y feedback inconsistente.
- Persistencia local usada para señales de negocio que deberían vivir en servidor.
- Observabilidad, auditoría, privacidad y gobierno de datos ausentes.
- Uploads en disco local, incompatible con réplicas/entornos efímeros.
- README corresponde al origen AI Studio y no documenta la arquitectura real.

## 5. Riesgos priorizados

| Severidad | Riesgo | Impacto | Acción inmediata |
|---|---|---|---|
| P0 Crítico | Registro permite rol ADMIN | Toma total de plataforma | Eliminar roles privilegiados del input público; rol fijo CLIENT y flujos separados/aprobados |
| P0 Crítico | Precio/total confiado al cliente | Fraude y pérdida financiera | Recalcular en servidor dentro de transacción |
| P0 Crítico | WebSockets sin auth/ACL | Falsificación y fuga de tracking | Handshake autenticado, rooms autorizadas, eventos de comando en servidor |
| P0 Crítico | Tracking público por UUID | Exposición de datos personales/operativos | Token opaco fuerte, respuesta mínima, expiración y/o autorización |
| P0 Alto | PUT de producto/categoría sin ownership | Manipulación cross-tenant | Filtrar cada mutación por `id + restaurantId` |
| P0 Alto | Credenciales fijas y JWT fallback | Acceso no autorizado | Fallar al arrancar sin secretos; retirar cuentas/defaults y rotar |
| P0 Alto | Datos sensibles en logs/respuestas admin | Fuga de contraseñas/PII | Select/DTO explícito y redacción de logs |
| P0 Alto | Build no reproducible por dependencias faltantes | No se puede desplegar confiablemente | Declarar y fijar dependencias tras validar versiones |
| P1 Alto | Sin transacciones/idempotencia/máquina de estados | Duplicados y métricas corruptas | Servicio de pedidos transaccional con optimistic concurrency |
| P1 Alto | Dos esquemas y sin migraciones | Drift y pérdida de datos | Una fuente Prisma PostgreSQL y migraciones auditadas |
| P1 Alto | Borrados destruyen historial | Pérdida contable/auditoría | Soft delete/archivado y snapshots de items |
| P1 Medio | JWT en localStorage y sesión larga | Mayor impacto de XSS/robo | Cookies HttpOnly o access corto + refresh rotado |
| P1 Medio | IA pública sin control de costo | Abuso y gasto variable | Cuotas, límites, timeout, caché y telemetría |
| P1 Medio | Cron por réplica y timezone implícita | Contadores inconsistentes | Jobs con lock o consultas derivadas por zona del negocio |
| P2 Medio | Componentes/rutas gigantes | Baja velocidad y más regresiones | Modularización incremental con tests de caracterización |
| P2 Medio | Sin paginación/caché distribuida | Degradación por volumen | Cursor pagination, índices y caché compartida selectiva |

## 6. Componentes que deben conservarse

Conservar significa preservar el comportamiento y conocimiento de producto, no necesariamente dejar el código intacto:

- Flujos de directorio, invitación y reclamación de restaurantes.
- Modelo conceptual de restaurante, categorías, productos, opciones, pedidos, historial y tracking.
- Experiencia del dashboard de restaurante para aceptar/preparar/listar pedidos.
- Dashboard admin como mapa de operaciones del negocio.
- Descubrimiento por ciudad/categoría, tendencias y productos populares.
- Google OAuth como proveedor, endureciendo su implementación.
- Pipeline de imagen con allowlist, límite y Sharp; mover almacenamiento a objeto externo.
- Componentes visuales pequeños (`Layout`, `Toast`, `Skeleton`, fallbacks) y lazy loading.
- Zustand para estado efímero de UI; no usarlo como fuente de verdad del negocio.
- Extractor IA admin y recomendador como experimentos medibles, con guardrails.
- Historial de estados y eventos en tiempo real como capacidades de dominio.

## 7. Componentes que deben refactorizarse

### P0/P1

- Autenticación/RBAC: identidad unificada, roles no autodeclarables, sesiones revocables, suspensión efectiva y permisos centralizados.
- Servicio de pedidos: cálculo server-side, transacciones, idempotencia, state machine, snapshots y eventos confiables.
- Prisma: esquema único, enums, Decimal, índices, constraints y migraciones.
- API de tracking y Socket.IO: autenticación, autorización, minimización de datos y persistencia controlada.
- APIs de menú: DTO/Zod y ownership en todas las operaciones.
- Admin: DTOs seguros que nunca expongan `password_hash` y comandos que reutilicen servicios de dominio.

### P2

- Dividir `routes.ts` por módulos: auth, catalog, directory, orders, tracking, ratings, uploads e AI.
- Dividir `AdminDashboard`, `RestaurantDetail`, `Home` y `MenuManager` por features/hooks/componentes.
- Crear cliente API central con manejo tipado de errores, auth, timeout y cancelación.
- Compartir contratos o generar cliente desde OpenAPI.
- Unificar utilidades duplicadas (`fetchWithAuth`, normalización WhatsApp, slug).
- Reemplazar `any` gradualmente por DTOs y view models.
- Separar métricas derivadas de datos transaccionales y definir recomputación.
- Documentar despliegue, variables, jobs, backup/restore y runbooks.

## 8. Componentes que conviene reemplazar

- **SQLite y esquema Prisma raíz** como entorno paralelo: reemplazar por PostgreSQL consistente en todos los entornos; SQLite puede reservarse para tests aislados solo si se mantiene un esquema compatible generado.
- **Base `prisma/dev.db` versionada:** reemplazar por fixtures/factories y seeds sin credenciales predecibles.
- **Uploads en filesystem local:** reemplazar por almacenamiento de objetos (S3/R2/GCS equivalente), URLs firmadas y CDN.
- **JWT largo en localStorage:** reemplazar por sesión segura basada en cookies HttpOnly/SameSite o access token corto con refresh rotado y protección CSRF acorde.
- **Cron embebido en cada proceso web:** reemplazar por job runner singleton/cola con locking y zona horaria explícita.
- **Contadores diarios reseteables:** preferir agregaciones por fecha/materialized views o contadores particionados por día.
- **`Float` para dinero:** reemplazar por `Decimal`/centavos enteros.
- **Strings libres de rol/estado:** reemplazar por enums y una máquina de estados validada.
- **Fetch disperso:** reemplazar por una capa de datos tipada; considerar TanStack Query para cache/invalidation de servidor.
- **Sockets como canal de comandos confiable:** los comandos deben pasar por API/servicio autorizado; Socket.IO queda para notificaciones y tracking autenticado.
- **Microservicios:** no introducirlos ahora. El reemplazo correcto del monolito actual es un monolito modular, no una arquitectura distribuida prematura.

## 9. Roadmap técnico de Yommi 2.0

### Fase 0 — Contención y baseline (1-2 semanas)

- Congelar features de riesgo y documentar flujos actuales.
- Corregir escalación de roles, ownership, suspensión, secretos, logs y DTOs sensibles.
- Desactivar o proteger tracking/sockets/IA pública hasta tener ACL y cuotas.
- Hacer reproducible el install/build y agregar lint, typecheck y CI.
- Añadir tests de caracterización de auth, menú y pedidos antes de mover lógica.
- Definir SLO inicial, ambientes y gestión de secretos.

**Criterio de salida:** ningún P0 abierto; build limpio y pruebas mínimas en CI.

### Fase 1 — Núcleo transaccional (2-4 semanas)

- Consolidar un único Prisma/PostgreSQL con migraciones.
- Introducir enums, Decimal, índices y restricciones.
- Crear módulos `identity`, `restaurants/catalog`, `orders`, `delivery`, `directory`, `admin`, `media`, `ai`.
- Implementar pricing server-side, snapshots, transacción e idempotency key.
- State machine de pedido con versionado/optimistic locking y outbox de eventos.
- Preservar históricos mediante soft delete y políticas de retención.

**Criterio de salida:** pedido íntegro y auditable aun con reintentos/concurrencia.

### Fase 2 — Experiencia operativa y delivery (3-5 semanas)

- API/client tipados, query cache y manejo uniforme de errores.
- Dividir dashboards y añadir paginación, filtros y estados de carga.
- Diseñar usuarios de organización/sucursal, no credencial embebida en Restaurant.
- Flujo real de asignación de repartidor, disponibilidad, tracking persistido, consentimiento y prueba de entrega.
- Socket.IO autenticado con adapter compartido (por ejemplo Redis) al usar varias réplicas.
- Media en object storage/CDN.

**Criterio de salida:** operación multiusuario y multi-réplica consistente.

### Fase 3 — Comercial, observabilidad y cumplimiento (3-5 semanas)

- Ledger de comisiones, impuestos, descuentos, cargos, reembolsos y conciliación.
- Auditoría inmutable de acciones administrativas.
- Logging estructurado, tracing, métricas, alertas y error monitoring.
- Backups, PITR, restore probado, políticas de privacidad/retención y respuesta a incidentes.
- Performance/load tests y capacity planning.

**Criterio de salida:** plataforma operable con métricas y recuperación verificadas.

### Fase 4 — IA medible y crecimiento (2-4 semanas, iterativa)

- Gateway de IA con cuotas, timeout, validación, telemetría, caché y fallback.
- Búsqueda híbrida determinista + ranking IA; grounding solo con catálogo vigente.
- Extractor con revisión humana, deduplicación y provenance de datos.
- Evaluaciones offline/online: precisión, conversión, costo por sesión y latencia.
- Personalización solo con consentimiento y minimización de datos.

**Criterio de salida:** IA con ROI, calidad y costo observables; nunca como dependencia crítica del checkout.

## 10. Prioridad de cada módulo

| Módulo | Prioridad | Estado actual | Decisión Yommi 2.0 |
|---|---:|---|---|
| Autenticación, sesión y RBAC | P0 | Vulnerable por roles autodeclarables y sesión débil | Rediseñar/endurecer primero |
| Pedidos y pricing | P0 | Funcional pero manipulable y no transaccional | Refactor de dominio inmediato |
| Tracking y tiempo real | P0 | Público y sin ACL | Cerrar, autenticar y rediseñar |
| Catálogo/menú y ownership | P0 | Buen alcance, autorización incompleta | Conservar UX; rehacer servicio/validación |
| Prisma/migraciones/datos | P0 | Dos esquemas, sin migraciones | Consolidar antes de nuevas features |
| Secretos, logs y exposición PII | P0 | Defaults y respuestas peligrosas | Remediación inmediata |
| Build, tests y CI | P0 | Build dudoso; controles ausentes | Establecer baseline reproducible |
| Admin/operaciones | P1 | Amplio pero monolítico y con rutas paralelas | Conservar funciones, modularizar y auditar |
| Restaurantes/organizaciones | P1 | Cuenta y entidad mezcladas | Evolucionar a organización/sucursal/miembros |
| Repartidores | P1 | Incompleto y deshabilitado | Completar después del núcleo de pedidos |
| Uploads/media | P1 | Seguro parcialmente, local | Migrar a object storage/CDN |
| Directorio/claims/invitaciones | P1 | Diferenciador valioso | Conservar, validar, deduplicar y transaccionar |
| Observabilidad/auditoría | P1 | Ausente | Implementar antes de escala comercial |
| Base de datos: índices/backup | P1 | Sin evidencia de estrategia | Diseñar y probar |
| Frontend data layer/tipos | P2 | Fetch/any dispersos | Cliente tipado y query cache |
| Dashboards UI | P2 | Funcionales, archivos gigantes | División incremental, no reescritura |
| Ratings/social proof | P2 | Modelo básico | Constraints, antifraude y compra verificada |
| Banners/contenido | P2 | CRUD suficiente | Mantener, validar URLs/media |
| PWA/offline | P2 | Registro básico | Definir estrategia de caché y actualización |
| IA recomendador | P2 | Parcialmente desconectado | Pilotar con guardrails y métricas |
| IA extractor de oferta | P2 | Caso prometedor | Conservar con human-in-the-loop |
| Analítica avanzada | P3 | Contadores frágiles | Implementar sobre eventos/datos confiables |
| Microservicios | P3 | No aplica | Posponer hasta límites/carga demostrados |

## Hallazgos adicionales y bugs probables

- `backend/package.json` declara `start: node server.js`, pero `server.js` solo existe después del build; el despliegue debe garantizar ese paso.
- Dependencias `@google/genai` y `google-auth-library` son importadas pero no declaradas.
- Dependencia `pg` está duplicada en raíz y backend con rangos distintos.
- Prisma 5 y TypeScript/backend objetivo Node 18 requieren una matriz de compatibilidad y runtime soportado explícito antes de actualizar; no se realizó un escaneo CVE en red en esta auditoría.
- La pantalla de restaurante intenta identificar `user.restaurantId`/`user.restaurant.id`, pero el login retorna solo `id`; termina haciendo refetch global ante cada nuevo pedido.
- El endpoint `/orders` puede dejar `where = {}` para roles inesperados y devolver todos los pedidos; debe fallar cerrado.
- `auth/me` y listados administrativos deben usar DTOs/selects, no spreads de entidades que incluyen hashes.
- El admin cambia estados con un endpoint distinto al operativo, evitando historial, eventos y contadores.
- Aprobar un claim crea una cuenta con contraseña fija y no implementa entrega segura/activación.
- Alta admin de restaurante crea email artificial y contraseña fija.
- Borrados manuales no usan `$transaction`; un fallo intermedio deja datos parciales.
- Cambiar un pedido ya entregado a otro estado y devolverlo a entregado duplica contadores.
- `order_count_today` reseteado a medianoche del servidor no respeta ciudad/sucursal ni múltiples réplicas.
- Normalización de WhatsApp difiere entre frontend/backend y puede producir prefijos mexicanos inconsistentes (`+52` frente a `521`).
- El patrón de teléfono mezcla longitud con caracteres de formato y puede aceptar/rechazar números de forma inesperada.
- El estado de carrito reemplaza todo el carrito sin confirmación al agregar desde otro restaurante.
- Opciones del producto no forman parte de la identidad del item del carrito.
- Tracking devuelve el objeto driver completo; según Prisma puede incluir ubicación y metadatos innecesarios.
- No se observa protección anti-spam/CAPTCHA en invitaciones, claims o IA pública.
- No se observa validación de URL en banners, Instagram, imágenes o links generados.
- Cache-Control público debe revisarse para evitar cachear datos personalizados si el middleware se amplía.
- Tendencias usan caché en memoria: cada réplica tendrá resultados distintos y se pierde al reiniciar.
- El service worker requiere estrategia de versionado/cache invalidation; de lo contrario puede servir assets/API obsoletos.
- No hay catch-all de rutas SPA en frontend/backend conjunto; el hosting debe configurarlo para deep links.

## Recomendación arquitectónica objetivo

Adoptar un **monolito modular TypeScript** con PostgreSQL, una API versionada y eventos internos/outbox:

```text
apps/web       -> React + router + query cache + UI por feature
apps/api       -> Express/Fastify/Nest (elegir por equipo, no por moda)
packages/contracts -> schemas Zod/OpenAPI y tipos generados
packages/ui    -> componentes realmente reutilizables

Módulos backend:
identity | organizations | catalog | orders | delivery
directory | reviews | media | admin | ai | notifications

Infra compartida:
PostgreSQL | object storage/CDN | Redis (solo cuando sea necesario)
job runner/outbox | observabilidad | secrets manager
```

Cada módulo debe poseer sus casos de uso y repositorios; los routers solo traducen HTTP. Los comandos administrativos deben invocar los mismos servicios de dominio que el resto de la plataforma. Esta estructura permite escalar el equipo y extraer un servicio futuro únicamente cuando métricas reales lo justifiquen.

## Limitaciones de la auditoría

- Revisión estática del contenido disponible; no se levantó la aplicación ni se ejecutaron requests para respetar la restricción de no modificar archivos/estado.
- No se ejecutó `npm install`, build, migraciones, seed ni tests; estas acciones pueden escribir artefactos.
- Git no está disponible en el PATH de este entorno, por lo que no se pudo usar `git status`; se verificó que los archivos fuente mantuvieran sus timestamps y la única escritura realizada fue este documento.
- No se realizó auditoría dinámica de dependencias/CVEs ni pentest. Deben añadirse `npm audit`/SCA, secret scanning, SAST, DAST y pruebas de autorización en la Fase 0.
- No se inspeccionó infraestructura externa, datos de producción, políticas organizacionales ni proveedores de pago porque no están presentes en el repositorio.

## Veredicto

Yommi tiene una base de producto aprovechable y suficiente señal funcional para evolucionar hacia 2.0. La prioridad no debe ser agregar más pantallas: debe ser asegurar identidad, pedidos, datos y aislamiento entre restaurantes. Una vez cerrado el P0, la modularización incremental permitirá conservar el valor existente sin asumir el riesgo y costo de una reescritura total.
