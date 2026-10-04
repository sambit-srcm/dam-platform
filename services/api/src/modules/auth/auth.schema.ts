import { FIELD_LIMITS } from '@dam/db';
import { z } from 'zod';

const email = z
  .string()
  .trim()
  .max(FIELD_LIMITS.email)
  .toLowerCase()
  .pipe(z.email());

export const registerBody = z.object({
  email,
  password: z.string().min(8).max(FIELD_LIMITS.password),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(FIELD_LIMITS.password),
});
