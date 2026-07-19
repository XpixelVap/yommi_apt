# Sprint 8A.1 — Visual Refinement (Art Direction)

## Resultado

Se refinó la composición de la landing para que la comida sea el punto focal principal, seguida por el buscador y las categorías. No se añadieron funcionalidades ni se modificaron backend, Prisma, API, rutas, lógica de negocio o pipeline de assets.

## Archivos modificados en Sprint 8A.1

- `frontend/src/landing.css`
- `SPRINT_8A_1_REPORT.md`

`frontend/src/components/landing/BrandMark.tsx` fue inspeccionado y probado temporalmente con el master oficial, pero su contenido final quedó igual al existente y no presenta diff funcional.

## Cambios realizados

### 1. Hamburguesa hero

- Se identificó que el crecimiento anterior estaba limitado por la regla global `max-width: 100%` aplicada a imágenes.
- Se añadió `max-width: none` exclusivamente al hero.
- El ancho visual pasó de estar limitado a la columna (aproximadamente 578 px en desktop) a permitir hasta 780 px.
- La imagen usa `width: min(140%, 780px)`.
- El bloque visual se desplazó 26 px a la derecha y 18 px hacia arriba.
- Se conserva transparencia, `object-fit: contain`, WebP oficial y movimiento máximo de 4 px.
- No se añadieron fondos, elipses ni sombras artificiales de superficie.

### 2. Logo

- El wordmark visible “Yommigo” aumentó de 37 px a 43 px, aproximadamente 16%.
- Se compactó su espaciado y se reajustaron proporcionalmente subrayado y acentos verdes.
- En móvil se usa 36 px y en footer 31 px.

#### Contradicción del asset maestro

Se inspeccionó `design/assets/logos/webp/512/yommigo-logotipo-horizontal-blanco.webp`. Aunque el nombre indica “Yommigo”, el arte visible dice “Yommi” y usa un lienzo cuadrado de 512 × 512 con contenido horizontal interno.

Se probó temporalmente en el navbar y se descartó porque:

- mostraba una marca distinta a “Yommigo”;
- generaba una presencia recortada y desproporcionada;
- contradecía la deuda ya documentada en el pipeline.

El master no fue modificado. Se conservó el wordmark existente “Yommigo”, escalado según la especificación, hasta que el arte oficial sea corregido.

### 3. Beneficios

- Círculos de icono: 52 px → 66 px.
- WebP visibles: 39 px → 58 px.
- Se mantuvieron alineación horizontal, texto y separación.
- El aumento compensa el espacio transparente interno de los assets sin deformarlos.

### 4. Categorías

- Tarjetas desktop: 152 px → 170 px de alto.
- Contenedor de icono desktop: 106 × 100 px → 118 × 112 px.
- Tarjetas móvil: 136 px → 150 px.
- Contenedor móvil: 94 × 86 px → 104 × 98 px.
- Se redujo la sensación de espacio vacío sin recortar ni deformar los WebP.

### 5. Buscador

- Altura principal: 66 px → 72 px.
- Campo interno: 64 px → 70 px.
- CTA “Buscar”: ancho mínimo de 112 px → 138 px.
- Icono CTA: 30 px → 32 px.
- El buscador conserva foco visible y objetivo táctil accesible.

### 6. Tarjeta “Apoya lo local”

- Ancho: 225 px → 198 px.
- Altura mínima: 102 px → 92 px.
- Padding: 19 px → 16 px.
- Posición: 10 px hacia fuera a la derecha y 32 px más abajo respecto al punto anterior.
- Iconografía reducida para no competir con la hamburguesa.
- Sombra refinada a `0 16px 38px rgba(36, 31, 28, 0.12)`.

### 7. Navbar

- Altura: 92 px → 84 px.
- Gap principal: 34 px → 28 px.
- Gap de navegación: 28 px → 24 px.
- Iconos de carrito y sesión se equilibraron a 32 px y 28 px.
- Se mantuvo toda la funcionalidad existente.

### 8. Jerarquía general

- El hero usa una relación 50/50 para mantener el título en dos líneas.
- El título desktop baja de un máximo de 64 px a 60 px, manteniendo peso y legibilidad.
- La hamburguesa puede sobresalir de su columna y dominar sin tapar el buscador.
- La iconografía secundaria de la sección inferior se redujo levemente para no competir con categorías y hero.
- En móvil se restablece el salto natural del título y se limita el hero a un máximo de 430 px.

## Diferencias antes/después

| Elemento | Antes de 8A.1 | Después |
|---|---:|---:|
| Hero desktop | limitado a ~578 px | hasta 780 px |
| Logo desktop | 37 px | 43 px |
| Beneficio: círculo | 52 px | 66 px |
| Beneficio: icono | 39 px | 58 px |
| Categoría: tarjeta | 152 px | 170 px |
| Categoría: icono | 106 × 100 px | 118 × 112 px |
| Buscador | 66 px | 72 px |
| CTA Buscar | 112 px mínimo | 138 px mínimo |
| Tarjeta local | 225 px | 198 px |
| Navbar | 92 px | 84 px |

## Responsive

Se definieron ajustes específicos para:

- desktop mayor a 1100 px;
- desktop/tablet entre 781 y 1100 px;
- tablet y móvil hasta 780 px;
- móvil hasta 540 px;
- móvil compacto hasta 380 px.

El hero mantiene `max-width: none` únicamente en su imagen y la página conserva `overflow: hidden` para impedir scroll horizontal visual. Categorías y restaurantes mantienen scroll horizontal controlado en breakpoints pequeños.

## Capturas

El navegador integrado estaba visible, pero el módulo local necesario para controlarlo no se encuentra instalado:

`C:/Users/user/.codex/plugins/cache/openai-bundled/browser/26.707.72221/scripts/browser-client.mjs`: no existe.

Se intentó una captura real con Chrome/Edge headless. La primera captura permitió detectar el asset incorrecto “Yommi”, pero tras corregirlo los procesos headless no produjeron una captura final fiable dentro del límite definido. Las capturas intermedias incorrectas se eliminaron y no se presentan como resultado final.

No se inventaron capturas ni métricas visuales posteriores.

## Validaciones

- `npm run typecheck`: correcto.
- `npm run build`: correcto.
- `npm test`: correcto, 28/28 pruebas.
- `git diff --check`: correcto.
- Backend modificado: no.
- Prisma modificado: no.
- API o rutas modificadas: no.
- Dependencias modificadas: no.
- Pipeline de assets modificado: no.
- Hero: WebP oficial de 512 px.
- PNG máster importados en landing: ninguno.

## Riesgos y pendientes

- El master de logo debe corregirse visualmente de “Yommi” a “Yommigo” antes de integrarlo en navbar y footer.
- Conviene realizar una última aprobación visual manual en `http://localhost:3000/` en 1440, 1024, 768, 390 y 360 px.
- La composición del hero ampliado debe aprobarse con el concept art a tamaño real, no mediante una captura escalada por el panel.