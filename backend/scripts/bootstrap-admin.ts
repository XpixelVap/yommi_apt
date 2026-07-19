import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { ZodError } from 'zod';
import {
  ADMIN_ROLE,
  AdminAlreadyExistsError,
  type AdminBootstrapRepository,
  type AdminCreationData,
  type LockedAdminRepository,
  assertNoAdminExists,
  bootstrapFirstAdmin
} from '../src/core/admin-bootstrap';

const prisma = new PrismaClient();

function repositoryFor(client: PrismaClient | Prisma.TransactionClient): LockedAdminRepository {
  return {
    async hasAdmin() {
      return Boolean(await client.user.findFirst({
        where: { role: ADMIN_ROLE },
        select: { id: true }
      }));
    },
    async createAdmin(data: AdminCreationData) {
      return client.user.create({
        data,
        select: { id: true, email: true, role: true }
      });
    }
  };
}

const repository: AdminBootstrapRepository = {
  ...repositoryFor(prisma),
  runExclusive(operation) {
    return prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(9951, 2026)`;
      return operation(repositoryFor(transaction));
    });
  }
};

class InteractiveTerminalRequiredError extends Error {}
class InputCancelledError extends Error {}

function promptHidden(label: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new InteractiveTerminalRequiredError();
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = stdin.isRaw;

    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
    };

    const finish = (result: string) => {
      cleanup();
      stdout.write('\n');
      resolve(result);
    };

    const cancel = () => {
      cleanup();
      stdout.write('\n');
      reject(new InputCancelledError());
    };

    const onData = (chunk: Buffer | string) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          cancel();
          return;
        }
        if (character === '\r' || character === '\n') {
          finish(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        if (character >= ' ') {
          value += character;
          stdout.write('*');
        }
      }
    };

    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  // Abort before asking for credentials when the environment is already initialized.
  await assertNoAdminExists(repository);

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new InteractiveTerminalRequiredError();
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  const email = await prompt.question('Correo del administrador: ');
  prompt.close();
  const password = await promptHidden('Contraseña: ');

  await bootstrapFirstAdmin(repository, { email, password });
  stdout.write('Administrador creado correctamente.\n');
}

try {
  await main();
} catch (error) {
  if (error instanceof AdminAlreadyExistsError) {
    console.error('No se realizó ningún cambio: ya existe un administrador.');
  } else if (error instanceof ZodError) {
    console.error(`Datos inválidos: ${error.issues.map(issue => issue.message).join(' ')}`);
  } else if (error instanceof InteractiveTerminalRequiredError) {
    console.error('Este comando requiere una terminal interactiva.');
  } else if (error instanceof InputCancelledError) {
    console.error('Operación cancelada.');
  } else {
    console.error('No fue posible crear el administrador.');
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
