import type { RestaurantReadiness } from './restaurant-readiness';

export interface RestaurantAccessState {
  status: string;
  isActive: boolean;
}

export function canConfigureRestaurant(state: RestaurantAccessState): boolean {
  return state.status === 'pending_verification' || state.status === 'approved';
}

export function canOperateRestaurant(
  state: RestaurantAccessState,
  readiness: RestaurantReadiness
): boolean {
  return state.status === 'approved' && state.isActive && readiness.ready;
}

export function canPublishRestaurant(
  state: RestaurantAccessState,
  readiness: RestaurantReadiness
): boolean {
  return canOperateRestaurant(state, readiness);
}

export class RestaurantNotReadyError extends Error {
  readonly readiness: RestaurantReadiness;

  constructor(readiness: RestaurantReadiness) {
    super('Restaurant is not ready for publication');
    this.name = 'RestaurantNotReadyError';
    this.readiness = readiness;
  }
}

export function assertRestaurantReadyForApproval(
  readiness: RestaurantReadiness
): void {
  if (!readiness.ready) throw new RestaurantNotReadyError(readiness);
}