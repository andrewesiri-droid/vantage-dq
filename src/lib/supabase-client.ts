/**
 * Supabase client for Vantage DQ
 * Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from environment
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Vantage DQ] Supabase env vars missing — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel environment variables. Collaboration, auth, and real-time sync are disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseReady = !!supabase;

// Generate a random 6-character workshop code like "DQ-7843"
export function generateInviteCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `DQ-${num}`;
}

// Generate a secure random token for invite links
export function generateInviteToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Create a new session in Supabase, fall back to localStorage
export async function createSession(name: string, ownerEmail?: string, userId?: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const suffix = Date.now().toString(36);

  // If no supabase or no authenticated user — use localStorage with local- prefix
  if (!supabase || !userId) {
    const { initializeEmptySession } = await import('@/lib/demoData');
    const localSlug = 'local-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36);
    initializeEmptySession(name, localSlug);
    return localSlug;
  }

  const slug = base + '-' + suffix;
  const { data, error } = await supabase.from('dq_sessions').insert({
    slug,
    name,
    decision_statement: '',
    context: '',
    status: 'draft',
    owner_email: ownerEmail || '',
    created_by: userId,
    dq_scores: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select('slug').single();

  if (error) {
    console.error('[createSession] Supabase error:', error);
    const { initializeEmptySession } = await import('@/lib/demoData');
    return initializeEmptySession(name);
  }

  return data.slug;
}
