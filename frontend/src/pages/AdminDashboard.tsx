import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Navigate } from 'react-router-dom';
import { RestaurantExtractor } from '../components/RestaurantExtractor';
import { MenuManager } from '../components/MenuManager';
import { RestaurantSettings } from '../components/RestaurantSettings';
import { clearCache } from '../utils/cache';
import { 
  LayoutDashboard, 
  Store, 
  BookOpen, 
  ShoppingBag, 
  Users, 
  Mail, 
  ShieldCheck, 
  Car, 
  Settings,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  TrendingUp,
  Bot
} from 'lucide-react';

export function AdminDashboard() {
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [managingRestaurantId, setManagingRestaurantId] = useState<string | null>(null);
  const [managingRestaurantTab, setManagingRestaurantTab] = useState<'profile' | 'menu'>('profile');

  // Modal state
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<any>(null);
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    owner_name: '',
    phone: '',
    city: '',
    category: '',
    status: 'ACTIVE'
  });

  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [editingDirectory, setEditingDirectory] = useState<any>(null);
  const [directoryForm, setDirectoryForm] = useState({
    name: '',
    city: '',
    address: '',
    cuisine_type: '',
    phone: '',
    whatsapp: '',
    instagram: '',
    status: 'UNCLAIMED'
  });

  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [bannerForm, setBannerForm] = useState({
    title: '',
    subtitle: '',
    image: '',
    buttonText: '',
    link: '',
    city: '',
    order: 0,
    active: true
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/login" />;
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      setStats(json);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async (endpoint: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchStats();
    } else {
      fetchData(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'restaurants' && !managingRestaurantId) {
      fetchData('restaurants');
    }
  }, [managingRestaurantId]);

  const handleStatusChange = async (endpoint: string, id: string, status: string | boolean, field: string = 'status') => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/${endpoint}/${id}/${field}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ [field]: status })
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Error al actualizar el estado');
      }
      clearCache('restaurants_');
      clearCache('popular_');
      fetchData(activeTab);
    } catch (e) {
      console.error(e);
      setErrorMsg('Error de conexión');
    }
  };

  const handleApproveRestaurant = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      message: '¿Estás seguro de que deseas aprobar este restaurante?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/restaurants/${id}/approve`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) {
            const data = await res.json();
            setErrorMsg(data.error || 'Error al aprobar el restaurante');
          }
          fetchData(activeTab);
        } catch (e) {
          console.error(e);
          setErrorMsg('Error de conexión');
        }
      }
    });
  };

  const handleRejectRestaurant = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      message: '¿Estás seguro de que deseas rechazar este restaurante?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/restaurants/${id}/reject`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) {
            const data = await res.json();
            setErrorMsg(data.error || 'Error al rechazar el restaurante');
          }
          fetchData(activeTab);
        } catch (e) {
          console.error(e);
          setErrorMsg('Error de conexión');
        }
      }
    });
  };

  const handleDelete = (endpoint: string, id: string) => {
    setConfirmDialog({
      isOpen: true,
      message: '¿Estás seguro de que deseas eliminar este elemento?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) {
            const data = await res.json();
            setErrorMsg(data.error || 'Error al eliminar el elemento');
          }
          clearCache('restaurants_');
          clearCache('popular_');
          fetchData(activeTab);
        } catch (e) {
          console.error(e);
          setErrorMsg('Error de conexión');
        }
      }
    });
  };

  const handleRestaurantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRestaurant 
        ? `${import.meta.env.VITE_API_URL || ""}/api/admin/restaurants/${editingRestaurant.id}`
        : `${import.meta.env.VITE_API_URL || ""}/api/admin/restaurants`;
      
      const method = editingRestaurant ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(restaurantForm)
      });

      setShowRestaurantModal(false);
      setEditingRestaurant(null);
      setRestaurantForm({
        name: '',
        owner_name: '',
        phone: '',
        city: '',
        category: '',
        status: 'ACTIVE'
      });
      clearCache('restaurants_');
      clearCache('popular_');
      fetchData('restaurants');
    } catch (e) {
      console.error(e);
    }
  };

  const openEditRestaurant = (r: any) => {
    setEditingRestaurant(r);
    setRestaurantForm({
      name: r.restaurant_name || r.name || '',
      owner_name: r.owner_name || '',
      phone: r.phone_number || r.phone || '',
      city: r.city || r.address || '',
      category: r.description || '',
      status: r.isActive ? 'ACTIVE' : 'SUSPENDED'
    });
    setShowRestaurantModal(true);
  };

  const handleDirectorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingDirectory 
        ? `${import.meta.env.VITE_API_URL || ""}/api/admin/directory/${editingDirectory.id}`
        : `${import.meta.env.VITE_API_URL || ""}/api/admin/directory`;
      
      const method = editingDirectory ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...directoryForm,
          phone_optional: directoryForm.whatsapp // Map whatsapp to phone_optional
        })
      });

      setShowDirectoryModal(false);
      setEditingDirectory(null);
      setDirectoryForm({
        name: '',
        city: '',
        address: '',
        cuisine_type: '',
        phone: '',
        whatsapp: '',
        instagram: '',
        status: 'UNCLAIMED'
      });
      fetchData('directory');
    } catch (e) {
      console.error(e);
    }
  };

  const openEditDirectory = (d: any) => {
    setEditingDirectory(d);
    setDirectoryForm({
      name: d.name || '',
      city: d.city || '',
      address: d.address || '',
      cuisine_type: d.cuisine_type || '',
      phone: d.phone || '',
      whatsapp: d.phone_optional || '',
      instagram: d.instagram || '',
      status: d.status || 'UNCLAIMED'
    });
    setShowDirectoryModal(true);
  };

  const handleBannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingBanner 
        ? `${import.meta.env.VITE_API_URL || ""}/api/admin/banners/${editingBanner.id}`
        : `${import.meta.env.VITE_API_URL || ""}/api/admin/banners`;
      
      const method = editingBanner ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(bannerForm)
      });

      setShowBannerModal(false);
      setEditingBanner(null);
      setBannerForm({
        title: '',
        subtitle: '',
        image: '',
        buttonText: '',
        link: '',
        city: '',
        order: 0,
        active: true
      });
      fetchData('banners');
    } catch (e) {
      console.error(e);
    }
  };

  const openEditBanner = (b: any) => {
    setEditingBanner(b);
    setBannerForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      image: b.image || '',
      buttonText: b.buttonText || '',
      link: b.link || '',
      city: b.city || '',
      order: b.order || 0,
      active: b.active !== undefined ? b.active : true
    });
    setShowBannerModal(true);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'restaurants', label: 'Restaurantes', icon: Store },
    { id: 'directory', label: 'Directorio', icon: BookOpen },
    { id: 'extractor', label: 'Extractor IA', icon: Bot },
    { id: 'orders', label: 'Órdenes', icon: ShoppingBag },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'invitations', label: 'Invitaciones', icon: Mail },
    { id: 'demand', label: 'Demanda', icon: TrendingUp },
    { id: 'claims', label: 'Reclamos', icon: ShieldCheck },
    { id: 'drivers', label: 'Conductores', icon: Car },
    { id: 'banners', label: 'Publicidad / Banners', icon: Settings },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] bg-gray-50 border-t border-gray-200">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4 space-y-2">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-3">Panel de Administración</h2>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'bg-orange-50 text-orange-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-auto">
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Resumen del Dashboard</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total de Restaurantes" value={stats.totalRestaurants} />
              <StatCard title="Registrados" value={stats.registeredRestaurants} />
              <StatCard title="Reclamos Pendientes" value={stats.pendingClaims} />
              <StatCard title="Órdenes de Hoy" value={stats.totalOrdersToday} />
              <StatCard title="Total de Usuarios" value={stats.totalUsers} />
            </div>

            <h2 className="text-xl font-bold mt-8 mb-4">Restaurantes Más Solicitados</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium text-gray-500">Restaurante</th>
                    <th className="px-6 py-3 font-medium text-gray-500">Ciudad</th>
                    <th className="px-6 py-3 font-medium text-gray-500">Solicitudes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.mostRequested.map((req: any) => (
                    <tr key={req.id}>
                      <td className="px-6 py-4">{req.restaurant_name}</td>
                      <td className="px-6 py-4">{req.city}</td>
                      <td className="px-6 py-4 font-bold text-orange-600">{req.request_count}</td>
                    </tr>
                  ))}
                  {stats.mostRequested.length === 0 && (
                    <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">No hay solicitudes aún</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'restaurants' && !managingRestaurantId && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Restaurantes Registrados</h1>
              <button 
                onClick={() => {
                  setEditingRestaurant(null);
                  setRestaurantForm({
                    name: '',
                    owner_name: '',
                    phone: '',
                    city: '',
                    category: '',
                    status: 'ACTIVE'
                  });
                  setShowRestaurantModal(true);
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700"
              >
                Crear Restaurante
              </button>
            </div>
            <Table 
              columns={['Nombre', 'Dueño', 'Teléfono', 'Estado', 'Verificación', 'Acciones']}
              data={Array.isArray(data) ? data.map(r => [
                r.restaurant_name || r.name,
                r.owner_name || 'Desconocido',
                r.phone_number || r.phone || '-',
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.isActive ? 'ACTIVO' : 'SUSPENDIDO'}
                </span>,
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  r.status === 'verified' ? 'bg-green-100 text-green-700' : 
                  r.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {r.status === 'verified' ? 'VERIFICADO' : r.status === 'rejected' ? 'RECHAZADO' : 'PENDIENTE'}
                </span>,
                <div className="flex gap-2 items-center">
                  {r.status === 'pending_verification' && (
                    <>
                      <button onClick={() => handleApproveRestaurant(r.id)} className="text-green-600 hover:text-green-800" title="Aprobar"><CheckCircle className="w-4 h-4" /></button>
                      <button onClick={() => handleRejectRestaurant(r.id)} className="text-red-600 hover:text-red-800" title="Rechazar"><XCircle className="w-4 h-4" /></button>
                    </>
                  )}
                  <button onClick={() => openEditRestaurant(r)} className="text-blue-500 hover:text-blue-700" title="Editar"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setManagingRestaurantId(r.id)} className="text-purple-500 hover:text-purple-700" title="Gestionar Perfil y Menú"><Settings className="w-4 h-4" /></button>
                  <button 
                    onClick={() => handleStatusChange('restaurants', r.id, !r.isActive, 'isActive')} 
                    className={`${r.isActive ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'}`}
                    title={r.isActive ? 'Suspender' : 'Activar'}
                  >
                    {r.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDelete('restaurants', r.id)} className="text-red-500 hover:text-red-700" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                </div>
              ]) : []}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'restaurants' && managingRestaurantId && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Gestionar Restaurante</h1>
              <button 
                onClick={() => setManagingRestaurantId(null)}
                className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-200"
              >
                Volver a la lista
              </button>
            </div>
            
            <div className="flex gap-2 border-b border-gray-200 pb-4">
              <button 
                onClick={() => setManagingRestaurantTab('profile')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${managingRestaurantTab === 'profile' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Perfil y Portada
              </button>
              <button 
                onClick={() => setManagingRestaurantTab('menu')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${managingRestaurantTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Productos y Menú
              </button>
            </div>

            {managingRestaurantTab === 'profile' ? (
              <RestaurantSettings restaurantId={managingRestaurantId} />
            ) : (
              <MenuManager restaurantId={managingRestaurantId} />
            )}
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Directorio de Restaurantes</h1>
              <button 
                onClick={() => {
                  setEditingDirectory(null);
                  setDirectoryForm({
                    name: '',
                    city: '',
                    address: '',
                    cuisine_type: '',
                    phone: '',
                    whatsapp: '',
                    instagram: '',
                    status: 'UNCLAIMED'
                  });
                  setShowDirectoryModal(true);
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700"
              >
                Agregar al Directorio
              </button>
            </div>
            <Table 
              columns={['Nombre', 'Ciudad', 'Categoría', 'Teléfono', 'WhatsApp', 'Estado', 'Acciones']}
              data={Array.isArray(data) ? data.map(d => [
                d.name,
                d.city,
                d.cuisine_type,
                d.phone || '-',
                d.phone_optional || '-',
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  d.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                  d.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 
                  'bg-gray-100 text-gray-700'
                }`}>
                  {d.status || 'UNCLAIMED'}
                </span>,
                <div className="flex gap-2">
                  <button onClick={() => openEditDirectory(d)} className="text-blue-500 hover:text-blue-700" title="Editar"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete('directory', d.id)} className="text-red-500 hover:text-red-700" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                </div>
              ]) : []}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'extractor' && (
          <div className="space-y-6">
            <RestaurantExtractor 
              onAddToDirectory={(data) => {
                setEditingDirectory(null);
                setDirectoryForm({
                  name: data.nombre || '',
                  city: data.ciudad || '',
                  address: data.direccion || '',
                  cuisine_type: data.categoria || '',
                  phone: data.telefono || '',
                  whatsapp: data.boton_invitar?.tipo === 'whatsapp' ? data.telefono : '',
                  instagram: data.boton_invitar?.tipo === 'instagram' ? data.telefono : '',
                  status: 'UNCLAIMED'
                });
                setShowDirectoryModal(true);
              }}
            />
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Órdenes</h1>
            <Table 
              columns={['ID', 'Restaurante', 'Cliente', 'Total', 'Estado', 'Fecha']}
              data={Array.isArray(data) ? data.map(o => [
                o.id?.slice(0, 8) || '-',
                o.restaurant?.name || 'Desconocido',
                o.client?.name || o.guestName || 'Invitado',
                `$${Number(o.totalAmount || 0).toFixed(2)}`,
                <select 
                  value={o.status}
                  onChange={(e) => handleStatusChange('orders', o.id, e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm"
                >
                  <option value="PENDING">PENDIENTE</option>
                  <option value="PREPARING">PREPARANDO</option>
                  <option value="READY">LISTO</option>
                  <option value="ON_THE_WAY">EN CAMINO</option>
                  <option value="DELIVERED">ENTREGADO</option>
                  <option value="CANCELLED">CANCELADO</option>
                </select>,
                o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '-'
              ]) : []}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Usuarios</h1>
            <Table 
              columns={['Nombre', 'Email', 'Rol', 'Estado', 'Acciones']}
              data={Array.isArray(data) ? data.map(u => [
                u.name,
                u.email,
                <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold">{u.role}</span>,
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.isSuspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {u.isSuspended ? 'SUSPENDIDO' : 'ACTIVO'}
                </span>,
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleStatusChange('users', u.id, !u.isSuspended, 'suspend')}
                    className={`text-sm font-medium ${u.isSuspended ? 'text-green-600' : 'text-orange-600'}`}
                  >
                    {u.isSuspended ? 'Reactivar' : 'Suspender'}
                  </button>
                  <button 
                    onClick={() => handleDelete('users', u.id)} 
                    className="text-red-500 hover:text-red-700" 
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ]) : []}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'invitations' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Invitaciones de Restaurantes</h1>
            <Table 
              columns={['Restaurante', 'Ciudad', 'Teléfono', 'Instagram', 'Solicitudes', 'Última Solicitud']}
              data={Array.isArray(data) ? data.map(i => [
                i.restaurant_name,
                i.city,
                i.phone || '-',
                i.instagram || '-',
                <span className="font-bold text-orange-600">{i.request_count}</span>,
                new Date(i.updated_at).toLocaleDateString()
              ]) : []}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'demand' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Demanda de Restaurantes</h1>
            <p className="text-gray-600">Restaurantes más solicitados por los clientes.</p>
            <Table 
              columns={['Restaurante', 'Ciudad', 'Solicitudes', 'Primera Solicitud']}
              data={Array.isArray(data) ? data.map(d => [
                d.restaurant_name,
                d.city,
                <span className="font-bold text-orange-600">{d.request_count}</span>,
                new Date(d.created_at).toLocaleDateString()
              ]) : []}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'claims' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Reclamos de Restaurantes</h1>
            <Table 
              columns={['Restaurante (Directorio)', 'Restaurante (Reclamado)', 'Dueño', 'Contacto', 'Mensaje', 'Estado', 'Acciones']}
              data={Array.isArray(data) ? data.map(c => [
                c.restaurantDirectory?.name,
                c.restaurant_name,
                c.name,
                <div>
                  <p>{c.phone}</p>
                  <p className="text-gray-500 text-xs">{c.email}</p>
                </div>,
                <p className="max-w-xs truncate" title={c.verification_message}>{c.verification_message || '-'}</p>,
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  c.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                  c.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {c.status === 'APPROVED' ? 'APROBADO' : c.status === 'REJECTED' ? 'RECHAZADO' : 'PENDIENTE'}
                </span>,
                <div className="flex gap-2">
                  {c.status === 'PENDING' && (
                    <>
                      <button onClick={() => handleStatusChange('claims', c.id, 'APPROVED')} className="text-green-600 hover:text-green-800"><CheckCircle className="w-5 h-5" /></button>
                      <button onClick={() => handleStatusChange('claims', c.id, 'REJECTED')} className="text-red-600 hover:text-red-800"><XCircle className="w-5 h-5" /></button>
                    </>
                  )}
                </div>
              ]) : []}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Conductores</h1>
            <Table 
              columns={['Nombre', 'Vehículo', 'Placa', 'Estado', 'Acciones']}
              data={Array.isArray(data) ? data.map(d => [
                d.user?.name,
                d.vehicle || '-',
                d.plate || '-',
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${d.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {d.isOnline ? 'EN LÍNEA' : 'DESCONECTADO'}
                </span>,
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleStatusChange('users', d.userId, !d.user?.isSuspended, 'suspend')}
                    className={`text-sm font-medium ${d.user?.isSuspended ? 'text-green-600' : 'text-orange-600'}`}
                  >
                    {d.user?.isSuspended ? 'Reactivar' : 'Suspender'}
                  </button>
                  <button 
                    onClick={() => handleDelete('users', d.userId)} 
                    className="text-red-500 hover:text-red-700" 
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ]) : []}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'banners' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Publicidad / Banners</h1>
              <button 
                onClick={() => {
                  setEditingBanner(null);
                  setBannerForm({
                    title: '',
                    subtitle: '',
                    image: '',
                    buttonText: '',
                    link: '',
                    city: '',
                    order: 0,
                    active: true
                  });
                  setShowBannerModal(true);
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 transition-colors"
              >
                + Nuevo Banner
              </button>
            </div>
            <Table 
              columns={['Imagen', 'Título', 'Ciudad', 'Orden', 'Estado', 'Acciones']}
              data={Array.isArray(data) ? data.map(b => [
                <img src={b.image} alt={b.title} className="w-16 h-10 object-cover rounded" />,
                <div>
                  <p className="font-bold">{b.title}</p>
                  <p className="text-xs text-gray-500">{b.subtitle}</p>
                </div>,
                b.city || 'Todas',
                b.order,
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {b.active ? 'ACTIVO' : 'INACTIVO'}
                </span>,
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleStatusChange('banners', b.id, !b.active, 'active')}
                    className={`text-sm font-medium ${b.active ? 'text-orange-600' : 'text-green-600'}`}
                  >
                    {b.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => openEditBanner(b)} className="text-blue-500 hover:text-blue-700" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete('banners', b.id)} className="text-red-500 hover:text-red-700" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ]) : []}
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* Restaurant Modal */}
      {showRestaurantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingRestaurant ? 'Editar Restaurante' : 'Crear Restaurante'}
            </h2>
            <form onSubmit={handleRestaurantSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Restaurante</label>
                <input 
                  type="text" 
                  required
                  value={restaurantForm.name}
                  onChange={e => setRestaurantForm({...restaurantForm, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Dueño</label>
                <input 
                  type="text" 
                  required
                  value={restaurantForm.owner_name}
                  onChange={e => setRestaurantForm({...restaurantForm, owner_name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input 
                  type="tel" 
                  value={restaurantForm.phone}
                  onChange={e => setRestaurantForm({...restaurantForm, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <input 
                  type="text" 
                  value={restaurantForm.city}
                  onChange={e => setRestaurantForm({...restaurantForm, city: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría / Cocina</label>
                <input 
                  type="text" 
                  value={restaurantForm.category}
                  onChange={e => setRestaurantForm({...restaurantForm, category: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select 
                  value={restaurantForm.status}
                  onChange={e => setRestaurantForm({...restaurantForm, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="ACTIVE">ACTIVO</option>
                  <option value="SUSPENDED">SUSPENDIDO</option>
                </select>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowRestaurantModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Directory Modal */}
      {showDirectoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingDirectory ? 'Editar Directorio' : 'Agregar al Directorio'}
            </h2>
            <form onSubmit={handleDirectorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                  type="text" 
                  required
                  value={directoryForm.name}
                  onChange={e => setDirectoryForm({...directoryForm, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <input 
                  type="text" 
                  required
                  value={directoryForm.city}
                  onChange={e => setDirectoryForm({...directoryForm, city: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección (Opcional)</label>
                <input 
                  type="text" 
                  value={directoryForm.address}
                  onChange={e => setDirectoryForm({...directoryForm, address: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría / Cocina</label>
                <input 
                  type="text" 
                  required
                  value={directoryForm.cuisine_type}
                  onChange={e => setDirectoryForm({...directoryForm, cuisine_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input 
                  type="tel" 
                  value={directoryForm.phone}
                  onChange={e => setDirectoryForm({...directoryForm, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input 
                  type="tel" 
                  value={directoryForm.whatsapp}
                  onChange={e => setDirectoryForm({...directoryForm, whatsapp: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram (Opcional)</label>
                <input 
                  type="text" 
                  value={directoryForm.instagram}
                  onChange={e => setDirectoryForm({...directoryForm, instagram: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select 
                  value={directoryForm.status}
                  onChange={e => setDirectoryForm({...directoryForm, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="UNCLAIMED">NO RECLAMADO</option>
                  <option value="ACTIVE">ACTIVO</option>
                  <option value="SUSPENDED">SUSPENDIDO</option>
                </select>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowDirectoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Banner Modal */}
      {showBannerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingBanner ? 'Editar Banner' : 'Crear Banner'}
            </h2>
            <form onSubmit={handleBannerSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input 
                  type="text" 
                  value={bannerForm.title}
                  onChange={e => setBannerForm({...bannerForm, title: e.target.value})}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo (Opcional)</label>
                <input 
                  type="text" 
                  value={bannerForm.subtitle}
                  onChange={e => setBannerForm({...bannerForm, subtitle: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Banner</label>
                <div className="flex items-center gap-4">
                  {bannerForm.image && (
                    <img src={bannerForm.image} alt="Preview" className="h-16 w-16 object-cover rounded-lg" />
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const formData = new FormData();
                        formData.append('image', e.target.files[0]);
                        try {
                          const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/upload/banner`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                            body: formData
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setBannerForm({...bannerForm, image: data.imageUrl});
                          } else {
                            setErrorMsg('Error al subir la imagen');
                          }
                        } catch (error) {
                          console.error(error);
                          setErrorMsg('Error de conexión');
                        }
                      }
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto del Botón</label>
                <input 
                  type="text" 
                  value={bannerForm.buttonText}
                  onChange={e => setBannerForm({...bannerForm, buttonText: e.target.value})}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enlace (Link)</label>
                <input 
                  type="text" 
                  value={bannerForm.link}
                  onChange={e => setBannerForm({...bannerForm, link: e.target.value})}
                  required
                  placeholder="/r/nombre-restaurante o https://..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad (Opcional)</label>
                <input 
                  type="text" 
                  value={bannerForm.city}
                  onChange={e => setBannerForm({...bannerForm, city: e.target.value})}
                  placeholder="Dejar vacío para todas las ciudades"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input 
                    type="number" 
                    value={bannerForm.order}
                    onChange={e => setBannerForm({...bannerForm, order: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={bannerForm.active}
                      onChange={e => setBannerForm({...bannerForm, active: e.target.checked})}
                      className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500" 
                    />
                    <span className="text-sm font-medium text-gray-700">Activo</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowBannerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirmar Acción</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                }}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message Dialog */}
      {errorMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl border-t-4 border-red-500">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aviso</h3>
            <p className="text-gray-600 mb-6">{errorMsg}</p>
            <button 
              onClick={() => setErrorMsg(null)}
              className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string, value: string | number }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Table({ columns, data, loading }: { columns: string[], data: any[][], loading: boolean }) {
  if (loading) return <div className="py-8 text-center text-gray-500">Cargando...</div>;
  if (data.length === 0) return <div className="py-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">No se encontraron datos</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-6 py-3 font-medium text-gray-500 whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="px-6 py-4 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
