export const trackWhatsAppClick = (restaurant: any) => {
  if (!restaurant) return;
  
  // Track order attempt
  const attempt = {
    restaurant_id: restaurant.id,
    restaurant_name: restaurant.restaurant_name || restaurant.name,
    category: restaurant.categories?.[0]?.name || restaurant.cuisine_type || 'Comida',
    timestamp: Date.now()
  };
  localStorage.setItem('lastOrderAttempt', JSON.stringify(attempt));

  // Increase response score
  try {
    const scores = JSON.parse(localStorage.getItem('response_scores') || '{}');
    scores[restaurant.id] = (scores[restaurant.id] || 0) + 1;
    localStorage.setItem('response_scores', JSON.stringify(scores));
  } catch (e) {
    console.error('Error saving response score', e);
  }
};

export const getResponseScore = (restaurantId: string) => {
  try {
    const scores = JSON.parse(localStorage.getItem('response_scores') || '{}');
    return scores[restaurantId] || 0;
  } catch (e) {
    return 0;
  }
};

export const decreaseResponseScore = (restaurantId: string) => {
  try {
    const scores = JSON.parse(localStorage.getItem('response_scores') || '{}');
    scores[restaurantId] = (scores[restaurantId] || 0) - 2; // Penalize for no response
    localStorage.setItem('response_scores', JSON.stringify(scores));
  } catch (e) {
    console.error('Error decreasing response score', e);
  }
};

export const normalizeWhatsAppPhone = (phone: string | number | null | undefined): string => {
  if (!phone) return '';
  // Remove all non-numeric characters
  let normalized = String(phone).replace(/\D/g, '');
  
  // If it's a 10-digit Mexican number, add the country code + 1
  if (normalized.length === 10) {
    return `521${normalized}`;
  }
  
  // If it starts with 52 and has 12 digits (missing the 1)
  if (normalized.length === 12 && normalized.startsWith('52')) {
    return `521${normalized.substring(2)}`;
  }
  
  return normalized;
};
