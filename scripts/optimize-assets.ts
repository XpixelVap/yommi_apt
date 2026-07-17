import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ASSET_ROOT = path.resolve(process.cwd(), 'design', 'assets');
const OUTPUT_SIZES = [512, 128, 64, 32] as const;
const CONTENT_SCALE = 0.9;
const WEBP_QUALITY = 85;

type OutputSize = (typeof OUTPUT_SIZES)[number];

interface SourceAsset {
  absolutePath: string;
  collectionPath: string;
  originalName: string;
}

interface ManifestEntry {
  id: string;
  source: string;
  slug: string;
  original: { width: number; height: number; bytes: number };
  files: Record<string, string>;
  bytes: Record<string, number>;
}

interface Collision {
  collection: string;
  slug: string;
  sources: string[];
  resolvedAs: string;
}

interface LowResolutionWarning {
  source: string;
  width: number;
  height: number;
  generatedSizes: number[];
}

const isHiddenOrTemporary = (name: string): boolean => {
  const lower = name.toLowerCase();
  return name.startsWith('.') || name.startsWith('~') || lower.includes('.tmp.') || lower.includes('.temp.');
};

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

const slugify = (value: string): string => {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'asset';
};

async function discoverPngAssets(directory: string): Promise<SourceAsset[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const discovered: SourceAsset[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (isHiddenOrTemporary(entry.name)) continue;
    if (entry.isDirectory() && entry.name.toLowerCase() === 'webp') continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...await discoverPngAssets(absolutePath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.png') {
      discovered.push({ absolutePath, collectionPath: directory, originalName: entry.name });
    }
  }

  return discovered;
}

async function renderSquareWebp(sourcePath: string, outputPath: string, size: OutputSize): Promise<number> {
  const contentSize = Math.max(1, Math.round(size * CONTENT_SCALE));
  const resized = await sharp(sourcePath, { failOn: 'error' })
    .rotate()
    .resize({
      width: contentSize,
      height: contentSize,
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .webp({ quality: WEBP_QUALITY, alphaQuality: 100, effort: 4, smartSubsample: true })
    .toFile(outputPath);

  return (await stat(outputPath)).size;
}

async function main(): Promise<void> {
  const rootStats = await stat(ASSET_ROOT).catch(() => null);
  if (!rootStats?.isDirectory()) {
    throw new Error(`No existe el directorio de assets: ${toPosixPath(path.relative(process.cwd(), ASSET_ROOT))}`);
  }

  const assets = await discoverPngAssets(ASSET_ROOT);
  const byCollection = new Map<string, SourceAsset[]>();
  const collisions: Collision[] = [];
  const lowResolutionWarnings: LowResolutionWarning[] = [];
  const errors: string[] = [];
  const totalsBySize = Object.fromEntries(OUTPUT_SIZES.map(size => [String(size), 0])) as Record<string, number>;
  let originalBytes = 0;
  let generatedFiles = 0;

  for (const asset of assets) {
    const collectionAssets = byCollection.get(asset.collectionPath) ?? [];
    collectionAssets.push(asset);
    byCollection.set(asset.collectionPath, collectionAssets);
  }

  console.log('\nYommigo Asset Pipeline');
  console.log(`PNG encontrados: ${assets.length}`);
  console.log(`Colecciones: ${byCollection.size}\n`);

  for (const [collectionPath, collectionAssets] of [...byCollection.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const relativeCollection = toPosixPath(path.relative(ASSET_ROOT, collectionPath)) || '.';
    const outputRoot = path.join(collectionPath, 'webp');
    const usedSlugs = new Map<string, string[]>();
    const manifest: ManifestEntry[] = [];

    console.log(`[${relativeCollection}] ${collectionAssets.length} PNG`);

    for (const asset of collectionAssets) {
      try {
        const sourceBase = path.basename(asset.originalName, path.extname(asset.originalName));
        const baseSlug = slugify(sourceBase);
        const existing = usedSlugs.get(baseSlug) ?? [];
        existing.push(asset.originalName);
        usedSlugs.set(baseSlug, existing);

        const slug = existing.length === 1 ? baseSlug : `${baseSlug}-${existing.length}`;
        if (existing.length > 1) {
          collisions.push({
            collection: relativeCollection,
            slug: baseSlug,
            sources: [...existing],
            resolvedAs: slug,
          });
        }

        const metadata = await sharp(asset.absolutePath, { failOn: 'error' }).metadata();
        if (!metadata.width || !metadata.height) {
          throw new Error('Sharp no pudo determinar las dimensiones del PNG');
        }

        const sourceStats = await stat(asset.absolutePath);
        originalBytes += sourceStats.size;

        const upscaledSizes = OUTPUT_SIZES.filter(size => metadata.width! < size || metadata.height! < size);
        if (upscaledSizes.length > 0) {
          lowResolutionWarnings.push({
            source: `${relativeCollection}/${asset.originalName}`,
            width: metadata.width,
            height: metadata.height,
            generatedSizes: [...upscaledSizes],
          });
        }

        const files: Record<string, string> = {};
        const bytes: Record<string, number> = {};

        for (const size of OUTPUT_SIZES) {
          const relativeOutput = path.join(String(size), `${slug}.webp`);
          const absoluteOutput = path.resolve(outputRoot, relativeOutput);
          if (!absoluteOutput.startsWith(`${path.resolve(outputRoot)}${path.sep}`)) {
            throw new Error(`Ruta de salida insegura para ${asset.originalName}`);
          }

          const outputBytes = await renderSquareWebp(asset.absolutePath, absoluteOutput, size);
          files[String(size)] = toPosixPath(relativeOutput);
          bytes[String(size)] = outputBytes;
          totalsBySize[String(size)] += outputBytes;
          generatedFiles += 1;
        }

        manifest.push({
          id: slug,
          source: asset.originalName,
          slug,
          original: { width: metadata.width, height: metadata.height, bytes: sourceStats.size },
          files,
          bytes,
        });

        console.log(`  OK ${asset.originalName} -> ${slug}.webp`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const formatted = `${relativeCollection}/${asset.originalName}: ${message}`;
        errors.push(formatted);
        console.error(`  ERROR ${formatted}`);
      }
    }

    await mkdir(outputRoot, { recursive: true });
    await writeFile(
      path.join(outputRoot, 'index.json'),
      `${JSON.stringify(manifest.sort((left, right) => left.id.localeCompare(right.id)), null, 2)}\n`,
      'utf8',
    );
  }

  const totalGeneratedBytes = Object.values(totalsBySize).reduce((sum, value) => sum + value, 0);
  console.log('\nResumen');
  console.log(`PNG procesados: ${assets.length - errors.length}/${assets.length}`);
  console.log(`WebP generados: ${generatedFiles}`);
  console.log(`Peso PNG: ${originalBytes} bytes`);
  for (const size of OUTPUT_SIZES) console.log(`Peso WebP ${size}: ${totalsBySize[String(size)]} bytes`);
  console.log(`Peso WebP total: ${totalGeneratedBytes} bytes`);
  console.log(`Advertencias de baja resoluci\u00f3n: ${lowResolutionWarnings.length}`);
  console.log(`Colisiones resueltas: ${collisions.length}`);
  console.log(`Errores: ${errors.length}`);

  if (lowResolutionWarnings.length > 0) {
    console.warn('\nAdvertencias de baja resoluci\u00f3n:');
    for (const warning of lowResolutionWarnings) {
      console.warn(`  ${warning.source} (${warning.width}x${warning.height}) ampl\u00eda: ${warning.generatedSizes.join(', ')}`);
    }
  }

  if (collisions.length > 0) {
    console.warn('\nColisiones de slug resueltas:');
    for (const collision of collisions) {
      console.warn(`  ${collision.collection}/${collision.slug}: ${collision.sources.join(', ')} -> ${collision.resolvedAs}`);
    }
  }

  if (errors.length > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(`Asset pipeline error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
