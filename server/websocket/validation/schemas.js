import { z } from 'zod';
import { wsConfig } from '../config/websocket.config.js';

export const presenceUpdateSchema = z.object({}).passthrough();

export const chatMessageSchema = z.object({
  content: z.string().min(1).max(wsConfig.limits.maxMessageLength.session),
  type: z.string().max(16).optional()
});

export const typingSchema = z.object({
  isTyping: z.boolean()
});

export const globalChatMessageSchema = z.object({
  content: z.string().min(1).max(wsConfig.limits.maxMessageLength.global)
});

export const privateMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(wsConfig.limits.maxMessageLength.private)
});

export const markMessageReadSchema = z.object({
  messageId: z.string().min(1)
});

export const blockOperationSchema = z.object({
  operation: z.string().min(1).max(32),
  blockId: z.string().min(1).max(64),
  blockData: z.unknown().optional()
});

export const selectionChangeSchema = z.object({
  selectedBlocks: z.array(z.string()).max(200)
});

export const playerInputSchema = z.object({
  input: z.object({}).passthrough()
});

export const gameEventSchema = z.object({
  type: z.string().min(1).max(32),
  eventData: z.unknown().optional()
});

export const friendRequestSentSchema = z.object({
  receiverId: z.string().min(1)
});

export const friendRequestAcceptedSchema = z.object({
  senderId: z.string().min(1)
});

export const friendRemovedSchema = z.object({
  friendId: z.string().min(1)
});


