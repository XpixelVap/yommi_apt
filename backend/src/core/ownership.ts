export interface RestaurantOwnedResource {
  restaurantId: string;
}

export function isOwnedByRestaurant(
  resource: RestaurantOwnedResource,
  restaurantId: string
): boolean {
  return resource.restaurantId === restaurantId;
}