import type { FormEvent } from 'react';
import { YommigoIcon } from '../YommigoIcon';
import { SearchBar } from './SearchBar';

interface HeroProps { city: string; query: string; onCityChange: (city: string) => void; onQueryChange: (query: string) => void; onSearch: (event: FormEvent<HTMLFormElement>) => void; }

export function Hero({ city, query, onCityChange, onQueryChange, onSearch }: HeroProps) {
  return (
    <section className="landing-hero">
      <div className="landing-hero__copy">
        <h1>Tu comida favorita,<br /><span>m&aacute;s cerca de ti</span></h1>
        <p>Descubre restaurantes incre&iacute;bles y pide<br className="landing-desktop-break" /> f&aacute;cil, r&aacute;pido y seguro.</p>
        <SearchBar city={city} query={query} onCityChange={onCityChange} onQueryChange={onQueryChange} onSubmit={onSearch} />
        <div className="landing-hero__benefits" aria-label="Beneficios de Yommigo">
          <div><span><YommigoIcon name="delivery" size={64} alt="" loading="eager" /></span><p><strong>Entrega r&aacute;pida</strong><small>en minutos</small></p></div>
          <div><span><YommigoIcon name="pago" size={64} alt="" loading="eager" /></span><p><strong>Pago seguro</strong><small>y protegido</small></p></div>
          <div><span><YommigoIcon name="calificacion" size={64} alt="" loading="eager" /></span><p><strong>Restaurantes</strong><small>verificados</small></p></div>
        </div>
      </div>
      <div className="landing-hero__visual" aria-label="Hamburguesa artesanal con queso y vegetales">
        <div className="landing-hero__glow" />
        <img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=92" alt="Hamburguesa artesanal con queso, tocino y vegetales frescos" fetchPriority="high" />
        <div className="landing-hero__local-card"><span><YommigoIcon name="favoritos" size={64} alt="" loading="eager" /></span><p><strong>Apoya lo local</strong><small>M&aacute;s de 1,200 restaurantes<br />en tu ciudad</small></p></div>
      </div>
    </section>
  );
}