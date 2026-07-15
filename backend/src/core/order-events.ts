export const ORDER_EVENT_TYPES = [
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'PAYMENT_UPDATED',
  'CANCELLATION_REQUESTED'
] as const;

export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

export interface SafeOrderEvent {
  orderId: string;
  restaurantId: string;
  type: OrderEventType;
}

interface OrderEventEmitter {
  emit: (event: string, payload: SafeOrderEvent) => unknown;
  to: (room: string) => { emit: (event: string, payload: SafeOrderEvent) => unknown };
}

export function emitSafeOrderEvent(
  io: OrderEventEmitter | null | undefined,
  type: OrderEventType,
  order: { id: string; restaurantId: string }
): SafeOrderEvent {
  const event = { orderId: order.id, restaurantId: order.restaurantId, type };
  if (io) {
    io.emit('orderEvent', event);
    io.to(`order_${order.id}`).emit('orderEvent', event);
  }
  return event;
}
