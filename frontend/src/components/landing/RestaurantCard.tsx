import { Link } from 'react-router-dom';
import { generateSlug } from '../../utils';
import { YommigoIcon } from '../YommigoIcon';

export interface LandingRestaurant {
  id: string;
  name?: string;
  restaurant_name?: string;
  cover_image?: string;
  coverUrl?: string;
  logo_url?: string;
  cuisine_type?: string;
  rating_score?: number;
  rating_count?: number;
  delivery_time?: string;
  price_level?: string;
  has_delivery?: boolean;
  has_pickup?: boolean;
  acceptingOrders?: boolean;
  code?: string;
  categories?: Array<{ name: string }>;
  promotion?: string;
  promotion_description?: string;
}

export function RestaurantCard({ restaurant }: { restaurant: LandingRestaurant }) {
  const name = restaurant.restaurant_name || restaurant.name || 'Restaurante';
  const cuisine = restaurant.categories?.map((category) => category.name).join(' · ') || restaurant.cuisine_type;
  const cover = restaurant.cover_image || restaurant.coverUrl || restaurant.logo_url;
  const hasRating = Boolean(restaurant.rating_count && restaurant.rating_count > 0 && restaurant.rating_score);
  const modes = [restaurant.has_delivery ? 'Entrega' : null, restaurant.has_pickup ? 'Recoger' : null].filter(Boolean).join(' · ');
  const status = restaurant.acceptingOrders ? 'Abierto' : restaurant.code === 'RESTAURANT_PAUSED' ? 'Pausado' : 'Cerrado';

  return (
    <Link to={`/r/${generateSlug(name)}`} className="landing-restaurant-card">
      <div className="landing-restaurant-card__image">
        {cover
          ? <img src={cover} alt={`Platillos de ${name}`} loading="lazy" width="320" height="176" />
          : <div className="landing-restaurant-card__placeholder">Imagen no disponible</div>}
        <span className={`landing-restaurant-card__status is-${status.toLowerCase()}`}>{status}</span>
        <span className="landing-restaurant-card__favorite" aria-hidden="true"><YommigoIcon name="favoritos" size={110} alt="" loading="lazy" /></span>
      </div>
      <div className="landing-restaurant-card__body">
        <h3>{name}</h3>
        <div className="landing-restaurant-card__meta">
          <p>{cuisine || modes || 'Menú disponible'}</p>
          {hasRating && <p>{restaurant.rating_score?.toFixed(1)} <YommigoIcon name="calificacion" size={110} alt="" loading="lazy" /></p>}
        </div>
        <div className="landing-restaurant-card__meta">
          {restaurant.delivery_time
            ? <p className="landing-restaurant-card__time"><YommigoIcon name="tiempo" size={110} alt="" loading="lazy" />{restaurant.delivery_time}</p>
            : <p>{modes || 'Consulta sus opciones'}</p>}
          {restaurant.price_level && <strong>{restaurant.price_level}</strong>}
        </div>
      </div>
    </Link>
  );
}