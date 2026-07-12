# Changelog

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