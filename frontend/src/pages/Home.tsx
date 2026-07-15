import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Star, Clock, Navigation, Store, Search, ChevronRight, ShoppingBag, Utensils, MessageCircle, Share2, Car } from 'lucide-react';
import { AIAssistant } from '../components/AIAssistant';
import { useAuthStore, useCityStore } from '../store';
import { generateSlug, getRestaurantStatus } from '../utils';
import { trackWhatsAppClick, getResponseScore } from '../utils/whatsapp';
import { getCache, setCache } from '../utils/cache';
import { RestaurantCardSkeleton } from '../components/Skeleton';

const CATEGORIES = [
  { name: 'Tacos', image: '/icons/tacos.png', icon: '🌮', slug: 'tacos' },
  { name: 'Pizza', image: '/icons/pizza.png', icon: '🍕', slug: 'pizza' },
  { name: 'Hamburguesas', image: '/icons/burger.png', icon: '🍔', slug: 'hamburguesas' },
  { name: 'Sushi', image: '/icons/sushi.png', icon: '🍣', slug: 'sushi' },
  { name: 'Cafeterías', image: '/icons/coffee.png', icon: '☕', slug: 'cafeterias' },
  { name: 'Desayunos', image: '/icons/breakfast.png', icon: '🥐', slug: 'desayunos' },
];

export function Home() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [trendingRestaurants, setTrendingRestaurants] = useState<any[]>([]);
  const [popularProducts, setPopularProducts] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceType, setServiceType] = useState<'all' | 'delivery' | 'pickup'>('all');
  const { user, token } = useAuthStore();
  const { city, setCity } = useCityStore();
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);
      const url = city ? `${import.meta.env.VITE_API_URL || ""}/api/restaurants?city=${encodeURIComponent(city)}` : `${import.meta.env.VITE_API_URL || ""}/api/restaurants`;
      const cacheKey = `restaurants_${city || 'all'}`;
      
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        setRestaurants(cachedData);
        setLoading(false);
      }

      try {
        const res = await fetch(url);
        const responseData = await res.json();
        const data = Array.isArray(responseData) ? responseData : responseData.data;
        if (Array.isArray(data)) {
          setRestaurants(data);
          setCache(cacheKey, data, 15); // Cache for 15 minutes
        }
      } catch (err) {
        console.error('Error fetching restaurants:', err);
      } finally {
        setLoading(false);
      }

      // Fetch trending restaurants
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurants/trending`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setTrendingRestaurants(data);
        }
      } catch (err) {
        console.error('Error fetching trending restaurants:', err);
      }

      // Fetch popular products
      const popularUrl = city ? `${import.meta.env.VITE_API_URL || ""}/api/popular-today?city=${encodeURIComponent(city)}` : `${import.meta.env.VITE_API_URL || ""}/api/popular-today`;
      const popularCacheKey = `popular_${city || 'all'}`;
      
      const cachedPopular = getCache(popularCacheKey);
      if (cachedPopular) {
        setPopularProducts(cachedPopular);
      } else {
        try {
          const res = await fetch(popularUrl);
          const data = await res.json();
          if (Array.isArray(data)) {
            setPopularProducts(data);
            setCache(popularCacheKey, data, 5); // Cache for 5 mins
          }
        } catch (err) {
          console.error('Error fetching popular products:', err);
        }
      }

      // Fetch banners
      const bannersUrl = city ? `${import.meta.env.VITE_API_URL || ""}/api/public/banners?city=${encodeURIComponent(city)}` : `${import.meta.env.VITE_API_URL || ""}/api/public/banners`;
      const bannersCacheKey = `banners_${city || 'all'}`;
      
      const cachedBanners = getCache(bannersCacheKey);
      if (cachedBanners) {
        setBanners(cachedBanners);
      } else {
        try {
          const res = await fetch(bannersUrl);
          const data = await res.json();
          if (Array.isArray(data)) {
            setBanners(data);
            setCache(bannersCacheKey, data, 30); // Cache for 30 mins
          }
        } catch (err) {
          console.error('Error fetching banners:', err);
        }
      }
    };

    fetchHomeData();

    const localOrderStr = localStorage.getItem('lastOrder');
    if (localOrderStr) {
      setLastOrderId('local');
    } else if (!user) {
      const orderId = localStorage.getItem('lastOrderId');
      if (orderId) {
        setLastOrderId(orderId);
      }
    } else {
      fetch(`${import.meta.env.VITE_API_URL || ""}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setLastOrderId(data[0].id);
          } else {
            setLastOrderId(null);
          }
        })
        .catch(err => {
          console.error('Error fetching user orders:', err);
          setLastOrderId(null);
        });
    }
  }, [user, token, city]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/${generateSlug(searchQuery)}/${city ? generateSlug(city) : 'todas'}`);
    } else {
      navigate(`/restaurantes/${city ? generateSlug(city) : 'todas'}`);
    }
  };

  const citySlug = city ? generateSlug(city) : 'todas';

  const filteredRestaurants = restaurants.filter(restaurant => {
    if (serviceType === 'delivery') return restaurant.has_delivery;
    if (serviceType === 'pickup') return restaurant.has_pickup;
    return true;
  });

  const newRestaurants = [...filteredRestaurants].reverse().slice(0, 6);
  const popularRestaurants = filteredRestaurants.slice(0, 6);

  const RestaurantCard = ({ restaurant }: { restaurant: any }) => {
    const status = restaurant.code
      ? { isOpen: restaurant.acceptingOrders, text: restaurant.message }
      : getRestaurantStatus(restaurant.opening_hours);
    const isTrending = trendingRestaurants.some(tr => tr.id === restaurant.id);
    const responseScore = getResponseScore(restaurant.id) + (restaurant.response_score || 0);
    const isFastResponse = responseScore > 5;
    const rating = restaurant.rating_score ? restaurant.rating_score.toFixed(1) : null;
    
    return (
      <Link to={`/r/${generateSlug(restaurant.restaurant_name || restaurant.name)}`} className="block group h-full">
        <div className="bg-white rounded-[24px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 h-full flex flex-col transform hover:-translate-y-1">
          <div className="h-48 bg-gray-100 relative flex items-center justify-center overflow-hidden">
            <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
              {isTrending && (
                <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center">
                  <span className="mr-1">🔥</span> Popular
                </div>
              )}
              {isFastResponse && (
                <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center">
                  <span className="mr-1">⚡</span> Responde rápido
                </div>
              )}
              {status?.isOpen && (
                <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center">
                  <span className="mr-1">🟢</span> Abierto
                </div>
              )}
              {restaurant.has_delivery && (
                <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center">
                  <span className="mr-1">🛵</span> Entrega disponible
                </div>
              )}
              {restaurant.has_pickup && (
                <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center">
                  <span className="mr-1">🟢</span> Recoge en sucursal
                </div>
              )}
              {!restaurant.has_delivery && !restaurant.has_pickup && (
                <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center">
                  <span className="mr-1">❌</span> Solo pedidos directos
                </div>
              )}
            </div>
            {restaurant.cover_image || restaurant.coverUrl ? (
              <img src={restaurant.cover_image || restaurant.coverUrl} alt={restaurant.restaurant_name || restaurant.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-300">
                <Utensils className="w-12 h-12" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-bold text-xl text-gray-900 group-hover:text-[#FF6B00] transition-colors line-clamp-1">{restaurant.restaurant_name || restaurant.name}</h3>
              <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg shrink-0">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                <span className="text-sm font-bold text-gray-700">{rating || 'Nuevo'}</span>
              </div>
            </div>
            <p className="text-gray-500 text-sm line-clamp-1 mb-3">
              {restaurant.categories && restaurant.categories.length > 0 
                ? restaurant.categories.map((c: any) => c.name).join(' • ') 
                : restaurant.cuisine_type || 'Comida a domicilio'}
            </p>
            <div className="mt-auto pt-3 border-t border-gray-50 flex flex-col gap-2 text-sm text-gray-500">
              {restaurant.has_delivery === false && (
                <div className="flex items-center gap-1.5 text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-md w-fit">
                  <Car className="w-4 h-4" />
                  <span>Puedes pedir y enviar Uber/Didi</span>
                </div>
              )}
              {isFastResponse && (
                <div className="flex items-center gap-1.5 text-[#FF6B00] font-medium">
                  <Clock className="w-4 h-4" />
                  <span>Responde en menos de 5 min</span>
                </div>
              )}
              {restaurant.orders_today > 0 && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <ShoppingBag className="w-4 h-4" />
                  <span>{restaurant.orders_today} personas pidieron aquí hoy</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Último pedido hace {restaurant.last_order_minutes_ago || Math.floor(Math.random() * 59) + 1} min</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-12 pb-12">
      {/* 1. HERO SECTION WITH SEARCH */}
      <section className="relative bg-orange-500 rounded-[32px] overflow-hidden shadow-lg">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/80 to-orange-700/90"></div>
        
        <div className="relative px-6 py-16 sm:py-24 text-center flex flex-col items-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-4 tracking-tight max-w-3xl">
            ¿Tienes hambre?
          </h1>
          <p className="text-xl sm:text-2xl text-orange-100 mb-8 font-medium">
            Encuentra algo delicioso en segundos
          </p>
          
          <form onSubmit={handleSearch} className="w-full max-w-2xl relative mb-6 group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-14 pr-32 py-4 sm:py-5 border-0 rounded-2xl text-gray-900 ring-1 ring-inset ring-white/20 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-lg shadow-xl bg-white/95 backdrop-blur-sm transition-all"
              placeholder={city ? `Buscar tacos, pizza, sushi en ${city}...` : "Buscar tacos, pizza, sushi..."}
            />
            <div className="absolute inset-y-2 right-2 flex items-center">
              <button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 sm:py-3 rounded-xl font-bold transition-colors shadow-sm h-full"
              >
                Buscar
              </button>
            </div>
          </form>

          {lastOrderId && (
            <div className="mb-8 bg-white/20 border border-white/30 backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm w-full max-w-2xl">
              <div className="flex items-center gap-3 text-white">
                <span className="text-3xl">🍔</span>
                <div className="text-left">
                  <p className="font-bold text-lg">Tu último pedido</p>
                  <p className="text-orange-100 text-sm">¿Se te antoja lo mismo?</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const trackingToken = localStorage.getItem('lastOrderTrackingToken');
                  navigate(lastOrderId === 'local' || user ? '/last-order' : '/track/' + lastOrderId + (trackingToken ? '?token=' + encodeURIComponent(trackingToken) : ''));
                }}
                className="bg-white text-orange-600 hover:bg-orange-50 px-6 py-2.5 rounded-xl font-bold transition-colors shadow-sm whitespace-nowrap"
              >
                Repetir pedido
              </button>
            </div>
          )}

          <div className="flex flex-col items-center gap-1 text-orange-50 mt-2">
            <div className="flex items-center gap-2 text-xl font-medium">
              <span>📍</span>
              <span>{city || 'Todas las ciudades'}</span>
            </div>
            <div className="font-medium text-orange-100">
              +{restaurants.length} restaurantes disponibles
            </div>
          </div>
        </div>
      </section>

      {/* 2. FOOD CATEGORIES SECTION */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">¿Qué se te antoja?</h2>
        </div>
        <div className="flex overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 gap-4 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              to={`/${category.slug}/${citySlug}`}
              className="snap-start shrink-0 group"
            >
              <div className="bg-white border border-gray-100 rounded-[24px] p-4 w-40 sm:w-44 flex flex-col items-center gap-3 shadow-sm hover:shadow-lg hover:border-orange-100 transition-all duration-200 transform hover:-translate-y-1">
                <div className="w-32 h-32 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <img 
                    src={category.image} 
                    alt={category.name} 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all duration-200"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextElementSibling) {
                        e.currentTarget.nextElementSibling.classList.remove('hidden');
                        e.currentTarget.nextElementSibling.classList.add('flex');
                      }
                    }}
                  />
                  <div className="hidden text-6xl bg-gray-50 w-full h-full rounded-full items-center justify-center">
                    {category.icon}
                  </div>
                </div>
                <span className="font-bold text-gray-800 text-sm group-hover:text-[#FF6B00] transition-colors text-center">
                  {category.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 2.4 TRENDING RESTAURANTS SECTION */}
      {trendingRestaurants.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="text-orange-500">🔥</span> Populares cerca de ti
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        </section>
      )}

      {/* 2.4.5 FAST RESPONSE SECTION */}
      {filteredRestaurants.filter(r => (getResponseScore(r.id) + (r.response_score || 0)) > 5).length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="text-yellow-400">⚡</span> Respuesta rápida
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.filter(r => (getResponseScore(r.id) + (r.response_score || 0)) > 5).slice(0, 6).map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        </section>
      )}

      {/* 2.4.6 TOP RATED SECTION */}
      {filteredRestaurants.filter(r => r.rating_score && r.rating_score >= 4.5).length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="text-yellow-400">⭐</span> Mejor calificados
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...filteredRestaurants]
              .filter(r => r.rating_score && r.rating_score >= 4.5)
              .sort((a, b) => b.rating_score - a.rating_score)
              .slice(0, 6)
              .map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        </section>
      )}

      {/* 2.5 POPULAR TODAY SECTION */}
      {popularProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Star className="w-6 h-6 text-orange-500 fill-orange-500" />
              Populares Hoy
            </h2>
          </div>
          <div className="flex overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 gap-4 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {popularProducts.map((product) => (
              <Link
                key={product.id}
                to={`/r/${generateSlug(product.restaurant.restaurant_name || product.restaurant.name)}`}
                className="snap-start shrink-0 group w-64"
              >
                <div className="bg-white border border-gray-100 rounded-[20px] p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all duration-300 h-full">
                  <div className="w-full h-32 bg-gray-100 rounded-xl overflow-hidden relative">
                    {(product.product_image || product.imageUrl) ? (
                      <img src={product.product_image || product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-orange-300 bg-orange-50">
                        <Utensils className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-orange-600 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                      <ShoppingBag className="w-3 h-3" />
                      {product.recent_orders} pedidos
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 truncate group-hover:text-orange-600 transition-colors">{product.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{product.restaurant.restaurant_name || product.restaurant.name}</p>
                    <p className="font-medium text-orange-600 mt-1">${product.price.toFixed(2)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. PROMOTED RESTAURANT BANNERS */}
      {banners.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <div key={banner.id} className="relative h-64 rounded-[24px] overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
              <img src={banner.image} alt={banner.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
              <div className="absolute inset-0 p-8 flex flex-col justify-center items-start">
                <h3 className="text-3xl font-bold text-white mb-2 max-w-[250px] leading-tight">{banner.title}</h3>
                {banner.subtitle && <p className="text-white/80 mb-4">{banner.subtitle}</p>}
                <Link 
                  to={banner.link.startsWith('http') ? banner.link : `${banner.link}/${citySlug}`}
                  className="mt-4 bg-white text-gray-900 px-6 py-2.5 rounded-xl font-bold hover:bg-orange-50 transition-colors shadow-sm"
                >
                  {banner.buttonText}
                </Link>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 4. FEATURED RESTAURANTS */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Todos los restaurantes</h2>
          
          {/* Service Type Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setServiceType('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                serviceType === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setServiceType('delivery')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                serviceType === 'delivery'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Entrega disponible
            </button>
            <button
              onClick={() => setServiceType('pickup')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                serviceType === 'pickup'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Recoger en sucursal
            </button>
          </div>

          <Link to={`/restaurantes/${citySlug}`} className="text-orange-600 font-medium hover:text-orange-700 flex items-center gap-1 text-sm shrink-0">
            Ver todos <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(6).fill(0).map((_, i) => <RestaurantCardSkeleton key={i} />)
          ) : filteredRestaurants.length > 0 ? (
            filteredRestaurants.slice(0, 12).map((restaurant: any) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))
          ) : (
            <div className="col-span-full text-center py-16 px-4 bg-white rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 mb-2">
                <Store className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">🔥 Nuevos restaurantes pronto</h3>
              <p className="text-gray-500 text-lg max-w-md mx-auto">
                🆕 Próximamente en tu zona. Estamos trabajando para traerte las mejores opciones.
              </p>
              {city && (
                <button 
                  onClick={() => setCity('')}
                  className="mt-4 bg-orange-100 text-orange-700 px-6 py-2.5 rounded-xl font-medium hover:bg-orange-200 transition-colors"
                >
                  Ver todas las ciudades
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-3xl mx-auto pt-8 border-t border-gray-100">
        {/* <AIAssistant /> */}
      </section>
    </div>
  );
}
