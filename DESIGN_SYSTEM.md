# Sistema de dise&ntilde;o de Yommigo

## Fuente oficial de assets

`design/assets/` es la fuente can&oacute;nica de los recursos visuales oficiales de Yommigo. Los archivos PNG dentro de sus colecciones son los m&aacute;sters y nunca deben modificarse, renombrarse ni reemplazarse durante la optimizaci&oacute;n web.

Los WebP son derivados para consumo web. El pipeline los genera dentro de una carpeta `webp/` junto a cada colecci&oacute;n de PNG:

```text
design/assets/<coleccion>/
|-- asset-original.png
`-- webp/
    |-- 512/
    |-- 128/
    |-- 64/
    |-- 32/
    `-- index.json
```

No edites manualmente ning&uacute;n archivo dentro de `webp/`. Cualquier correcci&oacute;n debe hacerse en el PNG m&aacute;ster y regenerarse con el pipeline.

## Tama&ntilde;os y usos

| Tama&ntilde;o | Uso previsto |
|---|---|
| 512 px | Hero, marketing y superficies grandes. |
| 128 px | Categor&iacute;as, tarjetas y descubrimiento. |
| 64 px | Navegaci&oacute;n, listas y paneles. |
| 32 px | Botones y elementos compactos. |

Todos los derivados son lienzos cuadrados transparentes. El contenido conserva su proporci&oacute;n, queda centrado y mantiene margen visual.

## Agregar un icono nuevo

1. Coloca el PNG aprobado en la colecci&oacute;n apropiada dentro de `design/assets/`.
2. Conserva el archivo original; el pipeline normaliza &uacute;nicamente el nombre del WebP.
3. Ejecuta:

   ```bash
   npm run optimize-assets
   ```

4. Revisa las advertencias de baja resoluci&oacute;n o colisiones.
5. Verifica el `webp/index.json` de la colecci&oacute;n antes de consumir el asset.

El descubrimiento es recursivo y no depende de una lista fija de carpetas. Las carpetas `webp/`, los archivos ocultos, los temporales y los formatos distintos de PNG se ignoran.

## Separaci&oacute;n entre imagen e interfaz

Las im&aacute;genes contienen &uacute;nicamente el recurso visual base. Estados, badges, n&uacute;meros, textos din&aacute;micos, interacciones y animaciones se agregan mediante React y CSS; nunca deben incorporarse dentro del PNG o WebP.
