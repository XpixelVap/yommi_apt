# Sprint 8A.3 — Hero dinámico contextual

## Resultado

Se preparó el hero público para seleccionar imágenes oficiales por momento del día sin cambiar su composición visual, su interacción con el cursor ni el comportamiento responsive aprobado.

## Archivos modificados

- `frontend/src/config/hero-catalog.ts`: catálogo tipado, validación de nombres, franjas horarias, selección determinista y fallbacks.
- `frontend/src/config/hero-runtime.ts`: adaptación del manifiesto oficial y carga diferida de WebP 512.
- `frontend/src/components/landing/DynamicHeroImage.tsx`: componente reutilizable con dimensiones explícitas, prioridad configurable y estado neutro.
- `frontend/src/components/landing/Hero.tsx`: sustitución del import estático por el componente dinámico.
- `frontend/src/landing.css`: compatibilidad del placeholder con la composición y los breakpoints actuales.
- `frontend/src/tests/hero-catalog.test.ts`: pruebas unitarias del catálogo y la selección contextual.
- `frontend/package.json`: inclusión de las pruebas del hero en el comando de tests.
- `DESIGN_SYSTEM.md`: reglas operativas para nuevos assets del hero.

## Reglas implementadas

- Fuente exclusiva: `design/assets/hero/webp/index.json`.
- Convención: `hero-<categoria>-<momento>.png`.
- Categorías permitidas: hamburguesa, pizza, tacos, sushi, ensalada, desayuno, antojitos, postres, bebidas y cafe.
- Momentos permitidos: manana, comida, tarde, noche y general.
- Franjas locales: mañana 05:00–10:59, comida 11:00–15:59, tarde 16:00–18:59 y noche 19:00–04:59.
- Selección estable por fecha local y franja; no cambia durante el mismo bloque horario.
- Prioridad: coincidencia contextual, hero general y fallback oficial.
- Carga diferida mediante `import.meta.glob`; solo se solicita el WebP 512 seleccionado.
- Los nombres inválidos y los archivos sin variante 512 se ignoran con advertencia solo en desarrollo.
- No se importan PNG al frontend ni se copian assets a `public`.

## Catálogo detectado

El manifiesto actual contiene un único asset: `hamburguesa-hero.png`, cuya variante 512 pesa 45,438 bytes. Su nombre es anterior a la convención nueva, por lo que permanece como fallback oficial controlado. No existen todavía héroes contextuales válidos.

## Fallbacks

1. Imagen de la franja horaria actual.
2. Imagen con momento `general`.
3. Hamburguesa oficial existente.
4. Espacio neutro accesible si el archivo seleccionado y el fallback no pueden cargarse.

No se inventan categorías, horarios ni imágenes cuando el catálogo está vacío o incompleto.

## Pruebas añadidas

- Horario normal de mañana, comida, tarde y noche.
- Selección determinista.
- Estabilidad dentro del mismo bloque horario.
- Catálogo vacío.
- Fallback general.
- Fallback oficial de hamburguesa.
- Rechazo y advertencia por nombres inválidos.
- Prioridad de un asset contextual frente a los fallbacks.

## Impacto de carga

- Hero seleccionado: 45.44 kB WebP.
- Módulo lazy del asset: 0.07 kB (0.09 kB gzip).
- Chunk `Home`: 64.92 kB (41.07 kB gzip), aproximadamente +3.44 kB sin comprimir y +1.50 kB gzip frente a la medición anterior.
- El navegador no descarga múltiples imágenes del catálogo para resolver la selección.

## Validaciones ejecutadas

- `npm run optimize-assets`: correcto; 25 PNG procesados y sin cambios de contenido en assets o manifiestos.
- `npm test`: correcto; 36 pruebas aprobadas (11 frontend y 25 backend).
- `npm run typecheck`: correcto en frontend y backend.
- `npm run build`: correcto en frontend y backend.
- `git diff --check`: correcto; solo avisos informativos de normalización LF/CRLF.
- Cero imports PNG en `frontend/src`.
- Cero cambios en backend y Prisma durante el Sprint 8A.3.

## Assets pendientes

Faltan imágenes oficiales con nombres compatibles para `manana`, `comida`, `tarde` y `noche`. También conviene incorporar al menos un `hero-<categoria>-general.png` antes de retirar el fallback legacy. Cada PNG maestro nuevo debe optimizarse con `npm run optimize-assets`; el código no requiere cambios si la categoría y el momento ya están permitidos.

## Riesgos

- Mientras solo exista el asset legacy, la imagen no variará por contexto.
- Renombrar o retirar `hamburguesa-hero.png` sin regenerar el manifiesto dejaría únicamente el estado neutro.
- El momento se calcula al montar el componente; una pestaña que permanezca abierta al cruzar de franja conserva su selección estable hasta recargar.

No se realizaron commits ni push.
