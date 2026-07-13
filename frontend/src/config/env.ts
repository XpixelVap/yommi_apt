import { z } from 'zod';

const frontendEnvironmentSchema = z.object({
  VITE_API_URL: z.string().url('VITE_API_URL must be an absolute URL'),
  VITE_GOOGLE_CLIENT_ID: z.string().optional().default('')
});

const parsed = frontendEnvironmentSchema.safeParse(import.meta.env);
if (!parsed.success) {
  const names = parsed.error.issues.map(issue => issue.path.join('.') || 'environment').join(', ');
  throw new Error(`Invalid frontend environment configuration: ${names}`);
}

export const frontendEnv = Object.freeze(parsed.data);