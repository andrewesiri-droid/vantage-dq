/**
 * Strategic Gaming Module
 * Strategic Gaming module integrated with DQ methodology
 */
import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, Plus, Trash2, Lightbulb, ChevronRight,
  Swords, Handshake, Target, AlertTriangle, CheckCircle,
  TrendingUp, Zap, Shield, Eye, ArrowRight, BarChart2
} from 'lucide-react';

// ── TYPES ────────────────────────────────────────────────────────────────────
type GameType = 'competitive' | 'collaboration' | 'coordination';
type PlayerRole = 'us' | 'competitor' | 'regulator' | 'partner' | 'customer' | 'supplier' | 'government' | 'other';

interface Player {
  id: number;
  name: string;
  role: PlayerRole;
  objective: string;
  incentives: string;
  capabilities: string;
  constraints: string;
  riskTolerance: 'high' | 'medium' | 'low';
  likelyBehavior: string;
}

interface GameMove {
  id: number;
  playerId: number;
  label: string;
  description: string;
  payoff?: number;
}

interface PayoffCell {
  row: number; col: number;
  usPayoff: number; opponentPayoff: number;
  label?: string;
}

interface GameModel {
  id: number;
  name: string;
  gameType: GameType;
  description: string;
  ourMoves: GameMove[];
  opponentMoves: GameMove[];
  payoffMatrix: PayoffCell[];
  dominantStrategy?: string;
  equilibrium?: string;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'frame',    label: '1. Frame the Game' },
  { id: 'players',  label: '2. Players & Incentives' },
  { id: 'matrix',   label: '3. Strategy Evaluation' },
  { id: 'signals',  label: '4. Signals & Escalation' },
  { id: 'plan',     label: '5. Execution Roadmap' },
];

const GAME_TYPES: Record<GameType, { color: string; soft: string; icon: any; label: string; desc: string; note: string }> = {
  competitive: {
    color: DS.danger, soft: DS.dangerSoft, icon: Swords,
    label: 'Competitive Game',
    desc: 'Zero-sum or near-zero-sum. One party\'s gain is the other\'s loss. Classic Prisoner\'s Dilemma dynamics. Defection dominates even when cooperation would be Pareto superior.',
    note: 'In competitive games, identify your dominant strategy first. If none exists, look for mixed strategy equilibria. Avoid being predictable.',
  },
  collaboration: {
    color: DS.success, soft: DS.successSoft, icon: Handshake,
    label: 'Collaboration Game',
    desc: 'Positive-sum. Parties can create more value together than apart. The challenge is dividing the surplus. Trust, commitment devices, and information sharing are critical.',
    note: 'In collaboration games, focus on credible commitment mechanisms and fair surplus division. The biggest risk is defection after value is created.',
  },
  coordination: {
    color: DS.accent, soft: DS.accentSoft, icon: Target,
    label: 'Coordination Game',
    desc: 'Both parties benefit from aligning on the same choice, but may prefer different coordination points. First-mover advantage and signaling matter enormously.',
    note: 'In coordination games, whoever moves first and signals credibly typically wins. Ambiguity is your enemy — clarity and commitment are your tools.',
  },
};

const PLAYER_ROLES: Record<PlayerRole, string> = {
  us: '🏢 Our Organisation', competitor: '⚔️ Competitor',
  regulator: '⚖️ Regulator', partner: '🤝 Partner',
  customer: '👥 Customer', supplier: '🔗 Supplier',
  government: '🏛️ Government', other: '🔵 Other',
};

const PAYOFF_LABELS = ['Very Bad', 'Bad', 'Neutral', 'Good', 'Very Good'];
const PAYOFF_COLORS = [DS.danger, '#EA580C', '#64748B', DS.success, '#047857'];

const DQ_PRINCIPLES: Record<string, string> = {
  frame: 'Dynamic Framing (Step 1): Before solving the game, correctly identify it. Most strategic errors come from misclassifying a coordination game as competitive, or a collaboration game as competitive. The game type determines everything about the right strategy.',
  players: 'Strategic Empathy: Understanding an opponent\'s incentives and constraints is more valuable than understanding your own options. The best strategists think deeply about what others want, fear, and believe.',
  matrix: 'Strategy Evaluation (Step 2): Build the payoff matrix, find dominant strategies, identify Nash equilibria, and check for Pareto improvements. A strategy that looks best in isolation often looks different once opponent reactions are modelled.',
  signals: 'Signaling & Commitment: Credible signals and commitment devices change the game structure itself. A threat is only as powerful as its credibility. A promise is only as valuable as its enforceability.',
  plan: 'Execution Planning (Step 3): The dynamic roadmap shows how player interactions unfold over time. Identify trigger points, contingent moves, and the tactical sequence that implements your strategy.',
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export function GameTheoryModule({ sessionId, data }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('frame');

  // State
  const [gameType, setGameType] = useState<GameType>('competitive');
  const [decisionContext, setDecisionContext] = useState('');
  const [strategicObjective, setStrategicObjective] = useState('');
  const [timeline, setTimeline] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [models, setModels] = useState<GameModel[]>([]);
  const [activeModelId, setActiveModelId] = useState<number | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [escalationMap, setEscalationMap] = useState<any>(null);
  const [executionPlan, setExecutionPlan] = useState<any>(null);

  // Load session context
  useEffect(() => {
    if (data?.session?.decisionStatement) {
      setDecisionContext(data.session.decisionStatement);
    }
  }, [data?.session]);

  const addPlayer = () => {
    const n: Player = {
      id: Date.now(), name: 'New Player', role: 'competitor',
      objective: '', incentives: '', capabilities: '', constraints: '',
      riskTolerance: 'medium', likelyBehavior: '',
    };
    setPlayers(p => [...p, n]);
  };

  const updatePlayer = (id: number, field: string, val: any) =>
    setPlayers(p => p.map(pl => pl.id === id ? { ...pl, [field]: val } : pl));

  const removePlayer = (id: number) => setPlayers(p => p.filter(pl => pl.id !== id));

  const activeModel = models.find(m => m.id === activeModelId);

  const createModel = () => {
    const n: GameModel = {
      id: Date.now(), name: 'New Strategic Game',
      gameType, description: '',
      ourMoves: [
        { id: Date.now() + 1, playerId: 0, label: 'Option A', description: '' },
        { id: Date.now() + 2, playerId: 0, label: 'Option B', description: '' },
      ],
      opponentMoves: [
        { id: Date.now() + 3, playerId: 1, label: 'React Aggressively', description: '' },
        { id: Date.now() + 4, playerId: 1, label: 'Accommodate', description: '' },
      ],
      payoffMatrix: [],
    };
    // Init payoff matrix
    n.payoffMatrix = [0, 1].flatMap(r => [0, 1].map(c => ({
      row: r, col: c, usPayoff: 2, opponentPayoff: 2,
    })));
    setModels(p => [...p, n]);
    setActiveModelId(n.id);
  };

  const updatePayoff = (modelId: number, row: number, col: number, field: 'usPayoff' | 'opponentPayoff', val: number) => {
    setModels(p => p.map(m => m.id === modelId ? {
      ...m, payoffMatrix: m.payoffMatrix.map(cell =>
        cell.row === row && cell.col === col ? { ...cell, [field]: val } : cell
      )
    } : m));
  };

  // ── AI FUNCTIONS ─────────────────────────────────────────────────────────
  const aiAnalyseGame = () => {
    if (!activeModel) return;
    const playerList = players.map(p => `${p.name} (${p.role}): objective="${p.objective}", incentives="${p.incentives}", riskTolerance=${p.riskTolerance}`).join('\n');
    const matrixStr = activeModel.payoffMatrix.map(c =>
      `(${activeModel.ourMoves[c.row]?.label || 'R' + c.row}, ${activeModel.opponentMoves[c.col]?.label || 'C' + c.col}): us=${c.usPayoff}, them=${c.opponentPayoff}`
    ).join('; ');

    const prompt = `You are a strategic gaming analyst.

Decision context: ${decisionContext}
Game type: ${activeModel.gameType}
Our moves: ${activeModel.ourMoves.map(m => m.label).join(', ')}
Opponent moves: ${activeModel.opponentMoves.map(m => m.label).join(', ')}
Payoff matrix: ${matrixStr}
Players: ${playerList}

Apply structured game theory analysis:
1. DYNAMIC FRAMING: Is this game correctly typed? What is the true nature of this strategic interaction?
2. STRATEGY EVALUATION: Identify dominant strategies, Nash equilibrium, Pareto improvements
3. STRATEGIC INSIGHTS: What does the payoff structure tell us about optimal play?

Return JSON: {
  gameAssessment: string,
  dominantStrategy: string or null,
  nashEquilibrium: string,
  paretoOptimal: string,
  recommendedStrategy: string,
  keyRisk: string,
  strategicInsight: string,
  warnings: [string],
  executionHints: [string]
}`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setAiAnalysis(result);
    });
  };

  const aiGeneratePlayers = () => {
    const prompt = `Identify the key players for this strategic decision using strategic player analysis framework.

Decision: ${decisionContext}
Objective: ${strategicObjective}
Game type: ${gameType}
Existing players: ${players.map(p => p.name).join(', ')}

For each player, analyse their incentives, capabilities, constraints, and likely behavior patterns. Consider hidden motivations.

Return JSON: { players: [{name, role (competitor/regulator/partner/customer/supplier/government/other), objective, incentives, capabilities, constraints, riskTolerance (high/medium/low), likelyBehavior}] }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result?.players) {
        const newPlayers: Player[] = result.players.map((p: any, i: number) => ({
          id: Date.now() + i, name: p.name || 'Player', role: p.role || 'other',
          objective: p.objective || '', incentives: p.incentives || '',
          capabilities: p.capabilities || '', constraints: p.constraints || '',
          riskTolerance: p.riskTolerance || 'medium', likelyBehavior: p.likelyBehavior || '',
        }));
        setPlayers(p => [...p, ...newPlayers]);
      }
    });
  };

  const aiEscalation = () => {
    const prompt = `Map the escalation risks and signaling dynamics for this strategic situation.

Decision: ${decisionContext}
Game type: ${gameType}
Players: ${players.map(p => `${p.name}: ${p.objective}`).join('; ')}
${activeModel ? `Our strategy: ${activeModel.ourMoves.map(m => m.label).join(' vs ')}` : ''}

Identify the following:
1. Escalation chains — what moves trigger what counter-moves
2. Credible vs incredible threats
3. Signaling opportunities — what can we signal to change the game
4. Commitment devices — what can we do to make our strategy credible
5. Strategic traps to avoid

Return JSON: {
  escalationChains: [{trigger, response, consequence, probability: high|medium|low}],
  credibleThreats: [string],
  incredibleThreats: [string],
  signalingOpportunities: [{signal, intendedMessage, credibility: high|medium|low}],
  commitmentDevices: [string],
  strategicTraps: [string],
  overallEscalationRisk: High|Medium|Low
}`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setEscalationMap(result);
    });
  };

  const aiExecutionPlan = () => {
    const prompt = `Create a dynamic execution roadmap for this strategic decision.

Decision: ${decisionContext}
Game type: ${gameType}
Recommended strategy: ${aiAnalysis?.recommendedStrategy || 'Not yet determined'}
Players: ${players.map(p => `${p.name} (${p.role}): likely to ${p.likelyBehavior}`).join('; ')}
Timeline: ${timeline}

Build a dynamic roadmap showing the sequence of moves, contingent responses, and trigger points.

Return JSON: {
  roadmap: [{
    phase: string,
    ourMove: string,
    expectedResponse: string,
    contingency: string,
    triggerCondition: string,
    timing: string
  }],
  keyMilestones: [string],
  earlyWarningIndicators: [string],
  pivotConditions: [string],
  winCondition: string,
  fallbackStrategy: string
}`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setExecutionPlan(result);
    });
  };

  // ── PAYOFF DISPLAY HELPERS ──────────────────────────────────────────────
  const payoffColor = (v: number) => PAYOFF_COLORS[Math.min(4, Math.max(0, v - 1))];
  const payoffLabel = (v: number) => PAYOFF_LABELS[Math.min(4, Math.max(0, v - 1))];

  const gt = GAME_TYPES[gameType];
  const GTIcon = gt.icon;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold px-2 py-1 rounded text-white" style={{ background: gt.color }}>
              STRATEGIC GAMING
            </span>
            <span className="text-[9px]" style={{ color: DS.inkDis }}>Strategic Game Theory</span>
          </div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Game Theory Analysis</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={createModel} disabled={!decisionContext}>
            <Plus size={11} /> New Game Model
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: gt.color }} onClick={aiAnalyseGame} disabled={busy || !activeModel}>
            <Sparkles size={11} /> AI Analyse Game
          </Button>
        </div>
      </div>

      {/* Game type selector */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {(Object.entries(GAME_TYPES) as [GameType, typeof GAME_TYPES.competitive][]).map(([type, cfg]) => {
          const Icon = cfg.icon;
          const isSelected = gameType === type;
          return (
            <button key={type} onClick={() => setGameType(type)}
              className="text-left p-3 rounded-xl border-2 transition-all"
              style={{ borderColor: isSelected ? cfg.color : DS.borderLight, background: isSelected ? cfg.soft : '#fff' }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} style={{ color: cfg.color }} />
                <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                {isSelected && <CheckCircle size={11} style={{ color: cfg.color, marginLeft: 'auto' }} />}
              </div>
              <p className="text-[9px] leading-relaxed" style={{ color: DS.inkSub }}>{cfg.desc.slice(0, 80)}…</p>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5 overflow-x-auto" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-3 py-2.5 text-xs font-medium transition-colors shrink-0"
            style={{ color: activeTab === tab.id ? gt.color : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${gt.color}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: DYNAMIC FRAMING ═══════════════════════════════════════════ */}
      {activeTab === 'frame' && (
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: gt.soft, border: `1px solid ${gt.color}25` }}>
            <div className="flex items-center gap-2 mb-2">
              <GTIcon size={16} style={{ color: gt.color }} />
              <span className="text-xs font-bold" style={{ color: gt.color }}>STEP 1 — DYNAMIC FRAMING</span>
            </div>
            <p className="text-xs" style={{ color: DS.inkSub }}>{gt.note}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>STRATEGIC DECISION</label>
                <Textarea value={decisionContext} onChange={e => setDecisionContext(e.target.value)}
                  placeholder="What strategic decision are you making? Who else has a stake in the outcome?"
                  rows={3} className="text-xs resize-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>STRATEGIC OBJECTIVE</label>
                <Textarea value={strategicObjective} onChange={e => setStrategicObjective(e.target.value)}
                  placeholder="What outcome are you trying to achieve? What does winning look like?"
                  rows={2} className="text-xs resize-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>TIMELINE & DECISION HORIZON</label>
                <Input value={timeline} onChange={e => setTimeline(e.target.value)}
                  placeholder="e.g. Decision by Q3, 3-year execution horizon" className="text-xs" />
              </div>
            </div>

            <div className="space-y-3">
              {/* Game type diagnosis */}
              <div className="rounded-xl p-3" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>GAME TYPE DIAGNOSIS — PAPAYOANOU'S 3 ARCHETYPES</div>
                {Object.entries(GAME_TYPES).map(([type, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <div key={type} className="flex items-start gap-2 mb-2">
                      <Icon size={11} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}: </span>
                        <span className="text-[9px]" style={{ color: DS.inkSub }}>{cfg.desc.slice(0, 65)}…</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Game models */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: DS.inkDis }}>GAME MODELS</div>
                {models.length === 0 ? (
                  <div className="text-center py-6 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.borderLight}` }}>
                    <p className="text-xs" style={{ color: DS.inkDis }}>No game models yet</p>
                    <button onClick={createModel} className="text-[10px] mt-1 font-medium" style={{ color: gt.color }}>
                      + Create first model
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {models.map(m => {
                      const mtCfg = GAME_TYPES[m.gameType];
                      const MIcon = mtCfg.icon;
                      return (
                        <button key={m.id} onClick={() => { setActiveModelId(m.id); setActiveTab('matrix'); }}
                          className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:opacity-80"
                          style={{ background: activeModelId === m.id ? mtCfg.soft : DS.bg, border: `1px solid ${activeModelId === m.id ? mtCfg.color : DS.borderLight}` }}>
                          <MIcon size={12} style={{ color: mtCfg.color, flexShrink: 0 }} />
                          <span className="text-xs flex-1 truncate" style={{ color: DS.ink }}>{m.name}</span>
                          <Badge style={{ background: mtCfg.soft, color: mtCfg.color, border: 'none', fontSize: 8 }}>{mtCfg.label}</Badge>
                          <button onClick={e => { e.stopPropagation(); setModels(p => p.filter(x => x.id !== m.id)); }}><Trash2 size={10} style={{ color: DS.inkDis }} /></button>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DQPrinciple text={DQ_PRINCIPLES.frame} color={gt.color} />
        </div>
      )}

      {/* ═══ TAB 2: PLAYERS & INCENTIVES ══════════════════════════════════════ */}
      {activeTab === 'players' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Map each player's objectives, incentives, capabilities, and likely behavior. Strategic empathy is the foundation of good game analysis.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={addPlayer}><Plus size={11} /> Add Player</Button>
              <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: gt.color }} onClick={aiGeneratePlayers} disabled={busy}>
                <Sparkles size={11} /> AI Generate Players
              </Button>
            </div>
          </div>

          {players.length === 0 ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.borderLight}` }}>
              <Users size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.inkDis }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No players mapped yet</p>
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Add your organisation, competitors, regulators, partners, and any other stakeholders whose actions affect your decision.</p>
              <Button size="sm" style={{ background: gt.color }} onClick={aiGeneratePlayers} disabled={busy} className="gap-1.5">
                <Sparkles size={12} /> AI Identify Players
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {players.map(player => (
                <div key={player.id} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                  <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
                    <span className="text-base">{PLAYER_ROLES[player.role].split(' ')[0]}</span>
                    <Input value={player.name} onChange={e => updatePlayer(player.id, 'name', e.target.value)}
                      className="flex-1 text-xs font-bold h-6 border-0 bg-transparent p-0 focus-visible:ring-0" />
                    <Select value={player.role} onValueChange={v => updatePlayer(player.id, 'role', v)}>
                      <SelectTrigger className="h-6 text-[9px] w-28 border-0 bg-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(PLAYER_ROLES).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={player.riskTolerance} onValueChange={v => updatePlayer(player.id, 'riskTolerance', v as any)}>
                      <SelectTrigger className="h-6 text-[9px] w-16 border-0 bg-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="high" className="text-xs">High risk</SelectItem><SelectItem value="medium" className="text-xs">Med risk</SelectItem><SelectItem value="low" className="text-xs">Low risk</SelectItem></SelectContent>
                    </Select>
                    <button onClick={() => removePlayer(player.id)}><Trash2 size={11} style={{ color: DS.inkDis }} /></button>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {[
                      ['OBJECTIVE', 'objective', 'What are they trying to achieve?'],
                      ['INCENTIVES', 'incentives', 'What drives their decisions?'],
                      ['CAPABILITIES', 'capabilities', 'What can they actually do?'],
                      ['LIKELY BEHAVIOR', 'likelyBehavior', 'How will they respond?'],
                    ].map(([label, field, ph]) => (
                      <div key={field as string}>
                        <div className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>{label}</div>
                        <Textarea value={(player as any)[field as string]} onChange={e => updatePlayer(player.id, field as string, e.target.value)}
                          placeholder={ph as string} rows={2} className="text-[10px] resize-none" />
                      </div>
                    ))}
                  </div>
                  <div className="px-3 pb-3">
                    <div className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>CONSTRAINTS</div>
                    <Input value={player.constraints} onChange={e => updatePlayer(player.id, 'constraints', e.target.value)}
                      placeholder="What limits their options? Budget, regulation, reputation…" className="text-[10px] h-7" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <DQPrinciple text={DQ_PRINCIPLES.players} color={gt.color} />
        </div>
      )}

      {/* ═══ TAB 3: STRATEGY EVALUATION (PAYOFF MATRIX) ════════════════════ */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {!activeModel ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <BarChart2 size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.inkDis }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No game model selected</p>
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Create a game model in Dynamic Framing first, or click below.</p>
              <Button style={{ background: gt.color }} onClick={createModel} className="gap-2"><Plus size={14} /> Create Game Model</Button>
            </div>
          ) : (
            <>
              {/* Model name */}
              <div className="flex items-center gap-3">
                <Input value={activeModel.name} onChange={e => setModels(p => p.map(m => m.id === activeModel.id ? { ...m, name: e.target.value } : m))}
                  className="text-sm font-bold flex-1" />
                <Badge style={{ background: GAME_TYPES[activeModel.gameType].soft, color: GAME_TYPES[activeModel.gameType].color, border: 'none' }}>
                  {GAME_TYPES[activeModel.gameType].label}
                </Badge>
                <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: gt.color }} onClick={aiAnalyseGame} disabled={busy}>
                  <Sparkles size={11} /> AI Analyse
                </Button>
              </div>

              {/* 2×2 Payoff Matrix */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>
                    PAYOFF MATRIX — 2×2 Strategic Analysis (1=Very Bad, 5=Very Good)
                  </div>
                </div>

                {/* Matrix table */}
                <div className="overflow-x-auto p-4">
                  <table className="w-full" style={{ borderSpacing: 8, borderCollapse: 'separate' }}>
                    <thead>
                      <tr>
                        <th className="text-left w-32">
                          <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>OUR MOVE ↓ / THEIR MOVE →</div>
                        </th>
                        {activeModel.opponentMoves.map((m, ci) => (
                          <th key={m.id} className="text-center">
                            <Input value={m.label} onChange={e => setModels(p => p.map(mod => mod.id === activeModel.id ? { ...mod, opponentMoves: mod.opponentMoves.map(om => om.id === m.id ? { ...om, label: e.target.value } : om) } : mod))}
                              className="text-[10px] font-semibold text-center h-7 border-0 bg-transparent" style={{ color: DS.inkSub }} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeModel.ourMoves.map((ourMove, ri) => (
                        <tr key={ourMove.id}>
                          <td>
                            <Input value={ourMove.label} onChange={e => setModels(p => p.map(mod => mod.id === activeModel.id ? { ...mod, ourMoves: mod.ourMoves.map(om => om.id === ourMove.id ? { ...om, label: e.target.value } : om) } : mod))}
                              className="text-[10px] font-semibold h-7 border-0 bg-transparent" style={{ color: DS.ink }} />
                          </td>
                          {activeModel.opponentMoves.map((_, ci) => {
                            const cell = activeModel.payoffMatrix.find(c => c.row === ri && c.col === ci) || { row: ri, col: ci, usPayoff: 2, opponentPayoff: 2 };
                            return (
                              <td key={ci} className="text-center p-1">
                                <div className="rounded-xl p-2 text-center" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}`, minWidth: 120 }}>
                                  <div className="grid grid-cols-2 gap-1 mb-1">
                                    {/* US payoff */}
                                    <div>
                                      <div className="text-[7px] font-bold uppercase mb-0.5" style={{ color: DS.alternatives.fill }}>US</div>
                                      <div className="flex gap-0.5 justify-center">
                                        {[1,2,3,4,5].map(v => (
                                          <button key={v} onClick={() => updatePayoff(activeModel.id, ri, ci, 'usPayoff', v)}
                                            className="w-5 h-5 rounded text-[8px] font-bold transition-all"
                                            style={{ background: cell.usPayoff === v ? payoffColor(v) : DS.bg, color: cell.usPayoff === v ? '#fff' : DS.inkDis, border: `1px solid ${cell.usPayoff === v ? payoffColor(v) : DS.borderLight}` }}>
                                            {v}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="text-[7px] mt-0.5" style={{ color: payoffColor(cell.usPayoff) }}>{payoffLabel(cell.usPayoff)}</div>
                                    </div>
                                    {/* THEM payoff */}
                                    <div>
                                      <div className="text-[7px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>THEM</div>
                                      <div className="flex gap-0.5 justify-center">
                                        {[1,2,3,4,5].map(v => (
                                          <button key={v} onClick={() => updatePayoff(activeModel.id, ri, ci, 'opponentPayoff', v)}
                                            className="w-5 h-5 rounded text-[8px] font-bold transition-all"
                                            style={{ background: cell.opponentPayoff === v ? payoffColor(v) : DS.bg, color: cell.opponentPayoff === v ? '#fff' : DS.inkDis, border: `1px solid ${cell.opponentPayoff === v ? payoffColor(v) : DS.borderLight}` }}>
                                            {v}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="text-[7px] mt-0.5" style={{ color: payoffColor(cell.opponentPayoff) }}>{payoffLabel(cell.opponentPayoff)}</div>
                                    </div>
                                  </div>
                                  {/* Cell label */}
                                  <div className="text-[8px] font-bold mt-1" style={{ color: DS.inkDis }}>
                                    ({cell.usPayoff}, {cell.opponentPayoff})
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Analysis results */}
              {aiAnalysis && (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: DS.borderLight, background: gt.soft }}>
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} style={{ color: gt.color }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: gt.color }}>STRATEGIC GAME ANALYSIS</span>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    {[
                      ['DOMINANT STRATEGY', aiAnalysis.dominantStrategy || 'None — mixed strategy needed'],
                      ['NASH EQUILIBRIUM', aiAnalysis.nashEquilibrium],
                      ['PARETO OPTIMAL', aiAnalysis.paretoOptimal],
                      ['RECOMMENDED MOVE', aiAnalysis.recommendedStrategy],
                    ].map(([label, val]) => (
                      <div key={label as string} className="p-3 rounded-xl" style={{ background: DS.bg }}>
                        <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>{label}</div>
                        <p className="text-xs font-medium" style={{ color: DS.ink }}>{val as string || '—'}</p>
                      </div>
                    ))}
                    <div className="col-span-2 p-3 rounded-xl" style={{ background: gt.soft, border: `1px solid ${gt.color}25` }}>
                      <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: gt.color }}>STRATEGIC INSIGHT</div>
                      <p className="text-xs" style={{ color: DS.inkSub }}>{aiAnalysis.strategicInsight}</p>
                    </div>
                    {aiAnalysis.warnings?.length > 0 && (
                      <div className="col-span-2 space-y-1">
                        {aiAnalysis.warnings.map((w: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: DS.dangerSoft }}>
                            <AlertTriangle size={11} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />
                            <p className="text-[10px]" style={{ color: DS.inkSub }}>{w}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <DQPrinciple text={DQ_PRINCIPLES.matrix} color={gt.color} />
        </div>
      )}

      {/* ═══ TAB 4: SIGNALS & ESCALATION ══════════════════════════════════════ */}
      {activeTab === 'signals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs" style={{ color: DS.inkSub }}>Map escalation chains, signaling opportunities, and commitment devices. Credible signals change the game structure itself.</p>
            </div>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: gt.color }} onClick={aiEscalation} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Mapping…' : 'Map Signals & Escalation'}
            </Button>
          </div>

          {!escalationMap ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Zap size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.warning }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>Signaling & Escalation Analysis</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>AI maps escalation chains, identifies credible vs incredible threats, and finds signaling opportunities that change the game.</p>
              <Button style={{ background: gt.color }} onClick={aiEscalation} disabled={busy} className="gap-2"><Sparkles size={14} /> Run Analysis</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Escalation risk */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: escalationMap.overallEscalationRisk === 'High' ? DS.dangerSoft : escalationMap.overallEscalationRisk === 'Medium' ? DS.warnSoft : DS.successSoft }}>
                <div className="text-2xl font-black" style={{ color: escalationMap.overallEscalationRisk === 'High' ? DS.danger : escalationMap.overallEscalationRisk === 'Medium' ? DS.warning : DS.success }}>
                  {escalationMap.overallEscalationRisk}
                </div>
                <div className="text-xs font-semibold" style={{ color: DS.ink }}>Overall Escalation Risk</div>
              </div>

              {/* Escalation chains */}
              {escalationMap.escalationChains?.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>ESCALATION CHAINS</div>
                  {escalationMap.escalationChains.map((chain: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 mb-2 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                      <div className="text-xs font-medium flex-1" style={{ color: DS.ink }}>{chain.trigger}</div>
                      <ArrowRight size={12} style={{ color: DS.inkDis, flexShrink: 0 }} />
                      <div className="text-xs flex-1" style={{ color: DS.inkSub }}>{chain.response}</div>
                      <ArrowRight size={12} style={{ color: DS.inkDis, flexShrink: 0 }} />
                      <div className="text-xs flex-1" style={{ color: DS.danger }}>{chain.consequence}</div>
                      <Badge style={{ background: chain.probability === 'high' ? DS.dangerSoft : chain.probability === 'medium' ? DS.warnSoft : DS.successSoft, color: chain.probability === 'high' ? DS.danger : chain.probability === 'medium' ? DS.warning : DS.success, border: 'none', fontSize: 8 }}>
                        {chain.probability}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Credible threats */}
                {escalationMap.credibleThreats?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: DS.success }}>
                      <Shield size={10} /> CREDIBLE THREATS
                    </div>
                    {escalationMap.credibleThreats.map((t: string, i: number) => (
                      <div key={i} className="text-[10px] p-2 rounded-lg mb-1 flex items-start gap-1.5" style={{ background: DS.successSoft }}>
                        <CheckCircle size={10} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} />
                        <span style={{ color: DS.inkSub }}>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Incredible threats */}
                {escalationMap.incredibleThreats?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: DS.danger }}>
                      <Eye size={10} /> INCREDIBLE THREATS (AVOID)
                    </div>
                    {escalationMap.incredibleThreats.map((t: string, i: number) => (
                      <div key={i} className="text-[10px] p-2 rounded-lg mb-1 flex items-start gap-1.5" style={{ background: DS.dangerSoft }}>
                        <AlertTriangle size={10} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />
                        <span style={{ color: DS.inkSub }}>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Signaling opportunities */}
                {escalationMap.signalingOpportunities?.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.accent }}>SIGNALING OPPORTUNITIES</div>
                    {escalationMap.signalingOpportunities.map((s: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl mb-1.5" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}25` }}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-semibold" style={{ color: DS.ink }}>{s.signal}</span>
                          <Badge style={{ background: s.credibility === 'high' ? DS.success + '20' : DS.warning + '20', color: s.credibility === 'high' ? DS.success : DS.warning, border: 'none', fontSize: 8 }}>{s.credibility} credibility</Badge>
                        </div>
                        <p className="text-[9px]" style={{ color: DS.inkSub }}>{s.intendedMessage}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DQPrinciple text={DQ_PRINCIPLES.signals} color={gt.color} />
        </div>
      )}

      {/* ═══ TAB 5: EXECUTION PLANNING ════════════════════════════════════════ */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Step 3 — Execution Planning: Build the dynamic roadmap showing how player interactions unfold over time.</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: gt.color }} onClick={aiExecutionPlan} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Building…' : 'Build Execution Roadmap'}
            </Button>
          </div>

          {!executionPlan ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <TrendingUp size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.inkDis }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>Execution Planning — Dynamic Roadmap</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>AI builds the dynamic roadmap: your moves, expected responses, contingencies, and trigger points — sequenced over time.</p>
              <Button style={{ background: gt.color }} onClick={aiExecutionPlan} disabled={busy} className="gap-2"><Sparkles size={14} /> Build Roadmap</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Win condition */}
              {executionPlan.winCondition && (
                <div className="p-4 rounded-xl" style={{ background: gt.soft, border: `1px solid ${gt.color}25` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: gt.color }}>WIN CONDITION</div>
                  <p className="text-sm font-semibold" style={{ color: DS.ink }}>{executionPlan.winCondition}</p>
                </div>
              )}

              {/* Dynamic roadmap */}
              {executionPlan.roadmap?.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkDis }}>DYNAMIC ROADMAP — Player Interaction Sequence</div>
                  <div className="space-y-3">
                    {executionPlan.roadmap.map((step: any, i: number) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: gt.color }}>{i + 1}</div>
                          {i < executionPlan.roadmap.length - 1 && <div className="flex-1 w-px my-1" style={{ background: DS.borderLight }} />}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: gt.color }}>{step.phase} · {step.timing}</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.alternatives.fill}25` }}>
                              <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.alternatives.fill }}>OUR MOVE</div>
                              <p className="text-xs" style={{ color: DS.ink }}>{step.ourMove}</p>
                            </div>
                            <div className="p-2.5 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                              <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>EXPECTED RESPONSE</div>
                              <p className="text-xs" style={{ color: DS.inkSub }}>{step.expectedResponse}</p>
                            </div>
                          </div>
                          {step.contingency && (
                            <div className="mt-1.5 p-2 rounded-lg" style={{ background: DS.warnSoft }}>
                              <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.warning }}>CONTINGENCY IF DIFFERENT</div>
                              <p className="text-[10px]" style={{ color: DS.inkSub }}>{step.contingency}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Early warning indicators */}
              {executionPlan.earlyWarningIndicators?.length > 0 && (
                <div className="p-3 rounded-xl" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}25` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.warning }}>EARLY WARNING INDICATORS</div>
                  {executionPlan.earlyWarningIndicators.map((ew: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 mb-1">
                      <Eye size={10} style={{ color: DS.warning, flexShrink: 0, marginTop: 1 }} />
                      <p className="text-[10px]" style={{ color: DS.inkSub }}>{ew}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Fallback strategy */}
              {executionPlan.fallbackStrategy && (
                <div className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>FALLBACK STRATEGY</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{executionPlan.fallbackStrategy}</p>
                </div>
              )}
            </div>
          )}

          <DQPrinciple text={DQ_PRINCIPLES.plan} color={gt.color} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{players.length} players mapped</span>
          <span>·</span>
          <span>{models.length} game models</span>
          <span>·</span>
          <span style={{ color: gt.color }}>{gt.label}</span>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: gt.color }}
          onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t => t.id === activeTab) + 1, TABS.length - 1)].id)}>
          Next <ChevronRight size={11} />
        </Button>
      </div>
    </div>
  );
}

function DQPrinciple({ text, color = DS.accent }: { text: string; color?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl mt-2" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <Lightbulb size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color }}>DQ + STRATEGIC GAMING PRINCIPLE</div>
        <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{text}</p>
      </div>
    </div>
  );
}

// Temporary Users icon inline since it might not be imported
function Users({ size, className, style }: { size: number; className?: string; style?: any }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
