# Arquitectura objetivo de Yommi 2.0

**Estado:** decisión arquitectónica objetivo
**Fecha:** 11 de julio de 2026
**Tipo de sistema:** SaaS B2B multi-tenant para restaurantes y negocios de comida
**Modelo comercial:** mensualidad, sin comisión por pedido

## 1. Propósito y alcance

Este documento define la arquitectura hacia la que debe evolucionar Yommi 2.0. No describe una reescritura inmediata: establece límites, reglas y una ruta de migración gradual desde el código actual.

La arquitectura debe soportar primero la operación digital directa de restaurantes: presencia pública, catálogo, pedidos y relación con clientes propios. Debe quedar preparada para lealtad, cupones, QR, WhatsApp, notificaciones e IA, sin convertir esas capacidades futuras en dependencias del MVP.

En esta etapa:

- Solo se modelan restaurantes y negocios de comida como comercios soportados.
- El restaurante es dueño de su catálogo, pedidos y relación con clientes.
- Yommi cobra una mensualidad; no calcula ni cobra comisión por pedido.
- Yommi no es una flota de reparto ni un marketplace generalista.
- Las integraciones externas nunca deben controlar la integridad de pedidos o identidad.

## 2. Decisión principal: monolito modular

Yommi 2.0 se construirá como un **monolito modular TypeScript** con frontend y backend desplegables de manera independiente, una base PostgreSQL y módulos de dominio explícitos dentro del backend.

No se adoptarán microservicios en esta fase.

### Razones

- El producto y sus reglas todavía están evolucionando.
- El equipo necesita cambios transaccionales entre catálogo, pedidos y clientes.
- Un único despliegue backend reduce costo operativo, observabilidad distribuida y fallos de red.
- Los límites modulares permiten crecer el equipo y extraer servicios más adelante si existe una razón medida.
- PostgreSQL y una aplicación modular son suficientes para el volumen inicial esperado.

### Condiciones para extraer un servicio futuro

Un módulo solo podrá separarse cuando se cumplan varias de estas condiciones:

- Tiene carga o patrón de escalado claramente distinto.
- Requiere aislamiento operativo o de seguridad.
- Tiene ownership estable por un equipo dedicado.
- Su contrato está probado y cambia con poca frecuencia.
- La medición demuestra que el monolito es el cuello de botella.

Notificaciones, media o procesamiento de IA podrían ser candidatos futuros. Identity, catalog y orders no deben separarse prematuramente.

## 3. Vista de alto nivel

```text
Clientes web / PWA / QR
          |
          | HTTPS REST + eventos autenticados
          v
Frontend React
          |
          v
API Yommi - Monolito modular
  identity | restaurants | catalog | orders | customers
  loyalty  | coupons     | tracking | notifications
  ai       | admin       | media
          |
          +---- PostgreSQL
          +---- Object storage/CDN
          +---- Job runner / outbox
          +---- Proveedores: email, push, WhatsApp, IA
```

### Infraestructura inicial

- PostgreSQL como única base transaccional.
- Prisma como ORM y mecanismo de migraciones.
- Almacenamiento de objetos y CDN para imágenes.
- Proceso de jobs con locking y reintentos para trabajo asíncrono.
- Outbox transaccional para eventos que disparen notificaciones, lealtad o integraciones.
- Redis solo cuando exista una necesidad medida: rate limiting distribuido, adapter de Socket.IO, caché o locking.
- Logs estructurados, métricas, tracing y captura de errores desde el primer release operable.

## 4. Principios arquitectónicos

1. **El dominio manda.** HTTP, Prisma, Socket.IO, WhatsApp e IA son adaptadores, no el centro del sistema.
2. **Multi-tenancy explícita.** Todo recurso de negocio pertenece a un `restaurantId`; ninguna consulta debe depender solo de un ID global aportado por el cliente.
3. **Fail closed.** Si identidad, rol, tenant u ownership no pueden comprobarse, la operación se rechaza.
4. **Una regla, un servicio.** Rutas públicas, restaurante y admin llaman al mismo caso de uso; no duplican lógica.
5. **Integridad en servidor.** Totales, descuentos, estados, permisos y efectos se calculan en backend.
6. **Transacciones cortas.** Los cambios consistentes se confirman juntos; los efectos externos se procesan después mediante outbox.
7. **Compatibilidad gradual.** Se preservan rutas y UX mientras se reemplaza la implementación por módulos.
8. **Observabilidad por defecto.** Toda operación crítica tiene correlation ID, evento de auditoría y métricas.
9. **Privacidad y minimización.** Solo se devuelve y conserva la información necesaria.
10. **IA asistiva, no autoritativa.** La IA recomienda, clasifica o redacta; nunca decide permisos, precios o estados financieros.

## 5. Estructura propuesta del repositorio

La estructura puede adoptarse gradualmente dentro de los workspaces actuales.

```text
/
├─ apps/                         # objetivo; transición desde frontend/ y backend/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ contracts/                 # schemas y tipos compartidos/publicables
│  ├─ ui/                        # componentes visuales reutilizables
│  ├─ config/                    # tsconfig/eslint compartidos
│  └─ testing/                   # factories y helpers
├─ prisma/                       # única fuente de schema y migraciones
├─ docs/
├─ package.json
└─ package-lock.json
```

No es obligatorio renombrar `frontend/` y `backend/` de inmediato. Primero deben crearse los límites internos; mover workspaces es una tarea posterior y mecánica.

## 6. Estructura propuesta del frontend

```text
frontend/src/
├─ app/
│  ├─ router.tsx
│  ├─ providers.tsx
│  ├─ auth-guards.tsx
│  └─ config.ts
├─ features/
│  ├─ identity/
│  ├─ restaurants/
│  ├─ catalog/
│  ├─ orders/
│  ├─ customers/
│  ├─ loyalty/
│  ├─ coupons/
│  ├─ tracking/
│  ├─ notifications/
│  ├─ ai/
│  ├─ admin/
│  └─ media/
├─ pages/                        # composición de features; sin reglas de negocio
├─ shared/
│  ├─ api/
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  ├─ types/
│  └─ validation/
├─ assets/
├─ styles/
└─ main.tsx
```

### Estructura interna de una feature

```text
features/orders/
├─ api/                          # requests y query keys
├─ components/
├─ hooks/
├─ model/                        # tipos de vista y estado local
├─ pages/
├─ validation/
└─ index.ts                      # API pública de la feature
```

### Reglas frontend

- Las páginas componen componentes; no implementan reglas de negocio del servidor.
- Todo acceso HTTP pasa por un cliente API común y tipado.
- Los datos remotos usan una capa de server state con caché e invalidación; Zustand queda para estado de sesión visual o efímero.
- Ninguna feature importa archivos internos de otra; importa su `index.ts` público.
- No se duplican DTOs manualmente: se comparten schemas o se generan desde OpenAPI.
- Componentes en `shared/components` deben ser independientes del dominio. Si conocen pedidos o restaurantes, pertenecen a la feature correspondiente.
- La autorización visual mejora UX, pero nunca sustituye la autorización backend.
- El carrito puede mantenerse local, pero el backend es la fuente de precios, disponibilidad, descuentos y total.

## 7. Estructura propuesta del backend

```text
backend/src/
├─ app/
│  ├─ create-app.ts
│  ├─ router.ts
│  ├─ middleware/
│  └─ errors/
├─ config/
│  ├─ env.ts
│  └─ logger.ts
├─ modules/
│  ├─ identity/
│  ├─ restaurants/
│  ├─ catalog/
│  ├─ orders/
│  ├─ customers/
│  ├─ loyalty/
│  ├─ coupons/
│  ├─ tracking/
│  ├─ notifications/
│  ├─ ai/
│  ├─ admin/
│  └─ media/
├─ infrastructure/
│  ├─ database/
│  ├─ events/
│  ├─ jobs/
│  ├─ storage/
│  ├─ messaging/
│  └─ observability/
├─ shared/
│  ├─ auth/
│  ├─ errors/
│  ├─ validation/
│  ├─ time/
│  └─ types/
└─ server.ts
```

### Estructura interna de un módulo

```text
modules/orders/
├─ domain/
│  ├─ order.ts
│  ├─ order-status.ts
│  ├─ policies.ts
│  └─ events.ts
├─ application/
│  ├─ create-order.service.ts
│  ├─ transition-order.service.ts
│  └─ ports.ts
├─ infrastructure/
│  └─ order.repository.prisma.ts
├─ http/
│  ├─ order.routes.ts
│  ├─ order.controller.ts
│  ├─ order.schemas.ts
│  └─ order.presenter.ts
├─ tests/
└─ index.ts
```

No todos los módulos necesitan todas las carpetas desde el primer día. La estructura se aplica en proporción a su complejidad, manteniendo siempre la separación entre HTTP, aplicación y persistencia.

## 8. Módulos principales

### 8.1 identity

Responsable de:

- Usuarios, credenciales, sesiones, recuperación y verificación.
- Roles y permisos.
- Membresía de usuarios en restaurantes.
- Revocación, rotación y auditoría de sesiones.

Roles iniciales recomendados:

- `PLATFORM_ADMIN`: operación interna de Yommi.
- `RESTAURANT_OWNER`: configuración y facturación del negocio.
- `RESTAURANT_MANAGER`: operación, catálogo, clientes y pedidos según permisos.
- `RESTAURANT_STAFF`: pedidos y tareas operativas limitadas.
- `CUSTOMER`: cliente final, opcional para pedido invitado.

No se incluye `DRIVER` en el alcance actual. La identidad no debe estar embebida en la entidad Restaurant.

### 8.2 restaurants

Responsable de:

- Perfil del negocio, sucursales, horarios, ubicación y canales.
- Estado de onboarding y activación.
- Configuración de pickup/delivery propio.
- Membresías y permisos del negocio en coordinación con identity.
- Plan de suscripción y entitlements, sin mezclar pagos del SaaS con pedidos.

El modelo debe permitir un negocio con una o más sucursales, aunque el MVP pueda limitar cada cuenta a una sucursal.

### 8.3 catalog

Responsable de:

- Categorías, productos, variantes/opciones, precios y disponibilidad.
- Publicación del menú y orden de presentación.
- Snapshot de datos comerciales usados por pedidos.
- Reglas de ownership del catálogo.

Los precios usan `Decimal` o unidad monetaria mínima; nunca `Float` para nuevas migraciones.

### 8.4 orders

Responsable de:

- Creación idempotente y cálculo server-side.
- Snapshot de productos, precios, descuentos y datos necesarios.
- Máquina de estados y transición autorizada.
- Historial y auditoría.
- Cancelación, aceptación y cumplimiento pickup/delivery propio.
- Eventos de dominio para clientes, lealtad y notificaciones.

No cobra comisión ni depende de un proveedor de IA o notificaciones para confirmar un pedido.

### 8.5 customers

Responsable de:

- Relación directa entre un restaurante y sus clientes.
- Perfil, consentimiento, preferencias y direcciones.
- Historial agregado y segmentación básica.
- Importación/exportación conforme a privacidad.

Un cliente global puede relacionarse con varios restaurantes, pero cada restaurante solo accede a sus propios datos y consentimientos.

### 8.6 loyalty

Responsable futuro de:

- Programas por restaurante.
- Reglas para ganar/canjear puntos o sellos.
- Ledger inmutable de movimientos.
- Expiración, ajustes y antifraude.

Debe escuchar eventos de pedidos entregados. No se implementa dentro de orders ni forma parte del MVP inicial.

### 8.7 coupons

Responsable futuro de:

- Definición, elegibilidad, límites, vigencia y redenciones.
- Validación server-side durante cotización/creación de pedido.
- Auditoría y prevención de doble uso.

Orders solicita una evaluación al módulo; coupons no modifica pedidos directamente.

### 8.8 tracking

Responsable de:

- Consulta segura del estado del pedido.
- Tokens opacos con expiración o acceso autenticado.
- Timeline de estados y, solo si aplica, ubicación de entrega propia.
- Eventos en tiempo real autenticados y autorizados.

En el MVP puede limitarse a tracking de estado. El tracking geográfico y la flota propia quedan fuera hasta definir el modelo operativo.

### 8.9 notifications

Responsable futuro de:

- Plantillas, preferencias, destinatarios y canales.
- Email, push, SMS o WhatsApp mediante adaptadores.
- Cola, reintentos, deduplicación, rate limits y delivery status.
- Opt-in/opt-out y cumplimiento.

Consume eventos de outbox; un fallo de notificación no revierte un pedido válido.

### 8.10 ai

Responsable futuro de:

- Recomendaciones y búsqueda asistida.
- Extracción y propuesta de contenido de menú/negocio.
- Automatizaciones y respuestas sugeridas.
- Gateway de proveedores, cuotas, costos, observabilidad y evaluación.

Toda salida se valida. Las acciones sensibles requieren confirmación humana. El módulo no accede directamente a tablas ajenas: usa puertos o servicios de aplicación autorizados.

### 8.11 admin

Responsable de:

- Operación interna de Yommi, soporte y moderación.
- Onboarding, suspensión y gestión controlada de restaurantes.
- Auditoría de acciones administrativas.
- Métricas operativas y soporte de suscripciones.

Admin no duplica reglas. Invoca los mismos servicios de aplicación con un actor y permiso administrativo explícitos.

### 8.12 media

Responsable de:

- Upload, validación, transformación, almacenamiento y eliminación.
- Ownership, cuotas y lifecycle de archivos.
- URLs firmadas o públicas según el caso.
- Object storage y CDN.

El disco local solo puede usarse en desarrollo; no es almacenamiento de producción.

## 9. Dependencias permitidas entre módulos

```text
identity <---- restaurants <---- catalog
    ^              ^               |
    |              |               v
customers <------ orders <------ coupons
    |              |
    v              +-----------> loyalty
notifications <----+-----------> tracking

admin -> servicios públicos de todos los módulos
ai -> puertos de lectura/acción explícitos
media -> servicio transversal con ownership del módulo consumidor
```

Reglas:

- No se importan repositorios Prisma de otro módulo.
- No se escriben tablas ajenas directamente.
- Las dependencias circulares se rompen con eventos o puertos.
- `shared` no puede convertirse en un módulo de negocio genérico.
- Admin e IA no tienen acceso privilegiado implícito; toda acción declara actor, tenant y permiso.

## 10. Reglas para rutas HTTP

- Prefijo versionado: `/api/v1` para contratos nuevos.
- Rutas usan sustantivos y recursos: `/restaurants/:restaurantId/orders`.
- Los IDs de tenant no autorizan por sí solos; se comparan con el contexto autenticado.
- Controladores solo: leen request, invocan un servicio, presentan respuesta.
- No contienen queries Prisma ni reglas de dominio.
- Endpoints de comando devuelven códigos semánticos: `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`.
- Listados usan cursor pagination y límites máximos.
- Mutaciones críticas aceptan idempotency key.
- Versiones no se mezclan dentro de un mismo router.
- Contratos públicos se documentan con OpenAPI.
- Rutas legacy se mantienen como adaptadores durante la migración y llaman a servicios nuevos.

## 11. Reglas para servicios de aplicación

- Un servicio representa un caso de uso: `CreateOrder`, `UpdateProduct`, `RedeemCoupon`.
- Recibe un comando tipado y un contexto de actor/tenant.
- Verifica autorización mediante políticas reutilizables.
- Coordina repositorios y transacciones; no conoce Express.
- Emite eventos de dominio/outbox después de cambios exitosos.
- No llama proveedores externos dentro de una transacción de base de datos.
- Es idempotente cuando procesa pagos, pedidos, redenciones o webhooks.
- Devuelve un resultado de dominio o lanza un error tipado; no construye respuestas HTTP.

## 12. Reglas para validadores y contratos

- Zod será la fuente inicial de validación runtime.
- Cada endpoint valida params, query, headers y body antes del servicio.
- `z.infer` deriva tipos; no se replica manualmente la interfaz.
- Validación sintáctica vive en schemas; reglas de negocio viven en dominio/aplicación.
- Los objetos rechazan campos desconocidos en comandos sensibles mediante `.strict()`.
- Respuestas usan presenters/DTOs con allowlist; nunca se serializa una entidad Prisma completa.
- Password hashes, tokens internos y metadata privada jamás forman parte de una respuesta.
- Fechas viajan en ISO 8601 UTC; dinero con código de moneda y valor decimal/entero definido.

## 13. Reglas de acceso a Prisma

- Existe un único `PrismaClient` por proceso.
- Solo `infrastructure/database` y repositorios del módulo importan Prisma.
- Rutas, controladores y componentes frontend no usan Prisma.
- Toda query de recurso de negocio incluye `restaurantId` cuando aplica.
- Ownership debe expresarse en la propia condición de lectura/escritura siempre que Prisma lo permita.
- Operaciones multi-escritura críticas usan `$transaction`.
- No se aceptan selects implícitos para datos sensibles; se usan `select` explícitos.
- Migraciones son versionadas, revisadas y aplicadas por pipeline; nunca al arrancar el proceso web.
- No se usa `db push` en producción.
- Borrados históricos usan soft delete/archivado salvo política explícita.
- No se borran items históricos al eliminar un producto.
- Contadores derivados deben poder recalcularse.
- Solo habrá un schema Prisma canónico para PostgreSQL.

## 14. Convenciones de TypeScript

- `strict: true`; prohibido introducir `any` sin comentario y ticket de deuda.
- Preferir `unknown` y narrowing a casts inseguros.
- Nombres de archivo en kebab-case; componentes React en PascalCase.
- Tipos/clases en PascalCase; funciones/variables en camelCase; constantes globales en UPPER_SNAKE_CASE.
- Sufijos explícitos: `.controller.ts`, `.service.ts`, `.repository.ts`, `.schema.ts`, `.presenter.ts`.
- Un módulo exporta únicamente desde su `index.ts`.
- Imports absolutos por alias dentro del workspace; evitar cadenas profundas relativas.
- `interface` para contratos extensibles; `type` para uniones y composición.
- Estados y roles como uniones discriminadas/enums generados, no strings libres.
- Funciones pequeñas con retorno explícito en APIs públicas.
- No mezclar español e inglés en identificadores. Código e identificadores en inglés; copy de producto localizado.
- ESLint, formatter y typecheck son obligatorios en CI.

## 15. Manejo de errores

Se define una jerarquía estable:

- `ValidationError` -> 400/422.
- `AuthenticationError` -> 401.
- `AuthorizationError` -> 403.
- `NotFoundError` -> 404.
- `ConflictError` -> 409.
- `RateLimitError` -> 429.
- `ExternalServiceError` -> 502/503 según el caso.
- Errores inesperados -> 500.

Formato recomendado compatible con Problem Details:

```json
{
  "type": "https://yommi.app/problems/order-invalid-transition",
  "title": "Invalid order transition",
  "status": 409,
  "code": "ORDER_INVALID_TRANSITION",
  "detail": "The order cannot move from DELIVERED to PREPARING",
  "correlationId": "...",
  "errors": []
}
```

Reglas:

- El cliente recibe mensajes seguros y códigos estables, no stack traces.
- Logs incluyen stack, actor, tenant, request y correlation ID, con PII redactada.
- Errores Prisma se traducen en la frontera de infraestructura.
- Los controladores no repiten `try/catch`; un middleware central presenta errores.
- Fallos externos tienen timeout, circuit breaker cuando sea necesario y política de reintento explícita.

## 16. Seguridad y autorización

### Identidad y sesión

- `JWT_SECRET` o claves asimétricas son obligatorias y se gestionan en secret manager.
- Access tokens cortos; refresh tokens rotados/revocables o sesión en cookie HttpOnly/Secure/SameSite.
- MFA obligatorio para administradores de plataforma cuando esté disponible.
- Verificación de email, recuperación segura y rate limiting por identidad/IP.
- Suspensión y cambios de rol invalidan o revalidan sesiones.

### Autorización

Cada caso de uso evalúa:

1. Actor autenticado.
2. Rol/permisos.
3. Restaurante activo asociado.
4. Ownership del recurso.
5. Estado del recurso y acción permitida.

No se confía en roles, precios, restaurante, owner ID o estados provenientes del frontend.

### Controles adicionales

- CORS y CSP por entorno con allowlist.
- Validación estricta y límites de body/upload.
- Protección CSRF si se usan cookies.
- Sanitización de URLs y contenido generado.
- Rate limit específico para auth, claims, pedidos, IA y notificaciones.
- Tokens opacos criptográficamente fuertes para tracking público.
- SAST, SCA, secret scanning y DAST en pipeline.
- Auditoría inmutable de acciones administrativas y cambios sensibles.
- Backups, PITR y restauraciones probadas.
- Política de privacidad, consentimiento y retención para datos de clientes.

## 17. Eventos, jobs e integraciones futuras

Eventos de dominio iniciales:

- `RestaurantActivated`
- `CatalogPublished`
- `OrderCreated`
- `OrderAccepted`
- `OrderReady`
- `OrderCompleted`
- `OrderCancelled`
- `CustomerConsentUpdated`

Los eventos se guardan en una outbox dentro de la misma transacción. Un worker los entrega de forma idempotente a handlers de notifications, loyalty, analytics o integraciones.

WhatsApp, IA, push y email se implementan como adaptadores reemplazables. Cada integración define:

- Timeout y retry.
- Idempotency/deduplicación.
- Límites de costo y cuota.
- Observabilidad.
- Manejo de consentimiento.
- Fallback manual o determinista.

## 18. Estrategia de pruebas

### Pirámide

- **Unitarias:** dominio, políticas, cálculo de pedidos, estados, cupones y lealtad.
- **Integración:** repositorios Prisma contra PostgreSQL aislado, transacciones y constraints.
- **API/contract:** autenticación, schemas, códigos, DTOs y compatibilidad OpenAPI.
- **Autorización:** matriz de roles/tenant/ownership; casos negativos obligatorios.
- **Componentes frontend:** estados de carga, error, permisos y formularios.
- **E2E:** registro de restaurante, catálogo, pedido invitado/autenticado y operación del pedido.
- **No funcionales:** carga de creación/listado, seguridad, accesibilidad y recuperación.

### Reglas de calidad

- Cada bug crítico incorpora un test de regresión.
- No se mockea Prisma en pruebas que buscan verificar ownership o transacciones.
- Factories reemplazan seeds con contraseñas fijas.
- Tests son deterministas en tiempo y zona horaria.
- CI ejecuta lint, typecheck, unit, integration, build y pruebas críticas E2E.
- Migraciones se prueban hacia adelante con una copia anonimizada del esquema.
- Cobertura es una señal, no una meta aislada; módulos críticos exigen cobertura de reglas y ramas negativas.

## 19. Estrategia de ramas, commits y pull requests

### Ramas

Se recomienda trunk-based development con ramas cortas:

- `main`: siempre desplegable y protegida.
- `feat/<ticket>-<descripcion>`
- `fix/<ticket>-<descripcion>`
- `chore/<ticket>-<descripcion>`

No mantener ramas largas por ambiente. Los ambientes se promueven desde el mismo artefacto.

### Commits

- Commits pequeños, atómicos y reversibles.
- Formato Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Un commit no mezcla refactor mecánico con cambio funcional.
- No incluir secretos, bases locales, outputs temporales o archivos de usuario.
- Migración y código compatible se coordinan con estrategia expand/contract.

### Pull requests

Toda PR debe incluir:

- Problema y alcance.
- Decisiones y alternativas relevantes.
- Riesgos, seguridad y multi-tenancy.
- Evidencia de pruebas y build.
- Cambios de contrato o migración.
- Plan de rollback.
- Screenshots solo si cambia UI.

Requisitos:

- Al menos una revisión; dos para identity, orders, permisos o migraciones críticas.
- CI verde obligatorio.
- CODEOWNERS por módulos críticos.
- PRs pequeñas; cambios grandes se dividen con feature flags compatibles.
- Squash o historial limpio según política del equipo, conservando mensajes útiles.
- Nadie hace push directo a `main`.

## 20. Estrategia de refactor gradual

### Permitido refactorizar gradualmente

- Extraer schemas Zod y DTOs de rutas existentes.
- Crear un cliente API frontend común sin cambiar UX.
- Extraer servicios de aplicación desde `routes.ts` y `adminRoutes.ts`.
- Introducir repositorios por módulo y un único PrismaClient.
- Dividir dashboards/componentes grandes preservando comportamiento visual.
- Unificar utilidades duplicadas.
- Agregar tests de caracterización antes de mover lógica.
- Añadir autorización/ownership, transacciones e idempotencia.
- Crear rutas `/api/v1` y adaptar rutas legacy a los mismos servicios.
- Consolidar gradualmente el schema Prisma mediante migraciones revisadas.
- Mover uploads a object storage detrás de la misma interfaz.

### No debe reescribirse todavía

- No reescribir todo el frontend ni cambiar el diseño como parte de arquitectura.
- No reemplazar React/Vite, Express o Prisma sin evidencia técnica y ADR.
- No introducir microservicios, event broker complejo o Kubernetes por anticipación.
- No eliminar directorio, claims, dashboards o flujos existentes antes de medir su uso.
- No borrar tablas legacy de repartidores o comisiones sin migración y decisión de producto; deben congelarse y desacoplarse.
- No rehacer autenticación con un proveedor externo sin evaluar migración de usuarios.
- No implementar loyalty, coupons, WhatsApp o IA dentro de orders para “avanzar rápido”.
- No romper URLs públicas ni contratos usados por clientes durante la transición.
- No combinar el rediseño de base de datos con una renovación visual.

## 21. Secuencia recomendada de evolución

### Etapa A: estabilizar límites

- Tests de caracterización de identity, catalog y orders.
- Error handler y schemas compartidos.
- PrismaClient único y DTOs seguros.
- Matriz RBAC/ownership.

### Etapa B: extraer núcleo

- Módulo identity.
- Módulos restaurants y catalog.
- Módulo orders con transacción, snapshots, idempotencia y estados.
- Rutas legacy como adaptadores.

### Etapa C: relación con clientes

- Módulo customers y consentimiento.
- Tracking de estado seguro.
- Outbox y notifications básico.
- Suscripciones y entitlements del restaurante.

### Etapa D: extensiones

- Loyalty y coupons.
- QR y enlaces atribuibles.
- WhatsApp mediante notifications/integrations.
- AI gateway y casos medidos.

## 22. Decisiones explícitas

| Tema | Decisión |
|---|---|
| Estilo backend | Monolito modular |
| Unidad tenant | Restaurante; preparado para sucursal |
| Base transaccional | PostgreSQL |
| ORM | Prisma, encapsulado en repositorios |
| API | REST versionada + OpenAPI |
| Tiempo real | Eventos autenticados; no canal de comandos confiable |
| Estado frontend | Server state dedicado; Zustand para estado local/efímero |
| Dinero | Decimal o unidad mínima, nunca nuevos Float |
| Integraciones | Adaptadores asíncronos detrás de puertos |
| Eventos | Outbox transaccional antes que broker distribuido |
| Modelo comercial | Suscripción mensual, cero comisión por pedido |
| Delivery | Operación propia/externa del restaurante; no flota Yommi en MVP |
| IA | Optativa, medible y con confirmación humana en acciones sensibles |

## 23. Criterio de éxito arquitectónico

La arquitectura objetivo se considera adoptada cuando:

- Cada operación de negocio tiene un único servicio de aplicación.
- Ninguna ruta accede directamente a Prisma.
- Todo recurso multi-tenant verifica ownership.
- Los pedidos son idempotentes, transaccionales y auditables.
- Frontend y backend comparten contratos verificables.
- La plataforma puede desactivar IA, WhatsApp o notificaciones sin impedir pedidos.
- El mismo backend soporta varias réplicas sin cron duplicado, archivos locales o estado crítico en memoria.
- Una nueva capacidad puede añadirse como módulo sin modificar transversalmente todo el sistema.

## Orquestación de pagos sin intermediación

El contexto `orders` incorpora una política de pago, no un procesador financiero. Yommi no recibe, retiene, valida ni concilia fondos. Los métodos y estados canónicos se centralizan en TypeScript y las rutas operativas y administrativas consumen las mismas reglas.

Reglas arquitectónicas:

- `PICKUP` solo admite `PAY_AT_RESTAURANT`; delivery solo métodos habilitados por el restaurante.
- Transferencia requiere configuración mínima y confirmación humana antes de preparar.
- Ningún pedido llega a `DELIVERED` sin `PAID`.
- La confirmación y entrega de efectivo/pickup puede ejecutarse en una transacción atómica.
- Confirmar es idempotente y conserva el primer actor/timestamp.
- Un pago confirmado no puede cancelarse por el flujo normal porque Yommi no ofrece reembolsos.
- Los históricos nullable se presentan como `LEGACY_UNKNOWN` sin backfill inferido.
- Los datos bancarios se manejan con DTOs allowlist: nunca aparecen en directorios, búsquedas, métricas, logs o eventos WebSocket. La referencia completa solo se entrega al propietario durante edición o dentro de un pedido de transferencia autorizado.
- El adaptador temporal para clientes antiguos resuelve ausencia de método de forma determinista: pickup usa pago en restaurante; delivery prefiere el flujo histórico de efectivo. Debe retirarse tras sincronizar despliegues.

Este contexto no introduce SDKs de pasarela, webhooks financieros, ledger, conciliación ni dependencias externas.