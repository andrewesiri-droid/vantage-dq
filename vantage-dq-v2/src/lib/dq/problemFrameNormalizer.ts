// ============================================================
// PROBLEM FRAME NORMALIZER
// Converts raw AI JSON → typed ProblemFrameState
// Merges with existing state, preserving validated fields
// ============================================================

import type {
  ProblemFrameAIResponse,
  ProblemFrameState,
  FrameFieldEnvelope,
} from './problemFrameSchema';
import { emptyEnvelope, emptyProblemFrameState } from './problemFrameSchema';
import { validateAIResponse, applyConfidenceRules } from './problemFrameValidator';

// ── Parse raw AI response ─────────────────────────────────────

export function parseAIResponse(raw: string): {
  success: boolean;
  data?: ProblemFrameAIResponse;
  errors: string[];
  warnings: string[];
} {
  let parsed: any;

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    return {
      success: false,
      errors: ['Failed to parse AI response as JSON. The model may have returned non-JSON text.'],
      warnings: [],
    };
  }

  const validation = validateAIResponse(parsed);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  return {
    success: true,
    data: parsed as ProblemFrameAIResponse,
    errors: [],
    warnings: validation.warnings,
  };
}

// ── Normalize a single field envelope ────────────────────────

function normalizeEnvelope<T>(
  raw: any,
  emptyValue: T,
  existingEnvelope?: FrameFieldEnvelope<T>
): FrameFieldEnvelope<T> {
  // Preserve validated fields — never overwrite
  if (existingEnvelope?.reviewStatus === 'validated') {
    // If AI has a suggestion, attach it without replacing
    if (raw?.value !== undefined && raw.value !== existingEnvelope.value) {
      return { ...existingEnvelope, aiSuggestion: raw.value as T };
    }
    return existingEnvelope;
  }

  if (!raw || raw.source === 'missing' || raw.value === undefined) {
    return emptyEnvelope(emptyValue);
  }

  return {
    value: raw.value ?? emptyValue,
    source: raw.source ?? 'inferred',
    confidence: typeof raw.confidence === 'number' ? Math.min(100, Math.max(0, raw.confidence)) : 0,
    reviewStatus: raw.reviewStatus ?? 'needs_review',
    rationale: raw.rationale ?? '',
    sourceReference: raw.sourceReference,
    aiSuggestion: undefined,
  };
}

// ── Merge AI response into existing state ────────────────────

export function mergeAIResponseIntoState(
  aiResponse: ProblemFrameAIResponse,
  existingState?: Partial<ProblemFrameState>
): ProblemFrameState {
  const pf = aiResponse.problemFrame;
  const existing = existingState ?? {};

  const merged: ProblemFrameState = {
    decisionStatement:   normalizeEnvelope(pf.decisionStatement,   '', existing.decisionStatement),
    context:             normalizeEnvelope(pf.context,             '', existing.context),
    background:          normalizeEnvelope(pf.background,          '', existing.background),
    trigger:             normalizeEnvelope(pf.trigger,             '', existing.trigger),
    scopeIn:             normalizeEnvelope(pf.scopeIn,             [], existing.scopeIn),
    scopeOut:            normalizeEnvelope(pf.scopeOut,            [], existing.scopeOut),
    constraints:         normalizeEnvelope(pf.constraints,         [], existing.constraints),
    assumptions:         normalizeEnvelope(pf.assumptions,         [], existing.assumptions),
    successCriteria:     normalizeEnvelope(pf.successCriteria,     [], existing.successCriteria),
    failureConsequences: normalizeEnvelope(pf.failureConsequences, '', existing.failureConsequences),
  };

  // Apply confidence-based review rules
  return applyConfidenceRules(merged);
}

// ── Convert user edits into validated state ───────────────────

export function applyUserEdit<T>(
  state: ProblemFrameState,
  field: keyof ProblemFrameState,
  newValue: T,
  action: 'accept' | 'edit' | 'reject'
): ProblemFrameState {
  const current = state[field] as FrameFieldEnvelope<T>;

  if (action === 'reject') {
    return {
      ...state,
      [field]: {
        ...current,
        value: Array.isArray(current.value) ? [] : '' as any,
        reviewStatus: 'missing',
        source: 'missing',
        confidence: 0,
        aiSuggestion: undefined,
      },
    };
  }

  if (action === 'accept') {
    return {
      ...state,
      [field]: {
        ...current,
        value: current.aiSuggestion !== undefined ? current.aiSuggestion : newValue,
        reviewStatus: 'validated',
        source: 'user_input',
        aiSuggestion: undefined,
      },
    };
  }

  // edit — user typed a new value
  return {
    ...state,
    [field]: {
      ...current,
      value: newValue,
      reviewStatus: 'validated',
      source: 'user_input',
      confidence: 100,
      aiSuggestion: undefined,
    },
  };
}

// ── Convert plain user input (no AI) into state ───────────────

export function userInputToState(
  inputs: Partial<Record<keyof ProblemFrameState, string | string[]>>
): ProblemFrameState {
  const base = emptyProblemFrameState();
  const result = { ...base };

  for (const [key, value] of Object.entries(inputs)) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue;
    (result as any)[key] = {
      value,
      source: 'user_input',
      confidence: 100,
      reviewStatus: 'validated',
      rationale: 'Entered directly by user.',
    };
  }

  return result;
}
