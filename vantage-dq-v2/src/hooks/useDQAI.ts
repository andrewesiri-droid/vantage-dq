import { useState, useCallback } from 'react';
import type { DQAIResult, DecisionMemory } from '@/types/entities';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface DQAIOptions {
  moduleId: string;
  sessionData?: Record<string, any>;
  decisionMemory?: DecisionMemory;
  /** Force re-generation even if memory says item exists (rare) */
  forceRegenerate?: boolean;
}

export interface DQAIHookState<T = unknown> {
  result: DQAIResult<T> | null;
  loading: boolean;
  error: string | null;
  call: (prompt: string, options?: DQAIOptions) => Promise<DQAIResult<T> | null>;
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────
// CROSS-MODULE CONTRADICTION DETECTION
// ─────────────────────────────────────────────────────────────

export function detectCrossModuleContradictions(sessionData: Record<string, any>): string[] {
  const contradictions: string[] = [];

  // Check: strategies in assessment don't match strategy table
  const strategyIds = new Set((sessionData.strategies ?? []).map((s: any) => s.id));
  const scoredIds = new Set((sessionData.assessmentScores ?? []).map((s: any) => s.strategyId));
  const orphanedScores = [...scoredIds].filter(id => !strategyIds.has(id));
  if (orphanedScores.length) {
    contradictions.push(`Assessment has scores for ${orphanedScores.length} strateg${orphanedScores.length === 1 ? 'y' : 'ies'} not in the Strategy Table`);
  }

  // Check: success criteria exist in problem frame but no assessment criteria
  const hasCriteria = (sessionData.problemFrame?.successCriteria ?? []).length > 0;
  const hasAssessmentCriteria = (sessionData.assessmentCriteria ?? []).length > 0;
  if (hasCriteria && !hasAssessmentCriteria) {
    contradictions.push('Success criteria defined in Problem Frame are not reflected in the Qualitative Assessment');
  }

  // Check: issues flagged as high-impact not addressed in risk timeline
  const highImpactIssues = (sessionData.issues ?? []).filter((i: any) => i.impact === 'high' || i.impact === 'critical');
  const riskLabels = new Set((sessionData.riskItems ?? []).map((r: any) => r.label?.toLowerCase()));
  const unaddressed = highImpactIssues.filter((issue: any) =>
    !riskLabels.has(issue.label?.toLowerCase())
  );
  if (unaddressed.length) {
    contradictions.push(`${unaddressed.length} high-impact issue${unaddressed.length === 1 ? '' : 's'} not reflected in Risk Timeline`);
  }

  // Check: stakeholders with 'blocker' alignment but no mitigation strategy
  const blockers = (sessionData.stakeholders ?? []).filter((s: any) => s.alignment === 'blocker');
  if (blockers.length && !(sessionData.strategies ?? []).length) {
    contradictions.push(`${blockers.length} blocker stakeholder${blockers.length === 1 ? '' : 's'} identified but no mitigation strategies exist`);
  }

  return contradictions;
}

// ─────────────────────────────────────────────────────────────
// TRUST SCORER
// ─────────────────────────────────────────────────────────────

function scoreTrust(sessionData: Record<string, any>): 'high' | 'medium' | 'low' {
  let score = 0;
  if (sessionData.problemFrame?.reviewStatus === 'user_validated') score += 2;
  if ((sessionData.strategies ?? []).length >= 2) score += 2;
  if ((sessionData.issues ?? []).length >= 3) score += 1;
  if ((sessionData.stakeholders ?? []).length >= 1) score += 1;
  if (sessionData.sourceDocument) score += 1; // has a source doc
  if (score >= 5) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────────
// MEMORY CHECK
// Returns instructions to inject into prompt to prevent regeneration
// ─────────────────────────────────────────────────────────────

function buildMemoryInstructions(memory: DecisionMemory | undefined): string {
  if (!memory) return '';

  const lines: string[] = [];

  if (memory.problemFrameValidated) {
    lines.push('⚠ MEMORY: The Problem Frame has been user-validated. Do NOT suggest changes to the decision statement or reframe the problem.');
  }

  if (memory.strategies.length) {
    lines.push(`⚠ MEMORY: The following strategies are LOCKED (user-validated). Never suggest alternatives or regenerate these:\n${memory.strategies.join(', ')}`);
  }

  if (memory.issues.length) {
    lines.push(`⚠ MEMORY: The following issues are LOCKED. Do not regenerate or replace them.`);
  }

  return lines.length ? `\n\nDECISION MEMORY — DO NOT OVERRIDE:\n${lines.join('\n')}` : '';
}

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(options: DQAIOptions): string {
  const contradictions = detectCrossModuleContradictions(options.sessionData ?? {});
  const memory = buildMemoryInstructions(options.decisionMemory);

  return `You are a Decision Quality (DQ) analyst assistant operating inside a structured decision framework. Your role is to help users improve the quality of their decisions, not to make decisions for them.

ACTIVE MODULE: ${options.moduleId}

DQ CONSTITUTION (non-negotiable rules):
1. Never regenerate content that the user has already validated — check DECISION MEMORY first
2. Always distinguish what you know (data-backed) from what you're inferring (assumptions)
3. Flag contradictions across modules immediately — don't paper over them
4. Trust badges mean everything: your response confidence drives the UI
5. Suggest next actions that move the decision forward, not backward
6. Never hallucinate strategies, stakeholders, or numbers not grounded in session data

${contradictions.length ? `\n⚠ CROSS-MODULE CONTRADICTIONS DETECTED:\n${contradictions.map(c => `  • ${c}`).join('\n')}` : ''}
${memory}

OUTPUT FORMAT — always respond with valid JSON matching this shape:
{
  "data": <your actual response payload>,
  "dataUsed": ["list every session data point you actually used"],
  "missingData": ["list what you needed but didn't have"],
  "assumptionsMade": ["explicit assumptions the user should validate"],
  "suggestedNextActions": ["2-4 concrete next steps for the user"],
  "itemConfidences": { "item_id_or_label": 0.0-1.0 }
}

Do not include any text outside of this JSON object.`;
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useDQAI<T = unknown>(): DQAIHookState<T> {
  const [result, setResult] = useState<DQAIResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (
    prompt: string,
    options: DQAIOptions = { moduleId: 'unknown' }
  ): Promise<DQAIResult<T> | null> => {
    setLoading(true);
    setError(null);
    const start = Date.now();

    try {
      const trust = scoreTrust(options.sessionData ?? {});
      const contradictions = detectCrossModuleContradictions(options.sessionData ?? {});
      const systemPrompt = buildSystemPrompt(options);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API error ${response.status}: ${errBody}`);
      }

      const apiData = await response.json();
      const raw = apiData.content?.find((b: any) => b.type === 'text')?.text ?? '{}';
      const clean = raw.replace(/```json|```/g, '').trim();

      let parsed: any;
      try {
        parsed = JSON.parse(clean);
      } catch {
        throw new Error('AI response was not valid JSON. Please try again.');
      }

      const result: DQAIResult<T> = {
        data: parsed.data as T,
        trust,
        meta: {
          model: 'claude-sonnet-4-20250514',
          latencyMs: Date.now() - start,
          tokensUsed: apiData.usage?.output_tokens,
        },
        dataUsed: parsed.dataUsed ?? [],
        missingData: parsed.missingData ?? [],
        assumptionsMade: parsed.assumptionsMade ?? [],
        contradictions,
        suggestedNextActions: parsed.suggestedNextActions ?? [],
        itemConfidences: parsed.itemConfidences ?? {},
      };

      setResult(result);
      return result;
    } catch (err: any) {
      const message = err.message ?? 'Unknown error';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { result, loading, error, call, reset };
}

// ─────────────────────────────────────────────────────────────
// TRUST BADGE DISPLAY HELPER
// ─────────────────────────────────────────────────────────────

export function getTrustBadge(trust: 'high' | 'medium' | 'low') {
  const map = {
    high:   { label: 'High trust',   color: '#10B981', bg: '#ECFDF5', icon: '◆' },
    medium: { label: 'Medium trust', color: '#D97706', bg: '#FFFBEB', icon: '◇' },
    low:    { label: 'Low trust',    color: '#EF4444', bg: '#FEF2F2', icon: '△' },
  };
  return map[trust];
}

export type { DQAIResult };
