import { Link } from 'react-router-dom';
import { YommigoIcon, type YommigoIconName } from '../YommigoIcon';

interface CategoryCardProps {
  name: string;
  icon: YommigoIconName;
  href: string;
  selected?: boolean;
}

export function CategoryCard({ name, icon, href, selected = false }: CategoryCardProps) {
  return (
    <Link to={href} className={`landing-category-card ${selected ? 'is-selected' : ''}`} aria-current={selected ? 'page' : undefined}>
      <span aria-hidden="true">
        <YommigoIcon name={icon} size={128} alt="" loading="lazy" />
      </span>
      <strong>{name}</strong>
    </Link>
  );
}