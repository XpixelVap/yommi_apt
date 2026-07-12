import assert from 'node:assert/strict';
import test from 'node:test';
import {
  publicRegistrationRoleSchema,
  resolvePublicUserRole
} from '../core/public-registration';
import { calculateOrderPricing } from '../core/order-pricing';
import { isOwnedByRestaurant } from '../core/ownership';
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

test('order pricing ignores client prices and recalculates from backend products', () => {
  const items = [
    { productId: 'product-1', quantity: 2, price: 0.01 },
    { productId: 'product-2', quantity: 1, price: 0.01 }
  ];

  const result = calculateOrderPricing('restaurant-1', items, [
    { id: 'product-1', restaurantId: 'restaurant-1', price: 125.5, isAvailable: true },
    { id: 'product-2', restaurantId: 'restaurant-1', price: 49.9, isAvailable: true }
  ]);

  assert.equal(result.totalAmount, 300.9);
  assert.deepEqual(result.items.map(item => item.price), [125.5, 49.9]);
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