import { z } from 'zod';

export const PUBLIC_REGISTRATION_ROLES = ['CLIENT', 'RESTAURANT'] as const;

export const publicRegistrationRoleSchema = z.enum(PUBLIC_REGISTRATION_ROLES);

export type PublicRegistrationRole = z.infer<typeof publicRegistrationRoleSchema>;

export function resolvePublicUserRole(role?: PublicRegistrationRole): 'CLIENT' | 'RESTAURANT' {
  return role === 'RESTAURANT' ? 'RESTAURANT' : 'CLIENT';
}