import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { caseRouter } from './case.routes.js';
import { notificationRouter } from './notification.routes.js';
import { userRouter } from './user.routes.js';
import { messageRouter } from './message.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/cases', caseRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/messages', messageRouter);
