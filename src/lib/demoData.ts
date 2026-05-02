/**
 * Demo Data System
 * Provides a complete offline demo experience when the backend is unavailable.
 * All data is stored in localStorage and mutations update it directly.
 */

import type { ModuleData } from '@/types';

// ============================================================================
// FULL APAC MARKET ENTRY DEMO SESSION
// ============================================================================

export const DEMO_SESSION = {
  id: 1,
  slug: 'demo-apac-entry',
  name: 'APAC Market Entry Strategy (Demo)',
  decisionStatement: 'Which market entry strategy maximises our risk-adjusted NPV for APAC expansion within a $25M Year 1 capital constraint?',
  context: 'US-based B2B SaaS company, $180M ARR, zero APAC presence. Competitors already in Singapore and Tokyo. Board has mandated APAC entry by Q3 2026. Target: first paying customer within 12 months.',
  background: 'Company founded 2018, Series D completed Q4 2025 ($45M raised). Core product: enterprise workflow automation platform. 340 employees, primarily US-based. No international operations. Two competitors (TechFlow Asia, ProcessMax) announced APAC expansion in early 2026.',
  trigger: 'Board strategy meeting Q1 2026: competitors entering APAC, revenue growth slowing in domestic market (12% vs 35% YoY).',
  symptoms: 'Domestic market share plateauing at 18%, competitor win rates increasing, investor pressure for international growth narrative.',
  rootDecision: 'How to structure APAC market entry given capital constraints and competitive timeline',
  scopeIn: 'Market selection (Singapore, Japan, Australia), entry mode (direct, partnership, acquisition), technology localisation, initial team structure, Year 1 go-to-market plan',
  scopeOut: 'Long-term organisational structure, brand strategy, non-APAC markets, product feature development beyond localisation',
  timeHorizon: '12 months to first revenue, 3-year investment horizon',
  deadline: 'Board review: July 2026; Capital deployment: August 2026',
  constraints: 'HARD: $25M Year 1 capital ceiling (Board resolution), 12-month first revenue target, Japan data centre requirement (PII law), maintain positive cash flow. SOFT: Preserve strategic flexibility, minimise cultural disruption, avoid exclusive partnerships, <30% of company headcount in region.',
  assumptions: 'APAC TAM of $2.8B growing at 18% CAGR, English acceptable for initial Singapore sales, partnership options available in all 3 markets, no major regulatory changes expected',
  successCriteria: 'Year 1: 3+ paying customers, $500K ARR. Year 3: $15M ARR, 15% market share in primary market, positive unit economics, viable path to $50M+ APAC revenue.',
  failureConsequences: '3-year revenue gap of $40M+, competitor entrenchment becomes irreversible, investor confidence decline, talent retention risk if growth story weakens.',
  sector: 'technology',
  decisionType: 'strategic',
  dqScores: { frame: 85, alternatives: 70, information: 55, values: 75, reasoning: 60, commitment: 40 },
  status: 'active',
  createdBy: 1,
  createdAt: new Date('2026-04-01').toISOString(),
  updatedAt: new Date('2026-05-02').toISOString(),
};

export const DEMO_ISSUES = [
  { id: 1, sessionId: 1, text: 'Competitors (TechFlow Asia, ProcessMax) already entrenched in Singapore and Tokyo with 18-month head start', category: 'uncertainty-external', severity: 'Critical', status: 'open', votes: 5, sortOrder: 0 },
  { id: 2, sessionId: 1, text: 'Local data residency requirements in Japan may force complete architecture redesign — 4-6 month delay', category: 'regulatory-trap', severity: 'Critical', status: 'open', votes: 4, sortOrder: 1 },
  { id: 3, sessionId: 1, text: 'Partnership model preserves capital but reduces operational control and customer relationship ownership', category: 'stakeholder-concern', severity: 'High', status: 'open', votes: 3, sortOrder: 2 },
  { id: 4, sessionId: 1, text: 'Team has zero APAC go-to-market experience — hiring risk is existential', category: 'assumption', severity: 'Critical', status: 'open', votes: 5, sortOrder: 3 },
  { id: 5, sessionId: 1, text: 'Regulatory approval timeline in Japan is completely unknown — could be 3 months or 18 months', category: 'information-gap', severity: 'High', status: 'open', votes: 3, sortOrder: 4 },
  { id: 6, sessionId: 1, text: 'APAC TAM may be significantly larger than current $2.8B estimate — upside not captured in models', category: 'opportunity', severity: 'Medium', status: 'open', votes: 1, sortOrder: 5 },
  { id: 7, sessionId: 1, text: '$25M capital ceiling is non-negotiable — Board resolution, no flexibility', category: 'constraint', severity: 'High', status: 'open', votes: 2, sortOrder: 6 },
  { id: 8, sessionId: 1, text: 'If we wait 12 months, competitive position in Singapore becomes uncatchable — TechFlow locking in enterprise clients', category: 'brutal-truth', severity: 'Critical', status: 'open', votes: 5, sortOrder: 7 },
  { id: 9, sessionId: 1, text: 'Hidden regulatory requirement for local data centre in Indonesia if we expand beyond initial 3 markets', category: 'regulatory-trap', severity: 'High', status: 'open', votes: 2, sortOrder: 8 },
  { id: 10, sessionId: 1, text: 'Partner default could trigger reputational damage in domestic market — customers may question our execution capability', category: 'second-order', severity: 'Medium', status: 'open', votes: 1, sortOrder: 9 },
  { id: 11, sessionId: 1, text: 'Currency hedging costs not factored — AUD and JPY volatility could erode 8-15% of returns', category: 'uncertainty-internal', severity: 'Medium', status: 'open', votes: 2, sortOrder: 10 },
  { id: 12, sessionId: 1, text: 'Singapore government grants for tech entrants could offset $2-3M of setup costs — not in current financial model', category: 'option-forgotten', severity: 'Low', status: 'open', votes: 0, sortOrder: 11 },
];

export const DEMO_DECISIONS = [
  { id: 1, sessionId: 1, label: 'Proceed with APAC expansion', choices: ['Yes — board mandate confirmed'], tier: 'given', owner: 'Board', rationale: 'Board-approved in FY26 strategic plan, non-negotiable', sortOrder: 0 },
  { id: 2, sessionId: 1, label: 'Maximum Year 1 capital budget', choices: ['$25M ceiling — Board resolution'], tier: 'given', owner: 'CFO', rationale: 'Hard constraint from Board, includes contingency', sortOrder: 1 },
  { id: 3, sessionId: 1, label: 'Market Entry Mode', choices: ['Direct subsidiary', 'Strategic partnership', 'Acquire local player', 'Agent / reseller network'], tier: 'focus', owner: 'CSO', rationale: 'Most consequential variable — affects capital, control, speed, risk', sortOrder: 2 },
  { id: 4, sessionId: 1, label: 'Geographic Priority — First Market', choices: ['Singapore first', 'Japan first', 'Australia first', 'Multi-market simultaneous'], tier: 'focus', owner: 'CEO', rationale: 'Sets operational blueprint and resource allocation', sortOrder: 3 },
  { id: 5, sessionId: 1, label: 'Investment Level Year 1', choices: ['$10M conservative (partner-heavy)', '$18M balanced', '$25M aggressive full build (cap)'], tier: 'focus', owner: 'CFO', rationale: 'Choices within board-set ceiling with different risk profiles', sortOrder: 4 },
  { id: 6, sessionId: 1, label: 'Technology Localisation Approach', choices: ['Build in-house APAC engineering', 'License localised platform', 'Partner with regional SaaS integrator'], tier: 'focus', owner: 'CTO', rationale: 'Critical path for 12-month revenue target', sortOrder: 5 },
  { id: 7, sessionId: 1, label: 'Initial Team Structure', choices: ['Hub model (Singapore HQ, remote sales)', 'Distributed (local offices in each market)', 'Virtual + partner GTM'], tier: 'focus', owner: 'COO', rationale: 'Affects speed, cost, and cultural integration', sortOrder: 6 },
  { id: 8, sessionId: 1, label: 'Long-term Ownership Model', choices: ['Wholly-owned subsidiary', 'Joint venture 50/50', 'Majority-owned JV (70/30)'], tier: 'deferred', owner: 'Legal', rationale: 'Depends on entry mode chosen — decide by Month 9', sortOrder: 7 },
  { id: 9, sessionId: 1, label: 'Brand Strategy in APAC', choices: ['Global brand consistency', 'Co-brand with local partner', 'Standalone local brand'], tier: 'deferred', owner: 'CMO', rationale: 'Flows from partnership model and market positioning', sortOrder: 8 },
];

export const DEMO_STRATEGIES = [
  { id: 1, sessionId: 1, name: 'Alpha — Full Commitment', description: 'Maximum control, maximum capital. Direct subsidiary in Singapore with in-house engineering. Fastest path to product-market fit but highest burn.', colorIdx: 0, selections: { '3': 0, '4': 0, '5': 2, '6': 0, '7': 1 } },
  { id: 2, sessionId: 1, name: 'Beta — Balanced Partnership', description: 'Strategic partnership model with regional SaaS integrator. Balanced risk and speed. Lower capital requirement preserves optionality.', colorIdx: 1, selections: { '3': 1, '4': 0, '5': 1, '6': 2, '7': 2 } },
  { id: 3, sessionId: 1, name: 'Gamma — Asset-Light Entry', description: 'Agent/reseller network with minimal local presence. Lowest capital, slowest growth. Test market demand before committing resources.', colorIdx: 2, selections: { '3': 3, '4': 0, '5': 0, '6': 1, '7': 2 } },
];

export const DEMO_CRITERIA = [
  { id: 1, sessionId: 1, label: 'Risk-adjusted NPV (3-year)', type: 'financial', weight: 'critical', sortOrder: 0 },
  { id: 2, sessionId: 1, label: 'Time to first revenue', type: 'financial', weight: 'critical', sortOrder: 1 },
  { id: 3, sessionId: 1, label: 'Capital efficiency (ROI/$)', type: 'financial', weight: 'critical', sortOrder: 2 },
  { id: 4, sessionId: 1, label: 'Strategic flexibility / optionality', type: 'strategic', weight: 'high', sortOrder: 3 },
  { id: 5, sessionId: 1, label: 'Competitive positioning strength', type: 'strategic', weight: 'high', sortOrder: 4 },
  { id: 6, sessionId: 1, label: 'Execution complexity', type: 'operational', weight: 'medium', sortOrder: 5 },
  { id: 7, sessionId: 1, label: 'Regulatory risk exposure', type: 'risk', weight: 'critical', sortOrder: 6 },
  { id: 8, sessionId: 1, label: 'Stakeholder alignment ease', type: 'strategic', weight: 'medium', sortOrder: 7 },
];

export const DEMO_ASSESSMENT_SCORES = [
  { id: 1, sessionId: 1, strategyId: 1, criterionId: 1, score: 4 },
  { id: 2, sessionId: 1, strategyId: 1, criterionId: 2, score: 5 },
  { id: 3, sessionId: 1, strategyId: 1, criterionId: 3, score: 3 },
  { id: 4, sessionId: 1, strategyId: 1, criterionId: 4, score: 3 },
  { id: 5, sessionId: 1, strategyId: 1, criterionId: 5, score: 5 },
  { id: 6, sessionId: 1, strategyId: 1, criterionId: 6, score: 2 },
  { id: 7, sessionId: 1, strategyId: 1, criterionId: 7, score: 4 },
  { id: 8, sessionId: 1, strategyId: 1, criterionId: 8, score: 3 },
  { id: 9, sessionId: 1, strategyId: 2, criterionId: 1, score: 5 },
  { id: 10, sessionId: 1, strategyId: 2, criterionId: 2, score: 4 },
  { id: 11, sessionId: 1, strategyId: 2, criterionId: 3, score: 5 },
  { id: 12, sessionId: 1, strategyId: 2, criterionId: 4, score: 5 },
  { id: 13, sessionId: 1, strategyId: 2, criterionId: 5, score: 3 },
  { id: 14, sessionId: 1, strategyId: 2, criterionId: 6, score: 4 },
  { id: 15, sessionId: 1, strategyId: 2, criterionId: 7, score: 4 },
  { id: 16, sessionId: 1, strategyId: 2, criterionId: 8, score: 4 },
  { id: 17, sessionId: 1, strategyId: 3, criterionId: 1, score: 3 },
  { id: 18, sessionId: 1, strategyId: 3, criterionId: 2, score: 2 },
  { id: 19, sessionId: 1, strategyId: 3, criterionId: 3, score: 5 },
  { id: 20, sessionId: 1, strategyId: 3, criterionId: 4, score: 4 },
  { id: 21, sessionId: 1, strategyId: 3, criterionId: 5, score: 2 },
  { id: 22, sessionId: 1, strategyId: 3, criterionId: 6, score: 5 },
  { id: 23, sessionId: 1, strategyId: 3, criterionId: 7, score: 5 },
  { id: 24, sessionId: 1, strategyId: 3, criterionId: 8, score: 5 },
];

export const DEMO_STAKEHOLDERS = [
  { id: 1, sessionId: 1, name: 'CEO', role: 'Chief Executive Officer', influence: 95, interest: 90, alignment: 'supportive', concerns: 'Speed of execution and maintaining board confidence' },
  { id: 2, sessionId: 1, name: 'CFO', role: 'Chief Financial Officer', influence: 90, interest: 95, alignment: 'cautious', concerns: 'ROI timeline, capital efficiency, FX exposure on $25M' },
  { id: 3, sessionId: 1, name: 'CSO', role: 'Chief Strategy Officer', influence: 75, interest: 95, alignment: 'supportive', concerns: 'Market timing and competitive response speed' },
  { id: 4, sessionId: 1, name: 'CTO', role: 'Chief Technology Officer', influence: 70, interest: 70, alignment: 'neutral', concerns: 'Technical integration complexity, hiring APAC engineering talent' },
  { id: 5, sessionId: 1, name: 'General Counsel', role: 'Legal & Compliance', influence: 65, interest: 80, alignment: 'concerned', concerns: 'Japan data residency, regulatory risk, IP protection in partnerships' },
  { id: 6, sessionId: 1, name: 'Board of Directors', role: 'Governance', influence: 98, interest: 85, alignment: 'supportive', concerns: 'Strategic alignment, risk oversight, investor narrative' },
  { id: 7, sessionId: 1, name: 'Regional GM APAC', role: 'Operations Lead (to be hired)', influence: 60, interest: 90, alignment: 'supportive', concerns: 'Local talent availability, execution bandwidth, cultural integration' },
  { id: 8, sessionId: 1, name: 'Head of Sales', role: 'Revenue Owner', influence: 55, interest: 75, alignment: 'neutral', concerns: 'Sales cycle length in APAC, pricing model adaptation, partner GTM quality' },
];

export const DEMO_UNCERTAINTIES = [
  { id: 1, sessionId: 1, label: 'APAC market growth rate (estimated 18% CAGR)', type: 'Market', impact: 'Critical', control: 'None', description: 'Actual TAM growth may differ significantly from analyst estimates' },
  { id: 2, sessionId: 1, label: 'Japan regulatory approval timeline', type: 'Regulatory', impact: 'Critical', control: 'Low', description: 'Unknown approval process for foreign tech companies — range 3-18 months' },
  { id: 3, sessionId: 1, label: 'Strategic partner reliability and commitment', type: 'Operational', impact: 'High', control: 'Some', description: 'Partner may not deliver on GTM commitments or technical integration' },
  { id: 4, sessionId: 1, label: 'Currency volatility (AUD, JPY, SGD)', type: 'Financial', impact: 'Medium', control: 'Some', description: 'FX exposure on $25M capital deployment — hedging costs 2-4%' },
  { id: 5, sessionId: 1, label: 'Competitor response timing and intensity', type: 'Competitive', impact: 'Critical', control: 'None', description: 'Incumbents may accelerate expansion, cut prices, or lock in enterprise clients' },
  { id: 6, sessionId: 1, label: 'Technical integration complexity', type: 'Technical', impact: 'High', control: 'High', description: 'Localisation effort may exceed 6-month estimate — data residency, language, compliance' },
  { id: 7, sessionId: 1, label: 'Talent acquisition in APAC markets', type: 'Operational', impact: 'High', control: 'Medium', description: 'Local sales and engineering talent availability and cost uncertainty' },
];

export const DEMO_RISKS = [
  { id: 1, sessionId: 1, label: 'Regulatory rejection or extended delay in Japan', likelihood: 'Medium', impact: 'Critical', timeframe: 'Months 3-6', owner: 'General Counsel', mitigation: 'Engage regulatory consultant by Week 2. Pre-submission meeting with authorities. Parallel-track Singapore entry as hedge.' },
  { id: 2, sessionId: 1, label: 'Strategic partner fails to deliver on commitments', likelihood: 'Medium', impact: 'High', timeframe: 'Months 6-12', owner: 'CSO', mitigation: 'Contractual milestones with exit clauses. Monthly performance reviews. Retain direct customer relationships.' },
  { id: 3, sessionId: 1, label: 'FX volatility erodes 8-15% of returns', likelihood: 'High', impact: 'Medium', timeframe: 'Months 1-18', owner: 'CFO', mitigation: 'Hedge 70% of committed capital. Quarterly rebalancing. USD-denominated contracts where possible.' },
  { id: 4, sessionId: 1, label: 'Competitor initiates price war in Singapore', likelihood: 'Low', impact: 'High', timeframe: 'Months 12-24', owner: 'CEO', mitigation: 'Differentiate on service quality and integration depth. Avoid commodity positioning. Lock enterprise clients early.' },
  { id: 5, sessionId: 1, label: 'Key talent acquisition failure — APAC GM or sales lead', likelihood: 'Medium', impact: 'High', timeframe: 'Months 3-6', owner: 'COO', mitigation: 'Use executive search firm with APAC network. Consider internal transfer + local deputy model. Partner GTM as fallback.' },
  { id: 6, sessionId: 1, label: 'Technical integration exceeds 6-month estimate', likelihood: 'High', impact: 'Medium', timeframe: 'Months 3-9', owner: 'CTO', mitigation: 'Architecture review before commit. Phased rollout: Singapore (simplest) first. Partner with local integration specialist.' },
];

export const DEMO_SCENARIOS = [
  { id: 1, sessionId: 1, name: 'Bull Case — Rapid Adoption', description: 'APAC markets embrace solution faster than forecast. Strong partnerships, limited competitive response, favourable regulatory.', probability: 0.2, drivers: ['Low competitive response', 'Strong partner execution', 'Favourable regulatory timeline', 'Currency tailwinds'], color: '#059669' },
  { id: 2, sessionId: 1, name: 'Base Case — Measured Growth', description: 'Steady market entry with moderate competitive pressure. Partnership model delivers as planned. First revenue Month 8.', probability: 0.55, drivers: ['Moderate competition', 'On-time partner delivery', 'Stable FX', 'Regulatory approval Month 6'], color: '#2563EB' },
  { id: 3, sessionId: 1, name: 'Bear Case — Stalled Entry', description: 'Regulatory delays, strong competitive response, partner underperformance. First revenue pushed to Month 14+. ', probability: 0.25, drivers: ['Aggressive competition', 'Regulatory delays', 'Partner issues', 'Currency headwinds'], color: '#DC2626' },
];

export const DEMO_VOI = [
  { id: 1, sessionId: 1, name: 'APAC Market Research Study (McKinsey/BCG)', priorProbability: 0.18, valueWithInfo: 45, valueWithoutInfo: 25, costOfInfo: 3, voiResult: 14.2 },
  { id: 2, sessionId: 1, name: 'Japan Regulatory Consultation (local firm)', priorProbability: 0.5, valueWithInfo: 30, valueWithoutInfo: 15, costOfInfo: 1.5, voiResult: 12.0 },
  { id: 3, sessionId: 1, name: 'Partner Due Diligence (financial + operational)', priorProbability: 0.4, valueWithInfo: 35, valueWithoutInfo: 20, costOfInfo: 1, voiResult: 12.8 },
];

// ============================================================================
// localStorage Manager
// ============================================================================

const STORAGE_KEY = 'vantage_dq_demo_sessions';
const DEMO_USER_KEY = 'vantage_dq_demo_user';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function getDemoUser(): DemoUser {
  const stored = localStorage.getItem(DEMO_USER_KEY);
  if (stored) return JSON.parse(stored);
  const user: DemoUser = { id: 'demo-user-1', name: 'Demo Executive', email: 'demo@vantage.dq', role: 'admin' };
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  return user;
}

export function isDemoMode(): boolean {
  return localStorage.getItem('vantage_dq_demo_mode') === 'true';
}

export function enableDemoMode(): void {
  localStorage.setItem('vantage_dq_demo_mode', 'true');
  initializeDemoData();
}

export function initializeDemoData(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: [DEMO_SESSION],
      issues: DEMO_ISSUES,
      decisions: DEMO_DECISIONS,
      strategies: DEMO_STRATEGIES,
      criteria: DEMO_CRITERIA,
      assessmentScores: DEMO_ASSESSMENT_SCORES,
      uncertainties: DEMO_UNCERTAINTIES,
      stakeholderEntries: DEMO_STAKEHOLDERS,
      riskItems: DEMO_RISKS,
      scenarios: DEMO_SCENARIOS,
      voiAnalyses: DEMO_VOI,
    }));
  }
}


export function initializeEmptySession(name: string = 'New Decision Session', owner: string = ''): void {
  // Always wipe storage so no demo data bleeds in
  localStorage.removeItem('vantage_dq_demo_sessions');
  const emptySession = {
    id: 1,
    slug: 'demo-apac-entry',
    name: name || 'New Decision Session',
    decisionStatement: '',
    context: '',
    background: '',
    trigger: '',
    owner: owner || '',
    deadline: '',
    scopeIn: '',
    scopeOut: '',
    constraints: '',
    assumptions: '',
    successCriteria: '',
    dqScores: {},
  };
  localStorage.setItem('vantage_dq_demo_sessions', JSON.stringify({
    sessions: [emptySession],
    issues: [],
    decisions: [],
    strategies: [],
    criteria: [],
    assessmentScores: [],
    uncertainties: [],
    stakeholderEntries: [],
    riskItems: [],
    scenarios: [],
    voiAnalyses: [],
  }));
}

export function getDemoData(): ModuleData {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  // If the stored session has no decisionStatement, it's an empty session — don't fall back to demo data
  const isEmptySession = stored.sessions?.[0] && !stored.sessions[0].decisionStatement;
  return {
    session: stored.sessions?.[0] || DEMO_SESSION,
    issues: stored.issues ?? (isEmptySession ? [] : DEMO_ISSUES),
    decisions: stored.decisions ?? (isEmptySession ? [] : DEMO_DECISIONS),
    strategies: stored.strategies ?? (isEmptySession ? [] : DEMO_STRATEGIES),
    criteria: stored.criteria ?? (isEmptySession ? [] : DEMO_CRITERIA),
    assessmentScores: stored.assessmentScores ?? (isEmptySession ? [] : DEMO_ASSESSMENT_SCORES),
    uncertainties: stored.uncertainties ?? (isEmptySession ? [] : DEMO_UNCERTAINTIES),
    stakeholderEntries: stored.stakeholderEntries ?? (isEmptySession ? [] : DEMO_STAKEHOLDERS),
    riskItems: stored.riskItems ?? (isEmptySession ? [] : DEMO_RISKS),
    scenarios: stored.scenarios ?? (isEmptySession ? [] : DEMO_SCENARIOS),
    voiAnalyses: stored.voiAnalyses ?? (isEmptySession ? [] : DEMO_VOI),
    gameTheoryModels: [],
    aiSuggestions: [],
  };
}

export function updateDemoData(updater: (data: any) => void): void {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  updater(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ============================================================================
// Demo API (replaces tRPC calls in demo mode)
// ============================================================================

export const demoApi = {
  // Session
  loadSession: (slug: string) => {
    const data = getDemoData();
    return { ...data, slug };
  },

  listSessions: () => {
    const data = getDemoData();
    return [data.session];
  },

  createSession: (input: { name: string; decisionStatement: string; context?: string }) => {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const newSession = {
      id: Date.now(),
      slug: `session-${Date.now()}`,
      name: input.name,
      decisionStatement: input.decisionStatement,
      context: input.context || '',
      dqScores: {},
      status: 'draft',
      createdBy: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessions.sessions = [newSession];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return { id: newSession.id, slug: newSession.slug };
  },

  updateSession: (input: { id: number; data: Record<string, any> }) => {
    updateDemoData(d => {
      if (d.sessions) {
        const s = d.sessions.find((s: any) => s.id === input.id);
        if (s) Object.assign(s, input.data, { updatedAt: new Date().toISOString() });
      }
    });
    return { success: true };
  },

  // Issues
  createIssue: (input: { sessionId: number; text: string; category?: string; severity?: string }) => {
    updateDemoData(d => {
      d.issues = d.issues || [];
      d.issues.unshift({
        id: Date.now(), sessionId: input.sessionId,
        text: input.text, category: input.category || 'uncertainty-external',
        severity: input.severity || 'Medium', status: 'open', votes: 0, sortOrder: 0,
      });
    });
    return { id: Date.now() };
  },

  deleteIssue: (input: { id: number }) => {
    updateDemoData(d => { d.issues = (d.issues || []).filter((i: any) => i.id !== input.id); });
    return { success: true };
  },

  voteIssue: (input: { id: number }) => {
    updateDemoData(d => {
      const issue = (d.issues || []).find((i: any) => i.id === input.id);
      if (issue) issue.votes = (issue.votes || 0) + 1;
    });
    return { success: true };
  },

  // Decisions
  createDecision: (input: { sessionId: number; label: string; choices?: string[]; tier?: string }) => {
    updateDemoData(d => {
      d.decisions = d.decisions || [];
      d.decisions.push({
        id: Date.now(), sessionId: input.sessionId,
        label: input.label, choices: input.choices || ['Option A', 'Option B'],
        tier: input.tier || 'focus', owner: '', rationale: '', sortOrder: d.decisions.length,
      });
    });
    return { id: Date.now() };
  },

  deleteDecision: (input: { id: number }) => {
    updateDemoData(d => { d.decisions = (d.decisions || []).filter((x: any) => x.id !== input.id); });
    return { success: true };
  },

  // Criteria
  createCriterion: (input: { sessionId: number; label: string; type?: string; weight?: string }) => {
    updateDemoData(d => {
      d.criteria = d.criteria || [];
      d.criteria.push({
        id: Date.now(), sessionId: input.sessionId,
        label: input.label, type: input.type || 'strategic', weight: input.weight || 'medium', sortOrder: d.criteria.length,
      });
    });
    return { id: Date.now() };
  },

  deleteCriterion: (input: { id: number }) => {
    updateDemoData(d => { d.criteria = (d.criteria || []).filter((x: any) => x.id !== input.id); });
    return { success: true };
  },

  // Scores
  setScore: (input: { sessionId: number; strategyId: number; criterionId: number; score: number }) => {
    updateDemoData(d => {
      d.assessmentScores = d.assessmentScores || [];
      const existing = d.assessmentScores.find((s: any) => s.strategyId === input.strategyId && s.criterionId === input.criterionId);
      if (existing) existing.score = input.score;
      else d.assessmentScores.push({ id: Date.now(), sessionId: input.sessionId, strategyId: input.strategyId, criterionId: input.criterionId, score: input.score });
    });
    return { success: true };
  },

  // Strategies
  createStrategy: (input: { sessionId: number; name: string; description?: string }) => {
    updateDemoData(d => {
      d.strategies = d.strategies || [];
      d.strategies.push({
        id: Date.now(), sessionId: input.sessionId,
        name: input.name, description: input.description || '',
        colorIdx: (d.strategies.length) % 6, selections: {},
      });
    });
    return { id: Date.now() };
  },

  deleteStrategy: (input: { id: number }) => {
    updateDemoData(d => { d.strategies = (d.strategies || []).filter((x: any) => x.id !== input.id); });
    return { success: true };
  },

  // Uncertainties
  createUncertainty: (input: { sessionId: number; label: string; type?: string; impact?: string }) => {
    updateDemoData(d => {
      d.uncertainties = d.uncertainties || [];
      d.uncertainties.push({
        id: Date.now(), sessionId: input.sessionId,
        label: input.label, type: input.type || 'Market', impact: input.impact || 'High', control: 'Some', description: '',
      });
    });
    return { id: Date.now() };
  },

  deleteUncertainty: (input: { id: number }) => {
    updateDemoData(d => { d.uncertainties = (d.uncertainties || []).filter((x: any) => x.id !== input.id); });
    return { success: true };
  },

  // Stakeholders
  createStakeholder: (input: { sessionId: number; name: string; role?: string }) => {
    updateDemoData(d => {
      d.stakeholderEntries = d.stakeholderEntries || [];
      d.stakeholderEntries.push({
        id: Date.now(), sessionId: input.sessionId,
        name: input.name, role: input.role || '', influence: 50, interest: 50, alignment: 'neutral', concerns: '',
      });
    });
    return { id: Date.now() };
  },

  deleteStakeholder: (input: { id: number }) => {
    updateDemoData(d => { d.stakeholderEntries = (d.stakeholderEntries || []).filter((x: any) => x.id !== input.id); });
    return { success: true };
  },

  // Risks
  createRisk: (input: { sessionId: number; label: string; likelihood?: string; impact?: string }) => {
    updateDemoData(d => {
      d.riskItems = d.riskItems || [];
      d.riskItems.push({
        id: Date.now(), sessionId: input.sessionId,
        label: input.label, likelihood: input.likelihood || 'Medium', impact: input.impact || 'High', timeframe: '', owner: '', mitigation: '',
      });
    });
    return { id: Date.now() };
  },

  deleteRisk: (input: { id: number }) => {
    updateDemoData(d => { d.riskItems = (d.riskItems || []).filter((x: any) => x.id !== input.id); });
    return { success: true };
  },

  // AI Analysis
  analyse: (input: { sessionId: number; module: string }) => {
    const data = getDemoData();
    let result: any = { overallScore: 50, confidence: 60, checks: [], recommendations: [], summary: 'Analysis not available in demo mode.' };

    switch (input.module) {
      case 'problem':
        result = {
          overallScore: 85, confidence: 90,
          checks: [
            { name: 'Decision Statement Defined', pass: true, score: 95 },
            { name: 'Genuine Open Question', pass: true, score: 90 },
            { name: 'Context Provided', pass: true, score: 88 },
            { name: 'Constraints Explicit', pass: true, score: 92 },
            { name: 'Scope Defined', pass: true, score: 85 },
            { name: 'Failure Consequences', pass: true, score: 80 },
            { name: 'Success Criteria', pass: true, score: 85 },
            { name: 'Trigger Identified', pass: true, score: 90 },
          ],
          recommendations: [
            { dimension: 'Time Horizon', advice: 'Consider adding specific milestone dates to the 12-month timeline for better tracking.', priority: 'suggested' },
          ],
          summary: 'Strong problem frame: 8/8 checks passed. Decision statement is a genuine open question with clear constraints and scope.',
        };
        break;
      case 'issue':
        result = {
          overallScore: 78, confidence: 85,
          checks: [
            { name: 'Minimum Issues (5+)', pass: true, score: 100 },
            { name: 'Critical Issues', pass: true, score: 100 },
            { name: 'Category Coverage', pass: true, score: 83 },
            { name: 'Severity Balance', pass: true, score: 80 },
            { name: 'Competitive Awareness', pass: true, score: 100 },
          ],
          recommendations: [
            { dimension: 'Option Forgotten', advice: 'Only 1 issue in "option-forgotten" category. Consider: what opportunities or alternatives have we not explored?', priority: 'suggested' },
          ],
          summary: '12 issues across 10 categories: 4 Critical, 3 High severity. Strong competitive and regulatory awareness.',
        };
        break;
      case 'hierarchy':
        const focusCount = data.decisions?.filter((d: any) => d.tier === 'focus').length;
        result = {
          overallScore: focusCount <= 5 ? 88 : 65, confidence: 85,
          checks: [
            { name: 'Focus Five Limit', pass: focusCount <= 5, score: focusCount <= 5 ? 100 : 60 },
            { name: 'Given Decisions', pass: true, score: 100 },
            { name: 'Deferred Decisions', pass: true, score: 90 },
            { name: 'Choices Defined', pass: true, score: 85 },
            { name: 'Owners Assigned', pass: true, score: 90 },
          ],
          recommendations: focusCount > 5
            ? [{ dimension: 'Focus Five', advice: `${focusCount} focus decisions — limit to 5. Move least critical to Deferred.`, priority: 'critical' }]
            : [{ dimension: 'Decision Owners', advice: 'All focus decisions have owners assigned. Good accountability.', priority: 'suggested' }],
          summary: `${data.decisions.length} decisions: well-structured hierarchy with clear given/focus/deferred separation.`,
        };
        break;
      case 'scorecard':
        const scores = data.session?.dqScores || {};
        const vals = Object.values(scores) as number[];
        const overall = vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0;
        const minKey = Object.keys(scores).reduce((a, b) => (scores[a] || 0) < (scores[b] || 0) ? a : b, 'frame');
        result = {
          overallScore: overall, confidence: 90,
          checks: Object.entries(scores).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), pass: (v as number) > 0, score: v as number })),
          recommendations: (scores[minKey] || 0) < 45
            ? [{ dimension: minKey, advice: `Score of ${scores[minKey]} on ${minKey} — weakest element. Priority for improvement.`, priority: 'critical' }]
            : [{ dimension: 'Overall', advice: `Overall DQ score ${overall}. Solid foundation across all elements.`, priority: 'suggested' }],
          summary: `Overall DQ: ${overall}/100. Weakest: ${minKey} (${scores[minKey] || 0}). Strongest element drives decision quality ceiling.`,
        };
        break;
      default:
        result = {
          overallScore: 70, confidence: 75,
          checks: [{ name: 'Data Available', pass: true, score: 70 }],
          recommendations: [{ dimension: 'General', advice: 'Demo analysis available. Connect backend for full module-specific analysis.', priority: 'suggested' }],
          summary: `Demo analysis for ${input.module} module. Full rule-based analysis available when backend is connected.`,
        };
    }

    // Store as suggestion
    updateDemoData(d => {
      d.aiSuggestions = d.aiSuggestions || [];
      d.aiSuggestions.unshift({
        id: Date.now(), sessionId: input.sessionId, module: input.module,
        content: JSON.stringify(result), status: 'pending', confidence: result.confidence,
        createdAt: new Date().toISOString(),
      });
    });

    return { content: JSON.stringify(result), summary: result.summary };
  },

  listAISuggestions: (input: { sessionId: number; module?: string }) => {
    const data = getDemoData();
    let suggestions = data.aiSuggestions || [];
    if (input.module) suggestions = suggestions.filter((s: any) => s.module === input.module);
    return suggestions;
  },

  acceptAISuggestion: (input: { id: number }) => {
    updateDemoData(d => {
      const s = (d.aiSuggestions || []).find((x: any) => x.id === input.id);
      if (s) { s.status = 'accepted'; s.reviewedAt = new Date().toISOString(); }
    });
    return { success: true };
  },

  createScenario: (input: any) => { return { id: Date.now(), ...input }; },
  deleteScenario: (input: any) => { return { success: true }; },
  createVOI: (input: any) => { return { id: Date.now(), ...input }; },
  deleteVOI: (input: any) => { return { success: true }; },
  rejectAISuggestion: (input: { id: number }) => {
    updateDemoData(d => {
      const s = (d.aiSuggestions || []).find((x: any) => x.id === input.id);
      if (s) { s.status = 'rejected'; s.reviewedAt = new Date().toISOString(); }
    });
    return { success: true };
  },
};
