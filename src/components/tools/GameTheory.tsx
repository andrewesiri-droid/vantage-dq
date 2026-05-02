import { useState, useMemo } from 'react';
import type { ModuleProps } from '@/types';
import { DS, TOOLS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Swords, Users, Target, BrainCircuit, TrendingUp, Shield, AlertTriangle, CheckCircle2, XCircle, Lightbulb, Route, Lock, Zap, Eye, GitBranch, BarChart3, Megaphone, Scale, CircleDot, ArrowRight, X, Info } from 'lucide-react';

interface Player {
  id: string; name: string; archetype: string;
  objectives: string; incentives: string; capabilities: string; constraints: string;
  riskTolerance: 'high' | 'medium' | 'low'; likelyBehavior: string; isFocal: boolean;
}

interface StrategicMove {
  id: string; playerId: string; label: string; description: string;
  type: 'aggressive' | 'cooperative' | 'defensive' | 'signaling' | 'wait';
  timing: 'now' | 'delayed' | 'conditional'; reversibility: 'irreversible' | 'costly' | 'reversible';
}

interface IncentiveAlignment { playerA: string; playerB: string; alignment: 'aligned' | 'conflict' | 'neutral'; topic: string; }

const DEMO_PLAYERS: Player[] = [
  { id: 'p-focal', name: 'Our Company', archetype: 'Internal Stakeholder', objectives: 'Enter APAC market profitably', incentives: 'Revenue growth, market share', capabilities: 'Strong tech platform, $25M capital', constraints: 'Board approval required', riskTolerance: 'medium', likelyBehavior: 'Cautious expansion', isFocal: true },
  { id: 'p-comp', name: 'TechFlow Asia', archetype: 'Competitor', objectives: 'Defend market share', incentives: 'Revenue protection', capabilities: '60% market share, local sales', constraints: 'Limited R&D budget', riskTolerance: 'low', likelyBehavior: 'Retaliate on price', isFocal: false },
  { id: 'p-reg', name: 'Japan Regulator', archetype: 'Regulator', objectives: 'Data sovereignty', incentives: 'Political stability', capabilities: 'Rule-making authority', constraints: 'Trade obligations', riskTolerance: 'low', likelyBehavior: 'Strict but predictable', isFocal: false },
  { id: 'p-partner', name: 'NexGen Partners', archetype: 'Partner', objectives: 'Expand portfolio', incentives: 'Revenue share', capabilities: 'Local network', constraints: 'Limited capital', riskTolerance: 'medium', likelyBehavior: 'Cooperative', isFocal: false },
];

const DEMO_MOVES: StrategicMove[] = [
  { id: 'm1', playerId: 'p-focal', label: 'Aggressive Price Entry', description: '30% below market', type: 'aggressive', timing: 'now', reversibility: 'costly' },
  { id: 'm2', playerId: 'p-focal', label: 'Partnership First', description: 'Partner before direct entry', type: 'cooperative', timing: 'delayed', reversibility: 'reversible' },
  { id: 'm3', playerId: 'p-focal', label: 'Signalling Delay', description: 'Signal 6-month delay', type: 'signaling', timing: 'conditional', reversibility: 'reversible' },
  { id: 'm4', playerId: 'p-comp', label: 'Price Match', description: 'Match our price', type: 'defensive', timing: 'now', reversibility: 'reversible' },
  { id: 'm5', playerId: 'p-comp', label: 'Exclusive Lock-ups', description: 'Lock customers', type: 'aggressive', timing: 'now', reversibility: 'costly' },
  { id: 'm6', playerId: 'p-comp', label: 'Cooperate on Standards', description: 'Industry standards', type: 'cooperative', timing: 'delayed', reversibility: 'reversible' },
];

const DEMO_ALIGNMENTS: IncentiveAlignment[] = [
  { playerA: 'p-focal', playerB: 'p-partner', alignment: 'aligned', topic: 'Market entry' },
  { playerA: 'p-focal', playerB: 'p-comp', alignment: 'conflict', topic: 'Market share' },
  { playerA: 'p-focal', playerB: 'p-reg', alignment: 'aligned', topic: 'Compliance' },
];

const GAME_CATEGORIES = [
  { key: 'coordination', label: 'Coordination', desc: 'Aligning choices', color: '#3B82F6', soft: '#EFF6FF' },
  { key: 'collaboration', label: 'Collaboration', desc: 'Joint value creation', color: '#10B981', soft: '#ECFDF5' },
  { key: 'competitive', label: 'Competitive', desc: 'Rivalrous dynamics', color: '#E11D48', soft: '#FFF1F2' },
  { key: 'signaling', label: 'Signaling', desc: 'Credible commitments', color: '#7C3AED', soft: '#F5F3FF' },
];

export function GameTheory({ sessionId, data, hooks }: ModuleProps) {
  const [stage, setStage] = useState<'framing' | 'evaluation' | 'execution'>('framing');
  const [players, setPlayers] = useState<Player[]>(DEMO_PLAYERS);
  const [moves, setMoves] = useState<StrategicMove[]>(DEMO_MOVES);
  const [alignments] = useState<IncentiveAlignment[]>(DEMO_ALIGNMENTS);
  const [selectedGameType, setSelectedGameType] = useState('competitive');
  const [focalPlayerId] = useState('p-focal');
  const [opponentPlayerId] = useState('p-comp');

  const focalMoves = useMemo(() => moves.filter(m => m.playerId === focalPlayerId), [moves, focalPlayerId]);
  const opponentMovesList = useMemo(() => moves.filter(m => m.playerId === opponentPlayerId), [moves, opponentPlayerId]);

  const insights = useMemo(() => {
    const result: { type: string; severity: string; title: string; description: string }[] = [];
    const competitors = players.filter(p => !p.isFocal && p.archetype === 'Competitor');
    const focal = players.find(p => p.isFocal);
    if (!focal) return result;

    competitors.forEach(comp => {
      const compMoves = moves.filter(m => m.playerId === comp.id);
      const agg = compMoves.filter(m => m.type === 'aggressive');
      if (agg.length > compMoves.length / 2) {
        result.push({ type: 'risk', severity: 'high', title: `${comp.name} likely to retaliate`, description: `Has ${agg.length}/${compMoves.length} aggressive moves. Expect retaliation.` });
      }
    });

    const focalMoves = moves.filter(m => m.playerId === focal.id);
    const irrev = focalMoves.filter(m => m.reversibility === 'irreversible');
    if (irrev.length > 0) {
      result.push({ type: 'warning', severity: 'critical', title: 'Irreversible moves on table', description: `${irrev.length} irreversible move(s). Use strategically.` });
    }

    const signals = moves.filter(m => m.type === 'signaling' && m.playerId === focal.id);
    if (signals.length === 0) {
      result.push({ type: 'recommendation', severity: 'medium', title: 'Add signaling moves', description: 'Test competitor intent before committing.' });
    }

    return result;
  }, [players, moves]);

  const payoffMatrix = useMemo(() => {
    const cells: { fm: string; om: string; rowP: number; colP: number }[] = [];
    focalMoves.forEach(fm => {
      opponentMovesList.forEach(om => {
        let rowP = 0, colP = 0;
        if (fm.type === 'cooperative' && om.type === 'cooperative') { rowP = 7; colP = 7; }
        else if (fm.type === 'aggressive' && om.type === 'defensive') { rowP = 8; colP = 4; }
        else if (fm.type === 'aggressive' && om.type === 'aggressive') { rowP = 3; colP = 3; }
        else { rowP = 5; colP = 5; }
        cells.push({ fm: fm.id, om: om.id, rowP, colP });
      });
    });
    return cells;
  }, [focalMoves, opponentMovesList]);

  const STAGES = [
    { key: 'framing', label: '1. Dynamic Framing', subtitle: 'Players, choices, sequence', color: '#3B82F6' },
    { key: 'evaluation', label: '2. Strategy Evaluation', subtitle: 'Payoffs, equilibrium', color: '#7C3AED' },
    { key: 'execution', label: '3. Execution Planning', subtitle: 'Change the game', color: '#10B981' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Swords size={22} style={{ color: '#7C3AED' }} /> Strategic Gaming</h2>
          <p className="text-[10px] mt-1" style={{ color: DS.inkTer }}>{players.length} players &middot; {moves.length} moves &middot; {insights.length} insights</p>
        </div>
      </div>

      {/* Stage Navigator */}
      <div className="flex items-center gap-2">
        {STAGES.map(s => (
          <button key={s.key} onClick={() => setStage(s.key as any)}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all"
            style={{ background: stage === s.key ? s.color + '12' : 'transparent', border: stage === s.key ? `1.5px solid ${s.color}` : `1px solid ${DS.borderLight}` }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: stage === s.key ? s.color : DS.borderLight }}>
              <span className="text-[9px] font-bold text-white">{s.key === 'framing' ? '1' : s.key === 'evaluation' ? '2' : '3'}</span>
            </div>
            <div>
              <div className="text-[11px] font-semibold" style={{ color: stage === s.key ? s.color : DS.ink }}>{s.label}</div>
              <div className="text-[9px] hidden sm:block" style={{ color: DS.inkTer }}>{s.subtitle}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Game Type */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-medium mr-1" style={{ color: DS.inkTer }}>Game Type:</span>
        {GAME_CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setSelectedGameType(cat.key)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
            style={{ background: selectedGameType === cat.key ? cat.color + '15' : 'transparent', border: selectedGameType === cat.key ? `1.5px solid ${cat.color}` : `1px solid ${DS.borderLight}`, color: selectedGameType === cat.key ? cat.color : DS.inkSub }}>
            <CircleDot size={10} /> {cat.label}
          </button>
        ))}
      </div>

      {/* FRAMING */}
      {stage === 'framing' && (
        <div className="space-y-4">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3"><Users size={14} style={{ color: '#3B82F6' }} /><span className="text-xs font-bold">Players</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {players.map(p => (
                <div key={p.id} className="p-3 rounded-lg border" style={{ background: p.isFocal ? '#F5F3FF' : '#FAFBFF', borderColor: DS.borderLight }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold">{p.name}</span>
                    <Badge className="text-[8px] h-4" variant="outline">{p.archetype}</Badge>
                  </div>
                  <p className="text-[9px] mt-1" style={{ color: DS.inkSub }}>{p.objectives}</p>
                </div>
              ))}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3"><Route size={14} style={{ color: '#0891B2' }} /><span className="text-xs font-bold">Strategic Moves</span></div>
            <div className="space-y-2">
              {moves.map(move => (
                <div key={move.id} className="flex items-center gap-2 p-2 rounded-lg border" style={{ background: '#FAFBFF' }}>
                  <Badge className="text-[8px] h-5 shrink-0" style={{
                    background: move.type === 'aggressive' ? '#FEF2F2' : move.type === 'cooperative' ? '#ECFDF5' : '#F5F3FF',
                    color: move.type === 'aggressive' ? '#DC2626' : move.type === 'cooperative' ? '#059669' : '#7C3AED'
                  }}>{move.type}</Badge>
                  <span className="text-[10px] font-medium">{move.label}</span>
                  <span className="text-[9px] ml-auto" style={{ color: DS.inkTer }}>{move.timing}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3"><Scale size={14} style={{ color: '#10B981' }} /><span className="text-xs font-bold">Incentive Alignment</span></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {alignments.map((a, i) => (
                <div key={i} className="p-2 rounded-lg border flex items-center gap-2" style={{ background: a.alignment === 'aligned' ? '#ECFDF5' : '#FEF2F2', borderColor: a.alignment === 'aligned' ? '#10B981' : '#EF4444' }}>
                  {a.alignment === 'aligned' ? <CheckCircle2 size={12} style={{ color: '#10B981' }} /> : <XCircle size={12} style={{ color: '#EF4444' }} />}
                  <span className="text-[9px]">{a.topic}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* EVALUATION */}
      {stage === 'evaluation' && (
        <div className="space-y-4">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3"><BarChart3 size={14} style={{ color: '#7C3AED' }} /><span className="text-xs font-bold">Payoff Matrix</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Focal \ Opponent</th>
                    {opponentMovesList.map(om => <th key={om.id} className="p-2 text-center"><Badge variant="outline" className="text-[8px]">{om.label.slice(0, 12)}</Badge></th>)}
                  </tr>
                </thead>
                <tbody>
                  {focalMoves.map(fm => (
                    <tr key={fm.id} style={{ borderTop: `1px solid ${DS.borderLight}` }}>
                      <td className="p-2"><Badge variant="outline" className="text-[8px]">{fm.label.slice(0, 15)}</Badge></td>
                      {opponentMovesList.map(om => {
                        const cell = payoffMatrix.find(c => c.fm === fm.id && c.om === om.id);
                        return (
                          <td key={om.id} className="p-1 text-center">
                            <div className="p-1.5 rounded-lg border" style={{ borderColor: DS.borderLight, background: '#FAFBFF' }}>
                              <span className="font-bold" style={{ color: '#7C3AED' }}>{cell?.rowP ?? 0}</span>
                              <span style={{ color: DS.inkDis }}>,</span>
                              <span className="font-bold" style={{ color: '#DC2626' }}>{cell?.colP ?? 0}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent></Card>

          <Card style={{ background: '#FAFBFF', borderLeft: '3px solid #6366F1' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3"><BrainCircuit size={14} style={{ color: '#6366F1' }} /><span className="text-xs font-bold" style={{ color: '#4338CA' }}>Strategic Insights</span></div>
              <div className="space-y-2">
                {insights.map((ins, i) => (
                  <div key={i} className="p-2 rounded" style={{ background: ins.severity === 'critical' ? '#FEF2F2' : ins.severity === 'high' ? '#FFF7ED' : '#FFFBEB' }}>
                    <span className="text-[10px] font-medium">{ins.title}</span>
                    <p className="text-[9px]" style={{ color: DS.inkSub }}>{ins.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EXECUTION */}
      {stage === 'execution' && (
        <div className="space-y-4">
          <Card style={{ borderLeft: '3px solid #10B981' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3"><Zap size={14} style={{ color: '#10B981' }} /><span className="text-xs font-bold">Change the Game</span></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { title: 'Convert to Collaborative', desc: 'Joint value creation', icon: GitBranch },
                  { title: 'Credible Commitments', desc: 'Irreversible signals', icon: Lock },
                  { title: 'Control Information', desc: 'Strategic signaling', icon: Eye },
                  { title: 'Build Coalitions', desc: 'Align with others', icon: Users },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-lg border" style={{ background: '#FAFBFF' }}>
                    <div className="flex items-center gap-2">
                      <item.icon size={12} style={{ color: '#10B981' }} />
                      <span className="text-[11px] font-semibold">{item.title}</span>
                    </div>
                    <p className="text-[9px] mt-1" style={{ color: DS.inkSub }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
