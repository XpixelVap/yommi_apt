import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pendingOrderCount,
  removeAttendedHighlights,
  shouldPlayOrderAlert,
  upsertOrder
} from '../utils/order-operations';

test('reconnection upserts canonical orders without duplicates', () => {
  const existing = [{ id: 'order-1', status: 'PENDING' }];
  const refreshed = upsertOrder(existing, { id: 'order-1', status: 'ACCEPTED' });
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].status, 'ACCEPTED');
});

test('alert continues while any pending order remains and stops when all are attended', () => {
  const orders = [
    { id: 'order-1', status: 'ACCEPTED' },
    { id: 'order-2', status: 'PENDING' }
  ];
  assert.equal(pendingOrderCount(orders), 1);
  assert.equal(shouldPlayOrderAlert(orders), true);
  assert.equal(shouldPlayOrderAlert(orders.map(order => ({ ...order, status: 'ACCEPTED' }))), false);
  assert.deepEqual([...removeAttendedHighlights(new Set(['order-1', 'order-2']), orders)], ['order-2']);
});
