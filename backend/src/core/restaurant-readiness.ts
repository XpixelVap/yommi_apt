export interface ReadinessProduct {
  isAvailable: boolean;
  price: number;
}

export interface ReadinessCategory {
  products?: ReadinessProduct[];
}

export interface ReadinessRestaurant {
  restaurant_name?: string | null;
  phone_number?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  opening_hours?: string | null;
  has_delivery?: boolean;
  has_pickup?: boolean;
  categories?: ReadinessCategory[];
  products?: ReadinessProduct[];
}

export type ReadinessKey =
  | 'name'
  | 'contact'
  | 'location'
  | 'hours'
  | 'fulfillment'
  | 'menu';

export interface ReadinessItem {
  key: ReadinessKey;
  label: string;
  completed: boolean;
  blocker: string | null;
}

export interface RestaurantReadiness {
  ready: boolean;
  percentage: number;
  checklist: ReadinessItem[];
  blockers: string[];
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasValidHours(value: string | null | undefined): boolean {
  if (!hasText(value)) return false;
  try {
    const parsed = JSON.parse(value as string);
    return Boolean(parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0);
  } catch {
    return false;
  }
}

function hasValidLocation(restaurant: ReadinessRestaurant): boolean {
  return hasText(restaurant.address) || (
    Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng)
  );
}

function availableProducts(restaurant: ReadinessRestaurant): ReadinessProduct[] {
  if (restaurant.products) return restaurant.products;
  return (restaurant.categories ?? []).flatMap(category => category.products ?? []);
}

export function getRestaurantReadiness(
  restaurant: ReadinessRestaurant
): RestaurantReadiness {
  const checks: Array<Omit<ReadinessItem, 'blocker'> & { blocker: string }> = [
    { key: 'name', label: 'Nombre del negocio', completed: hasText(restaurant.restaurant_name), blocker: 'Agrega el nombre del negocio.' },
    { key: 'contact', label: 'Contacto', completed: hasText(restaurant.phone_number), blocker: 'Agrega un teléfono de contacto.' },
    { key: 'location', label: 'Ubicación o dirección', completed: hasValidLocation(restaurant), blocker: 'Agrega una dirección o ubicación válida.' },
    { key: 'hours', label: 'Horarios', completed: hasValidHours(restaurant.opening_hours), blocker: 'Confirma los horarios de atención.' },
    { key: 'fulfillment', label: 'Modalidad', completed: Boolean(restaurant.has_pickup || restaurant.has_delivery), blocker: 'Habilita pickup o delivery.' },
    { key: 'menu', label: 'Menú mínimo', completed: availableProducts(restaurant).some(product => product.isAvailable && Number.isFinite(product.price) && product.price > 0), blocker: 'Agrega al menos un producto disponible con precio válido.' }
  ];

  const checklist: ReadinessItem[] = checks.map(check => ({
    ...check,
    blocker: check.completed ? null : check.blocker
  }));
  const completed = checklist.filter(item => item.completed).length;
  const blockers = checklist.flatMap(item => item.blocker ? [item.blocker] : []);

  return {
    ready: blockers.length === 0,
    percentage: Math.round((completed / checklist.length) * 100),
    checklist,
    blockers
  };
}

export function isRestaurantProfileMinimumComplete(
  readiness: RestaurantReadiness
): boolean {
  return readiness.checklist
    .filter(item => item.key !== 'menu')
    .every(item => item.completed);
}