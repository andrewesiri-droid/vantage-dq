// ============================================================
// PROBLEM FRAME FIELD DEFINITIONS
// Single source of truth for all field rules, labels, and validation
// ============================================================

export type FieldSource = 'user_input' | 'document' | 'inferred' | 'missing';
export type ReviewStatus = 'validated' | 'needs_review' | 'missing';

export interface FieldDefinition {
  key: string;
  label: string;
  definition: string;
  rules: string[];
  examples?: string[];
  required: boolean;
  isArray: boolean;
}

export const PROBLEM_FRAME_FIELDS: Record<string, FieldDefinition> = {
  decisionStatement: {
    key: 'decisionStatement',
    label: 'Decision Statement',
    definition: 'The specific decision question the team must answer.',
    rules: [
      'Must be phrased as a question.',
      'Must follow format: "How should [owner/team] [action] in order to [outcome] under [constraint/uncertainty]?"',
      'Must be a decision, not a topic.',
      'Must NOT embed the preferred answer.',
      'Must include decision context.',
      'Must be actionable.',
    ],
    examples: [
      'How should Acme Corp allocate its $5M innovation budget in order to maximize long-term growth under current market uncertainty?',
      'Whether to expand operations into Southeast Asia in order to capture emerging market share, given our 18-month runway constraint?',
    ],
    required: true,
    isArray: false,
  },
  context: {
    key: 'context',
    label: 'Context',
    definition: 'Factual background needed to understand the decision.',
    rules: [
      'Facts only — no recommendations.',
      'No speculation unless explicitly labeled as inferred.',
      'Should answer the key questions the decision evaluation needs to address.',
    ],
    required: true,
    isArray: false,
  },
  background: {
    key: 'background',
    label: 'Background & History',
    definition: 'Relevant history leading to the current decision.',
    rules: [
      'Should explain how we got here.',
      'Should NOT duplicate context.',
      'Focus on prior decisions, events, or conditions that frame this one.',
    ],
    required: false,
    isArray: false,
  },
  trigger: {
    key: 'trigger',
    label: 'Decision Trigger',
    definition: 'Why the decision is needed now.',
    rules: [
      'Must identify urgency, event, deadline, opportunity, threat, or change in condition.',
      'Must answer: why now and not later?',
    ],
    required: true,
    isArray: false,
  },
  scopeIn: {
    key: 'scopeIn',
    label: 'In Scope',
    definition: 'What is explicitly included in this decision.',
    rules: [
      'Cover: assets, geographies, time horizon, commercial scope, technical scope, stakeholders, decision boundaries.',
      'Be specific — vague scope leads to scope creep.',
    ],
    required: false,
    isArray: true,
  },
  scopeOut: {
    key: 'scopeOut',
    label: 'Out of Scope',
    definition: 'What is explicitly excluded from this decision.',
    rules: [
      'Must prevent scope creep.',
      'If not yet known, state: "Not yet defined."',
    ],
    required: false,
    isArray: true,
  },
  constraints: {
    key: 'constraints',
    label: 'Givens & Constraints',
    definition: 'Hard limits the decision cannot violate.',
    rules: [
      'Must be hard limits — not preferences.',
      'Examples: budget ceiling, regulatory requirement, JV approval needed, safety threshold, timing deadline.',
      'Do NOT include assumptions here.',
    ],
    required: true,
    isArray: true,
  },
  assumptions: {
    key: 'assumptions',
    label: 'Assumptions',
    definition: 'Conditions treated as true for the purpose of this decision.',
    rules: [
      'Must be stated as declarative statements, not questions.',
      'Do NOT confuse with uncertainties (uncertainties go in Issue Generation).',
      'If weakly supported, mark as "needs validation".',
    ],
    required: false,
    isArray: true,
  },
  successCriteria: {
    key: 'successCriteria',
    label: 'Values & Objectives',
    definition: 'How the team will judge a good decision.',
    rules: [
      'Must be decision criteria, NOT activities or tasks.',
      'Should cover: value creation, risk, feasibility, timing, stakeholder alignment, strategic fit.',
      'Must be comparable across alternatives.',
    ],
    required: true,
    isArray: true,
  },
  failureConsequences: {
    key: 'failureConsequences',
    label: 'Cost of a Wrong Decision',
    definition: 'What happens if the decision is poor, delayed, or wrong.',
    rules: [
      'Must describe specific business impact — not generic risk.',
      'Should cover both: cost of wrong action AND cost of inaction.',
    ],
    required: false,
    isArray: false,
  },
};

export const REQUIRED_FIELDS = Object.values(PROBLEM_FRAME_FIELDS)
  .filter(f => f.required)
  .map(f => f.key);

export const DECISION_STATEMENT_PATTERNS = [
  /^how should/i,
  /^whether to/i,
  /^what strategy should/i,
  /^which .+ should/i,
  /^should we/i,
  /^how can/i,
  /^what is the best/i,
];

export function isDecisionQuestion(statement: string): boolean {
  return DECISION_STATEMENT_PATTERNS.some(p => p.test(statement.trim()));
}
