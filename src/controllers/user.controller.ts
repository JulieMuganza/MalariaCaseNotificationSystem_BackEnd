import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  listUsers,
  createUserAdmin,
  updateUserAdmin,
  deactivateUser,
} from '../services/user.service.js';
const listQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
});

export const userController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = listQuerySchema.parse(req.query);
      const users = await listUsers(q);
      res.json({ data: { users } });
    } catch (e) {
      next(e);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await createUserAdmin(req.body);
      res.status(201).json({ data: { user } });
    } catch (e) {
      next(e);
    }
  },

  patch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await updateUserAdmin(id, req.body);
      res.json({ data: { user } });
    } catch (e) {
      next(e);
    }
  },

  deactivate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await deactivateUser(id);
      res.json({ data: { user } });
    } catch (e) {
      next(e);
    }
  },
};
