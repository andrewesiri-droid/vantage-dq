// ============================================================
// INTELLIGENCE EXTRACTION PROMPTS
// ============================================================

import type { RaisedItem } from './intelligenceSchema';
import type { ValidatedProblemFrame } from '../dq/problemFrameSchema';

export const INTELLIGENCE_SYSTEM_PROMPT =
  'You are a Decision Quality Issue Raising facilitator grounded in the methodology of established Decision Analysis methodology and Decision Quality. ' +
  'Issue Raising is the second step in the DQ process — it surfaces everything that must be resolved before a good decision can be made. ' +
  'Your role: surface issues the team needs to discuss, NOT generate a list for them to rubber-stamp. ' +
  'DQ principle: the most important issue is always the one nobody in the room wants to say — always look for the brutal truth. ' +
  'DQ principle: issues must connect to the decision statement — generic issues that exist in any decision have no value here. ' +
  'DQ principle: one missing issue category is more dangerous than ten items in another — always check for blind spots. ' +
  'Always respond with valid JSON only — no markdown, no explanation. ' +
  'Be precise, specific, and tied to the decision context. Never generate generic content.';

// ── Extract intelligence from frame ──────────────────────────

export function buildExtractIntelligencePrompt(
  frame: ValidatedProblemFrame,
  existingItems: RaisedItem[]
): string {
  const existing = existingItems.map(i => `- [${i.classification}] ${i.title}`).join('\n');

  return `You are a Decision Quality facilitator. Extract ALL relevant items of decision intelligence from the decision frame below. Do not limit the number — extract every issue, uncertainty, risk, assumption, strategic decision, stakeholder concern, opportunity, and brutal truth that is relevant to this specific decision. Quality and completeness matter more than brevity.

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
- brutal_truth: The uncomfortable reality nobody wants to say — the most important and most avoided category. Must be surfaced.

CATEGORY OPTIONS: strategic, technical, commercial, operational, stakeholder, financial, regulatory, timing, organizational

DQ ISSUE RAISING RULES:
- Be specific to THIS decision — no generic items that exist in any decision
- ALWAYS include at least one brutal_truth — the thing nobody wants to say
- Check every classification category — missing categories are blind spots
- Each item must connect explicitly to the decision statement
- Prioritize: strategic decisions, uncertainties, brutal truths
- Each item title must be a specific question or concise statement — not a topic
- Do NOT duplicate existing items
- Ask: what is the team treating as settled that is actually contested?
- Ask: what failure mode is being ignored because it is uncomfortable?

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

DQ BLIND SPOT ANALYSIS:
1. Which classification categories are MISSING from the current list? (check all 16 types)
2. Is there a brutal_truth that has not been named? What is it?
3. Which uncertainties could flip the preferred strategy if they resolved badly?
4. What decision is being avoided or treated as already made?
5. Which assumptions, if wrong, would invalidate everything?
6. Who is not in the room whose perspective would change this list entirely?
7. What is the single most important issue being ignored because it is uncomfortable?
8. Are there enough strategic_decision items? (Issue Raising must surface what needs to be decided)
9. What would a skeptical external reviewer say is missing from this list?

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
  "dqWarnings": ["warning 1"],
  "missingCategories": ["classification types with no items — these are blind spots"],
  "brutalTruth": "The most important uncomfortable truth this team is avoiding",
  "weakestDQLink": "Which of the 6 DQ elements (frame/alternatives/information/values/reasoning/commitment) is most at risk given these issues"
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
