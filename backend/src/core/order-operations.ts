import { timingSafeEqual } from 'node:crypto';
import { emitSafeOrderEvent } from './order-events';
import { resolveOrderTransition } from './order-status';
import { paymentStatusForCancellation } from './payment-orchestration';

export const CANCELLATION_REASONS = [
  'OUT_OF_STOCK',
  'RESTAURANT_CLOSED',
  'CUSTOMER_REQUEST',
  'ADDRESS_OUT_OF_RANGE',
  'DUPLICATE_ORDER',
  'OTHER'
] as const;

export const CUSTOMER_NOTES_MAX_LENGTH = 500;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const CANCELLATION_REASON_LABELS: Readonly<Record<CancellationReason, string>> = {
  OUT_OF_STOCK: 'Uno o más productos se agotaron.',
  RESTAURANT_CLOSED: 'El restaurante tuvo que cerrar.',
  CUSTOMER_REQUEST: 'El cliente solicitó la cancelación.',
  ADDRESS_OUT_OF_RANGE: 'La dirección está fuera del área de entrega.',
  DUPLICATE_ORDER: 'El pedido estaba duplicado.',
  OTHER: 'El restaurante canceló el pedido.'
};

export class OrderOperationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'OrderOperationError';
  }
}

export function estimatedReadyAtFromMinutes(minutes: number, now = new Date()): Date {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) {
    throw new OrderOperationError('INVALID_ESTIMATED_TIME', 'El tiempo estimado debe estar entre 5 y 180 minutos.');
  }
  return new Date(now.getTime() + minutes * 60 * 1000);
}

export function normalizeCustomerNotes(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new OrderOperationError('INVALID_CUSTOMER_NOTES', 'Las notas deben ser texto.');
  const notes = value.trim();
  if (notes.length > CUSTOMER_NOTES_MAX_LENGTH) {
    throw new OrderOperationError('INVALID_CUSTOMER_NOTES', 'Las notas no pueden exceder 500 caracteres.');
  }
  return notes || null;
}

export function secureTokenEquals(expected: string | null | undefined, provided: unknown): boolean {
  if (!expected || typeof provided !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function canManageOrder(actor: { id: string; role: string }, restaurantId: string): boolean {
  return actor.role === 'ADMIN' || (actor.role === 'RESTAURANT' && actor.id === restaurantId);
}

export function canRequestCancellation(
  order: { status: string; clientId?: string | null; trackingToken?: string | null },
  actor: { id?: string; role?: string } | null,
  trackingToken?: unknown
): boolean {
  if (order.status !== 'PENDING') return false;
  if (actor?.role === 'CLIENT' && actor.id === order.clientId) return true;
  return !order.clientId && secureTokenEquals(order.trackingToken, trackingToken);
}

const orderInclude = {
  restaurant: true,
  client: true,
  items: { include: { product: true } }
};

export async function cancelOrder(args: {
  prisma: any;
  io?: any;
  orderId: string;
  actor: { id: string; role: string };
  reason: CancellationReason;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  if (!CANCELLATION_REASONS.includes(args.reason)) {
    throw new OrderOperationError('INVALID_CANCELLATION_REASON', 'Selecciona un motivo de cancelación válido.');
  }
  const existing = await args.prisma.order.findUnique({ where: { id: args.orderId }, include: orderInclude });
  if (!existing) throw new OrderOperationError('ORDER_NOT_FOUND', 'Pedido no encontrado.');
  if (!canManageOrder(args.actor, existing.restaurantId)) {
    throw new OrderOperationError('FORBIDDEN', 'No tienes permiso para cancelar este pedido.');
  }
  if (existing.status === 'CANCELLED') return { order: existing, changed: false };
  if (existing.status === 'DELIVERED' || existing.status === 'CUSTOMER_NO_SHOW') {
    throw new OrderOperationError('ORDER_ALREADY_ATTENDED', 'El pedido ya está en un estado terminal.');
  }

  resolveOrderTransition(existing.status, 'CANCELLED');
  const paymentStatus = paymentStatusForCancellation(existing.paymentStatus);
  const order = await args.prisma.$transaction(async (tx: any) => {
    const changed = await tx.order.updateMany({
      where: { id: existing.id, status: existing.status },
      data: {
        status: 'CANCELLED',
        paymentStatus,
        cancelReason: args.reason,
        cancelledAt: now,
        cancelledById: args.actor.id,
        cancelledByRole: args.actor.role
      }
    });
    if (changed.count !== 1) throw new OrderOperationError('ORDER_ALREADY_ATTENDED', 'El pedido cambió mientras intentabas cancelarlo.');
    await tx.orderStatusHistory.create({
      data: { orderId: existing.id, status: 'CANCELLED', notes: `Cancellation reason: ${args.reason}` }
    });
    return tx.order.findUnique({ where: { id: existing.id }, include: orderInclude });
  });
  emitSafeOrderEvent(args.io, 'ORDER_UPDATED', order);
  return { order, changed: true };
}

export async function requestOrderCancellation(args: {
  prisma: any;
  io?: any;
  orderId: string;
  actor: { id?: string; role?: string } | null;
  trackingToken?: unknown;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const existing = await args.prisma.order.findUnique({ where: { id: args.orderId }, include: orderInclude });
  if (!existing) throw new OrderOperationError('ORDER_NOT_FOUND', 'Pedido no encontrado.');
  if (!canRequestCancellation(existing, args.actor, args.trackingToken)) {
    throw new OrderOperationError(
      existing.status === 'PENDING' ? 'FORBIDDEN' : 'CANCELLATION_NOT_ALLOWED',
      existing.status === 'PENDING'
        ? 'No tienes permiso para solicitar la cancelación.'
        : 'La cancelación solo puede solicitarse mientras el pedido está pendiente.'
    );
  }
  if (existing.cancellationRequestedAt) return { order: existing, changed: false };
  const order = await args.prisma.$transaction(async (tx: any) => {
    const changed = await tx.order.updateMany({
      where: { id: existing.id, status: 'PENDING', cancellationRequestedAt: null },
      data: { cancellationRequestedAt: now }
    });
    if (changed.count !== 1) throw new OrderOperationError('ORDER_ALREADY_ATTENDED', 'El pedido cambió antes de registrar la solicitud.');
    await tx.orderStatusHistory.create({
      data: { orderId: existing.id, status: 'PENDING', notes: 'Cancellation requested by customer' }
    });
    return tx.order.findUnique({ where: { id: existing.id }, include: orderInclude });
  });
  emitSafeOrderEvent(args.io, 'CANCELLATION_REQUESTED', order);
  return { order, changed: true };
}

export async function markCustomerNoShow(args: {
  prisma: any;
  io?: any;
  orderId: string;
  actor: { id: string; role: string };
  note?: string | null;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const existing = await args.prisma.order.findUnique({ where: { id: args.orderId }, include: orderInclude });
  if (!existing) throw new OrderOperationError('ORDER_NOT_FOUND', 'Pedido no encontrado.');
  if (!canManageOrder(args.actor, existing.restaurantId)) {
    throw new OrderOperationError('FORBIDDEN', 'No tienes permiso para actualizar este pedido.');
  }
  if (existing.status === 'CUSTOMER_NO_SHOW') return { order: existing, changed: false };
  if (existing.fulfillmentType !== 'PICKUP' || existing.status !== 'READY') {
    throw new OrderOperationError('CUSTOMER_NO_SHOW_NOT_ALLOWED', 'Solo un pedido pickup en estado READY puede marcarse como cliente ausente.');
  }
  resolveOrderTransition(existing.status, 'CUSTOMER_NO_SHOW');
  const order = await args.prisma.$transaction(async (tx: any) => {
    const changed = await tx.order.updateMany({
      where: { id: existing.id, status: 'READY', fulfillmentType: 'PICKUP' },
      data: { status: 'CUSTOMER_NO_SHOW', customerNoShowAt: now, customerNoShowNote: args.note || null }
    });
    if (changed.count !== 1) throw new OrderOperationError('ORDER_ALREADY_ATTENDED', 'El pedido cambió antes de registrar la ausencia.');
    await tx.orderStatusHistory.create({
      data: { orderId: existing.id, status: 'CUSTOMER_NO_SHOW', notes: args.note || 'Customer did not arrive' }
    });
    return tx.order.findUnique({ where: { id: existing.id }, include: orderInclude });
  });
  emitSafeOrderEvent(args.io, 'ORDER_UPDATED', order);
  return { order, changed: true };
}