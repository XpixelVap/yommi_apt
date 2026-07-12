export const PAYMENT_METHODS = ['PAY_AT_RESTAURANT', 'CASH_ON_DELIVERY', 'BANK_TRANSFER'] as const;
export const PAYMENT_STATUSES = ['PENDING', 'AWAITING_CONFIRMATION', 'PAID', 'CANCELLED'] as const;
export const PAYMENT_CONFIRMATION_ROLES = ['RESTAURANT', 'ADMIN'] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export type PaymentConfirmationRole = typeof PAYMENT_CONFIRMATION_ROLES[number];
export type PaymentFulfillmentType = 'PICKUP' | 'DELIVERY';

export interface PaymentConfiguration {
  acceptsPayAtRestaurant: boolean;
  acceptsCashOnDelivery: boolean;
  acceptsBankTransfer: boolean;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  bankAccountReference?: string | null;
  paymentConfirmationPhone?: string | null;
}

export class PaymentRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRuleError';
  }
}

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

export function hasMinimumBankConfiguration(config: PaymentConfiguration): boolean {
  return hasText(config.bankName)
    && hasText(config.bankAccountHolder)
    && hasText(config.bankAccountReference)
    && hasText(config.paymentConfirmationPhone);
}

export function availablePaymentMethods(
  fulfillmentType: PaymentFulfillmentType,
  config: PaymentConfiguration
): PaymentMethod[] {
  if (fulfillmentType === 'PICKUP') {
    return config.acceptsPayAtRestaurant ? ['PAY_AT_RESTAURANT'] : [];
  }
  const methods: PaymentMethod[] = [];
  if (config.acceptsCashOnDelivery) methods.push('CASH_ON_DELIVERY');
  if (config.acceptsBankTransfer && hasMinimumBankConfiguration(config)) methods.push('BANK_TRANSFER');
  return methods;
}

export function resolvePaymentMethod(
  fulfillmentType: PaymentFulfillmentType,
  requestedMethod: PaymentMethod | undefined,
  config: PaymentConfiguration
): PaymentMethod {
  const available = availablePaymentMethods(fulfillmentType, config);
  // Temporary compatibility adapter: old clients omit paymentMethod. Pickup is
  // deterministic; delivery prefers the existing cash flow, then transfer.
  const method = requestedMethod ?? (fulfillmentType === 'PICKUP'
    ? 'PAY_AT_RESTAURANT'
    : available.includes('CASH_ON_DELIVERY') ? 'CASH_ON_DELIVERY' : available[0]);
  if (!method || !available.includes(method)) {
    throw new PaymentRuleError('Payment method is not available for this order');
  }
  return method;
}

export function initialPaymentStatus(method: PaymentMethod): PaymentStatus {
  return method === 'BANK_TRANSFER' ? 'AWAITING_CONFIRMATION' : 'PENDING';
}

export function assertPaymentCompatibleOrderTransition(
  paymentMethod: string | null,
  paymentStatus: string | null,
  requestedOrderStatus: string
): void {
  if (requestedOrderStatus === 'PREPARING'
    && paymentMethod === 'BANK_TRANSFER'
    && paymentStatus !== 'PAID') {
    throw new PaymentRuleError('Bank transfer must be confirmed before preparing the order');
  }
  if (requestedOrderStatus === 'DELIVERED' && paymentStatus !== 'PAID') {
    throw new PaymentRuleError('Payment must be confirmed before delivering the order');
  }
  if (requestedOrderStatus === 'CANCELLED' && paymentStatus === 'PAID') {
    throw new PaymentRuleError('Paid orders require manual resolution and cannot be cancelled normally');
  }
}

export function paymentStatusForCancellation(currentStatus: string | null): PaymentStatus {
  if (currentStatus === 'PAID') {
    throw new PaymentRuleError('Paid orders require manual resolution and cannot be cancelled normally');
  }
  if (currentStatus === null) throw new PaymentRuleError('Legacy payment status requires manual resolution');
  return 'CANCELLED';
}

export interface PaymentConfirmationResult {
  changed: boolean;
  paymentStatus: 'PAID';
  paymentConfirmedAt: Date | null;
  paymentConfirmedById: string | null;
  paymentConfirmedByRole: PaymentConfirmationRole | null;
}


export function canActorConfirmPayment(
  actor: { id: string; role: string },
  orderRestaurantId: string
): actor is { id: string; role: PaymentConfirmationRole } {
  return actor.role === 'ADMIN'
    || (actor.role === 'RESTAURANT' && actor.id === orderRestaurantId);
}

export function confirmPayment(
  currentStatus: string | null,
  actorId: string,
  actorRole: PaymentConfirmationRole,
  now = new Date(),
  existing?: { paymentConfirmedAt?: Date | null; paymentConfirmedById?: string | null; paymentConfirmedByRole?: string | null }
): PaymentConfirmationResult {
  if (!PAYMENT_CONFIRMATION_ROLES.includes(actorRole)) throw new PaymentRuleError('Actor cannot confirm payments');
  if (currentStatus === 'PAID') {
    return {
      changed: false,
      paymentStatus: 'PAID',
      paymentConfirmedAt: existing?.paymentConfirmedAt ?? null,
      paymentConfirmedById: existing?.paymentConfirmedById ?? null,
      paymentConfirmedByRole: (existing?.paymentConfirmedByRole as PaymentConfirmationRole | null) ?? null
    };
  }
  if (currentStatus === 'CANCELLED' || currentStatus === null) {
    throw new PaymentRuleError('Payment cannot be confirmed for this order');
  }
  return {
    changed: true,
    paymentStatus: 'PAID',
    paymentConfirmedAt: now,
    paymentConfirmedById: actorId,
    paymentConfirmedByRole: actorRole
  };
}

export function paymentLabel(method: string | null, status: string | null): string {
  if (status === 'PAID') return 'Pago confirmado';
  if (method === 'BANK_TRANSFER' && status === 'AWAITING_CONFIRMATION') return 'Esperando confirmación del restaurante';
  if (method === 'PAY_AT_RESTAURANT') return 'Pago en restaurante';
  if (method === 'CASH_ON_DELIVERY') return 'Pago en efectivo al recibir';
  return 'Pago legacy/desconocido';
}