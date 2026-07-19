import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const ADMIN_ROLE = 'ADMIN' as const;
export const EMAIL_PROVIDER = 'email' as const;
export const ADMIN_DISPLAY_NAME = 'Administrador Yommigo';

export const adminCredentialsSchema = z.object({
  email: z.string().trim().email('El correo no tiene un formato válido.').transform(value => value.toLowerCase()),
  password: z.string()
    .min(12, 'La contraseña debe tener al menos 12 caracteres.')
    .max(72, 'La contraseña no puede exceder 72 caracteres.')
    .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'La contraseña no puede exceder 72 bytes.')
    .regex(/[a-z]/, 'La contraseña debe incluir una minúscula.')
    .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula.')
    .regex(/[0-9]/, 'La contraseña debe incluir un número.')
    .regex(/[^A-Za-z0-9\s]/, 'La contraseña debe incluir un carácter especial.')
    .regex(/^\S+$/, 'La contraseña no puede contener espacios.')
});

export type AdminCreationData = {
  name: string;
  email: string;
  password_hash: string;
  role: typeof ADMIN_ROLE;
  provider: typeof EMAIL_PROVIDER;
  isSuspended: false;
};

export type AdminSummary = {
  id: string;
  email: string;
  role: string;
};

export interface LockedAdminRepository {
  hasAdmin(): Promise<boolean>;
  createAdmin(data: AdminCreationData): Promise<AdminSummary>;
}

export interface AdminBootstrapRepository extends LockedAdminRepository {
  runExclusive<T>(operation: (repository: LockedAdminRepository) => Promise<T>): Promise<T>;
}

export class AdminAlreadyExistsError extends Error {
  constructor() {
    super('Ya existe un administrador.');
    this.name = 'AdminAlreadyExistsError';
  }
}

export async function assertNoAdminExists(repository: LockedAdminRepository): Promise<void> {
  if (await repository.hasAdmin()) {
    throw new AdminAlreadyExistsError();
  }
}

export async function bootstrapFirstAdmin(
  repository: AdminBootstrapRepository,
  credentials: unknown
): Promise<AdminSummary> {
  await assertNoAdminExists(repository);
  const parsed = adminCredentialsSchema.parse(credentials);
  const passwordHash = await bcrypt.hash(parsed.password, 12);

  return repository.runExclusive(async lockedRepository => {
    await assertNoAdminExists(lockedRepository);

    return lockedRepository.createAdmin({
      name: ADMIN_DISPLAY_NAME,
      email: parsed.email,
      password_hash: passwordHash,
      role: ADMIN_ROLE,
      provider: EMAIL_PROVIDER,
      isSuspended: false
    });
  });
}
