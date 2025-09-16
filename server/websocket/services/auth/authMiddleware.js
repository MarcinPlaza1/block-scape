import prisma from '../../../config/database.js';
import { verifySessionToken } from '../../utils/tokenUtils.js';
import { wsConfig } from '../../config/websocket.config.js';

/**
 * Socket.IO authentication middleware
 * Verifies JWT token and attaches user/session data to socket
 */
export async function authMiddleware(socket, next) {
  try {
    // Extract token from auth header or handshake
    const token = socket.handshake.auth?.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify and decode token
    const decoded = verifySessionToken(token);
    const { userId, sessionId, role, isGuest, guestName } = decoded;

    // Verify session exists and is active
    const session = await prisma.realtimeSession.findFirst({
      where: { 
        id: sessionId, 
        isActive: true 
      },
      include: {
        game: true,
        participants: isGuest ? {
          where: { 
            userId: null,
            guestName: guestName || null
          }
        } : {
          where: { userId: userId || null }
        }
      }
    });

    if (!session) {
      return next(new Error('Invalid or expired session'));
    }

    // Enforce maxParticipants before allowing connection (DB overrides config)
    const maxParticipants = Number(session.maxParticipants || wsConfig.limits.maxParticipants);
    const currentOnline = await prisma.realtimeParticipant.count({
      where: { sessionId, isOnline: true }
    });
    if (currentOnline >= maxParticipants) {
      return next(new Error('Session is full'));
    }

    // Find participant
    let participant;
    if (isGuest) {
      // For guests, find participant by guestName
      participant = session.participants.find(p => p.guestName === guestName && p.userId === null);
      if (!participant) {
        return next(new Error('Guest participant not found'));
      }
    } else {
      // For logged-in users
      participant = session.participants[0];
      if (!participant) {
        return next(new Error('Not a participant of this session'));
      }
    }

    // Attach user data to socket for later use
    socket.userData = {
      userId: isGuest ? null : userId,
      guestId: isGuest ? userId : null, // For guests, userId contains the generated guestId
      sessionId,
      participantId: participant.id,
      role: participant.role,
      userName: participant.user?.name || participant.guestName || 'Anonymous',
      isGuest: isGuest || false
    };

    // For backward compatibility, also attach directly to socket
    Object.assign(socket, socket.userData);

    next();
  } catch (error) {
    next(new Error('Authentication failed: ' + error.message));
  }
}
