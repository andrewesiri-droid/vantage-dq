import { useState, useCallback, useMemo } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table2, Plus, Trash2, BrainCircuit, CheckCircle2, AlertTriangle,
  Lightbulb, Wand2, Layers, Target, Sparkles, ChevronRight, X
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────
   STRATEGY TABLE — Professional rewrite
   Each strategy: objective + rationale + description
   Each decision: editable menu of options, click to select
   Selected option gets strategy color
   AI Fill: auto-completes based on DQ principles
   ──────────────────────────────────────────────────────────── */

const S_COLORS = [
  { fill: '#2563EB', soft: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { fill: '#059669', soft: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  { fill: '#DC2626', soft: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  { fill: '#7C3AED', soft: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  { fill: '#D97706', soft: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  { fill: '#0891B2', soft: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' },
];

/* ── Types ── */
interface Strategy {
  id: number;
  name: string;
  objective: string;
  rationale: string;
  description: string;
  colorIdx: number;
  selections: Record<string, number>;
}

interface FocusDecision {
  id: string;
  label: string;
  options: string[];
}

/* ── Demo Data ── */
const DEMO_STRATEGIES: Strategy[] = [
  {
    id: 1, name: 'Alpha', colorIdx: 0,
    objective: 'Maximise long-term market control and brand ownership in APAC. Build a self-sustaining regional operation within 36 months.',
    rationale: 'Direct subsidiary provides maximum operational control, deepest customer relationships, and highest long-term margin profile. The $25M capital envelope is sufficient for a phased entry starting with Singapore.',
    description: 'Full commitment — direct subsidiary build. Maximum control, maximum capital.',
    selections: {},
  },
  {
    id: 2, name: 'Beta', colorIdx: 1,
    objective: 'Achieve fastest time-to-revenue with minimum capital at risk. Preserve strategic optionality for Year 2 expansion decisions.',
    rationale: 'Strategic partnership with an established local player de-risks market entry, accelerates customer acquisition, and reduces capital requirement by 60%. Partner bears operational complexity while we build market presence.',
    description: 'Asset-light — strategic partnership model. Balanced risk and speed.',
    selections: {},
  },
  {
    id: 3, name: 'Gamma', colorIdx: 2,
    objective: 'Capture dominant market position rapidly through acquisition of an established APAC player with existing revenue and customer base.',
    rationale: 'Acquisition compresses time-to-market from 24 months to 6 months. Targets $8-15M ARR businesses in Singapore or Australia. Integration risk is real but quantifiable.',
    description: 'Aggressive M&A — acquire to enter fast. Highest speed, highest risk.',
    selections: {},
  },
];

const DEMO_DECISIONS: FocusDecision[] = [
  { id: 'd1', label: 'Market Entry Mode', options: ['Direct subsidiary', 'Strategic partnership', 'Acquisition target', 'Joint venture'] },
  { id: 'd2', label: 'Primary Market',    options: ['Singapore', 'Japan', 'Australia', 'South Korea'] },
  { id: 'd3', label: 'Capital Allocation', options: ['Front-load Year 1 ($18M)', 'Even split Year 1-2 ($12M/$13M)', 'Back-load ($10M Year 1)', 'Market-dependent tranches'] },
  { id: 'd4', label: 'Technology Approach', options: ['Full localisation', 'English-only with APAC CDN', 'Partner-hosted locally', 'Cloud-neutral multi-region'] },
  { id: 'd5', label: 'Revenue Model',     options: ['Enterprise direct sales', 'Partner-led GTM', 'Hybrid: partner + direct', 'Platform/API-first'] },
];

/* ── AI Logic ── */
function aiSelectOptions(strategies: Strategy[], decisions: FocusDecision[]): Strategy[] {
  return strategies.map(s => {
    const sel: Record<string, number> = {};
    const obj = s.objective.toLowerCase();
    const rat = s.rationale.toLowerCase();

    decisions.forEach(d => {
      if (s.selections[d.id] !== undefined) return; // don't overwrite existing
      let bestIdx = 0;

      if (d.id === 'd1') { // entry mode
        if (rat.includes('direct') || rat.includes('subsidiary')) bestIdx = 0;
        else if (rat.includes('partner')) bestIdx = 1;
        else if (rat.includes('acqui')) bestIdx = 2;
        else if (rat.includes('joint') || rat.includes('venture')) bestIdx = 3;
      }
      else if (d.id === 'd2') { // primary market
        if (obj.includes('singapore') || rat.includes('singapore')) bestIdx = 0;
        else if (obj.includes('japan') || rat.includes('japan')) bestIdx = 1;
        else if (obj.includes('australia') || rat.includes('australia')) bestIdx = 2;
        else bestIdx = 0; // default Singapore
      }
      else if (d.id === 'd3') { // capital
        if (obj.includes('minimum capital') || rat.includes('reduce capital') || rat.includes('60%')) bestIdx = 2;
        else if (obj.includes('dominant') || obj.includes('rapid')) bestIdx = 0;
        else bestIdx = 1;
      }
      else if (d.id === 'd4') { // technology
        if (rat.includes('localisation') || rat.includes('data residency')) bestIdx = 0;
        else if (rat.includes('partner')) bestIdx = 2;
        else bestIdx = 3;
      }
      else if (d.id === 'd5') { // revenue
        if (rat.includes('partner') && rat.includes('direct')) bestIdx = 2;
        else if (rat.includes('partner')) bestIdx = 1;
        else bestIdx = 0;
      }

      // Only auto-fill if the rationale gives a clear signal
      const combined = obj + ' ' + rat;
      const optionLabels = d.options.map(o => o.toLowerCase());
      const hasSignal = optionLabels.some((opt, i) => combined.includes(opt.split(' ')[0]) && i === bestIdx);
      if (hasSignal || s.selections[d.id] === undefined) {
        sel[d.id] = bestIdx;
      }
    });

    return { ...s, selections: { ...s.selections, ...sel } };
  });
}

function aiRationale(s: Strategy, d: FocusDecision, selectedIdx: number): string {
  const option = d.options[selectedIdx];
  const name = s.name;
  const templates: Record<string, string> = {
    d1: `${name} selects ${option} because ${s.rationale.slice(0, 60)}... This entry mode best supports the objective: ${s.objective.slice(0, 60)}.`,
    d2: `${name} prioritises ${option} as the primary market. ${s.rationale.slice(0, 70)}.`,
    d3: `${name} allocates capital as: ${option}. This matches the capital-risk profile described in the strategy rationale.`,
    d4: `${name} adopts a ${option} approach for technology deployment, consistent with the overall ${s.name.toLowerCase()} model.`,
    d5: `${name} pursues a ${option} revenue strategy, leveraging the strengths of the chosen entry mode.`,
  };
  return templates[d.id] || `${name} selects ${option} to support its core objective.`;
}

/* ── Main Component ── */
export function StrategyTable({ sessionId, data, hooks }: ModuleProps) {
  const [strategies, setStrategies] = useState<Strategy[]>(DEMO_STRATEGIES);
  const [decisions, setDecisions] = useState<FocusDecision[]>(DEMO_DECISIONS);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);

  /* Strategy form */
  const [newName, setNewName] = useState('');
  const [newObj, setNewObj] = useState('');
  const [newRat, setNewRat] = useState('');
  const [newDesc, setNewDesc] = useState('');

  /* Local edits for strategy fields */
  const updateStrategy = (id: number, field: keyof Strategy, value: any) => {
    setStrategies(p => p.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const updateSelection = (sid: number, did: string, idx: number) => {
    setStrategies(p => p.map(s => s.id === sid ? { ...s, selections: { ...s.selections, [did]: idx } } : s));
  };

  const addStrategy = () => {
    if (!newName.trim()) return;
    const newS: Strategy = {
      id: Date.now(), name: newName.trim(), objective: newObj, rationale: newRat,
      description: newDesc, colorIdx: strategies.length % S_COLORS.length, selections: {},
    };
    setStrategies(p => [...p, newS]);
    setNewName(''); setNewObj(''); setNewRat(''); setNewDesc('');
    hooks?.createStrategy?.({ sessionId, name: newName.trim(), description: newDesc });
  };

  const removeStrategy = (id: number) => setStrategies(p => p.filter(s => s.id !== id));

  /* Decision option management */
  const addOption = (did: string) => {
    setDecisions(p => p.map(d => d.id === did ? { ...d, options: [...d.options, `Option ${d.options.length + 1}`] } : d));
  };
  const updateOption = (did: string, idx: number, val: string) => {
    setDecisions(p => p.map(d => d.id === did ? { ...d, options: d.options.map((o, i) => i === idx ? val : o) } : d));
  };
  const removeOption = (did: string, idx: number) => {
    setDecisions(p => p.map(d => d.id === did ? { ...d, options: d.options.filter((_, i) => i !== idx) } : d));
    // Clear any selections that pointed to this option
    setStrategies(p => p.map(s => ({
      ...s,
      selections: Object.fromEntries(Object.entries(s.selections).filter(([k, v]) => !(k === did && v === idx))),
    })));
  };

  /* AI Fill */
  const handleAiFill = () => {
    setStrategies(aiSelectOptions(strategies, decisions));
    setAiFilled(true);
    setTimeout(() => setAiFilled(false), 3000);
  };

  /* Analysis */
  const completeness = (s: Strategy) => {
    const filled = decisions.filter(d => s.selections[d.id] !== undefined).length;
    return { filled, total: decisions.length, pct: decisions.length ? Math.round((filled / decisions.length) * 100) : 0 };
  };

  const distinctiveness = useMemo(() => {
    const pairs: { pair: string; diffCount: number; total: number }[] = [];
    for (let i = 0; i < strategies.length; i++) {
      for (let j = i + 1; j < strategies.length; j++) {
        let diffCount = 0;
        decisions.forEach(d => { if (strategies[i].selections[d.id] !== strategies[j].selections[d.id]) diffCount++; });
        pairs.push({ pair: `${strategies[i].name} vs ${strategies[j].name}`, diffCount, total: decisions.length });
      }
    }
    return pairs;
  }, [strategies, decisions]);

  const allComplete = strategies.every(s => completeness(s).pct === 100);

  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <Table2 size={22} style={{ color: DS.alternatives.fill }} /> Strategy Table
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>
            {strategies.length} strategies &middot; {decisions.length} focus decisions &middot; {strategies.filter(s => completeness(s).pct === 100).length} complete
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 text-[10px] gap-1" style={{ background: '#7C3AED' }} onClick={handleAiFill}>
            <Wand2 size={12} /> {aiFilled ? 'Filled!' : 'AI Fill'}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1" onClick={() => setAiOpen(!aiOpen)}>
            <BrainCircuit size={12} /> {aiOpen ? 'Hide AI' : 'AI Analysis'}
          </Button>
        </div>
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 100%)`, borderLeft: `4px solid #7C3AED` }}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2"><BrainCircuit size={14} style={{ color: '#7C3AED' }} /><span className="text-xs font-bold" style={{ color: '#6D28D9' }}>AI Strategy Analysis</span></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg" style={{ background: strategies.length >= 3 ? '#ECFDF5' : '#FFFBEB' }}>
                <p className="text-[10px] font-semibold" style={{ color: strategies.length >= 3 ? '#059669' : '#D97706' }}>
                  {strategies.length >= 3 ? <CheckCircle2 size={10} className="inline mr-1" /> : <AlertTriangle size={10} className="inline mr-1" />}
                  {strategies.length} Strategies
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{strategies.length < 2 ? 'Need at least 2 for a real decision.' : strategies.length < 3 ? 'Minimum met. Consider a 3rd for robustness.' : 'Good set. 3+ strategies enable meaningful trade-offs.'}</p>
              </div>
              <div className="p-2.5 rounded-lg" style={{ background: allComplete ? '#ECFDF5' : '#FEF2F2' }}>
                <p className="text-[10px] font-semibold" style={{ color: allComplete ? '#059669' : '#DC2626' }}>
                  {allComplete ? <CheckCircle2 size={10} className="inline mr-1" /> : <AlertTriangle size={10} className="inline mr-1" />}
                  {allComplete ? 'All Strategies Complete' : 'Incomplete Selections'}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>
                  {allComplete ? 'Every strategy has a choice for every decision.' : `${strategies.filter(s => completeness(s).pct < 100).length} strategies missing selections. Click AI Fill or select manually.`}
                </p>
              </div>
              <div className="p-2.5 rounded-lg" style={{ background: '#FFFBEB' }}>
                <p className="text-[10px] font-semibold" style={{ color: '#D97706' }}><Lightbulb size={10} className="inline mr-1" /> DQ Principle</p>
                <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>Strategies must be genuinely distinct — not minor variations. If two strategies choose the same option for most decisions, they are not real alternatives.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STRATEGIES ── */}
      <div className="space-y-4">
        {strategies.map(s => {
          const c = S_COLORS[s.colorIdx % S_COLORS.length];
          const comp = completeness(s);
          return (
            <Card key={s.id} className="overflow-hidden border-0 shadow-md" style={{ borderTop: `3px solid ${c.fill}` }}>
              <CardContent className="p-0">
                {/* Strategy Header — always editable */}
                <div className="p-4 space-y-3" style={{ background: `linear-gradient(135deg, ${c.soft} 0%, #FFFFFF 100%)` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ background: c.fill }} />
                      <Input
                        value={s.name}
                        onChange={e => updateStrategy(s.id, 'name', e.target.value)}
                        className="text-sm font-bold h-7 w-32 bg-white"
                      />
                      <Badge style={{ background: comp.pct === 100 ? c.soft : '#FEF3C7', color: comp.pct === 100 ? c.text : '#D97706', borderColor: comp.pct === 100 ? c.border : '#FDE68A' }} variant="outline" className="text-[9px] h-4">
                        {comp.filled}/{comp.total}
                      </Badge>
                    </div>
                    <button onClick={() => removeStrategy(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                  </div>

                  {/* Objective */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: c.text }}><Target size={9} className="inline mr-1" />Objective</label>
                    <Textarea
                      value={s.objective}
                      onChange={e => updateStrategy(s.id, 'objective', e.target.value)}
                      className="text-xs bg-white leading-relaxed"
                      rows={2}
                      placeholder="What does this strategy aim to achieve?"
                    />
                  </div>

                  {/* Rationale */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: c.text }}><Sparkles size={9} className="inline mr-1" />Rationale</label>
                    <Textarea
                      value={s.rationale}
                      onChange={e => updateStrategy(s.id, 'rationale', e.target.value)}
                      className="text-xs bg-white leading-relaxed"
                      rows={2}
                      placeholder="Why is this the right approach?"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkTer }}>Description</label>
                    <Input
                      value={s.description}
                      onChange={e => updateStrategy(s.id, 'description', e.target.value)}
                      className="text-xs bg-white h-7"
                      placeholder="Short summary"
                    />
                  </div>
                </div>

                {/* Decision Options Grid */}
                <div className="p-4 border-t" style={{ borderColor: DS.borderLight }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkTer }}>
                    <Layers size={9} className="inline mr-1" /> Decision Selections
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {decisions.map(d => {
                      const selectedIdx = s.selections[d.id];
                      return (
                        <div key={d.id} className="rounded-lg border overflow-hidden" style={{
                          borderColor: selectedIdx !== undefined ? c.border : DS.borderLight,
                          background: selectedIdx !== undefined ? c.soft : DS.bg,
                        }}>
                          {/* Decision label */}
                          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: selectedIdx !== undefined ? c.border : DS.borderLight, background: selectedIdx !== undefined ? c.soft : DS.bg }}>
                            <span className="text-[10px] font-bold" style={{ color: selectedIdx !== undefined ? c.text : DS.inkSub }}>{d.label}</span>
                            {selectedIdx !== undefined && <CheckCircle2 size={10} style={{ color: c.fill }} />}
                          </div>
                          {/* Options */}
                          <div className="p-1.5 space-y-0.5">
                            {d.options.map((opt, idx) => {
                              const isSelected = s.selections[d.id] === idx;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => updateSelection(s.id, d.id, idx)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all text-[10px]"
                                  style={{
                                    background: isSelected ? c.fill : 'transparent',
                                    color: isSelected ? '#FFFFFF' : DS.inkSub,
                                  }}
                                >
                                  <span className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0" style={{
                                    borderColor: isSelected ? '#FFFFFF' : DS.inkDis,
                                    background: isSelected ? c.fill : 'transparent',
                                  }}>
                                    {isSelected && <CheckCircle2 size={8} style={{ color: '#FFFFFF' }} />}
                                  </span>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI-generated choice rationale (shown if selection exists) */}
                {decisions.some(d => s.selections[d.id] !== undefined) && (
                  <div className="px-4 pb-4">
                    <div className="p-3 rounded-lg border" style={{ background: '#F8FAFC', borderColor: DS.borderLight }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: DS.inkDis }}><BrainCircuit size={9} className="inline mr-1" />Selection Rationale</p>
                      {decisions.filter(d => s.selections[d.id] !== undefined).map(d => (
                        <p key={d.id} className="text-[10px] leading-relaxed mb-1" style={{ color: DS.inkSub }}>
                          <span style={{ color: c.fill, fontWeight: 600 }}>{d.label}:</span> {d.options[s.selections[d.id]]} — {aiRationale(s, d, s.selections[d.id]).slice(0, 120)}...
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── ADD STRATEGY ── */}
      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${DS.alternatives.soft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.alternatives.fill}` }}>
        <CardContent className="pt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.alternatives.fill }}><Plus size={10} className="inline mr-1" />Add Strategy</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Strategy name (e.g. Delta)" className="text-xs bg-white h-8" />
            <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Short description" className="text-xs bg-white h-8" />
          </div>
          <Textarea value={newObj} onChange={e => setNewObj(e.target.value)} placeholder="Objective — What does this strategy aim to achieve?" className="text-xs bg-white" rows={2} />
          <Textarea value={newRat} onChange={e => setNewRat(e.target.value)} placeholder="Rationale — Why is this the right approach? What are the key assumptions?" className="text-xs bg-white" rows={2} />
          <Button size="sm" style={{ background: DS.alternatives.fill }} onClick={addStrategy} disabled={!newName.trim()} className="text-[10px] gap-1">
            <Plus size={10} /> Add Strategy
          </Button>
        </CardContent>
      </Card>

      {/* ── MANAGE DECISION OPTIONS ── */}
      <Card className="border-0 shadow-sm"><CardContent className="pt-5">
        <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: DS.ink }}>
          <Layers size={14} style={{ color: DS.alternatives.fill }} /> Manage Decision Options
        </p>
        <p className="text-[10px] mb-3" style={{ color: DS.inkTer }}>Edit the available options for each focus decision. Clicking an option in the strategy cards selects it.</p>
        <div className="space-y-4">
          {decisions.map(d => (
            <div key={d.id} className="p-3 rounded-lg border" style={{ background: DS.bg, borderColor: DS.borderLight }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: DS.ink }}>{d.label}</span>
                <Button size="sm" variant="ghost" className="h-6 text-[9px] gap-1" onClick={() => addOption(d.id)}><Plus size={8} /> Add Option</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Input
                      value={opt}
                      onChange={e => updateOption(d.id, idx, e.target.value)}
                      className="text-[10px] h-6 w-36 bg-white"
                    />
                    {d.options.length > 2 && (
                      <button onClick={() => removeOption(d.id, idx)} className="text-gray-400 hover:text-red-500"><X size={10} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent></Card>

      {/* ── DISTINCTIVENESS ── */}
      <Card className="border-0 shadow-sm"><CardContent className="pt-5">
        <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: DS.ink }}>
          <CheckCircle2 size={14} style={{ color: DS.alternatives.fill }} /> Distinctiveness Check
        </p>
        <p className="text-[10px] mb-3" style={{ color: DS.inkTer }}>Strategies should differ on at least 50% of decisions to be genuinely distinct alternatives.</p>
        {distinctiveness.map((diff, i) => (
          <div key={i} className="flex items-center gap-3 mb-2 p-2.5 rounded-lg" style={{ background: diff.diffCount >= diff.total / 2 ? '#ECFDF5' : '#FEF2F2' }}>
            <span className="text-xs font-medium" style={{ color: DS.ink }}>{diff.pair}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
              <div className="h-full rounded-full" style={{ width: `${(diff.diffCount / diff.total) * 100}%`, background: diff.diffCount >= diff.total / 2 ? '#059669' : '#DC2626' }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color: diff.diffCount >= diff.total / 2 ? '#059669' : '#DC2626' }}>{diff.diffCount}/{diff.total}</span>
            <Badge style={{ background: diff.diffCount >= diff.total / 2 ? '#ECFDF5' : '#FEF2F2', color: diff.diffCount >= diff.total / 2 ? '#059669' : '#DC2626' }} variant="outline" className="text-[9px] h-4">
              {diff.diffCount >= diff.total / 2 ? 'Distinct' : 'Too Similar'}
            </Badge>
          </div>
        ))}
        {distinctiveness.length === 0 && <p className="text-xs" style={{ color: DS.inkSub }}>Need at least 2 strategies.</p>}
      </CardContent></Card>
    </div>
  );
}
