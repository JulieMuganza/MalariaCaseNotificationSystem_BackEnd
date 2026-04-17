import type { Request, Response, NextFunction } from 'express';
import {
  listNotificationsForUser,
  markNotificationRead,
} from '../services/notification.service.js';
import { HttpError } from '../utils/HttpError.js';
import { prisma } from '../lib/prisma.js';

export const notificationController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true },
      });
      const notifications = await listNotificationsForUser(
        req.user.role,
        req.user.id,
        userRow.district
      );
      res.json({ data: { notifications } });
    } catch (e) {
      next(e);
    }
  },

  markRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const { id } = req.params;
      const n = await markNotificationRead(id, req.user.role, req.user.id);
      res.json({ data: { notification: n } });
    } catch (e) {
      next(e);
    }
  },
};
