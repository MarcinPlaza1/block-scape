// WebSocket configuration
export const wsConfig = {
  // Server settings
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:9000",
    credentials: true,
  },
  path: "/socket.io/",
  transports: ['websocket', 'polling'],

  // Authentication
  sessionTokenSecret: process.env.JWT_ACCESS_SECRET || process.env.WS_SESSION_SECRET || 'dev-access-secret',
  sessionTokenExpiry: '1h',

  // Limits and constraints
  limits: {
    maxParticipants: Number(process.env.WS_MAX_PARTICIPANTS || 20),
    maxMessageLength: {
      session: 500,
      global: 500,
      private: 1000
    },
    historySize: {
      session: 100,
      global: 1000
    },
    recentMessagesCount: 50
  },

  // Cleanup intervals
  cleanupIntervals: {
    inactiveSessions: 5 * 60 * 1000, // 5 minutes
    sessionTimeout: 30 * 60 * 1000    // 30 minutes
  },

  // Presence update
  presenceUpdateProbability: 0.1 // 10% chance to persist presence data
};

// Export helper for getting config values
export function getConfig(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], wsConfig);
}
