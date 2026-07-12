export type RestaurantFunnelEvent =
  | 'restaurant_registered'
  | 'restaurant_first_login'
  | 'restaurant_profile_minimum_completed'
  | 'restaurant_first_product_created'
  | 'restaurant_ready'
  | 'restaurant_approved'
  | 'restaurant_first_order_received';

export function logRestaurantFunnelEvent(
  event: RestaurantFunnelEvent,
  restaurantId: string,
  metadata: Record<string, unknown> = {}
): void {
  console.info(JSON.stringify({
    type: 'restaurant_funnel',
    event,
    restaurantId,
    dedupeKey: `${restaurantId}:${event}`,
    timestamp: new Date().toISOString(),
    ...metadata
  }));
}