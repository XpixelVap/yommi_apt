import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/orders/${id}/tracking`)
      .then(async res => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Error fetching order');
        }
        return res.json();
      })
      .then(data => {
        setOrder(data);
        if (data.trackingLocations?.length > 0) {
          setDriverLocation({
            lat: data.trackingLocations[0].lat,
            lng: data.trackingLocations[0].lng
          });
        }
      })
      .catch(err => {
        setError(err.message);
      });

    const newSocket = io(import.meta.env.VITE_API_URL || '');
    setSocket(newSocket);

    newSocket.emit('joinOrder', id);

    newSocket.on('locationUpdated', (data) => {
      setDriverLocation({ lat: data.lat, lng: data.lng });
    });

    newSocket.on('orderStatusUpdated', (data) => {
      setOrder((prev: any) => ({ ...prev, status: data.status }));
    });

    return () => { newSocket.close(); };
  }, [id]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-12 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100">
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            {error === 'Pedido no encontrado' ? 'Pedido no encontrado' : 'Error'}
          </h2>
          {error !== 'Pedido no encontrado' && <p className="text-gray-600">{error}</p>}
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-12">Cargando seguimiento...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold mb-2">Seguimiento de Pedido</h1>
        <div className="flex items-center justify-between mb-6">
          <span className="text-gray-500">#{order.id.substring(0, 8)}</span>
          <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
            {order.status === 'PENDING' ? 'Recibido' :
             order.status === 'ACCEPTED' ? 'Aceptado' :
             order.status === 'PREPARING' ? 'Preparando' :
             ['ON_THE_WAY', 'IN_TRANSIT'].includes(order.status) ? 'En camino' :
             ['DELIVERED', 'COMPLETED'].includes(order.status) ? 'Entregado' : order.status}
          </span>
        </div>

        {/* Status Timeline */}
        <div className="relative mb-12 mt-8">
          {/* Background line */}
          <div className="absolute top-3 left-0 w-full h-1 bg-gray-200 z-0 rounded-full"></div>

          {/* Progress line */}
          <div
            className="absolute top-3 left-0 h-1 bg-orange-500 z-0 rounded-full transition-all duration-500 ease-in-out"
            style={{
              width: `${(() => {
                const steps = [
                  { matches: ['PENDING', 'ACCEPTED'] },
                  { matches: ['PREPARING', 'READY'] },
                  { matches: ['ON_THE_WAY', 'IN_TRANSIT'] },
                  { matches: ['DELIVERED', 'COMPLETED'] }
                ];
                const currentIndex = steps.findIndex(s => s.matches.includes(order.status));
                return currentIndex >= 0 ? (currentIndex / (steps.length - 1)) * 100 : 0;
              })()}%`
            }}
          ></div>

          <div className="relative z-10 flex justify-between">
            {[
              { key: "received", label: "Pedido recibido", matches: ['PENDING', 'ACCEPTED'] },
              { key: "preparing", label: "En preparación", matches: ['PREPARING', 'READY'] },
              { key: "on_the_way", label: "En camino", matches: ['ON_THE_WAY', 'IN_TRANSIT'] },
              { key: "delivered", label: "Entregado", matches: ['DELIVERED', 'COMPLETED'] }
            ].map((step, index) => {
              const currentIndex = [
                ['PENDING', 'ACCEPTED'],
                ['PREPARING', 'READY'],
                ['ON_THE_WAY', 'IN_TRANSIT'],
                ['DELIVERED', 'COMPLETED']
              ].findIndex(matches => matches.includes(order.status));

              const isActive = index === currentIndex;
              const isCompleted = index < currentIndex;
              const isFuture = index > currentIndex;

              return (
                <div key={step.key} className="flex flex-col items-center gap-2 w-1/4">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm
                      ${isCompleted ? 'bg-orange-500 text-white' :
                        isActive ? 'bg-white border-4 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]' :
                        'bg-white border-2 border-gray-200'}`}
                  >
                    {isCompleted && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isActive && <div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>}
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-medium text-center transition-colors duration-300
                      ${isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-8 border-t border-gray-100 pt-6">
          <h3 className="text-lg font-bold mb-4">Detalle del Pedido</h3>
          <div className="space-y-3">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{item.quantity}x</span>
                  <span className="text-gray-600">{item.product?.name || 'Producto'}</span>
                </div>
                <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-xl text-orange-600">${order.totalAmount?.toFixed(2)}</span>
          </div>
        </div>

        {/* Map */}
        <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-inner border border-gray-200">
            <div className="h-[400px] flex items-center justify-center text-gray-500 flex-col gap-4">
              <p>Mapa de seguimiento (Integración de Mapbox pendiente)</p>
              {driverLocation && (
                <div className="text-sm bg-white p-4 rounded-xl shadow-sm">
                  <p className="font-bold text-gray-900 mb-1">Ubicación del repartidor:</p>
                  <p>Lat: {driverLocation.lat.toFixed(4)}</p>
                  <p>Lng: {driverLocation.lng.toFixed(4)}</p>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
