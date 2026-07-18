import { Link } from 'react-router-dom';
import { generateSlug } from '../../utils';
import { YommigoIcon } from '../YommigoIcon';

export interface LandingRestaurant {
  id: string;
  name?: string;
  restaurant_name?: string;
  cover_image?: string;
  coverUrl?: string;
  cuisine_type?: string;
  rating_score?: number;
  delivery_time?: string;
  price_level?: string;
  categories?: Array<{ name: string }>;
  promotion?: string;
  isNew?: boolean;
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=85',
];

export function RestaurantCard({ restaurant, index }: { restaurant: LandingRestaurant; index: number }) {
  const name = restaurant.restaurant_name || restaurant.name || 'Restaurante local';
  const cuisine = restaurant.categories?.map((category) => category.name).join(' \u00b7 ') || restaurant.cuisine_type || 'Comida local';
  const cover = restaurant.cover_image || restaurant.coverUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

  return (
    <Link to={`/r/${generateSlug(name)}`} className="landing-restaurant-card">
      <div className="landing-restaurant-card__image">
        <img src={cover} alt={`Platillos de ${name}`} loading="lazy" />
        {(restaurant.promotion || restaurant.isNew) && <span className={restaurant.isNew ? 'is-new' : ''}>{restaurant.isNew ? 'Nuevo' : restaurant.promotion}</span>}
        <span className="landing-restaurant-card__favorite" aria-hidden="true"><YommigoIcon name="favoritos" size={32} alt="" loading="lazy" /></span>
      </div>
      <div className="landing-restaurant-card__body">
        <h3>{name}</h3>
        <div className="landing-restaurant-card__meta"><p>{cuisine}</p><p>{restaurant.rating_score ? restaurant.rating_score.toFixed(1) : 'Nuevo'} <YommigoIcon name="calificacion" size={32} alt="" loading="lazy" /></p></div>
        <div className="landing-restaurant-card__meta"><p className="landing-restaurant-card__time"><YommigoIcon name="tiempo" size={32} alt="" loading="lazy" />{restaurant.delivery_time || '25\u201335 min'}</p><strong>{restaurant.price_level || '$$'}</strong></div>
      </div>
    </Link>
  );
}