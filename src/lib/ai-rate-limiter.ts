/**
 * AI Call Rate Limiter — Supabase-backed for authenticated users, localStorage for demo
 */
import { supabase } from '@/lib/supabase-client';

/**
 * AI Call Rate Limiter
 * Tracks per-session AI calls and enforces soft/hard limits.
 */
const RATE_KEY = 'vdq_ai_calls';
const SOFT_LIMIT = 50;
const HARD_LIMIT = 100;

export async function trackAICallServer(sessionId?: number, userId?: string): Promise<{ allowed: boolean; count: number }> {
  if (!supabase || !userId || !sessionId) return { allowed: true, count: 0 };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('session_metadata').select('ai_calls').eq('session_id', sessionId).eq('date', today).single();
    const count = (data?.ai_calls || 0) + 1;
    await supabase.from('session_metadata').upsert({ session_id: sessionId, date: today, ai_calls: count }, { onConflict: 'session_id,date' });
    return { allowed: count <= 100, count };
  } catch { return { allowed: true, count: 0 }; }
}

export function trackAICall(sessionId?: number): { allowed: boolean; count: number; remaining: number; warning: string | null } {
  try {
    const key = RATE_KEY + '_' + (sessionId || 'demo');
    const stored = JSON.parse(localStorage.getItem(key) || '{"count":0,"resetAt":0}');
    const now = Date.now();
    // Reset every 24 hours
    if (now > stored.resetAt) {
      stored.count = 0;
      stored.resetAt = now + 24 * 60 * 60 * 1000;
    }
    stored.count++;
    localStorage.setItem(key, JSON.stringify(stored));
    const remaining = HARD_LIMIT - stored.count;
    const allowed = stored.count <= HARD_LIMIT;
    const warning = stored.count >= HARD_LIMIT ? 'AI call limit reached — resets in 24 hours'
      : stored.count >= SOFT_LIMIT ? `${remaining} AI calls remaining today`
      : null;
    return { allowed, count: stored.count, remaining, warning };
  } catch {
    return { allowed: true, count: 0, remaining: HARD_LIMIT, warning: null };
  }
}

export function getAICallCount(sessionId?: number): number {
  try {
    const key = RATE_KEY + '_' + (sessionId || 'demo');
    const stored = JSON.parse(localStorage.getItem(key) || '{"count":0}');
    return stored.count || 0;
  } catch { return 0; }
}
