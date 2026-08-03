/**
 * DQ Data Contract Layer — Vantage DQ
 * 
 * Defines what each module PRODUCES, CONSUMES, and REQUIRES.
 * Enforces single source of truth across all modules.
 * Prevents AI from recreating data that already exists.
 */

// ── GLOBAL DATA SCHEMA ────────────────────────────────────────────────────────
export interface DQSessionData {
  session: {
    id: number;
    name: string;
    decisionStatement: string;
    context: string;
    background: string;
    trigger: string;
    scopeIn: string;
    scopeOut: string;
    constraints: string;
    assumptions: string;
    successCriteria: string;
    failureConsequences: string;
    deadline: string;
    owner: string;
    dqScores: Record<string, number>;
  } | null;
  issues: any[];
  decisions: any[];
  strategies: any[];
  criteria: any[];
  assessmentScores: any[];
  uncertainties: any[];
  stakeholderEntries: any[];
  riskItems: any[];
  scenarios: any[];
  voiAnalyses: any[];
}

// ── MODULE CONTRACTS ──────────────────────────────────────────────────────────
export interface ModuleContract {
  id: string;
  label: string;
  produces: string[];
  consumes: { field: string; source: string; required: boolean }[];
  upstreamModules: string[];
}

export const MODULE_CONTRACTS: Record<string, ModuleContract> = {
  'problem-frame': {
    id: 'problem-frame',
    label: 'Problem Frame',
    produces: ['session.decisionStatement', 'session.context', 'session.constraints', 'session.successCriteria', 'session.deadline', 'session.owner'],
    consumes: [],
    upstreamModules: [],
  },
  'issue-generation': {
    id: 'issue-generation',
    label: 'Issue Generation',
    produces: ['issues[]'],
    consumes: [
      { field: 'session.decisionStatement', source: 'problem-frame', required: true },
      { field: 'session.context', source: 'problem-frame', required: false },
    ],
    upstreamModules: ['problem-frame'],
  },
  'decision-hierarchy': {
    id: 'decision-hierarchy',
    label: 'Decision Hierarchy',
    produces: ['decisions[]', 'criteria[]'],
    consumes: [
      { field: 'session.decisionStatement', source: 'problem-frame', required: true },
      { field: 'issues[]', source: 'issue-generation', required: false },
    ],
    upstreamModules: ['problem-frame', 'issue-generation'],
  },
  'strategy-table': {
    id: 'strategy-table',
    label: 'Strategy Table',
    produces: ['strategies[]'],
    consumes: [
      { field: 'session.decisionStatement', source: 'problem-frame', required: true },
      { field: 'decisions[]', source: 'decision-hierarchy', required: false },
      { field: 'criteria[]', source: 'decision-hierarchy', required: false },
    ],
    upstreamModules: ['problem-frame', 'decision-hierarchy'],
  },
  'qualitative-assessment': {
    id: 'qualitative-assessment',
    label: 'Qualitative Assessment',
    produces: ['assessmentScores[]'],
    consumes: [
      { field: 'strategies[]', source: 'strategy-table', required: true },
      { field: 'criteria[]', source: 'decision-hierarchy', required: true },
    ],
    upstreamModules: ['strategy-table', 'decision-hierarchy'],
  },
  'scenario-planning': {
    id: 'scenario-planning',
    label: 'Scenario Planning',
    produces: ['scenarios[]', 'uncertainties[]'],
    consumes: [
      { field: 'session.decisionStatement', source: 'problem-frame', required: true },
      { field: 'issues[]', source: 'issue-generation', required: false },
      { field: 'strategies[]', source: 'strategy-table', required: true },
    ],
    upstreamModules: ['problem-frame', 'issue-generation', 'strategy-table'],
  },
  'voi': {
    id: 'voi',
    label: 'Value of Information',
    produces: ['voiAnalyses[]'],
    consumes: [
      { field: 'uncertainties[]', source: 'scenario-planning', required: true },
      { field: 'strategies[]', source: 'strategy-table', required: true },
    ],
    upstreamModules: ['scenario-planning', 'strategy-table'],
  },
  'risk-timeline': {
    id: 'risk-timeline',
    label: 'Decision Risk Timeline',
    produces: ['riskItems[]'],
    consumes: [
      { field: 'strategies[]', source: 'strategy-table', required: true },
      { field: 'scenarios[]', source: 'scenario-planning', required: false },
    ],
    upstreamModules: ['strategy-table', 'scenario-planning'],
  },
  'stakeholder-alignment': {
    id: 'stakeholder-alignment',
    label: 'Stakeholder Alignment',
    produces: ['stakeholderEntries[]'],
    consumes: [
      { field: 'session.decisionStatement', source: 'problem-frame', required: true },
      { field: 'strategies[]', source: 'strategy-table', required: false },
    ],
    upstreamModules: ['problem-frame', 'strategy-table'],
  },
  'dq-scorecard': {
    id: 'dq-scorecard',
    label: 'DQ Scorecard',
    produces: ['session.dqScores'],
    consumes: [
      { field: 'session.decisionStatement', source: 'problem-frame', required: true },
      { field: 'strategies[]', source: 'strategy-table', required: true },
      { field: 'criteria[]', source: 'decision-hierarchy', required: false },
      { field: 'uncertainties[]', source: 'scenario-planning', required: false },
    ],
    upstreamModules: ['problem-frame', 'strategy-table', 'decision-hierarchy'],
  },
  'decision-lineage': {
    id: 'decision-lineage',
    label: 'Decision Lineage',
    produces: ['lineage', 'executiveBrief'],
    consumes: [
      { field: 'strategies[]', source: 'strategy-table', required: true },
      { field: 'criteria[]', source: 'decision-hierarchy', required: true },
      { field: 'uncertainties[]', source: 'scenario-planning', required: true },
      { field: 'scenarios[]', source: 'scenario-planning', required: false },
      { field: 'riskItems[]', source: 'risk-timeline', required: false },
      { field: 'session.dqScores', source: 'dq-scorecard', required: false },
    ],
    upstreamModules: ['strategy-table', 'decision-hierarchy', 'scenario-planning', 'dq-scorecard'],
  },
  'export-report': {
    id: 'export-report',
    label: 'Export Report',
    produces: ['report'],
    consumes: [
      { field: 'session.*', source: 'problem-frame', required: true },
      { field: 'issues[]', source: 'issue-generation', required: false },
      { field: 'strategies[]', source: 'strategy-table', required: true },
      { field: 'criteria[]', source: 'decision-hierarchy', required: false },
      { field: 'scenarios[]', source: 'scenario-planning', required: false },
      { field: 'riskItems[]', source: 'risk-timeline', required: false },
      { field: 'stakeholderEntries[]', source: 'stakeholder-alignment', required: false },
    ],
    upstreamModules: ['problem-frame', 'strategy-table'],
  },
  'influence-diagram': {
    id: 'influence-diagram',
    label: 'Influence Diagram',
    produces: ['influenceNodes[]', 'influenceEdges[]'],
    consumes: [
      { field: 'session.decisionStatement', source: 'problem-frame', required: true },
      { field: 'strategies[]', source: 'strategy-table', required: false },
      { field: 'uncertainties[]', source: 'scenario-planning', required: false },
    ],
    upstreamModules: ['problem-frame', 'strategy-table'],
  },
  'game-theory': {
    id: 'game-theory',
    label: 'Game Theory',
    produces: ['gameTheoryModels[]'],
    consumes: [
      { field: 'session.decisionStatement', source: 'problem-frame', required: true },
      { field: 'strategies[]', source: 'strategy-table', required: true },
      { field: 'stakeholderEntries[]', source: 'stakeholder-alignment', required: false },
    ],
    upstreamModules: ['problem-frame', 'strategy-table', 'stakeholder-alignment'],
  },
  'post-decision': {
    id: 'post-decision',
    label: 'Post-Decision Tracker',
    produces: ['outcomeTracking', 'learnings'],
    consumes: [
      { field: 'strategies[]', source: 'strategy-table', required: true },
      { field: 'uncertainties[]', source: 'scenario-planning', required: false },
      { field: 'riskItems[]', source: 'risk-timeline', required: false },
    ],
    upstreamModules: ['strategy-table', 'scenario-planning', 'risk-timeline'],
  },
};

// ── VALIDATION ENGINE ─────────────────────────────────────────────────────────
export interface ValidationResult {
  canProceed: boolean;
  missingRequired: { field: string; source: string; moduleLabel: string }[];
  missingOptional: { field: string; source: string; moduleLabel: string }[];
  warnings: string[];
  dataInventory: Record<string, number>;
}

export function validateModuleData(moduleId: string, data: any): ValidationResult {
  const contract = MODULE_CONTRACTS[moduleId];
  if (!contract) return { canProceed: true, missingRequired: [], missingOptional: [], warnings: [], dataInventory: {} };

  const missingRequired: any[] = [];
  const missingOptional: any[] = [];
  const warnings: string[] = [];

  // Build data inventory
  const dataInventory: Record<string, number> = {
    strategies: data?.strategies?.length || 0,
    criteria: data?.criteria?.length || 0,
    issues: data?.issues?.length || 0,
    decisions: data?.decisions?.length || 0,
    uncertainties: data?.uncertainties?.length || 0,
    scenarios: data?.scenarios?.length || 0,
    riskItems: data?.riskItems?.length || 0,
    stakeholderEntries: data?.stakeholderEntries?.length || 0,
    assessmentScores: data?.assessmentScores?.length || 0,
  };

  // Check each consumed field
  contract.consumes.forEach(dep => {
    const sourceLabel = MODULE_CONTRACTS[dep.source]?.label || dep.source;
    let isMissing = false;

    if (dep.field === 'strategies[]' && dataInventory.strategies === 0) isMissing = true;
    else if (dep.field === 'criteria[]' && dataInventory.criteria === 0) isMissing = true;
    else if (dep.field === 'issues[]' && dataInventory.issues === 0) isMissing = true;
    else if (dep.field === 'decisions[]' && dataInventory.decisions === 0) isMissing = true;
    else if (dep.field === 'uncertainties[]' && dataInventory.uncertainties === 0) isMissing = true;
    else if (dep.field === 'scenarios[]' && dataInventory.scenarios === 0) isMissing = true;
    else if (dep.field === 'riskItems[]' && dataInventory.riskItems === 0) isMissing = true;
    else if (dep.field === 'session.decisionStatement' && !data?.session?.decisionStatement) isMissing = true;
    else if (dep.field === 'session.dqScores' && !Object.keys(data?.session?.dqScores || {}).length) isMissing = true;

    if (isMissing) {
      if (dep.required) {
        missingRequired.push({ field: dep.field, source: dep.source, moduleLabel: sourceLabel });
      } else {
        missingOptional.push({ field: dep.field, source: dep.source, moduleLabel: sourceLabel });
      }
    }
  });

  // Add warnings
  if (missingOptional.length > 0) {
    warnings.push(`AI results will be less precise — complete ${missingOptional.map(m => m.moduleLabel).join(', ')} for better output`);
  }

  return {
    canProceed: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    warnings,
    dataInventory,
  };
}

// ── DATA INVENTORY BUILDER ────────────────────────────────────────────────────
// Builds the "This output is based on:" display
export function buildDataInventoryDisplay(data: any): string[] {
  const lines: string[] = [];
  if (data?.strategies?.length) lines.push(`${data.strategies.length} strateg${data.strategies.length > 1 ? 'ies' : 'y'} from Strategy Table`);
  if (data?.criteria?.length) lines.push(`${data.criteria.length} criteria from Decision Hierarchy`);
  if (data?.issues?.length) lines.push(`${data.issues.length} issues from Issue Generation`);
  if (data?.uncertainties?.length) lines.push(`${data.uncertainties.length} uncertainties from Scenario Planning`);
  if (data?.scenarios?.length) lines.push(`${data.scenarios.length} scenarios from Scenario Planning`);
  if (data?.riskItems?.length) lines.push(`${data.riskItems.length} risks from Risk Timeline`);
  if (data?.stakeholderEntries?.length) lines.push(`${data.stakeholderEntries.length} stakeholders from Stakeholder Alignment`);
  if (data?.assessmentScores?.length) lines.push(`${data.assessmentScores.length} assessment scores from Qualitative Assessment`);
  if (data?.session?.dqScores && Object.keys(data.session.dqScores).length) lines.push(`DQ scores from DQ Scorecard`);
  return lines;
}

// ── CONTRACT ENFORCEMENT PROMPT INJECTION ────────────────────────────────────
// Injects data contract rules into every AI prompt
export function buildContractPrompt(moduleId: string, data: any): string {
  const inv = buildDataInventoryDisplay(data);
  const strategies = data?.strategies || [];
  const criteria = data?.criteria || [];
  const uncertainties = data?.uncertainties || [];
  const scenarios = data?.scenarios || [];

  return `
DATA CONTRACT RULES (MUST FOLLOW):
- NEVER create new strategies — use ONLY the ${strategies.length} strategies from Strategy Table: ${strategies.map((s: any) => s.name).join(', ') || 'NONE DEFINED'}
- NEVER create new criteria — use ONLY the ${criteria.length} criteria from Decision Hierarchy: ${criteria.map((c: any) => c.label).join(', ') || 'NONE DEFINED'}
- NEVER create new uncertainties — use ONLY: ${uncertainties.map((u: any) => u.label).join(', ') || 'NONE DEFINED'}
- NEVER create new scenarios — use ONLY: ${scenarios.map((s: any) => s.name).join(', ') || 'NONE DEFINED'}
- Reference all entities by their EXACT names as provided above
- If a required entity is missing, say so explicitly rather than inventing

THIS OUTPUT IS BASED ON:
${inv.length ? inv.map(l => `- ${l}`).join('\n') : '- No upstream data available'}
`;
}

// ── FRAME QUALITY GATE ────────────────────────────────────────────────────────
// Minimum frame quality before AI-heavy modules activate
export function checkFrameGate(data: any): { passes: boolean; score: number; reason: string } {
  const s = data?.session || {};
  let score = 0;
  if (s.decisionStatement?.length > 30) score += 30;
  if (s.context?.length > 20) score += 20;
  if (s.deadline) score += 15;
  if (s.owner) score += 10;
  if (s.successCriteria?.length > 20) score += 15;
  if (s.constraints?.length > 10) score += 10;
  const passes = score >= 50;
  const reason = passes
    ? 'Frame quality sufficient for AI analysis'
    : 'Frame quality too low — add decision statement, context, and deadline before running AI';
  return { passes, score, reason };
}

// ── MECHANICAL RECOMMENDATION TRACEABILITY ────────────────────────────────────
// Derives recommendation mechanically from assessment scores — not AI narrative
export function computeMechanicalRecommendation(data: any): {
  recommendedStrategy: string | null;
  scores: Record<string, number>;
  confidence: 'High' | 'Medium' | 'Low';
  margin: number;
  traceable: boolean;
  traceability: string;
} {
  const strategies = data?.strategies || [];
  const criteria = data?.criteria || [];
  const assessmentScores = data?.assessmentScores || [];

  if (!strategies.length || !criteria.length || !assessmentScores.length) {
    return { recommendedStrategy: null, scores: {}, confidence: 'Low', margin: 0, traceable: false, traceability: 'Insufficient data — complete Strategy Table, Decision Hierarchy, and Qualitative Assessment first' };
  }

  const weightMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const scores: Record<string, number> = {};
  const maxPossible: Record<string, number> = {};

  strategies.forEach((s: any) => {
    scores[s.name] = 0;
    maxPossible[s.name] = 0;
  });

  criteria.forEach((c: any) => {
    const w = weightMap[c.weight] || 2;
    strategies.forEach((s: any) => {
      const score = assessmentScores.find((a: any) => a.strategyId === s.id && a.criterionId === c.id);
      scores[s.name] += (score?.score || 0) * w;
      maxPossible[s.name] += 5 * w;
    });
  });

  // Normalise to 0-100
  const normalised: Record<string, number> = {};
  strategies.forEach((s: any) => {
    normalised[s.name] = maxPossible[s.name] > 0 ? Math.round((scores[s.name] / maxPossible[s.name]) * 100) : 0;
  });

  const sorted = Object.entries(normalised).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1];
  const margin = top && second ? top[1] - second[1] : 0;
  const confidence = margin >= 15 ? 'High' : margin >= 5 ? 'Medium' : 'Low';

  const traceability = top
    ? top[0] + ' scores ' + top[1] + '/100 weighted across ' + criteria.length + ' criteria. ' +
      (second ? 'Runner-up: ' + second[0] + ' (' + second[1] + '/100). Margin: ' + margin + ' points.' : '')
    : 'Cannot compute';

  return { recommendedStrategy: top?.[0] || null, scores: normalised, confidence, margin, traceable: true, traceability };
}
