import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHeroCatalog,
  getHeroMoment,
  selectContextualHero,
  stableHeroIndex,
  type HeroManifestEntry,
} from '../config/hero-catalog';

const entry = (source: string, id = source.replace('.png', '')): HeroManifestEntry => ({
  id,
  source,
  files: { '512': `512/${id}.webp` },
});

const fallback = entry('hamburguesa-hero.png', 'hamburguesa-hero');

const localDate = (hour: number) => new Date(2026, 6, 18, hour, 30, 0);

test('resolves morning, lunch, afternoon and night from an injected local date', () => {
  assert.equal(getHeroMoment(localDate(5)), 'manana');
  assert.equal(getHeroMoment(localDate(10)), 'manana');
  assert.equal(getHeroMoment(localDate(11)), 'comida');
  assert.equal(getHeroMoment(localDate(15)), 'comida');
  assert.equal(getHeroMoment(localDate(16)), 'tarde');
  assert.equal(getHeroMoment(localDate(18)), 'tarde');
  assert.equal(getHeroMoment(localDate(19)), 'noche');
  assert.equal(getHeroMoment(localDate(4)), 'noche');
});

test('deterministic rotation returns the same index for the same date block', () => {
  const seed = '2026-07-18:comida';
  assert.equal(stableHeroIndex(seed, 7), stableHeroIndex(seed, 7));
  assert.ok(stableHeroIndex(seed, 7) >= 0);
});

test('selection remains stable during the same block', () => {
  const catalog = buildHeroCatalog([
    entry('hero-pizza-comida.png'),
    entry('hero-tacos-comida.png'),
    fallback,
  ]);
  const first = selectContextualHero(catalog, new Date(2026, 6, 18, 11, 5));
  const second = selectContextualHero(catalog, new Date(2026, 6, 18, 15, 55));
  assert.equal(first?.id, second?.id);
});

test('empty catalog resolves to a neutral null state', () => {
  assert.equal(selectContextualHero(buildHeroCatalog([]), localDate(12)), null);
});

test('general hero is used when the current moment has no match', () => {
  const catalog = buildHeroCatalog([entry('hero-sushi-general.png'), fallback]);
  assert.equal(selectContextualHero(catalog, localDate(8))?.sourceName, 'hero-sushi-general.png');
});

test('official hamburger is the final fallback', () => {
  const catalog = buildHeroCatalog([fallback]);
  assert.equal(selectContextualHero(catalog, localDate(22))?.id, 'hamburguesa-hero');
});

test('invalid filename is ignored and warns without breaking the catalog', () => {
  const warnings: string[] = [];
  const catalog = buildHeroCatalog([entry('imagen-sin-convencion.png')], (message) => warnings.push(message));
  assert.equal(catalog.heroes.length, 0);
  assert.equal(catalog.officialFallback, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /nombre inválido/);
});

test('contextual hero has priority over general and fallback', () => {
  const catalog = buildHeroCatalog([
    entry('hero-cafe-general.png'),
    entry('hero-desayuno-manana.png'),
    fallback,
  ]);
  assert.equal(selectContextualHero(catalog, localDate(7))?.sourceName, 'hero-desayuno-manana.png');
});