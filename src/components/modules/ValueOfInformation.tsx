/**
 * Value of Information Module — Vantage DQ
 *
 * Built on decision analysis principles:
 * - EVPI: Expected Value of Perfect Information (upper bound on worth of any study)
 * - EVII: Expected Value of Imperfect Information (real study value after accuracy discount)
 * - EVPPI: Expected Value of Partial Perfect Information (per-uncertainty contribution)
 * - Net VOI = Expected benefit of learning minus cost and delay penalty
 *
 * Key guardrails:
 * - Information only has value if it can CHANGE the decision
 * - EVPI is always the ceiling — never pay more than this for imperfect info
 * - Delay has three costs: study cost, cost of delayed action, cost of rework
 * - Irreversible decisions raise the value of learning BEFORE committing
 * - Reversible decisions lower the urgency of pre-decision learning
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
  AlertTriangle, CheckCircle, TrendingUp, Clock,
  DollarSign, BarChart2, Target, Zap, Eye, X,
  ArrowUpDown, Filter, BookOpen, Info
} from 'lucide-react';

// ── TYPES ─────────────────────────────────────────────────────────────────────
type ImpactLevel = 'critical' | 'high' | 'medium' | 'low' | 'negligible';
type VOIVerdict = 'do-now' | 'do-later' | 'conditional' | 'do-not' | 'bundle' | 'proxy';
type AnalysisLevel = 'qualitative' | 'semi-quant' | 'quantitative';
type Reversibility = 'reversible' | 'partially' | 'irreversible';

interface Uncertainty {
  id: number;
  label: string;
  description: string;
  // DQ scoring
  impactOnValue: number;        // 1-5: How much does this affect decision value?
  currentUncertaintyRange: number; // 1-5: How wide is the current uncertainty?
  abilityToReduce: number;      // 1-5: Can we actually learn more?
  likelihoodChangesDecision: number; // 1-5: Would new info flip the preferred alternative?
  // EVPI inputs
  linkedAlternatives: string[];
  linkedValueDrivers: string[];
  // State
  evpiEstimate?: number;        // $ or units — user-entered
  voiScore?: number;            // Computed composite
}

interface InfoOption {
  id: number;
  uncertaintyId: number;
  label: string;
  type: string;
  cost: number;           // $ cost
  duration: number;       // weeks
  accuracy: number;       // 0-100% — how reliable is this study?
  delayPenalty: number;   // $/week of delay
  expectedLearning: string;
  decisionDeadlineImpact: 'none' | 'minor' | 'major' | 'miss';
  // VOI outputs
  netVOI?: number;
  verdict?: VOIVerdict;
  verdictRationale?: string;
}

interface Alternative {
  id: number;
  label: string;
  expectedValue: number;  // Base case
  isPreferred: boolean;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'frame',     label: '1. Decision Frame' },
  { id: 'uncertainties', label: '2. Uncertainties' },
  { id: 'options',   label: '3. Info Options' },
  { id: 'assess',    label: '4. VOI Assessment' },
  { id: 'recommend', label: '5. Recommendations' },
];

const INFO_TYPES = [
  'Technical study', 'Market research', 'Pilot project', 'Appraisal well',
  'Engineering study', 'Vendor quote', 'Customer discovery', 'Regulatory clarification',
  'Expert elicitation', 'Data purchase', 'Prototype test', 'Sensitivity analysis',
  'Staged commitment', 'Proxy data', 'Other',
];

const VERDICT_CONFIG: Record<VOIVerdict, { label: string; color: string; soft: string; icon: any; desc: string }> = {
  'do-now':    { label: 'Do Now',       color: DS.success,  soft: DS.successSoft, icon: CheckCircle, desc: 'Net VOI clearly positive — gather this information before deciding.' },
  'do-later':  { label: 'Do Later',     color: DS.accent,   soft: DS.accentSoft,  icon: Clock,      desc: 'Value is positive but decision is not urgent — can gather in parallel.' },
  'conditional':{ label: 'If Triggered',color: DS.warning,  soft: DS.warnSoft,    icon: Zap,        desc: 'Only gather if a specific trigger condition is met.' },
  'do-not':    { label: 'Do Not',       color: DS.danger,   soft: DS.dangerSoft,  icon: X,          desc: 'Cost or delay exceeds expected benefit — proceed without this study.' },
  'bundle':    { label: 'Bundle',       color: '#7C3AED',   soft: '#F5F3FF',      icon: Filter,     desc: 'Combine with another study to reduce overhead and share cost.' },
  'proxy':     { label: 'Use Proxy',    color: DS.information.fill, soft: DS.information.soft, icon: Eye, desc: 'A cheaper proxy data source can answer this question adequately.' },
};

const IMPACT_LEVELS: Record<ImpactLevel, { label: string; color: string; desc: string }> = {
  critical:   { label: 'Critical',   color: DS.danger,             desc: 'Without this information, we could make a decision that destroys significant value' },
  high:       { label: 'High',       color: '#EA580C',             desc: 'Resolving this uncertainty would materially change our expected value' },
  medium:     { label: 'Medium',     color: DS.warning,            desc: 'Useful to know, but would not dramatically change the preferred alternative' },
  low:        { label: 'Low',        color: DS.information.fill,   desc: 'Nice to know — unlikely to change the decision' },
  negligible: { label: 'Negligible', color: DS.inkDis,             desc: 'No meaningful impact on decision value — do not study' },
};

const SCORING_DIMENSIONS = [
  { key: 'impactOnValue',              label: 'Impact on Decision Value',         desc: 'If this uncertainty resolves badly, how much value is at risk?' },
  { key: 'currentUncertaintyRange',    label: 'Current Uncertainty Width',         desc: 'How wide is our current range of estimates? Wide = more to learn.' },
  { key: 'abilityToReduce',            label: 'Ability to Reduce Uncertainty',     desc: 'Can we actually learn more? Or is this unknowable before committing?' },
  { key: 'likelihoodChangesDecision',  label: 'Likelihood of Changing Decision',   desc: 'If we learned the answer, how likely would our preferred alternative change?' },
];

const DQ_GUARDRAILS = [
  'Information has value only if it changes the decision. If all alternatives look equally good regardless of the outcome, the study has zero VOI.',
  'EVPI is the ceiling. Never pay more for imperfect information than the EVPI for perfect information on the same uncertainty.',
  'Delay has three costs: study cost + cost of delayed action + cost of rework if in-flight decisions must change.',
  'Irreversible decisions raise the value of learning first. Reversible decisions lower the urgency — you can adapt after committing.',
  'More data is not always better. Studying everything is as bad as studying nothing — it prevents commitment.',
];

// ── SCORING ENGINE ─────────────────────────────────────────────────────────────
function computeVOIScore(u: Uncertainty): number {
  const w = { impactOnValue: 0.35, currentUncertaintyRange: 0.20, abilityToReduce: 0.20, likelihoodChangesDecision: 0.25 };
  return Math.round(
    (u.impactOnValue          * w.impactOnValue +
     u.currentUncertaintyRange * w.currentUncertaintyRange +
     u.abilityToReduce         * w.abilityToReduce +
     u.likelihoodChangesDecision * w.likelihoodChangesDecision) * 20
  );
}

function computeNetVOI(opt: InfoOption, uncertainty: Uncertainty | undefined, reversibility: Reversibility): number {
  if (!uncertainty) return 0;
  const evpiEstimate = uncertainty.evpiEstimate || 0;
  // EVII = EVPI × (accuracy / 100) — information value discounted by study accuracy
  const evii = evpiEstimate * (opt.accuracy / 100);
  // Total cost = study cost + delay cost
  const delayCost = opt.delayPenalty * opt.duration;
  const totalCost = opt.cost + delayCost;
  // Irreversibility multiplier: irreversible decisions get a 20% bonus on EVII
  const irrevMultiplier = reversibility === 'irreversible' ? 1.2 : reversibility === 'partially' ? 1.05 : 1.0;
  return Math.round((evii * irrevMultiplier) - totalCost);
}

function computeVerdict(netVOI: number, opt: InfoOption, urgency: string): VOIVerdict {
  if (netVOI <= 0) {
    if (opt.accuracy < 40) return 'proxy';
    return 'do-not';
  }
  if (opt.decisionDeadlineImpact === 'miss') return 'do-not';
  if (opt.duration > 12 && urgency === 'urgent') return 'do-later';
  if (netVOI > 0 && netVOI < opt.cost * 0.3) return 'bundle';
  if (urgency === 'urgent') return 'do-now';
  if (urgency === 'flexible') return 'do-later';
  return 'do-now';
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export function ValueOfInformation({ sessionId, data }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('frame');

  // Decision frame
  const [decisionStatement, setDecisionStatement] = useState('');
  const [deadline, setDeadline] = useState('');
  const [urgency, setUrgency] = useState<'urgent' | 'moderate' | 'flexible'>('moderate');
  const [reversibility, setReversibility] = useState<Reversibility>('partially');
  const [totalDecisionValue, setTotalDecisionValue] = useState<number>(0);

  // Alternatives
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [preferredAlt, setPreferredAlt] = useState('');

  // Uncertainties
  const [uncertainties, setUncertainties] = useState<Uncertainty[]>([]);
  const [selectedUncertaintyId, setSelectedUncertaintyId] = useState<number | null>(null);

  // Info options
  const [infoOptions, setInfoOptions] = useState<InfoOption[]>([]);

  // Analysis
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>('semi-quant');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [aiScreening, setAiScreening] = useState<any>(null);

  // Load from session
  useEffect(() => {
    if (data?.session?.decisionStatement) setDecisionStatement(data.session.decisionStatement);
    if (data?.session?.deadline) setDeadline(data.session.deadline);
    // Pre-populate alternatives from strategies
    if (data?.strategies?.length && !alternatives.length) {
      setAlternatives(data.strategies.slice(0, 4).map((s: any, i: number) => ({
        id: s.id || i, label: s.name || `Alternative ${i+1}`, expectedValue: 0, isPreferred: i === 0,
      })));
      if (data.strategies[0]?.name) setPreferredAlt(data.strategies[0].name);
    }
    // Pre-populate uncertainties from session
    if (data?.uncertainties?.length && !uncertainties.length) {
      setUncertainties(data.uncertainties.slice(0, 6).map((u: any, i: number) => ({
        id: u.id || i, label: u.label || 'Uncertainty', description: u.description || '',
        impactOnValue: 3, currentUncertaintyRange: 3, abilityToReduce: 3, likelihoodChangesDecision: 3,
        linkedAlternatives: [], linkedValueDrivers: [], evpiEstimate: 0,
      })));
    }
  }, [data]);

  const addAlternative = () => setAlternatives(p => [...p, { id: Date.now(), label: 'New Alternative', expectedValue: 0, isPreferred: false }]);
  const addUncertainty = () => {
    const n: Uncertainty = { id: Date.now(), label: 'New Uncertainty', description: '', impactOnValue: 3, currentUncertaintyRange: 3, abilityToReduce: 3, likelihoodChangesDecision: 3, linkedAlternatives: [], linkedValueDrivers: [], evpiEstimate: 0 };
    setUncertainties(p => [...p, n]);
    setSelectedUncertaintyId(n.id);
  };
  const updateUncertainty = (id: number, field: string, val: any) => setUncertainties(p => p.map(u => u.id === id ? { ...u, [field]: val, voiScore: computeVOIScore({ ...u, [field]: val }) } : u));
  const addInfoOption = (uncertaintyId: number) => {
    const n: InfoOption = { id: Date.now(), uncertaintyId, label: 'New Study', type: 'Technical study', cost: 0, duration: 4, accuracy: 70, delayPenalty: 0, expectedLearning: '', decisionDeadlineImpact: 'none' };
    setInfoOptions(p => [...p, n]);
  };
  const updateInfoOption = (id: number, field: string, val: any) => setInfoOptions(p => p.map(o => o.id === id ? { ...o, [field]: val } : o));

  const computedOptions = infoOptions.map(opt => {
    const u = uncertainties.find(u => u.id === opt.uncertaintyId);
    const netVOI = computeNetVOI(opt, u, reversibility);
    const verdict = computeVerdict(netVOI, opt, urgency);
    return { ...opt, netVOI, verdict };
  });

  const rankedUncertainties = [...uncertainties]
    .map(u => ({ ...u, voiScore: computeVOIScore(u) }))
    .sort((a, b) => b.voiScore - a.voiScore);

  const totalEVPI = uncertainties.reduce((sum, u) => sum + (u.evpiEstimate || 0), 0);
  const doNowOptions = computedOptions.filter(o => o.verdict === 'do-now');
  const doNotOptions = computedOptions.filter(o => o.verdict === 'do-not');
  const netBenefit = computedOptions.reduce((sum, o) => sum + (o.netVOI || 0), 0);

  // ── AI FUNCTIONS ──────────────────────────────────────────────────────────
  const aiScreenUncertainties = () => {
    const uList = uncertainties.map(u => `"${u.label}": impact=${u.impactOnValue}/5, ability to reduce=${u.abilityToReduce}/5, changes decision=${u.likelihoodChangesDecision}/5`).join('\n');
    const prompt = `You are a Decision Quality analyst specialising in Value of Information analysis.

Decision: ${decisionStatement}
Deadline: ${deadline || 'Not specified'}
Urgency: ${urgency}
Reversibility: ${reversibility}
Decision value at stake: $${totalDecisionValue.toLocaleString()}
Preferred alternative: ${preferredAlt}
Alternatives: ${alternatives.map(a => a.label).join(', ')}

Uncertainties to screen:
${uList}

Apply rigorous VOI screening using decision analysis principles:
1. Is each uncertainty truly decision-critical (would resolving it change the preferred alternative)?
2. Which uncertainties are knowable before the deadline?
3. Which are likely to have zero VOI (decision is robust regardless of outcome)?
4. What proxy information sources exist for each?
5. Are there any dangerous assumption-masquerading-as-uncertainties?
6. What is the single most important uncertainty to resolve first?

Return JSON: {
  screeningResults: [{
    uncertaintyLabel: string,
    isDecisionCritical: boolean,
    decisionCriticalRationale: string,
    canLearnBeforeDeadline: boolean,
    estimatedVOICategory: "High" | "Medium" | "Low" | "Zero",
    recommendedStudyType: string,
    proxyOption: string or null,
    warningFlag: string or null
  }],
  topPriority: string,
  studyEverythingWarning: string or null,
  keyInsight: string,
  decisionReadiness: "Ready to commit" | "Critical gaps remain" | "Dangerous to proceed"
}`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setAiScreening(result); setActiveTab('assess'); }
    });
  };

  const aiGenerateExecutiveSummary = () => {
    const optSummary = computedOptions.map(o => {
      const u = uncertainties.find(u => u.id === o.uncertaintyId);
      return `"${o.label}" for uncertainty "${u?.label||'Unknown'}": cost=$${o.cost.toLocaleString()}, duration=${o.duration}wks, accuracy=${o.accuracy}%, netVOI=$${o.netVOI?.toLocaleString()}, verdict=${o.verdict}`;
    }).join('\n');
    const prompt = `Generate an executive VOI recommendation summary.

Decision: ${decisionStatement}
Total decision value at stake: $${totalDecisionValue.toLocaleString()}
Total EVPI (max theoretical value of all perfect information): $${totalEVPI.toLocaleString()}
Reversibility: ${reversibility}
Decision urgency: ${urgency}
Deadline: ${deadline}

Information options assessed:
${optSummary}

Studies recommended (Do Now): ${doNowOptions.length}
Studies rejected (Do Not): ${doNotOptions.length}

Write a crisp executive summary (board-quality) that:
1. States whether the decision should proceed or whether specific studies are justified
2. Names the 1-2 most important studies and WHY they have positive VOI
3. Names studies that were assessed and REJECTED (with brief rationale)
4. States the expected value improvement from recommended studies
5. Gives a clear recommendation on decision readiness

Return JSON: { headline: string, readinessVerdict: string, recommendedStudies: [{name, rationale, netVOI, duration}], rejectedStudies: [{name, reason}], totalStudyCost: number, expectedValueImprovement: string, keyRisk: string, commitNow: string }`;

    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setExecutiveSummary(JSON.stringify(result));
    });
  };

  const parsedSummary = (() => { try { return executiveSummary ? JSON.parse(executiveSummary) : null; } catch { return null; } })();

  const selectedU = uncertainties.find(u => u.id === selectedUncertaintyId);
  const selectedUncertaintyOptions = computedOptions.filter(o => o.uncertaintyId === selectedUncertaintyId);

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 11</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Value of Information</h2>
          <p className="text-xs mt-0.5" style={{ color: DS.inkSub }}>Is it worth gathering more information before deciding? VOI quantifies when to study and when to commit.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={analysisLevel} onValueChange={v => setAnalysisLevel(v as AnalysisLevel)}>
            <SelectTrigger className="h-7 text-[10px] w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="qualitative" className="text-xs">Qualitative screen</SelectItem>
              <SelectItem value="semi-quant" className="text-xs">Semi-quantitative</SelectItem>
              <SelectItem value="quantitative" className="text-xs">Quantitative (EVPI)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.reasoning.fill }} onClick={aiScreenUncertainties} disabled={busy || !uncertainties.length}>
            <Sparkles size={11} /> AI Screen
          </Button>
        </div>
      </div>

      {/* Analysis level banner */}
      <div className="flex gap-2 mb-4 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
        {[
          { id: 'qualitative', label: 'Level 1: Qualitative', sub: 'Is the uncertainty material?', color: DS.information.fill },
          { id: 'semi-quant',  label: 'Level 2: Semi-Quantitative', sub: 'Score VOI attractiveness', color: DS.accent },
          { id: 'quantitative',label: 'Level 3: EVPI / EVII', sub: 'Net VOI in $', color: DS.reasoning.fill },
        ].map(level => (
          <button key={level.id} onClick={() => setAnalysisLevel(level.id as AnalysisLevel)}
            className="flex-1 p-2.5 rounded-xl text-left transition-all"
            style={{ background: analysisLevel === level.id ? `${level.color}18` : 'transparent', border: `1.5px solid ${analysisLevel === level.id ? level.color : DS.borderLight}` }}>
            <div className="text-[10px] font-bold" style={{ color: analysisLevel === level.id ? level.color : DS.ink }}>{level.label}</div>
            <div className="text-[9px]" style={{ color: DS.inkDis }}>{level.sub}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5 overflow-x-auto" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-3 py-2.5 text-xs font-medium transition-colors shrink-0"
            style={{ color: activeTab === tab.id ? DS.reasoning.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.reasoning.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ TAB 1: DECISION FRAME ═══════════════════════════════════════════════ */}
      {activeTab === 'frame' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>FOCAL DECISION</label>
                <Textarea value={decisionStatement} onChange={e => setDecisionStatement(e.target.value)}
                  placeholder="What decision must be made? When does it need to be made?" rows={3} className="text-xs resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>DECISION DEADLINE</label>
                  <Input value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="e.g. Q3 board review" className="text-xs" />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>VALUE AT STAKE ($)</label>
                  <Input type="number" value={totalDecisionValue||''} onChange={e => setTotalDecisionValue(Number(e.target.value))} placeholder="e.g. 50000000" className="text-xs" />
                </div>
              </div>
              {/* Urgency & Reversibility */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>DECISION URGENCY</label>
                  <div className="flex flex-col gap-1">
                    {[['urgent','🔴 Urgent — can\'t delay'],['moderate','🟡 Moderate — some flexibility'],['flexible','🟢 Flexible — time available']].map(([val,lbl])=>(
                      <button key={val} onClick={() => setUrgency(val as any)}
                        className="text-left px-2.5 py-1.5 rounded-lg text-[10px] transition-all"
                        style={{ background: urgency===val ? `${DS.reasoning.fill}15` : DS.bg, border: `1px solid ${urgency===val ? DS.reasoning.fill : DS.borderLight}`, fontWeight: urgency===val ? 600 : 400, color: DS.ink }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>DECISION REVERSIBILITY</label>
                  <div className="flex flex-col gap-1">
                    {[['irreversible','🔴 Irreversible — can\'t undo'],['partially','🟡 Partially reversible'],['reversible','🟢 Reversible — can adapt']].map(([val,lbl])=>(
                      <button key={val} onClick={() => setReversibility(val as any)}
                        className="text-left px-2.5 py-1.5 rounded-lg text-[10px] transition-all"
                        style={{ background: reversibility===val ? `${DS.warning}15` : DS.bg, border: `1px solid ${reversibility===val ? DS.warning : DS.borderLight}`, fontWeight: reversibility===val ? 600 : 400, color: DS.ink }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {reversibility === 'irreversible' && (
                    <p className="text-[9px] mt-1.5 p-1.5 rounded" style={{ background: DS.warnSoft, color: DS.warning }}>
                      ⚠ Irreversible decisions: VOI is higher because mistakes cannot be corrected. Bias toward learning first.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Alternatives */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>ALTERNATIVES UNDER CONSIDERATION</label>
                  <button onClick={addAlternative} className="text-[9px] flex items-center gap-1" style={{ color: DS.alternatives.fill }}><Plus size={10} /> Add</button>
                </div>
                {alternatives.map(alt => (
                  <div key={alt.id} className="flex items-center gap-2 mb-1.5">
                    <button onClick={() => { setAlternatives(p => p.map(a => ({ ...a, isPreferred: a.id === alt.id }))); setPreferredAlt(alt.label); }}
                      className="w-4 h-4 rounded-full border-2 shrink-0 transition-all"
                      style={{ borderColor: alt.isPreferred ? DS.success : DS.border, background: alt.isPreferred ? DS.success : 'transparent' }} />
                    <Input value={alt.label} onChange={e => setAlternatives(p => p.map(a => a.id === alt.id ? { ...a, label: e.target.value } : a))} className="flex-1 text-xs h-7" />
                    {analysisLevel === 'quantitative' && (
                      <Input type="number" value={alt.expectedValue||''} onChange={e => setAlternatives(p => p.map(a => a.id === alt.id ? { ...a, expectedValue: Number(e.target.value) } : a))} placeholder="EV ($)" className="w-24 text-xs h-7" />
                    )}
                    <button onClick={() => setAlternatives(p => p.filter(a => a.id !== alt.id))}><Trash2 size={10} style={{ color: DS.inkDis }} /></button>
                  </div>
                ))}
              </div>

              {/* Frame summary */}
              <div className="rounded-xl p-3" style={{ background: DS.reasoning.soft, border: `1px solid ${DS.reasoning.line}` }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.reasoning.fill }}>VOI FRAME SUMMARY</div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between"><span style={{ color: DS.inkDis }}>Value at stake</span><span className="font-bold" style={{ color: DS.ink }}>${totalDecisionValue.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span style={{ color: DS.inkDis }}>Urgency</span><span className="font-bold capitalize" style={{ color: urgency === 'urgent' ? DS.danger : urgency === 'moderate' ? DS.warning : DS.success }}>{urgency}</span></div>
                  <div className="flex justify-between"><span style={{ color: DS.inkDis }}>Reversibility</span><span className="font-bold capitalize" style={{ color: reversibility === 'irreversible' ? DS.danger : reversibility === 'partially' ? DS.warning : DS.success }}>{reversibility}</span></div>
                  <div className="flex justify-between"><span style={{ color: DS.inkDis }}>Preferred alt</span><span className="font-bold" style={{ color: DS.ink }}>{preferredAlt || '—'}</span></div>
                  <div className="flex justify-between"><span style={{ color: DS.inkDis }}>Uncertainties</span><span className="font-bold" style={{ color: DS.ink }}>{uncertainties.length}</span></div>
                  {totalEVPI > 0 && <div className="flex justify-between pt-1 border-t" style={{ borderColor: DS.reasoning.line }}><span style={{ color: DS.inkDis }}>Total EVPI</span><span className="font-bold" style={{ color: DS.reasoning.fill }}>${totalEVPI.toLocaleString()}</span></div>}
                </div>
              </div>

              {/* DQ guardrail */}
              <div className="rounded-xl p-3" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}25` }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.warning }}>VOI GUARDRAIL</div>
                <p className="text-[10px]" style={{ color: DS.inkSub }}>Information has value only if it changes the decision. If all alternatives produce the same outcome regardless of uncertainty resolution, the VOI is zero — do not study.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB 2: UNCERTAINTIES ════════════════════════════════════════════════ */}
      {activeTab === 'uncertainties' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Score each uncertainty on 4 VOI dimensions. High-scoring uncertainties are candidates for additional study.</p>
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={addUncertainty}><Plus size={11} /> Add Uncertainty</Button>
          </div>

          {/* Uncertainty scoring cards */}
          <div className="grid gap-3">
            {rankedUncertainties.map((u, rank) => {
              const score = u.voiScore || 0;
              const scoreColor = score >= 70 ? DS.danger : score >= 50 ? DS.warning : score >= 30 ? DS.accent : DS.inkDis;
              const isSelected = selectedUncertaintyId === u.id;
              return (
                <div key={u.id} className="rounded-xl overflow-hidden border cursor-pointer transition-all"
                  style={{ borderColor: isSelected ? DS.reasoning.fill : DS.borderLight, background: isSelected ? `${DS.reasoning.fill}04` : '#fff' }}
                  onClick={() => setSelectedUncertaintyId(isSelected ? null : u.id)}>
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: `${scoreColor}20`, color: scoreColor }}>#{rank+1}</div>
                    <div className="flex-1 min-w-0">
                      <Input value={u.label} onChange={e => updateUncertainty(u.id, 'label', e.target.value)}
                        className="font-bold text-xs h-6 border-0 bg-transparent p-0 focus-visible:ring-0" style={{ color: DS.ink }}
                        onClick={e => e.stopPropagation()} />
                    </div>
                    {/* VOI score gauge */}
                    <div className="text-center shrink-0">
                      <div className="text-xl font-black" style={{ color: scoreColor }}>{score}</div>
                      <div className="text-[8px] font-bold uppercase" style={{ color: DS.inkDis }}>VOI SCORE</div>
                    </div>
                    {/* Score bar */}
                    <div className="w-24 shrink-0">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: DS.bg }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreColor }} />
                      </div>
                    </div>
                    {analysisLevel === 'quantitative' && (
                      <div className="shrink-0 text-right">
                        <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>EVPI ($)</div>
                        <Input type="number" value={u.evpiEstimate||''} onChange={e => updateUncertainty(u.id, 'evpiEstimate', Number(e.target.value))}
                          placeholder="0" className="w-24 text-xs h-6 text-right"
                          onClick={e => e.stopPropagation()} />
                      </div>
                    )}
                    <button onClick={e => { e.stopPropagation(); setUncertainties(p => p.filter(x => x.id !== u.id)); }}><Trash2 size={11} style={{ color: DS.inkDis }} /></button>
                  </div>

                  {/* Expanded scoring */}
                  {isSelected && (
                    <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: DS.borderLight }} onClick={e => e.stopPropagation()}>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider mb-1 block" style={{ color: DS.inkDis }}>DESCRIPTION</label>
                        <Textarea value={u.description} onChange={e => updateUncertainty(u.id, 'description', e.target.value)}
                          placeholder="What exactly is uncertain? What is the range of possible outcomes?" rows={2} className="text-xs resize-none" />
                      </div>

                      {/* 4 scoring dimensions */}
                      <div className="grid grid-cols-2 gap-3">
                        {SCORING_DIMENSIONS.map(dim => (
                          <div key={dim.key} className="p-3 rounded-xl" style={{ background: DS.bg }}>
                            <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>{dim.label}</div>
                            <p className="text-[8px] mb-2" style={{ color: DS.inkDis }}>{dim.desc}</p>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map(v => (
                                <button key={v} onClick={() => updateUncertainty(u.id, dim.key, v)}
                                  className="flex-1 py-2 rounded-lg text-[9px] font-bold transition-all"
                                  style={{
                                    background: (u as any)[dim.key] === v ? DS.reasoning.fill : DS.canvas,
                                    color: (u as any)[dim.key] === v ? '#fff' : DS.inkDis,
                                    border: `1px solid ${(u as any)[dim.key] === v ? DS.reasoning.fill : DS.borderLight}`,
                                  }}>{v}</button>
                              ))}
                            </div>
                            <div className="flex justify-between mt-1 text-[8px]" style={{ color: DS.inkDis }}>
                              <span>Low</span><span>High</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* EVPI concept (quantitative level) */}
                      {analysisLevel === 'quantitative' && (
                        <div className="p-3 rounded-xl" style={{ background: DS.reasoning.soft, border: `1px solid ${DS.reasoning.line}` }}>
                          <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.reasoning.fill }}>EVPI — EXPECTED VALUE OF PERFECT INFORMATION</div>
                          <p className="text-[10px] mb-2" style={{ color: DS.inkSub }}>
                            EVPI is the maximum you should ever pay for information on this uncertainty — even if the study is 100% accurate. EVPI = E[max value with perfect info] − max E[value without info].
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>EVPI ESTIMATE ($)</div>
                            <Input type="number" value={u.evpiEstimate||''} onChange={e => updateUncertainty(u.id, 'evpiEstimate', Number(e.target.value))}
                              placeholder="Your estimate of max worth" className="flex-1 text-xs h-7" />
                          </div>
                          {(u.evpiEstimate || 0) > 0 && (
                            <p className="text-[9px] mt-1" style={{ color: DS.reasoning.fill }}>
                              Never pay more than ${(u.evpiEstimate||0).toLocaleString()} for any study on "{u.label}" — regardless of how accurate it is.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Add info option */}
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 w-full" onClick={() => { addInfoOption(u.id); setActiveTab('options'); }}>
                        <Plus size={11} /> Add Information Option for This Uncertainty
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {uncertainties.length === 0 && (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <BarChart2 size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.inkDis }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>No uncertainties added yet</p>
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Add the key uncertainties affecting this decision. Focus on uncertainties that could change your preferred alternative.</p>
              <Button size="sm" variant="outline" onClick={addUncertainty} className="gap-1"><Plus size={12} /> Add Uncertainty</Button>
            </div>
          )}

          {/* Ranking summary */}
          {uncertainties.length > 1 && (
            <div className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>UNCERTAINTY RANKING — sorted by VOI score</div>
              <div className="space-y-1">
                {rankedUncertainties.map((u, i) => {
                  const score = u.voiScore || 0;
                  const color = score >= 70 ? DS.danger : score >= 50 ? DS.warning : score >= 30 ? DS.accent : DS.inkDis;
                  return (
                    <div key={u.id} className="flex items-center gap-2">
                      <span className="text-[9px] w-4 shrink-0" style={{ color: DS.inkDis }}>#{i+1}</span>
                      <span className="text-[10px] flex-1 truncate" style={{ color: DS.ink }}>{u.label}</span>
                      <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
                      </div>
                      <span className="text-[10px] font-bold w-6" style={{ color }}>{score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DQPrinciple text={DQ_GUARDRAILS[0]} />
        </div>
      )}

      {/* ══ TAB 3: INFO OPTIONS ════════════════════════════════════════════════ */}
      {activeTab === 'options' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Define possible studies, tests, or data acquisition options. Each option is evaluated on cost, duration, and accuracy against the EVPI ceiling.</p>
            <Select onValueChange={v => addInfoOption(Number(v))}>
              <SelectTrigger className="h-7 text-[10px] w-48"><SelectValue placeholder="Add option for…" /></SelectTrigger>
              <SelectContent>{uncertainties.map(u => <SelectItem key={u.id} value={String(u.id)} className="text-xs">{u.label.slice(0,30)}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {uncertainties.map(u => {
            const opts = computedOptions.filter(o => o.uncertaintyId === u.id);
            if (opts.length === 0 && !infoOptions.some(o => o.uncertaintyId === u.id)) return null;
            return (
              <div key={u.id} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
                  <div className="text-xs font-bold" style={{ color: DS.ink }}>📊 {u.label}</div>
                  <div className="text-[9px]" style={{ color: DS.inkDis }}>VOI Score: {computeVOIScore(u)}</div>
                  {analysisLevel === 'quantitative' && u.evpiEstimate && (
                    <div className="ml-auto text-[9px]" style={{ color: DS.reasoning.fill }}>EVPI ceiling: ${u.evpiEstimate.toLocaleString()}</div>
                  )}
                  <button onClick={() => addInfoOption(u.id)} className="ml-auto flex items-center gap-1 text-[9px]" style={{ color: DS.accent }}><Plus size={9} /> Add option</button>
                </div>
                <div className="divide-y" style={{ borderColor: DS.borderLight }}>
                  {opts.map(opt => {
                    const verdictCfg = VERDICT_CONFIG[opt.verdict || 'do-not'];
                    const VIcon = verdictCfg.icon;
                    return (
                      <div key={opt.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input value={opt.label} onChange={e => updateInfoOption(opt.id, 'label', e.target.value)} className="flex-1 font-bold text-xs h-7" />
                              <Select value={opt.type} onValueChange={v => updateInfoOption(opt.id, 'type', v)}>
                                <SelectTrigger className="h-7 text-[9px] w-36"><SelectValue /></SelectTrigger>
                                <SelectContent>{INFO_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <Textarea value={opt.expectedLearning} onChange={e => updateInfoOption(opt.id, 'expectedLearning', e.target.value)}
                              placeholder="What specific question will this answer? What decision outcome would change?" rows={2} className="text-[10px] resize-none" />
                            <div className="grid grid-cols-5 gap-2">
                              <div>
                                <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>COST ($)</div>
                                <Input type="number" value={opt.cost||''} onChange={e => updateInfoOption(opt.id, 'cost', Number(e.target.value))} className="text-[10px] h-7" placeholder="0" />
                              </div>
                              <div>
                                <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>DURATION (wks)</div>
                                <Input type="number" value={opt.duration||''} onChange={e => updateInfoOption(opt.id, 'duration', Number(e.target.value))} className="text-[10px] h-7" placeholder="4" />
                              </div>
                              <div>
                                <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>ACCURACY (%)</div>
                                <Input type="number" value={opt.accuracy||''} onChange={e => updateInfoOption(opt.id, 'accuracy', Number(e.target.value))} className="text-[10px] h-7" placeholder="70" min="0" max="100" />
                              </div>
                              {analysisLevel === 'quantitative' && (
                                <div>
                                  <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>DELAY PENALTY ($/wk)</div>
                                  <Input type="number" value={opt.delayPenalty||''} onChange={e => updateInfoOption(opt.id, 'delayPenalty', Number(e.target.value))} className="text-[10px] h-7" placeholder="0" />
                                </div>
                              )}
                              <div>
                                <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>DEADLINE IMPACT</div>
                                <Select value={opt.decisionDeadlineImpact} onValueChange={v => updateInfoOption(opt.id, 'decisionDeadlineImpact', v)}>
                                  <SelectTrigger className="h-7 text-[9px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>{[['none','None'],['minor','Minor'],['major','Major'],['miss','Misses deadline']].map(([v,l])=><SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Net VOI and verdict */}
                          <div className="shrink-0 w-32 text-center">
                            {analysisLevel === 'quantitative' && (
                              <div className="mb-2">
                                <div className="text-[8px] font-bold uppercase" style={{ color: DS.inkDis }}>NET VOI</div>
                                <div className="text-xl font-black" style={{ color: (opt.netVOI||0) > 0 ? DS.success : DS.danger }}>
                                  {(opt.netVOI||0) >= 0 ? '+' : ''}{(opt.netVOI||0).toLocaleString()}
                                </div>
                                {u.evpiEstimate && (opt.cost > u.evpiEstimate) && (
                                  <p className="text-[8px]" style={{ color: DS.danger }}>Cost exceeds EVPI ceiling!</p>
                                )}
                              </div>
                            )}
                            <div className="rounded-xl p-2" style={{ background: verdictCfg.soft, border: `1px solid ${verdictCfg.color}25` }}>
                              <VIcon size={14} className="mx-auto mb-0.5" style={{ color: verdictCfg.color }} />
                              <div className="text-[9px] font-bold" style={{ color: verdictCfg.color }}>{verdictCfg.label}</div>
                            </div>
                            <button onClick={() => setInfoOptions(p => p.filter(o => o.id !== opt.id))} className="mt-2">
                              <Trash2 size={10} style={{ color: DS.inkDis }} />
                            </button>
                          </div>
                        </div>

                        {/* EVII explanation (quantitative) */}
                        {analysisLevel === 'quantitative' && u.evpiEstimate && (
                          <div className="mt-2 p-2.5 rounded-lg" style={{ background: DS.bg }}>
                            <div className="text-[8px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>EVII CALCULATION</div>
                            <div className="grid grid-cols-4 gap-2 text-[9px]">
                              <div><span style={{ color: DS.inkDis }}>EVPI ceiling: </span><span className="font-bold" style={{ color: DS.reasoning.fill }}>${u.evpiEstimate.toLocaleString()}</span></div>
                              <div><span style={{ color: DS.inkDis }}>× Accuracy: </span><span className="font-bold" style={{ color: DS.ink }}>{opt.accuracy}%</span></div>
                              <div><span style={{ color: DS.inkDis }}>EVII = </span><span className="font-bold" style={{ color: DS.success }}>${Math.round(u.evpiEstimate * opt.accuracy / 100).toLocaleString()}</span></div>
                              <div><span style={{ color: DS.inkDis }}>Net VOI = </span><span className="font-bold" style={{ color: (opt.netVOI||0)>0 ? DS.success : DS.danger }}>${(opt.netVOI||0).toLocaleString()}</span></div>
                            </div>
                            <p className="text-[8px] mt-1" style={{ color: DS.inkDis }}>Net VOI = EVII × irreversibility factor ({reversibility==='irreversible'?'1.20':reversibility==='partially'?'1.05':'1.00'}) − study cost − delay penalty (${opt.delayPenalty}/wk × {opt.duration} wks)</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {opts.length === 0 && (
                    <div className="p-4 text-center" style={{ color: DS.inkDis }}>
                      <p className="text-xs">No information options for this uncertainty yet</p>
                      <button onClick={() => addInfoOption(u.id)} className="text-[10px] mt-1 font-medium" style={{ color: DS.accent }}>+ Add option</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <DQPrinciple text={DQ_GUARDRAILS[1]} />
        </div>
      )}

      {/* ══ TAB 4: VOI ASSESSMENT ══════════════════════════════════════════════ */}
      {activeTab === 'assess' && (
        <div className="space-y-4">
          {/* AI Screening results */}
          {aiScreening ? (
            <div className="space-y-4">
              {/* Decision readiness badge */}
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{
                background: aiScreening.decisionReadiness === 'Ready to commit' ? DS.successSoft : aiScreening.decisionReadiness === 'Dangerous to proceed' ? DS.dangerSoft : DS.warnSoft
              }}>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>DECISION READINESS</div>
                  <div className="text-base font-black" style={{ color: aiScreening.decisionReadiness === 'Ready to commit' ? DS.success : aiScreening.decisionReadiness === 'Dangerous to proceed' ? DS.danger : DS.warning }}>
                    {aiScreening.decisionReadiness}
                  </div>
                </div>
                {aiScreening.keyInsight && <p className="text-xs flex-1" style={{ color: DS.inkSub }}>{aiScreening.keyInsight}</p>}
              </div>

              {/* Top priority */}
              {aiScreening.topPriority && (
                <div className="p-3 rounded-xl" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}25` }}>
                  <div className="text-[9px] font-bold uppercase mb-0.5" style={{ color: DS.accent }}>TOP PRIORITY UNCERTAINTY</div>
                  <p className="text-sm font-semibold" style={{ color: DS.ink }}>{aiScreening.topPriority}</p>
                </div>
              )}

              {/* Study everything warning */}
              {aiScreening.studyEverythingWarning && (
                <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: DS.dangerSoft }}>
                  <AlertTriangle size={14} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: DS.inkSub }}>{aiScreening.studyEverythingWarning}</p>
                </div>
              )}

              {/* Per-uncertainty screening results */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                <div className="px-4 py-2.5 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>AI VOI SCREENING — UNCERTAINTY BY UNCERTAINTY</div>
                </div>
                <div className="divide-y" style={{ borderColor: DS.borderLight }}>
                  {aiScreening.screeningResults?.map((result: any, i: number) => {
                    const voiColor = result.estimatedVOICategory === 'High' ? DS.danger : result.estimatedVOICategory === 'Medium' ? DS.warning : result.estimatedVOICategory === 'Low' ? DS.accent : DS.inkDis;
                    return (
                      <div key={i} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0`} style={{ background: result.isDecisionCritical ? DS.danger : DS.inkDis }} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold" style={{ color: DS.ink }}>{result.uncertaintyLabel}</span>
                              <Badge style={{ background: `${voiColor}18`, color: voiColor, border: 'none', fontSize: 8 }}>VOI: {result.estimatedVOICategory}</Badge>
                              {result.isDecisionCritical
                                ? <Badge style={{ background: DS.dangerSoft, color: DS.danger, border: 'none', fontSize: 8 }}>Decision-Critical</Badge>
                                : <Badge style={{ background: DS.bg, color: DS.inkDis, border: `1px solid ${DS.borderLight}`, fontSize: 8 }}>Not Critical</Badge>}
                              {!result.canLearnBeforeDeadline && <Badge style={{ background: DS.warnSoft, color: DS.warning, border: 'none', fontSize: 8 }}>Can't learn in time</Badge>}
                            </div>
                            <p className="text-[10px] mb-1" style={{ color: DS.inkSub }}>{result.decisionCriticalRationale}</p>
                            <div className="flex items-center gap-4 text-[9px]">
                              <span style={{ color: DS.inkDis }}>Suggested study: <span className="font-medium" style={{ color: DS.ink }}>{result.recommendedStudyType}</span></span>
                              {result.proxyOption && <span style={{ color: DS.inkDis }}>Proxy: <span className="font-medium" style={{ color: DS.accent }}>{result.proxyOption}</span></span>}
                            </div>
                            {result.warningFlag && (
                              <div className="mt-1 text-[9px] flex items-center gap-1" style={{ color: DS.warning }}>
                                <AlertTriangle size={9} /> {result.warningFlag}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Qualitative screening table */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: DS.borderLight, background: DS.bg }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>QUALITATIVE VOI SCREENING</div>
                  <Button size="sm" className="gap-1 text-xs h-6" style={{ background: DS.reasoning.fill }} onClick={aiScreenUncertainties} disabled={busy || !uncertainties.length}>
                    <Sparkles size={10} /> Run AI Screen
                  </Button>
                </div>
                {uncertainties.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: DS.inkDis }}>
                    <p className="text-xs">Add uncertainties first in Tab 2</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr style={{ background: DS.bg }}>
                          <th className="text-left px-3 py-2 font-bold uppercase tracking-wider text-[9px]" style={{ color: DS.inkDis }}>Uncertainty</th>
                          <th className="px-3 py-2 text-center font-bold uppercase tracking-wider text-[9px]" style={{ color: DS.inkDis }}>Decision<br/>Critical?</th>
                          <th className="px-3 py-2 text-center font-bold uppercase tracking-wider text-[9px]" style={{ color: DS.inkDis }}>Can We<br/>Learn?</th>
                          <th className="px-3 py-2 text-center font-bold uppercase tracking-wider text-[9px]" style={{ color: DS.inkDis }}>Cost/<br/>Time OK?</th>
                          <th className="px-3 py-2 text-center font-bold uppercase tracking-wider text-[9px]" style={{ color: DS.inkDis }}>VOI<br/>Score</th>
                          <th className="px-3 py-2 text-center font-bold uppercase tracking-wider text-[9px]" style={{ color: DS.inkDis }}>Info<br/>Options</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: DS.borderLight }}>
                        {rankedUncertainties.map(u => {
                          const score = u.voiScore || 0;
                          const optCount = infoOptions.filter(o => o.uncertaintyId === u.id).length;
                          const scoreColor = score >= 70 ? DS.danger : score >= 50 ? DS.warning : score >= 30 ? DS.accent : DS.inkDis;
                          const isDecisionCritical = u.likelihoodChangesDecision >= 4;
                          const canLearn = u.abilityToReduce >= 3;
                          return (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-2.5 font-medium" style={{ color: DS.ink }}>{u.label}</td>
                              <td className="px-3 py-2.5 text-center">{isDecisionCritical ? <CheckCircle size={14} style={{ color: DS.success, margin: 'auto' }} /> : <X size={14} style={{ color: DS.inkDis, margin: 'auto' }} />}</td>
                              <td className="px-3 py-2.5 text-center">{canLearn ? <CheckCircle size={14} style={{ color: DS.success, margin: 'auto' }} /> : <X size={14} style={{ color: DS.inkDis, margin: 'auto' }} />}</td>
                              <td className="px-3 py-2.5 text-center"><span style={{ color: DS.inkDis }}>—</span></td>
                              <td className="px-3 py-2.5 text-center"><span className="font-black text-base" style={{ color: scoreColor }}>{score}</span></td>
                              <td className="px-3 py-2.5 text-center">
                                <button onClick={() => { addInfoOption(u.id); setActiveTab('options'); }} className="text-[9px] px-2 py-0.5 rounded" style={{ background: optCount > 0 ? DS.accentSoft : DS.bg, color: optCount > 0 ? DS.accent : DS.inkDis, border: `1px solid ${optCount > 0 ? DS.accent : DS.borderLight}` }}>
                                  {optCount > 0 ? `${optCount} option${optCount > 1 ? 's' : ''}` : '+ Add'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* DQ guardrails */}
              <div className="space-y-2">
                {DQ_GUARDRAILS.slice(1).map((g, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                    <Info size={11} style={{ color: DS.reasoning.fill, flexShrink: 0, marginTop: 1 }} />
                    <p className="text-[10px]" style={{ color: DS.inkSub }}>{g}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 5: RECOMMENDATIONS ══════════════════════════════════════════════ */}
      {activeTab === 'recommend' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Final VOI verdict for each information option, and executive recommendation on decision readiness.</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.reasoning.fill }} onClick={aiGenerateExecutiveSummary} disabled={busy || computedOptions.length === 0}>
              <Sparkles size={11} /> {busy ? 'Generating…' : 'Generate Executive Summary'}
            </Button>
          </div>

          {/* Summary stats */}
          {computedOptions.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Do Now', count: computedOptions.filter(o=>o.verdict==='do-now').length, color: DS.success, soft: DS.successSoft },
                { label: 'Do Not', count: computedOptions.filter(o=>o.verdict==='do-not').length, color: DS.danger, soft: DS.dangerSoft },
                { label: 'Conditional', count: computedOptions.filter(o=>o.verdict==='conditional'||o.verdict==='do-later').length, color: DS.warning, soft: DS.warnSoft },
                { label: 'Bundle/Proxy', count: computedOptions.filter(o=>o.verdict==='bundle'||o.verdict==='proxy').length, color: '#7C3AED', soft: '#F5F3FF' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: s.soft, border: `1px solid ${s.color}25` }}>
                  <div className="text-3xl font-black" style={{ color: s.color }}>{s.count}</div>
                  <div className="text-[9px] font-bold uppercase" style={{ color: s.color }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation cards by verdict group */}
          {(Object.keys(VERDICT_CONFIG) as VOIVerdict[]).map(verdict => {
            const group = computedOptions.filter(o => o.verdict === verdict);
            if (group.length === 0) return null;
            const vcfg = VERDICT_CONFIG[verdict];
            const VIcon = vcfg.icon;
            return (
              <div key={verdict}>
                <div className="flex items-center gap-2 mb-2">
                  <VIcon size={14} style={{ color: vcfg.color }} />
                  <span className="text-xs font-bold" style={{ color: vcfg.color }}>{vcfg.label}</span>
                  <span className="text-[9px]" style={{ color: DS.inkDis }}>{vcfg.desc}</span>
                </div>
                <div className="space-y-2">
                  {group.map(opt => {
                    const u = uncertainties.find(u => u.id === opt.uncertaintyId);
                    return (
                      <div key={opt.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: vcfg.soft, border: `1px solid ${vcfg.color}20` }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${vcfg.color}20` }}>
                          <VIcon size={14} style={{ color: vcfg.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold" style={{ color: DS.ink }}>{opt.label}</span>
                            <span className="text-[9px]" style={{ color: DS.inkDis }}>{opt.type}</span>
                          </div>
                          <div className="text-[9px] mb-0.5" style={{ color: DS.inkDis }}>
                            For: <span style={{ color: DS.ink }}>{u?.label || 'Unknown uncertainty'}</span>
                          </div>
                          <div className="flex gap-4 text-[9px]">
                            <span style={{ color: DS.inkDis }}>Cost: <strong style={{ color: DS.ink }}>${opt.cost.toLocaleString()}</strong></span>
                            <span style={{ color: DS.inkDis }}>Duration: <strong style={{ color: DS.ink }}>{opt.duration} wks</strong></span>
                            <span style={{ color: DS.inkDis }}>Accuracy: <strong style={{ color: DS.ink }}>{opt.accuracy}%</strong></span>
                            {analysisLevel === 'quantitative' && <span style={{ color: DS.inkDis }}>Net VOI: <strong style={{ color: (opt.netVOI||0)>0?DS.success:DS.danger }}>${opt.netVOI?.toLocaleString()}</strong></span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Executive summary */}
          {parsedSummary && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: DS.borderLight, background: DS.brand }}>
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/60 mb-0.5">EXECUTIVE SUMMARY — VOI RECOMMENDATION</div>
                <div className="text-lg font-black text-white">{parsedSummary.headline}</div>
              </div>
              <div className="p-4 space-y-3">
                <div className="p-3 rounded-xl" style={{ background: parsedSummary.readinessVerdict?.includes('Ready') ? DS.successSoft : DS.warnSoft }}>
                  <div className="text-[9px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>READINESS VERDICT</div>
                  <p className="text-sm font-bold" style={{ color: DS.ink }}>{parsedSummary.readinessVerdict}</p>
                </div>
                {parsedSummary.recommendedStudies?.length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.success }}>✓ RECOMMENDED STUDIES</div>
                    {parsedSummary.recommendedStudies.map((s: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 mb-1.5 p-2 rounded-lg" style={{ background: DS.successSoft }}>
                        <CheckCircle size={11} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} />
                        <div><span className="text-[10px] font-bold" style={{ color: DS.ink }}>{s.name}</span><span className="text-[9px] ml-2" style={{ color: DS.inkSub }}>{s.rationale}</span></div>
                        {s.netVOI && <span className="ml-auto text-[9px] font-bold shrink-0" style={{ color: DS.success }}>+${Number(s.netVOI).toLocaleString()}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {parsedSummary.rejectedStudies?.length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.danger }}>✗ REJECTED STUDIES</div>
                    {parsedSummary.rejectedStudies.map((s: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 mb-1 text-[9px]" style={{ color: DS.inkSub }}>
                        <X size={10} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />
                        <span><strong style={{ color: DS.ink }}>{s.name}:</strong> {s.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {parsedSummary.expectedValueImprovement && <div className="p-2.5 rounded-xl" style={{ background: DS.bg }}><div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>EXPECTED VALUE IMPROVEMENT</div><p className="text-xs font-medium" style={{ color: DS.ink }}>{parsedSummary.expectedValueImprovement}</p></div>}
                  {parsedSummary.commitNow && <div className="p-2.5 rounded-xl" style={{ background: DS.accentSoft }}><div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.accent }}>COMMIT NOW?</div><p className="text-xs font-medium" style={{ color: DS.ink }}>{parsedSummary.commitNow}</p></div>}
                </div>
              </div>
            </div>
          )}

          {computedOptions.length === 0 && (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <TrendingUp size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.inkDis }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>No information options to evaluate yet</p>
              <p className="text-xs" style={{ color: DS.inkDis }}>Add information options in Tab 3 to generate VOI recommendations.</p>
            </div>
          )}

          <DQPrinciple text={DQ_GUARDRAILS[4]} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{uncertainties.length} uncertainties</span>
          <span>·</span>
          <span>{infoOptions.length} info options</span>
          {totalEVPI > 0 && <><span>·</span><span style={{ color: DS.reasoning.fill }}>EVPI: ${totalEVPI.toLocaleString()}</span></>}
          {computedOptions.length > 0 && <><span>·</span><span style={{ color: doNowOptions.length > 0 ? DS.success : DS.inkDis }}>{doNowOptions.length} Do Now</span></>}
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.reasoning.fill }}
          onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t => t.id === activeTab) + 1, TABS.length - 1)].id)}>
          Next <ChevronRight size={11} />
        </Button>
      </div>
    </div>
  );
}

function DQPrinciple({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: `${DS.reasoning.fill}10`, border: `1px solid ${DS.reasoning.fill}25` }}>
      <Lightbulb size={14} style={{ color: DS.reasoning.fill, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.reasoning.fill }}>DQ PRINCIPLE</div>
        <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{text}</p>
      </div>
    </div>
  );
}
