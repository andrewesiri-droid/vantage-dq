import { useState, useMemo } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, Plus, Trash2, BrainCircuit, AlertTriangle, CheckCircle2,
  XCircle, Lightbulb, Shield, TrendingUp, TrendingDown, Minus,
  Users, Target, Eye, MessageSquare, ChevronRight, ArrowRight
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type RatingScale = 'very-strong' | 'strong' | 'moderate' | 'weak' | 'very-weak';
type ConfidenceLevel = 'high' | 'moderate' | 'low';
type AssessmentType = 'benefit' | 'risk' | 'uncertainty-sensitive' | 'constraint-sensitive';

interface Criterion {
  id: number;
  name: string;
  description: string;
  intent: string;
  type: AssessmentType;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

interface AssessmentCell {
  criterionId: number;
  alternativeId: number;
  rating: RatingScale;
  rationale: string;
  confidence: ConfidenceLevel;
  assumptions: string;
  concerns: string;
  disagreement: boolean;
  disagreementNote: string;
}

interface Alternative {
  id: number;
  name: string;
  description: string;
  colorIdx: number;
}

interface ValidationFlag {
  type: 'no-rationale' | 'inconsistent' | 'overconfidence' | 'groupthink' | 'missing-tradeoffs' | 'weak-differentiation' | 'missing-criteria' | 'assumption-confusion';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  cellKey?: string;
  criterionId?: number;
}

// ============================================================================
// RATING CONFIG
// ============================================================================

const RATING_CONFIG: Record<RatingScale, { label: string; color: string; soft: string; score: number }> = {
  'very-strong': { label: 'Very Strong', color: '#059669', soft: '#ECFDF5', score: 5 },
  'strong':      { label: 'Strong',      color: '#3B82F6', soft: '#EFF6FF', score: 4 },
  'moderate':    { label: 'Moderate',    color: '#F59E0B', soft: '#FFFBEB', score: 3 },
  'weak':        { label: 'Weak',        color: '#EA580C', soft: '#FFF7ED', score: 2 },
  'very-weak':   { label: 'Very Weak',   color: '#DC2626', soft: '#FEF2F2', score: 1 },
};

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; color: string }> = {
  high:    { label: 'High',    color: '#059669' },
  moderate: { label: 'Moderate', color: '#F59E0B' },
  low:     { label: 'Low',     color: '#DC2626' },
};

const IMPORTANCE_WEIGHTS: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_CRITERIA: Criterion[] = [
  { id: 1, name: 'Economic Potential', description: 'Expected financial return and value creation over 3-5 years', intent: 'Higher NPV and ROI are preferred', type: 'benefit', importance: 'critical' },
  { id: 2, name: 'Operational Feasibility', description: 'Ability to execute with current capabilities and resources', intent: 'Lower complexity and faster implementation are preferred', type: 'benefit', importance: 'high' },
  { id: 3, name: 'Execution Complexity', description: 'Degree of difficulty in implementation and ongoing management', intent: 'Lower complexity is preferred — fewer moving parts, clearer milestones', type: 'risk', importance: 'high' },
  { id: 4, name: 'Stakeholder Alignment', description: 'Degree of support from key internal and external stakeholders', intent: 'Broad alignment reduces friction and accelerates execution', type: 'benefit', importance: 'medium' },
  { id: 5, name: 'Strategic Flexibility', description: 'Ability to adapt, pivot, or scale in response to changing conditions', intent: 'More optionality and reversibility are preferred', type: 'uncertainty-sensitive', importance: 'high' },
  { id: 6, name: 'Regulatory Exposure', description: 'Level of regulatory risk and compliance burden', intent: 'Lower regulatory risk and faster approval pathways are preferred', type: 'risk', importance: 'critical' },
  { id: 7, name: 'Competitive Positioning', description: 'Impact on market position relative to competitors', intent: 'Stronger differentiation and defensibility are preferred', type: 'benefit', importance: 'high' },
  { id: 8, name: 'Scalability', description: 'Ability to grow and expand without proportional cost increase', intent: 'Higher scalability with lower marginal cost is preferred', type: 'benefit', importance: 'medium' },
];

const DEMO_ALTERNATIVES: Alternative[] = [
  { id: 1, name: 'Alpha — Full Build', description: 'Direct subsidiary, maximum control, highest capital', colorIdx: 0 },
  { id: 2, name: 'Beta — Partnership', description: 'Strategic partnership, shared risk, faster entry', colorIdx: 1 },
  { id: 3, name: 'Gamma — Agent Model', description: 'Asset-light reseller, minimal commitment, test first', colorIdx: 2 },
  { id: 4, name: 'Delta — Hybrid Phased', description: 'Phase 1 test, Phase 2 build, staged commitment', colorIdx: 3 },
];

const DEMO_ASSESSMENTS: AssessmentCell[] = [
  { criterionId: 1, alternativeId: 1, rating: 'strong', rationale: 'Highest long-term value capture but requires significant upfront investment. NPV positive by Year 3 under base case.', confidence: 'moderate', assumptions: 'Market growth remains at 18% CAGR. Competitor response is measured.', concerns: 'Capital intensity creates downside risk if market conditions deteriorate.', disagreement: false, disagreementNote: '' },
  { criterionId: 1, alternativeId: 2, rating: 'strong', rationale: 'Revenue sharing reduces absolute value but lower capital requirement improves risk-adjusted returns.', confidence: 'moderate', assumptions: 'Partner delivers committed revenue targets. Revenue share terms remain stable.', concerns: 'Margin compression from revenue sharing may limit upside.', disagreement: false, disagreementNote: '' },
  { criterionId: 1, alternativeId: 3, rating: 'weak', rationale: 'Limited value creation due to low control and brand dilution. Commission structure erodes margins.', confidence: 'high', assumptions: 'Agent can generate sufficient volume. Customer retention is agent-independent.', concerns: 'Long-term brand building is minimal. Hard to transition to direct model later.', disagreement: false, disagreementNote: '' },
  { criterionId: 1, alternativeId: 4, rating: 'very-strong', rationale: 'Best risk-adjusted profile: Phase 1 validates demand at low cost, Phase 2 captures value with validated assumptions.', confidence: 'moderate', assumptions: 'Phase 1 generates conclusive demand signal. Board approves Phase 2 if validated.', concerns: 'Two-phase structure adds complexity. Competitors may lock market during Phase 1.', disagreement: false, disagreementNote: '' },

  { criterionId: 2, alternativeId: 1, rating: 'weak', rationale: 'Requires full local team build, entity setup, product localisation. Longest path to operational readiness.', confidence: 'high', assumptions: 'Talent is available in target market. Localisation effort is under $2M.', concerns: 'Hiring delays, cultural integration, and operational startup risk.', disagreement: true, disagreementNote: 'COO believes we can hire faster; HR thinks 6+ months for key roles' },
  { criterionId: 2, alternativeId: 2, rating: 'strong', rationale: 'Partner provides existing infrastructure, local knowledge, and operational support. Fastest operational readiness.', confidence: 'moderate', assumptions: 'Partner operational capabilities are as represented. Integration is smooth.', concerns: 'Dependency on partner operations. Governance complexity.', disagreement: false, disagreementNote: '' },
  { criterionId: 2, alternativeId: 3, rating: 'very-strong', rationale: 'Minimal operational footprint. No local entity required. Lowest operational burden.', confidence: 'high', assumptions: 'Agent handles all local operations. Technical integration is lightweight.', concerns: 'Limited operational learning. No operational capabilities developed.', disagreement: false, disagreementNote: '' },
  { criterionId: 2, alternativeId: 4, rating: 'moderate', rationale: 'Phase 1 is operationally light (agent). Phase 2 requires full build but starts from validated base.', confidence: 'moderate', assumptions: 'Phase 1 agent relationship can be transitioned or converted.', concerns: 'Operational discontinuity between Phase 1 and Phase 2.', disagreement: false, disagreementNote: '' },

  { criterionId: 3, alternativeId: 1, rating: 'weak', rationale: 'Multiple parallel workstreams: hiring, legal entity, product localisation, GTM build. High coordination complexity.', confidence: 'high', assumptions: 'Experienced project leadership available. Board provides clear governance.', concerns: 'Execution risk is concentrated. Limited fallback options if any stream fails.', disagreement: false, disagreementNote: '' },
  { criterionId: 3, alternativeId: 2, rating: 'moderate', rationale: 'Governance complexity from partnership but partner absorbs operational execution burden.', confidence: 'moderate', assumptions: 'Partnership governance structure is well-defined. Dispute resolution is clear.', concerns: 'Partner misalignment on priorities. Revenue share disputes.', disagreement: true, disagreementNote: 'CFO concerned about governance overhead; CSO sees it as manageable' },
  { criterionId: 3, alternativeId: 3, rating: 'very-strong', rationale: 'Simplest execution: one contract, minimal integration, limited touchpoints. Fewest moving parts.', confidence: 'high', assumptions: 'Agent is capable and motivated. No complex integration required.', concerns: 'Execution simplicity may mask strategic weakness.', disagreement: false, disagreementNote: '' },
  { criterionId: 3, alternativeId: 4, rating: 'moderate', rationale: 'Phase 1 is simple. Phase 2 adds complexity but builds on validated Phase 1 learnings.', confidence: 'moderate', assumptions: 'Phase 2 can leverage Phase 1 relationships and learnings. Transition is clean.', concerns: 'Two-phase adds structural complexity. Decision gates may create delays.', disagreement: false, disagreementNote: '' },

  { criterionId: 4, alternativeId: 1, rating: 'moderate', rationale: 'Full control aligns leadership but may face resistance from teams concerned about capital exposure.', confidence: 'moderate', assumptions: 'Leadership is aligned on strategic priority. Teams support international expansion.', concerns: 'Board may be divided on capital intensity. Some investors prefer lower risk.', disagreement: true, disagreementNote: 'Board split: growth investors support, value investors concerned' },
  { criterionId: 4, alternativeId: 2, rating: 'strong', rationale: 'Shared risk broadens stakeholder support. Partner relationship adds external validation.', confidence: 'moderate', assumptions: 'Partner is reputable and respected. Partnership signals market confidence.', concerns: 'Some stakeholders may view partnership as inferior to direct ownership.', disagreement: false, disagreementNote: '' },
  { criterionId: 4, alternativeId: 3, rating: 'weak', rationale: 'Low commitment may signal weak conviction. Limited stakeholder engagement due to minimal involvement.', confidence: 'low', assumptions: 'Low-risk approach is viewed positively by conservative stakeholders.', concerns: 'May be seen as "testing the water" rather than serious commitment. Brand perception risk.', disagreement: false, disagreementNote: '' },
  { criterionId: 4, alternativeId: 4, rating: 'strong', rationale: 'Staged approach satisfies both risk-averse and growth-oriented stakeholders. Clear decision gates provide comfort.', confidence: 'moderate', assumptions: 'All stakeholders accept Phase 1 as valid strategy. Phase 2 approval is achievable.', concerns: 'Stakeholders may pressure for Phase 2 regardless of Phase 1 results.', disagreement: false, disagreementNote: '' },

  { criterionId: 5, alternativeId: 1, rating: 'weak', rationale: 'High capital commitment is largely irreversible. Sunk costs create pressure to continue regardless of performance.', confidence: 'high', assumptions: 'Board supports sunk cost discipline. Leadership can pivot if needed.', concerns: 'Psychological commitment bias. Hard to exit after $20M+ invested.', disagreement: false, disagreementNote: '' },
  { criterionId: 5, alternativeId: 2, rating: 'moderate', rationale: 'Partnership terms can be renegotiated or exited with defined clauses. More flexible than full build.', confidence: 'moderate', assumptions: 'Exit clauses are enforceable. Partner is reasonable in renegotiation.', concerns: 'Partnership breakup may damage market relationships. Reputational cost.', disagreement: false, disagreementNote: '' },
  { criterionId: 5, alternativeId: 3, rating: 'very-strong', rationale: 'Maximum flexibility. Can scale up, terminate, or pivot with minimal cost. Preserves all options.', confidence: 'high', assumptions: 'Agent contract has clean termination terms. No long-term obligations.', concerns: 'Flexibility comes at cost of market position. Competitors may advance while we test.', disagreement: false, disagreementNote: '' },
  { criterionId: 5, alternativeId: 4, rating: 'very-strong', rationale: 'Explicit optionality built into structure. Phase 1 is a real option on Phase 2. Can exit after Phase 1 with limited loss.', confidence: 'moderate', assumptions: 'Phase 1 costs are truly sunk and informative. Phase 2 decision is objective.', concerns: 'Organizational pressure to proceed to Phase 2 may override objective criteria.', disagreement: true, disagreementNote: 'CEO committed to Phase 2; CFO wants objective gate' },

  { criterionId: 6, alternativeId: 1, rating: 'moderate', rationale: 'Direct entity must comply fully but has control over compliance approach. Can design for compliance from start.', confidence: 'moderate', assumptions: 'Regulatory requirements are known and stable. Compliance team is engaged early.', concerns: 'Japan data residency may require architecture changes. Timeline uncertainty.', disagreement: false, disagreementNote: '' },
  { criterionId: 6, alternativeId: 2, rating: 'strong', rationale: 'Partner absorbs regulatory interface and local compliance burden. Shared compliance expertise.', confidence: 'moderate', assumptions: 'Partner has strong regulatory relationships. Compliance is current and effective.', concerns: 'Dependency on partner compliance. If partner fails, we fail.', disagreement: false, disagreementNote: '' },
  { criterionId: 6, alternativeId: 3, rating: 'very-strong', rationale: 'Minimal regulatory exposure. Agent model avoids direct regulatory interface in most markets.', confidence: 'moderate', assumptions: 'Agent bears regulatory responsibility. Our product does not trigger direct licensing.', concerns: 'If product evolves, may need direct compliance. Limited regulatory learning.', disagreement: false, disagreementNote: '' },
  { criterionId: 6, alternativeId: 4, rating: 'moderate', rationale: 'Phase 1 is low exposure. Phase 2 has same exposure as full build but enters with Phase 1 regulatory learnings.', confidence: 'low', assumptions: 'Phase 1 generates actionable regulatory intelligence. Rules do not change between phases.', concerns: 'Regulatory changes during Phase 1 could make Phase 2 assumptions invalid.', disagreement: false, disagreementNote: '' },

  { criterionId: 7, alternativeId: 1, rating: 'strong', rationale: 'Full brand presence and product control enables strongest differentiation. Direct customer relationships.', confidence: 'moderate', assumptions: 'Product quality and brand translate to APAC market. Localisation preserves differentiation.', concerns: 'Competitors may respond aggressively to direct challenge. Price war risk.', disagreement: false, disagreementNote: '' },
  { criterionId: 7, alternativeId: 2, rating: 'moderate', rationale: 'Partner brand association may help or hurt. Leverages partner credibility but dilutes our brand.', confidence: 'low', assumptions: 'Partner brand is complementary, not competitive. Co-branding is effective.', concerns: 'Partner brand may overshadow ours. Customer sees partner as primary vendor.', disagreement: true, disagreementNote: 'Marketing wants co-branding; CEO wants our brand first' },
  { criterionId: 7, alternativeId: 3, rating: 'weak', rationale: 'Minimal brand presence. Agent owns customer relationship. Hard to build differentiation through third party.', confidence: 'high', assumptions: 'Product quality alone drives differentiation. Agent sales skills compensate.', concerns: 'No brand building. Competitors may lock customers before we establish brand.', disagreement: false, disagreementNote: '' },
  { criterionId: 7, alternativeId: 4, rating: 'strong', rationale: 'Phase 1 tests positioning with limited exposure. Phase 2 builds on validated positioning with full resources.', confidence: 'moderate', assumptions: 'Phase 1 positioning insights are actionable. Phase 2 can execute refined positioning.', concerns: 'Two-phase may confuse market positioning. Competitors may preempt during Phase 1.', disagreement: false, disagreementNote: '' },

  { criterionId: 8, alternativeId: 1, rating: 'very-strong', rationale: 'Full ownership enables unlimited scaling. No dependency constraints. Can expand to all markets and products.', confidence: 'high', assumptions: 'Capital is available for scaling. Market demand supports expansion.', concerns: 'Scalability requires sustained capital commitment. Economic downturns may constrain.', disagreement: false, disagreementNote: '' },
  { criterionId: 8, alternativeId: 2, rating: 'moderate', rationale: 'Scalability depends on partner capacity and willingness. Revenue share may discourage partner from over-investing.', confidence: 'moderate', assumptions: 'Partner has scaling capability. Revenue share incentivizes partner growth.', concerns: 'Partner may cap investment at their optimal level, not ours.', disagreement: false, disagreementNote: '' },
  { criterionId: 8, alternativeId: 3, rating: 'weak', rationale: 'Limited scalability. Agent capacity and motivation constrain growth. Commission structure may not incent scale.', confidence: 'moderate', assumptions: 'Agent can recruit additional capacity. Commission scales with volume.', concerns: 'Agent prioritizes other products. No direct control over scaling speed.', disagreement: false, disagreementNote: '' },
  { criterionId: 8, alternativeId: 4, rating: 'strong', rationale: 'Phase 2 inherits Phase 1 learnings. Scalable structure built on validated demand. Can pause or accelerate based on data.', confidence: 'moderate', assumptions: 'Phase 1 data accurately predicts scaling economics. Infrastructure is reusable.', concerns: 'Phase 1 infrastructure may not support Phase 2 scale. May need rebuild.', disagreement: false, disagreementNote: '' },
];

const sColors = [
  { fill: '#C9A84C', soft: '#FDF8E8', dark: '#8B6914' },
  { fill: '#2563EB', soft: '#EFF6FF', dark: '#1D4ED8' },
  { fill: '#059669', soft: '#ECFDF5', dark: '#047857' },
  { fill: '#DC2626', soft: '#FEF2F2', dark: '#B91C1C' },
];

// ============================================================================
// AI VALIDATION ENGINE
// ============================================================================

function generateValidationFlags(criteria: Criterion[], alternatives: Alternative[], assessments: AssessmentCell[]): ValidationFlag[] {
  const flags: ValidationFlag[] = [];
  const key = (cid: number, aid: number) => `${cid}_${aid}`;
  const get = (cid: number, aid: number) => assessments.find(a => a.criterionId === cid && a.alternativeId === aid);

  // 1. No rationale provided
  assessments.forEach(a => {
    if (!a.rationale || a.rationale.length < 10) {
      flags.push({ type: 'no-rationale', severity: 'critical', message: `Assessment of "${alternatives.find(al => al.id === a.alternativeId)?.name}" on "${criteria.find(c => c.id === a.criterionId)?.name}" lacks supporting reasoning.`, cellKey: key(a.criterionId, a.alternativeId) });
    }
  });

  // 2. Inconsistent logic (strong rating but weak rationale)
  assessments.filter(a => a.rating === 'strong' || a.rating === 'very-strong').forEach(a => {
    const weakWords = ['weak', 'limited', 'poor', 'difficult', 'risky', 'concern', 'problem'];
    if (weakWords.some(w => a.rationale.toLowerCase().includes(w))) {
      flags.push({ type: 'inconsistent', severity: 'warning', message: `Strong rating for "${alternatives.find(al => al.id === a.alternativeId)?.name}" on "${criteria.find(c => c.id === a.criterionId)?.name}" but rationale contains concerning language.`, cellKey: key(a.criterionId, a.alternativeId) });
    }
  });

  // 3. Overconfidence (high confidence despite major uncertainties)
  assessments.filter(a => a.confidence === 'high').forEach(a => {
    if (a.assumptions.length > 30 && a.concerns.length > 20) {
      flags.push({ type: 'overconfidence', severity: 'warning', message: `High confidence assigned for "${alternatives.find(al => al.id === a.alternativeId)?.name}" on "${criteria.find(c => c.id === a.criterionId)?.name}" despite significant assumptions and concerns.`, cellKey: key(a.criterionId, a.alternativeId) });
    }
  });

  // 4. Groupthink (all alternatives rated similarly on a criterion)
  criteria.forEach(c => {
    const ratings = alternatives.map(a => get(c.id, a.id)?.rating).filter(Boolean) as RatingScale[];
    if (ratings.length >= 3) {
      const unique = new Set(ratings);
      if (unique.size <= 2) {
        flags.push({ type: 'groupthink', severity: 'warning', message: `All alternatives rated similarly on "${c.name}". This may indicate insufficient differentiation or groupthink.`, criterionId: c.id });
      }
    }
  });

  // 5. Missing trade-offs (all ratings positive for an alternative)
  alternatives.forEach(alt => {
    const altRatings = criteria.map(c => get(c.id, alt.id)?.rating).filter(Boolean) as RatingScale[];
    const weakCount = altRatings.filter(r => r === 'weak' || r === 'very-weak').length;
    if (altRatings.length >= 5 && weakCount === 0) {
      flags.push({ type: 'missing-tradeoffs', severity: 'info', message: `"${alt.name}" has no weak ratings. Every strategy has trade-offs — are weaknesses being acknowledged?` });
    }
  });

  // 6. Weak differentiation (overall scores too similar)
  const altScores = alternatives.map(a => {
    const scores = criteria.map(c => RATING_CONFIG[get(c.id, a.id)?.rating || 'moderate'].score);
    return scores.reduce((s, v) => s + v, 0) / scores.length;
  });
  const scoreRange = Math.max(...altScores) - Math.min(...altScores);
  if (scoreRange < 0.5 && altScores.length >= 3) {
    flags.push({ type: 'weak-differentiation', severity: 'warning', message: `Average scores across alternatives differ by only ${scoreRange.toFixed(2)} points. The assessment may not sufficiently differentiate between options.` });
  }

  // 7. Missing criteria
  if (criteria.length < 5) {
    flags.push({ type: 'missing-criteria', severity: 'info', message: `Only ${criteria.length} criteria defined. Consider adding criteria for team capability, cultural fit, technology readiness, or environmental impact.` });
  }

  // 8. Assumption confusion (assumptions treated as facts)
  assessments.forEach(a => {
    if (a.assumptions.length > 0 && !a.assumptions.toLowerCase().includes('if') && !a.assumptions.toLowerCase().includes('assuming') && !a.assumptions.toLowerCase().includes('provided')) {
      flags.push({ type: 'assumption-confusion', severity: 'info', message: `Assumptions for "${alternatives.find(al => al.id === a.alternativeId)?.name}" on "${criteria.find(c => c.id === a.criterionId)?.name}" read as facts. Flag them explicitly as assumptions.`, cellKey: key(a.criterionId, a.alternativeId) });
    }
  });

  return flags;
}

function computeQualityScore(criteria: Criterion[], alternatives: Alternative[], assessments: AssessmentCell[]): { total: number; max: number; breakdown: { dimension: string; score: number; max: number }[] } {
  const breakdown = [
    { dimension: 'Rationale Quality', score: 0, max: 20 },
    { dimension: 'Differentiation', score: 0, max: 15 },
    { dimension: 'Trade-off Visibility', score: 0, max: 15 },
    { dimension: 'Uncertainty Awareness', score: 0, max: 15 },
    { dimension: 'Consistency', score: 0, max: 10 },
    { dimension: 'Criteria Completeness', score: 0, max: 10 },
    { dimension: 'Confidence Realism', score: 0, max: 10 },
    { dimension: 'Stakeholder Alignment', score: 0, max: 5 },
  ];

  // Rationale quality
  const rationaleCount = assessments.filter(a => a.rationale.length > 20).length;
  breakdown[0].score = Math.round((rationaleCount / (criteria.length * alternatives.length || 1)) * 20);

  // Differentiation
  const cellCount = criteria.length * alternatives.length;
  const uniqueRatings = new Set(assessments.map(a => a.rating)).size;
  breakdown[1].score = Math.min(15, uniqueRatings * 3);

  // Trade-off visibility
  const hasWeak = alternatives.some(alt => criteria.some(c => {
    const a = assessments.find(x => x.criterionId === c.id && x.alternativeId === alt.id);
    return a?.rating === 'weak' || a?.rating === 'very-weak';
  }));
  breakdown[2].score = hasWeak ? 15 : 5;

  // Uncertainty awareness
  const hasAssumptions = assessments.filter(a => a.assumptions.length > 10).length;
  breakdown[3].score = Math.round((hasAssumptions / (cellCount || 1)) * 15);

  // Consistency
  const inconsistent = assessments.filter(a => {
    const strong = a.rating === 'strong' || a.rating === 'very-strong';
    const weakWords = ['weak', 'limited', 'poor', 'difficult'];
    return strong && weakWords.some(w => a.rationale.toLowerCase().includes(w));
  }).length;
  breakdown[4].score = Math.max(0, 10 - inconsistent * 2);

  // Criteria completeness
  breakdown[5].score = Math.min(10, criteria.length * 2);

  // Confidence realism
  const highConfWithConcerns = assessments.filter(a => a.confidence === 'high' && a.concerns.length > 20).length;
  breakdown[6].score = Math.max(0, 10 - highConfWithConcerns * 2);

  // Stakeholder alignment
  const hasDisagreement = assessments.some(a => a.disagreement);
  breakdown[7].score = hasDisagreement ? 5 : 2;

  const total = breakdown.reduce((s, d) => s + d.score, 0);
  const max = breakdown.reduce((s, d) => s + d.max, 0);
  return { total, max, breakdown };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QualitativeAssessment({ sessionId, data, hooks }: ModuleProps) {
  const [criteria, setCriteria] = useState<Criterion[]>(DEMO_CRITERIA);
  const [alternatives, setAlternatives] = useState<Alternative[]>(DEMO_ALTERNATIVES);
  const [assessments, setAssessments] = useState<AssessmentCell[]>(DEMO_ASSESSMENTS);
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'analysis' | 'tradeoffs'>('matrix');
  const [selectedCriterion, setSelectedCriterion] = useState<number | null>(null);

  const flags = useMemo(() => generateValidationFlags(criteria, alternatives, assessments), [criteria, alternatives, assessments]);
  const quality = useMemo(() => computeQualityScore(criteria, alternatives, assessments), [criteria, alternatives, assessments]);

  const cellKey = (cid: number, aid: number) => `${cid}_${aid}`;
  const getCell = (cid: number, aid: number) => assessments.find(a => a.criterionId === cid && a.alternativeId === aid);

  const updateCell = (cid: number, aid: number, field: keyof AssessmentCell, value: any) => {
    const key = cellKey(cid, aid);
    setAssessments(prev => {
      const existing = prev.find(a => a.criterionId === cid && a.alternativeId === aid);
      if (existing) {
        return prev.map(a => a.criterionId === cid && a.alternativeId === aid ? { ...a, [field]: value } : a);
      }
      return [...prev, { criterionId: cid, alternativeId: aid, rating: 'moderate', rationale: '', confidence: 'moderate', assumptions: '', concerns: '', disagreement: false, disagreementNote: '', [field]: value }];
    });
  };

  const criticalFlags = flags.filter(f => f.severity === 'critical');
  const warningFlags = flags.filter(f => f.severity === 'warning');
  const infoFlags = flags.filter(f => f.severity === 'info');
  const scoreColor = quality.total >= 80 ? '#059669' : quality.total >= 50 ? '#D97706' : '#DC2626';

  const weightedScore = (altId: number) => {
    let totalWeight = 0;
    let weightedSum = 0;
    criteria.forEach(c => {
      const a = getCell(c.id, altId);
      if (a) {
        const w = IMPORTANCE_WEIGHTS[c.importance] || 1;
        totalWeight += w;
        weightedSum += RATING_CONFIG[a.rating].score * w;
      }
    });
    return totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : '—';
  };

  return (
    <div className="space-y-4" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <BarChart3 size={22} style={{ color: DS.values.fill }} /> Qualitative Assessment
          </h2>
          <p className="text-xs mt-0.5" style={{ color: DS.inkTer }}>{criteria.length} criteria &middot; {alternatives.length} alternatives &middot; {assessments.length} assessments &middot; Quality: {quality.total}/{quality.max} ({Math.round((quality.total / quality.max) * 100)}%)</p>
        </div>
      </div>

      {/* Quality Score Banner */}
      <Card className="border-0 shadow-sm" style={{ borderLeft: `3px solid ${scoreColor}` }}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: scoreColor + '15' }}>
            <span className="text-sm font-bold" style={{ color: scoreColor }}>{Math.round((quality.total / quality.max) * 100)}%</span>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold" style={{ color: scoreColor }}>
              {quality.total >= 80 ? 'HIGH QUALITY — Well-structured qualitative assessment' : quality.total >= 50 ? 'MODERATE — Some gaps to address' : 'NEEDS WORK — Significant improvements needed'}
            </p>
            <p className="text-[9px]" style={{ color: DS.inkTer }}>
              {criticalFlags.length} critical &middot; {warningFlags.length} warnings &middot; {infoFlags.length} info &middot; {flags.length} total flags
            </p>
          </div>
          {flags.length > 0 && <Badge className="text-[9px] h-5" style={{ background: '#FEF2F2', color: '#DC2626' }}>{flags.length} flags</Badge>}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        {[
          { key: 'matrix' as const, label: 'Assessment Matrix', icon: BarChart3 },
          { key: 'analysis' as const, label: 'AI Analysis', icon: BrainCircuit },
          { key: 'tradeoffs' as const, label: 'Trade-offs', icon: TrendingUp },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-medium transition-all ${activeTab === t.key ? 'bg-white shadow-sm' : ''}`} style={{ color: activeTab === t.key ? DS.ink : DS.inkTer }}>
            <t.icon size={10} /> {t.label}
          </button>
        ))}
      </div>

      {/* ==================== MATRIX VIEW ==================== */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          {/* Compact Matrix */}
          <Card className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr style={{ background: DS.bg }}>
                    <th className="text-left p-2.5 font-semibold sticky left-0 z-10" style={{ color: DS.inkSub, minWidth: 140, background: DS.bg }}>
                      Criterion <span style={{ color: DS.inkDis }}>({criteria.length})</span>
                    </th>
                    {alternatives.map(alt => (
                      <th key={alt.id} className="p-2.5 text-center font-semibold" style={{ color: sColors[alt.colorIdx].dark, minWidth: 100 }}>
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: sColors[alt.colorIdx].fill }} />
                          {alt.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteria.map(c => {
                    const isSelected = selectedCriterion === c.id;
                    return (
                      <tr key={c.id} className="border-t" style={{ borderColor: DS.borderLight, background: isSelected ? '#FAFBFF' : 'transparent' }}>
                        <td className="p-2.5 sticky left-0 z-10" style={{ background: isSelected ? '#FAFBFF' : 'white', minWidth: 140 }}>
                          <div className="flex items-start gap-1.5">
                            <button onClick={() => setSelectedCriterion(isSelected ? null : c.id)} className="mt-0.5">
                              <ChevronRight size={10} style={{ color: DS.inkDis, transform: isSelected ? 'rotate(90deg)' : 'none' }} />
                            </button>
                            <div>
                              <div className="text-[10px] font-semibold" style={{ color: DS.ink }}>{c.name}</div>
                              <div className="text-[8px] mt-0.5" style={{ color: DS.inkTer }}>
                                <Badge className="text-[7px] h-3 px-1" variant="outline" style={{ color: c.importance === 'critical' ? '#DC2626' : c.importance === 'high' ? '#D97706' : '#64748B' }}>{c.importance}</Badge>
                                <span className="ml-1">{c.type}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {alternatives.map(alt => {
                          const a = getCell(c.id, alt.id);
                          const rc = a ? RATING_CONFIG[a.rating] : RATING_CONFIG.moderate;
                          const hasFlag = flags.some(f => f.cellKey === cellKey(c.id, alt.id));
                          return (
                            <td key={alt.id} className="p-1.5 text-center" style={{ cursor: 'pointer' }} onClick={() => setExpandedCell(expandedCell === cellKey(c.id, alt.id) ? null : cellKey(c.id, alt.id))}>
                              <div className="p-1.5 rounded-lg border transition-all hover:shadow-sm" style={{
                                borderColor: hasFlag ? '#F59E0B' : rc.color + '30',
                                background: rc.soft,
                              }}>
                                <div className="text-[9px] font-bold" style={{ color: rc.color }}>{rc.label}</div>
                                <div className="flex items-center justify-center gap-1 mt-0.5">
                                  {a?.disagreement && <Users size={8} style={{ color: '#DC2626' }} />}
                                  {a && <div className="w-1.5 h-1.5 rounded-full" style={{ background: CONFIDENCE_CONFIG[a.confidence].color }} />}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Weighted Score Row */}
                  <tr className="border-t font-semibold" style={{ background: DS.bg, borderColor: DS.borderLight }}>
                    <td className="p-2.5 sticky left-0 z-10" style={{ background: DS.bg }}>Weighted Score</td>
                    {alternatives.map(alt => (
                      <td key={alt.id} className="p-2.5 text-center text-sm font-bold" style={{ color: sColors[alt.colorIdx].dark }}>
                        {weightedScore(alt.id)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Expanded Cell Detail */}
          {expandedCell && (() => {
            const [cid, aid] = expandedCell.split('_').map(Number);
            const c = criteria.find(x => x.id === cid);
            const alt = alternatives.find(x => x.id === aid);
            const a = getCell(cid, aid);
            if (!c || !alt) return null;
            return (
              <Card className="border-0 shadow-sm" style={{ borderLeft: `3px solid ${sColors[alt.colorIdx].fill}` }}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: sColors[alt.colorIdx].fill }} />
                      <span className="text-xs font-bold" style={{ color: DS.ink }}>{alt.name} on {c.name}</span>
                    </div>
                    <button onClick={() => setExpandedCell(null)} className="text-gray-400 hover:text-gray-600"><XCircle size={12} /></button>
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="text-[9px] font-medium block mb-1" style={{ color: DS.inkTer }}>Qualitative Rating</label>
                    <div className="flex gap-1">
                      {(Object.keys(RATING_CONFIG) as RatingScale[]).map(r => {
                        const rc = RATING_CONFIG[r];
                        const isActive = a?.rating === r;
                        return (
                          <button key={r} onClick={() => updateCell(cid, aid, 'rating', r)}
                            className="flex-1 py-1.5 rounded-md text-[9px] font-medium transition-all border"
                            style={{ background: isActive ? rc.soft : 'white', borderColor: isActive ? rc.color : DS.borderLight, color: isActive ? rc.color : DS.inkTer }}>
                            {rc.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rationale */}
                  <div>
                    <label className="text-[9px] font-medium block mb-1" style={{ color: DS.inkTer }}>Assessment Rationale <span style={{ color: '#DC2626' }}>*</span></label>
                    <Textarea value={a?.rationale || ''} onChange={e => updateCell(cid, aid, 'rationale', e.target.value)} className="text-[10px] bg-white" rows={2} placeholder="Why was this rating assigned? Be specific." />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Confidence */}
                    <div>
                      <label className="text-[9px] font-medium block mb-1" style={{ color: DS.inkTer }}>Confidence Level</label>
                      <div className="flex gap-1">
                        {(Object.keys(CONFIDENCE_CONFIG) as ConfidenceLevel[]).map(conf => {
                          const cc = CONFIDENCE_CONFIG[conf];
                          const isActive = a?.confidence === conf;
                          return (
                            <button key={conf} onClick={() => updateCell(cid, aid, 'confidence', conf)}
                              className="flex-1 py-1 rounded-md text-[8px] font-medium transition-all border"
                              style={{ background: isActive ? cc.color + '15' : 'white', borderColor: isActive ? cc.color : DS.borderLight, color: isActive ? cc.color : DS.inkTer }}>
                              {cc.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Disagreement */}
                    <div>
                      <label className="text-[9px] font-medium block mb-1" style={{ color: DS.inkTer }}>Stakeholder Disagreement?</label>
                      <button onClick={() => updateCell(cid, aid, 'disagreement', !a?.disagreement)}
                        className="w-full py-1 rounded-md text-[8px] font-medium transition-all border flex items-center justify-center gap-1"
                        style={{ background: a?.disagreement ? '#FEF2F2' : 'white', borderColor: a?.disagreement ? '#DC2626' : DS.borderLight, color: a?.disagreement ? '#DC2626' : DS.inkTer }}>
                        {a?.disagreement ? <><Users size={8} /> Disagreement noted</> : 'No disagreement'}
                      </button>
                    </div>
                  </div>

                  {/* Assumptions & Concerns */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-medium block mb-1" style={{ color: DS.inkTer }}>Key Assumptions</label>
                      <Textarea value={a?.assumptions || ''} onChange={e => updateCell(cid, aid, 'assumptions', e.target.value)} className="text-[10px] bg-white" rows={2} placeholder="What assumptions support this assessment?" />
                    </div>
                    <div>
                      <label className="text-[9px] font-medium block mb-1" style={{ color: DS.inkTer }}>Key Concerns</label>
                      <Textarea value={a?.concerns || ''} onChange={e => updateCell(cid, aid, 'concerns', e.target.value)} className="text-[10px] bg-white" rows={2} placeholder="What caveats or concerns exist?" />
                    </div>
                  </div>

                  {a?.disagreement && (
                    <div>
                      <label className="text-[9px] font-medium block mb-1" style={{ color: '#DC2626' }}>Disagreement Note</label>
                      <Textarea value={a?.disagreementNote || ''} onChange={e => updateCell(cid, aid, 'disagreementNote', e.target.value)} className="text-[10px] bg-white" rows={2} placeholder="Who disagrees and why?" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(RATING_CONFIG) as [RatingScale, typeof RATING_CONFIG['strong']][]).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: v.soft }}>
                <div className="w-2 h-2 rounded-full" style={{ background: v.color }} />
                <span className="text-[9px] font-medium" style={{ color: v.color }}>{v.label}</span>
              </div>
            ))}
            <div className="w-px h-4 bg-gray-300 mx-1" />
            {(Object.entries(CONFIDENCE_CONFIG) as [ConfidenceLevel, typeof CONFIDENCE_CONFIG['high']][]).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: v.color + '10' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: v.color }} />
                <span className="text-[8px]" style={{ color: v.color }}>{v.label} confidence</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== AI ANALYSIS ==================== */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          {/* Quality Score Breakdown */}
          <Card className="border-0 shadow-sm"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} style={{ color: DS.values.fill }} />
              <span className="text-xs font-bold" style={{ color: DS.ink }}>Assessment Quality Score</span>
              <span className="text-sm font-bold ml-auto" style={{ color: scoreColor }}>{quality.total}/{quality.max}</span>
            </div>
            <div className="space-y-2">
              {quality.breakdown.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] w-36" style={{ color: DS.inkSub }}>{d.dimension}</span>
                  <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.score / d.max) * 100}%`, background: d.score >= d.max * 0.7 ? '#10B981' : d.score >= d.max * 0.4 ? '#F59E0B' : '#DC2626' }} />
                  </div>
                  <span className="text-[10px] font-bold w-10 text-right" style={{ color: d.score >= d.max * 0.7 ? '#059669' : d.score >= d.max * 0.4 ? '#D97706' : '#DC2626' }}>{d.score}/{d.max}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>

          {/* Validation Flags */}
          {flags.length > 0 && (
            <Card className="border-0 shadow-sm" style={{ borderLeft: '3px solid #F59E0B' }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BrainCircuit size={14} style={{ color: '#F59E0B' }} />
                  <span className="text-xs font-bold" style={{ color: '#D97706' }}>AI Validation Flags</span>
                  <span className="text-[9px] ml-auto" style={{ color: DS.inkTer }}>Deterministic</span>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{
                      background: f.severity === 'critical' ? '#FEF2F2' : f.severity === 'warning' ? '#FFFBEB' : '#F8FAFC',
                      borderLeft: `2px solid ${f.severity === 'critical' ? '#DC2626' : f.severity === 'warning' ? '#F59E0B' : '#3B82F6'}`
                    }}>
                      <AlertTriangle size={10} className="mt-0.5 shrink-0" style={{ color: f.severity === 'critical' ? '#DC2626' : f.severity === 'warning' ? '#F59E0B' : '#3B82F6' }} />
                      <div>
                        <span className="text-[10px] font-medium capitalize" style={{ color: DS.ink }}>{f.type.replace('-', ' ')}</span>
                        <p className="text-[9px] mt-0.5" style={{ color: DS.inkSub }}>{f.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Facilitator Questions */}
          <Card className="border-0 shadow-sm"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} style={{ color: '#7C3AED' }} />
              <span className="text-xs font-bold" style={{ color: '#5B21B6' }}>AI Facilitator Questions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'What assumption most affects this assessment?',
                'Where is the team least confident?',
                'What criterion most differentiates these strategies?',
                'Which assessment is most vulnerable to bias?',
                'What trade-off is being accepted?',
                'Where do stakeholders most disagree?',
              ].map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg border" style={{ borderColor: DS.borderLight, background: '#FAFBFF' }}>
                  <Lightbulb size={10} className="mt-0.5 shrink-0" style={{ color: '#7C3AED' }} />
                  <span className="text-[10px]" style={{ color: DS.inkSub }}>{q}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* ==================== TRADE-OFFS ==================== */}
      {activeTab === 'tradeoffs' && (
        <div className="space-y-4">
          {/* Trade-off Heatmap */}
          <Card className="border-0 shadow-sm"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} style={{ color: DS.values.fill }} />
              <span className="text-xs font-bold" style={{ color: DS.ink }}>Trade-off Heatmap</span>
              <span className="text-[9px] ml-auto" style={{ color: DS.inkTer }}>Green = strength, Red = weakness</span>
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <th className="text-left p-1.5 font-semibold" style={{ color: DS.inkTer }}>Criterion</th>
                  {alternatives.map(alt => (
                    <th key={alt.id} className="p-1.5 text-center font-semibold" style={{ color: sColors[alt.colorIdx].dark }}>{alt.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map(c => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${DS.borderLight}` }}>
                    <td className="p-1.5 font-medium" style={{ color: DS.inkSub }}>{c.name}</td>
                    {alternatives.map(alt => {
                      const a = getCell(c.id, alt.id);
                      const rc = a ? RATING_CONFIG[a.rating] : RATING_CONFIG.moderate;
                      return (
                        <td key={alt.id} className="p-1">
                          <div className="w-full h-6 rounded flex items-center justify-center font-bold text-[8px]" style={{ background: rc.soft, color: rc.color }}>
                            {rc.label}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>

          {/* Confidence Heatmap */}
          <Card className="border-0 shadow-sm"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} style={{ color: '#3B82F6' }} />
              <span className="text-xs font-bold" style={{ color: DS.ink }}>Confidence Heatmap</span>
              <span className="text-[9px] ml-auto" style={{ color: DS.inkTer }}>Green = high, Red = low</span>
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <th className="text-left p-1.5 font-semibold" style={{ color: DS.inkTer }}>Criterion</th>
                  {alternatives.map(alt => (
                    <th key={alt.id} className="p-1.5 text-center font-semibold" style={{ color: sColors[alt.colorIdx].dark }}>{alt.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map(c => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${DS.borderLight}` }}>
                    <td className="p-1.5 font-medium" style={{ color: DS.inkSub }}>{c.name}</td>
                    {alternatives.map(alt => {
                      const a = getCell(c.id, alt.id);
                      const cc = a ? CONFIDENCE_CONFIG[a.confidence] : CONFIDENCE_CONFIG.moderate;
                      return (
                        <td key={alt.id} className="p-1">
                          <div className="w-full h-6 rounded flex items-center justify-center font-bold text-[8px]" style={{ background: cc.color + '15', color: cc.color }}>
                            {cc.label}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>

          {/* Disagreement Map */}
          <Card className="border-0 shadow-sm"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} style={{ color: '#DC2626' }} />
              <span className="text-xs font-bold" style={{ color: DS.ink }}>Disagreement Map</span>
            </div>
            {assessments.filter(a => a.disagreement).length > 0 ? (
              <div className="space-y-2">
                {assessments.filter(a => a.disagreement).map((a, i) => {
                  const c = criteria.find(x => x.id === a.criterionId);
                  const alt = alternatives.find(x => x.id === a.alternativeId);
                  return (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: '#FEF2F2', borderLeft: '2px solid #DC2626' }}>
                      <Users size={10} className="mt-0.5 shrink-0" style={{ color: '#DC2626' }} />
                      <div>
                        <span className="text-[10px] font-medium" style={{ color: DS.ink }}>{alt?.name} on {c?.name}</span>
                        <p className="text-[9px] mt-0.5" style={{ color: DS.inkSub }}>{a.disagreementNote || 'Stakeholder disagreement noted but not documented.'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs" style={{ color: DS.inkDis }}>No disagreements flagged. Consider whether all assessments have sufficient stakeholder input.</p>
            )}
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
