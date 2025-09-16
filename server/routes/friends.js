import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, schemas, sanitizeBody } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as friendsController from '../controllers/friendsController.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Friends list
router.get('/',
  asyncHandler(friendsController.getFriends)
);

// Friend requests
router.get('/requests',
  asyncHandler(friendsController.getFriendRequests)
);

router.post('/requests',
  sanitizeBody,
  validateBody(schemas.sendFriendRequest),
  asyncHandler(friendsController.sendFriendRequest)
);

router.post('/requests/:id/accept',
  asyncHandler(friendsController.acceptFriendRequest)
);

router.post('/requests/:id/reject',
  asyncHandler(friendsController.rejectFriendRequest)
);

router.delete('/requests/:id',
  asyncHandler(friendsController.cancelFriendRequest)
);

// Friends management
router.delete('/:friendId',
  asyncHandler(friendsController.removeFriend)
);

// Search users
router.get('/search',
  asyncHandler(friendsController.searchUsers)
);

// Online status
router.get('/online',
  asyncHandler(friendsController.getOnlineStatus)
);

// Friends' games listing
router.get('/games',
  asyncHandler(friendsController.getFriendsGames)
);

export default router;
