import { sessionManager } from '../session/SessionManager.js';

/**
 * Handles collaborative editing operations
 */
export class CollaborationService {
  /**
   * Process block operation
   */
  processBlockOperation(sessionId, userData, operation, blockId, blockData) {
    // Check permissions
    if (userData.role !== 'OWNER' && userData.role !== 'EDITOR') {
      throw new Error('Insufficient permissions for editing');
    }

    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    // Apply operation to game state
    let updatedState = { ...sessionData.gameState };
    
    switch (operation) {
      case 'add':
        updatedState.blocks = updatedState.blocks || {};
        updatedState.blocks[blockId] = {
          ...blockData,
          id: blockId,
          createdBy: userData.userId,
          createdAt: Date.now()
        };
        break;
        
      case 'update':
        if (!updatedState.blocks || !updatedState.blocks[blockId]) {
          throw new Error('Block not found');
        }
        updatedState.blocks[blockId] = {
          ...updatedState.blocks[blockId],
          ...blockData,
          updatedBy: userData.userId,
          updatedAt: Date.now()
        };
        break;
        
      case 'delete':
        if (!updatedState.blocks || !updatedState.blocks[blockId]) {
          throw new Error('Block not found');
        }
        delete updatedState.blocks[blockId];
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Update session game state
    sessionManager.updateGameState(sessionId, updatedState);

    // Return operation details for broadcasting
    return {
      operation,
      blockId,
      blockData: updatedState.blocks?.[blockId] || null,
      userId: userData.userId,
      userName: userData.userName,
      timestamp: Date.now()
    };
  }

  /**
   * Process selection change
   */
  processSelectionChange(userData, selectedBlocks) {
    const effectiveUserId = userData.userId || userData.guestId;
    return {
      userId: effectiveUserId,
      guestId: userData.guestId || null,
      userName: userData.userName,
      selectedBlocks: selectedBlocks || []
    };
  }

  /**
   * Process player input (for play mode)
   */
  processPlayerInput(userData, input) {
    if (userData.role !== 'PLAYER') {
      throw new Error('Only players can send input');
    }

    return {
      userId: userData.userId,
      userName: userData.userName,
      input
    };
  }

  /**
   * Process game event
   */
  async processGameEvent(sessionId, userData, type, eventData) {
    const result = {
      type,
      userId: userData.userId,
      userName: userData.userName,
      data: eventData,
      timestamp: Date.now()
    };

    // Handle special events
    if (type === 'finish' && eventData.timeMs && userData.userId) {
      await this.saveScore(sessionId, userData.userId, eventData.timeMs);
    }

    return result;
  }

  /**
   * Save score to leaderboard
   */
  async saveScore(sessionId, userId, timeMs) {
    const { default: prisma } = await import('../../config/database.js');

    try {
      const session = await prisma.realtimeSession.findUnique({
        where: { id: sessionId },
        select: { gameId: true }
      });

      if (session && session.gameId) {
        await prisma.score.create({
          data: {
            userId,
            gameId: session.gameId,
            timeMs
          }
        });
      }
    } catch (error) {
      console.error('[CollaborationService] Save score error:', error);
    } finally {
      // Shared prisma is managed globally; do not disconnect here
    }
  }

  /**
   * Get current game state
   */
  getGameState(sessionId) {
    return sessionManager.getGameState(sessionId);
  }

  /**
   * Validate block data
   */
  validateBlockData(blockData) {
    if (!blockData) return false;
    
    // Add more validation rules as needed
    const requiredFields = ['position', 'type'];
    return requiredFields.every(field => field in blockData);
  }
}

// Export singleton instance
export const collaborationService = new CollaborationService();
