import { useState } from 'react';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { DRIVERS_ENABLED } from '../utils';
import { GoogleLogin } from '@react-oauth/google';
import { runOptionalUpload } from '../utils/optionalUpload';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [instagram, setInstagram] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [hasDelivery, setHasDelivery] = useState(false);
  const [hasPickup, setHasPickup] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [role, setRole] = useState('CLIENT');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    try {
      const payload: any = { email, password, name, phone, role, city };
      if (role === 'RESTAURANT') {
        payload.address = address;
        payload.category = category;
        payload.instagram = instagram;
        payload.owner_name = ownerName;
        payload.has_delivery = hasDelivery;
        payload.has_pickup = hasPickup;
      } else if (role === 'DRIVER') {
        payload.vehicleType = vehicleType;
        payload.licenseNumber = licenseNumber;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrarse');
      
      if (role === 'RESTAURANT') {
        login(data.user, data.token);

        if (logo) {
          const uploaded = await runOptionalUpload(async () => {
            const formData = new FormData();
            formData.append('image', logo);
            const uploadRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/upload/restaurant`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${data.token}` },
              body: formData
            });
            if (!uploadRes.ok) throw new Error('Logo upload failed');
            const { imageUrl } = await uploadRes.json();
            const profileRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/profile`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.token}`
              },
              body: JSON.stringify({ logoUrl: imageUrl })
            });
            if (!profileRes.ok) throw new Error('Logo profile update failed');
          });
          if (!uploaded) console.warn('Restaurant registered; optional logo upload failed');
        }

        navigate('/dashboard');
        return;
      }

      login(data.user, data.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error con Google Login');
      login(data.user, data.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold text-center mb-6">Crear Cuenta</h2>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 p-4 rounded-xl mb-4 text-sm font-medium border border-green-200">{successMsg}</div>}
      
      {!successMsg && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cuenta</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="CLIENT">Cliente</option>
              <option value="RESTAURANT">Restaurante</option>
              {DRIVERS_ENABLED && <option value="DRIVER">Repartidor</option>}
            </select>
          </div>

          {role === 'CLIENT' && (
            <>
              <div className="mb-6 flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google Login falló')}
                />
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">O registrarse con email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre {role === 'RESTAURANT' ? 'del Restaurante' : ''}</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {role === 'RESTAURANT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Dueño</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp / Teléfono</label>
              <input
                type="tel"
                required
                placeholder="Ej: 6121234567 o +526121234567"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            
            {role !== 'CLIENT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            )}

            {role === 'RESTAURANT' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría / Cocina</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram (Opcional)</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo (Opcional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    onChange={(e) => setLogo(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <label className="block text-sm font-medium text-gray-700">Opciones de servicio</label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={hasDelivery}
                      onChange={(e) => setHasDelivery(e.target.checked)}
                      className="w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                    />
                    <span className="text-gray-900 font-medium">Entrega disponible</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={hasPickup}
                      onChange={(e) => setHasPickup(e.target.checked)}
                      className="w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                    />
                    <span className="text-gray-900 font-medium">Recoger en sucursal</span>
                  </label>
                </div>
              </>
            )}

            {role === 'DRIVER' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Vehículo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Moto, Auto, Bicicleta"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Licencia (Opcional)</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-medium hover:bg-orange-700 transition-colors"
            >
              Registrarse
            </button>
          </form>
        </>
      )}
    </div>
  );
}
