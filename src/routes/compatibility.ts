import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantDb } from '../db/tenant-db.js';
import { getOnlineEmployees } from '../ws/socket-handlers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('routes:compatibility');

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'] as string;
  if (!tenantId) throw new Error('Missing x-tenant-id header');
  return tenantId;
}

/**
 * Rotas de compatibilidade com o frontend Spolier (conversations, users, unread-count).
 * O chat real é baseado em canais; aqui expomos formato esperado pelo frontend.
 * WebSocket/real-time não está implementado.
 */
export async function registerCompatibilityRoutes(app: FastifyInstance): Promise<void> {
  // GET /unread-count - frontend espera { count: number }
  app.get('/unread-count', async (request, reply) => {
    getTenantId(request);
    return reply.code(200).send({ count: 0 });
  });

  // GET /conversations - mapeia canais para o formato ConversationList
  app.get<{ Querystring: { search?: string } }>('/conversations', async (request, reply) => {
    const tenantId = getTenantId(request);
    const search = (request.query as { search?: string })?.search;
    try {
      const data = await withTenantDb(tenantId, async (client) => {
        let query = `
          SELECT c.id, c.name, c.description, c.is_private, c.created_by_employee_id, c.created_at, c.updated_at
          FROM chat_channels c
        `;
        const params: string[] = [];
        if (search) {
          query += ` WHERE c.name ILIKE $1 OR c.description ILIKE $1`;
          params.push(`%${search}%`);
        }
        query += ` ORDER BY c.updated_at DESC`;
        const res = await client.query(query, params);
        const channels = res.rows;
        const conversations = channels.map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          isGroup: true,
          participants: [],
          unreadCount: 0,
          createdAt: ch.created_at,
          updatedAt: ch.updated_at,
        }));
        return { data: conversations, total: conversations.length };
      });
      return reply.code(200).send(data);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'List conversations failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  // GET /users - lista colaboradores para o frontend (usuários disponíveis para conversa)
  app.get<{ Querystring: { search?: string } }>('/users', async (request, reply) => {
    const tenantId = getTenantId(request);
    const search = (request.query as { search?: string })?.search;
    try {
      const users = await withTenantDb(tenantId, async (client) => {
        let query = `
          SELECT id, name, email FROM employees WHERE is_active = true
        `;
        const params: string[] = [];
        if (search) {
          query += ` AND (name ILIKE $1 OR email ILIKE $1)`;
          params.push(`%${search}%`);
        }
        query += ` ORDER BY name LIMIT 100`;
        const res = await client.query(query, params);
        return res.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          status: 'offline' as const,
        }));
      });
      return reply.code(200).send(users);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'List users failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  // GET /users/status - stub (sem presença em tempo real)
  app.get<{ Querystring: { userIds: string } }>('/users/status', async (request, reply) => {
    getTenantId(request);
    const userIds = (request.query as { userIds?: string })?.userIds?.split(',').filter(Boolean) || [];
    const status: Record<string, 'online' | 'away' | 'offline'> = {};
    userIds.forEach((id) => (status[id] = 'offline'));
    return reply.code(200).send(status);
  });

  // GET /users/online - usuários conectados via WebSocket (presença em tempo real)
  app.get('/users/online', async (request, reply) => {
    const tenantId = getTenantId(request);
    const online = getOnlineEmployees(tenantId);
    return reply.code(200).send(online);
  });

  log.info('Compatibility routes registered (unread-count, conversations, users)');
}
