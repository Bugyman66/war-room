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
      connectPromise = client.connect()
        .then(() => {
          connectPromise = null;
        })
        .catch((err) => {
          connectPromise = null;
          throw err;
        });
    }
    await connectPromise;
  }
}

// Quota guard for paid APIs. Atomically claims the next poll slot for `source`
// (SET NX with expiry), so a source runs at most once per interval even across
// restarts. Returns false if the source already ran within the interval.
export async function claimPollSlot(source: string, intervalMs: number): Promise<boolean> {
  await ensureConnected();
  const res = await client.set(`ingest:lastrun:${source}`, new Date().toISOString(), { NX: true, PX: intervalMs });
  return res === 'OK';
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
