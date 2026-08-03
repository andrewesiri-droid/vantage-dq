// ============================================================
// DECISION INTELLIGENCE SCHEMA
// Central decomposition engine for the DQ workflow
// ============================================================

export type RaisedItemClassification =
  | 'strategic_decision'
  | 'tactical_decision'
  | 'fact'
  | 'uncertainty'
  | 'risk'
  | 'assumption'
  | 'constraint'
  | 'stakeholder_concern'
  | 'opportunity'
  | 'information_gap'
  | 'action_item'
  | 'evaluation_criterion'
  | 'dependency'
  | 'conflict_tension'
  | 'brutal_truth'
  | 'out_of_scope'
  | 'duplicate';

export type RaisedItemCategory =
  | 'strategic'
  | 'technical'
  | 'commercial'
  | 'operational'
  | 'stakeholder'
  | 'financial'
  | 'regulatory'
  | 'timing'
  | 'organizational';

export type RaisedItemSource = 'user' | 'ai' | 'document' | 'workshop';

export type RaisedItemReviewStatus =
  | 'draft'
  | 'needs_review'
  | 'accepted'
  | 'rejected'
  | 'routed';

export type DownstreamTarget =
  | 'decision_hierarchy'
  | 'scenario_planning'
  | 'voi'
  | 'risk_timeline'
  | 'stakeholder_alignment'
  | 'strategy_table'
  | 'problem_frame'
  | 'qualitative_assessment'
  | 'game_theory';

export interface RaisedItem {
  id: string;
  title: string;
  description?: string;
  classification: RaisedItemClassification;
  category: RaisedItemCategory;
  source: RaisedItemSource;
  sourceReference?: string;
  confidenceScore?: number;
  linkedProblemFrameFields: string[];
  reviewStatus: RaisedItemReviewStatus;
  priorityScore?: number;
  decisionImpact?: 1 | 2 | 3 | 4 | 5;
  urgency?: 1 | 2 | 3 | 4 | 5;
  uncertaintyLevel?: 1 | 2 | 3 | 4 | 5;
  downstreamTargets?: DownstreamTarget[];
  votes?: number;
  duplicateOf?: string;
  rationale?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Classification metadata ───────────────────────────────────

export const CLASSIFICATION_META: Record<RaisedItemClassification, {
  label: string; color: string; bg: string; icon: string;
  definition: string; downstreamTargets: DownstreamTarget[];
}> = {
  strategic_decision:  { label: 'Strategic Decision',  color: '#4F6AF5', bg: '#EEF2FF', icon: '🎯', definition: 'Major directional choice affecting value, risk, or long-term outcomes', downstreamTargets: ['decision_hierarchy'] },
  tactical_decision:   { label: 'Tactical Decision',   color: '#7C3AED', bg: '#F5F3FF', icon: '⚙️', definition: 'Lower-level implementation or sequencing choice', downstreamTargets: ['decision_hierarchy'] },
  fact:                { label: 'Fact / Given',         color: '#0F766E', bg: '#F0FDFA', icon: '📌', definition: 'A condition treated as true and fixed for the decision', downstreamTargets: ['problem_frame'] },
  uncertainty:         { label: 'Uncertainty',          color: '#D97706', bg: '#FEF3C7', icon: '❓', definition: 'Unknown variable that could materially affect outcomes', downstreamTargets: ['scenario_planning', 'voi'] },
  risk:                { label: 'Risk',                 color: '#DC2626', bg: '#FEF2F2', icon: '⚠️', definition: 'Possible future event with consequence and likelihood', downstreamTargets: ['risk_timeline'] },
  assumption:          { label: 'Assumption',           color: '#9333EA', bg: '#FAF5FF', icon: '💭', definition: 'Condition believed true but not fully validated', downstreamTargets: ['problem_frame', 'strategy_table'] },
  constraint:          { label: 'Constraint',           color: '#0891B2', bg: '#ECFEFF', icon: '🔒', definition: 'Hard limit that cannot be violated', downstreamTargets: ['problem_frame'] },
  stakeholder_concern: { label: 'Stakeholder Concern',  color: '#059669', bg: '#ECFDF5', icon: '👥', definition: 'Alignment, influence, approval, or resistance issue', downstreamTargets: ['stakeholder_alignment', 'game_theory'] },
  opportunity:         { label: 'Opportunity',          color: '#16A34A', bg: '#F0FDF4', icon: '🚀', definition: 'Potentially favorable condition or upside possibility', downstreamTargets: ['strategy_table'] },
  information_gap:     { label: 'Information Gap',      color: '#64748B', bg: '#F8FAFC', icon: '📭', definition: 'Missing data needed to improve decision confidence', downstreamTargets: ['voi'] },
  action_item:         { label: 'Action Item',          color: '#B45309', bg: '#FFFBEB', icon: '✅', definition: 'Task or follow-up required', downstreamTargets: [] },
  evaluation_criterion:{ label: 'Eval Criterion',       color: '#1D4ED8', bg: '#EFF6FF', icon: '📊', definition: 'Measure used to judge strategy quality', downstreamTargets: ['qualitative_assessment', 'problem_frame'] },
  dependency:          { label: 'Dependency',           color: '#475569', bg: '#F1F5F9', icon: '🔗', definition: 'Something that relies on another condition or event', downstreamTargets: ['decision_hierarchy'] },
  conflict_tension:    { label: 'Conflict / Tension',   color: '#E11D48', bg: '#FFF1F2', icon: '⚡', definition: 'Disagreement, trade-off, or competing objective', downstreamTargets: ['strategy_table'] },
  brutal_truth:        { label: 'Brutal Truth',         color: '#7C2D12', bg: '#FFF7ED', icon: '🔥', definition: 'The uncomfortable reality nobody in the room wants to say — DQ: the most important and most avoided issue type', downstreamTargets: ['problem_frame', 'strategy_table'] },
  out_of_scope:        { label: 'Out of Scope',         color: '#94A3B8', bg: '#F8FAFC', icon: '🚫', definition: 'Not relevant to this decision', downstreamTargets: [] },
  duplicate:           { label: 'Duplicate',            color: '#94A3B8', bg: '#F1F5F9', icon: '🔁', definition: 'Already captured elsewhere', downstreamTargets: [] },
};

export const CATEGORY_META: Record<RaisedItemCategory, { label: string; color: string }> = {
  strategic:     { label: 'Strategic',     color: '#4F6AF5' },
  technical:     { label: 'Technical',     color: '#0891B2' },
  commercial:    { label: 'Commercial',    color: '#D97706' },
  operational:   { label: 'Operational',   color: '#7C3AED' },
  stakeholder:   { label: 'Stakeholder',   color: '#059669' },
  financial:     { label: 'Financial',     color: '#B45309' },
  regulatory:    { label: 'Regulatory',    color: '#DC2626' },
  timing:        { label: 'Timing',        color: '#0284C7' },
  organizational:{ label: 'Organizational',color: '#475569' },
};

// ── Cluster groups for the Intelligence Map ───────────────────

export const CLUSTERS: {
  id: string; label: string; color: string; bg: string;
  classifications: RaisedItemClassification[];
}[] = [
  { id: 'decisions',     label: 'Strategic Decisions',   color: '#4F6AF5', bg: '#EEF2FF', classifications: ['strategic_decision', 'tactical_decision'] },
  { id: 'uncertainties', label: 'Uncertainties',         color: '#D97706', bg: '#FEF3C7', classifications: ['uncertainty', 'information_gap'] },
  { id: 'risks',         label: 'Risks',                 color: '#DC2626', bg: '#FEF2F2', classifications: ['risk'] },
  { id: 'assumptions',   label: 'Assumptions & Facts',   color: '#9333EA', bg: '#FAF5FF', classifications: ['assumption', 'fact', 'constraint'] },
  { id: 'stakeholders',  label: 'Stakeholder Concerns',  color: '#059669', bg: '#ECFDF5', classifications: ['stakeholder_concern', 'conflict_tension'] },
  { id: 'brutal_truths', label: 'Brutal Truths',          color: '#7C2D12', bg: '#FFF7ED', classifications: ['brutal_truth'] },
  { id: 'opportunities', label: 'Opportunities',         color: '#16A34A', bg: '#F0FDF4', classifications: ['opportunity'] },
  { id: 'criteria',      label: 'Criteria & Deps',       color: '#1D4ED8', bg: '#EFF6FF', classifications: ['evaluation_criterion', 'dependency'] },
  { id: 'other',         label: 'Actions & Other',       color: '#64748B', bg: '#F8FAFC', classifications: ['action_item', 'out_of_scope', 'duplicate'] },
];

// ── Helpers ───────────────────────────────────────────────────

export function makeItemId(): string {
  return `ri_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function computePriorityScore(item: RaisedItem): number {
  return (item.decisionImpact ?? 3) + (item.urgency ?? 3) + (item.uncertaintyLevel ?? 3);
}

export interface IntelligenceReadiness {
  ready: boolean;
  blockers: string[];
  stats: {
    total: number; accepted: number;
    strategicDecisions: number; uncertainties: number;
    risks: number; stakeholderConcerns: number;
  };
}

export function assessReadiness(items: RaisedItem[]): IntelligenceReadiness {
  const accepted = items.filter(i => i.reviewStatus === 'accepted');
  const blockers: string[] = [];

  if (accepted.length < 5) blockers.push(`At least 5 accepted items required (${accepted.length} so far)`);

  const hasStrategicDecision = accepted.some(i => i.classification === 'strategic_decision');
  if (!hasStrategicDecision) blockers.push('At least one strategic decision must be identified');

  const hasUncertainty = accepted.some(i => i.classification === 'uncertainty');
  if (!hasUncertainty) blockers.push('At least one uncertainty must be identified');

  const hasBrutalTruth = accepted.some(i => i.classification === 'brutal_truth');
  if (!hasBrutalTruth) blockers.push('At least one brutal truth must be named — DQ: the most important issue is always the one nobody wants to say');

  return {
    ready: blockers.length === 0,
    blockers,
    stats: {
      total: items.length,
      accepted: accepted.length,
      strategicDecisions: accepted.filter(i => i.classification === 'strategic_decision').length,
      uncertainties: accepted.filter(i => i.classification === 'uncertainty').length,
      risks: accepted.filter(i => i.classification === 'risk').length,
      stakeholderConcerns: accepted.filter(i => i.classification === 'stakeholder_concern').length,
    },
  };
}
