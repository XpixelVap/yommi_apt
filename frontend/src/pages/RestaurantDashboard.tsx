import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MenuManager } from '../components/MenuManager';
import { RestaurantSettings } from '../components/RestaurantSettings';
import {
  pendingOrderCount,
  removeAttendedHighlights,
  shouldPlayOrderAlert,
  upsertOrder
} from '../utils/order-operations';

const ESTIMATED_MINUTES = [15, 20, 30, 45, 60];
const CANCELLATION_REASONS = [
  ['OUT_OF_STOCK', 'Producto agotado'],
  ['RESTAURANT_CLOSED', 'Restaurante cerrado'],
  ['CUSTOMER_REQUEST', 'Solicitud del cliente'],
  ['ADDRESS_OUT_OF_RANGE', 'Dirección fuera de alcance'],
  ['DUPLICATE_ORDER', 'Pedido duplicado'],
  ['OTHER', 'Otro motivo']
] as const;

type ConnectionState = 'connected' | 'disconnected' | 'offline' | 'connecting';

export function RestaurantDashboard() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const restaurantId = user?.restaurantId || user?.id;
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'settings'>('orders');
  const [readiness, setReadiness] = useState<any>(null);
  const [operational, setOperational] = useState<any>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>(navigator.onLine ? 'connecting' : 'offline');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [highlightedOrders, setHighlightedOrders] = useState<Set<string>>(new Set());
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [estimatedByOrder, setEstimatedByOrder] = useState<Record<string, number>>({});
  const [cancelReasonByOrder, setCancelReasonByOrder] = useState<Record<string, string>>({});
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    if (!user || user.role !== 'RESTAURANT') {
      navigate('/');
      return;
    }

    let currentSocket: ReturnType<typeof io> | null = null;
    let cancelled = false;

    const fetchReadiness = async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/restaurant/readiness`, { headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar el estado del restaurante');
      if (!cancelled) {
        setReadiness(data);
        setOperational(data.availability);
        if (!data.canManageOrders) setActiveTab('settings');
      }
      return data;
    };

    const fetchOrders = async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/restaurant/orders`, { headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los pedidos');
      if (!cancelled && Array.isArray(data)) {
        setOrders(data);
        setHighlightedOrders(previous => removeAttendedHighlights(previous, data));
      }
    };

    const fetchOneOrder = async (orderId: string, highlight: boolean) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/restaurant/orders/${orderId}`, { headers: authHeaders });
      if (!response.ok) {
        if (response.status === 404) return;
        const data = await response.json();
        throw new Error(data.error || 'No se pudo actualizar el pedido');
      }
      const order = await response.json();
      if (cancelled) return;
      setOrders(previous => upsertOrder(previous, order));
      setHighlightedOrders(previous => {
        const next = new Set(previous);
        if (highlight && order.status === 'PENDING') next.add(order.id);
        else if (order.status !== 'PENDING') next.delete(order.id);
        return next;
      });
    };

    const connectSocket = () => {
      currentSocket = io(import.meta.env.VITE_API_URL || '');
      setConnection(navigator.onLine ? 'connecting' : 'offline');
      currentSocket.on('connect', async () => {
        setConnection('connected');
        try {
          await fetchOrders();
          setSyncMessage('Pedidos sincronizados.');
          window.setTimeout(() => setSyncMessage(null), 3000);
        } catch (error) {
          setOperationError(error instanceof Error ? error.message : 'No se pudieron sincronizar los pedidos');
        }
      });
      currentSocket.on('disconnect', () => setConnection(navigator.onLine ? 'disconnected' : 'offline'));
      currentSocket.on('connect_error', () => setConnection(navigator.onLine ? 'disconnected' : 'offline'));
      currentSocket.on('orderEvent', (event: { orderId: string; restaurantId: string; type: string }) => {
        if (event.restaurantId !== restaurantId) return;
        void fetchOneOrder(event.orderId, event.type === 'ORDER_CREATED').catch(error => {
          setOperationError(error instanceof Error ? error.message : 'No se pudo actualizar el pedido');
        });
      });
    };

    const handleOffline = () => setConnection('offline');
    const handleOnline = async () => {
      setConnection(currentSocket?.connected ? 'connected' : 'connecting');
      try {
        await fetchOrders();
        setSyncMessage('Conexión recuperada. Pedidos sincronizados.');
        window.setTimeout(() => setSyncMessage(null), 3000);
      } catch {
        setConnection('disconnected');
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    void fetchReadiness()
      .then(data => {
        if (data.canManageOrders) return fetchOrders().then(connectSocket);
      })
      .catch(error => setOperationError(error instanceof Error ? error.message : 'No se pudo cargar el panel'));

    return () => {
      cancelled = true;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      currentSocket?.removeAllListeners();
      currentSocket?.close();
    };
  }, [authHeaders, navigate, restaurantId, user]);

  const pendingCount = pendingOrderCount(orders);

  useEffect(() => {
    if (!alertsEnabled || !shouldPlayOrderAlert(orders)) return;
    const beep = async () => {
      try {
        const context = audioContextRef.current;
        if (!context) return;
        if (context.state === 'suspended') await context.resume();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.5);
        setAudioBlocked(false);
      } catch {
        setAudioBlocked(true);
        setAlertsEnabled(false);
      }
    };
    void beep();
    const interval = window.setInterval(() => void beep(), 4000);
    return () => window.clearInterval(interval);
  }, [alertsEnabled, orders]);

  const activateAlerts = async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) throw new Error('Audio unavailable');
      audioContextRef.current ||= new AudioContextClass();
      await audioContextRef.current.resume();
      setAudioBlocked(false);
      setAlertsEnabled(true);
    } catch {
      setAudioBlocked(true);
    }
  };

  const runOrderAction = async (orderId: string, action: () => Promise<Response>) => {
    if (pendingActions.has(orderId)) return;
    setPendingActions(previous => new Set(previous).add(orderId));
    try {
      const response = await action();
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el pedido');
      setOrders(previous => upsertOrder(previous, data));
      if (data.status !== 'PENDING') {
        setHighlightedOrders(previous => {
          const next = new Set(previous);
          next.delete(orderId);
          return next;
        });
      }
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'No se pudo actualizar el pedido');
    } finally {
      setPendingActions(previous => {
        const next = new Set(previous);
        next.delete(orderId);
        return next;
      });
    }
  };

  const updateOrderStatus = (orderId: string, status: string, extra: Record<string, unknown> = {}) =>
    runOrderAction(orderId, () => fetch(`${import.meta.env.VITE_API_URL || ''}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ status, ...extra })
    }));

  const runPaymentAction = (orderId: string, action: 'confirm' | 'confirm-and-deliver') =>
    runOrderAction(orderId, () => fetch(`${import.meta.env.VITE_API_URL || ''}/api/orders/${orderId}/payment/${action}`, {
      method: 'POST',
      headers: authHeaders
    }));

  const markNoShow = (orderId: string) =>
    runOrderAction(orderId, () => fetch(`${import.meta.env.VITE_API_URL || ''}/api/orders/${orderId}/no-show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({})
    }));

  const changeOperationalStatus = async (status: 'OPEN' | 'PAUSED' | 'CLOSED', manualHours?: number) => {
    try {
      const manualOpenUntil = manualHours ? new Date(Date.now() + manualHours * 60 * 60 * 1000).toISOString() : null;
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/restaurant/operational-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status, manualOpenUntil })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cambiar el estado operativo');
      setOperational(data);
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'No se pudo cambiar el estado operativo');
    }
  };

  const activeOrders = orders.filter(order => !['DELIVERED', 'COMPLETED', 'CANCELLED', 'CUSTOMER_NO_SHOW'].includes(order.status));
  const pastOrders = orders.filter(order => ['DELIVERED', 'COMPLETED', 'CANCELLED', 'CUSTOMER_NO_SHOW'].includes(order.status));
  const connectionLabel = connection === 'connected' ? 'Conectado' : connection === 'offline' ? 'Sin internet' : connection === 'connecting' ? 'Conectando' : 'Socket desconectado';

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border p-3 text-sm font-medium ${connection === 'connected' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
        Estado de conexión: {connectionLabel}
        {connection !== 'connected' && <span className="ml-2">Los pedidos pueden no actualizarse hasta recuperar conexión.</span>}
      </div>
      {syncMessage && <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl">{syncMessage}</div>}

      {readiness && !readiness.canManageOrders && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex justify-between gap-4 mb-2"><h2 className="font-bold">Completa tu restaurante para quedar listo</h2><span className="font-bold text-amber-700">{readiness.percentage}%</span></div>
          <ul className="text-sm text-amber-900 list-disc pl-5 space-y-1">{readiness.blockers?.map((blocker: string) => <li key={blocker}>{blocker}</li>)}</ul>
          <p className="text-sm mt-3">Estado: {readiness.status === 'pending_verification' ? 'Pendiente de aprobación' : readiness.status}</p>
        </div>
      )}

      {readiness?.canManageOrders && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div><h2 className="font-bold text-lg">Estado operativo</h2><p className="text-sm text-gray-600">{operational?.message || 'Consultando estado...'}</p>{operational?.manualOpenActive && <p className="text-xs text-blue-700 mt-1">Apertura manual temporal activa.</p>}</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => changeOperationalStatus('OPEN')} className="px-4 py-2 rounded-xl bg-green-600 text-white font-medium">Abrir según horario</button>
              <button onClick={() => changeOperationalStatus('OPEN', 2)} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium">Abrir manualmente 2 h</button>
              <button onClick={() => changeOperationalStatus('PAUSED')} className="px-4 py-2 rounded-xl bg-amber-500 text-white font-medium">Pausar</button>
              <button onClick={() => changeOperationalStatus('CLOSED')} className="px-4 py-2 rounded-xl bg-gray-800 text-white font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Panel de Restaurante</h1><p className="text-sm text-gray-600 mt-1">Pedidos pendientes: <strong>{pendingCount}</strong></p></div>
        <div className="flex flex-wrap gap-2">
          {!alertsEnabled && <button onClick={activateAlerts} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium">Activar alertas sonoras</button>}
          <button onClick={() => setActiveTab('orders')} disabled={!readiness?.canManageOrders} className={`px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 ${activeTab === 'orders' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Pedidos</button>
          <button onClick={() => setActiveTab('menu')} className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Gestionar Menú</button>
          <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'settings' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Configuración</button>
        </div>
      </div>

      {audioBlocked && <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl">El navegador bloqueó el sonido. Presiona “Activar alertas sonoras” nuevamente.</div>}
      {operationError && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">{operationError}</div>}

      {activeTab === 'orders' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-5">
            <h2 className="text-xl font-bold">Pedidos Activos ({activeOrders.length})</h2>
            {activeOrders.length === 0 ? <div className="bg-white p-8 rounded-2xl text-center text-gray-500 border border-gray-100">No hay pedidos activos en este momento.</div> : activeOrders.map(order => {
              const phone = order.customer?.phone;
              const phoneDigits = phone?.replace(/[^0-9]/g, '');
              const isPendingAction = pendingActions.has(order.id);
              return (
                <div key={order.id} className={`bg-white rounded-2xl p-6 shadow-sm border-2 ${highlightedOrders.has(order.id) ? 'border-red-500 bg-red-50/30' : 'border-gray-100'}`}>
                  <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-lg">Pedido #{order.id.substring(0, 8)}</h3>
                      <p className="text-sm text-gray-600">{order.customer?.name || order.guestName || 'Cliente'}</p>
                      {phone && <div className="flex gap-2 mt-2"><a href={`tel:${phone}`} className="text-sm px-3 py-1 rounded-lg bg-gray-100">Llamar</a><a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="text-sm px-3 py-1 rounded-lg bg-green-100 text-green-800">WhatsApp</a></div>}
                      {order.fulfillmentType === 'DELIVERY' && <p className="text-sm text-gray-700 mt-2"><strong>Dirección:</strong> {order.deliveryAddress}</p>}
                      {order.customerNotes && <p className="text-sm mt-2 bg-yellow-50 p-2 rounded-lg"><strong>Instrucciones:</strong> {order.customerNotes}</p>}
                    </div>
                    <div className="md:text-right"><div className="font-bold text-xl">${order.totalAmount.toFixed(2)}</div><div className="text-sm text-orange-700">{order.status}</div><div className="text-xs text-gray-600">{order.paymentMethod} · {order.paymentStatus || 'LEGACY/UNKNOWN'}</div>{order.estimatedReadyAt && <div className="text-xs mt-1">Listo estimado: {new Date(order.estimatedReadyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}</div>
                  </div>
                  {order.cancellationRequestedAt && <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-sm font-medium">El cliente solicitó cancelar este pedido.</div>}
                  <div className="bg-gray-50 p-4 rounded-xl mb-4">{order.items.map((item: any) => <div key={item.id} className="flex justify-between text-sm py-1"><span>{item.quantity}x {item.product.name}</span><span>${(item.price * item.quantity).toFixed(2)}</span></div>)}</div>
                  <div className="flex gap-2 flex-wrap">
                    {order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus === 'AWAITING_CONFIRMATION' && <button disabled={isPendingAction} onClick={() => runPaymentAction(order.id, 'confirm')} className="px-4 py-2 rounded-xl bg-green-600 text-white disabled:opacity-50">Confirmar transferencia</button>}
                    {order.status === 'PENDING' && <><select value={estimatedByOrder[order.id] || 20} onChange={event => setEstimatedByOrder(previous => ({ ...previous, [order.id]: Number(event.target.value) }))} className="border rounded-xl px-2">{ESTIMATED_MINUTES.map(minutes => <option key={minutes} value={minutes}>{minutes} min</option>)}</select><button disabled={isPendingAction} onClick={() => updateOrderStatus(order.id, 'ACCEPTED', { estimatedMinutes: estimatedByOrder[order.id] || 20 })} className="px-4 py-2 rounded-xl bg-orange-600 text-white disabled:opacity-50">Aceptar pedido</button></>}
                    {order.status === 'ACCEPTED' && <button disabled={isPendingAction} onClick={() => updateOrderStatus(order.id, 'PREPARING')} className="px-4 py-2 rounded-xl bg-amber-500 text-white">Comenzar a preparar</button>}
                    {order.status === 'PREPARING' && <button disabled={isPendingAction} onClick={() => updateOrderStatus(order.id, 'READY')} className="px-4 py-2 rounded-xl bg-blue-600 text-white">Marcar listo</button>}
                    {order.status === 'READY' && order.fulfillmentType === 'PICKUP' && <><button disabled={isPendingAction} onClick={() => order.paymentStatus === 'PAID' ? updateOrderStatus(order.id, 'DELIVERED') : runPaymentAction(order.id, 'confirm-and-deliver')} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">{order.paymentStatus === 'PAID' ? 'Entregar pedido' : 'Cobrar y entregar'}</button><button disabled={isPendingAction} onClick={() => markNoShow(order.id)} className="px-4 py-2 rounded-xl bg-gray-700 text-white">Cliente no llegó</button></>}
                    {order.status === 'READY' && order.fulfillmentType === 'DELIVERY' && <button disabled={isPendingAction} onClick={() => updateOrderStatus(order.id, 'ON_THE_WAY')} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">En camino</button>}
                    {['ON_THE_WAY', 'IN_TRANSIT'].includes(order.status) && <button disabled={isPendingAction} onClick={() => order.paymentStatus === 'PAID' ? updateOrderStatus(order.id, 'DELIVERED') : runPaymentAction(order.id, 'confirm-and-deliver')} className="px-4 py-2 rounded-xl bg-orange-600 text-white">{order.paymentStatus === 'PAID' ? 'Entregado' : 'Cobrar y entregar'}</button>}
                    {order.paymentStatus !== 'PAID' && !['DELIVERED', 'CUSTOMER_NO_SHOW'].includes(order.status) && <><select value={cancelReasonByOrder[order.id] || 'OUT_OF_STOCK'} onChange={event => setCancelReasonByOrder(previous => ({ ...previous, [order.id]: event.target.value }))} className="border rounded-xl px-2">{CANCELLATION_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button disabled={isPendingAction} onClick={() => updateOrderStatus(order.id, 'CANCELLED', { cancelReason: cancelReasonByOrder[order.id] || 'OUT_OF_STOCK' })} className="px-4 py-2 rounded-xl bg-red-100 text-red-700">Cancelar</button></>}
                  </div>
                </div>
              );
            })}
          </div>
          <div><h2 className="text-xl font-bold mb-6">Historial Reciente</h2><div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">{pastOrders.slice(0, 10).map(order => <div key={order.id} className="border-b border-gray-100 pb-3 last:border-0"><div className="flex justify-between"><span className="font-medium">#{order.id.substring(0, 8)}</span><span>${order.totalAmount.toFixed(2)}</span></div><div className="text-xs text-gray-600">{order.status === 'CUSTOMER_NO_SHOW' ? 'Cliente no se presentó' : order.status === 'CANCELLED' ? 'Cancelado' : 'Entregado'}</div>{order.cancelReason && <div className="text-xs text-red-700 mt-1">Motivo: {order.cancelReason}</div>}</div>)}{pastOrders.length === 0 && <div className="text-sm text-gray-500 text-center">Sin historial</div>}</div></div>
        </div>
      ) : activeTab === 'menu' ? <MenuManager /> : <RestaurantSettings />}
    </div>
  );
}