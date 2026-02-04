import { fastify, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import config from 'config';
import { Server as SocketIoServer } from 'socket.io';
import { createLogger } from './utils/logger.js';
import { registerRoutes } from './routes/index.js';
import { attachSocketHandlers } from './ws/socket-handlers.js';

const log = createLogger('modulys-pax-chat-service');

interface ServiceConfig {
  host: string;
  port: number;
}

let app: FastifyInstance;

async function initialize(): Promise<void> {
  const serviceConfig = config.get<ServiceConfig>('service');

  log.info('Initializing Modulys Pax Chat Service...');

  app = fastify({ logger: false, trustProxy: true });

  await app.register(cors, { origin: true, credentials: true });

  await registerRoutes(app);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'modulys-pax-chat-service',
    timestamp: new Date().toISOString(),
  }));

  await app.listen({ host: serviceConfig.host, port: serviceConfig.port });

  const httpServer = app.server;
  if (httpServer) {
    const io = new SocketIoServer(httpServer, {
      path: '/socket.io',
      cors: { origin: true, credentials: true },
    });
    attachSocketHandlers(io);
    log.info('Socket.IO attached at namespace /chat');
  } else {
    log.warn('Could not attach Socket.IO: server not available');
  }

  log.info({ host: serviceConfig.host, port: serviceConfig.port }, 'Modulys Pax Chat Service started');
}

initialize().catch((err) => {
  log.error({ err }, 'Failed to start');
  process.exit(1);
});
