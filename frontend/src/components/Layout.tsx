import { Outlet, Link } from 'react-router-dom';
import { useAuthStore, useCartStore, useCityStore } from '../store';
import { ShoppingCart, User, LogOut, Home, MapPin, X, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NoResponseFallback } from './NoResponseFallback';

export function Layout() {
  const { user, logout } = useAuthStore();
  const { items } = useCartStore();
  const { city, setCity } = useCityStore();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const cities = ['La Paz', 'Mexicali', 'Tijuana', 'Ensenada', 'Los Cabos'];

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasPrompted = localStorage.getItem('pwaPromptDismissed');
    
    if (!isStandalone && !hasPrompted) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('pwaPromptDismissed')) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('Para instalar: toca el botón de compartir en tu navegador y selecciona "Agregar a la pantalla de inicio"');
      setShowInstallPrompt(false);
      localStorage.setItem('pwaPromptDismissed', 'true');
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwaPromptDismissed', 'true');
  };

  useEffect(() => {
    if (!city && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            const detectedCity = data.address?.city || data.address?.town || data.address?.village;
            
            if (detectedCity) {
              // Check if detected city is in our list, or just set it
              const matchedCity = cities.find(c => detectedCity.includes(c)) || detectedCity;
              setCity(matchedCity);
            }
          } catch (error) {
            console.error('Error detecting city:', error);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, [city, setCity]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <NoResponseFallback />
      {showInstallPrompt && (
        <div className="bg-orange-600 text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-[60]">
          <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={handleInstallClick}>
            <span className="text-xl">📲</span>
            <span className="font-medium text-sm sm:text-base">Agrega Yommi a tu pantalla para pedir más rápido</span>
          </div>
          <button onClick={dismissInstallPrompt} className="p-1 hover:bg-orange-700 rounded-full transition-colors ml-4 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden flex-1">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 text-gray-600 hover:text-orange-600 transition-colors"
                aria-label="Abrir menú"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            {/* Logo */}
            <Link to="/" className="flex items-center justify-center md:justify-start flex-1 md:flex-none">
              <img src="/logo.png" alt="Yommi Logo" className="h-[40px] sm:h-[50px] w-auto object-contain" />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-4 flex-1 justify-end">
              <div className="flex items-center gap-1 mr-4">
                <MapPin className="w-4 h-4 text-gray-500" />
                <select
                  value={city || ''}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer"
                >
                  <option value="" disabled>Tu ciudad</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <Link to="/restaurants" className="text-gray-600 hover:text-orange-600 font-medium mr-4">
                Directorio
              </Link>
              {(!user || user.role === 'CLIENT') && (
                <Link to="/cart" className="text-gray-600 hover:text-gray-900 relative mr-2">
                  <ShoppingCart className="w-5 h-5" />
                  {items.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {items.length}
                    </span>
                  )}
                </Link>
              )}
              {user ? (
                <>
                  {user.role === 'ADMIN' && (
                    <Link to="/admin" className="text-gray-600 hover:text-orange-600 font-medium mr-4">
                      Admin
                    </Link>
                  )}
                  <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
                    <User className="w-5 h-5" />
                    <span className="hidden sm:inline">{user.name}</span>
                  </Link>
                  <button onClick={logout} className="text-gray-600 hover:text-gray-900">
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium">Entrar</Link>
                  <Link to="/register" className="bg-orange-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-orange-700 transition-colors">
                    Registrarse
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile Right Actions (e.g. Cart) */}
            <div className="flex items-center justify-end md:hidden flex-1">
              {(!user || user.role === 'CLIENT') && (
                <Link to="/cart" className="p-2 -mr-2 text-gray-600 hover:text-gray-900 relative">
                  <ShoppingCart className="w-6 h-6" />
                  {items.length > 0 && (
                    <span className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {items.length}
                    </span>
                  )}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        <div 
          className={`fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 md:hidden ${
            isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div 
          className={`fixed top-0 left-0 h-full w-[280px] bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 flex items-center justify-between border-b">
            <img src="/logo.png" alt="Yommi Logo" className="h-[40px] w-auto object-contain" />
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            {/* City Selector */}
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <MapPin className="w-5 h-5 text-gray-500" />
              <select
                value={city || ''}
                onChange={(e) => {
                  setCity(e.target.value);
                  setIsMobileMenuOpen(false);
                }}
                className="bg-transparent text-base font-medium text-gray-700 outline-none cursor-pointer w-full"
              >
                <option value="" disabled>Tu ciudad</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <Link 
              to="/restaurants" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-700 hover:text-orange-600 font-medium p-2 rounded-lg hover:bg-orange-50 transition-colors"
            >
              Directorio
            </Link>

            <div className="h-px bg-gray-100 my-2" />

            {user ? (
              <>
                <div className="flex items-center gap-3 p-2 mb-2">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>

                {user.role === 'ADMIN' && (
                  <Link 
                    to="/admin" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-gray-700 hover:text-orange-600 font-medium p-2 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    Panel de Administración
                  </Link>
                )}
                
                <Link 
                  to="/dashboard" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-gray-700 hover:text-orange-600 font-medium p-2 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  <User className="w-5 h-5" />
                  Mi Cuenta
                </Link>
                
                <button 
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }} 
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium p-2 rounded-lg hover:bg-red-50 transition-colors text-left mt-auto"
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                <Link 
                  to="/login" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-center text-gray-700 hover:text-gray-900 font-medium p-3 border border-gray-200 rounded-xl transition-colors"
                >
                  Entrar
                </Link>
                <Link 
                  to="/register" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-center bg-orange-600 text-white p-3 rounded-xl font-medium hover:bg-orange-700 transition-colors shadow-sm"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
