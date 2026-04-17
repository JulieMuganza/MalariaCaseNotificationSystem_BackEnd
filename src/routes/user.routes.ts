import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../validators/user.schemas.js';

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.use(requireRole('ADMIN'));

userRouter.get('/', userController.list);
userRouter.post('/', validateBody(createUserSchema), userController.create);
userRouter.patch('/:id', validateBody(updateUserSchema), userController.patch);
userRouter.post('/:id/deactivate', userController.deactivate);
