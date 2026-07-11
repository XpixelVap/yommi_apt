import { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle, Truck, MapPin } from 'lucide-react';

export function ClientDashboard() {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setOrders(data));
  }, [token]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'PREPARING': return 'bg-orange-100 text-orange-800';
      case 'READY': return 'bg-blue-100 text-blue-800';
      case 'ON_THE_WAY': return 'bg-purple-100 text-purple-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'PREPARING': return 'En preparación';
      case 'READY': return 'Listo para recoger';
      case 'ON_THE_WAY': return 'En camino';
      case 'DELIVERED': return 'Entregado';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Mis Pedidos</h1>
      
      {orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">Aún no tienes pedidos</h3>
          <p className="text-gray-500 mb-6">Explora los restaurantes y haz tu primer pedido.</p>
          <Link to="/" className="bg-orange-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-700 transition-colors inline-block">
            Explorar Restaurantes
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {orders.map((order: any) => (
            <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-lg">{order.restaurant.restaurant_name || order.restaurant.name}</h3>
                  <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                  <span className="font-bold text-lg">${order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="border-t border-gray-100 pt-4 mb-4">
                <ul className="space-y-2">
                  {order.items.map((item: any) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600"><span className="font-medium text-gray-900">{item.quantity}x</span> {item.product.name}</span>
                      <span className="text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-4">
                <Link 
                  to={`/track/${order.id}`}
                  className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Seguir Pedido
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
