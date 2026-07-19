import { CircleHelp, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore, useCartStore, useCityStore } from '../../store';
import { YommigoIcon } from '../YommigoIcon';
import { BrandMark } from './BrandMark';
import { SearchBar } from './SearchBar';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuthStore();
  const { items } = useCartStore();
  const { city, setCity } = useCityStore();
  const displayCity = city || 'Tijuana';

  return (
    <header className="landing-navbar">
      <div className="landing-container landing-navbar__inner">
        <BrandMark />
        <div className="landing-navbar__city"><SearchBar compact city={displayCity} query="" onCityChange={setCity} onQueryChange={() => undefined} onSubmit={(event) => event.preventDefault()} /></div>
        <nav className="landing-navbar__links" aria-label="Navegación principal">
          <Link to="/restaurants" className="landing-navbar__text-link">Restaurantes</Link>
          <a href="#ayuda" className="landing-navbar__text-link"><CircleHelp aria-hidden="true" />Ayuda</a>
          <Link to="/cart" className="landing-navbar__cart" aria-label={`Carrito, ${items.length} productos`}><YommigoIcon name="carrito-compras" size={110} alt="" loading="eager" />{items.length > 0 && <span>{items.length}</span>}</Link>
          <Link to={user ? '/dashboard' : '/login'} className="landing-navbar__session"><YommigoIcon name="perfil" size={110} alt="" loading="eager" /><span>{user ? 'Mi cuenta' : 'Iniciar sesión'}</span></Link>
        </nav>
        <div className="landing-navbar__mobile-actions">
          <Link to="/cart" className="landing-navbar__cart" aria-label={`Carrito, ${items.length} productos`}><YommigoIcon name="carrito-compras" size={110} alt="" loading="eager" />{items.length > 0 && <span>{items.length}</span>}</Link>
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" aria-expanded={menuOpen}><Menu aria-hidden="true" /></button>
        </div>
      </div>
      <div className={`landing-mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <button className="landing-mobile-menu__backdrop" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />
        <div className="landing-mobile-menu__panel" role="dialog" aria-modal="true" aria-label="Menú principal">
          <div className="landing-mobile-menu__heading"><BrandMark compact /><button type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X aria-hidden="true" /></button></div>
          <SearchBar compact city={displayCity} query="" onCityChange={(nextCity) => { setCity(nextCity); setMenuOpen(false); }} onQueryChange={() => undefined} onSubmit={(event) => event.preventDefault()} />
          <Link to="/restaurants" onClick={() => setMenuOpen(false)}>Restaurantes</Link>
          <a href="#ayuda" onClick={() => setMenuOpen(false)}><CircleHelp aria-hidden="true" /> Ayuda</a>
          <Link to="/cart" onClick={() => setMenuOpen(false)}><YommigoIcon name="carrito-compras" size={110} alt="" loading="eager" /> Carrito</Link>
          <Link className="landing-mobile-menu__session" to={user ? '/dashboard' : '/login'} onClick={() => setMenuOpen(false)}><YommigoIcon name="perfil" size={110} alt="" loading="eager" /> {user ? 'Mi cuenta' : 'Iniciar sesión'}</Link>
        </div>
      </div>
    </header>
  );
}