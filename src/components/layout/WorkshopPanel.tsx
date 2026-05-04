import { useState, useEffect, useRef } from 'react';
import { useWorkshopSync } from '@/hooks/useWorkshopSync';
import { WorkshopCopilot } from '@/components/workshop/WorkshopCopilot';
import { useDemoContext } from '@/App';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  X, ChevronRight, ChevronLeft, Timer, Users, Sparkles,
  Play, Pause, SkipForward, CheckCircle, AlertTriangle,
  MessageSquare, ThumbsUp, Eye, EyeOff, BarChart2,
  Lightbulb, Zap, Monitor, Flag, Send
} from 'lucide-react';

// ── WORKSHOP PHASES ──────────────────────────────────────────────────────────
const PHASES = [
  {
    id: 'context',       num: 1,  label: 'Decision Context',
    objective: 'Ensure the room agrees on what decision is being made and why it matters.',
    facilitatorGuidance: 'Read the decision statement aloud. Ask: Is this the right question? Is anything missing from the frame? Surface any immediate disagreements about scope or ownership.',
    participantTask: 'Review the decision frame. Flag any concerns about scope, ownership, or framing.',
    requiredOutput: 'Shared understanding of the focal decision.',
    doneWhen: 'All participants agree the decision is correctly framed.',
    defaultMinutes: 10,
    color: DS.frame.fill,
  },
  {
    id: 'stakeholders',  num: 2,  label: 'Stakeholder Mapping',
    objective: 'Identify who has a stake, who must approve, who must implement, and who could block.',
    facilitatorGuidance: 'Ask: Who is missing from this room? Who will be affected but is not here? Who has veto power? Map on influence × interest axes.',
    participantTask: 'Name stakeholders not in the room. Identify their likely position on this decision.',
    requiredOutput: 'Stakeholder map with influence/interest ratings.',
    doneWhen: 'All major stakeholder groups are named and mapped.',
    defaultMinutes: 15,
    color: DS.commitment.fill,
  },
  {
    id: 'issues',        num: 3,  label: 'Issue Raising',
    objective: 'Surface everything that matters — without filtering or solving.',
    facilitatorGuidance: 'Enforce separation of raising from solving. Push for brutal truths and forgotten options. No idea is too uncomfortable here.',
    participantTask: 'Raise issues, uncertainties, assumptions, and opportunities. Do not filter. Do not solve.',
    requiredOutput: 'Complete issue list across all 12 DQ categories.',
    doneWhen: 'No participant can name an issue not yet captured.',
    defaultMinutes: 20,
    color: DS.warning,
  },
  {
    id: 'categorise',    num: 4,  label: 'Issue Categorisation',
    objective: 'Organise issues by type to reveal patterns and coverage gaps.',
    facilitatorGuidance: 'Walk through categories. Look for over-concentration (groupthink) and under-representation (blind spots).',
    participantTask: 'Review category assignments. Challenge misclassifications.',
    requiredOutput: 'Issues categorised across DQ taxonomy.',
    doneWhen: 'Team agrees on category assignments and coverage is reviewed.',
    defaultMinutes: 10,
    color: DS.information.fill,
  },
  {
    id: 'hierarchy',     num: 5,  label: 'Decision Hierarchy',
    objective: 'Agree on the Focus Five — the decisions that must be made now.',
    facilitatorGuidance: 'Push back on anything that is a given or can be deferred. The Focus Five must be genuinely open choices. Watch for "decisions" that are actually goals.',
    participantTask: 'Vote on which decisions are truly focus decisions vs given or deferred.',
    requiredOutput: 'Agreed Focus Five with clear ownership.',
    doneWhen: 'Team agrees on 3-5 focus decisions and their owners.',
    defaultMinutes: 15,
    color: DS.accent,
  },
  {
    id: 'alternatives',  num: 6,  label: 'Alternatives Generation',
    objective: 'Create genuinely distinct strategic options — not variations of the same idea.',
    facilitatorGuidance: 'Challenge similarity. Ask: Could a competitor make a completely different choice? What is the bold option no one wants to say? What is the null option?',
    participantTask: 'Generate alternatives. Challenge any that are too similar to others.',
    requiredOutput: 'At least 3 genuinely distinct strategies documented.',
    doneWhen: 'Team agrees strategies are sufficiently distinct.',
    defaultMinutes: 20,
    color: DS.alternatives.fill,
  },
  {
    id: 'assumptions',   num: 7,  label: 'Assumption Surfacing',
    objective: 'Make hidden assumptions explicit before they derail the decision.',
    facilitatorGuidance: 'Ask: What must be true for each strategy to work? Which assumptions are shared? Which are contested? Which are unknowable?',
    participantTask: 'Name assumptions behind each strategy. Flag which are shared vs contested.',
    requiredOutput: 'Assumption register with shared/contested/unknowable classification.',
    doneWhen: 'Key assumptions are named and classified.',
    defaultMinutes: 15,
    color: '#7C3AED',
  },
  {
    id: 'uncertainties', num: 8,  label: 'Uncertainty Mapping',
    objective: 'Identify the external uncertainties that will most affect the outcome.',
    facilitatorGuidance: 'Distinguish uncertainties (outside control) from risks (inside control) and decisions. Ask: If we knew X, would our strategy change?',
    participantTask: 'Vote on the top 3 uncertainties by decision-relevance.',
    requiredOutput: 'Ranked uncertainty list with 2 selected as scenario axes.',
    doneWhen: 'Team agrees on top uncertainties and scenario axes.',
    defaultMinutes: 15,
    color: DS.reasoning.fill,
  },
  {
    id: 'scenarios',     num: 9,  label: 'Scenario Testing',
    objective: 'Test each strategy against multiple futures.',
    facilitatorGuidance: 'Walk through each 2×2 cell. Ask: Which strategy survives best? Which fails first? What is the regret potential?',
    participantTask: 'Score each strategy in each scenario. Identify robustness.',
    requiredOutput: 'Strategy robustness scores across 4 scenarios.',
    doneWhen: 'Each strategy has been tested in all scenarios.',
    defaultMinutes: 20,
    color: DS.information.fill,
  },
  {
    id: 'tradeoffs',     num: 10, label: 'Tradeoff Discussion',
    objective: 'Make the real trade-offs explicit and agree on what the team values most.',
    facilitatorGuidance: 'Surface the genuine tensions. Avoid false compromises. Ask: What are we willing to give up? Which criteria are non-negotiable?',
    participantTask: 'Rank criteria by importance. Surface disagreements on weights.',
    requiredOutput: 'Agreed criteria weights with rationale.',
    doneWhen: 'Team agrees on relative weights and accepts the trade-offs.',
    defaultMinutes: 15,
    color: DS.values.fill,
  },
  {
    id: 'commitment',    num: 11, label: 'Commitment Planning',
    objective: 'Convert analysis into a clear commitment with accountability.',
    facilitatorGuidance: 'Ask: Are we ready to commit? What would change our decision? Who is accountable? What does the first 30 days look like?',
    participantTask: 'State any remaining reservations. Agree on decision owner and next steps.',
    requiredOutput: 'Decision commitment with owner, timeline, and review conditions.',
    doneWhen: 'Decision owner can state the decision and first action clearly.',
    defaultMinutes: 15,
    color: DS.commitment.fill,
  },
];

interface Props { onClose: () => void; sessionId?: number; data?: any; }

interface Note { id: string; text: string; author: string; votes: number; phase: string; category?: string; isHighlighted?: boolean; }
interface Tension { id: number; description: string; severity: 'high' | 'medium'; phase: string; }
interface LogEntry { id: number; text: string; timestamp: Date; type: 'decision' | 'tension' | 'note'; }

export function WorkshopPanel({ onClose, sessionId, data }: Props) {
  const { call, busy } = useAI();
  const { authUser } = useDemoContext();
  const sync = useWorkshopSync({
    sessionId: sessionId || 1,
    role: 'facilitator',
    displayName: authUser?.displayName || 'Facilitator',
    userId: authUser?.id,
  });
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(PHASES[0].defaultMinutes * 60);
  const [newNote, setNewNote] = useState('');
  const [tensions, setTensions] = useState<Tension[]>([]);
  // Use sync notes — cast to local Note type
  const notes: Note[] = sync.notes.map(n => ({
    id: String(n.id), text: n.text, author: n.author,
    votes: n.votes, phase: n.phase, isHighlighted: n.isHighlighted,
  }));
  const [log, setLog] = useState<LogEntry[]>([]);
  const [newLog, setNewLog] = useState('');
  const [aiInsight, setAiInsight] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const [phaseComplete, setPhaseComplete] = useState<Set<number>>(new Set());
  const [view, setView] = useState<'facilitator' | 'canvas'>('facilitator');
  const timerRef = useRef<any>(null);

  const phase = PHASES[phaseIdx];

  // Timer
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  const goToPhase = (idx: number) => {
    setPhaseIdx(idx);
    setSeconds(PHASES[idx].defaultMinutes * 60);
    setRunning(false);
    setAiInsight('');
    // Broadcast via Supabase Realtime (falls back to localStorage)
    sync.broadcastPhaseChange(idx, PHASES[idx]);
    sync.broadcastToProjector({ phase: PHASES[idx], phaseIdx: idx, tensions });
    sync.loadNotesForPhase(PHASES[idx].id);
  };

  const broadcastProjector = (state: any) => {
    sync.broadcastToProjector({ ...state, tensions });
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    sync.submitNote(newNote.trim(), phase.id, false);
    setNewNote('');
    broadcastProjector({ phase, phaseIdx });
  };

  const logEntry = (type: LogEntry['type'] = 'note') => {
    if (!newLog.trim()) return;
    setLog(p => [...p, { id: Date.now(), text: newLog.trim(), timestamp: new Date(), type }]);
    setNewLog('');
  };

  const getAiInsight = () => {
    const phaseNotes = notes.filter(n => n.phase === phase.id).map(n => n.text).join('; ');
    const logItems = log.slice(-5).map(l => l.text).join('; ');
    const prompt = `You are a senior DQ workshop facilitator. Analyse what's happening in phase "${phase.label}" and give a pointed facilitation insight.\n\nPhase objective: ${phase.objective}\nParticipant notes/ideas captured: ${phaseNotes || 'None yet'}\nFacilitator log: ${logItems || 'None'}\nDecision context: ${data?.session?.decisionStatement || 'Unknown'}\n\nProvide ONE specific, actionable facilitation move for right now. Be direct. Max 2 sentences. This will be read by a facilitator in front of a room.\n\nReturn JSON: { insight: string, move: string, tension?: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result?.insight) {
        setAiInsight(`${result.insight} ${result.move}`);
        if (result.tension) {
          setTensions(p => [...p, { id: Date.now(), description: result.tension, severity: 'medium', phase: phase.id }]);
        }
      }
    });
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timerPct = (seconds / (phase.defaultMinutes * 60)) * 100;
  const phaseNotes = notes.filter(n => n.phase === phase.id);

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(11,29,58,0.97)' }}>
      {/* MAIN PANEL */}
      <div className="flex flex-col w-full max-w-5xl mx-auto h-full">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: DS.accent }}>
              <Users size={12} className="text-white" />
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide">WORKSHOP MODE</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-xs text-white/50 truncate flex-1">{data?.session?.decisionStatement?.slice(0,60) || 'Decision session'}</span>

          {/* Phase progress dots */}
          <div className="flex gap-1 items-center">
            {PHASES.map((p, i) => (
              <button key={p.id} onClick={() => goToPhase(i)}
                className="w-2 h-2 rounded-full transition-all hover:scale-125"
                style={{ background: i === phaseIdx ? p.color : phaseComplete.has(i) ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)' }} />
            ))}
          </div>

          {/* Projector button */}
          <button onClick={() => { broadcastProjector({ phase, phaseIdx }); window.open(window.location.pathname.replace('/session/', '/projector/'), '_blank'); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <Monitor size={12} /> Projector
          </button>

          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={16} className="text-white/60" />
          </button>
        </div>

        {/* Phase header */}
        <div className="px-6 py-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ background: phase.color }}>PHASE {phase.num} OF {PHASES.length}</span>
                {phaseComplete.has(phaseIdx) && <CheckCircle size={14} style={{ color: '#4ADE80' }} />}
              </div>
              <h2 className="text-2xl font-black text-white mb-1">{phase.label}</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{phase.objective}</p>
            </div>

            {/* Timer */}
            <div className="ml-auto shrink-0 text-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={timerPct > 30 ? phase.color : '#EF4444'} strokeWidth="6"
                    strokeLinecap="round" strokeDasharray={`${Math.PI * 68}`} strokeDashoffset={`${Math.PI * 68 * (1 - timerPct / 100)}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-white tabular-nums">{mins}:{String(secs).padStart(2,'0')}</span>
                </div>
              </div>
              <div className="flex gap-1 mt-1.5 justify-center">
                <button onClick={() => setRunning(!running)}
                  className="p-1 rounded" style={{ background: running ? '#EF444440' : '#4ADE8040', color: running ? '#EF4444' : '#4ADE80' }}>
                  {running ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button onClick={() => { setSeconds(phase.defaultMinutes * 60); setRunning(false); }}
                  className="p-1 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                  <Timer size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Facilitator controls */}
          <div className="w-72 shrink-0 border-r flex flex-col overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>

            {/* Phase guidance cards */}
            <div className="p-4 space-y-3">
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: phase.color }}>FACILITATOR GUIDANCE</div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{phase.facilitatorGuidance}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>PARTICIPANT TASK</div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{phase.participantTask}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#4ADE80' }}>✓ DONE WHEN</div>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{phase.doneWhen}</p>
              </div>
            </div>

            {/* AI Insight */}
            <div className="px-4 pb-4">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.08)' }}>
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'rgba(201,168,76,0.2)' }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.accent }}>AI CO-FACILITATOR</span>
                  <button onClick={getAiInsight} disabled={busy}
                    className="text-[9px] flex items-center gap-1 px-2 py-0.5 rounded font-medium transition-colors hover:opacity-80"
                    style={{ background: DS.accent, color: '#fff' }}>
                    {busy ? '…' : <><Sparkles size={9} /> Get Insight</>}
                  </button>
                </div>
                <div className="p-3">
                  {aiInsight ? (
                    <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{aiInsight}</p>
                  ) : (
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Click Get Insight to receive AI facilitation guidance — tension detection, missing perspectives, and a recommended move.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tensions detected */}
            {tensions.length > 0 && (
              <div className="px-4 pb-4">
                <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: '#EF4444' }}>⚡ TENSIONS DETECTED</div>
                {tensions.slice(-3).map(t => (
                  <div key={t.id} className="flex items-start gap-2 mb-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertTriangle size={11} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{t.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Phase navigation */}
            <div className="mt-auto px-4 pb-4 border-t pt-4 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => { setPhaseComplete(p => new Set([...p, phaseIdx])); if (phaseIdx < PHASES.length - 1) goToPhase(phaseIdx + 1); }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                style={{ background: phase.color, color: '#fff' }}>
                <CheckCircle size={13} /> Complete Phase → Next
              </button>
              <div className="flex gap-2">
                <button onClick={() => phaseIdx > 0 && goToPhase(phaseIdx - 1)} disabled={phaseIdx === 0}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] transition-all hover:bg-white/10 disabled:opacity-30"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                  <ChevronLeft size={11} /> Back
                </button>
                <button onClick={() => phaseIdx < PHASES.length - 1 && goToPhase(phaseIdx + 1)} disabled={phaseIdx === PHASES.length - 1}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] transition-all hover:bg-white/10 disabled:opacity-30"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                  Skip <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Canvas tab bar */}
            <div className="flex items-center gap-0 px-4 pt-3 pb-0 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {['Ideas & Notes', 'Facilitator Log', 'Phase Progress'].map(tab => (
                <button key={tab} onClick={() => setView(tab === 'Ideas & Notes' ? 'facilitator' : tab === 'Facilitator Log' ? 'canvas' : 'facilitator')}
                  className="px-4 py-2 text-[11px] font-medium transition-colors"
                  style={{ color: 'rgba(255,255,255,0.6)', borderBottom: '2px solid transparent' }}>
                  {tab}
                </button>
              ))}
            </div>

            {/* WORKSHOP SCRIBE */}
            {scribeOpen && (
              <div className="mb-3 h-[420px] rounded-2xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                <WorkshopCopilot
                  phaseId={phase.id}
                  phaseLabel={phase.label}
                  phaseColor={phase.color}
                  sessionContext={{ decisionStatement: data?.session?.decisionStatement, sessionName: data?.session?.name }}
                  onDraftCreated={(item) => {
                    sync.submitNote(`[${item.category}] ${item.text}`, phase.id, false);
                  }}
                  onClose={() => setScribeOpen(false)}
                />
              </div>
            )}

            {/* Ideas canvas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Add note */}
              <div className="flex gap-2">
                <Input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
                  placeholder={`Capture an idea, issue, or insight for "${phase.label}"…`}
                  className="flex-1 text-xs h-8 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
                <button onClick={addNote} disabled={!newNote.trim()}
                  className="px-3 h-8 rounded-lg text-xs font-bold text-white disabled:opacity-30 transition-all hover:opacity-90"
                  style={{ background: phase.color }}>
                  <Send size={12} />
                </button>
              </div>

              {/* Notes grid */}
              {phaseNotes.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {phaseNotes.map(note => (
                    <div key={note.id} className="rounded-xl p-3 group relative"
                      style={{ background: `${phase.color}18`, border: `1px solid ${phase.color}30` }}>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{note.text}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => sync.voteNote(note.id)}
                          className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors hover:bg-white/10"
                          style={{ color: note.votes > 0 ? DS.accent : 'rgba(255,255,255,0.3)' }}>
                          <ThumbsUp size={9} /> {note.votes > 0 && note.votes}
                        </button>
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{note.author}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Lightbulb size={24} className="mx-auto mb-2 opacity-20 text-white" />
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No ideas captured yet for this phase</p>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Type above and press Enter to add</p>
                </div>
              )}

              {/* Facilitator log */}
              <div className="border-t pt-3 mt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>FACILITATOR LOG</div>
                <div className="flex gap-2 mb-2">
                  <Input value={newLog} onChange={e => setNewLog(e.target.value)} onKeyDown={e => e.key === 'Enter' && logEntry('note')}
                    placeholder="Log a decision, tension, or key quote…"
                    className="flex-1 text-[10px] h-7 bg-white/5 border-white/10 text-white placeholder:text-white/25" />
                  <button onClick={() => logEntry('decision')}
                    className="px-2 h-7 rounded text-[9px] text-white font-bold" style={{ background: '#4ADE8030', color: '#4ADE80' }}>D</button>
                  <button onClick={() => logEntry('tension')}
                    className="px-2 h-7 rounded text-[9px] font-bold" style={{ background: '#EF444430', color: '#EF4444' }}>T</button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {log.slice().reverse().map(entry => (
                    <div key={entry.id} className="flex items-start gap-2 text-[10px] py-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="shrink-0 font-bold" style={{ color: entry.type === 'decision' ? '#4ADE80' : entry.type === 'tension' ? '#EF4444' : 'rgba(255,255,255,0.3)' }}>
                        {entry.type === 'decision' ? 'D' : entry.type === 'tension' ? 'T' : '·'}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{entry.text}</span>
                      <span className="ml-auto shrink-0 text-[8px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {log.length === 0 && <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Nothing logged yet. D = Decision agreed, T = Tension detected.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="px-6 py-2 border-t flex items-center gap-4 shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
          <div className="flex items-center gap-4 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span>{phaseComplete.size}/{PHASES.length} phases complete</span>
            <span>·</span>
            <span>{notes.length} ideas captured</span>
            <span>·</span>
            <span>{log.length} log entries</span>
            <span>·</span>
            <span style={{ color: tensions.length > 0 ? '#EF4444' : 'rgba(255,255,255,0.35)' }}>{tensions.length} tensions</span>
          </div>
          <div className="ml-auto flex gap-2">
            {PHASES.map((p, i) => (
              <button key={p.id} onClick={() => goToPhase(i)}
                className="text-[9px] px-2 py-0.5 rounded transition-all hover:opacity-80"
                style={{ background: i === phaseIdx ? p.color : phaseComplete.has(i) ? 'rgba(255,255,255,0.1)' : 'transparent', color: i === phaseIdx ? '#fff' : phaseComplete.has(i) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', border: `1px solid ${i === phaseIdx ? p.color : 'rgba(255,255,255,0.1)'}` }}>
                {p.num}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
