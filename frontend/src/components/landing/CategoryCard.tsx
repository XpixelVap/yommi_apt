import { Link } from 'react-router-dom';

export function CategoryCard({ name, icon, href, muted = false }: { name: string; icon: string; href: string; muted?: boolean }) {
  return <Link to={href} className={`landing-category-card ${muted ? 'is-muted' : ''}`}><span aria-hidden="true">{icon}</span><strong>{name}</strong></Link>;
}
