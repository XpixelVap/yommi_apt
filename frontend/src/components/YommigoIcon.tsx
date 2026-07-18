import type { ImgHTMLAttributes } from 'react';

import bebidas128 from '../../../design/assets/food-icons/webp/128/bebidas.webp';
import cafe128 from '../../../design/assets/food-icons/webp/128/cafe.webp';
import desayuno128 from '../../../design/assets/food-icons/webp/128/desayuno.webp';
import ensalada128 from '../../../design/assets/food-icons/webp/128/ensalada.webp';
import hamburguesa128 from '../../../design/assets/food-icons/webp/128/hamburguesa.webp';
import pizza128 from '../../../design/assets/food-icons/webp/128/pizza.webp';
import postres128 from '../../../design/assets/food-icons/webp/128/postres.webp';
import snacks128 from '../../../design/assets/food-icons/webp/128/snacks.webp';
import sushi128 from '../../../design/assets/food-icons/webp/128/sushi.webp';
import taco128 from '../../../design/assets/food-icons/webp/128/taco.webp';
import busqueda32 from '../../../design/assets/ui-icons/webp/32/busqueda.webp';
import calificacion32 from '../../../design/assets/ui-icons/webp/32/calificacion.webp';
import calificacion64 from '../../../design/assets/ui-icons/webp/64/calificacion.webp';
import carritoCompras32 from '../../../design/assets/ui-icons/webp/32/carrito-compras.webp';
import delivery32 from '../../../design/assets/ui-icons/webp/32/delivery.webp';
import delivery64 from '../../../design/assets/ui-icons/webp/64/delivery.webp';
import favoritos32 from '../../../design/assets/ui-icons/webp/32/favoritos.webp';
import favoritos64 from '../../../design/assets/ui-icons/webp/64/favoritos.webp';
import notificaciones32 from '../../../design/assets/ui-icons/webp/32/notificaciones.webp';
import pago32 from '../../../design/assets/ui-icons/webp/32/pago.webp';
import pago64 from '../../../design/assets/ui-icons/webp/64/pago.webp';
import perfil32 from '../../../design/assets/ui-icons/webp/32/perfil.webp';
import pickup32 from '../../../design/assets/ui-icons/webp/32/pickup.webp';
import promociones32 from '../../../design/assets/ui-icons/webp/32/promociones.webp';
import promociones128 from '../../../design/assets/ui-icons/webp/128/promociones.webp';
import tiempo32 from '../../../design/assets/ui-icons/webp/32/tiempo.webp';
import ubicacion32 from '../../../design/assets/ui-icons/webp/32/ubicacion.webp';

export const YOMMIGO_FOOD_ICON_NAMES = [
  'hamburguesa',
  'pizza',
  'taco',
  'sushi',
  'ensalada',
  'desayuno',
  'snacks',
  'postres',
  'bebidas',
  'cafe',
] as const;

export const YOMMIGO_SERVICE_ICON_NAMES = [
  'busqueda',
  'calificacion',
  'carrito-compras',
  'delivery',
  'favoritos',
  'notificaciones',
  'pago',
  'perfil',
  'pickup',
  'promociones',
  'tiempo',
  'ubicacion',
] as const;

export type YommigoIconName =
  | (typeof YOMMIGO_FOOD_ICON_NAMES)[number]
  | (typeof YOMMIGO_SERVICE_ICON_NAMES)[number];

export type YommigoIconSize = 32 | 64 | 128 | 512;

interface YommigoIconProps {
  name: YommigoIconName;
  size: YommigoIconSize;
  alt: string;
  className?: string;
  loading?: ImgHTMLAttributes<HTMLImageElement>['loading'];
  priority?: boolean;
}

const ICON_SOURCES: Record<YommigoIconName, Partial<Record<YommigoIconSize, string>>> = {
  hamburguesa: { 128: hamburguesa128 },
  pizza: { 128: pizza128 },
  taco: { 128: taco128 },
  sushi: { 128: sushi128 },
  ensalada: { 128: ensalada128 },
  desayuno: { 128: desayuno128 },
  snacks: { 128: snacks128 },
  postres: { 128: postres128 },
  bebidas: { 128: bebidas128 },
  cafe: { 128: cafe128 },
  busqueda: { 32: busqueda32 },
  calificacion: { 32: calificacion32, 64: calificacion64 },
  'carrito-compras': { 32: carritoCompras32 },
  delivery: { 32: delivery32, 64: delivery64 },
  favoritos: { 32: favoritos32, 64: favoritos64 },
  notificaciones: { 32: notificaciones32 },
  pago: { 32: pago32, 64: pago64 },
  perfil: { 32: perfil32 },
  pickup: { 32: pickup32 },
  promociones: { 32: promociones32, 128: promociones128 },
  tiempo: { 32: tiempo32 },
  ubicacion: { 32: ubicacion32 },
};

export function YommigoIcon({
  name,
  size,
  alt,
  className = '',
  loading = 'lazy',
  priority = false,
}: YommigoIconProps) {
  const source = ICON_SOURCES[name][size];
  const classes = ['yommigo-icon', className].filter(Boolean).join(' ');

  if (!source) {
    return (
      <span
        className={`yommigo-icon-placeholder ${className}`.trim()}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={source}
      width={size}
      height={size}
      alt={alt}
      className={classes}
      loading={priority ? 'eager' : loading}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  );
}