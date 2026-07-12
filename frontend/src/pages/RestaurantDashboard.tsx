import { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MenuManager } from '../components/MenuManager';
import { RestaurantSettings } from '../components/RestaurantSettings';

export function RestaurantDashboard() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'settings'>('orders');
  const [readiness, setReadiness] = useState<any>(null);

  useEffect(() => {
    if (!user || user.role !== 'RESTAURANT') {
      navigate('/');
      return;
    }

    let currentSocket: ReturnType<typeof io> | null = null;
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        const readinessRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/readiness`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const readinessData = await readinessRes.json();
        if (!readinessRes.ok) throw new Error(readinessData.error || 'No se pudo consultar el estado del restaurante');
        if (cancelled) return;
        setReadiness(readinessData);

        if (!readinessData.canReceiveOrders) {
          setActiveTab('settings');
          return;
        }

        const ordersRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/orders`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const ordersData = await ordersRes.json();
        if (ordersRes.ok && Array.isArray(ordersData) && !cancelled) setOrders(ordersData);

        currentSocket = io(import.meta.env.VITE_API_URL || '');
        setSocket(currentSocket);
        currentSocket.on('orderStatusUpdated', (data: { orderId: string, status: string }) => {
          setOrders(prev => prev.map(order => order.id === data.orderId ? { ...order, status: data.status } : order));
        });
        currentSocket.on('newOrder', (order: any) => {
          if (order.restaurantId === user.restaurantId || order.restaurantId === user.id) {
            setOrders(prev => [order, ...prev]);
          }
        });
      } catch (error) {
        console.error('Error loading restaurant dashboard:', error);
      }
    };

    loadDashboard();
    return () => {
      cancelled = true;
      currentSocket?.off('orderStatusUpdated');
      currentSocket?.off('newOrder');
      currentSocket?.close();
    };
  }, [token, user, navigate]);
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
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const activeOrders = orders.filter((o: any) => !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status));
  const pastOrders = orders.filter((o: any) => ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status));

  return (
    <div className="space-y-8">
      {readiness && !readiness.canReceiveOrders && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex justify-between gap-4 mb-2">
            <h2 className="font-bold">Completa tu restaurante para quedar listo</h2>
            <span className="font-bold text-amber-700">{readiness.percentage}%</span>
          </div>
          <ul className="text-sm text-amber-900 list-disc pl-5 space-y-1">
            {readiness.blockers?.map((blocker: string) => <li key={blocker}>{blocker}</li>)}
          </ul>
          <p className="text-sm mt-3">Estado: {readiness.status === 'pending_verification' ? 'Pendiente de aprobación' : readiness.status}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Panel de Restaurante</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Pedidos
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Gestionar Menú
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Configuración
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold">Pedidos Activos ({activeOrders.length})</h2>
            {activeOrders.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-gray-500 border border-gray-100 shadow-sm">
                No hay pedidos activos en este momento.
              </div>
            ) : (
              activeOrders.map((order: any) => (
                <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">Pedido #{order.id.substring(0, 8)}</h3>
                      <p className="text-sm text-gray-500">
                        {order.client?.name || order.guestName || 'Cliente Invitado'} • {new Date(order.createdAt).toLocaleTimeString()}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Dirección:</span> {order.deliveryAddress}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl">${order.totalAmount.toFixed(2)}</div>
                      <div className="text-sm font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-lg inline-block mt-1">
                        {order.status}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-xl mb-6">
                    <ul className="space-y-2">
                      {order.items.map((item: any) => (
                        <li key={item.id} className="flex justify-between text-sm">
                          <span className="font-medium">{item.quantity}x {item.product.name}</span>
                          <span className="text-gray-500">${(item.price * item.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    {order.status === 'PENDING' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'ACCEPTED')}
                        className="flex-1 bg-orange-600 text-white py-2 rounded-xl font-medium hover:bg-orange-700 transition-colors"
                      >
                        Aceptar Pedido
                      </button>
                    )}
                    {order.status === 'ACCEPTED' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                        className="flex-1 bg-amber-500 text-white py-2 rounded-xl font-medium hover:bg-amber-600 transition-colors"
                      >
                        Comenzar a Preparar
                      </button>
                    )}
                    {order.status === 'PREPARING' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'READY')}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                      >
                        Marcar Listo para Recoger
                      </button>
                    )}
                    {order.status === 'READY' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'ON_THE_WAY')}
                        className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                      >
                        En Camino
                      </button>
                    )}
                    {['ON_THE_WAY', 'IN_TRANSIT'].includes(order.status) && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                        className="flex-1 bg-orange-600 text-white py-2 rounded-xl font-medium hover:bg-orange-700 transition-colors"
                      >
                        Entregado
                      </button>
                    )}
                    {order.status === 'PENDING' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                        className="px-6 bg-red-100 text-red-700 py-2 rounded-xl font-medium hover:bg-red-200 transition-colors"
                      >
                        Rechazar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold mb-6">Historial Reciente</h2>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              {pastOrders.slice(0, 5).map((order: any) => (
                <div key={order.id} className="flex justify-between items-center border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium">#{order.id.substring(0, 8)}</div>
                    <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${order.totalAmount.toFixed(2)}</div>
                    <div className={`text-xs font-medium ${['DELIVERED', 'COMPLETED'].includes(order.status) ? 'text-green-600' : 'text-red-600'}`}>
                      {['DELIVERED', 'COMPLETED'].includes(order.status) ? 'Completado' : 'Cancelado'}
                    </div>
                  </div>
                </div>
              ))}
              {pastOrders.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">Sin historial</div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'menu' ? (
        <MenuManager />
      ) : (
        <RestaurantSettings />
      )}
    </div>
  );
}
