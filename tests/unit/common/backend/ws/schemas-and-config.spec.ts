import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { wsConfig, getConfig } from 'server/websocket/config/websocket.config';
import {
  chatMessageSchema,
  globalChatMessageSchema,
  privateMessageSchema,
  typingSchema,
  selectionChangeSchema,
  blockOperationSchema,
} from 'server/websocket/validation/schemas';

describe('server websocket config and schemas', () => {
  it('getConfig reads nested properties safely', () => {
    expect(getConfig('limits.maxMessageLength.global')).toBe(wsConfig.limits.maxMessageLength.global);
    expect(getConfig('unknown.path')).toBeUndefined();
  });

  it('chatMessageSchema enforces content length and optional type', () => {
    const ok = chatMessageSchema.parse({ content: 'hi' });
    expect(ok.content).toBe('hi');
    expect(() => chatMessageSchema.parse({ content: '' })).toThrow();
  });

  it('global/private message length constraints respect wsConfig', () => {
    const maxGlobal = wsConfig.limits.maxMessageLength.global;
    const maxPrivate = wsConfig.limits.maxMessageLength.private;
    expect(() => globalChatMessageSchema.parse({ content: 'a'.repeat(maxGlobal + 1) })).toThrow(z.ZodError);
    expect(() => privateMessageSchema.parse({ conversationId: 'c', content: 'a'.repeat(maxPrivate + 1) })).toThrow(z.ZodError);
  });

  it('typingSchema, selectionChangeSchema, and blockOperationSchema validate shapes', () => {
    expect(typingSchema.parse({ isTyping: true }).isTyping).toBe(true);
    expect(selectionChangeSchema.parse({ selectedBlocks: [] }).selectedBlocks).toEqual([]);
    const bo = blockOperationSchema.parse({ operation: 'add', blockId: 'b1' });
    expect(bo.operation).toBe('add');
  });
});


