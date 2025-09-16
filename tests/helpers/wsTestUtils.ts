import { createServer } from 'http';
import { io as Client, Socket } from 'socket.io-client';
import type { Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';

type StartServerResult = {
  httpServer: HttpServer;
  address: AddressInfo;
  close: () => Promise<void>;
  url: string;
};

export async function startWsServer(): Promise<StartServerResult> {
  const { createWebSocketServer } = await import('../../server/websocket.js');
  const httpServer = createServer();
  const io = createWebSocketServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });

  const address = httpServer.address() as AddressInfo;
  const url = `http://localhost:${address.port}`;

  async function close() {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  return { httpServer, address, close, url };
}

export type TestIdentity = {
  userId: string | null;
  guestId: string | null;
  userName: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER' | 'PLAYER';
  sessionId: string;
  isGuest?: boolean;
  guestName?: string;
};

export async function createSessionToken(identity: TestIdentity) {
  const { generateSessionToken } = await import('../../server/websocket.js');
  const { userId, sessionId, role, isGuest, guestName } = identity;
  const uid = identity.isGuest ? identity.guestId! : (userId as string);
  return generateSessionToken(uid, sessionId, role, {
    isGuest: !!identity.isGuest,
    guestName: identity.guestName,
  });
}

export function connectRealtimeClient(baseUrl: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = Client(`${baseUrl}/realtime`, {
      path: '/socket.io/',
      transports: ['websocket'],
      auth: { token },
      forceNew: true,
      reconnection: false,
      timeout: 5000,
    });

    const onError = (err: any) => {
      cleanup();
      reject(err);
    };
    const onConnectError = (err: any) => {
      cleanup();
      reject(err);
    };
    const onConnect = () => {
      cleanup();
      resolve(socket);
    };

    function cleanup() {
      socket.off('error', onError);
      socket.off('connect_error', onConnectError);
      socket.off('connect', onConnect);
    }

    socket.on('error', onError);
    socket.on('connect_error', onConnectError);
    socket.on('connect', onConnect);
  });
}

export async function disconnectClient(socket: Socket) {
  await new Promise<void>((resolve) => {
    socket.once('disconnect', () => resolve());
    socket.disconnect();
  });
}


