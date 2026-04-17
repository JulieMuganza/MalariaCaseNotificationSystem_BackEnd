import type { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  refreshSession,
  logoutSession,
  getUserById,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  completePasswordSetup,
  updateMyProfile,
} from '../services/auth.service.js';
import {
  redirectToGoogleAuth,
  handleGoogleCallback,
  isGoogleOAuthConfigured,
} from '../services/google-oauth.service.js';

function clientMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent']?.slice(0, 500),
    ip: req.ip,
  };
}

export const authController = {
  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await registerUser(req.body, clientMeta(req));
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  verifyEmail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await verifyRegistrationOtp(
        req.body.email,
        req.body.code,
        clientMeta(req)
      );
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  resendOtp: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await resendRegistrationOtp(req.body.email);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  completePasswordSetup: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: { message: 'Unauthorized' } });
      const result = await completePasswordSetup(req.user.id, req.body.newPassword);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await loginUser(req.body, clientMeta(req));
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  refresh: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await refreshSession(req.body.refreshToken, clientMeta(req));
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await logoutSession(req.body.refreshToken ?? '');
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },

  me: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: { message: 'Unauthorized' } });
      const user = await getUserById(req.user.id);
      res.json({ data: { user } });
    } catch (e) {
      next(e);
    }
  },

  patchMe: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: { message: 'Unauthorized' } });
      const user = await updateMyProfile(req.user.id, req.user.role, req.body);
      res.json({ data: { user } });
    } catch (e) {
      next(e);
    }
  },

  forgotPassword: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await requestPasswordReset(req.body.email);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  resetPassword: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await resetPasswordWithToken(
        req.body.token,
        req.body.newPassword
      );
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },

  /** Browser redirect to Google (must be opened in browser / same window) */
  googleStart: (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isGoogleOAuthConfigured()) {
        return res.status(503).json({
          error: {
            message:
              'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
          },
        });
      }
      redirectToGoogleAuth(res);
    } catch (e) {
      next(e);
    }
  },

  googleCallback: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = await handleGoogleCallback(req, clientMeta(req));
      res.redirect(302, url);
    } catch (e) {
      next(e);
    }
  },

  /** JSON: whether Google browser login is available (never 500 — used by login UI on load). */
  googleStatus: (_req: Request, res: Response) => {
    try {
      res.json({
        data: {
          configured: isGoogleOAuthConfigured(),
          authorizationPath: '/api/v1/auth/google',
        },
      });
    } catch {
      res.json({
        data: {
          configured: false,
          authorizationPath: '/api/v1/auth/google',
        },
      });
    }
  },
};
