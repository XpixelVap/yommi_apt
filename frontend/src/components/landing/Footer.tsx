import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';

export function Footer() {
  return (
    <footer id="ayuda" className="landing-footer">
      <div className="landing-footer__grid">
        <div className="landing-footer__brand"><BrandMark compact /><p>Comida que te hace feliz.</p></div>
        <nav aria-label="Explorar Yommigo"><h3>Explora</h3><Link to="/">Inicio</Link><Link to="/restaurants">Restaurantes</Link><Link to="/cart">Carrito</Link></nav>
        <nav aria-label="Cuenta"><h3>Tu cuenta</h3><Link to="/login">Iniciar sesión</Link><Link to="/register">Registrar restaurante</Link></nav>
        <div className="landing-footer__info"><h3>Información</h3><span>Ayuda</span><span>Privacidad</span><span>Términos</span><span>Contacto</span></div>
      </div>
      <div className="landing-footer__bottom"><p>&copy; 2026 Yommigo. Todos los derechos reservados.</p><p>Español &middot; MXN</p></div>
    </footer>
  );
}