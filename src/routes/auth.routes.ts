import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendOtpSchema,
  completePasswordSetupSchema,
  patchMeSchema,
} from '../validators/auth.schemas.js';

const logoutBodySchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.post(
  '/register',
  strictAuthLimiter,
  validateBody(registerSchema),
  authController.register
);
authRouter.post(
  '/verify-email',
  strictAuthLimiter,
  validateBody(verifyEmailSchema),
  authController.verifyEmail
);
authRouter.post(
  '/resend-otp',
  strictAuthLimiter,
  validateBody(resendOtpSchema),
  authController.resendOtp
);
authRouter.post(
  '/complete-password-setup',
  strictAuthLimiter,
  authenticate,
  validateBody(completePasswordSetupSchema),
  authController.completePasswordSetup
);
authRouter.post(
  '/login',
  strictAuthLimiter,
  validateBody(loginSchema),
  authController.login
);
authRouter.post(
  '/refresh',
  authLimiter,
  validateBody(refreshSchema),
  authController.refresh
);
authRouter.post(
  '/logout',
  authLimiter,
  validateBody(logoutBodySchema),
  authController.logout
);
authRouter.get('/me', authenticate, authController.me);
authRouter.patch(
  '/me',
  authLimiter,
  authenticate,
  validateBody(patchMeSchema),
  authController.patchMe
);

authRouter.post(
  '/forgot-password',
  strictAuthLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
authRouter.post(
  '/reset-password',
  strictAuthLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword
);

/** Browser Google OAuth (redirect) */
authRouter.get('/google', authController.googleStart);
authRouter.get('/google/callback', authController.googleCallback);
authRouter.get('/google/status', authController.googleStatus);
