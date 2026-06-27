// Redis Stream publisher for signals
import { createClient } from 'redis';
import { Signal } from '../../packages/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const STREAM_KEY = 'signals';

let isConnected = false;
const client = createClient({ url: REDIS_URL });
client.on('error', (err) => console.error('Redis Client Error', err));

let connectPromise: Promise<any> | null = null;
async function ensureConnected() {
  if (!client.isOpen) {
    if (!connectPromise) {
      connectPromise = client.connect().then(() => {
        connectPromise = null;
      });
    }
    await connectPromise;
  }
}

export async function publishSignal(signal: Signal) {
  await ensureConnected();
  await client.xAdd(
    STREAM_KEY,
    '*',
    Object.entries(signal).reduce((acc, [k, v]) => {
      acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return acc;
    }, {} as Record<string, string>)
  );
}
