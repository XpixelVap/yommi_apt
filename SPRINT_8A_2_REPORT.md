# Sprint 8A.2 — Hero & Brand Final Art Direction

## Resultado

Se refinó exclusivamente la dirección de arte de la landing para que la primera lectura visual sea comida, búsqueda y categorías, en ese orden. No se agregaron funciones ni se modificaron contratos, lógica de negocio, backend, Prisma, Design System o Asset Pipeline.

## Archivos modificados en este sprint

- `frontend/src/components/landing/BrandMark.tsx`
- `frontend/src/landing.css`
- `SPRINT_8A_2_REPORT.md`

Los demás cambios que aparecen en el working tree pertenecen a los Sprints 8A y 8A.1 acumulados y no fueron reclasificados como parte de 8A.2.

## Decisiones visuales

### Hero

- La hamburguesa oficial WebP 512 se ajustó a un lienzo máximo de 850 px. Sus límites alfa ocupan aproximadamente el 50 % del lienzo, por lo que el alimento visible cubre cerca de 390 px: la referencia vertical entre el inicio del título y la parte inferior de “Buscar”.
- Se alineó hacia el extremo derecho de su columna y se desplazó 27 px hacia arriba.
- Se eliminó por completo el `drop-shadow` artificial y la animación flotante aplicada a la comida.
- No se añadieron fondos, elipses, máscaras ni recortes.
- El hero redujo su altura mínima y sus paddings verticales para disminuir espacio vacío sin aumentar texto, subtítulo o tipografía.

Justificación artística: una escala de campaña y una silueta limpia hacen que la comida sea reconocible antes que el mensaje. El anclaje al borde derecho genera tensión editorial sin invadir la lectura del buscador.

### Identidad de marca

- Se reemplazó el wordmark recreado con CSS por el asset oficial `yommigo-logotipo-horizontal-blanco.webp`, cuyo arte visible dice **Yommi**.
- El archivo se muestra sin filtros, recolor, edición ni recreación.
- Se incrementó su presencia mediante un contenedor de contraste naranja y dimensiones desktop de 190 × 90 px; en tablet y móvil conserva una escala controlada.
- La etiqueta accesible identifica la marca como Yommi.

Justificación artística: la marca deja de sentirse tipográfica o improvisada y pasa a usar su firma oficial con contraste estable y mayor peso en navegación.

### Iconografía UI y beneficios

- Los iconos UI oficiales utilizan WebP 128 como fuente y se renderizan a `110 × 110 px`.
- Favoritos, calificación y tiempo aumentaron dentro de las tarjetas existentes.
- Promociones aumentó dentro de su superficie condicional existente.
- Delivery, pago y calificación aumentaron 20 %, de 110 a 132 px, dentro de los mismos círculos de fondo.
- Los círculos, cuadrados y superficies de fondo conservaron sus medidas previas; únicamente aumentó el lienzo del icono.
- Pickup y notificaciones no tienen una superficie visible activa en la landing actual; no se insertaron elementos artificiales ni nuevas funciones para forzar su aparición.

### Categorías

Las reglas de tamaño de las categorías se conservaron exactamente como estaban al iniciar 8A.2. No se alteraron sus tarjetas, iconos, track ni proporciones responsive.

### “Apoya lo local”

- Se redujo a 182 px de ancho y 84 px de alto mínimo.
- Se desplazó hacia abajo y a la derecha.
- Su escala responsive se redujo para no competir con la hamburguesa.
- La sombra se hizo más amplia, suave y ligera para conservar el efecto flotante sin ganar contraste excesivo.

## Responsive

- Escritorio: hero en dos columnas, comida alineada a la derecha y desplazada 27 px hacia arriba.
- Tablet: lienzo máximo de 850 px y ajuste vertical proporcional.
- Móvil: composición apilada, comida centrada y lienzo máximo de 850 px, limitado proporcionalmente por el ancho disponible.
- Se mantienen objetivos táctiles mínimos y foco visible.

## Capturas reales

El navegador integrado no proporcionó control de automatización en esta sesión. Se intentó un fallback con Chrome/Edge headless y perfiles aislados, pero el navegador externo quedó separado de la instancia local de Vite y devolvió `ERR_CONNECTION_REFUSED`. Esa captura inválida fue eliminada y no se presenta como evidencia.

Por esta razón no se adjuntan capturas Desktop, Tablet o Mobile. La validación responsive se realizó sobre breakpoints, dimensiones explícitas, typecheck y build; queda pendiente una revisión visual manual en el navegador integrado cuando su control esté disponible.

## Validaciones

- `npm run typecheck`: correcto.
- `npm run build`: correcto; frontend y backend compilan, código de salida 0.
- `npm test`: correcto; 3 pruebas frontend y 25 pruebas backend.
- `git diff --check`: ejecutado al cierre.
- Imports PNG en la landing: ninguno.
- Asset de logo: WebP oficial 512.
- Asset del hero: WebP oficial 512.
- Backend y Prisma: sin cambios.
- Rutas: sin contratos ni destinos modificados en 8A.2.

## Riesgos pendientes

- La aprobación final de proporciones requiere una inspección humana de la landing renderizada en Desktop, Tablet y Mobile; la automatización visual no estuvo disponible en esta sesión.
- El logo oficial utiliza un lienzo cuadrado con transparencia alrededor del arte horizontal. El contenedor CSS conserva el archivo original y aporta contraste sin procesar el asset.

## Ajustes finales por referencia visual

- La hamburguesa alcanza un lienzo máximo de 850 px en escritorio para ocupar el recuadro de referencia.
- El movimiento por cursor está limitado a ±10 px horizontal y ±8 px vertical, vuelve al centro al salir y se desactiva con `prefers-reduced-motion`.
- “Apoya lo local” se superpone a la zona inferior derecha de la hamburguesa y permanece fija durante el movimiento.
- Monterrey se retiró del selector y de los valores predeterminados; Tijuana queda como ciudad inicial entre las opciones existentes.
- El resto de la landing no se modificó en este ajuste.
## Ajuste final de escala y color

- La hamburguesa aumentó 25 % adicional: máximo de 850 a 1,063 px en escritorio y ajuste proporcional en breakpoints.
- El fondo del marco del logotipo cambió a verde olivo `#87952f`, sin alterar el asset oficial.
- No se modificaron otros elementos.
## Corrección de proporción del hero

- Se detectó que la imagen sin contracción estaba aumentando la altura intrínseca de la fila del grid.
- El bloque visual conserva ahora una altura estable de 560 px en escritorio.
- La hamburguesa mantiene `flex: none`, pero su máximo se ajustó a 850 px para ocupar la columna derecha sin deformar la composición.
- Tablet y móvil vuelven a límites proporcionales de 780 px.
## Posición final de hamburguesa

- La hamburguesa se desplazó 80 px hacia la derecha en escritorio para coincidir con el marco visual aprobado.
- El parallax conserva su límite alrededor de esa nueva posición base.
- En tablet vertical y móvil el desplazamiento base vuelve a 0 px para evitar recortes.
## Ajuste de ritmo vertical

- La sección de categorías subió 60 px respecto a su posición anterior mediante un margen efectivo de -30 px frente al margen general de 30 px.
- Las secciones posteriores suben con el flujo normal del documento.
- No se modificaron tamaños, tarjetas ni contenido.