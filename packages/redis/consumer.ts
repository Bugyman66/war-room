// Redis Stream consumer for signals
import { createClient } from 'redis';
import { Signal } from '../types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const STREAM_KEY = 'signals';
const GROUP_NAME = 'signal_consumers';
const CONSUMER_NAME = process.env.CONSUMER_NAME || `consumer-${Math.random().toString(36).slice(2, 8)}`;

const client = createClient({ url: REDIS_URL });

client.on('error', (err) => console.error('Redis Client Error', err));

async function ensureGroup() {
  if (!client.isOpen) {
    await client.connect();
  }
  try {
    await client.xGroupCreate(STREAM_KEY, GROUP_NAME, '0', { MKSTREAM: true });
  } catch (err: any) {
    if (!String(err.message).includes('BUSYGROUP')) throw err;
  }
}

export async function consumeSignals(onSignal: (signal: Signal) => Promise<void>) {
  await ensureGroup();
  while (true) {
    const res = await client.xReadGroup(GROUP_NAME, CONSUMER_NAME, [{ key: STREAM_KEY, id: '>' }], { COUNT: 10, BLOCK: 5000 });
    if (res) {
      await processMessages(res[0].messages, onSignal);
    }
  }
}

export async function consumeSignalsOnce(onSignal: (signal: Signal) => Promise<void>) {
  await ensureGroup();
  let keepReading = true;
  while (keepReading) {
    const res = await client.xReadGroup(GROUP_NAME, CONSUMER_NAME, [{ key: STREAM_KEY, id: '>' }], { COUNT: 10, BLOCK: 1000 });
    if (res && res.length > 0 && res[0].messages.length > 0) {
      await processMessages(res[0].messages, onSignal);
    } else {
      keepReading = false;
    }
  }
  // Try to safely quit the redis client
  try { await client.quit(); } catch (e) {}
}

// Replays signals from a specific ID (default '0-0' for all) bypassing the consumer group
export async function replaySignals(onSignal: (signal: Signal) => Promise<void>, startId = '0-0') {
  if (!client.isOpen) {
    await client.connect();
  }
  let currentId = startId;
  while (true) {
    const res = await client.xRead([{ key: STREAM_KEY, id: currentId }], { COUNT: 100 });
    if (!res || res.length === 0 || res[0].messages.length === 0) {
      break; // No more messages to replay
    }
    const messages = res[0].messages;
    await processMessages(messages, onSignal, false);
    currentId = messages[messages.length - 1].id;
  }
  await client.disconnect();
}

async function processMessages(messages: any[], onSignal: (signal: Signal) => Promise<void>, acknowledge = true) {
  for (const message of messages) {
    const data = message.message;
    const signal: Signal = {
      id: data.id,
      title: data.title,
      content: data.content,
      source: data.source,
      timestamp: data.timestamp,
      sentiment: Number(data.sentiment),
      type: data.type as Signal['type'],
      raw: data.raw ? JSON.parse(data.raw) : undefined
    };
    await onSignal(signal);
    if (acknowledge) {
      await client.xAck(STREAM_KEY, GROUP_NAME, message.id);
    }
  }
}
