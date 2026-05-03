/**
 * Supabase client for Vantage DQ
 * Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from environment
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars — collaboration features disabled');
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
