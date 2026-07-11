import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useCartStore } from '../store';
import { ShoppingBag, ArrowLeft, Store, MessageCircle } from 'lucide-react';

export function LastOrder() {
  const { user, token } = useAuthStore();
  const { addItem, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const localOrderStr = localStorage.getItem('lastOrder');
    if (localOrderStr) {
      try {
        const localOrder = JSON.parse(localOrderStr);
        setOrder({
          isLocal: true,
          restaurant: { name: localOrder.restaurantName },
          restaurantId: localOrder.restaurantId,
          items: localOrder.items,
          totalAmount: localOrder.items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0),
          createdAt: new Date().toISOString() // We don't have the exact date for local orders
        });
        setLoading(false);
        return;
      } catch (e) {
        console.error('Error parsing local order', e);
      }
    }

    if (!user || !token) {
      setLoading(false);
      return;
    }

    fetch(`${import.meta.env.VITE_API_URL || ""}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setOrder(data[0]); // The first order is the most recent because of orderBy createdAt desc
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching last order:', err);
        setLoading(false);
      });
  }, [user, token]);

  const handleRepeatOrder = () => {
    if (!order || !order.items) return;

    // Clear current cart
    clearCart();

    // Add all items from the last order
    order.items.forEach((item: any) => {
      addItem({
        productId: item.productId || item.id,
        name: item.product?.name || item.name || 'Producto no disponible',
        price: item.price,
        quantity: item.quantity,
        restaurantId: order.restaurantId
      });
    });

    // Navigate to cart
    navigate('/cart');
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Cargando tu último pedido...</div>;
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aún no tienes pedidos</h2>
          <p className="text-gray-500 mb-6">Cuando realices tu primer pedido, aparecerá aquí para que puedas repetirlo fácilmente.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#FF6B00] text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors"
          >
            Explorar restaurantes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Volver
      </button>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Mi Último Pedido</h1>
            {!order.isLocal && (
              <p className="text-gray-500">
                {new Date(order.createdAt).toLocaleDateString('es-MX', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>
          <div className="bg-orange-50 text-[#FF6B00] p-3 rounded-2xl">
            <ShoppingBag className="w-8 h-8" />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Store className="w-5 h-5 text-gray-400" />
            {order.restaurant?.name || 'Restaurante'}
          </h2>

          <div className="space-y-4">
            {order.items.map((item: any, index: number) => (
              <div key={item.id || index} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="bg-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-[#FF6B00] shadow-sm">
                    {item.quantity}x
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{item.product?.name || item.name || 'Producto'}</h3>
                    <p className="text-sm text-gray-500">${item.price.toFixed(2)} c/u</p>
                  </div>
                </div>
                <div className="font-bold text-gray-900">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 mb-8">
          <div className="flex justify-between items-center text-2xl font-bold text-gray-900 pt-4 border-t border-gray-100">
            <span>Total</span>
            <span>${order.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleRepeatOrder}
          className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <MessageCircle className="w-6 h-6" />
          Repetir pedido
        </button>
      </div>
    </div>
  );
}
