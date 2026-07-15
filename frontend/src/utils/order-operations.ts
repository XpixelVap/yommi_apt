export interface OperationalOrder {
  id: string;
  status: string;
}

export function pendingOrderCount(orders: OperationalOrder[]): number {
  return orders.filter(order => order.status === 'PENDING').length;
}

export function shouldPlayOrderAlert(orders: OperationalOrder[]): boolean {
  return pendingOrderCount(orders) > 0;
}

export function upsertOrder<T extends OperationalOrder>(orders: T[], incoming: T): T[] {
  const index = orders.findIndex(order => order.id === incoming.id);
  if (index === -1) return [incoming, ...orders];
  return orders.map(order => order.id === incoming.id ? incoming : order);
}

export function removeAttendedHighlights(highlighted: Set<string>, orders: OperationalOrder[]): Set<string> {
  const pendingIds = new Set(orders.filter(order => order.status === 'PENDING').map(order => order.id));
  return new Set([...highlighted].filter(id => pendingIds.has(id)));
}
