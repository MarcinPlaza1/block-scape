import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, schemas, sanitizeBody } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as realtimeController from '../controllers/realtimeController.js';

const router = Router();

// Protected routes
router.post('/sessions',
  requireAuth,
  sanitizeBody,
  validateBody(schemas.createSession),
  asyncHandler(realtimeController.createSession)
);

router.post('/sessions/:id/join',
  requireAuth,
  sanitizeBody,
  validateBody({
    role: { 
      required: false, 
      type: 'string', 
      enum: ['OWNER', 'EDITOR', 'VIEWER', 'PLAYER'] 
    }
  }),
  asyncHandler(realtimeController.joinSession)
);

router.get('/sessions/:id',
  requireAuth,
  asyncHandler(realtimeController.getSession)
);

router.patch('/sessions/:id',
  requireAuth,
  sanitizeBody,
  validateBody(schemas.updateSessionSettings),
  asyncHandler(realtimeController.updateSession)
);

router.delete('/sessions/:id',
  requireAuth,
  asyncHandler(realtimeController.closeSession)
);

// Public routes
router.post('/sessions/:id/join-guest',
  sanitizeBody,
  validateBody({
    guestName: { 
      required: false, 
      type: 'string', 
      maxLength: 20 
    }
  }),
  asyncHandler(realtimeController.joinSessionAsGuest)
);

router.post('/games/:gameId/join-play',
  sanitizeBody,
  validateBody({
    guestName: { 
      required: false, 
      type: 'string', 
      maxLength: 20 
    },
    asGuest: { 
      required: false, 
      type: 'boolean' 
    }
  }),
  asyncHandler(realtimeController.joinGamePlay)
);

router.get('/sessions/:id/chat',
  requireAuth,
  asyncHandler(realtimeController.getSessionChat)
);

// Public: online players count for a game
router.get('/games/:gameId/online',
  asyncHandler(realtimeController.getOnlinePlayersForGame)
);

export default router;
