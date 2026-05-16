import { useMemo } from 'react';
import type {
  ModuleReadiness,
  ModuleReadinessState,
  Session,
} from '@/types/entities';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ModuleReadinessMap {
  [moduleId: string]: ModuleReadiness;
}

// Shape of the session data we need for readiness checks
interface ReadinessInput {
  session: Session | null;
  problemFrame: any;
  issues: any[];
  hierarchyNodes: any[];
  strategies: any[];
  assessmentScores: any[];
  dqScorecard: any[];
  stakeholders: any[];
  riskItems: any[];
  influenceDiagram: any;
  scenarios: any[];
  voiItems: any[];
}

// ─────────────────────────────────────────────────────────────
// READINESS RULES — one function per module
// ─────────────────────────────────────────────────────────────

function problemReadiness(d: ReadinessInput): ModuleReadiness {
  const pf = d.problemFrame;
  if (!pf) return { state: 'not_started' };

  const missingInputs: string[] = [];
  if (!pf.decisionStatement?.trim()) missingInputs.push('Decision statement is required');
  if (!pf.context?.trim()) missingInputs.push('Decision context is required');
  if (missingInputs.length) return { state: 'missing_required_inputs', missingInputs };

  const needsReview = !pf.reviewStatus || pf.reviewStatus === 'ai_suggested' || pf.reviewStatus === 'draft';
  if (needsReview) return { state: 'needs_review', draftCount: 1 };

  if (pf.reviewStatus === 'user_validated') return { state: 'validated' };
  return { state: 'ready' };
}

function issuesReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.problemFrame?.decisionStatement) {
    return { state: 'missing_required_inputs', missingInputs: ['Problem Frame must be completed first'] };
  }
  if (!d.issues.length) return { state: 'not_started' };

  const drafts = d.issues.filter(i => i.reviewStatus !== 'user_validated');
  if (drafts.length) return { state: 'needs_review', draftCount: drafts.length };
  return { state: 'validated' };
}

function hierarchyReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.issues.length) {
    return { state: 'missing_required_inputs', missingInputs: ['Issues must be defined first'] };
  }
  if (!d.hierarchyNodes.length) return { state: 'not_started' };

  const drafts = d.hierarchyNodes.filter(n => n.reviewStatus !== 'user_validated');
  if (drafts.length) return { state: 'needs_review', draftCount: drafts.length };
  return { state: 'validated' };
}

function strategyReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.problemFrame?.decisionStatement) {
    return { state: 'missing_required_inputs', missingInputs: ['Problem Frame must be completed first'] };
  }
  if (!d.strategies.length) return { state: 'not_started' };
  if (d.strategies.length < 2) {
    return { state: 'draft_available', missingInputs: ['At least 2 strategies recommended for meaningful comparison'] };
  }

  const drafts = d.strategies.filter(s => s.reviewStatus !== 'user_validated');
  if (drafts.length) return { state: 'needs_review', draftCount: drafts.length };
  return { state: 'validated' };
}

function assessmentReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.strategies.length) {
    return { state: 'missing_required_inputs', missingInputs: ['Strategies must be defined in Strategy Table first'] };
  }
  if (!d.assessmentScores.length) return { state: 'not_started' };

  // Check coverage: each strategy should have scores
  const scoredStrategies = new Set(d.assessmentScores.map((s: any) => s.strategyId));
  const unscored = d.strategies.filter((s: any) => !scoredStrategies.has(s.id));
  if (unscored.length) {
    return { state: 'draft_available', missingInputs: [`${unscored.length} strateg${unscored.length === 1 ? 'y' : 'ies'} not yet scored`] };
  }

  return { state: 'ready' };
}

function scorecardReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.strategies.length || !d.issues.length) {
    return { state: 'missing_required_inputs', missingInputs: ['Strategies and Issues required'] };
  }
  if (!d.dqScorecard.length) return { state: 'draft_available' };

  const allDimensions = ['frame', 'alternatives', 'information', 'values', 'reasoning', 'commitment'];
  const scored = new Set(d.dqScorecard.map((s: any) => s.dimension));
  const missing = allDimensions.filter(d => !scored.has(d));
  if (missing.length) return { state: 'draft_available', missingInputs: [`Missing: ${missing.join(', ')}`] };

  return { state: 'ready' };
}

function stakeholdersReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.strategies.length) {
    return { state: 'missing_required_inputs', missingInputs: ['Define strategies before mapping stakeholders'] };
  }
  if (!d.stakeholders.length) return { state: 'not_started' };

  const drafts = d.stakeholders.filter((s: any) => s.reviewStatus !== 'user_validated');
  if (drafts.length) return { state: 'needs_review', draftCount: drafts.length };
  return { state: 'validated' };
}

function exportReadiness(d: ReadinessInput): ModuleReadiness {
  const required = [
    d.problemFrame?.reviewStatus === 'user_validated',
    d.strategies.length >= 2,
    d.assessmentScores.length > 0,
  ];
  const missing: string[] = [];
  if (!required[0]) missing.push('Validate Problem Frame');
  if (!required[1]) missing.push('Define at least 2 strategies');
  if (!required[2]) missing.push('Complete qualitative assessment');
  if (missing.length) return { state: 'missing_required_inputs', missingInputs: missing };
  return { state: 'ready' };
}

function influenceReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.strategies.length || !d.issues.length) {
    return { state: 'missing_required_inputs', missingInputs: ['Complete Phase 1 modules first'] };
  }
  if (!d.influenceDiagram) return { state: 'not_started' };
  return { state: 'ready' };
}

function scenarioReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.strategies.length) {
    return { state: 'missing_required_inputs', missingInputs: ['Strategies required'] };
  }
  if (!d.scenarios.length) return { state: 'not_started' };
  return { state: 'ready' };
}

function voiReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.issues.length) {
    return { state: 'missing_required_inputs', missingInputs: ['Issues required to calculate information value'] };
  }
  if (!d.voiItems.length) return { state: 'not_started' };
  return { state: 'ready' };
}

function riskTimelineReadiness(d: ReadinessInput): ModuleReadiness {
  if (!d.strategies.length) {
    return { state: 'missing_required_inputs', missingInputs: ['Strategies required'] };
  }
  if (!d.riskItems.length) return { state: 'not_started' };
  const drafts = d.riskItems.filter((r: any) => r.reviewStatus !== 'user_validated');
  if (drafts.length) return { state: 'needs_review', draftCount: drafts.length };
  return { state: 'ready' };
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useModuleReadiness(input: ReadinessInput): ModuleReadinessMap {
  return useMemo(() => ({
    problem:     problemReadiness(input),
    issues:      issuesReadiness(input),
    hierarchy:   hierarchyReadiness(input),
    strategy:    strategyReadiness(input),
    assessment:  assessmentReadiness(input),
    scorecard:   scorecardReadiness(input),
    stakeholders: stakeholdersReadiness(input),
    export:      exportReadiness(input),
    influence:   influenceReadiness(input),
    scenario:    scenarioReadiness(input),
    voi:         voiReadiness(input),
    'risk-timeline': riskTimelineReadiness(input),
  }), [
    input.problemFrame,
    input.issues,
    input.hierarchyNodes,
    input.strategies,
    input.assessmentScores,
    input.dqScorecard,
    input.stakeholders,
    input.riskItems,
    input.influenceDiagram,
    input.scenarios,
    input.voiItems,
  ]);
}

// ─────────────────────────────────────────────────────────────
// DISPLAY HELPERS (for sidebar)
// ─────────────────────────────────────────────────────────────

export const READINESS_META: Record<ModuleReadinessState, {
  label: string;
  color: string;
  bg: string;
  dot: string;
  priority: number; // lower = shown first / more prominent
}> = {
  not_started:            { label: 'Not started',       color: '#475569', bg: 'transparent',      dot: '#334155', priority: 4 },
  missing_required_inputs:{ label: 'Needs inputs',      color: '#EF4444', bg: '#FEF2F2',           dot: '#EF4444', priority: 1 },
  draft_available:        { label: 'Draft available',   color: '#C9A84C', bg: '#FDF8E8',           dot: '#C9A84C', priority: 3 },
  needs_review:           { label: 'Needs review',      color: '#F59E0B', bg: '#FEF3C7',           dot: '#F59E0B', priority: 2 },
  ready:                  { label: 'Ready',             color: '#3B82F6', bg: '#EFF6FF',           dot: '#3B82F6', priority: 5 },
  validated:              { label: 'Validated',         color: '#10B981', bg: '#ECFDF5',           dot: '#10B981', priority: 6 },
};

export function getReadinessDot(state: ModuleReadinessState): string {
  return READINESS_META[state]?.dot ?? '#334155';
}

export function getReadinessLabel(state: ModuleReadinessState): string {
  return READINESS_META[state]?.label ?? state;
}
