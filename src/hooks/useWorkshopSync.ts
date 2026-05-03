/**
 * useWorkshopSync — Vantage DQ Phase 3
 *
 * Dual-mode real-time sync for Workshop Mode:
 * - PRIMARY: Supabase Realtime (workshop_contributions table + Broadcast channel)
 * - FALLBACK: localStorage + storage events (same device only)
 *
 * What syncs:
 * 1. Phase changes (facilitator advances → all participants update)
 * 2. Notes/contributions (anyone submits → everyone sees instantly)
 * 3. Votes (thumbs up → live count update for all)
 * 4. Tensions (AI detects → shows on projector)
 * 5. Facilitator log (D/T entries → workshop record)
 * 6. Presence (who is in the room right now)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseReady } from '@/lib/supabase-client';

// ── TYPES ─────────────────────────────────────────────────────────────────────
export interface WorkshopNote {
  id: string;
  text: string;
  author: string;
  authorId: string;
  phase: string;
  votes: number;
  isHighlighted: boolean;
  isAnonymous: boolean;
  createdAt: number;
}

export interface WorkshopState {
  phaseIdx: number;
  phase: any; // Phase object
  notes: WorkshopNote[];
  tensions: any[];
  prompt?: string;
  timerSeconds?: number;
  isLocked: boolean; // facilitator can lock contributions
  timestamp: number;
}

export interface WorkshopPresence {
  userId: string;
  displayName: string;
  role: 'facilitator' | 'participant' | 'observer';
  currentPhase: number;
  joinedAt: number;
}

interface UseWorkshopSyncOptions {
  sessionId: number;
  role: 'facilitator' | 'participant' | 'observer';
  displayName: string;
  userId?: string;
}

// ── HOOK ──────────────────────────────────────────────────────────────────────
export function useWorkshopSync({ sessionId, role, displayName, userId }: UseWorkshopSyncOptions) {
  const [notes, setNotes] = useState<WorkshopNote[]>([]);
  const [presence, setPresence] = useState<WorkshopPresence[]>([]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const myId = userId || `anon_${Math.random().toString(36).slice(2, 9)}`;

  // ── SETUP SUPABASE REALTIME ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady || !supabase) {
      // localStorage fallback — listen for storage events from same device
      const handleStorage = () => {
        try {
          const raw = localStorage.getItem(`vdq_workshop_${sessionId}`);
          if (!raw) return;
          const state: WorkshopState = JSON.parse(raw);
          setNotes(state.notes || []);
          setPhaseIdx(state.phaseIdx || 0);
          setIsLocked(state.isLocked || false);
        } catch { /**/ }
      };
      window.addEventListener('storage', handleStorage);
      // Also poll (for same-tab updates)
      const poll = setInterval(handleStorage, 1000);
      setConnected(true); // localStorage is always "connected"
      return () => { window.removeEventListener('storage', handleStorage); clearInterval(poll); };
    }

    // ── SUPABASE REALTIME CHANNEL ───────────────────────────────────────────
    const channelName = `workshop:${sessionId}`;

    // 1. Broadcast channel for phase changes, lock state, tensions
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true }, presence: { key: myId } }
    });

    // Listen for phase change broadcasts (facilitator only sends these)
    channel.on('broadcast', { event: 'phase_change' }, ({ payload }: any) => {
      setPhaseIdx(payload.phaseIdx);
      setIsLocked(payload.isLocked || false);
      // Also update localStorage for Projector fallback
      broadcastToLocalStorage({ phaseIdx: payload.phaseIdx, phase: payload.phase, isLocked: payload.isLocked || false, notes: [], tensions: [], timestamp: Date.now() });
    });

    // Listen for lock state changes
    channel.on('broadcast', { event: 'lock_change' }, ({ payload }: any) => {
      setIsLocked(payload.isLocked);
    });

    // Listen for tension broadcasts
    channel.on('broadcast', { event: 'tension' }, ({ payload }: any) => {
      // Handled by parent component
    });

    // Presence tracking
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const members = (Object.values(state).flat() as unknown[]) as WorkshopPresence[];
      setPresence(members);
      setParticipantCount(members.length);
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }: any) => {
      setParticipantCount(p => p + newPresences.length);
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
      setParticipantCount(p => Math.max(0, p - leftPresences.length));
    });

    // Subscribe and track presence
    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId: myId,
          displayName,
          role,
          currentPhase: phaseIdx,
          joinedAt: Date.now(),
        } as WorkshopPresence);
        setConnected(true);
      }
    });

    channelRef.current = channel;

    // 2. Postgres Changes for notes (workshop_contributions table)
    const notesChannel = supabase.channel(`notes:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'workshop_contributions',
        filter: `session_id=eq.${sessionId}`,
      }, (payload: any) => {
        const row = payload.new;
        const note: WorkshopNote = {
          id: row.id,
          text: row.text,
          author: row.display_name || 'Anonymous',
          authorId: row.contributor_id || 'unknown',
          phase: row.phase_id || '',
          votes: row.votes || 0,
          isHighlighted: row.is_highlighted || false,
          isAnonymous: row.is_anonymous || false,
          createdAt: new Date(row.created_at).getTime(),
        };
        setNotes(prev => {
          if (prev.some(n => n.id === note.id)) return prev;
          return [...prev, note];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'workshop_contributions',
        filter: `session_id=eq.${sessionId}`,
      }, (payload: any) => {
        const row = payload.new;
        setNotes(prev => prev.map(n => n.id === row.id
          ? { ...n, votes: row.votes, isHighlighted: row.is_highlighted }
          : n
        ));
      })
      .subscribe();

    presenceChannelRef.current = notesChannel;

    return () => {
      channel.unsubscribe();
      notesChannel.unsubscribe();
      setConnected(false);
    };
  }, [sessionId]);

  // ── FACILITATOR: BROADCAST PHASE CHANGE ────────────────────────────────────
  const broadcastPhaseChange = useCallback(async (newPhaseIdx: number, phase: any) => {
    setPhaseIdx(newPhaseIdx);
    const payload = { phaseIdx: newPhaseIdx, phase, isLocked: false, timestamp: Date.now() };

    if (isSupabaseReady && channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast', event: 'phase_change', payload,
      });
    }

    // Always update localStorage for Projector
    broadcastToLocalStorage({ ...payload, notes: notes.filter(n => n.phase === phase?.id), tensions: [], timestamp: Date.now() });
  }, [notes]);

  // ── FACILITATOR: TOGGLE LOCK ────────────────────────────────────────────────
  const toggleLock = useCallback(async () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    if (isSupabaseReady && channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast', event: 'lock_change', payload: { isLocked: newLocked },
      });
    }
  }, [isLocked]);

  // ── ANYONE: SUBMIT NOTE ─────────────────────────────────────────────────────
  const submitNote = useCallback(async (text: string, phaseId: string, isAnonymous = false) => {
    if (!text.trim()) return;
    if (isLocked && role !== 'facilitator') return; // participants blocked when locked

    const optimisticNote: WorkshopNote = {
      id: `opt_${Date.now()}`,
      text: text.trim(),
      author: isAnonymous ? 'Anonymous' : displayName,
      authorId: myId,
      phase: phaseId,
      votes: 0,
      isHighlighted: false,
      isAnonymous,
      createdAt: Date.now(),
    };

    // Optimistic update — show immediately
    setNotes(prev => [...prev, optimisticNote]);

    if (isSupabaseReady && supabase) {
      // Write to Supabase → triggers postgres_changes → all clients update
      const { data, error } = await supabase.from('workshop_contributions').insert({
        session_id: sessionId,
        phase_id: phaseId,
        contributor_id: myId,
        display_name: isAnonymous ? null : displayName,
        text: text.trim(),
        is_anonymous: isAnonymous,
        votes: 0,
        is_highlighted: false,
      }).select().single();

      if (!error && data) {
        // Replace optimistic note with real one
        setNotes(prev => prev.map(n => n.id === optimisticNote.id
          ? { ...optimisticNote, id: data.id }
          : n
        ));
      }
    } else {
      // localStorage fallback
      const current = getCurrentLocalState(sessionId);
      current.notes = [...(current.notes || []), optimisticNote];
      saveLocalState(sessionId, current);
    }
  }, [sessionId, displayName, myId, isLocked, role]);

  // ── ANYONE: VOTE ON NOTE ────────────────────────────────────────────────────
  const voteNote = useCallback(async (noteId: string) => {
    // Optimistic update
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, votes: n.votes + 1 } : n));

    if (isSupabaseReady && supabase && !noteId.startsWith('opt_')) {
      // Increment in DB (uses RPC to avoid race conditions)
      try {
        await supabase.rpc('increment_contribution_votes', { contribution_id: noteId });
      } catch {
        // Fallback: direct update
        await supabase.from('workshop_contributions')
          .update({ votes: (notes.find(n => n.id === noteId)?.votes || 0) + 1 })
          .eq('id', noteId);
      }
    }
  }, [notes]);

  // ── FACILITATOR: HIGHLIGHT NOTE ─────────────────────────────────────────────
  const highlightNote = useCallback(async (noteId: string, highlighted: boolean) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, isHighlighted: highlighted } : n));
    if (isSupabaseReady && supabase && !noteId.startsWith('opt_')) {
      await supabase.from('workshop_contributions').update({ is_highlighted: highlighted }).eq('id', noteId);
    }
  }, []);

  // ── LOAD EXISTING NOTES FOR PHASE ──────────────────────────────────────────
  const loadNotesForPhase = useCallback(async (phaseId: string) => {
    if (!isSupabaseReady || !supabase) {
      const state = getCurrentLocalState(sessionId);
      setNotes(state.notes?.filter((n: WorkshopNote) => n.phase === phaseId) || []);
      return;
    }
    const { data } = await supabase
      .from('workshop_contributions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: true });

    if (data) {
      setNotes(data.map((row: any) => ({
        id: row.id,
        text: row.text,
        author: row.display_name || 'Anonymous',
        authorId: row.contributor_id || '',
        phase: row.phase_id,
        votes: row.votes || 0,
        isHighlighted: row.is_highlighted || false,
        isAnonymous: row.is_anonymous || false,
        createdAt: new Date(row.created_at).getTime(),
      })));
    }
  }, [sessionId]);

  // ── BROADCAST TO PROJECTOR (localStorage) ──────────────────────────────────
  const broadcastToProjector = useCallback((state: Partial<WorkshopState>) => {
    const full: WorkshopState = {
      phaseIdx,
      phase: state.phase || null,
      notes: notes,
      tensions: state.tensions || [],
      isLocked,
      timestamp: Date.now(),
      ...state,
    };
    localStorage.setItem('vantage_dq_projector', JSON.stringify(full));
    window.dispatchEvent(new Event('storage'));
  }, [phaseIdx, notes, isLocked]);

  return {
    // State
    notes,
    presence,
    phaseIdx,
    isLocked,
    connected,
    participantCount,
    // Actions
    submitNote,
    voteNote,
    highlightNote,
    loadNotesForPhase,
    broadcastPhaseChange,
    broadcastToProjector,
    toggleLock,
  };
}

// ── LOCAL STATE HELPERS ────────────────────────────────────────────────────────
function getCurrentLocalState(sessionId: number): any {
  try {
    return JSON.parse(localStorage.getItem(`vdq_workshop_${sessionId}`) || '{}');
  } catch { return {}; }
}

function saveLocalState(sessionId: number, state: any) {
  localStorage.setItem(`vdq_workshop_${sessionId}`, JSON.stringify({ ...state, timestamp: Date.now() }));
  window.dispatchEvent(new Event('storage'));
  // Also sync to projector key
  localStorage.setItem('vantage_dq_projector', JSON.stringify({ ...state, timestamp: Date.now() }));
  window.dispatchEvent(new Event('storage'));
}

function broadcastToLocalStorage(state: Partial<WorkshopState>) {
  const key = 'vantage_dq_projector';
  localStorage.setItem(key, JSON.stringify({ ...state, timestamp: Date.now() }));
  window.dispatchEvent(new Event('storage'));
}
