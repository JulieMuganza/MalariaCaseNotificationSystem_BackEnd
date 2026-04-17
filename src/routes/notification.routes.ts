import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get('/', notificationController.list);
notificationRouter.patch('/:id/read', notificationController.markRead);
