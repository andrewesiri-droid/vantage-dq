import { useState, useEffect, useMemo, useCallback } from 'react';
import { DS } from '@/constants';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, BrainCircuit, ChevronRight, ChevronLeft, Play, Pause, Lock, Unlock,
  MessageSquare, ThumbsUp, Eye, AlertTriangle, CheckCircle2, Lightbulb,
  BarChart3, Zap, Timer, Send, Plus, X, Flame, Target, Shield,
  TrendingUp, TrendingDown, Radio, MicOff, Vote, Sparkles, Hash
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
   WORKSHOP MODE — Decision Facilitation Operating System
   A full-page tool component for structured executive decision workshops.
   ──────────────────────────────────────────────────────────────────────────── */

/* ─── TYPES ─── */
interface Participant { id: string; name: string; role: string; initials: string; color: string; engagement: number; silenceMins: number; alignment: number; dominant: boolean; }
interface StickyNote { id: string; text: string; author: string; category: string; votes: number; x: number; y: number; pinned: boolean; }
interface Phase { id: number; title: string; subtitle: string; objective: string; facilitatorTask: string; participantTask: string; output: string; duration: number; status: 'locked' | 'open' | 'active' | 'complete'; }
interface AIAlert { id: string; type: 'tension' | 'bias' | 'drift' | 'silent' | 'insight'; severity: 'critical' | 'warning' | 'info'; title: string; body: string; timestamp: number; }
interface VoteItem { id: string; text: string; category: string; votes: number; voted: boolean; }

/* ─── DEMO DATA ─── */
const PARTICIPANTS: Participant[] = [
  { id: 'p1', name: 'James Donovan', role: 'CEO', initials: 'JD', color: '#2563EB', engagement: 95, silenceMins: 0, alignment: 85, dominant: true },
  { id: 'p2', name: 'Sarah Chen', role: 'CFO', initials: 'SC', color: '#059669', engagement: 72, silenceMins: 4, alignment: 45, dominant: false },
  { id: 'p3', name: 'Michael Torres', role: 'CSO', initials: 'MT', color: '#7C3AED', engagement: 88, silenceMins: 1, alignment: 78, dominant: false },
  { id: 'p4', name: 'Aisha Patel', role: 'CTO', initials: 'AP', color: '#DC2626', engagement: 60, silenceMins: 8, alignment: 55, dominant: false },
  { id: 'p5', name: 'Robert Kim', role: 'General Counsel', initials: 'RK', color: '#D97706', engagement: 55, silenceMins: 12, alignment: 30, dominant: false },
  { id: 'p6', name: 'Elena Vasquez', role: 'COO', initials: 'EV', color: '#0891B2', engagement: 80, silenceMins: 2, alignment: 70, dominant: false },
  { id: 'p7', name: 'David Okafor', role: 'Regional GM APAC', initials: 'DO', color: '#10B981', engagement: 40, silenceMins: 18, alignment: 65, dominant: false },
  { id: 'p8', name: 'Board Chair', role: 'Governance', initials: 'BC', color: '#64748B', engagement: 30, silenceMins: 25, alignment: 90, dominant: false },
];

const PHASES: Phase[] = [
  { id: 1, title: 'Decision Context', subtitle: 'Align on what we are deciding', objective: 'Ensure the room agrees on what decision is being made and why it matters.', facilitatorTask: 'Surface any mismatch between stated decision and actual concern.', participantTask: 'Confirm the decision statement captures the real strategic choice.', output: 'Agreed decision statement with scope boundaries.', duration: 15, status: 'complete' },
  { id: 2, title: 'Problem Definition', subtitle: 'Frame the decision clearly', objective: 'Build a strong decision frame with explicit context, constraints, and success measures.', facilitatorTask: 'Check for hidden solutions embedded in the problem statement.', participantTask: 'Contribute situational facts and constraints.', output: 'Problem frame with ≥4 of 5 checks passed.', duration: 20, status: 'complete' },
  { id: 3, title: 'Stakeholder Mapping', subtitle: 'Who must be aligned', objective: 'Map who must approve, who could block, and who has expertise.', facilitatorTask: 'Spot missing voices and proxy representation risks.', participantTask: 'Add stakeholders and assess influence/interest.', output: 'Stakeholder matrix with engagement strategies.', duration: 15, status: 'complete' },
  { id: 4, title: 'Issue Raising', subtitle: 'Surface what could go wrong', objective: 'Identify uncertainties, assumptions, constraints, and concerns.', facilitatorTask: 'Prevent anchoring and premature convergence.', participantTask: 'Raise issues across all 10 categories.', output: 'Issue list ≥10 items with categorisation.', duration: 25, status: 'active' },
  { id: 5, title: 'Issue Categorization', subtitle: 'Organise and prioritise', objective: 'Group issues by type, severity, and owner. Identify blind spots.', facilitatorTask: 'Ensure brutal truths and opportunity gaps are surfaced.', participantTask: 'Vote on top 5 issues by impact.', output: 'Categorised issue map with priorities.', duration: 15, status: 'open' },
  { id: 6, title: 'Decision Hierarchy', subtitle: 'Given / Focus / Deferred', objective: 'Structure decisions into hierarchy. Limit Focus Five.', facilitatorTask: 'Watch for scope creep into focus decisions.', participantTask: 'Confirm choices for each focus decision.', output: 'Decision hierarchy with ≤5 focus items.', duration: 20, status: 'open' },
  { id: 7, title: 'Alternatives Generation', subtitle: 'Create genuinely distinct strategies', objective: 'Build at least 2–3 strategies that are meaningfully different.', facilitatorTask: 'Prevent minor-variation syndrome.', participantTask: 'Construct strategies using decision hierarchy choices.', output: 'Strategy table with ≥2 distinct alternatives.', duration: 30, status: 'open' },
  { id: 8, title: 'Assumption Identification', subtitle: 'What must be true', objective: 'Surface and test the assumptions behind each strategy.', facilitatorTask: 'Distinguish assumptions from facts.', participantTask: 'Write key assumptions for each strategy.', output: 'Assumption register with evidence ratings.', duration: 20, status: 'open' },
  { id: 9, title: 'Uncertainty Mapping', subtitle: 'What we do not know', objective: 'Identify critical uncertainties and their interconnections.', facilitatorTask: 'Prevent overconfidence in estimates.', participantTask: 'Map uncertainties to strategy impact.', output: 'Uncertainty map with probability ranges.', duration: 25, status: 'open' },
  { id: 10, title: 'Scenario Development', subtitle: 'Build plausible futures', objective: 'Create 2–4 scenarios that test strategy robustness.', facilitatorTask: 'Ensure scenarios are plausible, not extreme fantasy.', participantTask: 'Assign probabilities and drivers.', output: 'Scenario set summing to 100%.', duration: 25, status: 'open' },
  { id: 11, title: 'Strategy Testing', subtitle: 'How does each strategy perform', objective: 'Score each strategy against scenarios and criteria.', facilitatorTask: 'Prevent favourite-strategy bias.', participantTask: 'Score independently before group discussion.', output: 'Robustness heatmap with trade-offs.', duration: 30, status: 'open' },
  { id: 12, title: 'Trade-off Discussion', subtitle: 'Confront the hard choices', objective: 'Make trade-offs explicit and agree on decision criteria weights.', facilitatorTask: 'Surface hidden trade-offs and value disagreements.', participantTask: 'State what you are willing to give up.', output: 'Weighted criteria with trade-off register.', duration: 25, status: 'open' },
  { id: 13, title: 'Value Driver Alignment', subtitle: 'What do we actually value', objective: 'Align on the criteria that matter most for this decision.', facilitatorTask: 'Watch for criteria smuggling (adding criteria to favour one option).', participantTask: 'Rank criteria by importance.', output: 'Agreed criteria with importance weights.', duration: 20, status: 'open' },
  { id: 14, title: 'Risk Prioritization', subtitle: 'What could derail us', objective: 'Map top risks to strategies and define mitigation owners.', facilitatorTask: 'Ensure every risk has an owner and a trigger.', participantTask: 'Assign risk owners and mitigation plans.', output: 'Risk register with mitigation plans.', duration: 20, status: 'open' },
  { id: 15, title: 'Commitment Planning', subtitle: 'Who commits to what', objective: 'Secure explicit commitment from decision owners.', facilitatorTask: 'Check for passive agreement vs active commitment.', participantTask: 'State your commitment and conditions.', output: 'Commitment matrix with conditions.', duration: 15, status: 'open' },
  { id: 16, title: 'Action Ownership', subtitle: 'Make it happen', objective: 'Assign owners, deadlines, and success metrics for next 90 days.', facilitatorTask: 'Ensure no orphan actions.', participantTask: 'Accept ownership with clear deliverables.', output: 'Action tracker with deadlines.', duration: 15, status: 'open' },
];

const DEMO_STICKIES: StickyNote[] = [
  { id: 's1', text: 'Team has zero APAC experience — hiring risk is existential', author: 'CSO', category: 'assumption', votes: 5, x: 10, y: 10, pinned: true },
  { id: 's2', text: '$25M capital ceiling is non-negotiable', author: 'CFO', category: 'constraint', votes: 4, x: 35, y: 15, pinned: false },
  { id: 's3', text: 'If we wait 12 months, competitive position becomes uncatchable', author: 'CSO', category: 'brutal-truth', votes: 5, x: 60, y: 8, pinned: true },
  { id: 's4', text: 'Local data residency in Japan may force architecture redesign', author: 'Legal', category: 'regulatory-trap', votes: 4, x: 15, y: 35, pinned: false },
  { id: 's5', text: 'Singapore government grants could offset $2-3M setup costs', author: 'CFO', category: 'option-forgotten', votes: 2, x: 50, y: 40, pinned: false },
  { id: 's6', text: 'Currency hedging costs not factored — 8-15% return erosion', author: 'CFO', category: 'uncertainty-internal', votes: 3, x: 75, y: 25, pinned: false },
  { id: 's7', text: 'Partner default could trigger reputational damage in US market', author: 'CEO', category: 'second-order', votes: 1, x: 30, y: 55, pinned: false },
  { id: 's8', text: 'Competitors (TechFlow Asia) already entrenched in Singapore', author: 'CSO', category: 'uncertainty-external', votes: 5, x: 65, y: 55, pinned: true },
];

const AI_ALERTS: AIAlert[] = [
  { id: 'a1', type: 'tension', severity: 'critical', title: 'Commercial vs Technical Objective Conflict', body: 'CFO is optimising for capital efficiency. CTO is optimising for architecture robustness. These objectives may be in tension — clarify priority.', timestamp: Date.now() - 120000 },
  { id: 'a2', type: 'bias', severity: 'warning', title: 'Anchoring to Direct Subsidiary Model', body: 'Discussion has referenced "our subsidiary model" 7 times. Team may be anchored to one entry mode before alternatives are generated.', timestamp: Date.now() - 300000 },
  { id: 'a3', type: 'silent', severity: 'warning', title: '3 Participants Silent >10 Minutes', body: 'Aisha Patel (CTO), Robert Kim (Legal), and David Okafor (Regional GM) have not contributed in the last 10 minutes.', timestamp: Date.now() - 180000 },
  { id: 'a4', type: 'drift', severity: 'warning', title: 'Discussion Drifting to Implementation Details', body: 'Team is discussing hiring timelines. Current phase is Issue Raising. Suggest parking implementation topics for Phase 16.', timestamp: Date.now() - 60000 },
  { id: 'a5', type: 'insight', severity: 'info', title: 'Strong Consensus on #1 Issue', body: '"Team has zero APAC experience" received 5 votes from all participants. This is the dominant concern and should shape strategy design.', timestamp: Date.now() - 240000 },
  { id: 'a6', type: 'bias', severity: 'warning', title: 'Groupthink Detected on Risk Assessment', body: 'All participants rated execution risk as "Medium" with similar rationale. Consider independent risk assessment before commitment.', timestamp: Date.now() - 360000 },
];

/* ─── HELPERS ─── */
const catColor = (c: string) => {
  const map: Record<string, string> = {
    'uncertainty-external': '#EF4444', 'uncertainty-internal': '#F59E0B', 'stakeholder-concern': '#7C3AED',
    assumption: '#0891B2', 'regulatory-trap': '#DC2626', opportunity: '#10B981',
    constraint: '#64748B', 'brutal-truth': '#B45309', 'second-order': '#DB2777',
    'information-gap': '#2563EB', 'focus-decision': '#C9A84C', 'option-forgotten': '#059669',
  };
  return map[c] || '#64748B';
};

const severityDot = (s: string) => s === 'critical' ? '#DC2626' : s === 'warning' ? '#D97706' : '#059669';

/* ─── COMPONENT ─── */
export function WorkshopMode() {
  const [activePhase, setActivePhase] = useState(4);
  const [timerRunning, setTimerRunning] = useState(true);
  const [timeLeft, setTimeLeft] = useState(PHASES[3].duration * 60);
  const [stickies, setStickies] = useState<StickyNote[]>(DEMO_STICKIES);
  const [newSticky, setNewSticky] = useState('');
  const [activeTab, setActiveTab] = useState('canvas');
  const [showAlerts, setShowAlerts] = useState(true);
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [facilitatorView, setFacilitatorView] = useState(true);

  const phase = PHASES.find(p => p.id === activePhase) || PHASES[0];
  const completedCount = PHASES.filter(p => p.status === 'complete').length;
  const progress = (completedCount / PHASES.length) * 100;

  /* Timer */
  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [timerRunning, timeLeft]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const addSticky = () => {
    if (!newSticky.trim()) return;
    const s: StickyNote = {
      id: Date.now().toString(), text: newSticky.trim(), author: anonymousMode ? 'Anonymous' : 'Facilitator',
      category: 'assumption', votes: 0, x: 20 + Math.random() * 50, y: 20 + Math.random() * 40, pinned: false,
    };
    setStickies(prev => [...prev, s]);
    setNewSticky('');
  };

  const voteSticky = (id: string) => {
    setStickies(prev => prev.map(s => s.id === id ? { ...s, votes: s.votes + 1 } : s));
  };

  const movePhase = (dir: number) => {
    const next = Math.max(1, Math.min(16, activePhase + dir));
    setActivePhase(next);
    const p = PHASES.find(ph => ph.id === next);
    if (p) setTimeLeft(p.duration * 60);
  };

  /* Engagement health calculation */
  const avgEngagement = Math.round(PARTICIPANTS.reduce((s, p) => s + p.engagement, 0) / PARTICIPANTS.length);
  const silentCount = PARTICIPANTS.filter(p => p.silenceMins > 10).length;
  const conflictRisk = PARTICIPANTS.filter(p => p.alignment < 50).length;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* ── TOP CONTROL BAR ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)` }}>
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: DS.ink }}>
              Workshop Mode <Badge className="text-[9px] h-4 ml-1" style={{ background: '#F5F3FF', color: '#7C3AED', borderColor: '#DDD6FE' }}>Facilitator</Badge>
            </h2>
            <p className="text-[10px]" style={{ color: DS.inkTer }}>
              {PARTICIPANTS.length} participants &middot; Phase {activePhase}/16 &middot; {formatTime(timeLeft)} remaining
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border" style={{ background: DS.bg, borderColor: DS.borderLight }}>
            <Timer size={12} style={{ color: timeLeft < 120 ? '#DC2626' : DS.accent }} />
            <span className="text-sm font-bold tabular-nums" style={{ color: timeLeft < 120 ? '#DC2626' : DS.ink }}>{formatTime(timeLeft)}</span>
            <button onClick={() => setTimerRunning(!timerRunning)} className="ml-1 p-0.5 rounded hover:bg-gray-100">
              {timerRunning ? <Pause size={10} /> : <Play size={10} />}
            </button>
          </div>

          {/* Phase nav */}
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => movePhase(-1)} disabled={activePhase <= 1}>
            <ChevronLeft size={10} /> Prev
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => movePhase(1)} disabled={activePhase >= 16}>
            Next <ChevronRight size={10} />
          </Button>

          <Button size="sm" variant={anonymousMode ? 'default' : 'outline'} className="h-7 text-[10px] gap-1" style={anonymousMode ? { background: '#7C3AED' } : {}} onClick={() => setAnonymousMode(!anonymousMode)}>
            <Eye size={10} /> {anonymousMode ? 'Anonymous' : 'Named'}
          </Button>

          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setFacilitatorView(!facilitatorView)}>
            <Shield size={10} /> {facilitatorView ? 'Facilitator' : 'Participant'}
          </Button>
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: `linear-gradient(90deg, #2563EB, #7C3AED)` }} />
        </div>
        <span className="text-[10px] font-bold" style={{ color: DS.inkSub }}>{Math.round(progress)}%</span>
      </div>

      {/* ── PHASE STRIP ── */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {PHASES.map(p => (
          <button
            key={p.id}
            onClick={() => { setActivePhase(p.id); setTimeLeft(p.duration * 60); }}
            className="flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-left min-w-[90px]"
            style={{
              background: p.id === activePhase ? DS.accentSoft : p.status === 'complete' ? '#ECFDF5' : DS.bg,
              borderColor: p.id === activePhase ? DS.accent : p.status === 'complete' ? '#A7F3D0' : DS.borderLight,
              opacity: p.status === 'locked' ? 0.4 : 1,
            }}
          >
            <span className="text-[9px] font-bold" style={{ color: p.id === activePhase ? DS.accent : p.status === 'complete' ? '#059669' : DS.inkDis }}>M{p.id}</span>
            <span className="text-[9px] font-medium truncate w-full text-center" style={{ color: p.id === activePhase ? DS.brand : DS.inkSub }}>{p.title}</span>
            {p.status === 'active' && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2563EB' }} />}
          </button>
        ))}
      </div>

      {/* ── AI ALERTS BAR ── */}
      {showAlerts && AI_ALERTS.length > 0 && (
        <div className="space-y-1.5">
          {AI_ALERTS.slice(0, 3).map(alert => (
            <div key={alert.id} className="flex items-start gap-2 px-3 py-2 rounded-lg border" style={{ background: alert.severity === 'critical' ? '#FEF2F2' : alert.severity === 'warning' ? '#FFFBEB' : '#F0FDFA', borderColor: alert.severity === 'critical' ? '#FECACA' : alert.severity === 'warning' ? '#FDE68A' : '#A7F3D0' }}>
              {alert.type === 'tension' ? <Flame size={12} style={{ color: severityDot(alert.severity), marginTop: 2 }} /> :
               alert.type === 'bias' ? <AlertTriangle size={12} style={{ color: severityDot(alert.severity), marginTop: 2 }} /> :
               alert.type === 'silent' ? <MicOff size={12} style={{ color: severityDot(alert.severity), marginTop: 2 }} /> :
               alert.type === 'drift' ? <Target size={12} style={{ color: severityDot(alert.severity), marginTop: 2 }} /> :
               <Lightbulb size={12} style={{ color: severityDot(alert.severity), marginTop: 2 }} />}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold" style={{ color: severityDot(alert.severity) }}>{alert.title}</p>
                <p className="text-[10px] leading-relaxed" style={{ color: DS.inkSub }}>{alert.body}</p>
              </div>
              <button onClick={() => {}} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={10} /></button>
            </div>
          ))}
          <div className="flex justify-end">
            <button onClick={() => setShowAlerts(!showAlerts)} className="text-[9px]" style={{ color: DS.inkDis }}>
              {showAlerts ? 'Dismiss alerts' : 'Show alerts'}
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN WORKSHOP AREA ── */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: Phase Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
          {/* Phase Header */}
          <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, ${DS.accentSoft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.accent}` }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-[9px] h-4" style={{ background: DS.accentSoft, color: DS.accent }}>Phase {phase.id}</Badge>
                    <span className="text-xs font-bold" style={{ color: DS.ink }}>{phase.title}</span>
                  </div>
                  <p className="text-[10px] mt-1 font-medium" style={{ color: DS.inkSub }}>{phase.subtitle}</p>
                </div>
                <Badge variant="outline" className="text-[9px] h-4" style={{ color: DS.inkDis }}>{phase.duration} min</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="p-2.5 rounded-lg" style={{ background: DS.bg }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>Objective</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: DS.inkSub }}>{phase.objective}</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: DS.bg }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>Facilitator</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: DS.inkSub }}>{phase.facilitatorTask}</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: DS.bg }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>Output</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: DS.inkSub }}>{phase.output}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workshop Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="text-[10px] shrink-0">
              <TabsTrigger value="canvas" className="text-[10px] gap-1"><MessageSquare size={10} /> Decision Canvas</TabsTrigger>
              <TabsTrigger value="voting" className="text-[10px] gap-1"><Vote size={10} /> Live Voting</TabsTrigger>
              <TabsTrigger value="alignment" className="text-[10px] gap-1"><BarChart3 size={10} /> Alignment</TabsTrigger>
              <TabsTrigger value="participants" className="text-[10px] gap-1"><Users size={10} /> Participants</TabsTrigger>
            </TabsList>

            {/* CANVAS TAB */}
            <TabsContent value="canvas" className="mt-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-2">
                <Textarea value={newSticky} onChange={e => setNewSticky(e.target.value)} placeholder="Add a sticky note... (uncertainty, assumption, concern, idea)" className="text-xs bg-white flex-1" rows={1} />
                <Button size="sm" className="h-8 text-[10px] gap-1 shrink-0" style={{ background: DS.accent }} onClick={addSticky}>
                  <Plus size={10} /> Add
                </Button>
              </div>

              {/* Canvas Area */}
              <div className="flex-1 rounded-xl border relative overflow-hidden" style={{ background: DS.bg, borderColor: DS.borderLight, minHeight: 300 }}>
                {/* Category zones */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 p-2">
                  {['uncertainty-external', 'assumption', 'constraint', 'regulatory-trap', 'brutal-truth', 'stakeholder-concern', 'opportunity', 'option-forgotten', 'second-order'].map((cat, i) => {
                    const catStickies = stickies.filter(s => s.category === cat);
                    return (
                      <div key={cat} className="rounded-lg border border-dashed p-1.5 flex flex-col" style={{ borderColor: catColor(cat) + '30', background: catColor(cat) + '06' }}>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: catColor(cat) }} />
                          <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: catColor(cat) }}>{cat.replace('-', ' ')}</span>
                          <span className="text-[8px] ml-auto" style={{ color: DS.inkDis }}>{catStickies.length}</span>
                        </div>
                        <div className="flex-1 space-y-1 overflow-y-auto">
                          {catStickies.map(s => (
                            <div key={s.id} className="p-1.5 rounded-md text-[9px] shadow-sm cursor-pointer hover:shadow-md transition-shadow" style={{ background: '#FFFFFF', borderLeft: `3px solid ${catColor(s.category)}` }} onClick={() => voteSticky(s.id)}>
                              <p className="leading-relaxed" style={{ color: DS.ink }}>{s.text}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[8px]" style={{ color: DS.inkDis }}>{s.author}</span>
                                <span className="text-[8px] font-bold flex items-center gap-0.5" style={{ color: DS.accent }}><ThumbsUp size={7} /> {s.votes}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* VOTING TAB */}
            <TabsContent value="voting" className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stickies.sort((a, b) => b.votes - a.votes).map(s => (
                  <Card key={s.id} className="border-0 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: catColor(s.category) + '15', color: catColor(s.category) }}>{s.author.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: DS.ink }}>{s.text}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[8px] h-4" style={{ color: catColor(s.category), borderColor: catColor(s.category) + '30' }}>{s.category.replace('-', ' ')}</Badge>
                            <span className="text-[9px]" style={{ color: DS.inkDis }}>{s.author}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => voteSticky(s.id)}
                          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all hover:scale-105 shrink-0"
                          style={{ background: s.votes > 0 ? DS.accentSoft : DS.bg }}
                        >
                          <ThumbsUp size={12} style={{ color: s.votes > 0 ? DS.accent : DS.inkDis }} />
                          <span className="text-[10px] font-bold" style={{ color: DS.accent }}>{s.votes}</span>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ALIGNMENT TAB */}
            <TabsContent value="alignment" className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Alignment Heatmap */}
                <Card className="border-0 shadow-md"><CardContent className="pt-5">
                  <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>Stakeholder Alignment Heatmap</p>
                  <div className="space-y-2">
                    {PARTICIPANTS.map(p => (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0" style={{ background: p.color + '15', color: p.color }}>{p.initials}</div>
                        <span className="text-[10px] w-24 truncate" style={{ color: DS.inkSub }}>{p.name}</span>
                        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${p.alignment}%`, background: p.alignment >= 70 ? '#059669' : p.alignment >= 50 ? '#D97706' : '#DC2626' }} />
                        </div>
                        <span className="text-[10px] font-bold w-6 text-right" style={{ color: p.alignment >= 70 ? '#059669' : p.alignment >= 50 ? '#D97706' : '#DC2626' }}>{p.alignment}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-2 rounded-lg flex items-center gap-2" style={{ background: conflictRisk > 2 ? '#FEF2F2' : '#ECFDF5' }}>
                    {conflictRisk > 2 ? <AlertTriangle size={10} style={{ color: '#DC2626' }} /> : <CheckCircle2 size={10} style={{ color: '#059669' }} />}
                    <span className="text-[10px]" style={{ color: conflictRisk > 2 ? '#DC2626' : '#059669' }}>
                      {conflictRisk > 2 ? `${conflictRisk} stakeholders below 50% alignment. Direct engagement required.` : 'Alignment is healthy. Continue to monitor as trade-offs emerge.'}
                    </span>
                  </div>
                </CardContent></Card>

                {/* Cross-Functional Consensus */}
                <Card className="border-0 shadow-md"><CardContent className="pt-5">
                  <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>Functional Group Consensus</p>
                  {[
                    { group: 'Executive (CEO/COO)', align: 78, members: 2 },
                    { group: 'Commercial (CFO/CSO)', align: 62, members: 2 },
                    { group: 'Technical (CTO/Legal)', align: 42, members: 2 },
                    { group: 'Operations (GM/Board)', align: 78, members: 2 },
                  ].map(g => (
                    <div key={g.group} className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] w-36 truncate" style={{ color: DS.inkSub }}>{g.group}</span>
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                        <div className="h-full rounded-full" style={{ width: `${g.align}%`, background: g.align >= 70 ? '#059669' : g.align >= 50 ? '#D97706' : '#DC2626' }} />
                      </div>
                      <span className="text-[10px] font-bold w-8 text-right" style={{ color: g.align >= 70 ? '#059669' : g.align >= 50 ? '#D97706' : '#DC2626' }}>{g.align}%</span>
                    </div>
                  ))}
                  <div className="mt-2 p-2 rounded-lg" style={{ background: '#FFFBEB' }}>
                    <p className="text-[10px] font-semibold" style={{ color: '#D97706' }}><Lightbulb size={10} className="inline mr-1" /> Gap Alert</p>
                    <p className="text-[9px] mt-0.5" style={{ color: DS.inkSub }}>Commercial and Technical groups are 20 points apart on alignment. This gap will widen during trade-off discussions. Address before Phase 12.</p>
                  </div>
                </CardContent></Card>
              </div>
            </TabsContent>

            {/* PARTICIPANTS TAB */}
            <TabsContent value="participants" className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {PARTICIPANTS.map(p => (
                  <Card key={p.id} className="border-0 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: p.color + '15', color: p.color }}>{p.initials}</div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: DS.ink }}>{p.name}</p>
                          <p className="text-[9px] truncate" style={{ color: DS.inkDis }}>{p.role}</p>
                        </div>
                        {p.dominant && <Badge className="text-[8px] h-4 shrink-0" style={{ background: '#FEF2F2', color: '#DC2626' }}>Dominant</Badge>}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] w-16" style={{ color: DS.inkDis }}>Engagement</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                            <div className="h-full rounded-full" style={{ width: `${p.engagement}%`, background: p.engagement >= 70 ? '#059669' : '#D97706' }} />
                          </div>
                          <span className="text-[9px] font-bold w-6 text-right">{p.engagement}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] w-16" style={{ color: DS.inkDis }}>Alignment</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                            <div className="h-full rounded-full" style={{ width: `${p.alignment}%`, background: p.alignment >= 70 ? '#059669' : p.alignment >= 50 ? '#D97706' : '#DC2626' }} />
                          </div>
                          <span className="text-[9px] font-bold w-6 text-right">{p.alignment}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px]" style={{ color: p.silenceMins > 10 ? '#DC2626' : DS.inkDis }}>
                            {p.silenceMins > 10 ? <MicOff size={8} className="inline mr-0.5" /> : null}
                            {p.silenceMins > 0 ? `Silent ${p.silenceMins}m` : 'Active'}
                          </span>
                          <Button size="sm" variant="ghost" className="h-5 text-[8px] gap-0.5 px-1.5" disabled={p.silenceMins <= 5}>
                            <Sparkles size={8} /> Prompt
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Facilitator Intelligence Panel */}
        {facilitatorView && (
          <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
            {/* Engagement Health */}
            <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 100%)`, borderLeft: `3px solid #7C3AED` }}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-2"><BrainCircuit size={12} style={{ color: '#7C3AED' }} /><span className="text-[10px] font-bold" style={{ color: '#6D28D9' }}>Workshop Health</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg text-center" style={{ background: avgEngagement >= 70 ? '#ECFDF5' : '#FFFBEB' }}>
                    <p className="text-lg font-bold" style={{ color: avgEngagement >= 70 ? '#059669' : '#D97706' }}>{avgEngagement}%</p>
                    <p className="text-[8px]" style={{ color: DS.inkDis }}>Engagement</p>
                  </div>
                  <div className="p-2 rounded-lg text-center" style={{ background: silentCount === 0 ? '#ECFDF5' : '#FEF2F2' }}>
                    <p className="text-lg font-bold" style={{ color: silentCount === 0 ? '#059669' : '#DC2626' }}>{silentCount}</p>
                    <p className="text-[8px]" style={{ color: DS.inkDis }}>Silent</p>
                  </div>
                  <div className="p-2 rounded-lg text-center" style={{ background: conflictRisk <= 1 ? '#ECFDF5' : '#FEF2F2' }}>
                    <p className="text-lg font-bold" style={{ color: conflictRisk <= 1 ? '#059669' : '#DC2626' }}>{conflictRisk}</p>
                    <p className="text-[8px]" style={{ color: DS.inkDis }}>Conflict Risk</p>
                  </div>
                  <div className="p-2 rounded-lg text-center" style={{ background: '#F0FDFA' }}>
                    <p className="text-lg font-bold" style={{ color: '#059669' }}>{stickies.length}</p>
                    <p className="text-[8px]" style={{ color: DS.inkDis }}>Contributions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dominant Voice Alert */}
            {PARTICIPANTS.some(p => p.dominant) && (
              <Card className="border-0 shadow-sm" style={{ background: '#FEF2F2', borderLeft: `3px solid #DC2626` }}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5"><AlertTriangle size={10} style={{ color: '#DC2626' }} /><span className="text-[10px] font-bold" style={{ color: '#DC2626' }}>Dominant Voice Detected</span></div>
                  <p className="text-[9px] mt-1" style={{ color: DS.inkSub }}>CEO (James Donovan) has contributed 42% of comments in this phase. Consider prompting other participants directly.</p>
                  <Button size="sm" variant="outline" className="h-6 text-[9px] mt-2 w-full gap-1" onClick={() => {}}>
                    <MicOff size={8} /> Prompt Silent Participants
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* AI Suggested Prompts */}
            <Card className="border-0 shadow-sm"><CardContent className="p-3">
              <p className="text-[10px] font-bold mb-2" style={{ color: DS.ink }}>Suggested Prompts</p>
              <div className="space-y-1.5">
                {[
                  'What would make us regret this decision in 12 months?',
                  'What are we assuming that might not be true?',
                  'What would a competitor do differently?',
                  'What information would change our minds?',
                  'What are we optimizing for — speed, capital, or control?',
                ].map((prompt, i) => (
                  <button key={i} className="w-full text-left p-2 rounded-lg text-[10px] transition-colors hover:bg-gray-50 border" style={{ color: DS.inkSub, borderColor: DS.borderLight }} onClick={() => {}}>
                    <Send size={8} className="inline mr-1" style={{ color: DS.accent }} /> {prompt}
                  </button>
                ))}
              </div>
            </CardContent></Card>

            {/* Workshop Log */}
            <Card className="border-0 shadow-sm flex-1"><CardContent className="p-3">
              <p className="text-[10px] font-bold mb-2" style={{ color: DS.ink }}>Workshop Log</p>
              <div className="space-y-2">
                {[
                  { t: '2 min ago', e: 'Phase 4 started — Issue Raising' },
                  { t: '5 min ago', e: 'Sarah Chen raised: "$25M capital ceiling"' },
                  { t: '8 min ago', e: 'AI Alert: Dominant voice detected' },
                  { t: '12 min ago', e: 'Michael Torres added: "Competitors entrenched"' },
                  { t: '15 min ago', e: 'Phase 3 completed — Stakeholder Mapping' },
                ].map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[8px] shrink-0 w-12" style={{ color: DS.inkDis }}>{log.t}</span>
                    <span className="text-[9px]" style={{ color: DS.inkSub }}>{log.e}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </div>
        )}
      </div>
    </div>
  );
}
