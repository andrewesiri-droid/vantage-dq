// ============================================================
// PROBLEM FRAME SCHEMA
// Type definitions for AI output, session state, and validation
// ============================================================

import type { FieldSource, ReviewStatus } from './problemFrameDefinitions';

// ── Per-field envelope ───────────────────────────────────────

export interface FrameFieldEnvelope<T = string> {
  value: T;
  source: FieldSource;
  confidence: number;        // 0–100
  reviewStatus: ReviewStatus;
  rationale: string;
  sourceReference?: string;  // page, section, excerpt from document
  aiSuggestion?: T;          // if AI proposes a change to a validated field
}

// ── Full Problem Frame ───────────────────────────────────────

export interface ProblemFrameState {
  decisionStatement: FrameFieldEnvelope<string>;
  context:           FrameFieldEnvelope<string>;
  background:        FrameFieldEnvelope<string>;
  trigger:           FrameFieldEnvelope<string>;
  scopeIn:           FrameFieldEnvelope<string[]>;
  scopeOut:          FrameFieldEnvelope<string[]>;
  constraints:       FrameFieldEnvelope<string[]>;
  assumptions:       FrameFieldEnvelope<string[]>;
  successCriteria:   FrameFieldEnvelope<string[]>;
  failureConsequences: FrameFieldEnvelope<string>;
}

// ── DQ Assessment ────────────────────────────────────────────

export interface DQAssessment {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  missingCriticalInputs: string[];
  contradictions: string[];
  nextBestActions: string[];
}

// ── Quality Checks ───────────────────────────────────────────

export interface QualityChecks {
  isRealDecision: boolean;
  hasDecisionOwner: boolean;
  hasClearScope: boolean;
  hasDecisionCriteria: boolean;
  separatesAssumptionsFromUncertainties: boolean;
  avoidsPreferredAnswer: boolean;
}

// ── Full AI contract response ─────────────────────────────────

export interface ProblemFrameAIResponse {
  problemFrame: ProblemFrameState;
  dqAssessment: DQAssessment;
  qualityChecks: QualityChecks;
}

// ── Downstream-safe output (only validated fields) ────────────

export interface ValidatedProblemFrame {
  decisionStatement: string;
  context: string;
  background: string;
  trigger: string;
  scopeIn: string[];
  scopeOut: string[];
  constraints: string[];
  assumptions: string[];
  successCriteria: string[];
  failureConsequences: string;
}

// ── Empty defaults ────────────────────────────────────────────

export function emptyEnvelope<T>(emptyValue: T): FrameFieldEnvelope<T> {
  return {
    value: emptyValue,
    source: 'missing',
    confidence: 0,
    reviewStatus: 'missing',
    rationale: '',
  };
}

export function emptyProblemFrameState(): ProblemFrameState {
  return {
    decisionStatement:   emptyEnvelope(''),
    context:             emptyEnvelope(''),
    background:          emptyEnvelope(''),
    trigger:             emptyEnvelope(''),
    scopeIn:             emptyEnvelope([]),
    scopeOut:            emptyEnvelope([]),
    constraints:         emptyEnvelope([]),
    assumptions:         emptyEnvelope([]),
    successCriteria:     emptyEnvelope([]),
    failureConsequences: emptyEnvelope(''),
  };
}
