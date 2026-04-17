import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validate.js';
import { messageController } from '../controllers/message.controller.js';
import {
  markConversationReadSchema,
  sendMessageSchema,
} from '../validators/message.schemas.js';

export const messageRouter = Router();

messageRouter.use(authenticate);
messageRouter.use(
  requireRole('CHW', 'HEALTH_CENTER', 'LOCAL_CLINIC', 'HOSPITAL', 'REFERRAL_HOSPITAL')
);

messageRouter.get('/unread-count', messageController.unreadCount);
messageRouter.get('/conversations', messageController.listConversations);
messageRouter.post(
  '/conversations/read',
  validateBody(markConversationReadSchema),
  messageController.markConversationRead
);
messageRouter.post(
  '/send',
  validateBody(sendMessageSchema),
  messageController.sendMessage
);
