import type { FastifyInstance } from 'fastify';
import { registerChannelRoutes } from './channels.js';
import { registerMessageRoutes } from './messages.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerChannelRoutes(app);
  await registerMessageRoutes(app);
}
