import type { NavModule } from '@/types';

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;

// ============================================
// VANTAGE DQ DESIGN SYSTEM
// Rich executive palette: deep navy + gold accent
// ============================================
export const DS = {
  // Brand
  brand: '#0B1D3A',
  brandLight: '#132B4F',
  accent: '#C9A84C',
  accentLight: '#E8D69B',
  accentSoft: '#FDF8E8',

  // Backgrounds
  bg: '#F8F9FC',
  bgWarm: '#F5F3EF',
  canvas: '#FFFFFF',
  canvasHover: '#FAFBFF',

  // Borders
  border: '#E2E5EC',
  borderLight: '#EDEEF2',

  // Text
  ink: '#0F172A',
  inkSub: '#334155',
  inkTer: '#64748B',
  inkDis: '#94A3B8',
  inkFaint: '#CBD5E1',

  // DQ Elements — each has a distinct rich color
  frame: { fill: '#3B82F6', soft: '#EFF6FF', line: '#BFDBFE', dark: '#1D4ED8', text: '#2563EB' },
  alternatives: { fill: '#0D9488', soft: '#F0FDFA', line: '#99F6E4', dark: '#0F766E', text: '#115E59' },
  information: { fill: '#10B981', soft: '#ECFDF5', line: '#A7F3D0', dark: '#047857', text: '#065F46' },
  values: { fill: '#D97706', soft: '#FFFBEB', line: '#FDE68A', dark: '#B45309', text: '#92400E' },
  reasoning: { fill: '#6366F1', soft: '#EEF2FF', line: '#C7D2FE', dark: '#4338CA', text: '#3730A3' },
  commitment: { fill: '#E11D48', soft: '#FFF1F2', line: '#FECDD3', dark: '#BE123C', text: '#9F1239' },

  // Status
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warnSoft: '#FEF3C7',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',

  // Chrome
  chrome: '#0B1D3A',
  chromeSub: '#132B4F',
  chromeMid: '#1E3A5F',
  textPri: '#F8FAFC',
  textSec: '#94A3B8',

  // Strategy colors
  sColors: [
    { fill: '#3B82F6', soft: '#EFF6FF', line: '#BFDBFE', dark: '#1D4ED8' },
    { fill: '#0D9488', soft: '#F0FDFA', line: '#99F6E4', dark: '#0F766E' },
    { fill: '#D97706', soft: '#FFFBEB', line: '#FDE68A', dark: '#B45309' },
    { fill: '#7C3AED', soft: '#F5F3FF', line: '#DDD6FE', dark: '#6D28D9' },
    { fill: '#E11D48', soft: '#FFF1F2', line: '#FECDD3', dark: '#BE123C' },
    { fill: '#0891B2', soft: '#ECFEFF', line: '#A5F3FC', dark: '#0E7490' },
  ],
};

// ============================================
// MODULES — Exact structure from manual
// ============================================
export const MODULES: NavModule[] = [
  { id: 'problem', label: 'Problem Frame', sub: 'Frame the decision', num: '01', phase: 1 },
  { id: 'issues', label: 'Issue Generation', sub: 'Surface what matters', num: '02', phase: 1 },
  { id: 'hierarchy', label: 'Decision Hierarchy', sub: 'Separate decisions', num: '03', phase: 1 },
  { id: 'strategy', label: 'Strategy Table', sub: 'Build alternatives', num: '04', phase: 1 },
  { id: 'assessment', label: 'Qualitative Assessment', sub: 'Score & compare', num: '05', phase: 1 },
  { id: 'scorecard', label: 'DQ Scorecard', sub: 'Audit quality', num: '06', phase: 1 },
  { id: 'stakeholders', label: 'Stakeholder Alignment', sub: 'Map alignment', num: '07', phase: 1 },
  { id: 'export', label: 'Export & Report', sub: 'Package & share', num: '08', phase: 1 },
  { id: 'influence', label: 'Influence Diagram', sub: 'Uncertainty analysis', num: '09', phase: 2 },
  { id: 'scenario', label: 'Scenario Planning', sub: 'Future states', num: '10', phase: 2 },
  { id: 'voi', label: 'Value of Information', sub: 'Information value', num: '11', phase: 2 },
  { id: 'risk-timeline', label: 'Decision Risk Timeline', sub: 'Temporal risk', num: '12', phase: 2 },
];

// ============================================
// ISSUE CATEGORIES — 12 per manual
// ============================================
export const ISSUE_CATEGORIES = [
  { key: 'uncertainty-external', label: 'External Uncertainty', short: 'Ext', icon: 'E', desc: 'External environment risks beyond our control', color: '#EF4444', soft: '#FEF2F2' },
  { key: 'uncertainty-internal', label: 'Internal Uncertainty', short: 'Int', icon: 'I', desc: 'Internal capability and execution risks', color: '#F59E0B', soft: '#FEF3C7' },
  { key: 'stakeholder-concern', label: 'Stakeholder Concern', short: 'Stk', icon: 'S', desc: 'People, politics, and organisational concerns', color: '#7C3AED', soft: '#F5F3FF' },
  { key: 'assumption', label: 'Key Assumption', short: 'Asm', icon: 'A', desc: 'Untested or risky assumptions', color: '#0891B2', soft: '#ECFEFF' },
  { key: 'information-gap', label: 'Information Gap', short: 'Gap', icon: 'G', desc: 'Missing or unreliable data needed for the decision', color: '#3B82F6', soft: '#EFF6FF' },
  { key: 'opportunity', label: 'Strategic Opportunity', short: 'Opp', icon: 'O', desc: 'Upside or option that could be captured', color: '#10B981', soft: '#ECFDF5' },
  { key: 'constraint', label: 'Hard Constraint', short: 'Cst', icon: 'C', desc: 'Non-negotiable boundary on the decision', color: '#475569', soft: '#F8FAFC' },
  { key: 'brutal-truth', label: 'Brutal Truth', short: 'Trt', icon: 'T', desc: 'Inconvenient fact the team must face', color: '#E11D48', soft: '#FFF1F2' },
  { key: 'regulatory-trap', label: 'Regulatory Trap', short: 'Reg', icon: 'R', desc: 'Hidden regulatory or compliance risk', color: '#D97706', soft: '#FFFBEB' },
  { key: 'second-order', label: 'Second-Order Effect', short: '2nd', icon: '2', desc: 'Indirect consequences not immediately visible', color: '#6366F1', soft: '#EEF2FF' },
  { key: 'black-swan', label: 'Black Swan', short: 'Sw', icon: 'B', desc: 'Low probability, extreme impact event', color: '#1E293B', soft: '#F1F5F9' },
  { key: 'focus-decision', label: 'Focus Decision', short: 'Foc', icon: 'F', desc: 'Core strategic choice to promote to hierarchy', color: '#2563EB', soft: '#EFF6FF' },
];

export const SEVERITY_LEVELS = ['Critical', 'High', 'Medium', 'Low'];

// ============================================
// DECISION HIERARCHY — 3 tiers per manual
// ============================================
export const H_TIERS = [
  { key: 'given', label: 'Given Decisions', shortLabel: 'Given', desc: 'Already made, locked, or non-negotiable. These constrain the strategy space but are not up for debate.', icon: 'P', color: '#64748B', soft: '#F1F5F9', line: '#E2E8F0', dark: '#475569' },
  { key: 'focus', label: 'Focus Decisions', shortLabel: 'Focus', desc: 'The strategic core — must be resolved for the overall decision. Max 5 (Focus Five).', icon: 'F', color: '#C9A84C', soft: '#FDF8E8', line: '#F3E5AB', dark: '#A68A3C', cap: 5, highlight: true },
  { key: 'deferred', label: 'Deferred Decisions', shortLabel: 'Deferred', desc: 'Depend on resolving focus decisions first. Parked here to prevent scope creep.', icon: 'D', color: '#0D9488', soft: '#F0FDFA', line: '#99F6E4', dark: '#0F766E' },
];

export const CRITERIA_TYPES = ['financial', 'strategic', 'operational', 'risk', 'commercial', 'technical', 'social', 'environmental'];
export const CRITERIA_WEIGHTS = ['critical', 'high', 'medium', 'low'];

// ============================================
// DQ ELEMENTS — 6 elements per manual, 0-100 scale
// ============================================
export const DQ_ELEMENTS = [
  { key: 'frame', num: '01', label: 'Appropriate Decision Frame', short: 'Frame',
    desc: 'The right decision is being addressed at the right level with the right scope. The decision statement is a genuine open question, not a situation description or a solution in disguise.',
    questions: ['Is the decision statement a genuine open question?', 'Is the scope explicitly bounded — in and out?', 'Are we solving the root problem, not a symptom?', 'Is there stakeholder alignment on the frame?'],
    ...DS.frame, scoreScale: '0–100',
  },
  { key: 'alternatives', num: '02', label: 'Creative, Doable Alternatives', short: 'Alternatives',
    desc: 'Genuinely distinct strategies that meaningfully test the solution space. Not variations of the same idea with different names.',
    questions: ['Do we have 3+ genuinely distinct strategies?', 'Have we avoided false diversity?', 'Does each strategy represent a coherent path?', 'Have we included a do-nothing or status quo option?'],
    ...DS.alternatives, scoreScale: '0–100',
  },
  { key: 'information', num: '03', label: 'Meaningful, Reliable Information', short: 'Information',
    desc: 'Key uncertainties are identified and understood. Information is reliable, relevant, and appropriately used. The team knows what it does not know.',
    questions: ['Have key uncertainties been identified?', 'Do we know the deal-breaker uncertainties?', 'Is our information reliable — not just convenient?', 'Have facts been distinguished from assumptions?'],
    ...DS.information, scoreScale: '0–100',
  },
  { key: 'values', num: '04', label: 'Clear Values & Trade-offs', short: 'Values',
    desc: 'Decision criteria reflect what stakeholders actually value. Trade-off rules are explicit and agreed before scoring.',
    questions: ['Are criteria clear, agreed, and weighted?', 'Do criteria reflect genuine stakeholder values?', 'Are trade-off rules explicit?', 'Is there alignment on what good looks like?'],
    ...DS.values, scoreScale: '0–100',
  },
  { key: 'reasoning', num: '05', label: 'Sound Reasoning', short: 'Reasoning',
    desc: 'The logic connecting information to conclusions is valid. Analysis is proportionate to the decision\'s complexity. Known biases are identified.',
    questions: ['Is reasoning from evidence to recommendation sound?', 'Have known biases been identified?', 'Is analysis proportionate to complexity?', 'Does the recommendation follow from evidence?'],
    ...DS.reasoning, scoreScale: '0–100',
  },
  { key: 'commitment', num: '06', label: 'Commitment to Action', short: 'Commitment',
    desc: 'All key stakeholders are aligned and ready to act. There is a clear owner and the organisation can and will execute.',
    questions: ['Do all key decision makers support the direction?', 'Is the organisation ready to execute?', 'Have dissenting views been heard?', 'Is there a clear owner and next step?'],
    ...DS.commitment, scoreScale: '0–100',
  },
];

// ============================================
// ASSESSMENT RATING — 1-5 scale per manual
// ============================================
export const RATING_LABELS = [
  { label: 'Excellent', value: 5, desc: 'Strong evidence this strategy excels. Clear advantage.', color: '#10B981', soft: '#ECFDF5' },
  { label: 'Good', value: 4, desc: 'Meaningful advantage. Positive evidence. Meets the bar well.', color: '#0D9488', soft: '#F0FDFA' },
  { label: 'Adequate', value: 3, desc: 'Meets minimum requirements. No clear advantage or disadvantage.', color: '#64748B', soft: '#F1F5F9' },
  { label: 'Weak', value: 2, desc: 'Below expectations. Material shortfall remains.', color: '#D97706', soft: '#FFFBEB' },
  { label: 'Poor', value: 1, desc: 'Fails to address this criterion. Significant weakness.', color: '#EF4444', soft: '#FEF2F2' },
];

// ============================================
// DQ SCORE SCALE per manual
// ============================================
export const DQ_SCORE_BANDS = [
  { min: 90, max: 100, label: 'Elite', desc: 'Exceptional decision quality. All six elements strong.', color: '#10B981', soft: '#ECFDF5' },
  { min: 70, max: 89, label: 'Strong', desc: 'Ready to decide with confidence. Minor gaps only.', color: '#0D9488', soft: '#F0FDFA' },
  { min: 45, max: 69, label: 'Adequate', desc: 'Proceed with caution. Specific weaknesses need addressing.', color: '#D97706', soft: '#FFFBEB' },
  { min: 20, max: 44, label: 'Weak', desc: 'Significant gaps. Decision should not be committed yet.', color: '#EF4444', soft: '#FEF2F2' },
  { min: 0, max: 19, label: 'High-Risk', desc: 'Fundamental quality issues. Do not commit.', color: '#7F1D1D', soft: '#FEF2F2' },
];

// Uncertainty & VOI types
export const UNCERTAINTY_TYPES = ['Market', 'Regulatory', 'Technical', 'Financial', 'Competitive', 'Operational', 'Political', 'Stakeholder', 'Environmental'];
export const IMPACT_LEVELS = ['Critical', 'High', 'Medium', 'Low'];
export const CONTROL_LEVELS = ['High', 'Some', 'Low', 'None'];

// Workshop phases per manual
export const WORKSHOP_PHASES = [
  { id: 'p1', label: 'Decision Context', time: 10, desc: 'Align the room on what decision is being made' },
  { id: 'p2', label: 'Stakeholder Mapping', time: 15, desc: 'Map who has a stake, who decides, who must act' },
  { id: 'p3', label: 'Issue Raising', time: 20, desc: 'Silent brainstorm followed by full-group share-out' },
  { id: 'p4', label: 'Issue Categorisation', time: 15, desc: 'Sort, merge, and prioritise the issue list' },
  { id: 'p5', label: 'Decision Hierarchy', time: 15, desc: 'Agree which decisions are in scope and their level' },
  { id: 'p6', label: 'Alternatives Generation', time: 20, desc: 'Build genuinely distinct strategic alternatives' },
  { id: 'p7', label: 'Assumption Surfacing', time: 20, desc: 'Surface and challenge assumptions behind each strategy' },
  { id: 'p8', label: 'Scenario Testing', time: 20, desc: 'Stress-test strategies against possible futures' },
  { id: 'p9', label: 'Trade-off Discussion', time: 20, desc: 'Make explicit the trade-offs the team is accepting' },
  { id: 'p10', label: 'Commitment & Actions', time: 15, desc: 'Agree direction, owners, deadlines, and next steps' },
];

// ============================================
// TOOLS — Top-bar dropdown
// ============================================
export type ToolId = 'game-theory' | 'workshop' | 'deep-dive' | 'export-advanced';

export const TOOLS: { id: ToolId; label: string; description: string; color: string; icon: string }[] = [
  { id: 'game-theory', label: 'Strategic Gaming', description: 'Game theory — players, incentives, equilibria, reactions', color: '#7C3AED', icon: 'Swords' },
  { id: 'workshop', label: 'Workshop Mode', description: 'Collaborative team workshop with real-time facilitation', color: '#0891B2', icon: 'Presentation' },
  { id: 'deep-dive', label: 'AI Deep Dive', description: 'Full AI analysis across all 6 DQ dimensions', color: '#10B981', icon: 'Brain' },
  { id: 'export-advanced', label: 'Advanced Export', description: 'Export to PDF with full decision package formatting', color: '#F59E0B', icon: 'FileSpreadsheet' },
];
