import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { resolveRuntimeHero, type RuntimeHeroSelection } from '../../config/hero-runtime';
import type { HeroCatalogEntry } from '../../config/hero-catalog';

interface DynamicHeroImageProps {
  className?: string;
  alt?: string;
  loading?: ImgHTMLAttributes<HTMLImageElement>['loading'];
  priority?: boolean;
}

interface LoadedHero {
  src: string;
  hero: HeroCatalogEntry;
}

export function DynamicHeroImage({
  className = '',
  alt,
  loading = 'lazy',
  priority = false,
}: DynamicHeroImageProps) {
  const [selection] = useState<RuntimeHeroSelection>(() => resolveRuntimeHero(new Date()));
  const [loaded, setLoaded] = useState<LoadedHero | null>(null);

  useEffect(() => {
    let active = true;

    const loadSelection = async () => {
      if (!selection.hero || !selection.load) return;
      try {
        const src = await selection.load();
        if (active) setLoaded({ src, hero: selection.hero! });
      } catch {
        if (!selection.fallbackHero || !selection.loadFallback) return;
        try {
          const src = await selection.loadFallback();
          if (active) setLoaded({ src, hero: selection.fallbackHero! });
        } catch {
          // El estado neutro preserva el espacio si el asset oficial falta realmente.
        }
      }
    };

    void loadSelection();
    return () => { active = false; };
  }, [selection]);

  if (!loaded) {
    return <span className={`dynamic-hero-image-placeholder ${className}`.trim()} aria-hidden="true" />;
  }

  return (
    <img
      src={loaded.src}
      alt={alt ?? loaded.hero.alt}
      className={className}
      width="512"
      height="512"
      loading={priority ? 'eager' : loading}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  );
}