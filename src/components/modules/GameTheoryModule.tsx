/**
 * Strategic Gaming Module — Vantage DQ
 * Three analysis modes:
 *   Quick Read  — Game type diagnosis + AI strategic brief (5 min)
 *   Standard    — Players + 2×2 matrix + signals (structured workflow)
 *   Full        — Complete game theory: coalitions, repeated games, 
 *                 auctions, bargaining, mechanism design
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
  Zap, Shield, Eye, ArrowRight, BarChart2, Layers,
  TrendingUp, GitBranch, Users, Scale, Award, RefreshCw
} from 'lucide-react';

// ── TYPES ─────────────────────────────────────────────────────────────────────
type AnalysisMode = 'quick' | 'standard' | 'full';
type GameType = 'competitive' | 'collaboration' | 'coordination';
type GameClass = 'simultaneous' | 'sequential' | 'repeated' | 'cooperative' | 'auction' | 'bargaining' | 'mechanism';
type PlayerRole = 'us' | 'competitor' | 'regulator' | 'partner' | 'customer' | 'supplier' | 'government' | 'other';

interface Player {
  id: number; name: string; role: PlayerRole;
  objective: string; incentives: string; capabilities: string;
  constraints: string; riskTolerance: 'high' | 'medium' | 'low';
  likelyBehavior: string;
}

interface GameMove { id: number; label: string; description: string; }

interface PayoffCell {
  row: number; col: number;
  usPayoff: number; opponentPayoff: number;
}

interface GameModel {
  id: number; name: string; gameType: GameType; gameClass: GameClass;
  description: string; ourMoves: GameMove[]; opponentMoves: GameMove[];
  payoffMatrix: PayoffCell[];
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ANALYSIS_MODES: Record<AnalysisMode, { label: string; sub: string; desc: string; time: string; color: string; soft: string; tabs: string[] }> = {
  quick: {
    label: 'Quick Read',
    sub: 'AI strategic brief',
    desc: 'Describe your situation. AI classifies the game type, identifies key players, and gives you the top 3 strategic moves — without building a model.',
    time: '5 min',
    color: DS.success,
    soft: DS.successSoft,
    tabs: ['Brief'],
  },
  standard: {
    label: 'Standard Analysis',
    sub: 'Players + matrix + signals',
    desc: 'The classic game theory workflow: classify the game, map players and incentives, build a 2×2 payoff matrix, find equilibria, and map escalation risks.',
    time: '30–60 min',
    color: DS.accent,
    soft: DS.accentSoft,
    tabs: ['Frame', 'Players', 'Matrix', 'Signals', 'Execution'],
  },
  full: {
    label: 'Full Game Theory',
    sub: 'Complete strategic analysis',
    desc: 'The comprehensive suite: all Standard tools plus coalition analysis, repeated game dynamics, auction/bidding strategy, bargaining theory, and mechanism design.',
    time: '1–3 hours',
    color: '#7C3AED',
    soft: '#F5F3FF',
    tabs: ['Frame', 'Players', 'Matrix', 'Coalitions', 'Repeated', 'Auction', 'Bargaining', 'Signals', 'Execution'],
  },
};

const GAME_TYPES: Record<GameType, { color: string; soft: string; icon: any; label: string; desc: string; when: string }> = {
  competitive: {
    color: DS.danger, soft: DS.dangerSoft, icon: Swords,
    label: 'Competitive',
    desc: 'Zero or near-zero sum. One party\'s gain tends to be the other\'s loss. Classic Prisoner\'s Dilemma dynamics. Defection can dominate even when cooperation would be better for both.',
    when: 'Market share battles, pricing wars, bidding competitions, contract disputes, regulatory adversarial processes.',
  },
  collaboration: {
    color: DS.success, soft: DS.successSoft, icon: Handshake,
    label: 'Collaboration',
    desc: 'Positive sum. Parties create more value together than apart. The challenge is dividing the surplus fairly. Trust, commitment devices, and information sharing are critical.',
    when: 'Joint ventures, partnerships, M&A integration, consortium bidding, technology licensing, supply chain alliances.',
  },
  coordination: {
    color: DS.accent, soft: DS.accentSoft, icon: Target,
    label: 'Coordination',
    desc: 'Both parties benefit from aligning on the same choice, but may prefer different coordination points. First-mover advantage and credible signaling matter enormously.',
    when: 'Industry standards, platform ecosystems, infrastructure investment, market entry sequencing, regulatory alignment.',
  },
};

const GAME_CLASSES: Record<GameClass, { label: string; icon: any; desc: string; theory: string }> = {
  simultaneous: {
    label: 'Simultaneous', icon: BarChart2,
    desc: 'Players choose simultaneously without observing each other\'s move. Solved with Nash equilibrium and dominant strategy analysis.',
    theory: 'Core concepts: Nash equilibrium, dominant strategies, mixed strategies, Prisoner\'s Dilemma, Battle of the Sexes.',
  },
  sequential: {
    label: 'Sequential', icon: GitBranch,
    desc: 'Players move in sequence, observing prior moves. Solved by backward induction. First/second mover advantage depends on game structure.',
    theory: 'Core concepts: Game trees, backward induction, subgame perfect equilibrium, commitment and first-mover advantage.',
  },
  repeated: {
    label: 'Repeated Game', icon: RefreshCw,
    desc: 'Same game played multiple rounds. Cooperation can emerge through reputation, reciprocity, and the shadow of the future.',
    theory: 'Core concepts: Folk theorem, tit-for-tat, trigger strategies, reputation effects, discount factors.',
  },
  cooperative: {
    label: 'Coalition / Cooperative', icon: Users,
    desc: 'Players can form binding coalitions. Focus is on coalition formation, stability, and surplus division.',
    theory: 'Core concepts: Shapley value, core, coalition stability, grand coalition, characteristic function.',
  },
  auction: {
    label: 'Auction / Bidding', icon: Award,
    desc: 'Structured competitive allocation mechanisms. Bidding strategy depends on auction format, information structure, and number of bidders.',
    theory: 'Core concepts: Winner\'s curse, revenue equivalence, optimal bidding, English/Dutch/sealed-bid formats.',
  },
  bargaining: {
    label: 'Bargaining / Negotiation', icon: Scale,
    desc: 'Two or more parties negotiate over surplus division. Outcomes depend on outside options, patience, information, and commitment power.',
    theory: 'Core concepts: Nash bargaining solution, Rubinstein alternating offers, BATNA, ultimatum game, disagreement point.',
  },
  mechanism: {
    label: 'Mechanism Design', icon: Layers,
    desc: 'Design the rules of the game to achieve desired outcomes. The "engineering" approach to game theory — shape incentives before the game starts.',
    theory: 'Core concepts: Revelation principle, incentive compatibility, VCG mechanism, Myerson\'s theorem, information rents.',
  },
};

const PLAYER_ROLES: Record<PlayerRole, string> = {
  us: '🏢 Our Organisation', competitor: '⚔️ Competitor',
  regulator: '⚖️ Regulator', partner: '🤝 Partner',
  customer: '👥 Customer', supplier: '🔗 Supplier',
  government: '🏛️ Government', other: '🔵 Other',
};

const PAYOFF_COLORS = [DS.danger, '#EA580C', '#64748B', DS.success, '#047857'];
const PAYOFF_LABELS = ['Very Bad', 'Bad', 'Neutral', 'Good', 'Very Good'];

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export function GameTheoryModule({ sessionId, data }: ModuleProps) {
  const { call, busy } = useAI();

  // Mode selection
  const [mode, setMode] = useState<AnalysisMode | null>(null);
  const [activeTab, setActiveTab] = useState('Frame');

  // Shared state
  const [decisionContext, setDecisionContext] = useState('');
  const [strategicObjective, setStrategicObjective] = useState('');
  const [timeline, setTimeline] = useState('');
  const [gameType, setGameType] = useState<GameType>('competitive');
  const [gameClass, setGameClass] = useState<GameClass>('simultaneous');

  // Quick mode
  const [quickResult, setQuickResult] = useState<any>(null);

  // Standard/Full mode
  const [players, setPlayers] = useState<Player[]>([]);
  const [models, setModels] = useState<GameModel[]>([]);
  const [activeModelId, setActiveModelId] = useState<number | null>(null);
  const [matrixAnalysis, setMatrixAnalysis] = useState<any>(null);
  const [escalationMap, setEscalationMap] = useState<any>(null);
  const [executionPlan, setExecutionPlan] = useState<any>(null);

  // Full mode extras
  const [coalitionAnalysis, setCoalitionAnalysis] = useState<any>(null);
  const [repeatedGameAnalysis, setRepeatedGameAnalysis] = useState<any>(null);
  const [auctionAnalysis, setAuctionAnalysis] = useState<any>(null);
  const [bargainingAnalysis, setBargainingAnalysis] = useState<any>(null);

  useEffect(() => {
    if (data?.session?.decisionStatement) setDecisionContext(data.session.decisionStatement);
  }, [data?.session]);

  const activeModel = models.find(m => m.id === activeModelId);
  const cfg = mode ? ANALYSIS_MODES[mode] : null;
  const gt = GAME_TYPES[gameType];
  const gc = GAME_CLASSES[gameClass];
  const GTIcon = gt.icon;

  // ── QUICK MODE AI ──────────────────────────────────────────────────────────
  const runQuickAnalysis = () => {
    const prompt = `You are a strategic game theory analyst. Analyse this decision situation quickly and give executive-level strategic intelligence.

Decision: ${decisionContext}
Objective: ${strategicObjective}

Analyse this situation using game theory principles:
1. Classify the game type (competitive/collaboration/coordination) and explain why
2. Identify the 2-3 most important players and their likely objectives
3. What is the dominant game structure? (simultaneous, sequential, repeated, auction, bargaining)
4. Give the top 3 strategic moves we should consider
5. What is the single biggest strategic risk?
6. Is there an equilibrium we should be steering toward?

Return JSON: {
  gameType: competitive|collaboration|coordination,
  gameClass: simultaneous|sequential|repeated|auction|bargaining|mechanism,
  gameAssessment: string (2 sentences — what kind of game this really is),
  keyPlayers: [{name, objective, likelyMove}],
  top3Moves: [{move, rationale, risk}],
  biggestRisk: string,
  equilibriumTarget: string,
  winningCondition: string,
  warningFlags: [string]
}`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) {
        setQuickResult(result);
        if (result.gameType) setGameType(result.gameType);
        if (result.gameClass) setGameClass(result.gameClass);
      }
    });
  };

  // ── PLAYER FUNCTIONS ────────────────────────────────────────────────────────
  const addPlayer = () => setPlayers(p => [...p, { id: Date.now(), name: 'New Player', role: 'competitor', objective: '', incentives: '', capabilities: '', constraints: '', riskTolerance: 'medium', likelyBehavior: '' }]);
  const updatePlayer = (id: number, field: string, val: any) => setPlayers(p => p.map(pl => pl.id === id ? { ...pl, [field]: val } : pl));
  const removePlayer = (id: number) => setPlayers(p => p.filter(pl => pl.id !== id));

  const aiGeneratePlayers = () => {
    const prompt = `Identify the key players for this strategic decision.

Decision: ${decisionContext}
Game type: ${gameType} / ${gameClass}

For each player analyse objectives, incentives, capabilities, constraints, and likely behavior. Include hidden motivations.

Return JSON: { players: [{name, role (competitor/regulator/partner/customer/supplier/government/other), objective, incentives, capabilities, constraints, riskTolerance (high/medium/low), likelyBehavior}] }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result?.players) {
        setPlayers(p => [...p, ...result.players.map((pl: any, i: number) => ({
          id: Date.now()+i, name: pl.name||'Player', role: pl.role||'other',
          objective: pl.objective||'', incentives: pl.incentives||'',
          capabilities: pl.capabilities||'', constraints: pl.constraints||'',
          riskTolerance: pl.riskTolerance||'medium', likelyBehavior: pl.likelyBehavior||'',
        }))]);
      }
    });
  };

  // ── MODEL FUNCTIONS ─────────────────────────────────────────────────────────
  const createModel = () => {
    const n: GameModel = {
      id: Date.now(), name: `${GAME_TYPES[gameType].label} Game`, gameType, gameClass, description: '',
      ourMoves: [{ id: Date.now()+1, label: 'Option A', description: '' }, { id: Date.now()+2, label: 'Option B', description: '' }],
      opponentMoves: [{ id: Date.now()+3, label: 'Aggressive', description: '' }, { id: Date.now()+4, label: 'Accommodate', description: '' }],
      payoffMatrix: [0,1].flatMap(r => [0,1].map(c => ({ row:r, col:c, usPayoff:2, opponentPayoff:2 }))),
    };
    setModels(p => [...p, n]);
    setActiveModelId(n.id);
  };

  const updatePayoff = (modelId: number, row: number, col: number, field: 'usPayoff'|'opponentPayoff', val: number) =>
    setModels(p => p.map(m => m.id === modelId ? { ...m, payoffMatrix: m.payoffMatrix.map(c => c.row===row&&c.col===col ? {...c,[field]:val} : c) } : m));

  const aiAnalyseMatrix = () => {
    if (!activeModel) return;
    const matrixStr = activeModel.payoffMatrix.map(c =>
      `(${activeModel.ourMoves[c.row]?.label||'R'+c.row}, ${activeModel.opponentMoves[c.col]?.label||'C'+c.col}): us=${c.usPayoff}, them=${c.opponentPayoff}`
    ).join('; ');
    const prompt = `Analyse this ${activeModel.gameType} game (${activeModel.gameClass} structure).

Decision: ${decisionContext}
Our moves: ${activeModel.ourMoves.map(m=>m.label).join(', ')}
Opponent moves: ${activeModel.opponentMoves.map(m=>m.label).join(', ')}
Payoff matrix: ${matrixStr}
Players: ${players.map(p=>`${p.name}: ${p.objective}`).join('; ')}

Identify: dominant strategies, Nash equilibrium, Pareto improvements, recommended strategy, key risk.

Return JSON: { dominantStrategy: string|null, nashEquilibrium: string, paretoOptimal: string, recommendedStrategy: string, keyRisk: string, strategicInsight: string, warnings: [string], executionHints: [string] }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setMatrixAnalysis(result);
    });
  };

  const aiEscalation = () => {
    const prompt = `Map escalation risks and signaling dynamics.

Decision: ${decisionContext}
Game type: ${gameType} / ${gameClass}
Players: ${players.map(p=>`${p.name}: ${p.objective}`).join('; ')}
${matrixAnalysis ? `Recommended strategy: ${matrixAnalysis.recommendedStrategy}` : ''}

Identify escalation chains, credible vs incredible threats, signaling opportunities, commitment devices, strategic traps.

Return JSON: { escalationChains: [{trigger, response, consequence, probability: high|medium|low}], credibleThreats: [string], incredibleThreats: [string], signalingOpportunities: [{signal, intendedMessage, credibility: high|medium|low}], commitmentDevices: [string], strategicTraps: [string], overallEscalationRisk: High|Medium|Low }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setEscalationMap(result);
    });
  };

  const aiExecutionPlan = () => {
    const prompt = `Build a dynamic execution roadmap for this strategic interaction.

Decision: ${decisionContext}
Game: ${gameType} / ${gameClass}
${matrixAnalysis ? `Recommended strategy: ${matrixAnalysis.recommendedStrategy}` : ''}
Players: ${players.map(p=>`${p.name}: likely to ${p.likelyBehavior}`).join('; ')}
Timeline: ${timeline}

Build a dynamic move sequence: our moves, expected responses, contingencies, trigger points.

Return JSON: { roadmap: [{phase, ourMove, expectedResponse, contingency, triggerCondition, timing}], keyMilestones: [string], earlyWarningIndicators: [string], pivotConditions: [string], winCondition: string, fallbackStrategy: string }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setExecutionPlan(result);
    });
  };

  // ── FULL MODE AI FUNCTIONS ──────────────────────────────────────────────────
  const aiCoalition = () => {
    const prompt = `Analyse coalition dynamics for this multi-player strategic situation.

Decision: ${decisionContext}
Players: ${players.map(p=>`${p.name} (${p.role}): ${p.objective}`).join('\n')}

Apply cooperative game theory:
1. Which coalitions are stable?
2. What is the Shapley value (fair contribution) for each player?
3. What is the grand coalition worth vs smaller coalitions?
4. Who has the most coalition leverage?
5. What coalitions should we try to form or block?

Return JSON: { grandCoalitionValue: string, stableCoalitions: [{members, rationale, value, stability: high|medium|low}], shapleyValues: [{player, value, interpretation}], ourLeverage: string, recommendedCoalition: string, blockingStrategy: string, instabilityRisks: [string] }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setCoalitionAnalysis(result);
    });
  };

  const aiRepeatedGame = () => {
    const prompt = `Analyse repeated game dynamics for this strategic situation.

Decision: ${decisionContext}
Game type: ${gameType}
Players: ${players.map(p=>`${p.name}: ${p.objective}`).join('; ')}
Timeline: ${timeline}

Apply repeated game theory (Folk theorem, tit-for-tat, reputation effects):
1. Does the shadow of the future support cooperation?
2. What trigger strategies are available?
3. What is the minimum discount factor for cooperation to hold?
4. How does reputation affect equilibrium?
5. What multi-round strategy do we recommend?

Return JSON: { cooperationViable: boolean, cooperationConditions: string, recommendedStrategy: tit-for-tat|grim-trigger|generous-tit-for-tat|defect|cooperate, strategyRationale: string, reputationEffects: string, roundByRoundGuidance: [{round, action, rationale}], breakdownRisks: [string], recoveryMechanisms: [string] }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setRepeatedGameAnalysis(result);
    });
  };

  const aiAuction = () => {
    const prompt = `Analyse the auction/bidding dynamics for this situation.

Decision: ${decisionContext}
Bidders/competitors: ${players.filter(p=>p.role==='competitor').map(p=>p.name).join(', ')||'Unknown'}
Our objective: ${strategicObjective}

Apply auction theory:
1. What auction format are we in (English, Dutch, sealed-bid, Vickrey)?
2. What is the winner's curse risk?
3. What is our optimal bidding strategy?
4. How many serious bidders are there?
5. What private information do we have vs others?

Return JSON: { auctionFormat: string, winnersCurseRisk: High|Medium|Low, optimalBidStrategy: string, bidRange: {low: string, high: string, rationale: string}, privateInfoAdvantage: string, commonValueEstimate: string, tacticalRecommendations: [string], redFlags: [string] }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setAuctionAnalysis(result);
    });
  };

  const aiBargaining = () => {
    const prompt = `Analyse the bargaining dynamics for this negotiation.

Decision: ${decisionContext}
Our objective: ${strategicObjective}
Other party: ${players.find(p=>p.role!=='us')?.name || 'Counterpart'}: ${players.find(p=>p.role!=='us')?.objective || 'Unknown'}

Apply bargaining theory (Nash bargaining, Rubinstein alternating offers):
1. What is our BATNA (Best Alternative to Negotiated Agreement)?
2. What is their BATNA?
3. What is the Zone of Possible Agreement (ZOPA)?
4. Who has more bargaining power and why?
5. What is the Nash bargaining solution (fair split)?
6. Optimal negotiation sequence and first offer?

Return JSON: { ourBATNA: string, theirBATNA: string, zopa: string, bargainingPower: us|balanced|them, powerRationale: string, nashSolution: string, firstOffer: string, concessionStrategy: string, anchoring: string, dealBreakers: [string], closingTactics: [string] }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setBargainingAnalysis(result);
    });
  };

  const payoffColor = (v: number) => PAYOFF_COLORS[Math.min(4, Math.max(0, v - 1))];
  const payoffLabel = (v: number) => PAYOFF_LABELS[Math.min(4, Math.max(0, v - 1))];

  // ── MODE SELECTION SCREEN ──────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 mb-2">
          <div className="flex-1">
            <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Strategic Gaming</h2>
            <p className="text-xs mt-0.5" style={{ color: DS.inkSub }}>Game theory for strategic decision-making — analyse how competitors, partners, and regulators will react to your moves.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {(Object.entries(ANALYSIS_MODES) as [AnalysisMode, typeof ANALYSIS_MODES.quick][]).map(([modeKey, mcfg]) => (
            <button key={modeKey} onClick={() => { setMode(modeKey); setActiveTab(mcfg.tabs[0]); }}
              className="text-left p-5 rounded-2xl border-2 transition-all hover:shadow-lg hover:scale-[1.01] group"
              style={{ borderColor: DS.borderLight, background: '#fff' }}>
              <div className="flex items-center justify-between mb-3">
                <Badge style={{ background: mcfg.soft, color: mcfg.color, border: 'none', fontWeight: 700 }}>{mcfg.time}</Badge>
                <ChevronRight size={14} className="opacity-30 group-hover:opacity-70 transition-opacity" style={{ color: mcfg.color }} />
              </div>
              <div className="text-base font-bold mb-0.5" style={{ color: DS.ink }}>{mcfg.label}</div>
              <div className="text-[10px] font-medium mb-2" style={{ color: mcfg.color }}>{mcfg.sub}</div>
              <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{mcfg.desc}</p>
              <div className="mt-3 pt-3 border-t flex gap-1 flex-wrap" style={{ borderColor: DS.borderLight }}>
                {mcfg.tabs.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: mcfg.soft, color: mcfg.color }}>{t}</span>)}
              </div>
            </button>
          ))}
        </div>

        {/* Game type reference */}
        <div className="rounded-xl p-4 border" style={{ borderColor: DS.borderLight, background: DS.bg }}>
          <div className="text-[9px] font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkDis }}>GAME ARCHETYPES — which describes your situation?</div>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(GAME_TYPES) as [GameType, typeof GAME_TYPES.competitive][]).map(([type, tcfg]) => {
              const Icon = tcfg.icon;
              return (
                <div key={type} className="p-3 rounded-xl" style={{ background: tcfg.soft }}>
                  <div className="flex items-center gap-1.5 mb-1"><Icon size={12} style={{ color: tcfg.color }} /><span className="text-[10px] font-bold" style={{ color: tcfg.color }}>{tcfg.label}</span></div>
                  <p className="text-[9px] leading-relaxed mb-1" style={{ color: DS.inkSub }}>{tcfg.desc.slice(0,70)}…</p>
                  <p className="text-[8px]" style={{ color: DS.inkDis }}>{tcfg.when.slice(0,60)}…</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Game class reference */}
        <div className="rounded-xl p-4 border" style={{ borderColor: DS.borderLight, background: DS.bg }}>
          <div className="text-[9px] font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkDis }}>GAME STRUCTURES — available in Standard and Full mode</div>
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(GAME_CLASSES) as [GameClass, typeof GAME_CLASSES.simultaneous][]).map(([cls, clscfg]) => {
              const Icon = clscfg.icon;
              return (
                <div key={cls} className="p-2.5 rounded-lg" style={{ background: '#fff', border: `1px solid ${DS.borderLight}` }}>
                  <div className="flex items-center gap-1 mb-0.5"><Icon size={10} style={{ color: DS.accent }} /><span className="text-[9px] font-bold" style={{ color: DS.ink }}>{clscfg.label}</span></div>
                  <p className="text-[8px] leading-relaxed" style={{ color: DS.inkSub }}>{clscfg.desc.slice(0,55)}…</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const modeCfg = ANALYSIS_MODES[mode];

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <button onClick={() => setMode(null)} className="text-[9px] flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: DS.inkDis }}>
              ← Strategic Gaming
            </button>
            <span style={{ color: DS.inkDis }}>·</span>
            <Badge style={{ background: modeCfg.soft, color: modeCfg.color, border: 'none', fontWeight: 700 }}>{modeCfg.label}</Badge>
          </div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>
            {mode === 'quick' ? 'Quick Strategic Brief' : mode === 'standard' ? 'Standard Game Analysis' : 'Full Game Theory'}
          </h2>
        </div>
        {/* Game type + class selectors */}
        {mode !== 'quick' && (
          <div className="flex gap-2">
            <Select value={gameType} onValueChange={v => setGameType(v as GameType)}>
              <SelectTrigger className="h-7 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(GAME_TYPES).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={gameClass} onValueChange={v => setGameClass(v as GameClass)}>
              <SelectTrigger className="h-7 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(GAME_CLASSES).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b mb-5 overflow-x-auto" style={{ borderColor: DS.borderLight }}>
        {modeCfg.tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-xs font-medium transition-colors shrink-0"
            style={{ color: activeTab===tab ? modeCfg.color : DS.inkTer, borderBottom: activeTab===tab ? `2px solid ${modeCfg.color}` : '2px solid transparent', marginBottom: -1 }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ══ QUICK MODE ══════════════════════════════════════════════════════════ */}
      {mode === 'quick' && activeTab === 'Brief' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>DESCRIBE YOUR SITUATION</label>
              <Textarea value={decisionContext} onChange={e => setDecisionContext(e.target.value)}
                placeholder="What strategic decision are you facing? Who else has skin in this game? What's at stake?"
                rows={4} className="text-xs resize-none" />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>WHAT DOES WINNING LOOK LIKE?</label>
              <Textarea value={strategicObjective} onChange={e => setStrategicObjective(e.target.value)}
                placeholder="What outcome are you trying to achieve? What does your success look like in concrete terms?"
                rows={4} className="text-xs resize-none" />
            </div>
          </div>

          <Button className="gap-2 w-full" style={{ background: DS.success }} onClick={runQuickAnalysis} disabled={busy || !decisionContext}>
            <Sparkles size={14} /> {busy ? 'Analysing…' : 'Run Quick Strategic Analysis'}
          </Button>

          {quickResult && (
            <div className="space-y-4">
              {/* Game classification */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl" style={{ background: GAME_TYPES[quickResult.gameType as GameType]?.soft || DS.accentSoft, border: `1px solid ${GAME_TYPES[quickResult.gameType as GameType]?.color || DS.accent}25` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: GAME_TYPES[quickResult.gameType as GameType]?.color || DS.accent }}>GAME TYPE</div>
                  <div className="text-sm font-bold mb-1" style={{ color: DS.ink }}>{GAME_TYPES[quickResult.gameType as GameType]?.label || quickResult.gameType}</div>
                  <p className="text-[10px]" style={{ color: DS.inkSub }}>{quickResult.gameAssessment}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>GAME STRUCTURE</div>
                  <div className="text-sm font-bold mb-1" style={{ color: DS.ink }}>{GAME_CLASSES[quickResult.gameClass as GameClass]?.label || quickResult.gameClass}</div>
                  <p className="text-[10px]" style={{ color: DS.inkSub }}>{GAME_CLASSES[quickResult.gameClass as GameClass]?.desc.slice(0,80)}…</p>
                </div>
              </div>

              {/* Win condition */}
              {quickResult.winningCondition && (
                <div className="p-4 rounded-xl" style={{ background: DS.successSoft, border: `1px solid ${DS.success}25` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.success }}>WIN CONDITION</div>
                  <p className="text-sm font-semibold" style={{ color: DS.ink }}>{quickResult.winningCondition}</p>
                </div>
              )}

              {/* Top 3 moves */}
              {quickResult.top3Moves?.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>TOP 3 STRATEGIC MOVES</div>
                  {quickResult.top3Moves.map((m: any, i: number) => (
                    <div key={i} className="flex gap-3 mb-3 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: DS.success }}>{i+1}</div>
                      <div>
                        <div className="text-xs font-bold mb-0.5" style={{ color: DS.ink }}>{m.move}</div>
                        <div className="text-[10px] mb-0.5" style={{ color: DS.inkSub }}>{m.rationale}</div>
                        {m.risk && <div className="text-[9px]" style={{ color: DS.warning }}>Risk: {m.risk}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Key players */}
              {quickResult.keyPlayers?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {quickResult.keyPlayers.map((p: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                      <div className="text-[10px] font-bold mb-0.5" style={{ color: DS.ink }}>{p.name}</div>
                      <div className="text-[9px] mb-0.5" style={{ color: DS.inkSub }}>{p.objective}</div>
                      <div className="text-[8px]" style={{ color: DS.warning }}>Likely: {p.likelyMove}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Biggest risk + warnings */}
              <div className="grid grid-cols-2 gap-3">
                {quickResult.biggestRisk && (
                  <div className="p-3 rounded-xl" style={{ background: DS.dangerSoft }}>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.danger }}>BIGGEST STRATEGIC RISK</div>
                    <p className="text-xs" style={{ color: DS.inkSub }}>{quickResult.biggestRisk}</p>
                  </div>
                )}
                {quickResult.equilibriumTarget && (
                  <div className="p-3 rounded-xl" style={{ background: DS.accentSoft }}>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.accent }}>EQUILIBRIUM TO TARGET</div>
                    <p className="text-xs" style={{ color: DS.inkSub }}>{quickResult.equilibriumTarget}</p>
                  </div>
                )}
              </div>

              {/* Warning flags */}
              {quickResult.warningFlags?.length > 0 && (
                <div className="space-y-1">
                  {quickResult.warningFlags.map((w: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: DS.warnSoft }}>
                      <AlertTriangle size={11} style={{ color: DS.warning, flexShrink: 0, marginTop: 1 }} />
                      <p className="text-[10px]" style={{ color: DS.inkSub }}>{w}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-xl text-center" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                <p className="text-xs mb-2" style={{ color: DS.inkSub }}>Want to go deeper? Switch to Standard or Full analysis.</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setMode('standard')}>
                    Standard Analysis <ChevronRight size={11} />
                  </Button>
                  <Button size="sm" className="text-xs gap-1" style={{ background: '#7C3AED' }} onClick={() => setMode('full')}>
                    Full Game Theory <ChevronRight size={11} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!quickResult && (
            <div className="rounded-xl p-4" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>WHAT YOU'LL GET</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: DS.inkSub }}>
                {['Game type classification (Competitive / Collaboration / Coordination)', 'Game structure (Simultaneous, Sequential, Repeated, Auction, Bargaining)', 'Key players and their likely moves', 'Top 3 strategic moves with rationale', 'Biggest strategic risk', 'Equilibrium to target'].map(item => (
                  <div key={item} className="flex items-start gap-1.5"><CheckCircle size={10} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} />{item}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ STANDARD + FULL: FRAME TAB ══════════════════════════════════════════ */}
      {(mode === 'standard' || mode === 'full') && activeTab === 'Frame' && (
        <div className="space-y-4">
          {/* Game class theory card */}
          <div className="rounded-xl p-4" style={{ background: `${modeCfg.color}10`, border: `1px solid ${modeCfg.color}25` }}>
            <div className="flex items-center gap-2 mb-1">
              {(() => { const Icon = gc.icon; return <Icon size={14} style={{ color: modeCfg.color }} />; })()}
              <span className="text-xs font-bold" style={{ color: modeCfg.color }}>{gc.label} — Game Theory</span>
            </div>
            <p className="text-xs mb-1" style={{ color: DS.inkSub }}>{gc.desc}</p>
            <p className="text-[10px] italic" style={{ color: DS.inkDis }}>{gc.theory}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>STRATEGIC DECISION</label>
                <Textarea value={decisionContext} onChange={e => setDecisionContext(e.target.value)}
                  placeholder="What strategic decision are you making? Who else has a stake in the outcome?" rows={3} className="text-xs resize-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>STRATEGIC OBJECTIVE</label>
                <Textarea value={strategicObjective} onChange={e => setStrategicObjective(e.target.value)}
                  placeholder="What does winning look like?" rows={2} className="text-xs resize-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>TIMELINE</label>
                <Input value={timeline} onChange={e => setTimeline(e.target.value)} placeholder="e.g. Decision by Q3, 3-year horizon" className="text-xs" />
              </div>
            </div>

            <div className="space-y-3">
              {/* Game type cards */}
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>SELECT GAME TYPE</div>
              {(Object.entries(GAME_TYPES) as [GameType, any][]).map(([type, tcfg]) => {
                const Icon = tcfg.icon;
                return (
                  <button key={type} onClick={() => setGameType(type)}
                    className="w-full text-left p-3 rounded-xl border-2 transition-all"
                    style={{ borderColor: gameType===type ? tcfg.color : DS.borderLight, background: gameType===type ? tcfg.soft : '#fff' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={12} style={{ color: tcfg.color }} />
                      <span className="text-[10px] font-bold" style={{ color: tcfg.color }}>{tcfg.label}</span>
                      {gameType===type && <CheckCircle size={10} style={{ color: tcfg.color, marginLeft: 'auto' }} />}
                    </div>
                    <p className="text-[9px]" style={{ color: DS.inkSub }}>{tcfg.when.slice(0,70)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Game models */}
          <div className="flex items-center justify-between">
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>GAME MODELS ({models.length})</div>
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={createModel}><Plus size={11} /> New Model</Button>
          </div>
          {models.map(m => (
            <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all"
              style={{ background: activeModelId===m.id ? `${modeCfg.color}10` : DS.bg, border: `1px solid ${activeModelId===m.id ? modeCfg.color : DS.borderLight}` }}
              onClick={() => { setActiveModelId(m.id); setActiveTab('Matrix'); }}>
              <span className="text-xs font-medium flex-1" style={{ color: DS.ink }}>{m.name}</span>
              <Badge style={{ background: GAME_TYPES[m.gameType].soft, color: GAME_TYPES[m.gameType].color, border: 'none', fontSize: 8 }}>{GAME_TYPES[m.gameType].label}</Badge>
              <Badge style={{ background: DS.bg, color: DS.inkSub, border: `1px solid ${DS.border}`, fontSize: 8 }}>{GAME_CLASSES[m.gameClass].label}</Badge>
              <button onClick={e => { e.stopPropagation(); setModels(p=>p.filter(x=>x.id!==m.id)); }}><Trash2 size={10} style={{ color: DS.inkDis }} /></button>
            </div>
          ))}

          <DQPrinciple text="Correct game classification is the most important step. Treating a coordination game as competitive leads to lose-lose outcomes. Treating a competitive game as collaborative leads to exploitation. Identify the game type before choosing strategy." color={modeCfg.color} />
        </div>
      )}

      {/* ══ PLAYERS TAB ═════════════════════════════════════════════════════════ */}
      {(mode === 'standard' || mode === 'full') && activeTab === 'Players' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Map each player's objectives, incentives, capabilities, and constraints. The best strategists understand opponents better than they understand themselves.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={addPlayer}><Plus size={11} /> Add Player</Button>
              <Button size="sm" className="gap-1 text-xs h-7" style={{ background: modeCfg.color }} onClick={aiGeneratePlayers} disabled={busy}>
                <Sparkles size={11} /> AI Generate
              </Button>
            </div>
          </div>
          {players.length === 0 ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No players mapped yet</p>
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Add all parties whose actions affect the outcome — not just direct competitors.</p>
              <Button style={{ background: modeCfg.color }} onClick={aiGeneratePlayers} disabled={busy} className="gap-2"><Sparkles size={14} /> AI Identify Players</Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {players.map(player => (
                <div key={player.id} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                  <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
                    <Input value={player.name} onChange={e => updatePlayer(player.id, 'name', e.target.value)} className="flex-1 text-xs font-bold h-6 border-0 bg-transparent p-0 focus-visible:ring-0" />
                    <Select value={player.role} onValueChange={v => updatePlayer(player.id, 'role', v)}>
                      <SelectTrigger className="h-6 text-[9px] w-28 border-0 bg-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(PLAYER_ROLES).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={player.riskTolerance} onValueChange={v => updatePlayer(player.id, 'riskTolerance', v as any)}>
                      <SelectTrigger className="h-6 text-[9px] w-16 border-0 bg-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>{['high','medium','low'].map(r=><SelectItem key={r} value={r} className="text-xs capitalize">{r} risk</SelectItem>)}</SelectContent>
                    </Select>
                    <button onClick={() => removePlayer(player.id)}><Trash2 size={11} style={{ color: DS.inkDis }} /></button>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {[['OBJECTIVE','objective','What are they trying to achieve?'],['INCENTIVES','incentives','What drives their decisions?'],['CAPABILITIES','capabilities','What can they actually do?'],['LIKELY BEHAVIOR','likelyBehavior','How will they respond to our moves?']].map(([label,field,ph])=>(
                      <div key={field as string}>
                        <div className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>{label}</div>
                        <Textarea value={(player as any)[field as string]} onChange={e => updatePlayer(player.id, field as string, e.target.value)} placeholder={ph as string} rows={2} className="text-[10px] resize-none" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DQPrinciple text="Strategic empathy: understanding an opponent's incentives and constraints is more valuable than understanding your own options. The best strategists think deeply about what others want, fear, and believe." color={modeCfg.color} />
        </div>
      )}

      {/* ══ MATRIX TAB ══════════════════════════════════════════════════════════ */}
      {(mode === 'standard' || mode === 'full') && activeTab === 'Matrix' && (
        <div className="space-y-4">
          {!activeModel ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <BarChart2 size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.inkDis }} />
              <p className="text-sm font-medium mb-4" style={{ color: DS.ink }}>No game model selected</p>
              <Button style={{ background: modeCfg.color }} onClick={createModel} className="gap-2"><Plus size={14} /> Create Game Model</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Input value={activeModel.name} onChange={e => setModels(p=>p.map(m=>m.id===activeModel.id?{...m,name:e.target.value}:m))} className="text-sm font-bold flex-1" />
                <Button size="sm" className="gap-1 text-xs h-7" style={{ background: modeCfg.color }} onClick={aiAnalyseMatrix} disabled={busy}>
                  <Sparkles size={11} /> AI Analyse
                </Button>
              </div>

              {/* Payoff matrix */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: DS.borderLight, background: DS.bg }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>2×2 PAYOFF MATRIX — (Our payoff, Their payoff) · 1=Very Bad → 5=Very Good</div>
                  <div className="flex gap-1">
                    {['simultaneous','sequential'].map(cls => (
                      <button key={cls} onClick={() => setModels(p=>p.map(m=>m.id===activeModel.id?{...m,gameClass:cls as GameClass}:m))}
                        className="text-[9px] px-2 py-0.5 rounded" style={{ background: activeModel.gameClass===cls ? modeCfg.color : DS.bg, color: activeModel.gameClass===cls ? '#fff' : DS.inkSub }}>
                        {GAME_CLASSES[cls as GameClass].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto p-4">
                  <table style={{ borderSpacing: 8, borderCollapse: 'separate' }}>
                    <thead>
                      <tr>
                        <th className="w-32 text-left">
                          <div className="text-[9px]" style={{ color: DS.inkDis }}>OUR MOVE ↓ / THEIR MOVE →</div>
                        </th>
                        {activeModel.opponentMoves.map((m,ci) => (
                          <th key={m.id} className="text-center">
                            <Input value={m.label} onChange={e=>setModels(p=>p.map(mod=>mod.id===activeModel.id?{...mod,opponentMoves:mod.opponentMoves.map(om=>om.id===m.id?{...om,label:e.target.value}:om)}:mod))}
                              className="text-[10px] font-semibold text-center h-7 border-0 bg-transparent" style={{ color: DS.inkSub }} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeModel.ourMoves.map((ourMove,ri) => (
                        <tr key={ourMove.id}>
                          <td>
                            <Input value={ourMove.label} onChange={e=>setModels(p=>p.map(mod=>mod.id===activeModel.id?{...mod,ourMoves:mod.ourMoves.map(om=>om.id===ourMove.id?{...om,label:e.target.value}:om)}:mod))}
                              className="text-[10px] font-semibold h-7 border-0 bg-transparent" style={{ color: DS.ink }} />
                          </td>
                          {activeModel.opponentMoves.map((_,ci) => {
                            const cell = activeModel.payoffMatrix.find(c=>c.row===ri&&c.col===ci)||{row:ri,col:ci,usPayoff:2,opponentPayoff:2};
                            return (
                              <td key={ci} className="p-1 text-center">
                                <div className="rounded-xl p-2" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}`, minWidth: 130 }}>
                                  <div className="grid grid-cols-2 gap-1 mb-1">
                                    {(['usPayoff','opponentPayoff'] as const).map((field,fi) => (
                                      <div key={field}>
                                        <div className="text-[7px] font-bold uppercase mb-0.5" style={{ color: fi===0 ? modeCfg.color : DS.inkDis }}>{fi===0?'US':'THEM'}</div>
                                        <div className="flex gap-0.5 justify-center">
                                          {[1,2,3,4,5].map(v=>(
                                            <button key={v} onClick={()=>updatePayoff(activeModel.id,ri,ci,field,v)}
                                              className="w-5 h-5 rounded text-[8px] font-bold"
                                              style={{ background: cell[field]===v ? payoffColor(v) : DS.bg, color: cell[field]===v?'#fff':DS.inkDis, border: `1px solid ${cell[field]===v?payoffColor(v):DS.borderLight}` }}>
                                              {v}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="text-[7px] mt-0.5 text-center" style={{ color: payoffColor(cell[field]) }}>{payoffLabel(cell[field])}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-[8px] font-bold" style={{ color: DS.inkDis }}>({cell.usPayoff}, {cell.opponentPayoff})</div>
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

              {/* Matrix analysis results */}
              {matrixAnalysis && (
                <div className="grid grid-cols-2 gap-3">
                  {[['DOMINANT STRATEGY', matrixAnalysis.dominantStrategy||'None — use mixed strategy'],['NASH EQUILIBRIUM',matrixAnalysis.nashEquilibrium],['PARETO OPTIMAL',matrixAnalysis.paretoOptimal],['RECOMMENDED MOVE',matrixAnalysis.recommendedStrategy]].map(([label,val])=>(
                    <div key={label as string} className="p-3 rounded-xl" style={{ background: DS.bg }}>
                      <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>{label}</div>
                      <p className="text-xs font-medium" style={{ color: DS.ink }}>{val as string||'—'}</p>
                    </div>
                  ))}
                  <div className="col-span-2 p-3 rounded-xl" style={{ background: `${modeCfg.color}10`, border: `1px solid ${modeCfg.color}25` }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: modeCfg.color }}>STRATEGIC INSIGHT</div>
                    <p className="text-xs" style={{ color: DS.inkSub }}>{matrixAnalysis.strategicInsight}</p>
                  </div>
                  {matrixAnalysis.warnings?.map((w: string, i: number) => (
                    <div key={i} className="col-span-2 flex items-start gap-2 p-2 rounded-lg" style={{ background: DS.dangerSoft }}>
                      <AlertTriangle size={11} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />
                      <p className="text-[10px]" style={{ color: DS.inkSub }}>{w}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <DQPrinciple text="Build the payoff matrix, find dominant strategies, identify Nash equilibria, and check for Pareto improvements. A strategy that looks best in isolation often looks different once opponent reactions are modelled." color={modeCfg.color} />
        </div>
      )}

      {/* ══ SIGNALS TAB ════════════════════════════════════════════════════════ */}
      {(mode === 'standard' || mode === 'full') && activeTab === 'Signals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Credible signals and commitment devices change the game structure itself. A threat is only as powerful as its credibility.</p>
            <Button size="sm" className="gap-1 text-xs h-7" style={{ background: modeCfg.color }} onClick={aiEscalation} disabled={busy}>
              <Sparkles size={11} /> {busy?'Mapping…':'Map Signals & Escalation'}
            </Button>
          </div>
          {!escalationMap ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Zap size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.warning }} />
              <p className="text-sm font-medium mb-4" style={{ color: DS.ink }}>Signaling & Escalation Analysis</p>
              <Button style={{ background: modeCfg.color }} onClick={aiEscalation} disabled={busy} className="gap-2"><Sparkles size={14} /> Run Analysis</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: escalationMap.overallEscalationRisk==='High'?DS.dangerSoft:escalationMap.overallEscalationRisk==='Medium'?DS.warnSoft:DS.successSoft }}>
                <div className="text-2xl font-black" style={{ color: escalationMap.overallEscalationRisk==='High'?DS.danger:escalationMap.overallEscalationRisk==='Medium'?DS.warning:DS.success }}>{escalationMap.overallEscalationRisk}</div>
                <div className="text-xs font-bold" style={{ color: DS.ink }}>Overall Escalation Risk</div>
              </div>
              {escalationMap.escalationChains?.map((chain: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-xs flex-1" style={{ color: DS.ink }}>{chain.trigger}</div>
                  <ArrowRight size={12} style={{ color: DS.inkDis, flexShrink: 0 }} />
                  <div className="text-xs flex-1" style={{ color: DS.inkSub }}>{chain.response}</div>
                  <ArrowRight size={12} style={{ color: DS.inkDis, flexShrink: 0 }} />
                  <div className="text-xs flex-1" style={{ color: DS.danger }}>{chain.consequence}</div>
                  <Badge style={{ background: chain.probability==='high'?DS.dangerSoft:chain.probability==='medium'?DS.warnSoft:DS.successSoft, color: chain.probability==='high'?DS.danger:chain.probability==='medium'?DS.warning:DS.success, border:'none', fontSize:8 }}>{chain.probability}</Badge>
                </div>
              ))}
              {escalationMap.signalingOpportunities?.map((s: any, i: number) => (
                <div key={i} className="p-2.5 rounded-xl" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}25` }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold" style={{ color: DS.ink }}>{s.signal}</span>
                    <Badge style={{ background: s.credibility==='high'?DS.success+'20':DS.warning+'20', color: s.credibility==='high'?DS.success:DS.warning, border:'none', fontSize:8 }}>{s.credibility} credibility</Badge>
                  </div>
                  <p className="text-[9px]" style={{ color: DS.inkSub }}>{s.intendedMessage}</p>
                </div>
              ))}
            </div>
          )}
          <DQPrinciple text="Signaling and commitment: credible signals change the game structure itself. A threat is only as powerful as its credibility. A promise is only as valuable as its enforceability. Design commitment devices before you need them." color={modeCfg.color} />
        </div>
      )}

      {/* ══ EXECUTION TAB ═══════════════════════════════════════════════════════ */}
      {(mode === 'standard' || mode === 'full') && activeTab === 'Execution' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>The dynamic roadmap: your moves, expected responses, contingencies, and trigger points sequenced over time.</p>
            <Button size="sm" className="gap-1 text-xs h-7" style={{ background: modeCfg.color }} onClick={aiExecutionPlan} disabled={busy}>
              <Sparkles size={11} /> {busy?'Building…':'Build Roadmap'}
            </Button>
          </div>
          {!executionPlan ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <TrendingUp size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.inkDis }} />
              <p className="text-sm font-medium mb-4" style={{ color: DS.ink }}>Dynamic Execution Roadmap</p>
              <Button style={{ background: modeCfg.color }} onClick={aiExecutionPlan} disabled={busy} className="gap-2"><Sparkles size={14} /> Build Roadmap</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {executionPlan.winCondition && <div className="p-4 rounded-xl" style={{ background: `${modeCfg.color}10`, border: `1px solid ${modeCfg.color}25` }}><div className="text-[9px] font-bold uppercase mb-1" style={{ color: modeCfg.color }}>WIN CONDITION</div><p className="text-sm font-semibold" style={{ color: DS.ink }}>{executionPlan.winCondition}</p></div>}
              {executionPlan.roadmap?.map((step: any, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: modeCfg.color }}>{i+1}</div>
                    {i < executionPlan.roadmap.length-1 && <div className="flex-1 w-px my-1" style={{ background: DS.borderLight }} />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: modeCfg.color }}>{step.phase} · {step.timing}</div>
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
                    {step.contingency && <div className="mt-1.5 p-2 rounded-lg" style={{ background: DS.warnSoft }}><div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.warning }}>CONTINGENCY</div><p className="text-[10px]" style={{ color: DS.inkSub }}>{step.contingency}</p></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DQPrinciple text="The execution roadmap shows how player interactions unfold over time. Identify trigger points, contingent moves, and the tactical sequence that implements your strategy. Plan your responses before opponents make their moves." color={modeCfg.color} />
        </div>
      )}

      {/* ══ FULL MODE: COALITIONS ════════════════════════════════════════════════ */}
      {mode === 'full' && activeTab === 'Coalitions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: DS.ink }}>Cooperative Game Theory — Coalition Analysis</p>
              <p className="text-xs" style={{ color: DS.inkSub }}>{GAME_CLASSES.cooperative.theory}</p>
            </div>
            <Button size="sm" className="gap-1 text-xs h-7" style={{ background: '#7C3AED' }} onClick={aiCoalition} disabled={busy}><Sparkles size={11} /> Analyse Coalitions</Button>
          </div>
          {!coalitionAnalysis ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Users size={28} className="mx-auto mb-2 opacity-20" style={{ color: '#7C3AED' }} />
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Identify stable coalitions, Shapley values, and coalition leverage points</p>
              <Button style={{ background: '#7C3AED' }} onClick={aiCoalition} disabled={busy} className="gap-2"><Sparkles size={14} /> Run Coalition Analysis</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {coalitionAnalysis.grandCoalitionValue && <div className="p-3 rounded-xl" style={{ background: '#F5F3FF' }}><div className="text-[9px] font-bold uppercase mb-1" style={{ color: '#7C3AED' }}>GRAND COALITION VALUE</div><p className="text-xs" style={{ color: DS.ink }}>{coalitionAnalysis.grandCoalitionValue}</p></div>}
              {coalitionAnalysis.stableCoalitions?.map((c: any, i: number) => (
                <div key={i} className="p-3 rounded-xl border" style={{ borderColor: DS.borderLight }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold" style={{ color: DS.ink }}>{c.members?.join(' + ')}</span>
                    <Badge style={{ background: c.stability==='high'?DS.successSoft:c.stability==='medium'?DS.warnSoft:DS.dangerSoft, color: c.stability==='high'?DS.success:c.stability==='medium'?DS.warning:DS.danger, border:'none', fontSize:8 }}>{c.stability} stability</Badge>
                  </div>
                  <p className="text-[10px] mb-0.5" style={{ color: DS.inkSub }}>{c.rationale}</p>
                  {c.value && <p className="text-[9px]" style={{ color: DS.accent }}>Value: {c.value}</p>}
                </div>
              ))}
              {coalitionAnalysis.shapleyValues?.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>SHAPLEY VALUES — fair contribution of each player</div>
                  {coalitionAnalysis.shapleyValues.map((sv: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 mb-1 p-2 rounded-lg" style={{ background: DS.bg }}>
                      <span className="text-xs font-medium flex-1" style={{ color: DS.ink }}>{sv.player}</span>
                      <span className="text-xs font-bold" style={{ color: '#7C3AED' }}>{sv.value}</span>
                      <span className="text-[9px]" style={{ color: DS.inkDis }}>{sv.interpretation}</span>
                    </div>
                  ))}
                </div>
              )}
              {coalitionAnalysis.recommendedCoalition && <div className="p-3 rounded-xl" style={{ background: DS.accentSoft }}><div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.accent }}>RECOMMENDED COALITION</div><p className="text-xs" style={{ color: DS.ink }}>{coalitionAnalysis.recommendedCoalition}</p></div>}
            </div>
          )}
        </div>
      )}

      {/* ══ FULL MODE: REPEATED GAMES ════════════════════════════════════════════ */}
      {mode === 'full' && activeTab === 'Repeated' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: DS.ink }}>Repeated Game Theory — Multi-Round Dynamics</p>
              <p className="text-xs" style={{ color: DS.inkSub }}>{GAME_CLASSES.repeated.theory}</p>
            </div>
            <Button size="sm" className="gap-1 text-xs h-7" style={{ background: '#7C3AED' }} onClick={aiRepeatedGame} disabled={busy}><Sparkles size={11} /> Analyse Repeated Game</Button>
          </div>
          {!repeatedGameAnalysis ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <RefreshCw size={28} className="mx-auto mb-2 opacity-20" style={{ color: '#7C3AED' }} />
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Analyse tit-for-tat, trigger strategies, reputation effects, and multi-round cooperation viability</p>
              <Button style={{ background: '#7C3AED' }} onClick={aiRepeatedGame} disabled={busy} className="gap-2"><Sparkles size={14} /> Run Analysis</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-xl" style={{ background: repeatedGameAnalysis.cooperationViable ? DS.successSoft : DS.dangerSoft }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: repeatedGameAnalysis.cooperationViable ? DS.success : DS.danger }}>
                    {repeatedGameAnalysis.cooperationViable ? 'Cooperation is viable' : 'Cooperation is fragile'}
                  </span>
                </div>
                <p className="text-xs" style={{ color: DS.inkSub }}>{repeatedGameAnalysis.cooperationConditions}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>RECOMMENDED STRATEGY</div>
                  <p className="text-xs font-bold capitalize" style={{ color: '#7C3AED' }}>{repeatedGameAnalysis.recommendedStrategy?.replace(/-/g,' ')}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{repeatedGameAnalysis.strategyRationale}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>REPUTATION EFFECTS</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{repeatedGameAnalysis.reputationEffects}</p>
                </div>
              </div>
              {repeatedGameAnalysis.roundByRoundGuidance?.map((r: any, i: number) => (
                <div key={i} className="flex gap-2 p-2.5 rounded-lg" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: '#7C3AED' }}>{i+1}</div>
                  <div><span className="text-[10px] font-bold" style={{ color: DS.ink }}>{r.round}: </span><span className="text-[10px]" style={{ color: DS.inkSub }}>{r.action} — {r.rationale}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ FULL MODE: AUCTION ═══════════════════════════════════════════════════ */}
      {mode === 'full' && activeTab === 'Auction' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: DS.ink }}>Auction Theory — Bidding Strategy</p>
              <p className="text-xs" style={{ color: DS.inkSub }}>{GAME_CLASSES.auction.theory}</p>
            </div>
            <Button size="sm" className="gap-1 text-xs h-7" style={{ background: '#7C3AED' }} onClick={aiAuction} disabled={busy}><Sparkles size={11} /> Analyse Auction</Button>
          </div>
          {!auctionAnalysis ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Award size={28} className="mx-auto mb-2 opacity-20" style={{ color: '#7C3AED' }} />
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Identify auction format, winner's curse risk, optimal bid strategy, and information advantages</p>
              <Button style={{ background: '#7C3AED' }} onClick={aiAuction} disabled={busy} className="gap-2"><Sparkles size={14} /> Run Auction Analysis</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[['AUCTION FORMAT', auctionAnalysis.auctionFormat, DS.accent],['WINNER\'S CURSE RISK', auctionAnalysis.winnersCurseRisk, auctionAnalysis.winnersCurseRisk==='High'?DS.danger:DS.warning],['INFO ADVANTAGE', auctionAnalysis.privateInfoAdvantage, DS.success]].map(([label, val, color])=>(
                  <div key={label as string} className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>{label}</div>
                    <p className="text-xs font-bold" style={{ color: color as string }}>{val as string}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}25` }}>
                <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.accent }}>OPTIMAL BID STRATEGY</div>
                <p className="text-xs font-semibold mb-2" style={{ color: DS.ink }}>{auctionAnalysis.optimalBidStrategy}</p>
                {auctionAnalysis.bidRange && <p className="text-[10px]" style={{ color: DS.inkSub }}>Range: {auctionAnalysis.bidRange.low} – {auctionAnalysis.bidRange.high}. {auctionAnalysis.bidRange.rationale}</p>}
              </div>
              {auctionAnalysis.tacticalRecommendations?.map((t: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[10px] p-2 rounded-lg" style={{ background: DS.bg }}>
                  <CheckCircle size={10} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} /><span style={{ color: DS.inkSub }}>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ FULL MODE: BARGAINING ════════════════════════════════════════════════ */}
      {mode === 'full' && activeTab === 'Bargaining' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: DS.ink }}>Bargaining Theory — Negotiation Analysis</p>
              <p className="text-xs" style={{ color: DS.inkSub }}>{GAME_CLASSES.bargaining.theory}</p>
            </div>
            <Button size="sm" className="gap-1 text-xs h-7" style={{ background: '#7C3AED' }} onClick={aiBargaining} disabled={busy}><Sparkles size={11} /> Analyse Bargaining</Button>
          </div>
          {!bargainingAnalysis ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Scale size={28} className="mx-auto mb-2 opacity-20" style={{ color: '#7C3AED' }} />
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Map BATNA, ZOPA, bargaining power, Nash bargaining solution, and optimal negotiation sequence</p>
              <Button style={{ background: '#7C3AED' }} onClick={aiBargaining} disabled={busy} className="gap-2"><Sparkles size={14} /> Run Bargaining Analysis</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[['OUR BATNA', bargainingAnalysis.ourBATNA, DS.success],['THEIR BATNA', bargainingAnalysis.theirBATNA, DS.inkSub],['ZONE OF AGREEMENT (ZOPA)', bargainingAnalysis.zopa, DS.accent],['NASH BARGAINING SOLUTION', bargainingAnalysis.nashSolution, '#7C3AED']].map(([label,val,color])=>(
                  <div key={label as string} className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>{label}</div>
                    <p className="text-xs font-medium" style={{ color: color as string }}>{val as string||'—'}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl" style={{ background: DS.accentSoft }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-[9px] font-bold uppercase" style={{ color: DS.accent }}>BARGAINING POWER</div>
                  <Badge style={{ background: bargainingAnalysis.bargainingPower==='us'?DS.success:bargainingAnalysis.bargainingPower==='them'?DS.danger:DS.warning, color:'#fff', border:'none', fontSize:8 }}>
                    {bargainingAnalysis.bargainingPower==='us'?'We have advantage':bargainingAnalysis.bargainingPower==='them'?'They have advantage':'Balanced'}
                  </Badge>
                </div>
                <p className="text-[10px]" style={{ color: DS.inkSub }}>{bargainingAnalysis.powerRationale}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>FIRST OFFER</div>
                  <p className="text-xs" style={{ color: DS.ink }}>{bargainingAnalysis.firstOffer}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>CONCESSION STRATEGY</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{bargainingAnalysis.concessionStrategy}</p>
                </div>
              </div>
              {bargainingAnalysis.dealBreakers?.length > 0 && (
                <div className="p-3 rounded-xl" style={{ background: DS.dangerSoft }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.danger }}>DEAL BREAKERS</div>
                  {bargainingAnalysis.dealBreakers.map((db: string, i: number) => (
                    <p key={i} className="text-[10px]" style={{ color: DS.inkSub }}>• {db}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span style={{ color: modeCfg.color }}>{modeCfg.label}</span>
          {mode !== 'quick' && <><span>·</span><span>{GAME_TYPES[gameType].label}</span><span>·</span><span>{GAME_CLASSES[gameClass].label}</span></>}
          {players.length > 0 && <><span>·</span><span>{players.length} players</span></>}
        </div>
        <div className="flex gap-2">
          {mode !== 'full' && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setMode(mode === 'quick' ? 'standard' : 'full')}>
              Upgrade to {mode === 'quick' ? 'Standard' : 'Full'} <ChevronRight size={11} />
            </Button>
          )}
          {mode !== 'quick' && modeCfg.tabs.indexOf(activeTab) < modeCfg.tabs.length - 1 && (
            <Button size="sm" className="h-7 text-xs gap-1" style={{ background: modeCfg.color }}
              onClick={() => setActiveTab(modeCfg.tabs[modeCfg.tabs.indexOf(activeTab) + 1])}>
              Next <ChevronRight size={11} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DQPrinciple({ text, color = DS.accent }: { text: string; color?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl mt-2" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <Lightbulb size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color }}>STRATEGIC GAMING PRINCIPLE</div>
        <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{text}</p>
      </div>
    </div>
  );
}
