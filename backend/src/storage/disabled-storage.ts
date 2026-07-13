import type { FileStorage } from './storage';

export class DisabledFileStorage implements FileStorage {
  async save(): Promise<never> {
    throw new Error('File uploads are not configured for this environment');
  }
}