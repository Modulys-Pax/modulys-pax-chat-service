import type { FastifyInstance } from 'fastify';
import { registerChannelRoutes } from './channels.js';
import { registerMessageRoutes } from './messages.js';
import { registerCompatibilityRoutes } from './compatibility.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerCompatibilityRoutes(app);
  await registerChannelRoutes(app);
  await registerMessageRoutes(app);
}
