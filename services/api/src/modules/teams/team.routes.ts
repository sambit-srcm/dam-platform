import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import {
  addMemberController,
  createTeamController,
  listAllTeamsController,
  listMembersController,
  listTeamsController,
  removeMemberController,
} from './team.controller.ts';

// Teams the signed-in user belongs to. Creating and editing teams is admin-only.
export function teamRoutes(ctx: Context) {
  const router = Router();
  router.get('/', listTeamsController(ctx));
  return router;
}

export function adminTeamRoutes(ctx: Context) {
  const router = Router();
  router.get('/', listAllTeamsController(ctx));
  router.post('/', createTeamController(ctx));
  router.get('/:teamId/members', listMembersController(ctx));
  router.post('/:teamId/members', addMemberController(ctx));
  router.delete('/:teamId/members/:userId', removeMemberController(ctx));
  return router;
}
