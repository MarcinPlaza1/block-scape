import jwt from 'jsonwebtoken';
import config from '../../../config/config.js';
import prisma from '../../../config/database.js';

/**
 * Socket.IO authentication middleware for '/app' namespace
 * Accepts standard ACCESS JWT (no sessionId required)
 */
export async function appAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const payload = jwt.verify(token, config.auth.jwtAccessSecret);
    const userId = payload.sub;

    // Fetch user basics
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true, role: true }
    });

    if (!user) {
      return next(new Error('Invalid user'));
    }

    socket.userData = {
      userId: user.id,
      userName: user.name || 'User',
      role: user.role || 'USER',
      isGuest: false,
    };

    // Backward compatibility
    Object.assign(socket, socket.userData);

    next();
  } catch (error) {
    next(new Error('Authentication failed: ' + error.message));
  }
}


