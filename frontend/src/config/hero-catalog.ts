export const HERO_CATEGORIES = [
  'hamburguesa',
  'pizza',
  'tacos',
  'sushi',
  'ensalada',
  'desayuno',
  'antojitos',
  'postres',
  'bebidas',
  'cafe',
] as const;

export const HERO_MOMENTS = ['manana', 'comida', 'tarde', 'noche', 'general'] as const;

export type HeroCategory = (typeof HERO_CATEGORIES)[number];
export type HeroMoment = (typeof HERO_MOMENTS)[number];

export interface HeroManifestEntry {
  id: string;
  source: string;
  files?: Record<string, string>;
}

export interface HeroCatalogEntry {
  id: string;
  category: HeroCategory;
  moment: HeroMoment;
  webp512Path: string;
  alt: string;
  priority: number;
  sourceName: string;
}

export interface HeroCatalog {
  heroes: HeroCatalogEntry[];
  officialFallback: HeroCatalogEntry | null;
}

const CATEGORY_ALT: Record<HeroCategory, string> = {
  hamburguesa: 'Hamburguesa doble con queso',
  pizza: 'Pizza recién horneada',
  tacos: 'Tacos preparados',
  sushi: 'Selección de sushi',
  ensalada: 'Ensalada fresca',
  desayuno: 'Desayuno con huevos y hot cakes',
  antojitos: 'Antojitos preparados',
  postres: 'Selección de postres',
  bebidas: 'Bebidas refrescantes',
  cafe: 'Taza de café recién preparado',
};

const HERO_NAME_PATTERN = new RegExp(
  `^hero-(${HERO_CATEGORIES.join('|')})-(${HERO_MOMENTS.join('|')})\\.png$`,
);

const isManifestEntry = (value: unknown): value is HeroManifestEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HeroManifestEntry>;
  return typeof entry.id === 'string' && typeof entry.source === 'string';
};

const createFallbackEntry = (entry: HeroManifestEntry): HeroCatalogEntry | null => {
  const webp512Path = entry.files?.['512'];
  if (!webp512Path) return null;
  return {
    id: entry.id,
    category: 'hamburguesa',
    moment: 'general',
    webp512Path,
    alt: 'Hamburguesa artesanal con queso y vegetales frescos',
    priority: 0,
    sourceName: entry.source,
  };
};

export function buildHeroCatalog(
  manifest: unknown,
  warn: (message: string) => void = () => undefined,
): HeroCatalog {
  const entries = Array.isArray(manifest) ? manifest.filter(isManifestEntry) : [];
  const heroes: HeroCatalogEntry[] = [];
  let officialFallback: HeroCatalogEntry | null = null;

  for (const entry of entries) {
    const webp512Path = entry.files?.['512'];
    if (!webp512Path) {
      warn(`Hero ignorado sin variante WebP 512: ${entry.source}`);
      continue;
    }

    const match = HERO_NAME_PATTERN.exec(entry.source.toLowerCase());
    if (!match) {
      warn(`Hero ignorado por nombre inválido: ${entry.source}`);
      if (entry.id === 'hamburguesa-hero' || entry.source.toLowerCase() === 'hamburguesa-hero.png') {
        officialFallback = createFallbackEntry(entry);
      }
      continue;
    }

    const category = match[1] as HeroCategory;
    const moment = match[2] as HeroMoment;
    heroes.push({
      id: entry.id,
      category,
      moment,
      webp512Path,
      alt: CATEGORY_ALT[category],
      priority: moment === 'general' ? 50 : 100,
      sourceName: entry.source,
    });
  }

  return {
    heroes: heroes.sort((left, right) => left.id.localeCompare(right.id)),
    officialFallback,
  };
}

export function getHeroMoment(date: Date): Exclude<HeroMoment, 'general'> {
  const hour = date.getHours();
  if (hour >= 5 && hour <= 10) return 'manana';
  if (hour >= 11 && hour <= 15) return 'comida';
  if (hour >= 16 && hour <= 18) return 'tarde';
  return 'noche';
}

const localDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function stableHeroIndex(seed: string, length: number): number {
  if (length <= 0) return -1;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

const chooseStable = (entries: HeroCatalogEntry[], seed: string): HeroCatalogEntry | null => {
  if (entries.length === 0) return null;
  const highestPriority = Math.max(...entries.map((entry) => entry.priority));
  const candidates = entries
    .filter((entry) => entry.priority === highestPriority)
    .sort((left, right) => left.id.localeCompare(right.id));
  return candidates[stableHeroIndex(seed, candidates.length)] ?? null;
};

export function selectContextualHero(catalog: HeroCatalog, date: Date): HeroCatalogEntry | null {
  const moment = getHeroMoment(date);
  const seed = `${localDateKey(date)}:${moment}`;
  const contextual = chooseStable(catalog.heroes.filter((hero) => hero.moment === moment), seed);
  if (contextual) return contextual;

  const general = chooseStable(catalog.heroes.filter((hero) => hero.moment === 'general'), seed);
  return general ?? catalog.officialFallback;
}