import type { FastifyInstance } from 'fastify';
import { withTenantDb } from '../db/tenant-db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('routes:messages');

function getTenantId(request: any): string {
  const tenantId = request.headers['x-tenant-id'] as string;
  if (!tenantId) throw new Error('Missing x-tenant-id header');
  return tenantId;
}

export async function registerMessageRoutes(app: FastifyInstance): Promise<void> {
  // Listar mensagens do canal
  app.get<{
    Params: { channelId: string };
    Querystring: { limit?: string; offset?: string };
  }>('/channels/:channelId/messages', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { channelId } = request.params;
    const limit = Math.min(parseInt(request.query?.limit || '50') || 50, 100);
    const offset = parseInt(request.query?.offset || '0') || 0;
    try {
      const messages = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT m.id, m.channel_id, m.employee_id, m.content, m.created_at, m.updated_at,
                  e.name as employee_name, e.email as employee_email
           FROM chat_messages m
           JOIN employees e ON e.id = m.employee_id
           WHERE m.channel_id = $1
           ORDER BY m.created_at DESC
           LIMIT $2 OFFSET $3`,
          [channelId, limit, offset],
        );
        return res.rows;
      });
      return reply.code(200).send({ messages, count: messages.length });
    } catch (e: any) {
      log.error({ error: e, tenantId, channelId }, 'List messages failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  // Enviar mensagem
  app.post<{
    Params: { channelId: string };
    Body: { employee_id: string; content: string };
  }>('/channels/:channelId/messages', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { channelId } = request.params;
    const { employee_id, content } = request.body || {};
    if (!employee_id || content == null || content === '') {
      return reply.code(400).send({ error: 'employee_id and content are required' });
    }
    try {
      const message = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `INSERT INTO chat_messages (channel_id, employee_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, channel_id, employee_id, content, created_at, updated_at`,
          [channelId, employee_id, content],
        );
        return res.rows[0];
      });
      return reply.code(201).send(message);
    } catch (e: any) {
      log.error({ error: e, tenantId, channelId }, 'Send message failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  log.info('Message routes registered');
}
