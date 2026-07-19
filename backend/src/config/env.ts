import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().startsWith('postgresql://', 'DATABASE_URL must be PostgreSQL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  API_URL: z.string().url(),
  CORS_ORIGINS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  VITE_GOOGLE_CLIENT_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  STORAGE_DRIVER: z.enum(['local', 'disabled']).default('local')
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && !value.CORS_ORIGINS?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'CORS_ORIGINS is required in production' });
  }
  if (value.NODE_ENV === 'production' && value.STORAGE_DRIVER === 'local') {
    ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'Local storage is development-only' });
  }
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  const names = parsed.error.issues.map(issue => issue.path.join('.') || 'environment').join(', ');
  throw new Error(`Invalid backend environment configuration: ${names}`);
}

const values = parsed.data;
const configuredOrigins = (values.CORS_ORIGINS ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const developmentOrigins = values.NODE_ENV === 'development'
  ? ['http://localhost:3000', 'http://127.0.0.1:3000']
  : [];

export const env = Object.freeze({
  ...values,
  GOOGLE_CLIENT_ID: values.GOOGLE_CLIENT_ID ?? values.VITE_GOOGLE_CLIENT_ID,
  CORS_ORIGINS: [...new Set([...configuredOrigins, ...developmentOrigins])]
});

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || env.CORS_ORIGINS.includes(origin);
}