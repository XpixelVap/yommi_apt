import { ArrowRight } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { YommigoIcon, type YommigoIconName } from '../components/YommigoIcon';
import { CategoryCard } from '../components/landing/CategoryCard';
import { Footer } from '../components/landing/Footer';
import { Hero } from '../components/landing/Hero';
import { Navbar } from '../components/landing/Navbar';
import { PromotionCard } from '../components/landing/PromotionCard';
import { RestaurantCard, type LandingRestaurant } from '../components/landing/RestaurantCard';
import { SectionTitle } from '../components/landing/SectionTitle';
import { useCityStore } from '../store';
import { generateSlug } from '../utils';

const CATEGORIES: Array<{ name: string; icon: YommigoIconName; slug: string }> = [
  { name: 'Hamburguesas', icon: 'hamburguesa', slug: 'hamburguesas' },
  { name: 'Pizza', icon: 'pizza', slug: 'pizza' },
  { name: 'Tacos', icon: 'taco', slug: 'tacos' },
  { name: 'Sushi', icon: 'sushi', slug: 'sushi' },
  { name: 'Ensaladas', icon: 'ensalada', slug: 'ensaladas' },
  { name: 'Desayunos', icon: 'desayuno', slug: 'desayunos' },
  { name: 'Antojitos', icon: 'snacks', slug: 'antojitos' },
  { name: 'Postres', icon: 'postres', slug: 'postres' },
  { name: 'Bebidas', icon: 'bebidas', slug: 'bebidas' },
  { name: 'Caf\u00e9', icon: 'cafe', slug: 'cafeterias' },
];

const BENEFITS: Array<{ icon: YommigoIconName; title: string; copy: string; tone: string }> = [
  { icon: 'delivery', title: 'Entrega r\u00e1pida', copy: 'Tu comida en minutos', tone: 'orange' },
  { icon: 'pago', title: 'Pago seguro', copy: 'Tus datos siempre protegidos', tone: 'green' },
  { icon: 'calificacion', title: 'Restaurantes verificados', copy: 'Calidad en la que puedes confiar', tone: 'gold' },
  { icon: 'favoritos', title: 'Apoya lo local', copy: 'Impulsa a los negocios de tu ciudad', tone: 'pink' },
];

export function Home() {
  const [restaurants, setRestaurants] = useState<LandingRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { city, setCity } = useCityStore();
  const navigate = useNavigate();
  const displayCity = city || 'Monterrey';

  useEffect(() => {
    const controller = new AbortController();
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/restaurants${params}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('No fue posible consultar restaurantes')))
      .then((payload) => setRestaurants(Array.isArray(payload) ? payload : payload.data || []))
      .catch((error) => { if (error instanceof Error && error.name !== 'AbortError') setRestaurants([]); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [city]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const citySlug = generateSlug(displayCity);
    navigate(query.trim() ? `/${generateSlug(query)}/${citySlug}` : `/restaurantes/${citySlug}`);
  };

  return (
    <div className="landing-page">
      <Navbar />
      <main className="landing-container">
        <Hero city={displayCity} query={query} onCityChange={setCity} onQueryChange={setQuery} onSearch={handleSearch} />
        <section className="landing-section landing-categories">
          <SectionTitle>Explora por categor&iacute;a</SectionTitle>
          <div className="landing-categories__track">
            {CATEGORIES.map((category) => <CategoryCard key={category.slug} name={category.name} icon={category.icon} href={`/${category.slug}/${generateSlug(displayCity)}`} />)}
          </div>
        </section>
        <section className="landing-section landing-restaurants">
          <SectionTitle>Restaurantes cercanos</SectionTitle>
          {loading ? (
            <div className="landing-restaurants__grid" aria-label="Cargando restaurantes">{[0, 1, 2, 3].map((item) => <div className="landing-restaurant-card landing-restaurant-card--skeleton" key={item} />)}</div>
          ) : restaurants.length > 0 ? (
            <div className="landing-restaurants__grid">
              {restaurants.slice(0, 4).map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />)}
              <a href="/restaurants" className="landing-restaurants__next" aria-label={'Ver m\u00e1s restaurantes'}><ArrowRight /></a>
            </div>
          ) : (
            <div className="landing-restaurants__empty"><p>A&uacute;n no hay restaurantes disponibles en esta ciudad.</p><a href="/restaurants">Explorar otras opciones <ArrowRight /></a></div>
          )}
        </section>
        <PromotionCard />
        <section className="landing-section landing-why">
          <h2>&iquest;Por qu&eacute; elegir Yommigo?</h2>
          <div className="landing-why__grid">{BENEFITS.map(({ icon, title, copy, tone }) => <article key={title}><span className={`is-${tone}`}><YommigoIcon name={icon} size={64} alt="" loading="lazy" /></span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
        </section>
        <section className="landing-app-banner">
          <div><h2>Pide desde <span>nuestra app</span></h2><p>Una experiencia a&uacute;n m&aacute;s r&aacute;pida y pr&aacute;ctica.</p></div>
          <div className="landing-app-banner__stores"><span>{'\u25cf'} <small>Desc&aacute;rgala en</small><strong>App Store</strong></span><span>{'\u25b6'} <small>Disponible en</small><strong>Google Play</strong></span></div>
          <div className="landing-app-banner__qr" aria-label={'C\u00f3digo QR pr\u00f3ximamente'}><span>{'\u25a6'}</span><p>Escanea y<br />descarga la app</p></div>
        </section>
        <Footer />
      </main>
    </div>
  );
}