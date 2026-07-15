import assert from 'node:assert/strict';
import test from 'node:test';
import {
  publicRegistrationRoleSchema,
  resolvePublicUserRole
} from '../core/public-registration';
import { calculateOrderPricing } from '../core/order-pricing';
import { isOwnedByRestaurant } from '../core/ownership';
import { getRestaurantReadiness } from '../core/restaurant-readiness';
import { assertRestaurantReadyForApproval, canConfigureRestaurant, canOperateRestaurant } from '../core/restaurant-access';
import {
  canTransitionOrder,
  normalizeOrderStatus,
  resolveOrderTransition
} from '../core/order-status';
import {
  PaymentRuleError,
  assertPaymentCompatibleOrderTransition,
  availablePaymentMethods,
  canActorConfirmPayment,
  confirmPayment,
  initialPaymentStatus,
  paymentLabel,
  paymentStatusForCancellation,
  resolvePaymentMethod
} from '../core/payment-orchestration';
import { toOrderDto, toPublicRestaurantDto } from '../core/payment-dtos';
import {
  getOperationalAvailability,
  isWithinOpeningHours,
  updateOperationalStatus,
  validateManualOpenUntil
} from '../core/restaurant-operational';
import {
  cancelOrder,
  canRequestCancellation,
  estimatedReadyAtFromMinutes,
  normalizeCustomerNotes,
  secureTokenEquals
} from '../core/order-operations';
import { emitSafeOrderEvent } from '../core/order-events';

test('public registration rejects ADMIN and DRIVER roles', () => {
  assert.equal(publicRegistrationRoleSchema.safeParse('ADMIN').success, false);
  assert.equal(publicRegistrationRoleSchema.safeParse('DRIVER').success, false);
  assert.equal(publicRegistrationRoleSchema.safeParse('CLIENT').success, true);
  assert.equal(publicRegistrationRoleSchema.safeParse('RESTAURANT').success, true);
  assert.equal(resolvePublicUserRole(), 'CLIENT');
});

test('order pricing ignores client prices and recalculates subtotal plus restaurant delivery fee', () => {
  const items = [
    { productId: 'product-1', quantity: 2 },
    { productId: 'product-2', quantity: 1 }
  ];
  const products = [
    { id: 'product-1', restaurantId: 'restaurant-1', price: 125.5, isAvailable: true },
    { id: 'product-2', restaurantId: 'restaurant-1', price: 49.9, isAvailable: true }
  ];

  const delivery = calculateOrderPricing('restaurant-1', items, products, 'DELIVERY', 250);
  const pickup = calculateOrderPricing('restaurant-1', items, products, 'PICKUP', 250);

  assert.equal(delivery.subtotalAmount, 300.9);
  assert.equal(delivery.deliveryFeeCents, 250);
  assert.equal(delivery.totalAmount, 303.4);
  assert.equal(pickup.deliveryFeeCents, 0);
  assert.equal(pickup.totalAmount, 300.9);
  assert.deepEqual(delivery.items.map(item => item.price), [125.5, 49.9]);
});

test('pending restaurant can configure but cannot operate or publish', () => {
  const readiness = getRestaurantReadiness({});
  const state = { status: 'pending_verification', isActive: false };
  assert.equal(canConfigureRestaurant(state), true);
  assert.equal(canOperateRestaurant(state, readiness), false);
});

test('readiness changes only after all minimum requirements are complete', () => {
  const incomplete = getRestaurantReadiness({ restaurant_name: 'Yommi Test' });
  assert.equal(incomplete.ready, false);
  const complete = getRestaurantReadiness({
    restaurant_name: 'Yommi Test',
    phone_number: '5551234567',
    address: 'Calle 1',
    opening_hours: JSON.stringify({ monday: '09:00-18:00' }),
    has_pickup: true,
    categories: [{ products: [{ isAvailable: true, price: 99 }] }]
  });
  assert.equal(complete.ready, true);
  assert.equal(complete.percentage, 100);
});

test('admin approval rejects an incomplete restaurant', () => {
  assert.throws(() => assertRestaurantReadyForApproval(getRestaurantReadiness({})));
});
test('restaurant ownership rejects resources from another restaurant', () => {
  assert.equal(isOwnedByRestaurant({ restaurantId: 'restaurant-a' }, 'restaurant-a'), true);
  assert.equal(isOwnedByRestaurant({ restaurantId: 'restaurant-b' }, 'restaurant-a'), false);
});

test('invalid or regressive order transitions are rejected', () => {
  assert.equal(canTransitionOrder('PENDING', 'DELIVERED'), false);
  assert.equal(canTransitionOrder('READY', 'PREPARING'), false);
  assert.equal(canTransitionOrder('READY', 'DELIVERED'), true);
  assert.equal(canTransitionOrder('DELIVERED', 'PREPARING'), false);
  assert.throws(() => resolveOrderTransition('PENDING', 'DELIVERED'));
});

test('legacy IN_TRANSIT status transitions forward using canonical ON_THE_WAY', () => {
  assert.equal(normalizeOrderStatus('IN_TRANSIT'), 'ON_THE_WAY');
  assert.equal(resolveOrderTransition('READY', 'IN_TRANSIT'), 'ON_THE_WAY');
  assert.equal(resolveOrderTransition('IN_TRANSIT', 'DELIVERED'), 'DELIVERED');
});
test('pickup only permits payment at restaurant', () => {
  const config = { acceptsPayAtRestaurant: true, acceptsCashOnDelivery: true, acceptsBankTransfer: true, bankName: 'Bank', bankAccountHolder: 'Owner', bankAccountReference: '12345678', paymentConfirmationPhone: '5551234567' };
  assert.deepEqual(availablePaymentMethods('PICKUP', config), ['PAY_AT_RESTAURANT']);
  assert.equal(resolvePaymentMethod('PICKUP', 'PAY_AT_RESTAURANT', config), 'PAY_AT_RESTAURANT');
  assert.throws(() => resolvePaymentMethod('PICKUP', 'CASH_ON_DELIVERY', config), PaymentRuleError);
});

test('delivery permits only configured cash or valid bank transfer', () => {
  const cash = { acceptsPayAtRestaurant: true, acceptsCashOnDelivery: true, acceptsBankTransfer: false };
  assert.deepEqual(availablePaymentMethods('DELIVERY', cash), ['CASH_ON_DELIVERY']);
  assert.equal(initialPaymentStatus(resolvePaymentMethod('DELIVERY', 'CASH_ON_DELIVERY', cash)), 'PENDING');
  assert.throws(() => resolvePaymentMethod('DELIVERY', 'BANK_TRANSFER', cash), PaymentRuleError);

  const transfer = { acceptsPayAtRestaurant: true, acceptsCashOnDelivery: false, acceptsBankTransfer: true, bankName: 'Bank', bankAccountHolder: 'Owner', bankAccountReference: '12345678', paymentConfirmationPhone: '5551234567' };
  assert.deepEqual(availablePaymentMethods('DELIVERY', transfer), ['BANK_TRANSFER']);
  assert.equal(initialPaymentStatus(resolvePaymentMethod('DELIVERY', 'BANK_TRANSFER', transfer)), 'AWAITING_CONFIRMATION');
});

test('bank transfer blocks preparing until payment is confirmed', () => {
  assert.throws(() => assertPaymentCompatibleOrderTransition('BANK_TRANSFER', 'AWAITING_CONFIRMATION', 'PREPARING'), PaymentRuleError);
  assert.doesNotThrow(() => assertPaymentCompatibleOrderTransition('BANK_TRANSFER', 'PAID', 'PREPARING'));
  assert.doesNotThrow(() => assertPaymentCompatibleOrderTransition('CASH_ON_DELIVERY', 'PENDING', 'PREPARING'));
});

test('delivery requires paid status and paid orders cannot be normally cancelled', () => {
  assert.throws(() => assertPaymentCompatibleOrderTransition('CASH_ON_DELIVERY', 'PENDING', 'DELIVERED'), PaymentRuleError);
  assert.doesNotThrow(() => assertPaymentCompatibleOrderTransition('CASH_ON_DELIVERY', 'PAID', 'DELIVERED'));
  assert.equal(paymentStatusForCancellation('PENDING'), 'CANCELLED');
  assert.throws(() => paymentStatusForCancellation('PAID'), PaymentRuleError);
});

test('only owner restaurant or admin can confirm payment', () => {
  assert.equal(canActorConfirmPayment({ id: 'restaurant-a', role: 'RESTAURANT' }, 'restaurant-a'), true);
  assert.equal(canActorConfirmPayment({ id: 'restaurant-b', role: 'RESTAURANT' }, 'restaurant-a'), false);
  assert.equal(canActorConfirmPayment({ id: 'client-a', role: 'CLIENT' }, 'restaurant-a'), false);
  assert.equal(canActorConfirmPayment({ id: 'admin-a', role: 'ADMIN' }, 'restaurant-a'), true);
});

test('payment confirmation is idempotent and preserves original audit', () => {
  const first = confirmPayment('AWAITING_CONFIRMATION', 'restaurant-a', 'RESTAURANT', new Date('2026-07-12T12:00:00Z'));
  assert.equal(first.changed, true);
  const repeated = confirmPayment('PAID', 'restaurant-a', 'RESTAURANT', new Date('2026-07-12T13:00:00Z'), first);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.paymentConfirmedAt?.toISOString(), '2026-07-12T12:00:00.000Z');
});

test('bank data is absent from public DTOs and only present for transfer order context', () => {
  const restaurant = { id: 'r1', restaurant_name: 'Safe', password_hash: 'hash', bankName: 'Bank', bankAccountHolder: 'Owner', bankAccountReference: '12345678', bankTransferInstructions: 'Private', paymentConfirmationPhone: '555' };
  const publicDto = toPublicRestaurantDto(restaurant);
  assert.equal('bankAccountReference' in publicDto, false);
  assert.equal('password_hash' in publicDto, false);
  const cashOrder = toOrderDto({ id: 'o1', paymentMethod: 'CASH_ON_DELIVERY', restaurant }, true);
  assert.equal(cashOrder.paymentInstructions, undefined);
  const transferOrder = toOrderDto({ id: 'o2', paymentMethod: 'BANK_TRANSFER', restaurant }, true);
  assert.equal(transferOrder.paymentInstructions.bankAccountReference, '12345678');
  const secretOrder = toOrderDto({ id: 'o3', trackingToken: 'secret', restaurant }, false);
  assert.equal(secretOrder.trackingToken, undefined);
});

test('historical orders remain legacy unknown without invented values', () => {
  assert.equal(paymentLabel(null, null), 'Pago legacy/desconocido');
  assert.throws(() => confirmPayment(null, 'restaurant-a', 'RESTAURANT'), PaymentRuleError);
});
test('operational schedule supports normal, overnight, closed and America/Tijuana time', () => {
  const normal = JSON.stringify({ monday: '09:00-18:00' });
  const overnight = JSON.stringify({ monday: '18:00-02:00' });
  const closed = JSON.stringify({ monday: 'CLOSED' });

  assert.equal(isWithinOpeningHours(normal, 'America/Tijuana', new Date('2026-07-13T17:00:00Z')), true);
  assert.equal(isWithinOpeningHours(normal, 'America/Tijuana', new Date('2026-07-14T03:00:00Z')), false);
  assert.equal(isWithinOpeningHours(overnight, 'America/Tijuana', new Date('2026-07-14T06:00:00Z')), true);
  assert.equal(isWithinOpeningHours(overnight, 'America/Tijuana', new Date('2026-07-14T08:30:00Z')), true);
  assert.equal(isWithinOpeningHours(overnight, 'America/Tijuana', new Date('2026-07-14T10:00:00Z')), false);
  assert.equal(isWithinOpeningHours(closed, 'America/Tijuana', new Date('2026-07-13T17:00:00Z')), false);
  assert.equal(isWithinOpeningHours(JSON.stringify({ monday: '10:00-10:30' }), 'America/Tijuana', new Date('2026-07-13T17:00:00Z')), true);
  assert.equal(isWithinOpeningHours(JSON.stringify({ monday: '10:00-10:30' }), 'America/Mexico_City', new Date('2026-07-13T17:00:00Z')), false);
});

test('manual opening is effective only for OPEN and only until its expiration', () => {
  const now = new Date('2026-07-13T17:00:00Z');
  const activeUntil = new Date('2026-07-13T19:00:00Z');
  const restaurant = {
    status: 'approved', isActive: true, operationalStatus: 'OPEN',
    opening_hours: JSON.stringify({ monday: 'CLOSED' }), timezone: 'America/Tijuana', manualOpenUntil: activeUntil
  };
  assert.equal(getOperationalAvailability(restaurant, now).acceptingOrders, true);
  assert.equal(getOperationalAvailability(restaurant, new Date('2026-07-13T20:00:00Z')).acceptingOrders, false);
  assert.equal(getOperationalAvailability({ ...restaurant, operationalStatus: 'PAUSED' }, now).acceptingOrders, false);
  assert.equal(getOperationalAvailability({ ...restaurant, operationalStatus: 'CLOSED' }, now).acceptingOrders, false);
  assert.throws(() => validateManualOpenUntil('OPEN', new Date('2026-07-13T16:00:00Z'), now));
  assert.throws(() => validateManualOpenUntil('OPEN', new Date('2026-07-14T18:00:01Z'), now));
  assert.throws(() => validateManualOpenUntil('PAUSED', activeUntil, now));
});

test('restaurant operational status update enforces ownership and records actor audit', async () => {
  let updateArgs: any;
  const prisma = { restaurant: { update: async (args: any) => { updateArgs = args; return args.data; } } };
  await assert.rejects(() => updateOperationalStatus({
    prisma, restaurantId: 'restaurant-a', actor: { id: 'restaurant-b', role: 'RESTAURANT' }, status: 'OPEN'
  }));
  await updateOperationalStatus({
    prisma, restaurantId: 'restaurant-a', actor: { id: 'restaurant-a', role: 'RESTAURANT' }, status: 'PAUSED'
  });
  assert.equal(updateArgs.data.operationalStatus, 'PAUSED');
  assert.equal(updateArgs.data.operationalStatusChangedById, 'restaurant-a');
  assert.equal(updateArgs.data.manualOpenUntil, null);
});

test('customer notes and estimated time are bounded and normalized', () => {
  assert.equal(normalizeCustomerNotes('  sin cebolla  '), 'sin cebolla');
  assert.throws(() => normalizeCustomerNotes('x'.repeat(501)));
  assert.equal(estimatedReadyAtFromMinutes(20, new Date('2026-07-13T17:00:00Z')).toISOString(), '2026-07-13T17:20:00.000Z');
  assert.throws(() => estimatedReadyAtFromMinutes(4));
});

test('guest cancellation requires a timing-safe tracking token and PENDING status', () => {
  const order = { status: 'PENDING', clientId: null, trackingToken: 'a'.repeat(64) };
  assert.equal(secureTokenEquals(order.trackingToken, 'a'.repeat(64)), true);
  assert.equal(secureTokenEquals(order.trackingToken, 'b'.repeat(64)), false);
  assert.equal(canRequestCancellation(order, null, undefined), false);
  assert.equal(canRequestCancellation(order, null, 'a'.repeat(64)), true);
  assert.equal(canRequestCancellation({ ...order, status: 'ACCEPTED' }, null, 'a'.repeat(64)), false);
});

test('shared cancellation transaction records audit once and emits only a safe event', async () => {
  const existing = { id: 'order-1', restaurantId: 'restaurant-1', status: 'PREPARING', paymentStatus: 'PENDING', items: [] };
  const cancelled = { ...existing, status: 'CANCELLED', paymentStatus: 'CANCELLED' };
  let historyWrites = 0;
  const payloads: any[] = [];
  const tx = {
    order: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => cancelled
    },
    orderStatusHistory: { create: async () => { historyWrites += 1; } }
  };
  const prisma = {
    order: { findUnique: async () => existing },
    $transaction: async (callback: any) => callback(tx)
  };
  const io = {
    emit: (_event: string, payload: any) => payloads.push(payload),
    to: () => ({ emit: (_event: string, payload: any) => payloads.push(payload) })
  };
  const result = await cancelOrder({
    prisma, io, orderId: existing.id,
    actor: { id: 'restaurant-1', role: 'RESTAURANT' }, reason: 'OUT_OF_STOCK'
  });
  assert.equal(result.changed, true);
  assert.equal(historyWrites, 1);
  assert.deepEqual(Object.keys(payloads[0]).sort(), ['orderId', 'restaurantId', 'type']);
  assert.equal('customerNotes' in payloads[0], false);
});

test('paid orders cannot use the normal cancellation transaction', async () => {
  const prisma = {
    order: { findUnique: async () => ({ id: 'order-1', restaurantId: 'restaurant-1', status: 'READY', paymentStatus: 'PAID', items: [] }) }
  };
  await assert.rejects(() => cancelOrder({
    prisma, orderId: 'order-1', actor: { id: 'restaurant-1', role: 'RESTAURANT' }, reason: 'OTHER'
  }), PaymentRuleError);
});

test('customer no-show is terminal and is not equivalent to delivered', () => {
  assert.equal(resolveOrderTransition('READY', 'CUSTOMER_NO_SHOW'), 'CUSTOMER_NO_SHOW');
  assert.equal(canTransitionOrder('CUSTOMER_NO_SHOW', 'DELIVERED'), false);
  assert.notEqual('CUSTOMER_NO_SHOW', 'DELIVERED');
});

test('safe order event has exactly the approved realtime fields', () => {
  const event = emitSafeOrderEvent(undefined, 'ORDER_UPDATED', { id: 'order-1', restaurantId: 'restaurant-1' });
  assert.deepEqual(event, { orderId: 'order-1', restaurantId: 'restaurant-1', type: 'ORDER_UPDATED' });
});