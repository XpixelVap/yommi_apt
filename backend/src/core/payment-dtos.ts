const BANK_FIELDS = [
  'bankName', 'bankAccountHolder', 'bankAccountReference',
  'bankTransferInstructions', 'paymentConfirmationPhone'
] as const;

export function maskBankReference(value: string | null | undefined): string | null {
  if (!value) return null;
  const visible = value.replace(/\s/g, '').slice(-4);
  return `${'*'.repeat(Math.max(4, value.replace(/\s/g, '').length - 4))}${visible}`;
}

export function toPublicRestaurantDto(restaurant: any) {
  if (!restaurant) return restaurant;
  const {
    password_hash: _password,
    bankName: _bankName,
    bankAccountHolder: _holder,
    bankAccountReference: _reference,
    bankTransferInstructions: _instructions,
    paymentConfirmationPhone: _confirmationPhone,
    ...safe
  } = restaurant;
  return safe;
}

export function toRestaurantPaymentSettingsDto(restaurant: any, revealReference: boolean) {
  return {
    acceptsPayAtRestaurant: Boolean(restaurant.acceptsPayAtRestaurant),
    acceptsCashOnDelivery: Boolean(restaurant.acceptsCashOnDelivery),
    acceptsBankTransfer: Boolean(restaurant.acceptsBankTransfer),
    bankName: restaurant.bankName ?? null,
    bankAccountHolder: restaurant.bankAccountHolder ?? null,
    bankAccountReference: revealReference
      ? restaurant.bankAccountReference ?? null
      : maskBankReference(restaurant.bankAccountReference),
    bankTransferInstructions: restaurant.bankTransferInstructions ?? null,
    paymentConfirmationPhone: restaurant.paymentConfirmationPhone ?? null
  };
}

export function toOrderDto(order: any, includeTransferDetails = false) {
  const safe: any = {
    ...order,
    restaurant: toPublicRestaurantDto(order.restaurant)
  };
  for (const field of BANK_FIELDS) delete safe[field];
  if (includeTransferDetails && order.paymentMethod === 'BANK_TRANSFER' && order.restaurant) {
    safe.paymentInstructions = {
      bankName: order.restaurant.bankName ?? null,
      bankAccountHolder: order.restaurant.bankAccountHolder ?? null,
      bankAccountReference: order.restaurant.bankAccountReference ?? null,
      bankTransferInstructions: order.restaurant.bankTransferInstructions ?? null,
      paymentConfirmationPhone: order.restaurant.paymentConfirmationPhone ?? null,
      disclaimer: 'El restaurante confirmará tu pago. Yommi no procesa ni recibe este dinero.'
    };
  }
  return safe;
}
export function toAdminRestaurantDto(restaurant: any) {
  return {
    ...toPublicRestaurantDto(restaurant),
    ...toRestaurantPaymentSettingsDto(restaurant, false)
  };
}