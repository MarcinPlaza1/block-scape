import jwt from 'jsonwebtoken';
import { wsConfig } from '../config/websocket.config.js';

/**
 * Generates a session token for WebSocket authentication
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {string} role - User role in the session
 * @param {Object} extra - Additional data to include in the token
 * @returns {string} JWT token
 */
export function generateSessionToken(userId, sessionId, role, extra = {}) {
  return jwt.sign(
    { userId, sessionId, role, ...extra },
    wsConfig.sessionTokenSecret,
    { expiresIn: wsConfig.sessionTokenExpiry }
  );
}

/**
 * Verifies a session token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid
 */
export function verifySessionToken(token) {
  return jwt.verify(token, wsConfig.sessionTokenSecret);
}
