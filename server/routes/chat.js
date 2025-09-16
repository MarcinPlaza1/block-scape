import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, schemas, sanitizeBody } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as chatController from '../controllers/chatController.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Global chat routes
router.get('/global/history',
  asyncHandler(chatController.getGlobalChatHistory)
);

router.get('/global/users',
  asyncHandler(chatController.getOnlineUsers)
);

// Private conversations
router.get('/conversations',
  asyncHandler(chatController.getConversations)
);

router.post('/conversations',
  sanitizeBody,
  validateBody({
    friendId: { required: true, type: 'string' }
  }),
  asyncHandler(chatController.createConversation)
);

router.get('/conversations/:id/messages',
  asyncHandler(chatController.getMessages)
);

router.post('/conversations/:id/messages',
  sanitizeBody,
  validateBody(schemas.sendMessage),
  asyncHandler(chatController.sendMessage)
);

// Unread count
router.get('/unread-count',
  asyncHandler(chatController.getUnreadCount)
);

export default router;
