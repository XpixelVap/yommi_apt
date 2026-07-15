export const OPERATIONAL_STATUSES = ['OPEN', 'PAUSED', 'CLOSED'] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export type OperationalAvailabilityCode =
  | 'RESTAURANT_OPEN'
  | 'RESTAURANT_PAUSED'
  | 'RESTAURANT_CLOSED'
  | 'RESTAURANT_OUTSIDE_HOURS'
  | 'RESTAURANT_UNAVAILABLE';

export interface OperationalRestaurant {
  id?: string;
  status?: string | null;
  isActive?: boolean;
  operationalStatus?: string | null;
  opening_hours?: string | null;
  timezone?: string | null;
  manualOpenUntil?: Date | string | null;
}

export interface OperationalAvailability {
  acceptingOrders: boolean;
  code: OperationalAvailabilityCode;
  message: string;
  operationalStatus: OperationalStatus;
  withinRegularHours: boolean;
  manualOpenActive: boolean;
}

export class OperationalRuleError extends Error {
  constructor(public readonly code: OperationalAvailabilityCode | 'INVALID_OPERATIONAL_STATE', message: string) {
    super(message);
    this.name = 'OperationalRuleError';
  }
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_ALIASES: Record<string, typeof DAY_KEYS[number]> = {
  sunday: 'sunday', domingo: 'sunday',
  monday: 'monday', lunes: 'monday',
  tuesday: 'tuesday', martes: 'tuesday',
  wednesday: 'wednesday', miercoles: 'wednesday',
  thursday: 'thursday', jueves: 'thursday',
  friday: 'friday', viernes: 'friday',
  saturday: 'saturday', sabado: 'saturday'
};

interface TimeRange { start: number; end: number }
type ParsedSchedule = Partial<Record<typeof DAY_KEYS[number], TimeRange | null>>;

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function parseOpeningHours(value: string | null | undefined): ParsedSchedule | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const schedule: ParsedSchedule = {};
    for (const [rawDay, rawHours] of Object.entries(raw)) {
      const normalizedDay = rawDay.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const day = DAY_ALIASES[normalizedDay];
      if (!day || typeof rawHours !== 'string') return null;
      const hours = rawHours.trim();
      if (/^(cerrado|closed)$/i.test(hours)) {
        schedule[day] = null;
        continue;
      }
      const parts = hours.split('-');
      if (parts.length !== 2) return null;
      const start = parseTime(parts[0]);
      const end = parseTime(parts[1]);
      if (start === null || end === null || start === end) return null;
      schedule[day] = { start, end };
    }
    return Object.keys(schedule).length > 0 ? schedule : null;
  } catch {
    return null;
  }
}

export function isValidOpeningHours(value: string | null | undefined): boolean {
  return parseOpeningHours(value) !== null;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function zonedClock(now: Date, timezone: string): { dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const weekday = parts.find(part => part.type === 'weekday')?.value;
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday || '');
  if (dayIndex < 0 || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new OperationalRuleError('INVALID_OPERATIONAL_STATE', 'No se pudo interpretar el horario del restaurante.');
  }
  return { dayIndex, minutes: hour * 60 + minute };
}

export function isWithinOpeningHours(
  openingHours: string | null | undefined,
  timezone: string,
  now = new Date()
): boolean {
  const schedule = parseOpeningHours(openingHours);
  if (!schedule || !isValidTimezone(timezone)) return false;
  const { dayIndex, minutes } = zonedClock(now, timezone);
  const today = schedule[DAY_KEYS[dayIndex]];
  if (today) {
    if (today.end > today.start && minutes >= today.start && minutes < today.end) return true;
    if (today.end < today.start && minutes >= today.start) return true;
  }
  const previous = schedule[DAY_KEYS[(dayIndex + 6) % 7]];
  return Boolean(previous && previous.end < previous.start && minutes < previous.end);
}

export function validateManualOpenUntil(
  status: OperationalStatus,
  manualOpenUntil: Date | null | undefined,
  now = new Date()
): Date | null {
  if (status !== 'OPEN') {
    if (manualOpenUntil) {
      throw new OperationalRuleError('INVALID_OPERATIONAL_STATE', 'La apertura manual solo es v?lida cuando el estado es OPEN.');
    }
    return null;
  }
  if (!manualOpenUntil) return null;
  const timestamp = manualOpenUntil.getTime();
  const maximum = now.getTime() + 24 * 60 * 60 * 1000;
  if (!Number.isFinite(timestamp) || timestamp <= now.getTime() || timestamp > maximum) {
    throw new OperationalRuleError('INVALID_OPERATIONAL_STATE', 'La apertura manual debe vencer en el futuro y dentro de las pr?ximas 24 horas.');
  }
  return manualOpenUntil;
}

export function getOperationalAvailability(
  restaurant: OperationalRestaurant,
  now = new Date()
): OperationalAvailability {
  const rawStatus = restaurant.operationalStatus;
  const operationalStatus: OperationalStatus = OPERATIONAL_STATUSES.includes(rawStatus as OperationalStatus)
    ? rawStatus as OperationalStatus
    : 'CLOSED';
  const base = { operationalStatus, withinRegularHours: false, manualOpenActive: false };

  if (restaurant.status !== 'approved' || !restaurant.isActive) {
    return { ...base, acceptingOrders: false, code: 'RESTAURANT_UNAVAILABLE', message: 'El restaurante no est? disponible para recibir pedidos.' };
  }
  if (operationalStatus === 'PAUSED') {
    return { ...base, acceptingOrders: false, code: 'RESTAURANT_PAUSED', message: 'El restaurante paus? temporalmente los pedidos.' };
  }
  if (operationalStatus === 'CLOSED') {
    return { ...base, acceptingOrders: false, code: 'RESTAURANT_CLOSED', message: 'El restaurante est? cerrado y no recibe pedidos en este momento.' };
  }

  const timezone = restaurant.timezone || 'America/Tijuana';
  const withinRegularHours = isWithinOpeningHours(restaurant.opening_hours, timezone, now);
  const manualUntil = restaurant.manualOpenUntil ? new Date(restaurant.manualOpenUntil) : null;
  const manualOpenActive = Boolean(manualUntil && Number.isFinite(manualUntil.getTime()) && manualUntil.getTime() > now.getTime());
  if (withinRegularHours || manualOpenActive) {
    return {
      operationalStatus,
      withinRegularHours,
      manualOpenActive,
      acceptingOrders: true,
      code: 'RESTAURANT_OPEN',
      message: manualOpenActive && !withinRegularHours ? 'El restaurante est? abierto temporalmente.' : 'El restaurante est? abierto y recibe pedidos.'
    };
  }
  return {
    operationalStatus,
    withinRegularHours,
    manualOpenActive: false,
    acceptingOrders: false,
    code: 'RESTAURANT_OUTSIDE_HOURS',
    message: 'El restaurante est? fuera de su horario de atenci?n.'
  };
}

export async function updateOperationalStatus(args: {
  prisma: any;
  restaurantId: string;
  actor: { id: string; role: string };
  status: OperationalStatus;
  manualOpenUntil?: Date | null;
  now?: Date;
}) {
  const { prisma, restaurantId, actor, status } = args;
  const now = args.now ?? new Date();
  if (actor.role !== 'ADMIN' && !(actor.role === 'RESTAURANT' && actor.id === restaurantId)) {
    throw new OperationalRuleError('INVALID_OPERATIONAL_STATE', 'No tienes permiso para cambiar el estado operativo de este restaurante.');
  }
  const manualOpenUntil = validateManualOpenUntil(status, args.manualOpenUntil, now);
  return prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      operationalStatus: status,
      manualOpenUntil,
      operationalStatusChangedAt: now,
      operationalStatusChangedById: actor.id,
      operationalStatusChangedByRole: actor.role
    }
  });
}
