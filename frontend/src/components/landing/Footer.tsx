import { Facebook, Instagram, Music2, Youtube } from 'lucide-react';
import { BrandMark } from './BrandMark';

export function Footer() {
  return (
    <footer id="ayuda" className="landing-footer">
      <div className="landing-footer__grid">
        <div className="landing-footer__brand"><BrandMark compact /><p>Comida que te hace feliz.</p></div>
        <div><h3>Yommigo</h3><a href="#">Qui&eacute;nes somos</a><a href="#">Trabaja con nosotros</a><a href="#">Blog</a><a href="#">Prensa</a></div>
        <div><h3>Ayuda</h3><a href="#">Centro de ayuda</a><a href="#">T&eacute;rminos y condiciones</a><a href="#">Pol&iacute;ticas de privacidad</a><a href="#">Pol&iacute;tica de reembolso</a></div>
        <div><h3>Para restaurantes</h3><a href="/register">Registra tu restaurante</a><a href="/login">Yommigo Pro</a><a href="#">Recursos</a><a href="#">Soporte para restaurantes</a></div>
        <div className="landing-footer__social"><h3>S&iacute;guenos</h3><p><a href="#" aria-label="Instagram"><Instagram /></a><a href="#" aria-label="Facebook"><Facebook /></a><a href="#" aria-label="TikTok"><Music2 /></a><a href="#" aria-label="YouTube"><Youtube /></a></p></div>
      </div>
      <div className="landing-footer__bottom"><p>&copy; 2026 Yommigo. Todos los derechos reservados.</p><div><button>Espa&ntilde;ol &#8964;</button><button>MXN &#8964;</button></div></div>
    </footer>
  );
}
