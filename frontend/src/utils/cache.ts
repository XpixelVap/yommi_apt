export const setCache = (key: string, data: any, ttlMinutes: number = 5) => {
  const now = new Date();
  const item = {
    data,
    expiry: now.getTime() + ttlMinutes * 60 * 1000,
  };
  try {
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.warn('Error setting cache', error);
  }
};

export const getCache = (key: string) => {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    
    const item = JSON.parse(itemStr);
    const now = new Date();
    
    if (now.getTime() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.data;
  } catch (error) {
    console.warn('Error getting cache', error);
    return null;
  }
};

export const clearCache = (prefix?: string) => {
  if (!prefix) {
    localStorage.clear();
    return;
  }
  
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
};
