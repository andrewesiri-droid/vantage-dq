export type { User, DQSession, Stakeholder, Issue, Decision, Criterion, Strategy, Uncertainty, SessionMember, Comment, WorkshopVote, GameTheoryModel, Scenario, VOIAnalysis } from '@db/schema';

export type ModuleId = 'problem' | 'issues' | 'hierarchy' | 'strategy' | 'assessment' | 'scorecard' | 'stakeholders' | 'export' | 'influence' | 'scenario' | 'voi' | 'risk-timeline';

export interface NavModule {
  id: ModuleId;
  label: string;
  sub: string;
  num: string;
  phase: 1 | 2;
}

export type CompletionStatus = 'not-started' | 'in-progress' | 'complete';

export interface AIMessage {
  role: 'user' | 'ai' | 'system';
  text: string;
}

/** Props shared by all module components */
export interface ModuleProps {
  sessionId?: number;
  data?: any;
  hooks?: any;
}
