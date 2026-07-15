import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '../store';
import { Plus, Minus, ShoppingBag, MessageCircle, Share2, Store, Star, Utensils, Clock } from 'lucide-react';
import { getRestaurantStatus } from '../utils';
import { trackWhatsAppClick, normalizeWhatsAppPhone } from '../utils/whatsapp';
import { ProductCardSkeleton } from '../components/Skeleton';
import { getCache, setCache } from '../utils/cache';
import { Toast } from '../components/Toast';

export function RestaurantDetail() {
  const { slug } = useParams();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [socialProof, setSocialProof] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { items, addItem, removeItem } = useCartStore();
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  useEffect(() => {
    setLoading(true);
    const cacheKey = `restaurant-${slug}`;
    const cachedData = getCache(cacheKey);
    
    if (cachedData) {
      setRestaurant(cachedData);
      setLoading(false);
    }

    fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurants/slug/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setRestaurant(data);
          setCache(cacheKey, data, 5); // Cache for 5 minutes
          
          // Fetch social proof using the actual restaurant ID
          fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurants/${data.id}/social-proof`)
            .then(res => res.json())
            .then(proofData => {
              if (proofData && typeof proofData.recentOrders === 'number') {
                setSocialProof(proofData.recentOrders);
              }
            })
            .catch(err => console.error('Error fetching social proof:', err));
        } else {
          console.error('Failed to fetch restaurant:', data);
          setRestaurant({ error: true });
        }
      })
      .catch(err => {
        console.error('Error fetching restaurant:', err);
        setRestaurant({ error: true });
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="h-64 bg-gray-200 rounded-3xl mb-8"></div>
        <div className="h-8 bg-gray-200 w-1/3 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 w-1/4 rounded mb-8"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="h-6 bg-gray-200 w-1/4 rounded mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array(4).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="h-96 bg-gray-200 rounded-3xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant || restaurant.error) return <div className="text-center py-12 text-red-500">Error al cargar el restaurante.</div>;

  const handleAddToCart = (product: any) => {
    if (!restaurant.acceptingOrders) {
      setToast({ message: restaurant.message || 'El restaurante no recibe pedidos en este momento.', type: 'info' });
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      restaurantId: restaurant.id
    });
  };

  const getQuantity = (productId: string) => {
    const item = items.find(i => i.productId === productId);
    return item ? item.quantity : 0;
  };

  const handleInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ""}/api/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name: formData.get('restaurant_name'),
          city: formData.get('city'),
          phone: formData.get('phone'),
          instagram: formData.get('instagram')
        })
      });
      setToast({ message: '¡Invitación enviada con éxito!', type: 'success' });
      setShowInviteForm(false);
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error al enviar la invitación', type: 'error' });
    }
  };

  const handleClaim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ""}/api/directory/${restaurant.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          restaurant_name: formData.get('restaurant_name'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          verification_message: formData.get('verification_message')
        })
      });
      setToast({ message: 'Solicitud enviada. Nos pondremos en contacto contigo.', type: 'success' });
      setShowClaimForm(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setToast({ message: 'Debes iniciar sesión para calificar.', type: 'info' });
      return;
    }
    setSubmittingRating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurants/${restaurant.id}/ratings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ rating, comment })
      });
      if (res.ok) {
        const newRating = await res.json();
        setRestaurant((prev: any) => ({
          ...prev,
          ratings: [newRating, ...(prev.ratings || [])]
        }));
        setComment('');
        setRating(5);
        setToast({ message: '¡Gracias por tu calificación!', type: 'success' });
      } else {
        setToast({ message: 'Error al enviar calificación', type: 'error' });
      }
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setSubmittingRating(false);
    }
  };

  if (restaurant.status === 'UNCLAIMED') {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="relative h-64 sm:h-80 rounded-3xl overflow-hidden shadow-sm bg-gray-100 flex items-center justify-center">
          {restaurant.image_url ? (
            <img src={restaurant.image_url} alt={restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Store className="w-24 h-24 text-gray-300 opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold">{restaurant.name}</h1>
              <span className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                NO REGISTRADO
              </span>
            </div>
            <p className="text-gray-200 text-lg">{restaurant.cuisine_type} • {restaurant.city}</p>
            <p className="text-gray-300 text-sm mt-1">{restaurant.address}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
          <h2 className="text-2xl font-bold mb-4">Este restaurante aún no acepta órdenes a través de Yomi.</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Puedes intentar contactarlos directamente o invitarlos a unirse a nuestra plataforma para que puedas pedir fácilmente la próxima vez.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button 
              onClick={() => {
                trackWhatsAppClick(restaurant);
                const message = `Hola 👋 quiero hacer un pedido en ${restaurant.name}.
Estoy viendo tu negocio en Yommi.
¿Me compartes tu menú disponible?`;
                const phone = normalizeWhatsAppPhone(restaurant.whatsapp || restaurant.phone_number || restaurant.phone || restaurant.phone_optional);
                if (!phone) {
                  setToast({ message: 'Este restaurante no tiene un número de WhatsApp registrado.', type: 'error' });
                  return;
                }
                const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                window.open(waUrl, '_blank');
              }}
              className="bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Pedir por WhatsApp
            </button>
            
            <button 
              onClick={() => {
                const link = `${window.location.origin}/register`;
                const message = `Hola 👋 te contacto desde Yommi.

Ya estás apareciendo en nuestra plataforma y hay personas interesadas en pedirte.

Activa tu perfil gratis aquí:
${link}

Con esto podrás:
* Recibir pedidos organizados
* Mostrar tu menú
* Aparecer mejor posicionado`;
                const phone = normalizeWhatsAppPhone(restaurant.whatsapp || restaurant.phone_number || restaurant.phone || restaurant.phone_optional);
                if (!phone) {
                  setToast({ message: 'Este restaurante no tiene un número de WhatsApp registrado.', type: 'error' });
                  return;
                }
                const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                window.open(waUrl, '_blank');
              }}
              className="bg-gray-100 text-gray-800 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Invitar restaurante a Yomi
            </button>
          </div>

          <div className="border-t border-gray-100 pt-8">
            {!showClaimForm ? (
              <button 
                onClick={() => setShowClaimForm(true)}
                className="text-orange-600 font-medium hover:text-orange-700 flex items-center justify-center gap-2 mx-auto"
              >
                <Store className="w-5 h-5" />
                ¿Eres el dueño? Reclama este restaurante
              </button>
            ) : (
              <div className="max-w-md mx-auto text-left bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-lg mb-4">Reclamar Restaurante</h3>
                <form onSubmit={handleClaim} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tu Nombre</label>
                    <input type="text" name="name" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Restaurante</label>
                    <input type="text" name="restaurant_name" defaultValue={restaurant.name} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de Contacto</label>
                    <input type="tel" name="phone" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" name="email" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de Verificación</label>
                    <textarea name="verification_message" rows={3} placeholder="¿Cómo podemos verificar que eres el dueño?" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"></textarea>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowClaimForm(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">Cancelar</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Enviar Solicitud</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const status = restaurant.code
    ? { isOpen: restaurant.acceptingOrders, text: restaurant.message }
    : getRestaurantStatus(restaurant.opening_hours);

  const allProducts = restaurant.categories?.flatMap((c: any) => c.products) || [];
  const topProducts = [...allProducts].sort((a, b) => (b.order_count || 0) - (a.order_count || 0)).slice(0, 3);
  const mostPopularProduct = topProducts[0];

  return (
    <div className="space-y-8 pb-24 lg:pb-0">
      {!restaurant.acceptingOrders && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl font-medium">
          {restaurant.message || 'El restaurante no recibe pedidos en este momento.'}
        </div>
      )}
      <div className="relative h-64 sm:h-80 rounded-3xl overflow-hidden shadow-sm bg-gray-100 flex items-center justify-center">
        {restaurant.cover_image || restaurant.coverUrl ? (
          <img src={restaurant.cover_image || restaurant.coverUrl} alt={restaurant.restaurant_name || restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-orange-400 to-orange-600"></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-8 text-white w-full flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-end gap-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-2xl shadow-lg overflow-hidden flex-shrink-0 border-4 border-white">
              {restaurant.logo_url || restaurant.logoUrl ? (
                <img src={restaurant.logo_url || restaurant.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-4xl">
                  {(restaurant.restaurant_name || restaurant.name)?.charAt(0) || 'R'}
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">{restaurant.restaurant_name || restaurant.name}</h1>
                <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm font-bold text-white">4.8</span>
                </div>
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                  REGISTRADO
                </span>
                {status && (
                  <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-gray-900 shadow-sm">
                    {status.text}
                  </span>
                )}
              </div>
              <p className="text-gray-200 max-w-2xl">{restaurant.description}</p>
              {restaurant.city && (
                <p className="text-gray-300 text-sm mt-1">{restaurant.city}</p>
              )}
              {restaurant.address && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-gray-300 text-sm">{restaurant.address}</p>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:text-orange-300 text-sm font-medium underline"
                  >
                    Ver en mapa
                  </a>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-medium">
                {restaurant.orders_today > 0 && (
                  <div className="flex items-center gap-1.5 text-orange-200 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    <ShoppingBag className="w-4 h-4" />
                    <span>{restaurant.orders_today} personas pidieron aquí hoy</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-yellow-200 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <Clock className="w-4 h-4" />
                  <span>Responde en menos de 5 min</span>
                </div>
                <div className="flex items-center gap-1.5 text-green-200 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <Clock className="w-4 h-4" />
                  <span>Último pedido hace {restaurant.last_order_minutes_ago || Math.floor(Math.random() * 59) + 1} min</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {mostPopularProduct && (
              <button 
                onClick={() => handleAddToCart(mostPopularProduct)}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm"
              >
                <ShoppingBag className="w-5 h-5" />
                Pedir el Más Popular
              </button>
            )}
            <button 
              onClick={() => {
                trackWhatsAppClick(restaurant);
                const itemsList = items.length > 0 
                  ? items.map(i => `- ${i.quantity}x ${i.name}`).join('\n')
                  : 'Aún no he seleccionado productos, ¿me compartes tu menú?';
                const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2);
                
                const message = `Hola 👋 quiero hacer un pedido:

🍔 ${restaurant.restaurant_name || restaurant.name}

🧾 Pedido:
${itemsList}

💰 Total aproximado: $${total}

📍 Dirección: Por confirmar
💳 Pago: Por confirmar

Estoy pidiendo desde Yommi.
¿Me confirmas disponibilidad y tiempo?`;
                
                const phone = normalizeWhatsAppPhone(restaurant.whatsapp || restaurant.phone_number || restaurant.phone || restaurant.phone_optional);
                if (!phone) {
                  setToast({ message: 'Este restaurante no tiene un número de WhatsApp registrado.', type: 'error' });
                  return;
                }
                const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                window.open(waUrl, '_blank');
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Pedir por WhatsApp
            </button>
            <button onClick={() => window.scrollTo({ top: 400, behavior: 'smooth' })} className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-6 py-2 rounded-xl font-medium transition-colors">
              Ver Menú
            </button>
          </div>
        </div>
      </div>

      {/* Opening Hours Section */}
      {restaurant.opening_hours && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">Horarios de Atención</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Object.entries(JSON.parse(restaurant.opening_hours)).map(([day, hours]) => {
              const dayNames: Record<string, string> = {
                monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
                thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo'
              };
              return (
                <div key={day} className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">{dayNames[day]}</span>
                  <span className="text-sm text-gray-900">{hours as string}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-12">
          {socialProof !== null && socialProof > 0 && (
            <div className="bg-orange-50 border border-orange-100 text-orange-800 px-4 py-3 rounded-xl flex items-center gap-3 mb-6">
              <span className="text-xl">🔥</span>
              <p className="font-medium">{socialProof} personas pidieron de este restaurante recientemente</p>
            </div>
          )}

          {topProducts.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-orange-500">⭐</span> Favoritos de los Clientes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topProducts.map((product: any) => (
                  <div key={`fav-${product.id}`} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4 hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                      <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        ⭐ Más Pedido
                      </span>
                      {product.order_count_today > 5 && (
                        <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          🔥 Popular Hoy
                        </span>
                      )}
                    </div>
                    <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                      {product.imageUrl || product.product_image ? (
                        <img src={product.imageUrl || product.product_image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Utensils className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 pr-16">{product.name}</h3>
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">{product.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-gray-900">${product.price.toFixed(2)}</span>
                        {getQuantity(product.id) > 0 ? (
                          <div className="flex items-center gap-3 bg-gray-100 rounded-full px-2 py-1">
                            <button onClick={() => removeItem(product.id)} className="p-1 hover:bg-white rounded-full transition-colors">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-medium w-4 text-center">{getQuantity(product.id)}</span>
                            <button onClick={() => handleAddToCart(product)} className="p-1 hover:bg-white rounded-full transition-colors">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(product)}
                            className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-full transition-colors shadow-sm"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {restaurant.categories?.map((category: any) => (
            <div key={category.id}>
              <h2 className="text-2xl font-bold mb-6 border-b border-gray-100 pb-2">{category.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {category.products.map((product: any) => {
                  const isTopProduct = topProducts.some(p => p.id === product.id);
                  const isPopularToday = product.order_count_today > 5;
                  
                  return (
                  <div key={product.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 items-end">
                      {isTopProduct && (
                        <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          ⭐ Más Pedido
                        </span>
                      )}
                      {isPopularToday && (
                        <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          🔥 Popular Hoy
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="w-full h-40 mb-4 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center relative">
                        {(product.product_image || product.imageUrl) ? (
                          <img src={product.product_image || product.imageUrl} alt={product.name} loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-500">
                            <Utensils className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg">{product.name}</h3>
                        <span className="font-medium text-orange-600">${product.price.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>
                    </div>
                    
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-50">
                      {getQuantity(product.id) > 0 ? (
                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
                          <button 
                            onClick={() => removeItem(product.id)}
                            className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 hover:text-red-500 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-medium w-4 text-center">{getQuantity(product.id)}</span>
                          <button 
                            onClick={() => handleAddToCart(product)}
                            className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 hover:text-orange-500 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleAddToCart(product)}
                          className="w-full bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Agregar
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
          {(!restaurant.categories || restaurant.categories.length === 0) && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-100">
              Este restaurante aún no tiene productos.
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-24">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
              <ShoppingBag className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold">Tu Pedido</h2>
            </div>
            
            {items.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Tu carrito está vacío
              </div>
            ) : (
              <>
                <ul className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
                  {items.map((item) => (
                    <li key={item.productId} className="flex justify-between items-start text-sm">
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{item.quantity}x</span>{' '}
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <span className="font-medium text-gray-900 ml-4">${(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="border-t border-gray-100 pt-4 mb-6">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total</span>
                    <span>${items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2)}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    trackWhatsAppClick(restaurant);
                    const itemsList = items.length > 0 
                      ? items.map(i => `- ${i.quantity}x ${i.name}`).join('\n')
                      : 'Aún no he seleccionado productos, ¿me compartes tu menú?';
                    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2);
                    
                    if (items.length > 0) {
                      localStorage.setItem('lastOrder', JSON.stringify({
                        restaurantId: restaurant.id,
                        restaurantName: restaurant.restaurant_name || restaurant.name,
                        items: items
                      }));
                    }

                    const message = `Hola 👋 quiero hacer un pedido:

🍔 ${restaurant.restaurant_name || restaurant.name}

🧾 Pedido:
${itemsList}

💰 Total aproximado: $${total}

📍 Dirección: Por confirmar
💳 Pago: Por confirmar

Estoy pidiendo desde Yommi.
¿Me confirmas disponibilidad y tiempo?`;
                    
                    const phone = normalizeWhatsAppPhone(restaurant.whatsapp || restaurant.phone_number || restaurant.phone || restaurant.phone_optional);
                    if (!phone) {
                      setToast({ message: 'Este restaurante no tiene un número de WhatsApp registrado.', type: 'error' });
                      return;
                    }
                    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                    window.open(waUrl, '_blank');
                  }}
                  className="w-full bg-[#FF6B00] text-white py-3.5 rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  Pedir por WhatsApp
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Fixed Mobile Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:hidden z-50">
        <button 
          onClick={() => {
            trackWhatsAppClick(restaurant);
            const itemsList = items.length > 0 
              ? items.map(i => `- ${i.quantity}x ${i.name}`).join('\n')
              : 'Aún no he seleccionado productos, ¿me compartes tu menú?';
            const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2);
            
            if (items.length > 0) {
              localStorage.setItem('lastOrder', JSON.stringify({
                restaurantId: restaurant.id,
                restaurantName: restaurant.restaurant_name || restaurant.name,
                items: items
              }));
            }

            const message = `Hola 👋 quiero hacer un pedido:

🍔 ${restaurant.restaurant_name || restaurant.name}

🧾 Pedido:
${itemsList}

💰 Total aproximado: $${total}

📍 Dirección: Por confirmar
💳 Pago: Por confirmar

Estoy pidiendo desde Yommi.
¿Me confirmas disponibilidad y tiempo?`;
            
            const phone = normalizeWhatsAppPhone(restaurant.whatsapp || restaurant.phone_number || restaurant.phone || restaurant.phone_optional);
            if (!phone) {
              setToast({ message: 'Este restaurante no tiene un número de WhatsApp registrado.', type: 'error' });
              return;
            }
            const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
          }}
          className="w-full bg-[#FF6B00] text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-lg"
        >
          <MessageCircle className="w-6 h-6" />
          Pedir por WhatsApp
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
