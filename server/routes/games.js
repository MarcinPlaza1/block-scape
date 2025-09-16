import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validateBody, schemas, sanitizeBody } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as gamesController from '../controllers/gamesController.js';

const router = Router();

// Public routes
router.get('/',
  asyncHandler(gamesController.getPublicGames)
);

router.get('/:id/public',
  asyncHandler(gamesController.getPublicGame)
);

// Public: add a unique daily view (logged users and guests)
router.post('/:id/views',
  asyncHandler(gamesController.addView)
);

router.get('/:id/likes',
  optionalAuth,
  asyncHandler(gamesController.getLikes)
);

router.get('/:id/leaderboard',
  asyncHandler(gamesController.getLeaderboard)
);

// Comments
router.get('/:id/comments',
  asyncHandler(gamesController.listComments)
);

// Protected routes
router.use(requireAuth);

router.post('/',
  sanitizeBody,
  validateBody(schemas.createGame),
  asyncHandler(gamesController.createGame)
);

router.get('/:id',
  asyncHandler(gamesController.getGame)
);

router.put('/:id',
  sanitizeBody,
  validateBody(schemas.createGame), // Same schema for update
  asyncHandler(gamesController.updateGame)
);

// Visibility update (owner only)
router.patch('/:id/visibility',
  sanitizeBody,
  validateBody(schemas.updateVisibility),
  asyncHandler(gamesController.updateVisibility)
);

// Sharing endpoints (owner only)
router.post('/:id/share',
  sanitizeBody,
  validateBody(schemas.shareGame),
  asyncHandler(gamesController.shareGame)
);

router.delete('/:id/share/:memberId',
  asyncHandler(gamesController.unshareGame)
);

router.delete('/:id',
  asyncHandler(gamesController.deleteGame)
);

// Bulk endpoints
router.put('/bulk',
  sanitizeBody,
  asyncHandler(gamesController.bulkUpdateGames)
);

router.delete('/bulk',
  sanitizeBody,
  asyncHandler(gamesController.bulkDeleteGames)
);

// Export
router.post('/export',
  sanitizeBody,
  asyncHandler(gamesController.exportGames)
);

// Duplicate
router.post('/:id/duplicate',
  sanitizeBody,
  asyncHandler(gamesController.duplicateGame)
);

router.post('/:id/likes',
  requireAuth,
  asyncHandler(gamesController.likeGame)
);

router.delete('/:id/likes',
  requireAuth,
  asyncHandler(gamesController.unlikeGame)
);

router.post('/:id/leaderboard',
  sanitizeBody,
  validateBody(schemas.submitScore),
  asyncHandler(gamesController.submitScore)
);

router.post('/:id/comments',
  sanitizeBody,
  validateBody(schemas.createComment),
  asyncHandler(gamesController.createComment)
);

router.delete('/:id/comments/:commentId',
  asyncHandler(gamesController.deleteComment)
);

export default router;
