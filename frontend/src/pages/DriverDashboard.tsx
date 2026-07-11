import { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { io } from 'socket.io-client';
import { MapPin, Navigation } from 'lucide-react';

export function DriverDashboard() {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [socket, setSocket] = useState<any>(null);
  const [locationInterval, setLocationInterval] = useState<any>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setOrders(data));

    const newSocket = io(import.meta.env.VITE_API_URL || '');
    setSocket(newSocket);

    return () => {
      newSocket.close();
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [token]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setOrders(orders.map((o: any) => o.id === orderId ? { ...o, status } : o));
        socket?.emit('updateOrderStatus', { orderId, status });

        if (status === 'ON_THE_WAY') {
          startLocationTracking(orderId);
        } else if (status === 'DELIVERED') {
          if (locationInterval) clearInterval(locationInterval);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const startLocationTracking = (orderId: string) => {
    if (navigator.geolocation) {
      const interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition((position) => {
          socket?.emit('updateLocation', {
            orderId,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        });
      }, 5000);
      setLocationInterval(interval);
    }
  };

  const activeOrders = orders.filter((o: any) => !['DELIVERED', 'CANCELLED'].includes(o.status));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Panel de Repartidor</h1>
        <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
          <Navigation className="w-4 h-4" />
          En línea
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center text-gray-500 border border-gray-100 shadow-sm">
            No tienes pedidos asignados actualmente.
          </div>
        ) : (
          activeOrders.map((order: any) => (
            <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                      #{order.id.substring(0, 8)}
                    </span>
                    <span className="text-sm font-medium text-orange-600">{order.status}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="mt-1"><MapPin className="w-5 h-5 text-gray-400" /></div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Recoger en</div>
                        <div className="font-medium">{order.restaurant.restaurant_name || order.restaurant.name}</div>
                        <div className="text-sm text-gray-600">{order.restaurant.address || 'Dirección no disponible'}</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="mt-1"><Navigation className="w-5 h-5 text-orange-500" /></div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Entregar a</div>
                        <div className="font-medium">{order.deliveryAddress}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">{order.client?.name || order.guestName || 'Cliente Invitado'}</span>
                          {(order.client?.phone || order.guestPhone) && (
                            <span className="ml-2 text-gray-500">• {order.client?.phone || order.guestPhone}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-end gap-3 min-w-[200px]">
                  {order.status === 'READY' && (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'ON_THE_WAY')}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      Iniciar Entrega
                    </button>
                  )}
                  {order.status === 'ON_THE_WAY' && (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                      className="w-full bg-orange-600 text-white py-3 rounded-xl font-medium hover:bg-orange-700 transition-colors shadow-sm"
                    >
                      Marcar Entregado
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
