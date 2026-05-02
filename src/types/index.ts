// Vantage DQ type definitions

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

// DB entity types (used in hooks)
export interface User { id: number; email: string; name: string | null; }
export interface DQSession { id: number; name: string; slug: string; decisionStatement?: string; context?: string; status?: string; dqScores?: Record<string, number>; createdBy?: number; createdAt?: string; updatedAt?: string; }
export interface Stakeholder { id: number; sessionId: number; name: string; role?: string; influence?: number; interest?: number; alignment?: string; concerns?: string; }
export interface Issue { id: number; sessionId: number; text: string; category: string; severity: string; status: string; votes: number; }
export interface Decision { id: number; sessionId: number; label: string; choices: string[]; tier: string; owner?: string; rationale?: string; }
export interface Criterion { id: number; sessionId: number; label: string; type: string; weight: string; }
export interface Strategy { id: number; sessionId: number; name: string; description?: string; colorIdx?: number; selections?: Record<string, number>; }
export interface Uncertainty { id: number; sessionId: number; label: string; type: string; impact: string; control?: string; description?: string; }
export interface Scenario { id: number; sessionId: number; name: string; description?: string; probability?: number; drivers?: string[]; color?: string; }
export interface VOIAnalysis { id: number; sessionId: number; name: string; priorProbability: number; valueWithInfo: number; valueWithoutInfo: number; costOfInfo: number; voiResult?: number; }
export interface SessionMember { id: number; sessionId: number; userId: number; role: string; }
export interface Comment { id: number; sessionId: number; userId: number; text: string; }
export interface WorkshopVote { id: number; sessionId: number; userId: number; issueId: number; }
export interface GameTheoryModel { id: number; sessionId: number; players?: string[]; strategies?: Record<string, string[]>; payoffs?: Record<string, number[]>; }

// Module data type (full session load)
export interface ModuleData {
  session?: DQSession & { background?: string; trigger?: string; scopeIn?: string; scopeOut?: string; constraints?: string; assumptions?: string; successCriteria?: string; failureConsequences?: string; owner?: string; deadline?: string; [key: string]: any };
  issues?: Issue[];
  decisions?: Decision[];
  criteria?: Criterion[];
  strategies?: Strategy[];
  uncertainties?: Uncertainty[];
  scenarios?: Scenario[];
  voiAnalyses?: VOIAnalysis[];
  gameTheoryModels?: GameTheoryModel[];
  stakeholderEntries?: Stakeholder[];
  riskItems?: any[];
  assessmentScores?: any[];
  aiSuggestions?: any[];
}
