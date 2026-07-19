import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import heroBurger from '../../../../design/assets/hero/webp/512/hamburguesa-hero.webp';
import { YommigoIcon } from '../YommigoIcon';
import { SearchBar } from './SearchBar';

interface HeroProps {
  city: string;
  query: string;
  onCityChange: (city: string) => void;
  onQueryChange: (query: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
}

const resetBurgerPosition = (element: HTMLDivElement) => {
  element.style.setProperty('--hero-shift-x', '0px');
  element.style.setProperty('--hero-shift-y', '0px');
};

export function Hero({ city, query, onCityChange, onQueryChange, onSearch }: HeroProps) {
  const handleBurgerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const normalizedY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    const shiftX = Math.max(-10, Math.min(10, normalizedX * 10));
    const shiftY = Math.max(-8, Math.min(8, normalizedY * 8));

    event.currentTarget.style.setProperty('--hero-shift-x', `${shiftX.toFixed(1)}px`);
    event.currentTarget.style.setProperty('--hero-shift-y', `${shiftY.toFixed(1)}px`);
  };

  return (
    <section className="landing-hero">
      <div className="landing-hero__copy">
        <h1>Tu comida favorita,<br /><span>m&aacute;s cerca de ti</span></h1>
        <p>Descubre restaurantes incre&iacute;bles y pide<br className="landing-desktop-break" /> f&aacute;cil, r&aacute;pido y seguro.</p>
        <SearchBar city={city} query={query} onCityChange={onCityChange} onQueryChange={onQueryChange} onSubmit={onSearch} />
        <div className="landing-hero__benefits" aria-label="Beneficios de Yommigo">
          <div><span><YommigoIcon name="delivery" size={110} alt="" loading="eager" /></span><p><strong>Entrega r&aacute;pida</strong><small>en minutos</small></p></div>
          <div><span><YommigoIcon name="pago" size={110} alt="" loading="eager" /></span><p><strong>Pago seguro</strong><small>y protegido</small></p></div>
          <div><span><YommigoIcon name="calificacion" size={110} alt="" loading="eager" /></span><p><strong>Restaurantes</strong><small>verificados</small></p></div>
        </div>
      </div>
      <div
        className="landing-hero__visual"
        aria-label="Hamburguesa artesanal con queso y vegetales"
        onPointerMove={handleBurgerPointerMove}
        onPointerLeave={(event) => resetBurgerPosition(event.currentTarget)}
        onPointerCancel={(event) => resetBurgerPosition(event.currentTarget)}
      >
        <img src={heroBurger} alt="Hamburguesa artesanal con queso y vegetales frescos" width="512" height="512" loading="eager" fetchPriority="high" decoding="async" />
        <div className="landing-hero__local-card"><span><YommigoIcon name="favoritos" size={110} alt="" loading="eager" /></span><p><strong>Apoya lo local</strong><small>Pide directo a negocios<br />de tu ciudad</small></p></div>
      </div>
    </section>
  );
}