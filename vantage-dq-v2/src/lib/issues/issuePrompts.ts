// ============================================================
// ISSUE GENERATION PROMPT BUILDER
// ============================================================

import type { Issue, IssueCategory, BlindSpotAnalysis } from './issueSchema';
import type { ValidatedProblemFrame } from '../dq/problemFrameSchema';

export const ISSUE_SYSTEM_PROMPT =
  'You are a Decision Quality facilitator trained in the Decision Quality methodology. ' +
  'Your role is to help teams surface decision-relevant issues before alternatives are built. ' +
  'Always respond with valid JSON only — no markdown, no explanation, no preamble. ' +
  'Be specific, evidence-based, and tied to the decision context. Never generate generic issues.';

// ── Generate Issues ──────────────────────────────────────────

export function buildGenerateIssuesPrompt(
  frame: ValidatedProblemFrame,
  existingIssues: Issue[]
): string {
  const existingTitles = existingIssues.map(i => i.title).join('\n');

  return `You are a Decision Quality facilitator. Generate 10–15 decision-relevant issues for the decision below.

DECISION STATEMENT: ${frame.decisionStatement}

CONTEXT: ${frame.context}

TRIGGER: ${frame.trigger}

SCOPE IN: ${frame.scopeIn.join(', ') || 'Not defined'}
SCOPE OUT: ${frame.scopeOut.join(', ') || 'Not defined'}
CONSTRAINTS: ${frame.constraints.join(', ') || 'None stated'}
ASSUMPTIONS: ${frame.assumptions.join(', ') || 'None stated'}
SUCCESS CRITERIA: ${frame.successCriteria.join(', ') || 'Not defined'}
FAILURE CONSEQUENCES: ${frame.failureConsequences || 'Not stated'}

EXISTING ISSUES (do not duplicate):
${existingTitles || 'None yet'}

RULES:
- Each issue must be a clear, decision-relevant question or concern.
- Issues must connect directly to the decision statement.
- Do NOT generate solutions, recommendations, or tasks.
- Do NOT duplicate existing issues.
- Do NOT create out-of-scope issues.
- Cover a range of categories.
- Phrase each issue as a clear question when possible.
- Good example: "What recoverable reserves are required to justify further appraisal?"
- Bad example: "Reservoir" or "Do more analysis" or "Choose Strategy A"

ISSUE CATEGORIES (use these exact values):
strategic, technical, commercial, operational, regulatory, stakeholder, financial, data_gap, timing, risk, assumption_challenge, scope_clarification, value_criteria, black_swan

CLASSIFICATION OPTIONS (use these exact values):
issue, decision, uncertainty, risk, assumption, constraint

CONFIDENCE SCORING:
- 90–100: Clearly implied by the decision context
- 70–89: Reasonable inference from available data
- 50–69: Possible but not directly evidenced
- Below 50: Speculative — mark needs_review

Return ONLY valid JSON in this exact format:
{
  "issues": [
    {
      "title": "Clear decision-relevant question",
      "description": "1–2 sentences explaining why this matters",
      "category": "one of the category values above",
      "classification": "one of the classification values above",
      "linkedProblemFrameFields": ["decisionStatement", "constraints"],
      "confidenceScore": 85,
      "decisionImpact": 4,
      "urgency": 3,
      "uncertaintyLevel": 4,
      "rationale": "Why this issue is relevant to the decision"
    }
  ]
}`;
}

// ── Blind Spot Analysis ──────────────────────────────────────

export function buildBlindSpotPrompt(
  frame: ValidatedProblemFrame,
  issues: Issue[]
): string {
  const issueSummary = issues
    .filter(i => i.reviewStatus !== 'rejected')
    .map(i => `- [${i.category}] ${i.title}`)
    .join('\n');

  return `You are a Decision Quality facilitator. Analyze the issue set below for blind spots and gaps.

DECISION STATEMENT: ${frame.decisionStatement}
SUCCESS CRITERIA: ${frame.successCriteria.join(', ')}
ASSUMPTIONS: ${frame.assumptions.join(', ')}

CURRENT ISSUES:
${issueSummary || 'No issues yet'}

ANALYZE FOR:
1. Missing categories — what types of issues are absent?
2. Overrepresented categories — what is getting too much focus?
3. Unchallenged assumptions — which assumptions in the Problem Frame haven't been questioned?
4. Missing stakeholder concerns — who might be affected but isn't represented?
5. Missing commercial/technical/regulatory issues — what blind spots exist?
6. Suggested facilitator questions — what should the team discuss?

Return ONLY valid JSON:
{
  "missingCategories": ["category values"],
  "overrepresentedCategories": ["category values"],
  "weakAreas": ["description of weak area"],
  "unchallengedAssumptions": ["assumption text"],
  "missingStakeholderConcerns": ["concern description"],
  "missingIssueSuggestions": [
    { "title": "", "category": "", "rationale": "" }
  ],
  "dqWarningFlags": ["warning text"],
  "nextBestActions": ["action description"],
  "facilitatorQuestions": [
    "What would make this decision fail?",
    "What are we assuming that may not be true?"
  ]
}`;
}

// ── Categorize / Clean Up ────────────────────────────────────

export function buildCategorizePrompt(issues: Issue[]): string {
  const items = issues.map(i => `ID: ${i.id}\nTitle: ${i.title}\nCurrent category: ${i.category}\nCurrent classification: ${i.classification}`).join('\n\n');

  return `You are a Decision Quality facilitator. Review and reclassify the following issues.

RULES:
- If item is really a decision, set classification to "decision"
- If item is an uncertainty, set classification to "uncertainty"
- If item is a risk, set classification to "risk"
- If item is vague, set reviewStatus to "needs_review"
- If duplicate of another, set classification to "duplicate"
- Convert vague topics into clear decision-relevant questions
- Preserve user intent — do not change meaning
- Keep original wording in originalWording field

ITEMS TO REVIEW:
${items}

Return ONLY valid JSON:
{
  "updates": [
    {
      "id": "issue id",
      "title": "improved title if needed",
      "category": "corrected category",
      "classification": "corrected classification",
      "reviewStatus": "needs_review | accepted",
      "originalWording": "original title if changed",
      "rationale": "why this classification"
    }
  ]
}`;
}

// ── Downstream mapping ───────────────────────────────────────

export function buildDownstreamMappingPrompt(issues: Issue[]): string {
  const accepted = issues
    .filter(i => i.reviewStatus === 'accepted')
    .map(i => `ID: ${i.id}\nTitle: ${i.title}\nClassification: ${i.classification}\nCategory: ${i.category}`)
    .join('\n\n');

  return `You are a Decision Quality facilitator. Recommend where each accepted issue should flow downstream.

DOWNSTREAM TARGETS:
- decision_hierarchy: Items that are themselves decisions to be structured
- scenario_planning: Uncertainties that could define future scenarios
- voi: Uncertainties where more information might change the decision
- risk_timeline: Risks with timing dimensions
- stakeholder_alignment: Stakeholder concerns and alignment issues
- strategy_table: Issues that differentiate strategies
- problem_frame: Issues that challenge the current framing

ISSUES:
${accepted}

Return ONLY valid JSON:
{
  "mappings": [
    {
      "id": "issue id",
      "downstreamTarget": "one of the target values",
      "rationale": "why this target"
    }
  ]
}`;
}
