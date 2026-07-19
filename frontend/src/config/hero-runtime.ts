import manifest from '../../../design/assets/hero/webp/index.json';
import {
  buildHeroCatalog,
  selectContextualHero,
  type HeroCatalogEntry,
  type HeroManifestEntry,
} from './hero-catalog';

const assetLoaders = import.meta.glob('../../../design/assets/hero/webp/512/*.webp', {
  import: 'default',
  query: '?url',
}) as Record<string, () => Promise<string>>;

const warnInDevelopment = (message: string) => {
  if (import.meta.env.DEV) console.warn(`[Yommi hero] ${message}`);
};

export const heroCatalog = buildHeroCatalog(
  manifest as HeroManifestEntry[],
  warnInDevelopment,
);

const loaderKeyFor = (hero: HeroCatalogEntry): string =>
  `../../../design/assets/hero/webp/${hero.webp512Path}`;

const loaderFor = (hero: HeroCatalogEntry | null): (() => Promise<string>) | null => {
  if (!hero) return null;
  return assetLoaders[loaderKeyFor(hero)] ?? null;
};

export interface RuntimeHeroSelection {
  hero: HeroCatalogEntry | null;
  load: (() => Promise<string>) | null;
  fallbackHero: HeroCatalogEntry | null;
  loadFallback: (() => Promise<string>) | null;
}

export function resolveRuntimeHero(date: Date = new Date()): RuntimeHeroSelection {
  const selected = selectContextualHero(heroCatalog, date);
  const selectedLoader = loaderFor(selected);
  const fallbackHero = heroCatalog.officialFallback;
  const fallbackLoader = loaderFor(fallbackHero);

  if (selected && selectedLoader) {
    return {
      hero: selected,
      load: selectedLoader,
      fallbackHero,
      loadFallback: fallbackLoader,
    };
  }

  if (selected) warnInDevelopment(`No existe el WebP declarado para ${selected.sourceName}`);
  return {
    hero: fallbackHero,
    load: fallbackLoader,
    fallbackHero,
    loadFallback: fallbackLoader,
  };
}