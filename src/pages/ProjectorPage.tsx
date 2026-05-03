/**
 * Projector Mode — Full-screen read-only view for the room display.
 * Driven by localStorage events broadcast from WorkshopPanel.
 * Open in a separate tab and drag to the projector screen.
 */
import { useState, useEffect } from 'react';
import { DS } from '@/constants';
import { supabase, isSupabaseReady } from '@/lib/supabase-client';
import { Monitor, Users, Timer, Lightbulb, AlertTriangle } from 'lucide-react';

interface ProjectorState {
  phase: {
    num: number; label: string; objective: string;
    participantTask: string; doneWhen: string;
    color: string; defaultMinutes: number;
  };
  phaseIdx: number;
  notes: Array<{ id: number; text: string; votes: number }>;
  tensions: Array<{ id: number; description: string; severity: string }>;
  timestamp: number;
  prompt?: string;
}

export function ProjectorPage() {
  const [state, setState] = useState<ProjectorState | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    // Load initial state
    const stored = localStorage.getItem('vantage_dq_projector');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(parsed);
        setConnected(true);
        setSeconds(parsed.phase.defaultMinutes * 60);
      } catch { /**/ }
    }

    // Listen for updates from Workshop panel
    const handleStorage = () => {
      const stored = localStorage.getItem('vantage_dq_projector');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setState(parsed);
          setConnected(true);
          setLastUpdate(Date.now());
          setSeconds(parsed.phase.defaultMinutes * 60);
        } catch { /**/ }
      }
    };

    window.addEventListener('storage', handleStorage);
    // Also poll every 2 seconds for same-tab updates
    const poll = setInterval(handleStorage, 2000);

    // Supabase Realtime — cross-device sync for Projector
    let realtimeChannel: any = null;
    if (isSupabaseReady && supabase) {
      realtimeChannel = supabase
        .channel('projector-sync')
        .on('broadcast', { event: 'phase_change' }, ({ payload }: any) => {
          setState((prev: any) => ({ ...prev, ...payload }));
        })
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'workshop_contributions',
        }, (payload: any) => {
          const row = payload.new;
          setState((prev: any) => ({
            ...prev,
            notes: [...(prev?.notes || []), {
              id: row.id, text: row.text,
              author: row.display_name || 'Anonymous',
              votes: row.votes || 0, phase: row.phase_id,
              isHighlighted: row.is_highlighted || false,
            }],
          }));
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'workshop_contributions',
        }, (payload: any) => {
          const row = payload.new;
          setState((prev: any) => ({
            ...prev,
            notes: (prev?.notes || []).map((n: any) =>
              n.id === row.id ? { ...n, votes: row.votes, isHighlighted: row.is_highlighted } : n
            ),
          }));
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(poll);
      if (realtimeChannel && supabase) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [state?.phaseIdx]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (!state) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: DS.brand }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(201,168,76,0.2)' }}>
          <Monitor size={32} style={{ color: DS.accent }} />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Projector Mode</h1>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Waiting for workshop facilitator to start…</p>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          Open Workshop Mode in the main window to begin
        </div>
      </div>
    );
  }

  const phase = state.phase;
  const notes = state.notes || [];
  const tensions = state.tensions || [];
  const totalPhases = 11;
  const pct = (seconds / (phase.defaultMinutes * 60)) * 100;
  const timerColor = pct > 50 ? '#4ADE80' : pct > 25 ? DS.warning : '#EF4444';

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#060E1E', fontFamily: 'system-ui, sans-serif' }}>

      {/* TOP HEADER */}
      <div className="flex items-center gap-6 px-10 py-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.accent }}>
            <Users size={16} className="text-white" />
          </div>
          <div>
            <div className="text-[11px] font-black text-white tracking-widest">VANTAGE DQ</div>
            <div className="text-[8px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Workshop · Projector</div>
          </div>
        </div>

        <div className="w-px h-8 bg-white/10" />

        {/* Phase indicator */}
        <div className="flex items-center gap-3 flex-1">
          <div className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: phase.color, color: '#fff' }}>
            PHASE {phase.num} / {totalPhases}
          </div>
          <h1 className="text-xl font-black text-white">{phase.label}</h1>
        </div>

        {/* Phase progress bar */}
        <div className="flex items-center gap-2 w-48">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(phase.num / totalPhases) * 100}%`, background: phase.color }} />
          </div>
          <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>{phase.num}/{totalPhases}</span>
        </div>

        {/* Timer */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${timerColor}30` }}>
          <Timer size={14} style={{ color: timerColor }} />
          <span className="text-2xl font-black tabular-nums" style={{ color: timerColor }}>
            {mins}:{String(secs).padStart(2, '0')}
          </span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>LIVE</span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Phase info — large readable text */}
        <div className="w-96 shrink-0 flex flex-col p-8 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

          <div className="mb-6">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: phase.color }}>OBJECTIVE</div>
            <p className="text-lg font-semibold leading-relaxed text-white">{phase.objective}</p>
          </div>

          <div className="mb-6">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>YOUR TASK</div>
            <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{phase.participantTask}</p>
          </div>

          <div className="mt-auto">
            <div className="rounded-2xl p-4" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#4ADE80' }}>✓ WE'RE DONE WHEN</div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{phase.doneWhen}</p>
            </div>
          </div>
        </div>

        {/* RIGHT: Live canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Ideas / contributions */}
          <div className="flex-1 overflow-y-auto p-8">
            {notes.length > 0 ? (
              <>
                <div className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  CONTRIBUTIONS — {notes.length} IDEAS CAPTURED
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {notes.map(note => (
                    <div key={note.id} className="rounded-2xl p-4"
                      style={{ background: `${phase.color}15`, border: `1px solid ${phase.color}25` }}>
                      <p className="text-base leading-relaxed text-white">{note.text}</p>
                      {note.votes > 0 && (
                        <div className="flex items-center gap-1.5 mt-3">
                          <div className="flex gap-0.5">
                            {Array.from({ length: Math.min(note.votes, 8) }).map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-full" style={{ background: phase.color }} />
                            ))}
                          </div>
                          <span className="text-xs font-bold" style={{ color: phase.color }}>{note.votes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ background: `${phase.color}15` }}>
                  <Lightbulb size={36} style={{ color: phase.color, opacity: 0.6 }} />
                </div>
                <p className="text-xl font-semibold text-white mb-2">Waiting for contributions…</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Ideas captured by the facilitator will appear here in real-time</p>
              </div>
            )}
          </div>

          {/* Tensions bar */}
          {tensions.length > 0 && (
            <div className="px-8 py-4 border-t shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(239,68,68,0.06)' }}>
              <div className="flex items-center gap-3">
                <AlertTriangle size={16} style={{ color: '#EF4444', flexShrink: 0 }} />
                <div className="text-[10px] font-bold uppercase tracking-wider mr-2" style={{ color: '#EF4444' }}>TENSION</div>
                <p className="text-sm text-white flex-1">{tensions[tensions.length - 1]?.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="px-10 py-3 border-t flex items-center justify-between shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.4)' }}>
        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Vantage DQ · Workshop Mode · Projector View
        </div>
        {/* Phase dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: totalPhases }, (_, i) => (
            <div key={i} className="w-2 h-2 rounded-full transition-all"
              style={{ background: i === phase.num - 1 ? phase.color : i < phase.num - 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>
        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
