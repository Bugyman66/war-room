// Simple Fastify API server for War Room

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { db } from '../../../packages/db/client';
import {
  getPromptTemplate,
  getNarrativeRules,
  setConfig,
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_NARRATIVE_RULES,
  NarrativeRule,
} from '../../../packages/db/config';
import { Server } from 'socket.io';
import { createClient } from 'redis';

(async () => {
  const fastify = Fastify({ logger: true });

  // Enable CORS for frontend, specifically allowing the custom token header and PUT requests
  await fastify.register(cors, { 
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-token', 'Authorization']
  });

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

  // ----- Admin config: AI prompt + narrative rules (DB-backed, editable live) -----

  // Shared-secret guard for write routes. Set ADMIN_TOKEN in .env; clients send
  // it as `x-admin-token`. If ADMIN_TOKEN is unset we refuse writes outright so
  // we never accidentally ship an open config editor.
  const requireAdmin = (request: any, reply: any): boolean => {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      reply.status(503).send({ error: 'ADMIN_TOKEN not configured on server; writes disabled' });
      return false;
    }
    if (request.headers['x-admin-token'] !== expected) {
      reply.status(401).send({ error: 'Invalid or missing x-admin-token' });
      return false;
    }
    return true;
  };

  fastify.get('/api/config', async (request, reply) => {
    try {
      const [promptTemplate, narrativeRules] = await Promise.all([
        getPromptTemplate(),
        getNarrativeRules(),
      ]);
      reply.send({
        promptTemplate,
        narrativeRules,
        defaults: { promptTemplate: DEFAULT_PROMPT_TEMPLATE, narrativeRules: DEFAULT_NARRATIVE_RULES },
      });
    } catch (err) {
      reply.status(500).send({ error: 'Failed to load config', details: String(err) });
    }
  });

  fastify.put<{ Body: { promptTemplate?: string } }>('/api/config/prompt', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { promptTemplate } = request.body || {};
    if (typeof promptTemplate !== 'string' || promptTemplate.trim().length === 0) {
      return reply.status(400).send({ error: 'promptTemplate must be a non-empty string' });
    }
    if (!promptTemplate.includes('{{title}}') || !promptTemplate.includes('{{signals}}')) {
      return reply.status(400).send({ error: 'promptTemplate must contain {{title}} and {{signals}} placeholders' });
    }
    try {
      await setConfig('ai_prompt_template', promptTemplate);
      reply.send({ ok: true });
    } catch (err) {
      reply.status(500).send({ error: 'Failed to save prompt', details: String(err) });
    }
  });

  fastify.put<{ Body: { narrativeRules?: NarrativeRule[] } }>('/api/config/rules', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { narrativeRules } = request.body || {};
    if (!Array.isArray(narrativeRules) || narrativeRules.length === 0) {
      return reply.status(400).send({ error: 'narrativeRules must be a non-empty array' });
    }
    for (const r of narrativeRules) {
      if (!r || typeof r.id !== 'string' || typeof r.title !== 'string' || !Array.isArray(r.keywords)) {
        return reply.status(400).send({ error: 'each rule needs string id, string title, and keywords array' });
      }
    }
    try {
      await setConfig('narrative_rules', JSON.stringify(narrativeRules));
      reply.send({ ok: true });
    } catch (err) {
      reply.status(500).send({ error: 'Failed to save rules', details: String(err) });
    }
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
