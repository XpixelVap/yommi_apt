import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '../store';
import { MapPin, CreditCard, Trash2, MessageCircle } from 'lucide-react';
import { trackWhatsAppClick, normalizeWhatsAppPhone } from '../utils/whatsapp';

export function Cart() {
  const { items, removeItem, clearCart } = useCartStore();
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [fulfillmentType, setFulfillmentType] = useState<'PICKUP' | 'DELIVERY'>('DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<'PAY_AT_RESTAURANT' | 'CASH_ON_DELIVERY' | 'BANK_TRANSFER'>('CASH_ON_DELIVERY');

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const deliveryFee = fulfillmentType === 'DELIVERY' ? Number(restaurant?.deliveryFeeCents || 0) / 100 : 0;
  const total = subtotal + deliveryFee;

  useEffect(() => {
    if (!items[0]?.restaurantId) return;
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurants/${items[0].restaurantId}`)
      .then(res => res.json())
      .then(data => {
        setRestaurant(data);
        if (!data.acceptingOrders) setError(data.message || 'El restaurante no recibe pedidos en este momento.');
        const fulfillment = data.has_delivery ? 'DELIVERY' : 'PICKUP';
        setFulfillmentType(fulfillment);
        setPaymentMethod(fulfillment === 'PICKUP' ? 'PAY_AT_RESTAURANT' : data.acceptsCashOnDelivery ? 'CASH_ON_DELIVERY' : 'BANK_TRANSFER');
      })
      .catch(() => setError('No se pudo cargar la configuración del restaurante'));
  }, [items]);

  const handleCheckout = async () => {
    setError(null);
    if (restaurant && !restaurant.acceptingOrders) {
      setError(restaurant.message || 'El restaurante no recibe pedidos en este momento.');
      return;
    }
    if (fulfillmentType === 'DELIVERY' && !address) {
      setError('Por favor ingresa una dirección de entrega');
      return;
    }
    if (!user) {
      if (!guestName) {
        setError('Por favor ingresa tu nombre para el pedido');
        return;
      }
      if (!guestPhone) {
        setError('Por favor ingresa tu teléfono para el pedido');
        return;
      }
      if (!/^\d{10}$/.test(guestPhone)) {
        setError('El número de teléfono (WhatsApp) debe tener exactamente 10 dígitos.');
        return;
      }
    }

    setLoading(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          restaurantId: items[0].restaurantId,
          fulfillmentType,
          paymentMethod,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          deliveryAddress: fulfillmentType === 'DELIVERY' ? address : undefined,
          deliveryLat: 19.4326, // Mock location
          deliveryLng: -99.1332,
          guestName: user ? undefined : guestName,
          guestPhone: user ? undefined : guestPhone,
          customerNotes: customerNotes || undefined
        })
      });

      if (res.ok) {
        const order = await res.json();
        clearCart();
        
        if (!user) {
          localStorage.setItem('lastOrderId', order.id);
          localStorage.setItem('lastOrderTrackingToken', order.trackingToken);
        }
        localStorage.removeItem('lastOrder');

        // Generate WhatsApp Link
        const restaurantPhone = order.restaurant.whatsapp || order.restaurant.phone_number || order.restaurant.phone || order.restaurant.phone_optional;
        if (restaurantPhone) {
          const phone = normalizeWhatsAppPhone(restaurantPhone);
          if (phone) {
            trackWhatsAppClick(order.restaurant);
            const customerName = order.client?.name || order.guestName || 'Cliente';
            const itemsList = order.items.map((i: any) => `- ${i.quantity}x ${i.product.name}`).join('\n');
            const message = `Hola 👋 quiero hacer un pedido:

🍔 ${order.restaurant.restaurant_name}

🧾 Pedido:
${itemsList}

💰 Total aproximado: $${order.totalAmount.toFixed(2)}

📍 Dirección: ${order.deliveryAddress}
💳 Pago: ${paymentMethod === 'BANK_TRANSFER' ? 'Transferencia bancaria' : paymentMethod === 'PAY_AT_RESTAURANT' ? 'En restaurante' : 'Efectivo al recibir'}

Estoy pidiendo desde Yommi.
¿Me confirmas disponibilidad y tiempo?`;
            
            const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
          }
        }

        navigate(`/track/${order.id}?token=${encodeURIComponent(order.trackingToken)}`);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Error al procesar el pedido');
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pedido');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Tu carrito está vacío</h2>
        <button 
          onClick={() => navigate('/')}
          className="bg-orange-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-700 transition-colors"
        >
          Explorar Restaurantes
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Tu Pedido</h1>
        
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <ul className="space-y-6">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between items-center border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-500">
                    {item.quantity}x
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <p className="text-orange-600 font-medium">${item.price.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-lg">${(item.price * item.quantity).toFixed(2)}</span>
                  <button 
                    onClick={() => removeItem(item.productId)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          {restaurant && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3">Modalidad del pedido</h2>
              <div className="flex gap-3">
                {restaurant.has_pickup && <button type="button" onClick={() => { setFulfillmentType('PICKUP'); setPaymentMethod('PAY_AT_RESTAURANT'); }} className={`px-4 py-2 rounded-xl border ${fulfillmentType === 'PICKUP' ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-gray-200'}`}>Recoger en sucursal</button>}
                {restaurant.has_delivery && <button type="button" onClick={() => { setFulfillmentType('DELIVERY'); setPaymentMethod(restaurant.acceptsCashOnDelivery ? 'CASH_ON_DELIVERY' : 'BANK_TRANSFER'); }} className={`px-4 py-2 rounded-xl border ${fulfillmentType === 'DELIVERY' ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-gray-200'}`}>Entrega a domicilio</button>}
              </div>
            </div>
          )}
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-600" />
            {fulfillmentType === 'DELIVERY' ? 'Dirección de Entrega' : 'Recoger en sucursal'}
          </h2>
          {fulfillmentType === 'DELIVERY' ? (
            <input type="text" placeholder="Ej. Av. Principal 123, Depto 4B" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all mb-4" value={address} onChange={(e) => setAddress(e.target.value)} />
          ) : (
            <p className="text-sm text-gray-600 mb-4">{restaurant?.address || 'La dirección se confirmará con el restaurante.'}</p>
          )}
          <div className="mb-5">
            <label className="block font-bold mb-2">Instrucciones para el restaurante (opcional)</label>
            <textarea
              value={customerNotes}
              onChange={event => setCustomerNotes(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ej. sin cebolla, tocar el timbre al llegar"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <p className="text-xs text-gray-500 text-right">{customerNotes.length}/500</p>
          </div>
          <div className="mb-5">
            <h2 className="text-xl font-bold mb-3">Método de pago</h2>
            <div className="space-y-2">
              {fulfillmentType === 'PICKUP' && restaurant?.acceptsPayAtRestaurant && <label className="flex gap-3"><input type="radio" checked={paymentMethod === 'PAY_AT_RESTAURANT'} onChange={() => setPaymentMethod('PAY_AT_RESTAURANT')} /><span>Pago en restaurante</span></label>}
              {fulfillmentType === 'DELIVERY' && restaurant?.acceptsCashOnDelivery && <label className="flex gap-3"><input type="radio" checked={paymentMethod === 'CASH_ON_DELIVERY'} onChange={() => setPaymentMethod('CASH_ON_DELIVERY')} /><span>Pago en efectivo al recibir</span></label>}
              {fulfillmentType === 'DELIVERY' && restaurant?.acceptsBankTransfer && <label className="flex gap-3"><input type="radio" checked={paymentMethod === 'BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')} /><span>Transferencia bancaria anticipada</span></label>}
            </div>
            {paymentMethod === 'BANK_TRANSFER' && <div className="mt-3 bg-amber-50 border border-amber-200 p-3 rounded-xl text-sm"><p>El restaurante confirmará tu pago.</p><p className="font-medium">Yommi no procesa ni recibe este dinero.</p></div>}
          </div>
          {!user && (
            <div className="space-y-4 mt-4 border-t border-gray-100 pt-4">
              <h3 className="font-bold text-gray-700">Tus Datos (Invitado)</h3>
              <input
                type="text"
                placeholder="Nombre completo"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
              <input
                type="tel"
                placeholder="Teléfono o WhatsApp"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-1">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 sticky top-24">
          <h2 className="text-xl font-bold mb-6">Resumen</h2>
          
          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Costo de envío</span>
              <span>${deliveryFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl mb-6 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600">
              {paymentMethod === 'BANK_TRANSFER' ? 'El restaurante confirmará tu pago. Yommi no procesa ni recibe este dinero.' : paymentMethod === 'PAY_AT_RESTAURANT' ? 'Pagarás directamente en el restaurante.' : 'Pagarás en efectivo al recibir.'}
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}

          <button 
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-orange-600 text-white py-3.5 rounded-xl font-medium hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            {loading ? 'Procesando...' : 'Pedir por WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}
