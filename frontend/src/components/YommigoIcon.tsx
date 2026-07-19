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
import busqueda128 from '../../../design/assets/ui-icons/webp/128/busqueda.webp';
import calificacion128 from '../../../design/assets/ui-icons/webp/128/calificacion.webp';
import carritoCompras128 from '../../../design/assets/ui-icons/webp/128/carrito-compras.webp';
import delivery128 from '../../../design/assets/ui-icons/webp/128/delivery.webp';
import favoritos128 from '../../../design/assets/ui-icons/webp/128/favoritos.webp';
import notificaciones128 from '../../../design/assets/ui-icons/webp/128/notificaciones.webp';
import pago128 from '../../../design/assets/ui-icons/webp/128/pago.webp';
import perfil128 from '../../../design/assets/ui-icons/webp/128/perfil.webp';
import pickup128 from '../../../design/assets/ui-icons/webp/128/pickup.webp';
import promociones128 from '../../../design/assets/ui-icons/webp/128/promociones.webp';
import tiempo128 from '../../../design/assets/ui-icons/webp/128/tiempo.webp';
import ubicacion128 from '../../../design/assets/ui-icons/webp/128/ubicacion.webp';

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

export type YommigoIconSize = 32 | 64 | 110 | 128 | 512;

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
  busqueda: { 110: busqueda128 },
  calificacion: { 110: calificacion128 },
  'carrito-compras': { 110: carritoCompras128 },
  delivery: { 110: delivery128 },
  favoritos: { 110: favoritos128 },
  notificaciones: { 110: notificaciones128 },
  pago: { 110: pago128 },
  perfil: { 110: perfil128 },
  pickup: { 110: pickup128 },
  promociones: { 110: promociones128 },
  tiempo: { 110: tiempo128 },
  ubicacion: { 110: ubicacion128 },
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