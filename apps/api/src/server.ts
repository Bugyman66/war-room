// Simple Fastify API server for War Room

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { db } from '../../../packages/db/client';
import { Server } from 'socket.io';
import { createClient } from 'redis';

(async () => {
  const fastify = Fastify({ logger: true });

  // Enable CORS for frontend
  await fastify.register(cors, { origin: true });

  // Initialize Socket.io on Fastify's raw HTTP server
  const io = new Server(fastify.server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // Set up Redis Pub/Sub for alerts (Event-driven, no while-loop)
  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => fastify.log.error(`Redis Subscriber Error: ${err}`));

  try {
    await redisClient.connect();
    fastify.log.info('Connected to Redis for system-alerts');
    
    await redisClient.subscribe('system-alerts', (message) => {
      try {
        const alertData = JSON.parse(message);
        // Push alert down to all connected frontend clients instantly
        io.emit('alert', alertData);
      } catch (err) {
        fastify.log.error('Failed to parse incoming alert from Redis');
      }
    });
  } catch (err) {
    fastify.log.error(`Redis connection failed: ${err}`);
  }

  // GET /api/narratives - returns all narratives with recent signals
  fastify.get('/api/narratives', async (request, reply) => {
    try {
      const narratives = await db.narrative.findMany({
        include: {
          signals: {
            orderBy: { timestamp: 'desc' },
            take: 10
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
      reply.send(narratives);
    } catch (err) {
      reply.status(500).send({ error: 'Failed to fetch narratives', details: String(err) });
    }
  });

  // Health check
  fastify.get('/api/health', async (request, reply) => {
    reply.send({ status: 'ok' });
  });

  // Start server on port 4000
  fastify.listen({ port: 4000, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    fastify.log.info(`API server listening at ${address}`);
  });
})();
