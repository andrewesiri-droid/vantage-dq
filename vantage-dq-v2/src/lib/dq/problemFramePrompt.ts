// ============================================================
// PROBLEM FRAME PROMPT BUILDER
// Builds the strict AI contract prompt for consistent extraction
// ============================================================

import { PROBLEM_FRAME_FIELDS } from './problemFrameDefinitions';
import type { ProblemFrameState } from './problemFrameSchema';

interface PromptOptions {
  documentText?: string;
  userInputs?: Partial<Record<string, string | string[]>>;
  existingState?: Partial<ProblemFrameState>;
  mode: 'extract' | 'review' | 'improve';
}

export function buildProblemFramePrompt(options: PromptOptions): string {
  const { documentText, userInputs, existingState, mode } = options;

  const fieldDefs = Object.values(PROBLEM_FRAME_FIELDS)
    .map(f => `
FIELD: ${f.key}
Label: ${f.label}
Definition: ${f.definition}
Rules:
${f.rules.map(r => `  - ${r}`).join('\n')}
${f.examples ? `Examples:\n${f.examples.map(e => `  - ${e}`).join('\n')}` : ''}
Required: ${f.required}
Type: ${f.isArray ? 'array of strings' : 'string'}
`.trim()).join('\n\n');

  const existingStateBlock = existingState
    ? `\nEXISTING SESSION STATE (DO NOT overwrite validated fields):\n${JSON.stringify(existingState, null, 2)}\n`
    : '';

  const userInputBlock = userInputs && Object.keys(userInputs).length > 0
    ? `\nUSER-PROVIDED INPUTS (treat as high-confidence):\n${JSON.stringify(userInputs, null, 2)}\n`
    : '';

  const documentBlock = documentText
    ? `\nSOURCE DOCUMENT:\n---\n${documentText.slice(0, 8000)}\n---\n`
    : '';

  const modeInstruction = {
    extract: 'Extract all Problem Frame fields from the document and/or user inputs provided. Be conservative — only extract what is clearly supported.',
    review: 'Review the existing Problem Frame state and identify improvements, gaps, and contradictions. Do not overwrite validated fields.',
    improve: 'Suggest improvements to the existing Problem Frame. Present improvements as aiSuggestion, never as replacement of validated fields.',
  }[mode];

  return `You are a Decision Quality analyst trained in the Decision Frameworks LP methodology.

TASK: ${modeInstruction}

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no preamble, no explanation outside the JSON.
2. Temperature is set to 0 — be structured, conservative, and evidence-based.
3. Every field must include: value, source, confidence (0–100), reviewStatus, rationale.
4. source must be one of: "user_input" | "document" | "inferred" | "missing"
5. If confidence < 70, set reviewStatus to "needs_review".
6. If no evidence exists, set value to "" or [], source to "missing", confidence to 0.
7. NEVER invent data. If missing, say missing.
8. NEVER overwrite fields with reviewStatus "validated" — preserve them exactly.
9. Decision statement MUST be a question format starting with: "How should", "Whether to", "What strategy should", "Which", "Should we", "How can", or "What is the best".
10. Assumptions must be declarative statements — not questions (those are uncertainties).
11. Success criteria must be decision criteria — not actions or tasks.
12. Constraints must be hard limits — not preferences.

FIELD DEFINITIONS:
${fieldDefs}

${existingStateBlock}${userInputBlock}${documentBlock}

REQUIRED OUTPUT FORMAT:
{
  "problemFrame": {
    "decisionStatement": {
      "value": "",
      "source": "user_input | document | inferred | missing",
      "confidence": 0,
      "reviewStatus": "validated | needs_review | missing",
      "rationale": "Why you extracted this value and how confident you are",
      "sourceReference": "Optional: page/section/excerpt from document"
    },
    "context":             { "value": "", "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" },
    "background":          { "value": "", "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" },
    "trigger":             { "value": "", "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" },
    "scopeIn":             { "value": [], "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" },
    "scopeOut":            { "value": [], "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" },
    "constraints":         { "value": [], "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" },
    "assumptions":         { "value": [], "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" },
    "successCriteria":     { "value": [], "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" },
    "failureConsequences": { "value": "", "source": "", "confidence": 0, "reviewStatus": "", "rationale": "" }
  },
  "dqAssessment": {
    "overallScore": 0,
    "strengths": [],
    "weaknesses": [],
    "missingCriticalInputs": [],
    "contradictions": [],
    "nextBestActions": []
  },
  "qualityChecks": {
    "isRealDecision": false,
    "hasDecisionOwner": false,
    "hasClearScope": false,
    "hasDecisionCriteria": false,
    "separatesAssumptionsFromUncertainties": false,
    "avoidsPreferredAnswer": false
  }
}`;
}

export const PROBLEM_FRAME_SYSTEM_PROMPT =
  'You are a Decision Quality analyst trained in the Decision Frameworks LP methodology. ' +
  'Your job is to extract, validate, and assess decision framing data. ' +
  'Always respond with valid JSON only — no markdown, no explanation, no preamble. ' +
  'Be conservative, evidence-based, and consistent. Never invent data.';
