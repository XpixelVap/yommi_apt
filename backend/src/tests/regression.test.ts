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
  assert.equal(canTransitionOrder('DELIVERED', 'PREPARING'), false);
  assert.throws(() => resolveOrderTransition('PENDING', 'DELIVERED'));
});

test('legacy IN_TRANSIT status transitions forward using canonical ON_THE_WAY', () => {
  assert.equal(normalizeOrderStatus('IN_TRANSIT'), 'ON_THE_WAY');
  assert.equal(resolveOrderTransition('READY', 'IN_TRANSIT'), 'ON_THE_WAY');
  assert.equal(resolveOrderTransition('IN_TRANSIT', 'DELIVERED'), 'DELIVERED');
});