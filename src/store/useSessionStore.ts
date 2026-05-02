import { create } from 'zustand';
import type { DQSession, Issue, Decision, Criterion, Strategy, Uncertainty, User } from '@/types';

interface SessionState {
  activeSession: DQSession | null;
  issues: Issue[];
  decisions: Decision[];
  criteria: Criterion[];
  strategies: Strategy[];
  uncertainties: Uncertainty[];
  assessmentScores: Record<string, number>;
  dqScores: Record<string, number>;
  members: { member: { id: number; sessionId: number; userId: number; role: string; createdAt: Date }; user: User | null }[];
  setActiveSession: (s: DQSession | null) => void;
  setIssues: (i: Issue[]) => void;
  setDecisions: (d: Decision[]) => void;
  setCriteria: (c: Criterion[]) => void;
  setStrategies: (s: Strategy[]) => void;
  setUncertainties: (u: Uncertainty[]) => void;
  setAssessmentScores: (s: Record<string, number>) => void;
  setDqScores: (s: Record<string, number>) => void;
  setMembers: (m: any[]) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  issues: [],
  decisions: [],
  criteria: [],
  strategies: [],
  uncertainties: [],
  assessmentScores: {},
  dqScores: {},
  members: [],
  setActiveSession: (s) => set({ activeSession: s }),
  setIssues: (i) => set({ issues: i }),
  setDecisions: (d) => set({ decisions: d }),
  setCriteria: (c) => set({ criteria: c }),
  setStrategies: (s) => set({ strategies: s }),
  setUncertainties: (u) => set({ uncertainties: u }),
  setAssessmentScores: (s) => set({ assessmentScores: s }),
  setDqScores: (s) => set({ dqScores: s }),
  setMembers: (m) => set({ members: m }),
  reset: () => set({
    activeSession: null, issues: [], decisions: [], criteria: [],
    strategies: [], uncertainties: [], assessmentScores: {}, dqScores: {}, members: [],
  }),
}));
