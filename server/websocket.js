import { Server } from 'socket.io';
import { wsConfig } from './websocket/config/websocket.config.js';
import { authMiddleware } from './websocket/services/auth/authMiddleware.js';
import { handleConnection } from './websocket/handlers/connectionHandler.js';
import { appAuthMiddleware } from './websocket/services/auth/appAuthMiddleware.js';
import { handleAppConnection } from './websocket/handlers/appConnectionHandler.js';

/**
 * Create and configure WebSocket server
 * @param {Object} httpServer - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
export function createWebSocketServer(httpServer) {
  // Create Socket.IO server with configuration
  const io = new Server(httpServer, wsConfig);

  // Realtime namespace (session-token auth)
  const realtimeNs = io.of('/realtime');
  realtimeNs.use(authMiddleware);
  realtimeNs.on('connection', (socket) => handleConnection(realtimeNs, socket));

  // App namespace (access JWT auth)
  const appNs = io.of('/app');
  appNs.use(appAuthMiddleware);
  appNs.on('connection', (socket) => handleAppConnection(appNs, socket));

  return io;
}

// Re-export utilities for backward compatibility
export { generateSessionToken } from './websocket/utils/tokenUtils.js';
