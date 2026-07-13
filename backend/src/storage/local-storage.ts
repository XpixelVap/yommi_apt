import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileStorage, StoredFile } from './storage';

export class LocalFileStorage implements FileStorage {
  constructor(private readonly rootDirectory: string, private readonly publicBaseUrl: string) {}

  async save(input: { data: Buffer; folder: string; filename: string }): Promise<StoredFile> {
    const safeFolder = input.folder.replace(/[^a-zA-Z0-9/_-]/g, '');
    const safeFilename = path.basename(input.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = path.posix.join(safeFolder, safeFilename);
    const absolutePath = path.resolve(this.rootDirectory, ...relativePath.split('/'));
    const resolvedRoot = path.resolve(this.rootDirectory);
    if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('Invalid storage path');
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.data);
    return { relativePath, publicUrl: `${this.publicBaseUrl.replace(/\/$/, '')}/uploads/${relativePath}` };
  }
}