import type { Server } from 'socket.io';
import { authMiddleware, type TenantSocketPayload } from './auth.js';
import { addPresence, removePresence, getOnlineEmployees } from './presence.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ws:handlers');

type SocketWithPayload = import('socket.io').Socket & { tenantPayload: TenantSocketPayload };

let ioServer: Server | null = null;

export function getIo(): Server | null {
  return ioServer;
}

/**
 * Emite evento de nova mensagem para todos os clientes inscritos no canal.
 * Chamado pela rota POST /channels/:channelId/messages após persistir a mensagem.
 */
export function broadcastNewMessage(
  tenantId: string,
  channelId: string,
  payload: {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    type: string;
    content?: string;
    attachments: Array<{ id: string; fileName: string; filePath: string; fileSize?: number; mimeType?: string }>;
    createdAt: string;
  },
): void {
  if (!ioServer) return;
  const room = `tenant:${tenantId}:channel:${channelId}`;
  ioServer.of('/chat').to(room).emit('message:new', payload);
  log.debug({ tenantId, channelId, messageId: payload.id }, 'Broadcast message:new');
}

export function attachSocketHandlers(io: Server): void {
  ioServer = io;
  const chatNs = io.of('/chat');

  chatNs.use(authMiddleware);

  chatNs.on('connection', (socket) => {
    const s = socket as SocketWithPayload;
    const { tenantId, employeeId, name } = s.tenantPayload;
    const tenantRoom = `tenant:${tenantId}`;
    socket.join(tenantRoom);

    addPresence(tenantId, employeeId, socket.id, name);

    chatNs.to(tenantRoom).emit('user:status', {
      userId: employeeId,
      status: 'online',
      userName: name,
      timestamp: new Date().toISOString(),
    });
    log.info({ socketId: s.id, tenantId, employeeId }, 'Socket connected');

    s.on('join:conversation', (conversationId: string) => {
      const room = `tenant:${tenantId}:channel:${conversationId}`;
      s.join(room);
      log.debug({ socketId: s.id, conversationId }, 'join:conversation');
    });

    s.on('leave:conversation', (conversationId: string) => {
      const room = `tenant:${tenantId}:channel:${conversationId}`;
      s.leave(room);
      log.debug({ socketId: s.id, conversationId }, 'leave:conversation');
    });

    s.on('disconnect', (reason) => {
      removePresence(tenantId, employeeId, s.id);
      chatNs.to(tenantRoom).emit('user:status', {
        userId: employeeId,
        status: 'offline',
        userName: name,
        timestamp: new Date().toISOString(),
      });
      log.info({ socketId: s.id, tenantId, employeeId, reason }, 'Socket disconnected');
    });
  });
}

export { getOnlineEmployees };
