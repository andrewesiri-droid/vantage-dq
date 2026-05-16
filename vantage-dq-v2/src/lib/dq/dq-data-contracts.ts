// ============================================================
// DQ DATA CONTRACTS
// Formal declaration of what each module consumes and produces.
// This is the single source of truth for module dependencies.
// ============================================================

export type ModuleId =
  | 'problem'
  | 'issues'
  | 'hierarchy'
  | 'strategy'
  | 'assessment'
  | 'scenario'
  | 'voi'
  | 'influence'
  | 'stakeholders'
  | 'risk-timeline'
  | 'scorecard'
  | 'lineage'
  | 'export'
  | 'post-decision'
  | 'tornado'
  | 'decision-tree'
  | 'game-theory';

export type DataSource =
  | 'problem_frame'
  | 'issues'
  | 'decisions'
  | 'strategies'
  | 'criteria'
  | 'assessment_scores'
  | 'scenarios'
  | 'voi_results'
  | 'influence_diagram'
  | 'stakeholders'
  | 'risks'
  | 'dq_scorecard'
  | 'recommendation'
  | 'tornado_variables'
  | 'decision_tree'
  | 'game_theory';

export type AIGenerationPolicy =
  | 'allowed'           // AI can generate new objects
  | 'reuse_only'        // AI must reuse existing objects, cannot create new
  | 'suggest_only'      // AI can suggest but not create
  | 'not_allowed';      // No AI generation for this data type in this module

export interface DataRequirement {
  source: DataSource;
  required: boolean;        // true = blocks AI if missing; false = optional
  minItems?: number;        // minimum count required
  validatedOnly?: boolean;  // if true, draft/ai_suggested items don't count
  description: string;
}

export interface DataOutput {
  source: DataSource;
  description: string;
  isSourceOfTruth: boolean;  // true = downstream must use this, not regenerate
}

export interface ModuleDataContract {
  moduleId: ModuleId;
  label: string;
  purpose: string;
  consumes: DataRequirement[];
  produces: DataOutput[];
  aiPolicy: Partial<Record<DataSource, AIGenerationPolicy>>;
  blockers: string[];        // conditions that should block proceeding
  warnings: string[];        // conditions that should warn but not block
}

// ── Module contracts ──────────────────────────────────────────

export const DATA_CONTRACTS: Record<ModuleId, ModuleDataContract> = {

  problem: {
    moduleId: 'problem',
    label: 'Problem Frame',
    purpose: 'Define the decision correctly before solving it.',
    consumes: [],
    produces: [
      { source: 'problem_frame', description: 'Decision statement, context, scope, constraints, criteria', isSourceOfTruth: true },
    ],
    aiPolicy: {
      problem_frame: 'allowed',
    },
    blockers: [
      'Decision statement is missing',
      'Decision statement is not phrased as a question',
      'Success criteria are not defined',
    ],
    warnings: [
      'Decision owner is not identified',
      'Scope is not defined',
      'Trigger is not stated',
    ],
  },

  issues: {
    moduleId: 'issues',
    label: 'Issue Raising',
    purpose: 'Extract decision intelligence — issues, uncertainties, risks, assumptions.',
    consumes: [
      { source: 'problem_frame', required: true, validatedOnly: true, description: 'Decision statement and context required to generate relevant issues' },
    ],
    produces: [
      { source: 'issues', description: 'Classified decision intelligence items', isSourceOfTruth: true },
    ],
    aiPolicy: {
      issues: 'allowed',
    },
    blockers: [
      'Problem Frame has no validated decision statement',
    ],
    warnings: [
      'No uncertainties identified',
      'No strategic decisions identified',
      'Fewer than 5 accepted items',
    ],
  },

  hierarchy: {
    moduleId: 'hierarchy',
    label: 'Decision Structuring',
    purpose: 'Separate focus decisions, uncertainties, tensions, and criteria.',
    consumes: [
      { source: 'problem_frame', required: true, validatedOnly: true, description: 'Decision statement, constraints, criteria' },
      { source: 'issues', required: false, description: 'Raised items to structure' },
    ],
    produces: [
      { source: 'decisions', description: 'Focus decisions, tactical decisions, givens', isSourceOfTruth: true },
      { source: 'criteria', description: 'Evaluation criteria extracted from structuring', isSourceOfTruth: false },
    ],
    aiPolicy: {
      decisions: 'allowed',
      criteria: 'allowed',
    },
    blockers: [
      'Problem Frame not validated',
    ],
    warnings: [
      'No focus decisions identified',
      'No evaluation criteria defined',
      'No uncertainties identified',
    ],
  },

  strategy: {
    moduleId: 'strategy',
    label: 'Strategy Formation',
    purpose: 'Design materially distinct strategic alternatives.',
    consumes: [
      { source: 'problem_frame', required: true, validatedOnly: true, description: 'Decision statement and constraints' },
      { source: 'decisions', required: true, minItems: 1, description: 'At least one focus decision required to anchor strategies' },
      { source: 'criteria', required: false, description: 'Evaluation criteria to design against' },
    ],
    produces: [
      { source: 'strategies', description: 'Named strategic alternatives with objectives and rationale', isSourceOfTruth: true },
    ],
    aiPolicy: {
      strategies: 'allowed',
    },
    blockers: [
      'No focus decisions identified — complete Decision Structuring first',
      'Problem Frame not validated',
    ],
    warnings: [
      'Fewer than 2 strategies accepted',
      'No evaluation criteria defined',
      'Strategies may not be sufficiently distinct',
    ],
  },

  assessment: {
    moduleId: 'assessment',
    label: 'Strategy Evaluation',
    purpose: 'Score and compare strategies against criteria.',
    consumes: [
      { source: 'strategies', required: true, minItems: 2, validatedOnly: true, description: 'At least 2 strategies required' },
      { source: 'criteria', required: true, minItems: 1, description: 'At least 1 criterion required' },
    ],
    produces: [
      { source: 'assessment_scores', description: 'Strategy-criterion scores with rationale', isSourceOfTruth: true },
    ],
    aiPolicy: {
      assessment_scores: 'allowed',
      strategies: 'reuse_only',  // Must not create new strategies
      criteria: 'suggest_only',  // Can suggest missing criteria but not override
    },
    blockers: [
      'Fewer than 2 validated strategies — complete Strategy Formation first',
      'No evaluation criteria — define criteria in Problem Frame or Decision Structuring',
    ],
    warnings: [
      'Some strategies not yet scored',
      'Dominance analysis not run',
    ],
  },

  scenario: {
    moduleId: 'scenario',
    label: 'Scenario Planning',
    purpose: 'Test strategies against plausible future conditions.',
    consumes: [
      { source: 'strategies', required: true, minItems: 2, validatedOnly: true, description: 'Strategies to stress test' },
      { source: 'decisions', required: false, description: 'Key uncertainties from structuring' },
    ],
    produces: [
      { source: 'scenarios', description: '4 scenarios with narratives and strategy robustness', isSourceOfTruth: true },
    ],
    aiPolicy: {
      scenarios: 'allowed',
      strategies: 'reuse_only',
    },
    blockers: [
      'Fewer than 2 validated strategies',
    ],
    warnings: [
      'No critical uncertainties identified — scenarios may be generic',
      'Stress test not run',
    ],
  },

  voi: {
    moduleId: 'voi',
    label: 'Value of Information',
    purpose: 'Determine which uncertainties are worth resolving before deciding.',
    consumes: [
      { source: 'decisions', required: true, description: 'Key uncertainties from structuring' },
      { source: 'strategies', required: true, minItems: 2, description: 'Strategies to assess impact against' },
    ],
    produces: [
      { source: 'voi_results', description: 'VOI scores and study recommendations', isSourceOfTruth: true },
    ],
    aiPolicy: {
      voi_results: 'allowed',
      strategies: 'reuse_only',
    },
    blockers: [
      'No uncertainties identified',
      'Fewer than 2 strategies',
    ],
    warnings: [
      'High uncertainty + no VOI analysis = high risk of wrong decision',
    ],
  },

  influence: {
    moduleId: 'influence',
    label: 'Influence Diagram',
    purpose: 'Map causal relationships between decisions, uncertainties, and value.',
    consumes: [
      { source: 'decisions', required: true, description: 'Focus decisions as decision nodes' },
      { source: 'strategies', required: false, description: 'Strategies to connect to decision nodes' },
      { source: 'criteria', required: false, description: 'Value criteria as value nodes' },
    ],
    produces: [
      { source: 'influence_diagram', description: 'Nodes and edges showing causal structure', isSourceOfTruth: true },
    ],
    aiPolicy: {
      influence_diagram: 'allowed',
      strategies: 'reuse_only',
    },
    blockers: [],
    warnings: [
      'No focus decisions to anchor diagram',
    ],
  },

  stakeholders: {
    moduleId: 'stakeholders',
    label: 'Stakeholder Alignment',
    purpose: 'Map who can approve, block, or influence the decision.',
    consumes: [
      { source: 'problem_frame', required: true, description: 'Decision context for stakeholder relevance' },
      { source: 'strategies', required: false, description: 'Strategies to assess stakeholder reactions' },
    ],
    produces: [
      { source: 'stakeholders', description: 'Stakeholder map with alignment and engagement strategy', isSourceOfTruth: true },
    ],
    aiPolicy: {
      stakeholders: 'allowed',
    },
    blockers: [],
    warnings: [
      'Blockers identified — engagement strategy required',
      'Decision authority not identified',
    ],
  },

  'risk-timeline': {
    moduleId: 'risk-timeline',
    label: 'Decision Risk Timeline',
    purpose: 'Identify and time risks that could affect execution or value.',
    consumes: [
      { source: 'strategies', required: true, description: 'Strategies to assess risks against' },
      { source: 'scenarios', required: false, description: 'Scenario stress test inputs' },
      { source: 'stakeholders', required: false, description: 'Stakeholder risks' },
    ],
    produces: [
      { source: 'risks', description: 'Risks with timing, mitigation, and ownership', isSourceOfTruth: true },
    ],
    aiPolicy: {
      risks: 'allowed',
      strategies: 'reuse_only',
    },
    blockers: [
      'No strategies to assess risks against',
    ],
    warnings: [
      'Critical risks with no mitigation',
      'Immediate risks require attention',
    ],
  },

  scorecard: {
    moduleId: 'scorecard',
    label: 'DQ Scorecard',
    purpose: 'Audit the quality of the decision process across 6 dimensions.',
    consumes: [
      { source: 'problem_frame', required: true, description: 'Frame quality assessment' },
      { source: 'strategies', required: true, description: 'Alternatives quality assessment' },
      { source: 'assessment_scores', required: false, description: 'Reasoning quality assessment' },
      { source: 'criteria', required: false, description: 'Values quality assessment' },
      { source: 'stakeholders', required: false, description: 'Commitment quality assessment' },
      { source: 'risks', required: false, description: 'Information quality assessment' },
    ],
    produces: [
      { source: 'dq_scorecard', description: '6-dimension DQ scores with gaps and recommendations', isSourceOfTruth: true },
    ],
    aiPolicy: {
      dq_scorecard: 'allowed',
    },
    blockers: [
      'DQ score below 50 — address critical gaps before recommendation',
    ],
    warnings: [
      'Weakest dimension caps overall readiness',
    ],
  },

  lineage: {
    moduleId: 'lineage',
    label: 'Decision Lineage',
    purpose: 'Traceable reasoning chain from problem to recommendation.',
    consumes: [
      { source: 'problem_frame', required: true, validatedOnly: true, description: 'Decision frame' },
      { source: 'strategies', required: true, minItems: 2, description: 'Strategies analyzed' },
      { source: 'criteria', required: true, description: 'Evaluation criteria used' },
      { source: 'assessment_scores', required: true, description: 'Scores and trade-offs' },
      { source: 'dq_scorecard', required: false, description: 'Process quality' },
      { source: 'risks', required: false, description: 'Key risks' },
      { source: 'stakeholders', required: false, description: 'Stakeholder alignment' },
    ],
    produces: [
      { source: 'recommendation', description: 'Recommended strategy with reasoning chain', isSourceOfTruth: true },
    ],
    aiPolicy: {
      recommendation: 'allowed',
      strategies: 'reuse_only',  // MUST NOT invent new strategies
    },
    blockers: [
      'No validated strategies — complete Strategy Formation first',
      'No assessment scores — complete Strategy Evaluation first',
    ],
    warnings: [
      'DQ score below 50 — recommendation may not be reliable',
      'Major risks unmitigated',
    ],
  },

  export: {
    moduleId: 'export',
    label: 'Executive Recommendation',
    purpose: 'Package validated decision intelligence into executive deliverables.',
    consumes: [
      { source: 'recommendation', required: true, description: 'Decision lineage recommendation' },
      { source: 'strategies', required: true, description: 'Strategies analyzed' },
      { source: 'assessment_scores', required: false, description: 'Scoring results' },
      { source: 'dq_scorecard', required: false, description: 'Process quality' },
    ],
    produces: [],
    aiPolicy: {
      recommendation: 'reuse_only',
      strategies: 'reuse_only',
    },
    blockers: [],
    warnings: [
      'Some modules not completed — report may be incomplete',
    ],
  },

  'post-decision': {
    moduleId: 'post-decision',
    label: 'Post-Decision Tracker',
    purpose: 'Track outcomes and convert to organizational learning.',
    consumes: [
      { source: 'recommendation', required: true, description: 'Final recommendation to track against' },
      { source: 'problem_frame', required: true, description: 'Original decision and success criteria' },
      { source: 'risks', required: false, description: 'Risks to monitor' },
    ],
    produces: [],
    aiPolicy: {},
    blockers: [
      'No recommendation yet — complete Decision Lineage first',
    ],
    warnings: [],
  },

  tornado: {
    moduleId: 'tornado',
    label: 'Tornado Chart',
    purpose: 'Sensitivity analysis showing which variables most affect outcome.',
    consumes: [
      { source: 'decisions', required: false, description: 'Key uncertainties to test' },
      { source: 'strategies', required: false, description: 'Strategies to assess sensitivity for' },
    ],
    produces: [
      { source: 'tornado_variables', description: 'Sensitivity variables with ranges', isSourceOfTruth: true },
    ],
    aiPolicy: { tornado_variables: 'allowed' },
    blockers: [],
    warnings: [],
  },

  'decision-tree': {
    moduleId: 'decision-tree',
    label: 'Decision Tree',
    purpose: 'Model sequential decisions and chance events with expected values.',
    consumes: [
      { source: 'decisions', required: false, description: 'Focus decisions as tree nodes' },
      { source: 'strategies', required: false, description: 'Strategies as branches' },
    ],
    produces: [
      { source: 'decision_tree', description: 'Decision tree with expected values', isSourceOfTruth: true },
    ],
    aiPolicy: { decision_tree: 'allowed' },
    blockers: [],
    warnings: [],
  },

  'game-theory': {
    moduleId: 'game-theory',
    label: 'Game Theory',
    purpose: 'Analyze strategic interactions with counterparties.',
    consumes: [
      { source: 'stakeholders', required: false, description: 'Key players and their objectives' },
      { source: 'strategies', required: false, description: 'Our strategic options' },
    ],
    produces: [
      { source: 'game_theory', description: 'Payoff matrix and strategic recommendations', isSourceOfTruth: true },
    ],
    aiPolicy: {
      game_theory: 'allowed',
      strategies: 'reuse_only',
    },
    blockers: [],
    warnings: [],
  },
};

// ── Contract validation ───────────────────────────────────────

export interface ContractValidationResult {
  moduleId: ModuleId;
  canProceed: boolean;
  blockers: string[];
  warnings: string[];
  missingRequired: DataSource[];
  missingOptional: DataSource[];
}

export function validateContract(
  moduleId: ModuleId,
  sessionData: Record<DataSource, any[]>
): ContractValidationResult {
  const contract = DATA_CONTRACTS[moduleId];
  if (!contract) {
    return { moduleId, canProceed: true, blockers: [], warnings: [], missingRequired: [], missingOptional: [] };
  }

  const missingRequired: DataSource[] = [];
  const missingOptional: DataSource[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [...contract.warnings];

  for (const req of contract.consumes) {
    const data = sessionData[req.source] ?? [];
    const validData = req.validatedOnly
      ? data.filter((item: any) => item.reviewStatus === 'validated' || item.reviewStatus === 'user_validated' || item.reviewStatus === 'accepted')
      : data;

    const count = validData.length;
    const minRequired = req.minItems ?? (req.required ? 1 : 0);

    if (req.required && count < minRequired) {
      missingRequired.push(req.source);
      blockers.push(`${req.description} — ${req.source.replace(/_/g, ' ')} required (${count}/${minRequired})`);
    } else if (!req.required && count === 0) {
      missingOptional.push(req.source);
    }
  }

  return {
    moduleId,
    canProceed: blockers.length === 0,
    blockers,
    warnings,
    missingRequired,
    missingOptional,
  };
}

// ── AI generation check ───────────────────────────────────────

export function canAIGenerate(
  moduleId: ModuleId,
  dataSource: DataSource,
  sessionData: Record<DataSource, any[]>
): { allowed: boolean; reason?: string } {
  const contract = DATA_CONTRACTS[moduleId];
  if (!contract) return { allowed: true };

  const policy = contract.aiPolicy[dataSource];

  if (policy === 'reuse_only') {
    const existing = sessionData[dataSource] ?? [];
    if (existing.length > 0) {
      return { allowed: false, reason: `${dataSource.replace(/_/g, ' ')} already exists — AI must reuse existing data, not regenerate` };
    }
  }

  if (policy === 'not_allowed') {
    return { allowed: false, reason: `AI generation not permitted for ${dataSource.replace(/_/g, ' ')} in this module` };
  }

  // Check required inputs are present before allowing AI generation
  const validation = validateContract(moduleId, sessionData);
  if (!validation.canProceed) {
    return {
      allowed: false,
      reason: `Required inputs missing before AI can generate: ${validation.blockers.join('; ')}`,
    };
  }

  return { allowed: true };
}

// ── Source of truth registry ──────────────────────────────────

export function getSourceOfTruth(dataSource: DataSource): ModuleId | null {
  for (const [moduleId, contract] of Object.entries(DATA_CONTRACTS)) {
    const output = contract.produces.find(p => p.source === dataSource && p.isSourceOfTruth);
    if (output) return moduleId as ModuleId;
  }
  return null;
}

export const SOURCE_OF_TRUTH: Partial<Record<DataSource, ModuleId>> = {
  problem_frame:    'problem',
  issues:           'issues',
  decisions:        'hierarchy',
  strategies:       'strategy',
  assessment_scores:'assessment',
  scenarios:        'scenario',
  voi_results:      'voi',
  influence_diagram:'influence',
  stakeholders:     'stakeholders',
  risks:            'risk-timeline',
  dq_scorecard:     'scorecard',
  recommendation:   'lineage',
};
