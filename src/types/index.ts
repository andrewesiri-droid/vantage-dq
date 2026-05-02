export type { User, DQSession, Stakeholder, Issue, Decision, Criterion, Strategy, Uncertainty, SessionMember, Comment, WorkshopVote, GameTheoryModel, Scenario, VOIAnalysis } from '@db/schema';

export type ModuleId = 'problem' | 'issues' | 'hierarchy' | 'strategy' | 'assessment' | 'scorecard' | 'stakeholders' | 'export' | 'influence' | 'scenario' | 'voi' | 'risk-timeline';

export type ToolId = 'game-theory' | 'workshop' | 'new-workspace' | 'export-advanced';

export interface NavTool {
  id: ToolId;
  label: string;
  description: string;
}