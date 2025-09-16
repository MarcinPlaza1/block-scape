import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, schemas, sanitizeBody } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as userController from '../controllers/userController.js';
import { getUserGames } from '../controllers/gamesController.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Profile routes
router.get('/me', 
  asyncHandler(userController.getProfile)
);

router.put('/me',
  sanitizeBody,
  validateBody(schemas.updateProfile),
  asyncHandler(userController.updateProfile)
);

router.delete('/me',
  asyncHandler(userController.deleteAccount)
);

// Security routes
router.post('/me/password',
  sanitizeBody,
  validateBody(schemas.changePassword),
  asyncHandler(userController.changePassword)
);

router.get('/me/permissions',
  asyncHandler(userController.getPermissions)
);

router.get('/me/logins',
  asyncHandler(userController.getLoginHistory)
);

// User's games
router.get('/me/games',
  asyncHandler(getUserGames)
);

export default router;
