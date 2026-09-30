import type { User } from '@dam/db';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/AppError.ts';
import type { Context } from '../../shared/lib/context.ts';
import { hashPassword, verifyPassword } from '../../shared/lib/password.ts';
import { signToken } from '../../shared/lib/token.ts';
import {
  createUser,
  findUserByEmail,
  findUserById,
} from './auth.repository.ts';

// Never hand out the password hash
function presentUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function withToken(user: User) {
  return {
    token: await signToken({ id: user.id, role: user.role }),
    user: presentUser(user),
  };
}

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown) {
  const code = (e: unknown) => (e as { code?: string } | null)?.code;
  // Drizzle wraps the driver error, so the code can sit one level down
  return (
    code(error) === UNIQUE_VIOLATION ||
    code((error as { cause?: unknown } | null)?.cause) === UNIQUE_VIOLATION
  );
}

export async function register(
  ctx: Context,
  input: { email: string; password: string },
) {
  try {
    const user = await createUser(ctx.db, {
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
    return withToken(user);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('An account with this email already exists');
    }
    throw error;
  }
}

// Checked against this when the email is unknown, so timing doesn't reveal which emails exist
const dummyHash = hashPassword('not-a-real-password');

export async function login(
  ctx: Context,
  input: { email: string; password: string },
) {
  const user = await findUserByEmail(ctx.db, input.email);
  const valid = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await dummyHash),
  );

  if (!user || !valid) throw new UnauthorizedError('Invalid email or password');
  return withToken(user);
}

export async function getMe(ctx: Context, userId: string) {
  const user = await findUserById(ctx.db, userId);
  if (!user) throw new NotFoundError('User not found');
  return presentUser(user);
}
