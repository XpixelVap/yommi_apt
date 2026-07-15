import { CircleHelp, Heart, Menu, ShoppingCart, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore, useCartStore, useCityStore } from '../../store';
import { BrandMark } from './BrandMark';
import { SearchBar } from './SearchBar';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuthStore();
  const { items } = useCartStore();
  const { city, setCity } = useCityStore();
  const displayCity = city || 'Monterrey';

  return (
    <header className="landing-navbar">
      <div className="landing-container landing-navbar__inner">
        <BrandMark />
        <div className="landing-navbar__city"><SearchBar compact city={displayCity} query="" onCityChange={setCity} onQueryChange={() => undefined} onSubmit={(event) => event.preventDefault()} /></div>
        <nav className="landing-navbar__links" aria-label={'Navegaci\u00f3n principal'}>
          <a href="#promociones">Promociones</a><Link to={user ? '/dashboard' : '/login'}>Favoritos</Link><a href="#ayuda">Ayuda</a>
          <Link to="/cart" className="landing-navbar__cart" aria-label={`Carrito, ${items.length} productos`}><ShoppingCart aria-hidden="true" />{items.length > 0 && <span>{items.length}</span>}</Link>
          <Link to={user ? '/dashboard' : '/login'} className="landing-navbar__session"><UserRound aria-hidden="true" /><span>{user ? 'Mi cuenta' : 'Iniciar sesi\u00f3n'}</span></Link>
        </nav>
        <div className="landing-navbar__mobile-actions">
          <Link to="/cart" className="landing-navbar__cart" aria-label={`Carrito, ${items.length} productos`}><ShoppingCart aria-hidden="true" />{items.length > 0 && <span>{items.length}</span>}</Link>
          <button type="button" onClick={() => setMenuOpen(true)} aria-label={'Abrir men\u00fa'}><Menu aria-hidden="true" /></button>
        </div>
      </div>
      <div className={`landing-mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <button className="landing-mobile-menu__backdrop" onClick={() => setMenuOpen(false)} aria-label={'Cerrar men\u00fa'} />
        <div className="landing-mobile-menu__panel">
          <div className="landing-mobile-menu__heading"><BrandMark compact /><button type="button" onClick={() => setMenuOpen(false)} aria-label={'Cerrar men\u00fa'}><X /></button></div>
          <SearchBar compact city={displayCity} query="" onCityChange={(nextCity) => { setCity(nextCity); setMenuOpen(false); }} onQueryChange={() => undefined} onSubmit={(event) => event.preventDefault()} />
          <a href="#promociones" onClick={() => setMenuOpen(false)}>Promociones</a>
          <Link to={user ? '/dashboard' : '/login'} onClick={() => setMenuOpen(false)}><Heart /> Favoritos</Link>
          <a href="#ayuda" onClick={() => setMenuOpen(false)}><CircleHelp /> Ayuda</a>
          <Link className="landing-mobile-menu__session" to={user ? '/dashboard' : '/login'} onClick={() => setMenuOpen(false)}><UserRound /> {user ? 'Mi cuenta' : 'Iniciar sesi\u00f3n'}</Link>
        </div>
      </div>
    </header>
  );
}
