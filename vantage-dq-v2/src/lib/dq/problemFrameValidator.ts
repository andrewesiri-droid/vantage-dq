// ============================================================
// PROBLEM FRAME VALIDATOR
// Schema validation, quality checks, and downstream gate
// ============================================================

import { isDecisionQuestion, REQUIRED_FIELDS } from './problemFrameDefinitions';
import type {
  ProblemFrameAIResponse,
  ProblemFrameState,
  FrameFieldEnvelope,
  QualityChecks,
  ValidatedProblemFrame,
} from './problemFrameSchema';
import { emptyProblemFrameState } from './problemFrameSchema';

// ── Schema validation ─────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAIResponse(raw: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response is not a valid object'], warnings: [] };
  }

  if (!raw.problemFrame) errors.push('Missing problemFrame block');
  if (!raw.dqAssessment) errors.push('Missing dqAssessment block');
  if (!raw.qualityChecks) errors.push('Missing qualityChecks block');

  if (raw.problemFrame) {
    const pf = raw.problemFrame;
    const requiredFields = [
      'decisionStatement', 'context', 'background', 'trigger',
      'scopeIn', 'scopeOut', 'constraints', 'assumptions',
      'successCriteria', 'failureConsequences',
    ];

    for (const field of requiredFields) {
      if (!pf[field]) {
        errors.push(`Missing field: problemFrame.${field}`);
        continue;
      }
      const envelope = pf[field];
      if (envelope.value === undefined) errors.push(`${field}: missing value`);
      if (!['user_input', 'document', 'inferred', 'missing'].includes(envelope.source))
        errors.push(`${field}: invalid source "${envelope.source}"`);
      if (typeof envelope.confidence !== 'number' || envelope.confidence < 0 || envelope.confidence > 100)
        errors.push(`${field}: confidence must be 0–100`);
      if (!['validated', 'needs_review', 'missing'].includes(envelope.reviewStatus))
        errors.push(`${field}: invalid reviewStatus "${envelope.reviewStatus}"`);
    }

    // Decision statement must be a question
    if (pf.decisionStatement?.value && !isDecisionQuestion(pf.decisionStatement.value)) {
      warnings.push('Decision statement does not appear to be phrased as a question. It should start with "How should", "Whether to", "What strategy should", etc.');
    }

    // Check assumptions are not questions (they would be uncertainties)
    if (Array.isArray(pf.assumptions?.value)) {
      pf.assumptions.value.forEach((a: string, i: number) => {
        if (a.trim().endsWith('?')) {
          warnings.push(`Assumption ${i + 1} appears to be a question — it may be an uncertainty, not an assumption.`);
        }
      });
    }

    // Check success criteria are not actions
    if (Array.isArray(pf.successCriteria?.value)) {
      const actionWords = /^(complete|do|execute|build|create|implement|deliver|run|perform)/i;
      pf.successCriteria.value.forEach((c: string, i: number) => {
        if (actionWords.test(c.trim())) {
          warnings.push(`Success criterion ${i + 1} looks like an action, not a decision criterion.`);
        }
      });
    }

    // Flag missing required fields
    for (const key of REQUIRED_FIELDS) {
      const field = pf[key];
      if (!field?.value || (Array.isArray(field.value) && field.value.length === 0)) {
        warnings.push(`Required field missing: ${key}`);
      }
    }

    // Flag missing decision owner
    if (pf.decisionStatement?.value && !/\b(we|team|board|committee|ceo|cfo|vp|director|owner)\b/i.test(pf.decisionStatement.value)) {
      warnings.push('Decision statement may be missing a decision owner.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Confidence-based auto-review assignment ───────────────────

export function applyConfidenceRules(state: ProblemFrameState): ProblemFrameState {
  const result = { ...state };
  const fields = Object.keys(result) as (keyof ProblemFrameState)[];

  for (const key of fields) {
    const field = result[key] as FrameFieldEnvelope<any>;
    if (field.reviewStatus === 'validated') continue; // Never downgrade validated fields
    if (field.confidence < 70 || field.source === 'inferred') {
      (result[key] as FrameFieldEnvelope<any>) = { ...field, reviewStatus: 'needs_review' };
    }
    if (!field.value || (Array.isArray(field.value) && field.value.length === 0)) {
      (result[key] as FrameFieldEnvelope<any>) = { ...field, reviewStatus: 'missing' };
    }
  }

  return result;
}

// ── Downstream gate ───────────────────────────────────────────
// Only fields that are user-validated or high-confidence accepted
// should flow into Issue Generation, Decision Hierarchy, etc.

export function extractValidatedFrame(state: ProblemFrameState): ValidatedProblemFrame {
  function safeValue<T>(envelope: FrameFieldEnvelope<T>, fallback: T): T {
    if (envelope.reviewStatus === 'validated') return envelope.value;
    if (envelope.reviewStatus === 'needs_review' && envelope.confidence >= 70) return envelope.value;
    return fallback;
  }

  return {
    decisionStatement:   safeValue(state.decisionStatement, ''),
    context:             safeValue(state.context, ''),
    background:          safeValue(state.background, ''),
    trigger:             safeValue(state.trigger, ''),
    scopeIn:             safeValue(state.scopeIn, []),
    scopeOut:            safeValue(state.scopeOut, []),
    constraints:         safeValue(state.constraints, []),
    assumptions:         safeValue(state.assumptions, []),
    successCriteria:     safeValue(state.successCriteria, []),
    failureConsequences: safeValue(state.failureConsequences, ''),
  };
}

// ── Check if frame is ready for downstream ───────────────────

export function isFrameDownstreamReady(state: ProblemFrameState): {
  ready: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];

  for (const key of REQUIRED_FIELDS) {
    const field = state[key as keyof ProblemFrameState] as FrameFieldEnvelope<any>;
    if (field.reviewStatus === 'missing') {
      blockers.push(`${key} is missing`);
    } else if (field.reviewStatus === 'needs_review') {
      blockers.push(`${key} needs review before proceeding`);
    }
  }

  if (!isDecisionQuestion(state.decisionStatement.value)) {
    blockers.push('Decision statement must be phrased as a question');
  }

  return { ready: blockers.length === 0, blockers };
}
