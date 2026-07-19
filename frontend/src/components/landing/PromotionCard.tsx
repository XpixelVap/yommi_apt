import { Link } from 'react-router-dom';
import { YommigoIcon } from '../YommigoIcon';

interface PromotionCardProps {
  title: string;
  description?: string;
  href: string;
}

export function PromotionCard({ title, description, href }: PromotionCardProps) {
  return (
    <section id="promociones" className="landing-promotion-card">
      <div><h2>Promoci&oacute;n disponible<br /><span>{title}</span></h2>{description && <p>{description}</p>}</div>
      <Link to={href}>Ver promoci&oacute;n</Link>
      <div className="landing-promotion-card__art" aria-hidden="true"><span className="landing-promotion-card__ticket">%</span><YommigoIcon name="promociones" size={110} alt="" loading="lazy" className="landing-promotion-card__icon" /></div>
    </section>
  );
}