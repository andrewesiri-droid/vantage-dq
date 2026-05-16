// ============================================================
// INTELLIGENCE EXTRACTION PROMPTS
// ============================================================

import type { RaisedItem } from './intelligenceSchema';
import type { ValidatedProblemFrame } from '../dq/problemFrameSchema';

export const INTELLIGENCE_SYSTEM_PROMPT =
  'You are a world-class Decision Quality facilitator trained in the Decision Frameworks LP methodology. ' +
  'Your role is to extract, classify, and structure decision intelligence from raw input. ' +
  'Always respond with valid JSON only — no markdown, no explanation. ' +
  'Be precise, specific, and tied to the decision context. Never generate generic content.';

// ── Extract intelligence from frame ──────────────────────────

export function buildExtractIntelligencePrompt(
  frame: ValidatedProblemFrame,
  existingItems: RaisedItem[]
): string {
  const existing = existingItems.map(i => `- [${i.classification}] ${i.title}`).join('\n');

  return `You are a Decision Quality facilitator. Extract 12–18 items of decision intelligence from the decision frame below.

DECISION STATEMENT: ${frame.decisionStatement}
CONTEXT: ${frame.context}
TRIGGER: ${frame.trigger}
SCOPE IN: ${frame.scopeIn.join(', ') || 'Not defined'}
SCOPE OUT: ${frame.scopeOut.join(', ') || 'Not defined'}
CONSTRAINTS: ${frame.constraints.join(', ') || 'None'}
ASSUMPTIONS: ${frame.assumptions.join(', ') || 'None'}
SUCCESS CRITERIA: ${frame.successCriteria.join(', ') || 'Not defined'}
FAILURE CONSEQUENCES: ${frame.failureConsequences || 'Not stated'}

EXISTING ITEMS (do not duplicate):
${existing || 'None yet'}

CLASSIFICATION OPTIONS (use EXACT values):
- strategic_decision: Major directional choice affecting value or outcomes
- tactical_decision: Lower-level implementation choice
- fact: Condition treated as true and fixed
- uncertainty: Unknown variable that could change outcomes
- risk: Possible future event with consequence
- assumption: Condition believed true but not validated
- constraint: Hard limit that cannot be violated
- stakeholder_concern: Alignment, approval, or resistance issue
- opportunity: Favorable condition or upside
- information_gap: Missing data needed for confidence
- evaluation_criterion: Measure to judge strategy quality
- dependency: Relies on another condition
- conflict_tension: Trade-off or competing objective

CATEGORY OPTIONS: strategic, technical, commercial, operational, stakeholder, financial, regulatory, timing, organizational

RULES:
- Be specific to THIS decision — no generic items
- Include a mix of classifications
- Prioritize strategic decisions, uncertainties, and risks
- Each item must have a clear title phrased as a question or concise statement
- Do NOT duplicate existing items

Return ONLY valid JSON:
{
  "items": [
    {
      "title": "Specific decision-relevant item",
      "description": "Why this matters for the decision",
      "classification": "exact_classification_value",
      "category": "exact_category_value",
      "confidenceScore": 85,
      "decisionImpact": 4,
      "urgency": 3,
      "uncertaintyLevel": 4,
      "linkedProblemFrameFields": ["decisionStatement", "constraints"],
      "rationale": "Why this is relevant to the decision"
    }
  ]
}`;
}

// ── Classify raw items ────────────────────────────────────────

export function buildClassifyPrompt(items: RaisedItem[]): string {
  const raw = items.map(i => `ID: ${i.id}\nTitle: ${i.title}\nCurrent: ${i.classification}`).join('\n\n');

  return `You are a Decision Quality facilitator. Reclassify and improve the following items.

CLASSIFICATION OPTIONS:
strategic_decision, tactical_decision, fact, uncertainty, risk, assumption, constraint,
stakeholder_concern, opportunity, information_gap, action_item, evaluation_criterion,
dependency, conflict_tension, out_of_scope, duplicate

RULES:
- If item is really a strategic decision, classify as strategic_decision
- If item is an uncertainty, classify as uncertainty  
- If vague topic, mark needs_review and improve title
- If duplicate, set classification to duplicate
- Convert vague nouns into clear questions or statements
- Preserve user intent

ITEMS:
${raw}

Return ONLY valid JSON:
{
  "updates": [
    {
      "id": "item id",
      "title": "improved title",
      "classification": "corrected_classification",
      "category": "corrected_category",
      "reviewStatus": "needs_review",
      "rationale": "why this classification"
    }
  ]
}`;
}

// ── Facilitator copilot analysis ──────────────────────────────

export function buildCopilotPrompt(
  frame: ValidatedProblemFrame,
  items: RaisedItem[]
): string {
  const accepted = items
    .filter(i => i.reviewStatus === 'accepted')
    .map(i => `[${i.classification}] ${i.title}`)
    .join('\n');

  return `You are a Decision Quality facilitator copilot. Analyze the current decision intelligence and provide guidance.

DECISION: ${frame.decisionStatement}
SUCCESS CRITERIA: ${frame.successCriteria.join(', ')}
ASSUMPTIONS: ${frame.assumptions.join(', ')}

CURRENT INTELLIGENCE:
${accepted || 'No items accepted yet'}

ANALYZE:
1. Which items are truly strategic vs tactical?
2. What assumptions are driving this decision?
3. Which uncertainties could change the preferred strategy?
4. What tensions remain unresolved?
5. What decision is being avoided?
6. What blind spots exist?
7. What has the highest consequence if ignored?

Return ONLY valid JSON:
{
  "keyInsights": ["insight 1", "insight 2"],
  "unresolved_tensions": ["tension 1", "tension 2"],
  "hiddenAssumptions": ["assumption 1"],
  "criticalUncertainties": ["uncertainty 1"],
  "avoidedDecisions": ["decision being avoided"],
  "blindSpots": ["blind spot 1"],
  "facilitatorQuestions": [
    "Which of these are truly strategic?",
    "What are we treating as fact that may not be true?"
  ],
  "nextBestActions": ["action 1", "action 2"],
  "dqWarnings": ["warning 1"]
}`;
}

// ── Downstream routing ────────────────────────────────────────

export function buildRoutingPrompt(items: RaisedItem[]): string {
  const accepted = items
    .filter(i => i.reviewStatus === 'accepted')
    .map(i => `ID: ${i.id}\nTitle: ${i.title}\nClassification: ${i.classification}`)
    .join('\n\n');

  return `You are a DQ facilitator. Recommend downstream routing for each accepted item.

DOWNSTREAM TARGETS:
- decision_hierarchy: Strategic and tactical decisions
- scenario_planning: Uncertainties defining future scenarios  
- voi: Uncertainties where more info could change the decision
- risk_timeline: Risks with timing dimensions
- stakeholder_alignment: Stakeholder concerns
- strategy_table: Items differentiating strategies / opportunities
- problem_frame: Facts, constraints, assumptions, criteria
- qualitative_assessment: Evaluation criteria
- game_theory: Stakeholder conflicts and tensions

ITEMS:
${accepted}

Return ONLY valid JSON:
{
  "routing": [
    {
      "id": "item id",
      "downstreamTargets": ["target1", "target2"],
      "rationale": "why these targets"
    }
  ]
}`;
}
