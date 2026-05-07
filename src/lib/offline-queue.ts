/**
 * Offline Queue — Vantage DQ
 * Queues DB operations when offline and replays them when connection restores.
 */

const QUEUE_KEY = 'vdq_offline_queue';

interface QueuedOp {
  id: string;
  table: string;
  op: 'insert' | 'update' | 'delete' | 'upsert';
  data: any;
  match?: Record<string, any>;
  timestamp: number;
}

function getQueue(): QueuedOp[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}

function saveQueue(q: QueuedOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function enqueue(op: Omit<QueuedOp, 'id' | 'timestamp'>) {
  const q = getQueue();
  q.push({ ...op, id: Date.now().toString(36), timestamp: Date.now() });
  saveQueue(q);
}

export function queueSize() {
  return getQueue().length;
}

export async function flushQueue(db: any): Promise<number> {
  const q = getQueue();
  if (!q.length) return 0;
  let flushed = 0;
  const failed: QueuedOp[] = [];
  for (const op of q) {
    try {
      if (op.op === 'insert') await db.from(op.table).insert(op.data);
      else if (op.op === 'update') await db.from(op.table).update(op.data).match(op.match || {});
      else if (op.op === 'delete') await db.from(op.table).delete().match(op.match || {});
      else if (op.op === 'upsert') await db.from(op.table).upsert(op.data);
      flushed++;
    } catch { failed.push(op); }
  }
  saveQueue(failed);
  return flushed;
}

export function useOnlineStatus() {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}
