# Sprint 8A — Premium Polish de Yommigo

## Resultado

La landing pública fue pulida sin modificar backend, Prisma, contratos de API ni lógica de negocio. El resultado mantiene la estructura del concept art oficial, usa la hamburguesa oficial transparente y elimina señales comerciales simuladas o acciones sin destino real.

## Referencias utilizadas

- Concept art aprobado: `design/ChatGPT Image 15 jul 2026, 03_47_01 p.m..png`.
- `DESIGN_SYSTEM.md`.
- `UX_UI_AUDIT.md` (solo lectura; permanece fuera de este Sprint).
- `SPRINT_7A_REPORT.md`.
- `SPRINT_7D_REPORT.md`.
- Assets WebP oficiales de `design/assets/`.

## Cambios realizados

### Hero

- Sustitución de la imagen remota de Unsplash por `design/assets/hero/webp/512/hamburguesa-hero.webp`.
- Conservación de transparencia, `object-fit: contain`, dimensiones explícitas de 512 × 512 y prioridad alta de carga.
- Eliminación del óvalo, máscara radial, recorte y fondo artificial.
- Movimiento flotante limitado a 4 px y desactivado con `prefers-reduced-motion`.
- Sustitución de la cifra simulada “Más de 1,200 restaurantes” por una propuesta no cuantificada: “Pide directo a negocios de tu ciudad”.

### Jerarquía y sistema visual

- Consolidación de tokens de color, radios, bordes, sombras y transición de 200 ms en `landing.css`.
- Sombra base: `0 6px 24px rgba(36, 31, 28, 0.06)`.
- Jerarquía tipográfica reforzada para hero, títulos de sección, tarjetas, metadatos y estados.
- Elevación máxima de 3 px y escala máxima de 1.04.
- Estados hover, focus, active y selected coherentes.
- Foco visible y objetivos táctiles mínimos de 44 × 44 px en controles importantes.

### Buscador y navegación

- El CTA principal ahora incluye texto visible “Buscar” además del icono.
- Navbar simplificada a rutas existentes: restaurantes, ayuda, carrito y sesión.
- Menú móvil validado en apertura y cierre.
- La ruta pública `/` quedó aislada del `Layout` global. Esto evita montar en segundo plano el header heredado, solicitudes rotas a `/logo.png`, el prompt PWA y la geolocalización que no pertenecen a la landing.

### Categorías

- Conservación de los diez WebP oficiales en tamaño 128.
- Estado seleccionado reutilizable mediante `selected` y `aria-current`.
- Scroll horizontal con snap en tablet y móvil.
- Sin emojis, PNG máster ni rutas duplicadas.

### Restaurantes y promociones

- Eliminación de cuatro fotos remotas de respaldo.
- Eliminación de tiempos ficticios “25–35 min”, precio ficticio “$$” y etiqueta “Nuevo” sin fuente.
- Las tarjetas muestran únicamente datos recibidos: imagen/logo, categorías, modalidades, rating con conteo real, tiempo, nivel de precio y disponibilidad.
- Si falta imagen se muestra un placeholder neutro sin inventar fotografía.
- Estado operativo visible: Abierto, Pausado o Cerrado.
- `PromotionCard` solo se monta cuando el backend entrega una promoción real. En ausencia de ese dato no se simula una campaña.

### Footer y contenido no disponible

- Eliminación de enlaces `href="#"`, redes sociales sin URL, botones de idioma/moneda sin acción y enlaces legales inexistentes.
- Se conservaron accesos funcionales a Inicio, Restaurantes, Carrito, Iniciar sesión y Registrar restaurante.
- Ayuda, Privacidad, Términos y Contacto se muestran como información no interactiva hasta que existan destinos reales.
- Se eliminó el bloque ficticio de App Store, Google Play y QR.

## Diferencias justificadas respecto al concept art

1. No se muestra un banner promocional fijo porque el modelo y el endpoint público actuales no proporcionan promociones verificables.
2. No se muestran restaurantes, fotos, ratings, tiempos ni precios ficticios cuando la API no devuelve registros públicos.
3. No se muestra descarga de aplicación, QR o enlaces a tiendas porque no existen destinos reales.
4. No se muestran redes sociales, soporte, privacidad o términos como enlaces hasta contar con URLs reales.
5. El logotipo visible continúa construido con el componente `BrandMark`. Los PNG oficiales de logo siguen mostrando “Yommi”, deuda documentada en el pipeline, por lo que no se introdujo ese arte incorrecto.

Estas diferencias priorizan confianza y veracidad sin añadir funcionalidad.

## Archivos modificados

- `frontend/src/App.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/landing.css`
- `frontend/src/components/landing/CategoryCard.tsx`
- `frontend/src/components/landing/Footer.tsx`
- `frontend/src/components/landing/Hero.tsx`
- `frontend/src/components/landing/Navbar.tsx`
- `frontend/src/components/landing/PromotionCard.tsx`
- `frontend/src/components/landing/RestaurantCard.tsx`
- `frontend/src/components/landing/SearchBar.tsx`

No se modificaron archivos de backend, Prisma, API, dependencias ni lógica de negocio.

## Capturas reales

- `design/reports/sprint-8a/landing-desktop-1440.png`
- `design/reports/sprint-8a/landing-tablet-768.png`
- `design/reports/sprint-8a/landing-mobile-390.png`

Las capturas se generaron desde el navegador integrado contra `http://127.0.0.1:3000/`. La capacidad de viewport sí reportó los anchos CSS solicitados, pero el exportador limitó el PNG al área visible disponible del panel: 1037 × 1000, 753 × 523 y 375 × 318 respectivamente. La validación geométrica se hizo por separado en los seis anchos requeridos.

## Responsive

| Ancho CSS | Desbordamiento horizontal | Navegación |
|---:|---|---|
| 360 px | No | Menú móvil |
| 390 px | No | Menú móvil |
| 768 px | No | Menú móvil |
| 1024 px | No | Navbar desktop |
| 1280 px | No | Navbar desktop |
| 1440 px | No | Navbar desktop |

Se verificaron además ancho del hero, ancho del buscador, posición del footer y apertura/cierre del menú móvil.

## Rendimiento y peso

| Recurso | Antes | Después | Diferencia |
|---|---:|---:|---:|
| Chunk Home | 38.66 kB | 37.31 kB | -1.35 kB |
| Chunk Home gzip | 21.24 kB | 20.96 kB | -0.28 kB |
| CSS total | 66.16 kB | 66.27 kB | +0.11 kB |
| CSS gzip | 12.80 kB | 12.68 kB | -0.12 kB |
| Hero oficial | No incluido | 45.44 kB WebP | +45.44 kB de imagen |

No se añadieron dependencias ni imágenes duplicadas. En runtime no existen imágenes externas, imports PNG, enlaces vacíos ni imágenes rotas.

## Lighthouse

No fue posible ejecutar Lighthouse porque no está instalado en el proyecto ni disponible como comando del sistema:

- `node_modules/.bin/lighthouse.cmd`: no existe.
- `node_modules/lighthouse/lighthouse-cli/index.js`: no existe.
- `Get-Command lighthouse`: sin resultado.

No se instaló ninguna dependencia para respetar el alcance. Validación manual sugerida, en un entorno que ya tenga Lighthouse disponible:

```bash
lighthouse http://127.0.0.1:3000/ --only-categories=performance,accessibility,best-practices,seo --view
```

## Validaciones ejecutadas

- `npm run typecheck`: correcto.
- `npm test`: correcto, 28 pruebas (3 frontend + 25 backend).
- `npm run build`: correcto.
- Navegador: contenido real renderizado en `/`.
- Consola de la landing aislada: 0 errores y 0 advertencias.
- Imágenes rotas: 0.
- Imágenes externas: 0.
- Enlaces sin destino o `href="#"`: 0.
- Menú móvil: abre y cierra correctamente.
- Imports PNG máster en la landing: 0. El `Layout` heredado conserva dos referencias históricas a `/logo.png`, pero ya no se monta en `/`.
- `git diff --check`: correcto, sin errores de espacios o parches.

## Riesgos y pendientes

- El endpoint público no expone promociones; el componente queda preparado pero no se muestra con datos simulados.
- La landing depende de que `VITE_API_URL` apunte a un backend disponible para poblar restaurantes.
- Deben crearse destinos reales para Ayuda, Privacidad, Términos y Contacto antes de convertir sus etiquetas en enlaces.
- Los logos máster oficiales todavía dicen “Yommi”; deben corregirse a “Yommigo” sin hacerlo dentro de este Sprint.
- Lighthouse debe ejecutarse en CI o en un entorno que ya tenga la herramienta instalada.
## Ajuste posterior de escala visual

Tras revisar la landing en el navegador se corrigió la proporción señalada en la validación visual:

- Hero desktop: de un máximo de 540 px a 640 px; render verificado en 578 px dentro del viewport de 1440 px.
- Hero móvil: render verificado en 351 px dentro del viewport de 390 px.
- Iconos de categorías desktop: de 86 × 82 px a 106 × 100 px.
- Iconos de categorías móvil: 94 × 86 px.
- Iconos de beneficios: de 29 px a 39 px.
- Iconos de navbar, sesión, buscador y tarjeta local: aumento proporcional entre 25% y 35%.
- Sin desbordamiento horizontal ni imágenes rotas en desktop o móvil.

Validación posterior: `npm run typecheck` y `npm run build`, ambos correctos.