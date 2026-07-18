import { Link } from 'react-router-dom';
import { YommigoIcon, type YommigoIconName } from '../YommigoIcon';

interface CategoryCardProps {
  name: string;
  icon: YommigoIconName;
  href: string;
}

export function CategoryCard({ name, icon, href }: CategoryCardProps) {
  return (
    <Link to={href} className="landing-category-card">
      <span aria-hidden="true">
        <YommigoIcon name={icon} size={128} alt="" loading="lazy" />
      </span>
      <strong>{name}</strong>
    </Link>
  );
}