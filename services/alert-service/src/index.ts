import { db } from '../../../packages/db/client';
import { createClient } from 'redis';

// Redis publisher specifically for alerts
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', err => console.error('Redis Alert Publisher Error', err));

async function publishAlert(alertData: any) {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  // Publish to 'system-alerts' channel
  await redisClient.publish('system-alerts', JSON.stringify(alertData));
}

/**
 * Alert Engine
 * Scans the database periodically for anomalies (volume spikes, sentiment crashes).
 */
export async function runAlertEngine() {
  console.log('[Alert Engine] Scanning for critical anomalies...');
  
  try {
    const activeNarratives = await db.narrative.findMany({
      include: {
        signals: {
          orderBy: { timestamp: 'desc' },
          take: 50 // Look at recent volume
        }
      }
    });

    for (const narrative of activeNarratives) {
      // Rule 1: High Volume Spike (e.g. > 20 signals in the last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentSignals = narrative.signals.filter(s => s.timestamp > oneHourAgo);

      if (recentSignals.length >= 20) {
        const alert = {
          type: 'VOLUME_SPIKE',
          narrativeId: narrative.id,
          title: narrative.title,
          message: `Unusual volume detected: ${recentSignals.length} signals in short succession.`,
          timestamp: new Date().toISOString()
        };
        await publishAlert(alert);
      }

      // Rule 2: Critical Sentiment Crash (e.g. sentiment < -2.0)
      if (narrative.sentiment <= -2.0) {
        const alert = {
          type: 'CRITICAL_SENTIMENT',
          narrativeId: narrative.id,
          title: narrative.title,
          message: `Critical negative sentiment shift: ${narrative.sentiment.toFixed(2)}.`,
          timestamp: new Date().toISOString()
        };
        await publishAlert(alert);
      }
    }
  } catch (error) {
    console.error('[Alert Engine] Error during scan:', error);
  }
}

// Start Alert Engine
export async function start() {
  await redisClient.connect();
  console.log('🚨 Alert Engine Online.');
  await runAlertEngine();
  
  if (process.env.RUN_ONCE !== 'true') {
    setInterval(runAlertEngine, 60000); // Scan every minute
  } else {
    // Attempt graceful shutdown of publisher in single-shot mode
    try { await redisClient.quit(); } catch(e) {}
  }
}

// Only auto-start if not running as a single-shot script runner
if (process.env.RUN_ONCE !== 'true') {
  start();
}