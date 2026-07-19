import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import {
  AdminAlreadyExistsError,
  type AdminBootstrapRepository,
  type AdminCreationData,
  bootstrapFirstAdmin
} from '../core/admin-bootstrap';

function createRepository(initialAdmin = false) {
  let hasAdmin = initialAdmin;
  let created: AdminCreationData | undefined;
  let createCalls = 0;

  const repository: AdminBootstrapRepository = {
    async hasAdmin() {
      return hasAdmin;
    },
    async createAdmin(data) {
      createCalls += 1;
      created = data;
      hasAdmin = true;
      return { id: 'admin-1', email: data.email, role: data.role };
    },
    async runExclusive(operation) {
      return operation(repository);
    }
  };

  return {
    repository,
    get created() { return created; },
    get createCalls() { return createCalls; }
  };
}

test('crea el primer administrador con campos canónicos y hash compatible', async () => {
  const state = createRepository();
  const password = 'Clave-Segura-2026!';

  const result = await bootstrapFirstAdmin(state.repository, {
    email: '  ADMIN@YOMMIGO.COM ',
    password
  });

  assert.equal(result.email, 'admin@yommigo.com');
  assert.equal(state.created?.role, 'ADMIN');
  assert.equal(state.created?.provider, 'email');
  assert.equal(state.created?.isSuspended, false);
  assert.notEqual(state.created?.password_hash, password);
  assert.equal(await bcrypt.compare(password, state.created?.password_hash ?? ''), true);
});

test('aborta sin modificar usuarios cuando ya existe un administrador', async () => {
  const state = createRepository(true);

  await assert.rejects(
    bootstrapFirstAdmin(state.repository, {
      email: 'otro@yommigo.com',
      password: 'Clave-Segura-2026!'
    }),
    AdminAlreadyExistsError
  );
  assert.equal(state.createCalls, 0);
});

test('rechaza correo inválido y contraseñas débiles', async () => {
  for (const credentials of [
    { email: 'correo-invalido', password: 'Clave-Segura-2026!' },
    { email: 'admin@yommigo.com', password: 'debil' },
    { email: 'admin@yommigo.com', password: 'Aa1!' + 'x'.repeat(69) }
  ]) {
    const state = createRepository();
    await assert.rejects(bootstrapFirstAdmin(state.repository, credentials), ZodError);
    assert.equal(state.createCalls, 0);
  }
});

test('vuelve a comprobar dentro de la sección exclusiva para evitar concurrencia', async () => {
  const state = createRepository();
  state.repository.runExclusive = async operation => {
    const lockedRepository = {
      ...state.repository,
      async hasAdmin() { return true; }
    };
    return operation(lockedRepository);
  };

  await assert.rejects(
    bootstrapFirstAdmin(state.repository, {
      email: 'admin@yommigo.com',
      password: 'Clave-Segura-2026!'
    }),
    AdminAlreadyExistsError
  );
  assert.equal(state.createCalls, 0);
});
