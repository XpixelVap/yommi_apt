# Sprint 7D — Integraci&oacute;n oficial de iconograf&iacute;a Yommigo

## Resumen

Sprint 7D integra la iconograf&iacute;a WebP oficial de Yommigo en la landing p&uacute;blica sin modificar backend, Prisma, contratos de API ni l&oacute;gica de negocio. Los PNG m&aacute;ster no se importan ni se copian al frontend.

Se cre&oacute; <code>YommigoIcon</code> como punto &uacute;nico de acceso a las rutas. El componente acepta nombre, tama&ntilde;o, texto alternativo, clase, estrategia de carga y prioridad. Incluye dimensiones expl&iacute;citas, <code>object-fit: contain</code>, carga diferida y un placeholder neutro para una combinaci&oacute;n inexistente.

## Iconos reemplazados

### Categor&iacute;as — WebP de 128 px

- Hamburguesas: <code>hamburguesa</code>.
- Pizza: <code>pizza</code>.
- Tacos: <code>taco</code>.
- Sushi: <code>sushi</code>.
- Ensaladas: <code>ensalada</code>.
- Desayunos: <code>desayuno</code>.
- Antojitos: <code>snacks</code>.
- Postres: <code>postres</code>.
- Bebidas: <code>bebidas</code>.
- Caf&eacute;: <code>cafe</code>.

Se retiraron todos los emojis y el fallback visible &ldquo;M&aacute;s&rdquo; de las categor&iacute;as. La landing muestra los diez assets oficiales y mantiene navegaci&oacute;n por slug.

### Navegaci&oacute;n y controles — WebP de 32 px

- Ubicaci&oacute;n.
- B&uacute;squeda.
- Promociones.
- Favoritos.
- Carrito de compras.
- Perfil.
- Calificaci&oacute;n.
- Tiempo.

Los contadores del carrito, estados hover, foco y disposici&oacute;n responsive contin&uacute;an siendo React/CSS; no est&aacute;n incrustados en las im&aacute;genes.

### Beneficios y superficies grandes

- Delivery: 64 px.
- Pago: 64 px.
- Calificaci&oacute;n/restaurante verificado: 64 px.
- Favoritos/apoyo local: 64 px.
- Promociones: 128 px.

Los assets <code>notificaciones</code>, <code>pickup</code> y las variantes de servicio de 32 px est&aacute;n centralizados en el mapa, pero no se muestran porque la landing actual no contiene controles reales para esas funciones. A&ntilde;adirlos visualmente implicar&iacute;a crear funcionalidad fuera del alcance.

## Accesibilidad y movimiento

- Los iconos junto a texto o dentro de controles con nombre accesible usan <code>alt=""</code>.
- Las acciones cr&iacute;ticas conservan texto visible o <code>aria-label</code>.
- Los controles m&oacute;viles y botones inferiores tienen objetivo t&aacute;ctil m&iacute;nimo de 44 px.
- Todos los elementos <code>img</code> tienen <code>width</code> y <code>height</code> expl&iacute;citos.
- Los iconos fuera del primer viewport usan <code>loading="lazy"</code>.
- Las transiciones duran 200 ms, con elevaci&oacute;n m&aacute;xima de 3 px y escala m&aacute;xima de 1.04.
- La regla existente <code>prefers-reduced-motion</code> desactiva movimiento no esencial.

## Archivos modificados

- <code>frontend/src/components/YommigoIcon.tsx</code> — nuevo.
- <code>frontend/src/components/landing/CategoryCard.tsx</code>.
- <code>frontend/src/components/landing/Hero.tsx</code>.
- <code>frontend/src/components/landing/Navbar.tsx</code>.
- <code>frontend/src/components/landing/PromotionCard.tsx</code>.
- <code>frontend/src/components/landing/RestaurantCard.tsx</code>.
- <code>frontend/src/components/landing/SearchBar.tsx</code>.
- <code>frontend/src/pages/Home.tsx</code>.
- <code>frontend/src/landing.css</code>.
- <code>SPRINT_7D_REPORT.md</code>.

No se modificaron archivos de backend ni Prisma.

## Peso aproximado de iconograf&iacute;a

| Grupo | Bytes |
|---|---:|
| Diez categor&iacute;as WebP 128 px | 66,086 |
| Doce servicios WebP 32 px | 8,136 |
| Cuatro beneficios WebP 64 px | 4,928 |
| Promociones WebP 128 px | 3,608 |
| Total referenciado | 82,758 bytes / 80.82 KiB |

El primer enfoque de mapa inclu&iacute;a todas las resoluciones y elevaba el chunk Home a 99.95 kB gzip. Se restringi&oacute; el mapa a variantes justificadas; el resultado final de Home es **38.66 kB / 21.24 kB gzip**. Los diez WebP de categor&iacute;as se emiten como assets independientes y el navegador los carga de forma diferida cuando corresponde.

## Placeholders y recursos pendientes

No hay placeholders en las diez categor&iacute;as ni rutas de iconos oficiales rotas.

Permanecen, porque no existe asset oficial equivalente:

- Ayuda: icono de interfaz existente.
- Abrir/cerrar men&uacute;: controles de interfaz existentes.
- Flechas direccionales: controles de navegaci&oacute;n existentes.
- Redes sociales: iconos de marca existentes.
- Marcas provisionales de App Store y Google Play.
- QR de la aplicaci&oacute;n marcado como &ldquo;pr&oacute;ximamente&rdquo;.

No se inventaron iconos ni se reutilizaron assets con un significado incorrecto.

## Validaci&oacute;n visual y responsive

La landing se comprob&oacute; en navegador real:

| Vista | Resultado |
|---|---|
| Escritorio 1440x900 | 31 instancias, 21 URLs oficiales &uacute;nicas, cero iconos rotos y diez categor&iacute;as visibles. |
| Tablet 768x1024 | Sin desbordamiento de p&aacute;gina; carril horizontal de categor&iacute;as intencional. |
| M&oacute;vil 390x844 | Sin desbordamiento de p&aacute;gina; carril de categor&iacute;as responsive y controles m&iacute;nimos de 44 px. |

- Ning&uacute;n <code>YommigoIcon</code> usa PNG.
- Ning&uacute;n icono tiene <code>naturalWidth = 0</code>.
- La interfaz visible revisada permanece en espa&ntilde;ol.
- La consola no registr&oacute; errores de carga de assets.
- La consola conserva un error preexistente de geolocalizaci&oacute;n en <code>Layout.tsx</code>; no fue causado ni modificado por Sprint 7D.

## Validaciones ejecutadas

    npm run typecheck
    npm run build
    npm test
    git diff --check

Resultados:

- Typecheck frontend: correcto.
- Typecheck backend: correcto.
- Build frontend: correcto; 1,861 m&oacute;dulos transformados.
- Build backend: correcto.
- Tests frontend: 3/3.
- Tests backend: 25/25.
- Rutas WebP rotas: 0.
- Imports de PNG m&aacute;ster desde frontend: 0.
- Assets fuente duplicados dentro de frontend: 0.
- Cambios en backend: 0.

## Riesgos e inconsistencias visuales

- La iconograf&iacute;a oficial mezcla composiciones y escalas internas diferentes; se normaliz&oacute; solo mediante <code>object-fit: contain</code>, sin alterar los archivos.
- Los iconos de servicio tienen detalle visual alto para controles de 32 px; deben revisarse en dispositivos de baja densidad durante el piloto.
- La landing mantiene fotograf&iacute;as remotas de Unsplash; no forman parte de Sprint 7D.
- El arte de los logos todav&iacute;a muestra &ldquo;Yommi&rdquo;; esta deuda visual pertenece a Sprint 7C.1 y requiere aprobaci&oacute;n separada.
- Los controles de app, QR, ayuda y redes necesitan assets oficiales futuros si se desea eliminar por completo la iconograf&iacute;a gen&eacute;rica.