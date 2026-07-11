import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Utensils, Store, Star, MessageCircle, Share2, Clock, ShoppingBag, Car } from 'lucide-react';
import { useCityStore } from '../store';
import { generateSlug, getRestaurantStatus } from '../utils';
import { trackWhatsAppClick, getResponseScore } from '../utils/whatsapp';
import { getCache, setCache } from '../utils/cache';

export function RestaurantDirectory() {
  const { city: urlCity, category: urlCategory } = useParams();
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const excludeId = searchParams.get('exclude');

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const { city, setCity } = useCityStore();
  const [cuisine, setCuisine] = useState(urlCategory || categoryFilter || '');
  const [serviceType, setServiceType] = useState<'all' | 'delivery' | 'pickup'>('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (urlCity) {
      setCity(urlCity);
    }
    if (urlCategory) {
      setCuisine(urlCategory);
    } else if (categoryFilter) {
      setCuisine(categoryFilter);
    }
  }, [urlCity, urlCategory, categoryFilter, setCity]);

  const fetchDirectory = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (city) params.append('city', city);
    if (cuisine) params.append('cuisine', cuisine);
    params.append('page', pageNum.toString());
    params.append('limit', '12'); // Load 12 per page

    const cacheKey = `directory-${params.toString()}`;
    
    if (pageNum === 1 && !append && !excludeId) {
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        setRestaurants(cachedData.data);
        setHasMore(cachedData.pagination.page < cachedData.pagination.totalPages);
        setLoading(false);
      }
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/directory?${params.toString()}`);
      const data = await res.json();
      
      let fetchedData = data.data || (Array.isArray(data) ? data : []);
      let hasMoreData = data.pagination ? data.pagination.page < data.pagination.totalPages : false;

      if (excludeId) {
        fetchedData = fetchedData.filter((r: any) => r.id !== excludeId);
        // Sort by orders_today DESC, rating_score DESC if it's an alternative search
        fetchedData.sort((a: any, b: any) => {
          const aOrders = a.orders_today || 0;
          const bOrders = b.orders_today || 0;
          if (bOrders !== aOrders) return bOrders - aOrders;
          
          const aRating = a.rating_score || 0;
          const bRating = b.rating_score || 0;
          return bRating - aRating;
        });
      }

      if (append) {
        setRestaurants(prev => [...prev, ...fetchedData]);
      } else {
        setRestaurants(fetchedData);
        if (!excludeId && data.data) {
          setCache(cacheKey, data, 5); // Cache for 5 minutes
        }
      }
      setHasMore(hasMoreData);
    } catch (error) {
      if (!append && restaurants.length === 0) setRestaurants([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Only fetch automatically when globalCity changes the local city initially or via nav
    // For manual typing, we rely on the form submit
    const timeoutId = setTimeout(() => {
      setPage(1);
      fetchDirectory(1, false);
    }, 500); // Debounce fetch
    return () => clearTimeout(timeoutId);
  }, [city, search, cuisine]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDirectory(1, false);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchDirectory(nextPage, true);
    }
  };

  const pageTitle = urlCategory && urlCity 
    ? `${urlCategory.charAt(0).toUpperCase() + urlCategory.slice(1)} en ${urlCity.charAt(0).toUpperCase() + urlCity.slice(1)} | Yommi`
    : urlCity 
      ? `Restaurantes en ${urlCity.charAt(0).toUpperCase() + urlCity.slice(1)} | Yommi`
      : 'Directorio de Restaurantes';

  const pageDescription = urlCategory && urlCity
    ? `Descubre los mejores ${urlCategory} en ${urlCity} con Yommi.`
    : urlCity
      ? `Descubre restaurantes en ${urlCity}. Encuentra tacos, sushi, pizza y más en Yommi.`
      : 'Encuentra los mejores restaurantes en tu ciudad, incluso si aún no están en Yomi.';

  useEffect(() => {
    document.title = pageTitle;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', pageDescription);
    }
  }, [pageTitle, pageDescription]);

  const filteredRestaurants = restaurants.filter(restaurant => {
    if (serviceType === 'delivery') return restaurant.has_delivery;
    if (serviceType === 'pickup') return restaurant.has_pickup;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-orange-600 rounded-3xl p-8 sm:p-12 text-white text-center">
        <h1 className="text-4xl font-bold mb-4">{urlCategory && urlCity ? `${urlCategory.charAt(0).toUpperCase() + urlCategory.slice(1)} en ${urlCity.charAt(0).toUpperCase() + urlCity.slice(1)}` : urlCity ? `Restaurantes en ${urlCity.charAt(0).toUpperCase() + urlCity.slice(1)}` : 'Directorio de Restaurantes'}</h1>
        <p className="text-orange-100 text-lg max-w-2xl mx-auto mb-8">
          {pageDescription}
        </p>
        
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex-1 relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Ciudad..."
              value={city || ''}
              onChange={(e) => setCity(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex-1 relative">
            <Utensils className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Tipo de comida..."
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <button type="submit" className="bg-gray-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors">
            Buscar
          </button>
        </form>
      </div>

      {urlCity && !urlCategory && (
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to={`/tacos/${generateSlug(urlCity)}`} className="px-4 py-2 bg-gray-100 rounded-full hover:bg-orange-100 hover:text-orange-700 transition-colors">Tacos</Link>
          <Link to={`/pizza/${generateSlug(urlCity)}`} className="px-4 py-2 bg-gray-100 rounded-full hover:bg-orange-100 hover:text-orange-700 transition-colors">Pizza</Link>
          <Link to={`/sushi/${generateSlug(urlCity)}`} className="px-4 py-2 bg-gray-100 rounded-full hover:bg-orange-100 hover:text-orange-700 transition-colors">Sushi</Link>
          <Link to={`/hamburguesas/${generateSlug(urlCity)}`} className="px-4 py-2 bg-gray-100 rounded-full hover:bg-orange-100 hover:text-orange-700 transition-colors">Hamburguesas</Link>
        </div>
      )}

      {/* Service Type Filter */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-[24px] shadow-sm overflow-hidden border border-gray-100 h-full flex flex-col animate-pulse">
              <div className="h-48 bg-gray-200"></div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="h-6 bg-gray-200 rounded-lg w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded-lg w-1/2 mb-4"></div>
                <div className="mt-auto pt-3 border-t border-gray-50 flex flex-col gap-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded-lg w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((restaurant: any) => {
            const status = getRestaurantStatus(restaurant.opening_hours);
            const responseScore = getResponseScore(restaurant.id) + (restaurant.response_score || 0);
            const isFastResponse = responseScore > 5;
            const rating = restaurant.rating_score ? restaurant.rating_score.toFixed(1) : null;
                      return (
            <Link key={restaurant.id} to={`/r/${generateSlug(restaurant.restaurant_name || restaurant.name)}`} className="block group h-full">
              <div className="bg-white rounded-[24px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 h-full flex flex-col transform hover:-translate-y-1">
                <div className="h-48 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
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
                  </div>
                  {restaurant.cover_image || restaurant.coverUrl || restaurant.image_url ? (
                    <img src={restaurant.cover_image || restaurant.coverUrl || restaurant.image_url} alt={restaurant.restaurant_name || restaurant.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" referrerPolicy="no-referrer" />
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
                    {restaurant.has_delivery && restaurant.has_pickup && (
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-md w-fit">
                          <span className="text-sm">🛵</span>
                          <span>Entrega disponible</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md w-fit">
                          <span className="text-sm">🟢</span>
                          <span>Recoge en sucursal</span>
                        </div>
                      </div>
                    )}
                    {restaurant.has_delivery && !restaurant.has_pickup && (
                      <div className="flex items-center gap-1.5 text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-md w-fit">
                        <span className="text-sm">🛵</span>
                        <span>Entrega disponible</span>
                      </div>
                    )}
                    {!restaurant.has_delivery && restaurant.has_pickup && (
                      <div className="flex items-center gap-1.5 text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md w-fit">
                        <span className="text-sm">🟢</span>
                        <span>Recoge en sucursal</span>
                      </div>
                    )}
                    {!restaurant.has_delivery && !restaurant.has_pickup && (
                      <div className="flex items-center gap-1.5 text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded-md w-fit">
                        <span className="text-sm">❌</span>
                        <span>Solo pedidos directos</span>
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
          })}
          {filteredRestaurants.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-100">
              {city ? "Aún no hay restaurantes registrados en esta ciudad con estos filtros." : "No se encontraron restaurantes con esos criterios."}
            </div>
          )}
        </div>
      )}

      {hasMore && !loading && filteredRestaurants.length > 0 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="bg-orange-100 text-orange-600 px-8 py-3 rounded-xl font-medium hover:bg-orange-200 transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Cargando...' : 'Cargar más restaurantes'}
          </button>
        </div>
      )}
    </div>
  );
}
