import jwt from 'jsonwebtoken';
import config from 'config';
import type { Socket } from 'socket.io';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ws:auth');

export interface TenantSocketPayload {
  tenantId: string;
  employeeId: string;
  name: string;
  email: string;
}

const secret = config.get<string>('tenantJwt.secret');

export function verifyToken(token: string | undefined): TenantSocketPayload | null {
  if (!token || !secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as {
      sub: string;
      tenantId: string;
      email?: string;
      name?: string;
    };
    return {
      tenantId: decoded.tenantId,
      employeeId: decoded.sub,
      name: decoded.name ?? '',
      email: decoded.email ?? '',
    };
  } catch {
    return null;
  }
}

export function authMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token =
    (socket.handshake.auth as { token?: string })?.token ||
    (socket.handshake.query as { token?: string })?.token;
  const payload = verifyToken(token);
  if (!payload) {
    log.warn({ socketId: socket.id }, 'WebSocket connection rejected: invalid or missing token');
    next(new Error('Unauthorized'));
    return;
  }
  (socket as Socket & { tenantPayload: TenantSocketPayload }).tenantPayload = payload;
  next();
}
