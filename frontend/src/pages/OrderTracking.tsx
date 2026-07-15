import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store';
import { io } from 'socket.io-client';

const CANCEL_REASON_LABELS: Record<string, string> = {
  OUT_OF_STOCK: 'Uno o m?s productos se agotaron.',
  RESTAURANT_CLOSED: 'El restaurante tuvo que cerrar.',
  CUSTOMER_REQUEST: 'El cliente solicit? la cancelaci?n.',
  ADDRESS_OUT_OF_RANGE: 'La direcci?n est? fuera del ?rea de entrega.',
  DUPLICATE_ORDER: 'El pedido estaba duplicado.',
  OTHER: 'El restaurante cancel? el pedido.'
};

export function OrderTracking() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { token } = useAuthStore();
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellationMessage, setCancellationMessage] = useState<string | null>(null);

  useEffect(() => {
    const trackingToken = searchParams.get('token') || localStorage.getItem('lastOrderTrackingToken');
    const query = trackingToken ? `?token=${encodeURIComponent(trackingToken)}` : '';
    const loadOrder = async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/orders/${id}/tracking${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al consultar el pedido');
      setOrder(data);
      if (data.trackingLocations?.length > 0) {
        setDriverLocation({ lat: data.trackingLocations[0].lat, lng: data.trackingLocations[0].lng });
      }
      setError(null);
    };

    void loadOrder().catch(err => setError(err.message));
    const newSocket = io(import.meta.env.VITE_API_URL || '');
    setSocket(newSocket);
    newSocket.emit('joinOrder', id);
    newSocket.on('orderEvent', (event: { orderId: string }) => {
      if (event.orderId === id) void loadOrder().catch(err => setError(err.message));
    });
    return () => { newSocket.removeAllListeners(); newSocket.close(); };
  }, [id, searchParams, token]);

  const requestCancellation = async () => {
    try {
      const trackingToken = searchParams.get('token') || localStorage.getItem('lastOrderTrackingToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/orders/${id}/cancellation-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(token ? {} : { trackingToken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo solicitar la cancelaci?n');
      setOrder(data);
      setCancellationMessage('Solicitud enviada al restaurante.');
    } catch (requestError) {
      setCancellationMessage(requestError instanceof Error ? requestError.message : 'No se pudo solicitar la cancelaci?n');
    }
  };

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
             ['DELIVERED', 'COMPLETED'].includes(order.status) ? 'Entregado' :
             order.status === 'CUSTOMER_NO_SHOW' ? 'Cliente no se present?' :
             order.status === 'CANCELLED' ? 'Cancelado' : order.status}
          </span>
        </div>

        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
          <p className="font-bold">{order.paymentStatus === 'PAID' ? 'Pago confirmado' : order.paymentMethod === 'BANK_TRANSFER' ? 'Esperando confirmación del restaurante' : order.paymentMethod === 'PAY_AT_RESTAURANT' ? 'Pago en restaurante' : order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Pago en efectivo al recibir' : 'Pago legacy/desconocido'}</p>
          {order.paymentMethod === 'BANK_TRANSFER' && order.paymentInstructions && (
            <div className="mt-3 space-y-1">
              <p>Banco: {order.paymentInstructions.bankName}</p>
              <p>Titular: {order.paymentInstructions.bankAccountHolder}</p>
              <p>CLABE o cuenta: {order.paymentInstructions.bankAccountReference}</p>
              {order.paymentInstructions.bankTransferInstructions && <p>{order.paymentInstructions.bankTransferInstructions}</p>}
              <p>Comprobante: {order.paymentInstructions.paymentConfirmationPhone}</p>
              <p className="mt-2 font-medium">El restaurante confirmará tu pago.</p>
              <p>Yommi no procesa ni recibe este dinero.</p>
            </div>
          )}
        </div>
        {order.estimatedReadyAt && (
          <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded-xl text-sm">
            Tiempo estimado: <strong>{new Date(order.estimatedReadyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
          </div>
        )}
        {order.customerNotes && <div className="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-xl text-sm"><strong>Notas:</strong> {order.customerNotes}</div>}
        {order.status === 'CANCELLED' && <div className="mb-4 bg-red-50 border border-red-200 p-3 rounded-xl text-sm"><strong>Motivo:</strong> {CANCEL_REASON_LABELS[order.cancelReason] || 'El pedido fue cancelado.'}</div>}
        {order.status === 'CUSTOMER_NO_SHOW' && <div className="mb-4 bg-gray-100 border border-gray-200 p-3 rounded-xl text-sm">El restaurante registr? que el cliente no se present?.</div>}
        {order.status === 'PENDING' && !order.cancellationRequestedAt && (
          <button onClick={requestCancellation} className="mb-4 px-4 py-2 rounded-xl bg-red-100 text-red-700 font-medium">Solicitar cancelaci?n</button>
        )}
        {order.cancellationRequestedAt && <div className="mb-4 text-sm text-amber-800 bg-amber-50 p-3 rounded-xl">Cancelaci?n solicitada; el restaurante debe confirmarla.</div>}
        {cancellationMessage && <div className="mb-4 text-sm text-blue-800">{cancellationMessage}</div>}

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
