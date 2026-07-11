import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, Suspense, lazy } from 'react';
import { useAuthStore } from './store';
import { fetchWithAuth } from './utils';
import { Layout } from './components/Layout';

const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const RestaurantDashboard = lazy(() => import('./pages/RestaurantDashboard').then(m => ({ default: m.RestaurantDashboard })));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard').then(m => ({ default: m.ClientDashboard })));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard').then(m => ({ default: m.DriverDashboard })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const OrderTracking = lazy(() => import('./pages/OrderTracking').then(m => ({ default: m.OrderTracking })));
const RestaurantDetail = lazy(() => import('./pages/RestaurantDetail').then(m => ({ default: m.RestaurantDetail })));
const RestaurantDirectory = lazy(() => import('./pages/RestaurantDirectory').then(m => ({ default: m.RestaurantDirectory })));
const Cart = lazy(() => import('./pages/Cart').then(m => ({ default: m.Cart })));
const LastOrder = lazy(() => import('./pages/LastOrder').then(m => ({ default: m.LastOrder })));

export default function App() {
  const { token, login, logout, user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchWithAuth(`${import.meta.env.VITE_API_URL || ""}/api/auth/me`)
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          login(data.user, token);
        } else {
          logout();
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, login, logout]);

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Cargando...</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
            <Route path="register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
            <Route path="restaurants" element={<RestaurantDirectory />} />
            <Route path="r/:slug" element={<RestaurantDetail />} />
            <Route path="restaurantes/:city" element={<RestaurantDirectory />} />
            <Route path=":category/:city" element={<RestaurantDirectory />} />
            <Route path="cart" element={<Cart />} />
            <Route path="last-order" element={<LastOrder />} />
            <Route path="track/:id" element={<OrderTracking />} />
            
            <Route path="dashboard" element={
              !user ? <Navigate to="/login" /> :
              user.role === 'ADMIN' ? <AdminDashboard /> :
              user.role === 'RESTAURANT' ? <RestaurantDashboard /> :
              user.role === 'DRIVER' ? <DriverDashboard /> :
              <ClientDashboard />
            } />
            <Route path="admin" element={
              !user ? <Navigate to="/login" /> :
              user.role === 'ADMIN' ? <AdminDashboard /> :
              <Navigate to="/dashboard" />
            } />
            <Route path="admin-dashboard" element={
              !user ? <Navigate to="/login" /> :
              user.role === 'ADMIN' ? <AdminDashboard /> :
              <Navigate to="/dashboard" />
            } />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
