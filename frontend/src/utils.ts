export const DRIVERS_ENABLED = false;

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return response;
};

export function generateSlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function getRestaurantStatus(openingHoursJson: string | null | undefined) {
  if (!openingHoursJson) return null;
  try {
    const hours = JSON.parse(openingHoursJson);
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[now.getDay()];
    const yesterday = days[(now.getDay() + 6) % 7];
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;

    // Check yesterday's hours if it goes past midnight
    const yesterdayHours = hours[yesterday];
    if (yesterdayHours && yesterdayHours.toLowerCase() !== 'cerrado') {
      const parts = yesterdayHours.split('-');
      if (parts.length === 2) {
        const openTime = parts[0].trim();
        const closeTime = parts[1].trim();
        const [openHour, openMinute] = openTime.split(':').map(Number);
        const [closeHour, closeMinute] = closeTime.split(':').map(Number);
        
        const openMins = openHour * 60 + openMinute;
        const closeMins = closeHour * 60 + closeMinute;
        
        if (closeMins < openMins) { // Goes past midnight
          if (currentMinutes <= closeMins) {
            return { isOpen: true, text: `🟢 Abierto hasta ${closeTime}` };
          }
        }
      }
    }

    const todayHours = hours[currentDay];
    if (!todayHours || todayHours.toLowerCase() === 'cerrado') {
      return { isOpen: false, text: '🔴 Cerrado' };
    }

    const parts = todayHours.split('-');
    if (parts.length === 2) {
      const openTime = parts[0].trim();
      const closeTime = parts[1].trim();
      
      const [openHour, openMinute] = openTime.split(':').map(Number);
      const [closeHour, closeMinute] = closeTime.split(':').map(Number);

      const openMins = openHour * 60 + openMinute;
      let closeMins = closeHour * 60 + closeMinute;
      
      if (closeMins < openMins) {
        closeMins += 24 * 60;
      }

      if (currentMinutes >= openMins && currentMinutes <= closeMins) {
        return { isOpen: true, text: `🟢 Abierto hasta ${closeTime}` };
      } else {
        return { isOpen: false, text: '🔴 Cerrado' };
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}
