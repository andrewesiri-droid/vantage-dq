/**
 * ParticipantView — mobile-optimised view for workshop participants
 *
 * What participants see on their own device during a live workshop:
 * - Current phase name + objective
 * - Text input to submit ideas/notes (blocked when facilitator locks)
 * - Their submitted notes for this phase
 * - Live vote buttons on all notes
 * - Connection status indicator
 *
 * Syncs via useWorkshopSync hook (Supabase Realtime or localStorage fallback)
 */
import { useState, useEffect } from 'react';
import { DS } from '@/constants';
import { useWorkshopSync } from '@/hooks/useWorkshopSync';
import { useDemoContext } from '@/App';
import { Button } from '@/components/ui/button';
import {
  Send, ThumbsUp, Wifi, WifiOff, Lock, Users,
  CheckCircle, Sparkles, ChevronRight
} from 'lucide-react';

interface Props {
  sessionId: number;
  phases: any[];
  onClose?: () => void;
}

export function ParticipantView({ sessionId, phases, onClose }: Props) {
  const { authUser } = useDemoContext();
  const guestData = (() => {
    try { return JSON.parse(localStorage.getItem('vantage_dq_guest') || 'null'); }
    catch { return null; }
  })();

  const displayName = authUser?.displayName || guestData?.displayName || 'Participant';

  const sync = useWorkshopSync({
    sessionId,
    role: 'participant',
    displayName,
    userId: authUser?.id,
  });

  const [noteText, setNoteText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [localPhaseIdx, setLocalPhaseIdx] = useState(0);

  const phase = phases[sync.phaseIdx] || phases[localPhaseIdx] || phases[0];
  const phaseNotes = sync.notes.filter(n => n.phase === phase?.id);

  // Listen for phase changes from facilitator (via localStorage fallback)
  useEffect(() => {
    const handleStorage = () => {
      try {
        const raw = localStorage.getItem('vantage_dq_projector');
        if (!raw) return;
        const state = JSON.parse(raw);
        if (typeof state.phaseIdx === 'number') setLocalPhaseIdx(state.phaseIdx);
      } catch { /**/ }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Load notes when phase changes
  useEffect(() => {
    if (phase?.id) sync.loadNotesForPhase(phase.id);
  }, [phase?.id]);

  const submitNote = async () => {
    if (!noteText.trim() || sync.isLocked) return;
    await sync.submitNote(noteText.trim(), phase.id, isAnonymous);
    setSubmitted(p => [...p, noteText.trim()]);
    setNoteText('');
  };

  const phaseColor = phase?.color || DS.accent;

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto" style={{ background: DS.bg }}>

      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0" style={{ background: DS.brand, borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: sync.connected ? '#34D399' : '#F87171' }} />
            <span className="text-[10px] font-medium text-white/60">
              {sync.connected ? 'Live' : 'Offline'} · {sync.participantCount} in room
            </span>
          </div>
          <span className="text-[10px] text-white/40">{displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
            style={{ background: phaseColor }}>
            {phase?.num || 1}
          </div>
          <span className="text-sm font-bold text-white">{phase?.label || 'Workshop'}</span>
        </div>
      </div>

      {/* Phase objective */}
      <div className="px-4 py-3 shrink-0 border-b" style={{ borderColor: DS.borderLight, background: `${phaseColor}08` }}>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: phaseColor }}>YOUR TASK</div>
        <p className="text-xs leading-relaxed" style={{ color: DS.inkSub }}>
          {phase?.participantTask || phase?.objective || 'Contribute your ideas and perspectives.'}
        </p>
      </div>

      {/* Note input */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: DS.borderLight, background: '#fff' }}>
        {sync.isLocked ? (
          <div className="flex items-center gap-2 py-2 text-xs" style={{ color: DS.warning }}>
            <Lock size={13} />
            <span>Facilitator has paused contributions</span>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitNote(); } }}
              placeholder={`Your idea for "${phase?.label || 'this phase'}"…`}
              rows={2}
              className="w-full text-sm p-2.5 rounded-xl border resize-none focus:outline-none focus:ring-2"
              style={{ borderColor: DS.borderLight, fontFamily: 'inherit' }}
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[10px] cursor-pointer select-none" style={{ color: DS.inkDis }}>
                <div
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className="w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer"
                  style={{ background: isAnonymous ? DS.inkSub : 'transparent', borderColor: DS.border }}>
                  {isAnonymous && <CheckCircle size={9} className="text-white" />}
                </div>
                Submit anonymously
              </label>
              <Button
                size="sm"
                className="ml-auto gap-1.5 text-xs h-8 px-4"
                style={{ background: noteText.trim() ? phaseColor : DS.borderLight, color: noteText.trim() ? '#fff' : DS.inkDis }}
                onClick={submitNote}
                disabled={!noteText.trim()}>
                <Send size={11} /> Submit
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {phaseNotes.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles size={24} className="mx-auto mb-2 opacity-20" style={{ color: DS.inkDis }} />
            <p className="text-xs" style={{ color: DS.inkDis }}>
              No ideas submitted yet for this phase.<br />Be the first!
            </p>
          </div>
        ) : (
          <>
            <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>
              {phaseNotes.length} {phaseNotes.length === 1 ? 'idea' : 'ideas'} this phase
            </div>
            {phaseNotes
              .sort((a, b) => b.votes - a.votes)
              .map(note => {
                const isMine = note.authorId === (authUser?.id || 'unknown');
                return (
                  <div key={note.id}
                    className="p-3 rounded-xl border transition-all"
                    style={{
                      borderColor: note.isHighlighted ? phaseColor : isMine ? `${phaseColor}30` : DS.borderLight,
                      background: note.isHighlighted ? `${phaseColor}10` : isMine ? `${phaseColor}05` : '#fff',
                      boxShadow: note.isHighlighted ? `0 0 0 2px ${phaseColor}30` : 'none',
                    }}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-xs leading-relaxed" style={{ color: DS.ink }}>{note.text}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px]" style={{ color: DS.inkDis }}>
                            {note.isAnonymous ? 'Anonymous' : note.author}
                          </span>
                          {isMine && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${phaseColor}15`, color: phaseColor }}>
                              You
                            </span>
                          )}
                          {note.isHighlighted && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded font-bold" style={{ background: phaseColor, color: '#fff' }}>
                              ★ Highlighted
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => sync.voteNote(note.id)}
                        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all"
                        style={{ background: note.votes > 0 ? `${phaseColor}15` : DS.bg, border: `1px solid ${note.votes > 0 ? phaseColor : DS.borderLight}` }}>
                        <ThumbsUp size={12} style={{ color: note.votes > 0 ? phaseColor : DS.inkDis }} />
                        <span className="text-[9px] font-bold" style={{ color: note.votes > 0 ? phaseColor : DS.inkDis }}>
                          {note.votes}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </div>

      {/* Footer — connection status */}
      <div className="px-4 py-2.5 border-t shrink-0 flex items-center gap-2" style={{ borderColor: DS.borderLight, background: DS.bg }}>
        {sync.connected
          ? <><Wifi size={11} style={{ color: DS.success }} /><span className="text-[10px]" style={{ color: DS.success }}>Connected · updates appear instantly</span></>
          : <><WifiOff size={11} style={{ color: DS.warning }} /><span className="text-[10px]" style={{ color: DS.warning }}>Local mode · same device only</span></>
        }
        {onClose && (
          <button onClick={onClose} className="ml-auto text-[10px]" style={{ color: DS.inkDis }}>Leave</button>
        )}
      </div>
    </div>
  );
}
