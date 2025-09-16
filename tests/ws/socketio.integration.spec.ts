import { vi } from 'vitest';
// Mock pino to avoid Vite resolving issues and to keep logs quiet in tests
vi.mock('pino', () => ({
  default: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
  }),
}));
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prepareTestDatabase } from './setupWs.js';
import prisma from '../../server/config/database.js';
import { startWsServer, connectRealtimeClient, disconnectClient, createSessionToken, type TestIdentity } from '../helpers/wsTestUtils.js';
import type { Socket } from 'socket.io-client';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForEvent<T = any>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for '${event}'`));
    }, timeoutMs);
    const handler = (data: T) => {
      cleanup();
      resolve(data);
    };
    function cleanup() {
      clearTimeout(timer);
      socket.off(event, handler);
    }
    socket.on(event, handler);
  });
}

describe('Socket.IO integration (/realtime)', () => {
  let url: string;
  let closeServer: () => Promise<void>;

  // DB entities
  let owner: any;
  let editor: any;
  let game: any;

  // Clients
  let c1: Socket; // owner
  let c2: Socket; // editor

  beforeAll(async () => {
    prepareTestDatabase();
    const { url: baseUrl, close } = await startWsServer();
    url = baseUrl;
    closeServer = close;

    // Seed DB
    const rnd = Math.random().toString(36).slice(2, 8);
    owner = await prisma.user.create({
      data: {
        email: `owner_${rnd}@test.local`,
        name: 'Owner',
        passwordHash: 'x',
        role: 'USER',
      },
    });
    editor = await prisma.user.create({
      data: {
        email: `editor_${rnd}@test.local`,
        name: 'Editor',
        passwordHash: 'x',
        role: 'USER',
      },
    });

    game = await prisma.game.create({
      data: {
        name: `Game_${rnd}`,
        blocks: '{}',
        ownerId: owner.id,
        published: false,
        visibility: 'PRIVATE',
        mode: 'SANDBOX',
      },
    });

  });

  afterAll(async () => {
    try { if (c1) await disconnectClient(c1); } catch {}
    try { if (c2) await disconnectClient(c2); } catch {}
    try { await prisma.realtimeSession.deleteMany({ where: { gameId: game.id } }); } catch {}
    try { if (game) await prisma.game.delete({ where: { id: game.id } }); } catch {}
    try { if (owner) await prisma.user.delete({ where: { id: owner.id } }); } catch {}
    try { if (editor) await prisma.user.delete({ where: { id: editor.id } }); } catch {}
    if (closeServer) await closeServer();
  });

  beforeEach(async () => {
    // Ensure old clients disconnected
    if (c1 && c1.connected) await disconnectClient(c1);
    if (c2 && c2.connected) await disconnectClient(c2);

    // Fresh session for each test
    const session = await prisma.realtimeSession.create({
      data: {
        gameId: game.id,
        type: 'edit',
        ownerId: owner.id,
        isActive: true,
        maxParticipants: 10,
      },
    });
    await prisma.realtimeParticipant.create({
      data: { sessionId: session.id, userId: owner.id, role: 'OWNER', isOnline: false },
    });
    await prisma.realtimeParticipant.create({
      data: { sessionId: session.id, userId: editor.id, role: 'EDITOR', isOnline: false },
    });

    const id1: TestIdentity = { userId: owner.id, guestId: null, userName: 'Owner', role: 'OWNER', sessionId: session.id };
    const id2: TestIdentity = { userId: editor.id, guestId: null, userName: 'Editor', role: 'EDITOR', sessionId: session.id };
    const token1 = await createSessionToken(id1);
    const token2 = await createSessionToken(id2);

    c1 = await connectRealtimeClient(url, token1);
    await waitForEvent(c1, 'session_joined');
    const participantJoined = waitForEvent(c1, 'participant_joined');
    c2 = await connectRealtimeClient(url, token2);
    await waitForEvent(c2, 'session_joined');
    await participantJoined;
  });

  it('joins session and notifies participants', async () => {
    // c1 and c2 are connected in beforeEach; assert they are connected and in same room by broadcasting ping
    expect(c1.connected).toBe(true);
    expect(c2.connected).toBe(true);
  });

  it('broadcasts chat_message to session', async () => {
    const received = waitForEvent<any>(c2, 'chat_message');
    c1.emit('chat_message', { content: 'Hello world', type: 'text' });
    const msg = await received;
    expect(msg.content).toBe('Hello world');
    expect(msg.type).toBe('text');
    expect(typeof msg.authorName).toBe('string');
  });

  it('processes block_operation and sends ack and broadcast', async () => {
    const ackP = waitForEvent<any>(c1, 'operation_ack');
    const broadcastP = waitForEvent<any>(c2, 'block_operation');
    c1.emit('block_operation', {
      operation: 'add',
      blockId: `b_${Date.now()}`,
      blockData: { type: 'cube', position: { x: 1, y: 2, z: 3 } },
    });
    const ack = await ackP;
    const broadcast = await broadcastP;
    expect(ack).toHaveProperty('operation', 'add');
    expect(broadcast).toHaveProperty('operation', 'add');
    expect(broadcast).toHaveProperty('blockId');
    expect(broadcast.blockData).toMatchObject({ type: 'cube' });
  });

  it('applies rate limiting for chat_message (3 per second)', async () => {
    // Ensure tokens are full
    await sleep(1100);

    let count = 0;
    const handler = () => { count += 1; };
    c2.on('chat_message', handler);

    for (let i = 0; i < 5; i += 1) {
      c1.emit('chat_message', { content: `msg ${i}`, type: 'text' });
    }

    await sleep(300);
    c2.off('chat_message', handler);

    expect(count).toBeLessThanOrEqual(3);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});


