/**
 * Workshop Copilot — Shared Types
 * Used across all workshop copilot components
 */

export type WorkshopPhase =
  | 'setup' | 'problem-frame' | 'issue-generation' | 'decision-hierarchy'
  | 'strategy-table' | 'qualitative' | 'scenario' | 'voi'
  | 'risk-timeline' | 'influence' | 'scorecard' | 'wrap-up';

export type ContributionCategory =
  | 'ASSUMPTION' | 'ISSUE' | 'ALTERNATIVE' | 'CONSTRAINT'
  | 'QUESTION' | 'EVIDENCE' | 'OPINION' | 'META';

export type TargetModule =
  | 'problem-frame' | 'issue-generation' | 'decision-hierarchy'
  | 'strategy-table' | 'qualitative-assessment' | 'dq-scorecard'
  | 'stakeholder-alignment' | 'scenario-planning' | 'influence-diagram'
  | 'voi' | 'risk-timeline' | 'export-report';

export interface Utterance {
  id: string;
  timestamp: number;       // seconds from workshop start
  duration: number;
  speakerId: string;
  speakerName: string;
  text: string;
  audioUrl?: string;       // blob URL for playback
  phase: WorkshopPhase;
}

export interface CategorizedItem {
  id: string;
  utteranceId: string;
  category: ContributionCategory;
  text: string;
  rawQuote: string;
  speakerName: string;
  speakerId: string;
  timestamp: number;
  phase: WorkshopPhase;
  targetModule: TargetModule;
  targetSection?: string;
  confidence: number;        // 0-100
  suggestedAction: string;
  status: 'pending' | 'accepted' | 'rejected' | 'edited' | 'imported';
  editedText?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
  addToBoard?: boolean;
  source?: string;
  dqLabel?: string;
}

export interface DraftItem {
  id: string;
  source: 'workshop-copilot';
  utteranceId: string;
  categorizedItemId: string;
  status: 'draft' | 'imported' | 'rejected';
  targetModule: TargetModule;
  targetSection?: string;
  proposedContent: string;
  category: ContributionCategory;
  confidence: number;
  speakerName: string;
  timestamp: number;
  audioUrl?: string;
}

export interface Speaker {
  id: string;
  name: string;
  role?: string;
  wordCount: number;
  contributionCount: number;
  lastActiveAt: number;
  color: string;
}

export interface WorkshopSession {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  phase: WorkshopPhase;
  decisionStatement?: string;
  utterances: Utterance[];
  items: CategorizedItem[];
  speakers: Speaker[];
  facilitatorNotes: string[];
  offRecordPeriods: { start: number; end?: number }[];
}

export interface WorkshopReport {
  sessionId: string;
  duration: number;
  participantCount: number;
  totalItems: number;
  itemsByCategory: Record<ContributionCategory, number>;
  phaseDurations: Record<WorkshopPhase, number>;
  speakerParticipation: { speakerName: string; percentage: number; wordCount: number }[];
  facilitatorInsights: string[];
  blindSpots: string[];
  circularDiscussions: { startTime: number; endTime: number; topic: string }[];
  lowConfidenceItems: number;
  generatedAt: number;
}

export const CATEGORY_CONFIG: Record<ContributionCategory, { label: string; color: string; icon: string; targetModules: TargetModule[] }> = {
  ISSUE:       { label: 'Issue',       color: '#F59E0B', icon: '⚠️',  targetModules: ['issue-generation'] },
  ASSUMPTION:  { label: 'Assumption',  color: '#7C3AED', icon: '🛡️', targetModules: ['problem-frame', 'issue-generation'] },
  ALTERNATIVE: { label: 'Alternative', color: '#0D9488', icon: '💡',  targetModules: ['strategy-table'] },
  CONSTRAINT:  { label: 'Constraint',  color: '#EF4444', icon: '🚫',  targetModules: ['problem-frame'] },
  QUESTION:    { label: 'Question',    color: '#6366F1', icon: '❓',  targetModules: ['issue-generation', 'voi'] },
  EVIDENCE:    { label: 'Evidence',    color: '#10B981', icon: '📊',  targetModules: ['problem-frame', 'qualitative-assessment'] },
  OPINION:     { label: 'Opinion',     color: '#64748B', icon: '💬',  targetModules: ['qualitative-assessment'] },
  META:        { label: 'Meta',        color: '#94A3B8', icon: '🔄',  targetModules: [] },
};

export const SPEAKER_COLORS = [
  '#0D9488', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6',
  '#10B981', '#F97316', '#3B82F6', '#EC4899', '#14B8A6',
];
