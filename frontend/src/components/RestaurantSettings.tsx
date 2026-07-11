import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Camera, Save } from 'lucide-react';
import { Toast } from './Toast';
import { clearCache } from '../utils/cache';

export function RestaurantSettings({ restaurantId }: { restaurantId?: string }) {
  const queryParam = restaurantId ? `?restaurantId=${restaurantId}` : '';
  const { token, user } = useAuthStore();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    city: '',
    cover_image: '',
    logoUrl: '',
    opening_hours: {
      monday: '09:00-22:00',
      tuesday: '09:00-22:00',
      wednesday: '09:00-22:00',
      thursday: '09:00-22:00',
      friday: '09:00-23:00',
      saturday: '09:00-23:00',
      sunday: '10:00-20:00'
    }
  });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/profile${queryParam}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setRestaurant(data);
        setFormData({
          name: data.restaurant_name || data.name || '',
          description: data.description || '',
          phone: data.phone_number || data.phone || '',
          address: data.address || '',
          city: data.city || '',
          cover_image: data.cover_image || data.coverUrl || '',
          logoUrl: data.logo_url || data.logoUrl || '',
          opening_hours: data.opening_hours ? JSON.parse(data.opening_hours) : {
            monday: '09:00-22:00',
            tuesday: '09:00-22:00',
            wednesday: '09:00-22:00',
            thursday: '09:00-22:00',
            friday: '09:00-23:00',
            saturday: '09:00-23:00',
            sunday: '10:00-20:00'
          }
        });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [token, restaurantId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'logo') => {
    const file = e.target.files?.[0];
    if (file) {
      const uploadData = new FormData();
      uploadData.append('image', file);
      
      const endpoint = type === 'cover' ? `${import.meta.env.VITE_API_URL || ""}/api/upload/restaurant/cover` : `${import.meta.env.VITE_API_URL || ""}/api/upload/restaurant`;
      
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: uploadData
        });
        
        if (res.ok) {
          const { imageUrl } = await res.json();
          if (type === 'cover') {
            setFormData(prev => ({ ...prev, cover_image: imageUrl }));
          } else {
            setFormData(prev => ({ ...prev, logoUrl: imageUrl }));
          }
        } else {
          setToast({ message: 'Error al subir la imagen', type: 'error' });
        }
      } catch (err) {
        console.error('Upload error:', err);
        setToast({ message: 'Error de conexión al subir la imagen', type: 'error' });
      }
    }
  };

  const handleHoursChange = (day: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/profile${queryParam}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          opening_hours: JSON.stringify(formData.opening_hours)
        })
      });
      if (res.ok) {
        setToast({ message: 'Perfil actualizado exitosamente', type: 'success' });
        clearCache('restaurants_');
        clearCache('popular_');
        clearCache('banners_');
      } else {
        setToast({ message: 'Error al actualizar el perfil', type: 'error' });
      }
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold mb-6">Configuración del Restaurante</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Cover Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Imagen de Portada (Restaurant Cover Image)</label>
          <div className="relative w-full h-48 bg-gray-100 rounded-xl overflow-hidden group">
            {formData.cover_image ? (
              <img src={formData.cover_image} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Camera className="w-12 h-12" />
              </div>
            )}
            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <span className="text-white font-medium">Cambiar Portada</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'cover')} />
            </label>
          </div>
        </div>

        {/* Logo Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Logo del Restaurante (Restaurant Logo)</label>
          <div className="relative w-32 h-32 bg-gray-100 rounded-xl overflow-hidden group">
            {formData.logoUrl ? (
              <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Camera className="w-8 h-8" />
              </div>
            )}
            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <span className="text-white font-medium text-sm text-center px-2">Cambiar Logo</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo')} />
            </label>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500" 
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input 
              type="text" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500" 
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500" 
              rows={3}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input 
              type="text" 
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500" 
            />
          </div>
        </div>

        {/* Opening Hours */}
        <div>
          <h3 className="text-lg font-bold mb-4">Horarios de Atención</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(formData.opening_hours).map(([day, hours]) => (
              <div key={day} className="flex items-center gap-4">
                <label className="w-24 text-sm font-medium text-gray-700 capitalize">
                  {day === 'monday' ? 'Lunes' : 
                   day === 'tuesday' ? 'Martes' : 
                   day === 'wednesday' ? 'Miércoles' : 
                   day === 'thursday' ? 'Jueves' : 
                   day === 'friday' ? 'Viernes' : 
                   day === 'saturday' ? 'Sábado' : 'Domingo'}
                </label>
                <input 
                  type="text" 
                  value={hours as string}
                  onChange={e => handleHoursChange(day, e.target.value)}
                  placeholder="09:00-22:00 o CERRADO"
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" 
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
