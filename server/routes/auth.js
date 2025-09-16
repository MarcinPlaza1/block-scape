import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, schemas, sanitizeBody } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { issueCsrfToken, requireDoubleSubmitCsrf } from '../middleware/csrf.js';
import { loginRateLimiter, refreshRateLimiter } from '../middleware/rateLimit.js';
import { loginBruteforceGuard, refreshBruteforceGuard } from '../middleware/bruteforce.js';
import * as authController from '../controllers/authController.js';

const router = Router();

// Public routes
router.use(issueCsrfToken);
router.post('/register',
  sanitizeBody,
  validateBody(schemas.register),
  asyncHandler(authController.register)
);

router.post('/login',
  loginRateLimiter,
  loginBruteforceGuard,
  sanitizeBody,
  validateBody(schemas.login),
  asyncHandler(authController.login)
);

router.post('/refresh',
  refreshRateLimiter,
  refreshBruteforceGuard,
  requireDoubleSubmitCsrf,
  asyncHandler(authController.refresh)
);

router.post('/logout',
  asyncHandler(authController.logout)
);

// CSRF helper route to ensure CSRF cookie is set for SPA bootstraps
router.get('/csrf', issueCsrfToken, (req, res) => {
  res.json({ ok: true });
});

// Protected routes
router.get('/sessions',
  requireAuth,
  asyncHandler(authController.getSessions)
);

router.delete('/sessions/:id',
  requireAuth,
  asyncHandler(authController.revokeSession)
);

export default router;
