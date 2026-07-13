import { env } from '../config/env';
import { DisabledFileStorage } from './disabled-storage';
import { LocalFileStorage } from './local-storage';
import type { FileStorage } from './storage';

// Production remains disabled until an object-storage adapter is implemented.
export const fileStorage: FileStorage = env.STORAGE_DRIVER === 'local'
  ? new LocalFileStorage(env.UPLOAD_DIR, env.API_URL)
  : new DisabledFileStorage();