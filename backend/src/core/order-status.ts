export const ORDER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'ON_THE_WAY',
  'DELIVERED',
  'CANCELLED'
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type LegacyOrderStatus = 'IN_TRANSIT' | 'COMPLETED';

const LEGACY_STATUS_ALIASES: Readonly<Record<LegacyOrderStatus, OrderStatus>> = {
  IN_TRANSIT: 'ON_THE_WAY',
  COMPLETED: 'DELIVERED'
};

const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['ON_THE_WAY', 'DELIVERED', 'CANCELLED'], // DELIVERED directly is pickup handoff
  ON_THE_WAY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
};

export class InvalidOrderTransitionError extends Error {
  readonly currentStatus: string;
  readonly requestedStatus: string;

  constructor(currentStatus: string, requestedStatus: string) {
    super(`Order cannot transition from ${currentStatus} to ${requestedStatus}`);
    this.name = 'InvalidOrderTransitionError';
    this.currentStatus = currentStatus;
    this.requestedStatus = requestedStatus;
  }
}

export function normalizeOrderStatus(status: unknown): OrderStatus | null {
  if (typeof status !== 'string') return null;
  if ((ORDER_STATUSES as readonly string[]).includes(status)) {
    return status as OrderStatus;
  }
  return LEGACY_STATUS_ALIASES[status as LegacyOrderStatus] ?? null;
}

export function resolveOrderTransition(
  currentStatus: unknown,
  requestedStatus: unknown
): OrderStatus {
  const current = normalizeOrderStatus(currentStatus);
  const requested = normalizeOrderStatus(requestedStatus);

  if (!current || !requested || !ORDER_TRANSITIONS[current].includes(requested)) {
    throw new InvalidOrderTransitionError(String(currentStatus), String(requestedStatus));
  }

  return requested;
}

export function canTransitionOrder(currentStatus: unknown, requestedStatus: unknown): boolean {
  try {
    resolveOrderTransition(currentStatus, requestedStatus);
    return true;
  } catch {
    return false;
  }
}