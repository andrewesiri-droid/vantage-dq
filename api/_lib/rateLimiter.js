const store = new Map();

export async function checkRateLimit(userId = 'anonymous') {
  const key = `${userId}:${Math.floor(Date.now() / 60_000)}`;
  const count = (store.get(key) || 0) + 1;
  store.set(key, count);
  if (store.size > 5000) {
    const cutoff = Math.floor(Date.now() / 60_000) - 2;
    for (const [k] of store) {
      if (parseInt(k.split(':')[1] || '0') < cutoff) store.delete(k);
    }
  }
  return count <= 60;
}
