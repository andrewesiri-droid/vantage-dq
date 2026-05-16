// ============================================================
// ISSUE RAISING SCHEMA
// ============================================================

export type IssueCategory =
  | 'strategic'
  | 'technical'
  | 'commercial'
  | 'operational'
  | 'regulatory'
  | 'stakeholder'
  | 'financial'
  | 'data_gap'
  | 'timing'
  | 'risk'
  | 'assumption_challenge'
  | 'scope_clarification'
  | 'value_criteria'
  | 'black_swan';

export type IssueClassification =
  | 'issue'
  | 'decision'
  | 'uncertainty'
  | 'risk'
  | 'assumption'
  | 'constraint'
  | 'action'
  | 'duplicate'
  | 'out_of_scope';

export type IssueSource = 'user' | 'ai' | 'document' | 'workshop';

export type IssueReviewStatus =
  | 'draft'
  | 'needs_review'
  | 'accepted'
  | 'rejected'
  | 'converted';

export type DownstreamTarget =
  | 'decision_hierarchy'
  | 'scenario_planning'
  | 'voi'
  | 'risk_timeline'
  | 'stakeholder_alignment'
  | 'strategy_table'
  | 'problem_frame';

export interface Issue {
  id: string;
  title: string;
  description?: string;
  category: IssueCategory;
  classification: IssueClassification;
  source: IssueSource;
  sourceReference?: string;
  linkedProblemFrameFields: string[];
  confidenceScore?: number;
  reviewStatus: IssueReviewStatus;
  votes: number;
  priorityScore?: number;
  decisionImpact: 1 | 2 | 3 | 4 | 5;
  urgency: 1 | 2 | 3 | 4 | 5;
  uncertaintyLevel: 1 | 2 | 3 | 4 | 5;
  duplicateOf?: string;
  downstreamTarget?: DownstreamTarget;
  rationale?: string;
  originalWording?: string; // audit trail for AI cleanup
  createdAt: string;
  updatedAt: string;
}

export interface BlindSpotAnalysis {
  missingCategories: IssueCategory[];
  overrepresentedCategories: IssueCategory[];
  weakAreas: string[];
  unchallengedAssumptions: string[];
  missingStakeholderConcerns: string[];
  missingIssueSuggestions: Array<{ title: string; category: IssueCategory; rationale: string }>;
  dqWarningFlags: string[];
  nextBestActions: string[];
  facilitatorQuestions: string[];
}

export interface IssueRaisingSessionOutput {
  acceptedIssues: Issue[];
  candidateDecisions: Issue[];
  candidateUncertainties: Issue[];
  candidateRisks: Issue[];
  assumptionChallenges: Issue[];
  stakeholderConcerns: Issue[];
  criteriaGaps: Issue[];
  readyForDownstream: boolean;
  validationBlockers: string[];
}

export const CATEGORY_META: Record<IssueCategory, { label: string; color: string; bg: string }> = {
  strategic:            { label: 'Strategic',         color: '#6366F1', bg: '#EEF2FF' },
  technical:            { label: 'Technical',         color: '#0891B2', bg: '#ECFEFF' },
  commercial:           { label: 'Commercial',        color: '#D97706', bg: '#FEF3C7' },
  operational:          { label: 'Operational',       color: '#7C3AED', bg: '#F5F3FF' },
  regulatory:           { label: 'Regulatory',        color: '#DC2626', bg: '#FEF2F2' },
  stakeholder:          { label: 'Stakeholder',       color: '#059669', bg: '#ECFDF5' },
  financial:            { label: 'Financial',         color: '#B45309', bg: '#FFFBEB' },
  data_gap:             { label: 'Data Gap',          color: '#64748B', bg: '#F8FAFC' },
  timing:               { label: 'Timing',            color: '#0284C7', bg: '#F0F9FF' },
  risk:                 { label: 'Risk',              color: '#E11D48', bg: '#FFF1F2' },
  assumption_challenge: { label: 'Assumption',        color: '#9333EA', bg: '#FAF5FF' },
  scope_clarification:  { label: 'Scope',             color: '#0F766E', bg: '#F0FDFA' },
  value_criteria:       { label: 'Value/Criteria',    color: '#1D4ED8', bg: '#EFF6FF' },
  black_swan:           { label: 'Black Swan',        color: '#1E293B', bg: '#F1F5F9' },
};

export const CLASSIFICATION_META: Record<IssueClassification, { label: string; color: string; bg: string }> = {
  issue:       { label: 'Issue',       color: '#1D4ED8', bg: '#EFF6FF' },
  decision:    { label: 'Decision',    color: '#6366F1', bg: '#EEF2FF' },
  uncertainty: { label: 'Uncertainty', color: '#D97706', bg: '#FEF3C7' },
  risk:        { label: 'Risk',        color: '#DC2626', bg: '#FEF2F2' },
  assumption:  { label: 'Assumption',  color: '#9333EA', bg: '#FAF5FF' },
  constraint:  { label: 'Constraint',  color: '#0F766E', bg: '#F0FDFA' },
  action:      { label: 'Action',      color: '#059669', bg: '#ECFDF5' },
  duplicate:   { label: 'Duplicate',   color: '#94A3B8', bg: '#F8FAFC' },
  out_of_scope:{ label: 'Out of Scope',color: '#64748B', bg: '#F1F5F9' },
};

export const DOWNSTREAM_META: Record<DownstreamTarget, { label: string; color: string }> = {
  decision_hierarchy:   { label: 'Decision Hierarchy',   color: '#6366F1' },
  scenario_planning:    { label: 'Scenario Planning',    color: '#D97706' },
  voi:                  { label: 'Value of Information', color: '#0891B2' },
  risk_timeline:        { label: 'Risk Timeline',        color: '#DC2626' },
  stakeholder_alignment:{ label: 'Stakeholder Alignment',color: '#059669' },
  strategy_table:       { label: 'Strategy Table',       color: '#7C3AED' },
  problem_frame:        { label: 'Problem Frame',        color: '#1D4ED8' },
};

export function computePriorityScore(issue: Issue): number {
  return issue.decisionImpact + issue.urgency + issue.uncertaintyLevel + issue.votes;
}

export function makeIssueId(): string {
  return `iss_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function validateSessionReadiness(issues: Issue[]): { ready: boolean; blockers: string[] } {
  const accepted = issues.filter(i => i.reviewStatus === 'accepted');
  const blockers: string[] = [];

  if (accepted.length < 8) blockers.push(`At least 8 accepted issues required (${accepted.length} so far)`);

  const categories = new Set(accepted.map(i => i.category));
  if (categories.size < 4) blockers.push(`At least 4 categories required (${categories.size} represented)`);

  const hasUncertainty = accepted.some(i => i.classification === 'uncertainty');
  if (!hasUncertainty) blockers.push('At least one uncertainty must be identified');

  const hasStakeholder = accepted.some(i => i.category === 'stakeholder');
  if (!hasStakeholder) blockers.push('At least one stakeholder/alignment issue required');

  const hasCommercial = accepted.some(i => i.category === 'commercial' || i.category === 'financial');
  if (!hasCommercial) blockers.push('At least one commercial/financial issue required');

  const unresolvedDupes = issues.filter(i => i.classification === 'duplicate' && i.reviewStatus !== 'rejected');
  if (unresolvedDupes.length > 0) blockers.push(`${unresolvedDupes.length} unresolved duplicate(s) need attention`);

  return { ready: blockers.length === 0, blockers };
}
