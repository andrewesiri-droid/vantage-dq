/**
 * Simple in-memory rate limiter for serverless
 * In production: replace with Redis / Upstash
 */

const store = new Map();

const LIMITS = {
  free:       { rpm: 10,  tpm: 50_000  },
  pro:        { rpm: 30,  tpm: 200_000 },
  enterprise: { rpm: 100, tpm: 1_000_000 },
};

export async function checkRateLimit(userId = 'anonymous', tier = 'pro') {
  const limit = LIMITS[tier] || LIMITS.pro;
  const key   = `${userId}:${Math.floor(Date.now() / 60_000)}`; // per-minute bucket
  const count = (store.get(key) || 0) + 1;
  store.set(key, count);

  // Clean old keys
  if (store.size > 10_000) {
    const cutoff = Math.floor(Date.now() / 60_000) - 2;
    for (const [k] of store) {
      const ts = parseInt(k.split(':')[1]);
      if (ts < cutoff) store.delete(k);
    }
  }

  return count <= limit.rpm;
}
