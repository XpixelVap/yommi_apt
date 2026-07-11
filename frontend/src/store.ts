import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  login: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((state) => {
    // Ensure we only order from one restaurant at a time
    if (state.items.length > 0 && state.items[0].restaurantId !== item.restaurantId) {
      return { items: [item] }; // Clear cart if different restaurant
    }
    const existing = state.items.find((i) => i.productId === item.productId);
    if (existing) {
      return {
        items: state.items.map((i) =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i
        ),
      };
    }
    return { items: [...state.items, item] };
  }),
  removeItem: (productId) => set((state) => ({
    items: state.items.filter((i) => i.productId !== productId),
  })),
  clearCart: () => set({ items: [] }),
}));

interface CityState {
  city: string | null;
  setCity: (city: string) => void;
}

export const useCityStore = create<CityState>((set) => ({
  city: localStorage.getItem('user_city'),
  setCity: (city) => {
    localStorage.setItem('user_city', city);
    set({ city });
  },
}));
