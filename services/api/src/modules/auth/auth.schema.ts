import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email());

export const registerBody = z.object({
  email,
  password: z.string().min(8).max(128),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
});
