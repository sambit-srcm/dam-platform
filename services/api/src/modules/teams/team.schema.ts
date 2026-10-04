import { z } from 'zod';

export const createTeamBody = z.object({
  name: z.string().trim().min(1).max(80),
});

export const addMemberBody = z.object({
  email: z.string().trim().max(254).toLowerCase().pipe(z.email()),
});
