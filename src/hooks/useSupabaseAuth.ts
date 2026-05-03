/**
 * useSupabaseAuth — Vantage DQ Auth Hook
 *
 * Wraps Supabase Auth with DQ-specific user state.
 * Supports: magic link sign-in, sign-out, session persistence.
 * Falls back gracefully to demo mode if Supabase not configured.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseReady } from '@/lib/supabase-client';

export interface VantageUser {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  isGuest: boolean;
  role: 'owner' | 'facilitator' | 'participant' | 'observer';
}

function makeInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '??';
}

function makeDisplayName(email: string): string {
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<VantageUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert Supabase user to VantageUser
  const toVantageUser = (supaUser: any): VantageUser => {
    const email = supaUser.email || '';
    const displayName = supaUser.user_metadata?.display_name
      || supaUser.user_metadata?.full_name
      || makeDisplayName(email);
    return {
      id: supaUser.id,
      email,
      displayName,
      initials: makeInitials(displayName),
      isGuest: false,
      role: 'owner',
    };
  };

  useEffect(() => {
    if (!isSupabaseReady || !supabase) {
      // No Supabase — check for demo user
      try {
        const demoUser = JSON.parse(localStorage.getItem('vantage_dq_demo_user') || 'null');
        if (demoUser) {
          setUser({
            id: demoUser.id || 'demo-user-1',
            email: demoUser.email || 'demo@vantage.dq',
            displayName: demoUser.name || 'Demo User',
            initials: makeInitials(demoUser.name || 'Demo User'),
            isGuest: false,
            role: 'owner',
          });
        }
      } catch { /**/ }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(toVantageUser(session.user));
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(toVantageUser(session.user));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── SIGN IN WITH MAGIC LINK ─────────────────────────────────────────────────
  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (err) { setError(err.message); throw err; }
  }, []);

  // ── SIGN IN WITH GOOGLE ─────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase not configured');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) { setError(err.message); throw err; }
  }, []);

  // ── SIGN OUT ────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (!supabase) {
      // Demo mode sign out
      localStorage.removeItem('vantage_dq_demo_mode');
      localStorage.removeItem('vantage_dq_demo_user');
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // ── UPDATE DISPLAY NAME ─────────────────────────────────────────────────────
  const updateDisplayName = useCallback(async (name: string) => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    if (!err) {
      setUser(prev => prev ? { ...prev, displayName: name, initials: makeInitials(name) } : null);
    }
  }, [user]);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signInWithMagicLink,
    signInWithGoogle,
    signOut,
    updateDisplayName,
  };
}
