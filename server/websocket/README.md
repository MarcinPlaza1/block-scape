# WebSocket Server Architecture

## Overview

This directory contains the refactored WebSocket server implementation using Socket.IO. The code has been organized into modular components for better maintainability and scalability.

## Directory Structure

```
websocket/
├── config/
│   └── websocket.config.js      # Central configuration for WebSocket server
├── services/
│   ├── auth/
│   │   └── authMiddleware.js    # Socket.IO authentication middleware
│   ├── session/
│   │   └── SessionManager.js     # Manages active sessions and participants
│   ├── presence/
│   │   └── PresenceManager.js    # Tracks user presence and online status
│   ├── chat/
│   │   ├── SessionChatService.js # Handles chat within sessions
│   │   ├── GlobalChatService.js  # Manages global chat functionality
│   │   └── PrivateChatService.js # Handles private messaging
│   ├── collaboration/
│   │   └── CollaborationService.js # Manages collaborative editing
│   └── friends/
│       └── FriendsService.js     # Handles friends system
├── handlers/
│   └── connectionHandler.js      # Main connection handler
└── utils/
    └── tokenUtils.js            # JWT token utilities
```

## Key Components

### 1. Configuration (`config/websocket.config.js`)
- Centralized configuration for all WebSocket settings
- Includes CORS settings, token configuration, limits, and intervals

### 2. Authentication (`services/auth/authMiddleware.js`)
- Validates JWT tokens
- Verifies session access
- Attaches user data to socket instances

### 3. Session Manager (`services/session/SessionManager.js`)
- Manages active sessions in memory
- Tracks participants and their presence
- Handles session lifecycle and cleanup

### 4. Presence Manager (`services/presence/PresenceManager.js`)
- Tracks online users and their sockets
- Manages user rooms for targeted notifications
- Provides online status queries

### 5. Chat Services
- **SessionChatService**: Handles chat messages within game sessions
- **GlobalChatService**: Manages server-wide global chat
- **PrivateChatService**: Handles direct messaging between users

### 6. Collaboration Service (`services/collaboration/CollaborationService.js`)
- Manages block operations (add, update, delete)
- Handles selection synchronization
- Processes game events and scoring

### 7. Friends Service (`services/friends/FriendsService.js`)
- Manages friend notifications
- Tracks online friends and their activities
- Handles friend request notifications

### 8. Connection Handler (`handlers/connectionHandler.js`)
- Orchestrates all services
- Registers event handlers
- Manages connection lifecycle

## Usage

```javascript
import { createWebSocketServer } from './websocket.js';

// Create WebSocket server
const io = createWebSocketServer(httpServer);
```

## Key Features

1. **Modular Architecture**: Each concern is separated into its own service
2. **Scalability**: Services can be easily extended or replaced
3. **Type Safety**: Clear interfaces between modules
4. **Memory Management**: Automatic cleanup of inactive sessions
5. **Real-time Features**:
   - Session-based collaboration
   - Global and private chat
   - Friend presence tracking
   - Real-time editing synchronization

## Events

### Session Events
- `session_joined`: User joins a session
- `participant_joined/left`: Participant status changes
- `presence_update`: User presence data updates

### Chat Events
- `chat_message`: Session chat message
- `global_chat_message`: Global chat message
- `private_message`: Direct message
- `typing`: Typing indicator

### Collaboration Events
- `block_operation`: Block add/update/delete
- `selection_change`: Selection synchronization
- `game_event`: Game-specific events

### Friend Events
- `friend_request_received/accepted`: Friend requests
- `friend_status_changed`: Online/offline status
- `online_friends_list`: List of online friends

## Configuration

Key configuration options in `websocket.config.js`:

```javascript
{
  cors: { /* CORS settings */ },
  sessionTokenSecret: 'your-secret',
  sessionTokenExpiry: '1h',
  limits: {
    maxMessageLength: { /* per chat type */ },
    historySize: { /* per chat type */ }
  },
  cleanupIntervals: { /* cleanup timings */ }
}
```

## Security

- JWT-based authentication
- Session validation
- Permission checks for operations
- Message length limits
- Rate limiting (can be added)

## Future Improvements

1. Add Redis for horizontal scaling
2. Implement message persistence
3. Add rate limiting
4. Enhance error handling
5. Add metrics and monitoring
6. Implement reconnection handling
