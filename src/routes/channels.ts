import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantDb } from '../db/tenant-db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('routes:channels');

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'] as string;
  if (!tenantId) {
    throw new Error('Missing x-tenant-id header');
  }
  return tenantId;
}

export async function registerChannelRoutes(app: FastifyInstance): Promise<void> {
  // Listar canais
  app.get('/channels', async (request, reply) => {
    const tenantId = getTenantId(request);
    try {
      const channels = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT id, name, description, is_private, created_by_employee_id, created_at, updated_at
           FROM chat_channels ORDER BY created_at DESC`,
        );
        return res.rows;
      });
      return reply.code(200).send({ channels, count: channels.length });
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'List channels failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  // Criar canal (banco já é da empresa, não precisa de company_id)
  app.post<{
    Body: { name: string; description?: string; is_private?: boolean; created_by_employee_id: string };
  }>('/channels', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { name, description, is_private, created_by_employee_id } = request.body || {};
    if (!name || !created_by_employee_id) {
      return reply.code(400).send({ error: 'name and created_by_employee_id are required' });
    }
    try {
      const channel = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `INSERT INTO chat_channels (name, description, is_private, created_by_employee_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, description, is_private, created_by_employee_id, created_at, updated_at`,
          [name, description || null, is_private ?? false, created_by_employee_id],
        );
        return res.rows[0];
      });
      return reply.code(201).send(channel);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Create channel failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  // Obter um canal
  app.get<{ Params: { channelId: string } }>('/channels/:channelId', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { channelId } = request.params;
    try {
      const channel = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT id, name, description, is_private, created_by_employee_id, created_at, updated_at
           FROM chat_channels WHERE id = $1`,
          [channelId],
        );
        return res.rows[0];
      });
      if (!channel) return reply.code(404).send({ error: 'Channel not found' });
      return reply.code(200).send(channel);
    } catch (e: any) {
      log.error({ error: e, tenantId, channelId }, 'Get channel failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  // Listar membros do canal
  app.get<{ Params: { channelId: string } }>('/channels/:channelId/members', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { channelId } = request.params;
    try {
      const members = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT m.id, m.channel_id, m.employee_id, m.role, m.joined_at, e.name as employee_name, e.email as employee_email
           FROM chat_channel_members m
           JOIN employees e ON e.id = m.employee_id
           WHERE m.channel_id = $1 ORDER BY m.joined_at`,
          [channelId],
        );
        return res.rows;
      });
      return reply.code(200).send({ members, count: members.length });
    } catch (e: any) {
      log.error({ error: e, tenantId, channelId }, 'List members failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  // Adicionar membro ao canal
  app.post<{
    Params: { channelId: string };
    Body: { employee_id: string; role?: string };
  }>('/channels/:channelId/members', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { channelId } = request.params;
    const { employee_id, role = 'member' } = request.body || {};
    if (!employee_id) {
      return reply.code(400).send({ error: 'employee_id is required' });
    }
    const validRole = ['owner', 'admin', 'member'].includes(role) ? role : 'member';
    try {
      const member = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `INSERT INTO chat_channel_members (channel_id, employee_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (channel_id, employee_id) DO UPDATE SET role = $3
           RETURNING id, channel_id, employee_id, role, joined_at`,
          [channelId, employee_id, validRole],
        );
        return res.rows[0];
      });
      return reply.code(201).send(member);
    } catch (e: any) {
      log.error({ error: e, tenantId, channelId }, 'Add member failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  log.info('Channel routes registered');
}
