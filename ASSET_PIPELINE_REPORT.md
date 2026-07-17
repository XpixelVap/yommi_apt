# Reporte del pipeline de assets de Yommigo

## Resumen

El pipeline oficial descubre recursivamente los PNG m&aacute;ster dentro de `design/assets/`, excluye carpetas `webp/`, archivos ocultos y temporales, normaliza nombres y genera derivados WebP transparentes en 512, 128, 64 y 32 px.

La ejecuci&oacute;n proces&oacute; correctamente las cuatro colecciones encontradas sin modificar los PNG originales.

## Resultados

| M&eacute;trica | Resultado |
|---|---:|
| PNG encontrados | 25 |
| PNG procesados | 25 |
| WebP generados | 100 |
| Manifiestos generados | 4 |
| Colecciones procesadas | 4 |
| Errores | 0 |
| Colisiones de slug | 0 |
| Assets con advertencia de baja resoluci&oacute;n | 10 |

Colecciones procesadas:

- `design/assets/food-icons/`
- `design/assets/hero/`
- `design/assets/logos/`
- `design/assets/ui-icons/`

## Peso antes y despu&eacute;s

| Conjunto | Bytes | Peso aproximado |
|---|---:|---:|
| PNG m&aacute;ster | 32,068,847 | 30.58 MiB |
| WebP 512 px | 756,604 | 738.87 KiB |
| WebP 128 px | 113,370 | 110.71 KiB |
| WebP 64 px | 46,914 | 45.81 KiB |
| WebP 32 px | 22,150 | 21.63 KiB |
| Todos los WebP | 939,038 | 917.03 KiB |

La reducci&oacute;n aproximada al comparar el peso total de las cuatro variantes WebP contra los PNG originales es de **97.07 %**.

## Advertencias

Los siguientes diez PNG de `food-icons/` tienen resoluci&oacute;n original de 320x320 px. La variante de 512 px requiere ampliaci&oacute;n controlada; las variantes de 128, 64 y 32 px no requieren ampliaci&oacute;n:

- `ico-bebidas.png`
- `ico-cafe.png`
- `ico-desayuno.png`
- `ico-ensalada.png`
- `ico-hamburguesa.png`
- `ico-pizza.png`
- `ico-postres.png`
- `ico-snacks.png`
- `ico-sushi.png`
- `ico-taco.png`

No se detectaron colisiones de nombres ni errores de procesamiento.

## Validaciones

- 25 hashes SHA-256 de los PNG son id&eacute;nticos antes y despu&eacute;s de ejecutar el pipeline.
- Los 100 WebP tienen dimensiones cuadradas exactas seg&uacute;n su carpeta.
- Los 100 WebP conservan canal alfa.
- Los cuatro manifiestos contienen 25 entradas en total.
- Todas las rutas declaradas en los manifiestos existen.
- No se generaron derivados fuera de `design/assets/`.
- Typecheck frontend: correcto.
- Typecheck backend: correcto.
- Build frontend: correcto; 1,833 m&oacute;dulos transformados.
- Build backend: correcto.
- `git diff --check`: correcto.

## Comandos ejecutados

```bash
npm install --save-dev --ignore-scripts sharp@0.34.5 tsx@4.21.0
npm run optimize-assets
npm run typecheck
npm run build
npm run build --workspace=frontend
npm run build --workspace=backend
git diff --check
```

El primer intento de `npm run optimize-assets` dentro del sandbox fall&oacute; con `spawn EPERM`; se repiti&oacute; fuera del sandbox y termin&oacute; correctamente. No se ejecut&oacute; `npm audit fix`.

## Dependencias agregadas

- `sharp@^0.34.5`
- `tsx@^4.21.0`

## Archivos creados o modificados

- `scripts/optimize-assets.ts`
- `package.json`
- `package-lock.json`
- `DESIGN_SYSTEM.md`
- `ASSET_PIPELINE_REPORT.md`
- `design/assets/food-icons/webp/**`
- `design/assets/hero/webp/**`
- `design/assets/logos/webp/**`
- `design/assets/ui-icons/webp/**`

Los PNG ubicados en `design/assets/` son los m&aacute;sters proporcionados y permanecen intactos. El frontend y el backend no fueron modificados por este sprint.
