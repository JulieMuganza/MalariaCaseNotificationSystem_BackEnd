import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import {
  getMessagingUnreadCount,
  listMessagingConversations,
  markMessagingConversationRead,
  sendMessagingMessage,
} from '../services/message.service.js';

export const messageController = {
  unreadCount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true },
      });
      const count = await getMessagingUnreadCount({
        requesterRole: req.user.role,
        requesterId: req.user.id,
        requesterDistrict: userRow.district,
      });
      res.json({ data: { count } });
    } catch (e) {
      next(e);
    }
  },

  markConversationRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true },
      });
      const result = await markMessagingConversationRead({
        requesterRole: req.user.role,
        requesterId: req.user.id,
        requesterDistrict: userRow.district,
        conversationId: req.body.conversationId,
      });
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  listConversations: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true },
      });
      const conversations = await listMessagingConversations({
        requesterRole: req.user.role,
        requesterId: req.user.id,
        requesterDistrict: userRow.district,
      });
      res.json({ data: { conversations } });
    } catch (e) {
      next(e);
    }
  },

  sendMessage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true, name: true },
      });
      const message = await sendMessagingMessage({
        requesterRole: req.user.role,
        requesterId: req.user.id,
        requesterName: userRow.name,
        requesterDistrict: userRow.district,
        input: req.body,
      });
      res.status(201).json({ data: { message } });
    } catch (e) {
      next(e);
    }
  },
};
