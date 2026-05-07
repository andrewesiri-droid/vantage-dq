/**
 * Strict entity types for Vantage DQ
 * These replace all `any[]` usage throughout the system.
 */

export interface DQSession {
  id: number;
  name: string;
  slug: string;
  decisionStatement: string;
  context: string;
  background: string;
  trigger: string;
  scopeIn: string;
  scopeOut: string;
  constraints: string;
  assumptions: string;
  successCriteria: string;
  failureConsequences: string;
  deadline: string;
  owner: string;
  sector: string;
  decisionType: string;
  dqScores: DQScores;
  status: 'draft' | 'committed' | 'tracking' | 'complete';
  createdBy?: string;
  ownerEmail?: string;
  inviteCode?: string;
}

export interface DQScores {
  frame?: number;
  alternatives?: number;
  information?: number;
  values?: number;
  reasoning?: number;
  commitment?: number;
}

export interface Issue {
  id: number;
  sessionId: number;
  text: string;
  category: IssueCategory;
  severity: Severity;
  status: 'open' | 'resolved' | 'parked';
  votes: number;
  owner: string;
  description: string;
  sortOrder: number;
}

export type IssueCategory =
  | 'uncertainty-external' | 'uncertainty-internal' | 'stakeholder-concern'
  | 'assumption' | 'information-gap' | 'opportunity' | 'constraint'
  | 'brutal-truth' | 'regulatory-trap' | 'second-order' | 'black-swan'
  | 'focus-decision';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Decision {
  id: number;
  sessionId: number;
  label: string;
  tier: 'given' | 'focus' | 'deferred';
  choices: string[];
  rationale: string;
  owner: string;
  sortOrder: number;
}

export interface Strategy {
  id: number;
  sessionId: number;
  name: string;
  objective: string;
  rationale: string;
  assumptions: string;
  uncertainties: string;
  description: string;
  colorIdx: number;
  isPreferred: boolean;
  selections: Record<string, number>;
}

export interface Criterion {
  id: number;
  sessionId: number;
  label: string;
  type: 'financial' | 'strategic' | 'operational' | 'risk' | 'commercial';
  weight: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  sortOrder: number;
}

export interface AssessmentScore {
  id: number;
  sessionId: number;
  strategyId: number;
  criterionId: number;
  score: number;
  rationale: string;
}

export interface Uncertainty {
  id: number;
  sessionId: number;
  label: string;
  type: 'Market' | 'Regulatory' | 'Technical' | 'Financial' | 'Competitive' | 'Operational' | 'Political' | 'Environmental';
  impact: Severity;
  control: 'None' | 'Some' | 'High';
  description: string;
  source: 'scenario-planning' | 'issue-generation' | 'strategy-table' | 'manual';
}

export interface Assumption {
  id: number;
  sessionId: number;
  text: string;
  source: 'problem-frame' | 'strategy-table' | 'issue-generation' | 'manual';
  strategyId?: number;
  confidence: 'high' | 'medium' | 'low';
  validatedAt?: string;
  validationStatus: 'unvalidated' | 'confirmed' | 'challenged' | 'invalidated';
}

export interface Stakeholder {
  id: number;
  sessionId: number;
  name: string;
  role: string;
  influence: number;
  interest: number;
  alignment: 'champion' | 'supportive' | 'neutral' | 'cautious' | 'concerned' | 'opposed';
  concerns: string;
  engagementAction: string;
}

export interface RiskItem {
  id: number;
  sessionId: number;
  label: string;
  likelihood: 'High' | 'Medium' | 'Low';
  impact: 'Critical' | 'High' | 'Medium' | 'Low';
  timeframe: string;
  owner: string;
  mitigation: string;
  month: number;
}

export interface Scenario {
  id: number;
  sessionId: number;
  name: string;
  description: string;
  probability: number;
  drivers: string[];
  color: string;
  assumptions: string;
  earlyWarning: string;
  strategyImplications: string;
}

export interface VOIAnalysis {
  id: number;
  sessionId: number;
  uncertaintyId: number;
  label: string;
  cost: number;
  duration: number;
  accuracy: number;
  verdict: 'do-now' | 'do-later' | 'do-not' | 'conditional' | 'bundle' | 'proxy';
  netVOI: number;
}

export interface OutcomeTracking {
  id: number;
  sessionId: number;
  type: 'assumption' | 'uncertainty' | 'risk' | 'milestone';
  label: string;
  predicted: string;
  actual: string;
  status: 'confirmed' | 'wrong' | 'partial' | 'pending';
  impact: 'positive' | 'negative' | 'neutral' | 'pending';
  learnedAt: string;
}

export interface SessionSnapshot {
  id: number;
  sessionId: number;
  snapshotType: 'strategy_added' | 'dq_scored' | 'recommendation_changed' | 'committed' | 'manual';
  summary: string;
  dqScores: DQScores;
  strategyCount: number;
  recommendedStrategy: string;
  createdAt: string;
}

// Full session data shape
export interface DQSessionData {
  session: DQSession | null;
  issues: Issue[];
  decisions: Decision[];
  strategies: Strategy[];
  criteria: Criterion[];
  assessmentScores: AssessmentScore[];
  uncertainties: Uncertainty[];
  assumptions: Assumption[];
  stakeholderEntries: Stakeholder[];
  riskItems: RiskItem[];
  scenarios: Scenario[];
  voiAnalyses: VOIAnalysis[];
  outcomeTracking: OutcomeTracking[];
  snapshots: SessionSnapshot[];
}
