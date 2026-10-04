import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Context } from '../../shared/lib/context.ts';
import { currentUser } from '../../shared/middlewares/requireAuth.ts';
import { addMemberBody, createTeamBody } from './team.schema.ts';
import {
  createTeam,
  dropMember,
  inviteMember,
  listAllTeams,
  listMyTeams,
  listTeamMembers,
} from './team.service.ts';

export function createTeamController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const body = createTeamBody.parse(req.body);
    res.status(201).json(await createTeam(ctx, currentUser(req), body));
  };
}

export function listAllTeamsController(ctx: Context) {
  return async (req: Request, res: Response) => {
    res.json({ items: await listAllTeams(ctx, currentUser(req)) });
  };
}

export function listTeamsController(ctx: Context) {
  return async (req: Request, res: Response) => {
    res.json({ items: await listMyTeams(ctx, currentUser(req)) });
  };
}

export function listMembersController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const teamId = z.uuid().parse(req.params.teamId);
    res.json({ items: await listTeamMembers(ctx, currentUser(req), teamId) });
  };
}

export function addMemberController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const teamId = z.uuid().parse(req.params.teamId);
    const body = addMemberBody.parse(req.body);
    res
      .status(201)
      .json(await inviteMember(ctx, currentUser(req), teamId, body.email));
  };
}

export function removeMemberController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const teamId = z.uuid().parse(req.params.teamId);
    const userId = z.uuid().parse(req.params.userId);
    await dropMember(ctx, currentUser(req), teamId, userId);
    res.status(204).end();
  };
}
