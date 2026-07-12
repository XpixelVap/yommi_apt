export interface OrderItemInput {
  productId: string;
  quantity: number;
  options?: unknown[];
}

export interface PricedProduct {
  id: string;
  restaurantId: string;
  price: number;
  isAvailable: boolean;
}

export interface PricedOrderItem extends OrderItemInput {
  price: number;
}

export interface OrderPricingResult {
  totalAmount: number;
  items: PricedOrderItem[];
}

export class OrderPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderPricingError';
  }
}

export function calculateOrderPricing(
  restaurantId: string,
  items: OrderItemInput[],
  products: PricedProduct[]
): OrderPricingResult {
  const requestedProductIds = new Set(items.map(item => item.productId));
  const productById = new Map(products.map(product => [product.id, product]));

  if (products.length !== requestedProductIds.size) {
    throw new OrderPricingError('One or more products do not exist');
  }

  const pricedItems = items.map(item => {
    const product = productById.get(item.productId);
    if (!product) {
      throw new OrderPricingError('One or more products do not exist');
    }
    if (product.restaurantId !== restaurantId || !product.isAvailable) {
      throw new OrderPricingError(
        'All products must be available and belong to the selected restaurant'
      );
    }

    return {
      productId: item.productId,
      quantity: item.quantity,
      options: item.options,
      price: product.price
    };
  });

  const totalAmount = Math.round(
    pricedItems.reduce((total, item) => total + item.price * item.quantity, 0) * 100
  ) / 100;

  return { totalAmount, items: pricedItems };
}