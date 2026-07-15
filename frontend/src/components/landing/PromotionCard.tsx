import { Link } from 'react-router-dom';

export function PromotionCard() {
  return (
    <section id="promociones" className="landing-promotion-card">
      <div><h2>Ofertas exclusivas<br /><span>solo para ti</span></h2><p>Descubre promociones incre&iacute;bles<br />cada semana.</p></div>
      <Link to="/restaurants">Ver promociones</Link>
      <div className="landing-promotion-card__art" aria-hidden="true"><span className="landing-promotion-card__ticket">%</span><span className="landing-promotion-card__gift">{'\ud83c\udf81'}</span></div>
    </section>
  );
}
