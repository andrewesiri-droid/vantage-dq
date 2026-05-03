/**
 * Export & Report Module — Vantage DQ
 *
 * 7-step report builder:
 * 1. Choose report type  →  2. Select modules  →  3. Audience
 * 4. Tone  →  5. AI Generate  →  6. Preview & Edit  →  7. Export
 *
 * Report types: Executive Brief | Full DQ Report | Board Pack | Workshop Summary
 * Export formats: PDF | DOCX | PPTX | Excel | Markdown
 *
 * Pulls live data from all 12 modules via localStorage
 */
import { useState, useEffect, useRef } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, FileText, Presentation, Table, Download,
  ChevronRight, ChevronLeft, CheckCircle, Eye, Edit3,
  BarChart2, Users, AlertTriangle, Lightbulb, Shield,
  BookOpen, Target, Zap, Clock, Star, X, RefreshCw,
  FileDown, FilePlus, Settings, Check
} from 'lucide-react';

// ── TYPES ─────────────────────────────────────────────────────────────────────
type ReportType = 'executive-brief' | 'full-dq' | 'board-pack' | 'workshop-summary';
type Audience   = 'board' | 'executive' | 'technical' | 'client' | 'workshop' | 'investment-committee';
type Tone       = 'executive-concise' | 'consulting' | 'technical' | 'board-ready' | 'facilitation';
type ExportFmt  = 'pdf' | 'docx' | 'pptx' | 'excel' | 'markdown' | 'html';

interface ReportSection {
  id: string; title: string; content: string; source: string;
  included: boolean; editable: boolean; generated: boolean;
}

interface ReportConfig {
  type: ReportType; audience: Audience; tone: Tone;
  modules: string[]; confidentiality: string;
  projectName: string; author: string; date: string;
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const REPORT_TYPES: Record<ReportType, { label: string; sub: string; desc: string; icon: any; color: string; soft: string; sections: string[]; time: string }> = {
  'executive-brief': {
    label: 'Executive Decision Brief', sub: '1–2 pages', icon: FileText,
    desc: 'A concise executive summary covering the decision, options, uncertainties, and recommendation. Designed for 5-minute leadership reads.',
    color: DS.accent, soft: DS.accentSoft, time: '~2 min to generate',
    sections: ['Decision Question', 'Context & Stakes', 'Options Considered', 'Key Uncertainties', 'Major Trade-offs', 'DQ Assessment', 'Recommendation', 'Decision Required', 'Next Steps'],
  },
  'full-dq': {
    label: 'Full Decision Framing Report', sub: '10–20 pages', icon: BookOpen,
    desc: 'The complete DQ report: all modules, full analysis, strategic rationale, risk assessment, and appendices. Consulting-grade deliverable.',
    color: DS.reasoning.fill, soft: DS.reasoning.soft, time: '~5 min to generate',
    sections: ['Cover Page', 'Executive Summary', 'Decision Context', 'Problem Definition', 'Decision Scope', 'Stakeholders', 'Decision Hierarchy', 'Issues Summary', 'Strategy Alternatives', 'Uncertainty Assessment', 'Scenario Planning', 'Risk Timeline', 'DQ Scorecard', 'Insights & Implications', 'Recommendations', 'Open Questions', 'Action Plan', 'Appendix'],
  },
  'board-pack': {
    label: 'Board Decision Pack', sub: '6–8 slides', icon: Presentation,
    desc: 'Concise board-ready presentation. Decision ask, why now, options, risk/reward view, recommendation, required approval, and next 90 days.',
    color: DS.commitment.fill, soft: '#FFF5F7', time: '~3 min to generate',
    sections: ['Decision Ask', 'Why Now', 'Strategic Context', 'Options at a Glance', 'Evaluation Criteria', 'Risk/Reward View', 'Recommendation', 'Required Approval', 'Conditions & Guardrails', 'Next 30/60/90 Days'],
  },
  'workshop-summary': {
    label: 'Workshop Summary Report', sub: '4–6 pages', icon: Users,
    desc: 'Workshop closeout document: themes, issues raised, agreements, unresolved items, action items, owners, and next session plan.',
    color: DS.alternatives.fill, soft: '#F0FDFA', time: '~2 min to generate',
    sections: ['Workshop Purpose', 'Participants', 'Decision Challenge', 'Key Discussion Themes', 'Issues Raised', 'Agreements Reached', 'Unresolved Items', 'Risks & Uncertainties Surfaced', 'Parking Lot', 'Action Items & Owners', 'Next Workshop Plan'],
  },
};

const MODULE_OPTIONS = [
  { id: 'problem-frame',     label: 'Problem Frame',         icon: Target,     desc: 'Decision context, scope, success measures' },
  { id: 'issues',            label: 'Issue Generation',      icon: Zap,        desc: `Issues, categories, heat map` },
  { id: 'decisions',         label: 'Decision Hierarchy',    icon: BarChart2,  desc: 'Focus decisions, tiers, choices' },
  { id: 'strategies',        label: 'Strategy Alternatives', icon: FileText,   desc: 'Options, rationale, focus selections' },
  { id: 'assessment',        label: 'Qualitative Assessment',icon: Star,       desc: 'Criteria scoring, radar, decision brief' },
  { id: 'dq-scorecard',      label: 'DQ Scorecard',          icon: Shield,     desc: '6-element scores, narrative, chain' },
  { id: 'stakeholders',      label: 'Stakeholder Alignment', icon: Users,      desc: 'Alignment map, engagement actions' },
  { id: 'uncertainties',     label: 'Scenario Planning',     icon: Clock,      desc: 'Uncertainties, scenarios, robustness' },
  { id: 'risks',             label: 'Risk Timeline',         icon: AlertTriangle, desc: 'Risk items, likelihood, timeline' },
  { id: 'voi',               label: 'Value of Information',  icon: Lightbulb,  desc: 'VOI assessments, recommendations' },
  { id: 'ai-insights',       label: 'AI Insights',           icon: Sparkles,   desc: 'AI frame check, recommendations' },
];

const AUDIENCE_OPTIONS: Record<Audience, { label: string; desc: string }> = {
  'board':                { label: '🏛 Board of Directors',       desc: 'Governance-focused, decision-ask led, minimal jargon' },
  'executive':            { label: '💼 Executive Leadership',     desc: 'Strategic, concise, action-oriented' },
  'technical':            { label: '⚙️ Technical Team',           desc: 'Detail-rich, analytical, methodology-visible' },
  'client':               { label: '🤝 Client / External',        desc: 'Consulting-grade, polished, context-rich' },
  'workshop':             { label: '🧠 Workshop Participants',     desc: 'Facilitation-style, discussion-oriented' },
  'investment-committee': { label: '📈 Investment Committee',     desc: 'Risk/return focused, financial language, IRR/NPV' },
};

const TONE_OPTIONS: Record<Tone, { label: string; desc: string }> = {
  'executive-concise': { label: 'Executive Concise',   desc: 'Short paragraphs, bullets, action language' },
  'consulting':        { label: 'Consulting Style',    desc: 'Structured narrative, professional, evidence-led' },
  'technical':         { label: 'Technical Detail',    desc: 'Methodology-visible, precise, analytical' },
  'board-ready':       { label: 'Board Ready',         desc: 'Governance-appropriate, formal, unambiguous' },
  'facilitation':      { label: 'Facilitation Summary',desc: 'Discussion-oriented, questions, conversational' },
};

const CONFIDENTIALITY = [
  'Internal Use Only', 'Confidential', 'Draft for Discussion',
  'Board Review', 'Client Deliverable', 'Strictly Confidential',
];

// ── DATA EXTRACTOR ─────────────────────────────────────────────────────────────
function extractSessionData() {
  try {
    const raw = localStorage.getItem('vantage_dq_demo_sessions');
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      session:      d.sessions?.[0] || {},
      issues:       d.issues || [],
      decisions:    d.decisions || [],
      strategies:   d.strategies || [],
      criteria:     d.criteria || [],
      assessmentScores: d.assessmentScores || {},
      uncertainties: d.uncertainties || [],
      stakeholders: d.stakeholderEntries || [],
      risks:        d.riskItems || [],
      scenarios:    d.scenarios || [],
      voiAnalyses:  d.voiAnalyses || [],
    };
  } catch { return null; }
}

function buildDataContext(data: any, modules: string[]): string {
  if (!data) return 'No session data found.';
  const { session, issues, decisions, strategies, criteria, uncertainties, stakeholders, risks, scenarios } = data;
  const parts: string[] = [];

  parts.push(`DECISION: ${session.decisionStatement || 'Not defined'}`);
  parts.push(`CONTEXT: ${session.context || ''}`);
  parts.push(`DEADLINE: ${session.deadline || 'Not set'}`);
  parts.push(`SUCCESS CRITERIA: ${session.successCriteria || ''}`);
  parts.push(`CONSTRAINTS: ${session.constraints || ''}`);

  if (modules.includes('strategies') && strategies.length) {
    parts.push(`\nSTRATEGIES (${strategies.length}):`);
    strategies.forEach((s: any) => parts.push(`  - ${s.name}: ${s.rationale || s.objective || ''}`));
  }

  if (modules.includes('issues') && issues.length) {
    const cats = [...new Set(issues.map((i: any) => i.category))];
    parts.push(`\nISSUES (${issues.length}) across categories: ${cats.join(', ')}`);
    issues.slice(0, 8).forEach((i: any) => parts.push(`  - [${i.category}] ${i.text} (severity: ${i.severity})`));
  }

  if (modules.includes('uncertainties') && uncertainties.length) {
    parts.push(`\nKEY UNCERTAINTIES (${uncertainties.length}):`);
    uncertainties.forEach((u: any) => parts.push(`  - ${u.label} (${u.type}, impact: ${u.impact})`));
  }

  if (modules.includes('risks') && risks.length) {
    parts.push(`\nRISKS (${risks.length}):`);
    risks.slice(0, 5).forEach((r: any) => parts.push(`  - ${r.label} (likelihood: ${r.likelihood}, impact: ${r.impact})`));
  }

  if (modules.includes('stakeholders') && stakeholders.length) {
    parts.push(`\nSTAKEHOLDERS (${stakeholders.length}):`);
    stakeholders.forEach((s: any) => parts.push(`  - ${s.name} (${s.role || ''}, alignment: ${s.alignment})`));
  }

  if (modules.includes('dq-scorecard') && session.dqScores) {
    const scores = session.dqScores;
    const overall = Object.values(scores).length ? Math.round(Object.values(scores as Record<string, number>).reduce((a, b) => a + b, 0) / Object.values(scores).length) : 0;
    parts.push(`\nDQ SCORES: Frame=${scores.frame||0}, Alternatives=${scores.alternatives||0}, Information=${scores.information||0}, Values=${scores.values||0}, Reasoning=${scores.reasoning||0}, Commitment=${scores.commitment||0}. Overall: ${overall}/100`);
  }

  if (modules.includes('decisions') && decisions.length) {
    const focus = decisions.filter((d: any) => d.tier === 'focus');
    parts.push(`\nFOCUS DECISIONS (${focus.length}): ${focus.map((d: any) => d.label).join('; ')}`);
  }

  if (modules.includes('assessment') && criteria.length) {
    parts.push(`\nEVALUATION CRITERIA: ${criteria.map((c: any) => `${c.label} (${c.weight})`).join(', ')}`);
  }

  if (modules.includes('uncertainties') && scenarios.length) {
    parts.push(`\nSCENARIOS (${scenarios.length}): ${scenarios.map((s: any) => s.name).join(', ')}`);
  }

  return parts.join('\n');
}

// ── SECTION BUILDERS ───────────────────────────────────────────────────────────
function buildInitialSections(type: ReportType, data: any): ReportSection[] {
  const template = REPORT_TYPES[type];
  const session = data?.session || {};
  const issues = data?.issues || [];
  const strategies = data?.strategies || [];
  const risks = data?.risks || [];
  const uncertainties = data?.uncertainties || [];
  const stakeholders = data?.stakeholders || [];
  const dqScores = session.dqScores || {};

  const makeSection = (id: string, title: string, content: string, source: string): ReportSection =>
    ({ id, title, content, source, included: true, editable: true, generated: false });

  const sections: ReportSection[] = [];

  if (type === 'executive-brief') {
    sections.push(makeSection('decision', 'Decision Question', session.decisionStatement || 'Not defined', 'Problem Frame'));
    sections.push(makeSection('context', 'Context & Stakes', `${session.context || ''}\n\nDeadline: ${session.deadline || 'TBD'}\n\nSuccess: ${session.successCriteria || ''}`, 'Problem Frame'));
    sections.push(makeSection('options', 'Options Considered', strategies.map((s: any) => `• ${s.name}: ${s.rationale || ''}`).join('\n') || 'No strategies defined', 'Strategy Table'));
    sections.push(makeSection('uncertainties', 'Key Uncertainties', uncertainties.slice(0,5).map((u: any) => `• ${u.label} (${u.type} | Impact: ${u.impact})`).join('\n') || 'None identified', 'Scenario Planning'));
    sections.push(makeSection('tradeoffs', 'Major Trade-offs', 'To be generated by AI based on strategy comparison.', 'AI Analysis'));
    sections.push(makeSection('dq', 'DQ Assessment', Object.keys(dqScores).length ? `Frame: ${dqScores.frame||0}/100 | Alternatives: ${dqScores.alternatives||0}/100 | Information: ${dqScores.information||0}/100 | Values: ${dqScores.values||0}/100 | Reasoning: ${dqScores.reasoning||0}/100 | Commitment: ${dqScores.commitment||0}/100` : 'DQ Scorecard not completed', 'DQ Scorecard'));
    sections.push(makeSection('recommendation', 'Recommendation', 'To be generated by AI', 'AI Analysis'));
    sections.push(makeSection('decision-ask', 'Decision Required', 'What specifically is being asked of leadership?', 'Framework'));
    sections.push(makeSection('next-steps', 'Next Steps', 'To be generated by AI', 'AI Analysis'));
  }

  if (type === 'board-pack') {
    sections.push(makeSection('ask', 'Decision Ask', `APPROVE / REJECT / DEFER:\n${session.decisionStatement || ''}`, 'Problem Frame'));
    sections.push(makeSection('why-now', 'Why Now', session.trigger || session.context?.slice(0,200) || '', 'Problem Frame'));
    sections.push(makeSection('context', 'Strategic Context', session.context || '', 'Problem Frame'));
    sections.push(makeSection('options', 'Options at a Glance', strategies.map((s: any, i: number) => `Option ${i+1}: ${s.name}\n${s.rationale || ''}`).join('\n\n') || 'No strategies defined', 'Strategy Table'));
    sections.push(makeSection('criteria', 'Evaluation Criteria', (data?.criteria || []).map((c: any) => `• ${c.label} (${c.weight})`).join('\n'), 'Qualitative Assessment'));
    sections.push(makeSection('risk-reward', 'Risk/Reward View', risks.slice(0,4).map((r: any) => `• ${r.label}: likelihood=${r.likelihood}, impact=${r.impact}`).join('\n'), 'Risk Timeline'));
    sections.push(makeSection('recommendation', 'Recommendation', 'To be generated by AI', 'AI Analysis'));
    sections.push(makeSection('approval', 'Required Approval', 'What approvals, authorities, or governance steps are required?', 'Framework'));
    sections.push(makeSection('guardrails', 'Conditions & Guardrails', session.constraints || 'To be defined', 'Problem Frame'));
    sections.push(makeSection('next-90', 'Next 30/60/90 Days', 'To be generated by AI', 'AI Analysis'));
  }

  if (type === 'workshop-summary') {
    sections.push(makeSection('purpose', 'Workshop Purpose', session.context || '', 'Problem Frame'));
    sections.push(makeSection('participants', 'Participants', stakeholders.map((s: any) => `• ${s.name} (${s.role || ''})`).join('\n') || 'Not recorded', 'Stakeholder Alignment'));
    sections.push(makeSection('challenge', 'Decision Challenge', session.decisionStatement || '', 'Problem Frame'));
    sections.push(makeSection('themes', 'Key Discussion Themes', 'To be generated by AI from issues raised', 'AI Analysis'));
    sections.push(makeSection('issues', 'Issues Raised', issues.slice(0,10).map((i: any) => `• [${i.category}] ${i.text}`).join('\n') || 'None recorded', 'Issue Generation'));
    sections.push(makeSection('agreements', 'Agreements Reached', 'To be generated by AI', 'AI Analysis'));
    sections.push(makeSection('unresolved', 'Unresolved Items', 'Items requiring further discussion or analysis.', 'AI Analysis'));
    sections.push(makeSection('risks', 'Risks & Uncertainties Surfaced', uncertainties.slice(0,5).map((u: any) => `• ${u.label}`).join('\n'), 'Scenario Planning'));
    sections.push(makeSection('parking', 'Parking Lot', 'Items noted for future consideration.', 'Workshop'));
    sections.push(makeSection('actions', 'Action Items & Owners', 'To be defined.', 'Framework'));
    sections.push(makeSection('next', 'Next Workshop Plan', 'Date, agenda, pre-work.', 'Framework'));
  }

  if (type === 'full-dq') {
    sections.push(makeSection('exec-summary', 'Executive Summary', 'To be generated by AI — comprehensive summary of all DQ work', 'AI Analysis'));
    sections.push(makeSection('context', 'Decision Context', session.context || '', 'Problem Frame'));
    sections.push(makeSection('problem', 'Problem Definition', `Decision: ${session.decisionStatement || ''}\nScope: ${session.scopeIn || ''}\nOut of scope: ${session.scopeOut || ''}`, 'Problem Frame'));
    sections.push(makeSection('stakeholders', 'Stakeholders', stakeholders.map((s: any) => `• ${s.name}: ${s.role || ''} | Alignment: ${s.alignment || ''}`).join('\n'), 'Stakeholder Alignment'));
    sections.push(makeSection('hierarchy', 'Decision Hierarchy', (data?.decisions || []).map((d: any) => `[${d.tier?.toUpperCase()}] ${d.label}: ${d.choices?.join(' / ')}`).join('\n'), 'Decision Hierarchy'));
    sections.push(makeSection('issues-full', 'Issues Summary', issues.map((i: any) => `• [${i.category}] ${i.text} | ${i.severity}`).join('\n'), 'Issue Generation'));
    sections.push(makeSection('strategies', 'Strategy Alternatives', strategies.map((s: any) => `\n${s.name}:\n${s.rationale || ''}`).join('\n'), 'Strategy Table'));
    sections.push(makeSection('uncertainties-full', 'Uncertainty Assessment', uncertainties.map((u: any) => `• ${u.label} (${u.type}, ${u.impact})`).join('\n'), 'Scenario Planning'));
    sections.push(makeSection('scenarios', 'Scenario Planning', (data?.scenarios || []).map((s: any) => `Scenario: ${s.name}`).join('\n') || 'Not completed', 'Scenario Planning'));
    sections.push(makeSection('risks-full', 'Risk Timeline', risks.map((r: any) => `• ${r.label} | L: ${r.likelihood} | I: ${r.impact}`).join('\n'), 'Risk Timeline'));
    sections.push(makeSection('dq-full', 'DQ Scorecard', Object.keys(dqScores).length ? `Frame: ${dqScores.frame||0} | Alternatives: ${dqScores.alternatives||0} | Information: ${dqScores.information||0} | Values: ${dqScores.values||0} | Reasoning: ${dqScores.reasoning||0} | Commitment: ${dqScores.commitment||0}` : 'Not completed', 'DQ Scorecard'));
    sections.push(makeSection('insights', 'Insights & Implications', 'To be generated by AI', 'AI Analysis'));
    sections.push(makeSection('recommendations', 'Recommendations', 'To be generated by AI', 'AI Analysis'));
    sections.push(makeSection('open', 'Open Questions', 'Questions that remain unresolved and require further analysis.', 'Framework'));
    sections.push(makeSection('actions', 'Action Plan', 'Specific actions, owners, and timelines.', 'Framework'));
  }

  return sections;
}

// ── EXPORT ENGINE ─────────────────────────────────────────────────────────────
function exportToMarkdown(sections: ReportSection[], config: ReportConfig): string {
  const type = REPORT_TYPES[config.type];
  const lines: string[] = [];
  lines.push(`# ${type.label}`);
  lines.push(`**${config.projectName || 'Vantage DQ Report'}**`);
  lines.push(`*${config.confidentiality}*  |  ${config.author || 'Vantage DQ'}  |  ${config.date}`);
  lines.push('---');
  sections.filter(s => s.included).forEach(s => {
    lines.push(`\n## ${s.title}`);
    lines.push(s.content);
    lines.push(`\n*Source: ${s.source}*`);
  });
  return lines.join('\n');
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportToHTML(sections: ReportSection[], config: ReportConfig): string {
  const type = REPORT_TYPES[config.type];
  const brandColor = DS.brand;
  const accent = DS.accent;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${type.label} — ${config.projectName}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fb; color: #1a2033; margin: 0; padding: 0; }
  .cover { background: ${brandColor}; color: white; padding: 60px 80px; min-height: 280px; display: flex; flex-direction: column; justify-content: space-between; }
  .cover h1 { font-size: 28px; font-weight: 900; margin: 0 0 12px; letter-spacing: -0.5px; }
  .cover .type { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; margin-bottom: 8px; }
  .cover .meta { font-size: 12px; opacity: 0.5; margin-top: auto; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.15); }
  .confidential { background: ${accent}; color: #0B1D3A; font-size: 10px; font-weight: 700; padding: 4px 12px; border-radius: 4px; display: inline-block; margin-bottom: 16px; }
  .content { max-width: 900px; margin: 0 auto; padding: 60px 40px; }
  .section { margin-bottom: 48px; padding-bottom: 32px; border-bottom: 1px solid #e8eaf0; }
  .section:last-child { border-bottom: none; }
  .section h2 { font-size: 18px; font-weight: 800; color: ${brandColor}; margin: 0 0 8px; }
  .section .source { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ba3b8; margin-bottom: 16px; }
  .section p { font-size: 14px; line-height: 1.7; color: #3a4255; margin: 0; white-space: pre-wrap; }
  .footer { background: #f0f2f7; padding: 24px 40px; text-align: center; font-size: 11px; color: #9ba3b8; border-top: 1px solid #e0e3ed; }
  @media print { .cover { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="cover">
  <div>
    <div class="type">Vantage DQ · ${type.label}</div>
    <h1>${config.projectName || 'Decision Quality Report'}</h1>
    <div class="confidential">${config.confidentiality}</div>
  </div>
  <div class="meta">${config.author || ''} &nbsp;·&nbsp; ${config.date} &nbsp;·&nbsp; Generated by Vantage DQ</div>
</div>
<div class="content">
${sections.filter(s => s.included).map(s => `
  <div class="section">
    <div class="source">Source: ${s.source}</div>
    <h2>${s.title}</h2>
    <p>${s.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
  </div>
`).join('')}
</div>
<div class="footer">
  Confidential · ${config.confidentiality} · Vantage DQ Platform · ${config.date}
</div>
</body>
</html>`;
}

function downloadHTML(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportToCSV(data: any, type: ReportType): string {
  const rows: string[][] = [];
  if (type === 'full-dq' || type === 'executive-brief') {
    rows.push(['MODULE', 'ITEM', 'DETAIL', 'SEVERITY/WEIGHT']);
    (data?.issues || []).forEach((i: any) => rows.push(['Issues', i.text || '', i.category || '', i.severity || '']));
    (data?.strategies || []).forEach((s: any) => rows.push(['Strategies', s.name || '', s.rationale || '', '']));
    (data?.risks || []).forEach((r: any) => rows.push(['Risks', r.label || '', `L:${r.likelihood} I:${r.impact}`, r.impact || '']));
    (data?.uncertainties || []).forEach((u: any) => rows.push(['Uncertainties', u.label || '', u.type || '', u.impact || '']));
    (data?.stakeholders || []).forEach((s: any) => rows.push(['Stakeholders', s.name || '', s.role || '', s.alignment || '']));
    const scores = data?.session?.dqScores || {};
    Object.entries(scores).forEach(([k, v]) => rows.push(['DQ Scorecard', k, String(v), '']));
  }
  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── REPORT HEALTH SCORER ───────────────────────────────────────────────────────
function scoreReportHealth(sections: ReportSection[], data: any): { score: number; issues: string[]; strengths: string[] } {
  const issues: string[] = [];
  const strengths: string[] = [];
  let score = 100;

  const genCount = sections.filter(s => s.generated && s.included).length;
  const inclCount = sections.filter(s => s.included).length;

  if (genCount < inclCount * 0.5) { issues.push('Less than half of sections have AI-generated content'); score -= 15; }
  else strengths.push('Most sections have AI-generated content');

  if (!data?.strategies?.length) { issues.push('No strategy alternatives defined'); score -= 20; }
  else strengths.push(`${data.strategies.length} strategy alternatives included`);

  if (!data?.session?.dqScores || !Object.keys(data.session.dqScores || {}).length) { issues.push('DQ Scorecard not completed'); score -= 15; }
  else { const vals = Object.values(data.session.dqScores as Record<string,number>); const avg = vals.reduce((a,b)=>a+b,0)/vals.length; if (avg < 40) { issues.push('DQ scores are very low — report may show premature commitment'); score -= 10; } else strengths.push(`DQ overall score: ${Math.round(avg)}/100`); }

  if (!data?.uncertainties?.length) { issues.push('No uncertainties identified — decision may be overconfident'); score -= 15; }
  else strengths.push(`${data.uncertainties.length} uncertainties documented`);

  if (!data?.risks?.length) { issues.push('No risks documented'); score -= 10; }

  const emptyAI = sections.filter(s => s.included && s.content.includes('To be generated by AI'));
  if (emptyAI.length > 0) { issues.push(`${emptyAI.length} section(s) still need AI generation`); score -= emptyAI.length * 5; }

  return { score: Math.max(0, Math.min(100, score)), issues, strengths };
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────
export function ExportReport({ sessionId, data }: ModuleProps) {
  const { call, busy } = useAI();
  const [step, setStep] = useState(1); // 1-7
  const [config, setConfig] = useState<ReportConfig>({
    type: 'executive-brief', audience: 'executive', tone: 'executive-concise',
    modules: ['problem-frame','strategies','dq-scorecard','uncertainties','risks','ai-insights'],
    confidentiality: 'Confidential', projectName: '', author: '', date: new Date().toLocaleDateString('en-GB'),
  });
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [health, setHealth] = useState<{ score: number; issues: string[]; strengths: string[] } | null>(null);
  const [exported, setExported] = useState<ExportFmt | null>(null);
  const sessionData = extractSessionData() || data;

  useEffect(() => {
    if (sessionData?.session?.name) setConfig(c => ({ ...c, projectName: c.projectName || sessionData.session.name }));
  }, []);

  const typeCfg = REPORT_TYPES[config.type];
  const TypeIcon = typeCfg.icon;

  // Step 5: AI Generate all sections
  const generateAllSections = async () => {
    const baseSections = buildInitialSections(config.type, sessionData);
    setSections(baseSections);
    setGenerating(true);
    setGenerationProgress(0);

    const dataContext = buildDataContext(sessionData, config.modules);
    const audienceCfg = AUDIENCE_OPTIONS[config.audience];
    const toneCfg = TONE_OPTIONS[config.tone];

    const aiSections = baseSections.filter(s =>
      s.content.includes('To be generated by AI') || ['recommendation','next-steps','tradeoffs','themes','agreements','unresolved','insights','exec-summary','next-90','actions'].includes(s.id)
    );

    for (let i = 0; i < aiSections.length; i++) {
      const sec = aiSections[i];
      setGenerationProgress(Math.round((i / aiSections.length) * 100));

      const prompt = `You are a senior Decision Quality consultant generating a section for a ${typeCfg.label}.

AUDIENCE: ${audienceCfg.label} — ${audienceCfg.desc}
TONE: ${toneCfg.label} — ${toneCfg.desc}
CONFIDENTIALITY: ${config.confidentiality}

SESSION DATA:
${dataContext}

Generate the "${sec.title}" section.

Requirements:
- Write in ${toneCfg.label} tone for ${audienceCfg.label} audience
- Be specific — use actual data from the session (strategy names, issue texts, scores, etc.)
- Do NOT invent numbers or economics not in the data
- Do NOT overstate confidence
- Mark any judgment with "Assessment:" and any assumption with "Assumption:"
- Length: ${config.type === 'board-pack' ? '3-5 bullet points or 2-3 concise paragraphs' : '1-3 paragraphs'}
- For recommendations: tie explicitly to objectives and trade-offs
- For risks: distinguish between likely and possible
- Be direct — no filler phrases

Return JSON: { content: string }`;

      await new Promise<void>((resolve) => {
        call(prompt, (r) => {
          let result = r;
          if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { /**/ } }
          const content = result?.content || sec.content;
          setSections(p => p.map(s => s.id === sec.id ? { ...s, content, generated: true } : s));
          resolve();
        });
      });
    }

    setGenerating(false);
    setGenerationProgress(100);

    // Compute health
    const finalSections = buildInitialSections(config.type, sessionData);
    setHealth(scoreReportHealth(finalSections, sessionData));
    setStep(6);
  };

  const saveEdit = () => {
    if (!editingSectionId) return;
    setSections(p => p.map(s => s.id === editingSectionId ? { ...s, content: editingContent, generated: true } : s));
    setEditingSectionId(null);
  };

  const doExport = (fmt: ExportFmt) => {
    const slug = (config.projectName || 'vantage-dq-report').toLowerCase().replace(/\s+/g, '-');
    if (fmt === 'markdown') {
      downloadMarkdown(exportToMarkdown(sections, config), `${slug}.md`);
    } else if (fmt === 'html' || fmt === 'pdf') {
      downloadHTML(exportToHTML(sections, config), `${slug}.html`);
    } else if (fmt === 'excel') {
      downloadCSV(exportToCSV(sessionData, config.type), `${slug}-data.csv`);
    } else {
      // For DOCX/PPTX — download as HTML with a note
      downloadHTML(exportToHTML(sections, config), `${slug}.html`);
    }
    setExported(fmt);
    setTimeout(() => setExported(null), 3000);
  };

  const healthColor = health ? (health.score >= 80 ? DS.success : health.score >= 60 ? DS.warning : DS.danger) : DS.inkDis;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 08</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Export & Report</h2>
          <p className="text-xs mt-0.5" style={{ color: DS.inkSub }}>Turn your decision work into polished, executive-ready outputs.</p>
        </div>
        {health && (
          <div className="text-center shrink-0 px-4 py-2 rounded-xl border" style={{ borderColor: DS.borderLight }}>
            <div className="text-2xl font-black" style={{ color: healthColor }}>{health.score}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>REPORT HEALTH</div>
          </div>
        )}
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-0 mb-6">
        {['Report Type','Modules','Audience','Tone','Generate','Preview','Export'].map((label, i) => {
          const stepNum = i + 1;
          const isDone = step > stepNum;
          const isCurrent = step === stepNum;
          return (
            <div key={label} className="flex items-center">
              <button onClick={() => { if (isDone || isCurrent) setStep(stepNum); }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-[10px] font-medium"
                style={{ background: isCurrent ? `${DS.reasoning.fill}15` : 'transparent', color: isCurrent ? DS.reasoning.fill : isDone ? DS.success : DS.inkDis }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background: isCurrent ? DS.reasoning.fill : isDone ? DS.success : DS.bg, color: isCurrent || isDone ? '#fff' : DS.inkDis, border: `1.5px solid ${isCurrent ? DS.reasoning.fill : isDone ? DS.success : DS.borderLight}` }}>
                  {isDone ? <Check size={10} /> : stepNum}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < 6 && <div className="w-4 h-px mx-0.5" style={{ background: isDone ? DS.success : DS.borderLight }} />}
            </div>
          );
        })}
      </div>

      {/* ══ STEP 1: REPORT TYPE ════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: DS.inkSub }}>Choose the report type that fits your audience and purpose.</p>
          <div className="grid grid-cols-2 gap-4">
            {(Object.entries(REPORT_TYPES) as [ReportType, typeof REPORT_TYPES['executive-brief']][]).map(([type, tcfg]) => {
              const Icon = tcfg.icon;
              const isSelected = config.type === type;
              return (
                <button key={type} onClick={() => setConfig(c => ({ ...c, type }))}
                  className="text-left p-5 rounded-2xl border-2 transition-all hover:shadow-md group"
                  style={{ borderColor: isSelected ? tcfg.color : DS.borderLight, background: isSelected ? tcfg.soft : '#fff' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tcfg.color}20` }}>
                      <Icon size={18} style={{ color: tcfg.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold" style={{ color: DS.ink }}>{tcfg.label}</span>
                        {isSelected && <CheckCircle size={13} style={{ color: tcfg.color }} />}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge style={{ background: `${tcfg.color}18`, color: tcfg.color, border: 'none', fontSize: 9 }}>{tcfg.sub}</Badge>
                        <span className="text-[9px]" style={{ color: DS.inkDis }}>{tcfg.time}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{tcfg.desc}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tcfg.sections.slice(0,5).map(s => <span key={s} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${tcfg.color}10`, color: tcfg.color }}>{s}</span>)}
                        {tcfg.sections.length > 5 && <span className="text-[8px] px-1 py-0.5" style={{ color: DS.inkDis }}>+{tcfg.sections.length - 5} more</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Project info */}
          <div className="p-4 rounded-xl border" style={{ borderColor: DS.borderLight, background: DS.bg }}>
            <div className="text-[9px] font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkDis }}>REPORT METADATA</div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[9px] font-bold uppercase block mb-1" style={{ color: DS.inkDis }}>PROJECT NAME</label><Input value={config.projectName} onChange={e => setConfig(c=>({...c,projectName:e.target.value}))} placeholder={sessionData?.session?.name || 'Decision name'} className="text-xs" /></div>
              <div><label className="text-[9px] font-bold uppercase block mb-1" style={{ color: DS.inkDis }}>AUTHOR</label><Input value={config.author} onChange={e => setConfig(c=>({...c,author:e.target.value}))} placeholder="Your name" className="text-xs" /></div>
              <div><label className="text-[9px] font-bold uppercase block mb-1" style={{ color: DS.inkDis }}>CONFIDENTIALITY</label>
                <Select value={config.confidentiality} onValueChange={v=>setConfig(c=>({...c,confidentiality:v}))}>
                  <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONFIDENTIALITY.map(c=><SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end"><Button style={{ background: typeCfg.color }} className="gap-2" onClick={() => setStep(2)}>Select Modules <ChevronRight size={14} /></Button></div>
        </div>
      )}

      {/* ══ STEP 2: MODULES ════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: DS.inkSub }}>Select which modules to include in your report. More modules = richer content.</p>
          <div className="grid grid-cols-2 gap-2">
            {MODULE_OPTIONS.map(mod => {
              const Icon = mod.icon;
              const isSelected = config.modules.includes(mod.id);
              return (
                <button key={mod.id}
                  onClick={() => setConfig(c => ({ ...c, modules: isSelected ? c.modules.filter(m => m !== mod.id) : [...c.modules, mod.id] }))}
                  className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                  style={{ background: isSelected ? `${typeCfg.color}10` : DS.bg, border: `1.5px solid ${isSelected ? typeCfg.color : DS.borderLight}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: isSelected ? `${typeCfg.color}20` : DS.canvas }}>
                    <Icon size={14} style={{ color: isSelected ? typeCfg.color : DS.inkDis }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: DS.ink }}>{mod.label}</div>
                    <div className="text-[9px]" style={{ color: DS.inkDis }}>{mod.desc}</div>
                  </div>
                  {isSelected && <CheckCircle size={14} style={{ color: typeCfg.color, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: DS.accentSoft }}>
            <Lightbulb size={13} style={{ color: DS.accent, flexShrink: 0 }} />
            <p className="text-[10px]" style={{ color: DS.inkSub }}>{config.modules.length} modules selected. AI will pull live data from each module and generate relevant narrative.</p>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" className="gap-1 text-xs" onClick={() => setStep(1)}><ChevronLeft size={12} /> Back</Button>
            <Button style={{ background: typeCfg.color }} className="gap-2" onClick={() => setStep(3)}>Set Audience <ChevronRight size={14} /></Button>
          </div>
        </div>
      )}

      {/* ══ STEP 3: AUDIENCE ═══════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: DS.inkSub }}>Who will read this report? AI adapts language, depth, and emphasis accordingly.</p>
          <div className="space-y-2">
            {(Object.entries(AUDIENCE_OPTIONS) as [Audience, {label:string;desc:string}][]).map(([aud, acfg]) => (
              <button key={aud} onClick={() => setConfig(c => ({ ...c, audience: aud }))}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{ background: config.audience === aud ? `${typeCfg.color}10` : DS.bg, border: `1.5px solid ${config.audience === aud ? typeCfg.color : DS.borderLight}` }}>
                <div className="flex-1">
                  <div className="text-xs font-bold" style={{ color: DS.ink }}>{acfg.label}</div>
                  <div className="text-[10px]" style={{ color: DS.inkDis }}>{acfg.desc}</div>
                </div>
                {config.audience === aud && <CheckCircle size={14} style={{ color: typeCfg.color }} />}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" className="gap-1 text-xs" onClick={() => setStep(2)}><ChevronLeft size={12} /> Back</Button>
            <Button style={{ background: typeCfg.color }} className="gap-2" onClick={() => setStep(4)}>Set Tone <ChevronRight size={14} /></Button>
          </div>
        </div>
      )}

      {/* ══ STEP 4: TONE ═══════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: DS.inkSub }}>Choose the writing tone. This controls how AI drafts each section.</p>
          <div className="space-y-2">
            {(Object.entries(TONE_OPTIONS) as [Tone, {label:string;desc:string}][]).map(([tone, tcfg]) => (
              <button key={tone} onClick={() => setConfig(c => ({ ...c, tone }))}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{ background: config.tone === tone ? `${typeCfg.color}10` : DS.bg, border: `1.5px solid ${config.tone === tone ? typeCfg.color : DS.borderLight}` }}>
                <div className="flex-1">
                  <div className="text-xs font-bold" style={{ color: DS.ink }}>{tcfg.label}</div>
                  <div className="text-[10px]" style={{ color: DS.inkDis }}>{tcfg.desc}</div>
                </div>
                {config.tone === tone && <CheckCircle size={14} style={{ color: typeCfg.color }} />}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" className="gap-1 text-xs" onClick={() => setStep(3)}><ChevronLeft size={12} /> Back</Button>
            <Button style={{ background: typeCfg.color }} className="gap-2" onClick={() => setStep(5)}>AI Generate <ChevronRight size={14} /></Button>
          </div>
        </div>
      )}

      {/* ══ STEP 5: AI GENERATE ════════════════════════════════════════════════ */}
      {step === 5 && (
        <div className="space-y-5">
          {/* Summary of config */}
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: DS.borderLight, background: typeCfg.soft }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${typeCfg.color}25` }}>
                  <TypeIcon size={18} style={{ color: typeCfg.color }} />
                </div>
                <div>
                  <div className="text-base font-black" style={{ color: DS.ink }}>{typeCfg.label}</div>
                  <div className="text-[10px]" style={{ color: DS.inkSub }}>{AUDIENCE_OPTIONS[config.audience].label} · {TONE_OPTIONS[config.tone].label} · {config.modules.length} modules</div>
                </div>
                <Badge style={{ background: `${typeCfg.color}20`, color: typeCfg.color, border: 'none', marginLeft: 'auto' }}>{config.confidentiality}</Badge>
              </div>
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-4 text-[10px]" style={{ background: DS.bg }}>
              <div><span style={{ color: DS.inkDis }}>Project: </span><strong style={{ color: DS.ink }}>{config.projectName || sessionData?.session?.name || '—'}</strong></div>
              <div><span style={{ color: DS.inkDis }}>Author: </span><strong style={{ color: DS.ink }}>{config.author || '—'}</strong></div>
              <div><span style={{ color: DS.inkDis }}>Date: </span><strong style={{ color: DS.ink }}>{config.date}</strong></div>
              <div><span style={{ color: DS.inkDis }}>Sections: </span><strong style={{ color: DS.ink }}>{typeCfg.sections.length}</strong></div>
              <div><span style={{ color: DS.inkDis }}>Modules: </span><strong style={{ color: DS.ink }}>{config.modules.length}</strong></div>
              <div><span style={{ color: DS.inkDis }}>Data points: </span><strong style={{ color: DS.ink }}>{(sessionData?.issues?.length||0)+(sessionData?.strategies?.length||0)+(sessionData?.risks?.length||0)} items</strong></div>
            </div>
          </div>

          {/* What AI will pull */}
          <div className="p-4 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>DATA AI WILL USE</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Decision', sessionData?.session?.decisionStatement?.slice(0,60)+'…'],
                ['Strategies', `${sessionData?.strategies?.length||0} alternatives`],
                ['Issues', `${sessionData?.issues?.length||0} issues across ${[...new Set(sessionData?.issues?.map((i:any)=>i.category))].length} categories`],
                ['Uncertainties', `${sessionData?.uncertainties?.length||0} identified`],
                ['Risks', `${sessionData?.risks?.length||0} risk items`],
                ['DQ Scores', Object.keys(sessionData?.session?.dqScores||{}).length ? `${Object.values(sessionData?.session?.dqScores as Record<string,number>||{}).reduce((a:number,b:number)=>a+b,0)/6|0}/100 avg` : 'Not scored'],
              ].map(([label, val]) => (
                <div key={label as string} className="p-2 rounded-lg" style={{ background: '#fff', border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[8px] font-bold uppercase" style={{ color: DS.inkDis }}>{label}</div>
                  <div className="text-[10px] font-medium" style={{ color: DS.ink }}>{val as string || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DQ guardrail */}
          <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: DS.warnSoft }}>
            <AlertTriangle size={13} style={{ color: DS.warning, flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="text-[9px] font-bold uppercase mb-0.5" style={{ color: DS.warning }}>AI GUARDRAIL</div>
              <p className="text-[10px]" style={{ color: DS.inkSub }}>AI will only use data from your session. It will not invent economics or overstate confidence. Judgments are marked "Assessment:" and assumptions are marked "Assumption:". Missing data sections are flagged, not fabricated.</p>
            </div>
          </div>

          {generating ? (
            <div className="space-y-3">
              <div className="p-6 rounded-2xl text-center" style={{ background: `${typeCfg.color}08`, border: `1px solid ${typeCfg.color}25` }}>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <RefreshCw size={20} style={{ color: typeCfg.color }} className="animate-spin" />
                  <span className="text-sm font-bold" style={{ color: DS.ink }}>Generating {typeCfg.label}…</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: DS.borderLight }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${generationProgress}%`, background: typeCfg.color }} />
                </div>
                <p className="text-xs" style={{ color: DS.inkDis }}>{generationProgress}% — Writing sections for {AUDIENCE_OPTIONS[config.audience].label} audience…</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-between">
              <Button variant="outline" className="gap-1 text-xs" onClick={() => setStep(4)}><ChevronLeft size={12} /> Back</Button>
              <Button className="gap-2 px-6" style={{ background: typeCfg.color }} onClick={generateAllSections} disabled={busy}>
                <Sparkles size={14} /> Generate {typeCfg.label}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 6: PREVIEW & EDIT ═════════════════════════════════════════════ */}
      {step === 6 && (
        <div className="space-y-4">
          {/* Health check */}
          {health && (
            <div className="rounded-xl p-4 border" style={{ borderColor: DS.borderLight, background: DS.bg }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl font-black" style={{ color: healthColor }}>{health.score}</div>
                <div>
                  <div className="text-xs font-bold" style={{ color: DS.ink }}>Report Health Score</div>
                  <div className="h-1.5 w-32 rounded-full overflow-hidden mt-1" style={{ background: DS.borderLight }}>
                    <div className="h-full rounded-full" style={{ width: `${health.score}%`, background: healthColor }} />
                  </div>
                </div>
                <div className="ml-auto text-xs" style={{ color: DS.inkDis }}>Export when ready</div>
              </div>
              {health.issues.length > 0 && (
                <div className="space-y-1 mb-2">
                  {health.issues.slice(0,3).map((issue, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: DS.warning }}>
                      <AlertTriangle size={10} /> {issue}
                    </div>
                  ))}
                </div>
              )}
              {health.strengths.slice(0,2).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: DS.success }}>
                  <CheckCircle size={10} /> {s}
                </div>
              ))}
            </div>
          )}

          {/* Section editor */}
          <div className="space-y-3">
            {sections.map((sec, i) => {
              const isEditing = editingSectionId === sec.id;
              return (
                <div key={sec.id} className="rounded-xl overflow-hidden border transition-all"
                  style={{ borderColor: isEditing ? typeCfg.color : DS.borderLight, background: isEditing ? '#fff' : DS.canvas }}>
                  <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: DS.borderLight, background: isEditing ? typeCfg.soft : DS.bg }}>
                    <button onClick={() => setSections(p => p.map(s => s.id === sec.id ? {...s, included: !s.included} : s))}
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                      style={{ background: sec.included ? typeCfg.color : DS.bg, border: `1.5px solid ${sec.included ? typeCfg.color : DS.border}` }}>
                      {sec.included && <Check size={9} className="text-white" />}
                    </button>
                    <span className="text-xs font-bold flex-1" style={{ color: sec.included ? DS.ink : DS.inkDis }}>{i+1}. {sec.title}</span>
                    <Badge style={{ background: DS.bg, color: DS.inkDis, border: `1px solid ${DS.borderLight}`, fontSize: 8 }}>{sec.source}</Badge>
                    {sec.generated && <Badge style={{ background: `${typeCfg.color}15`, color: typeCfg.color, border: 'none', fontSize: 8 }}>AI</Badge>}
                    {sec.included && (
                      <button onClick={() => {
                        if (isEditing) { saveEdit(); }
                        else { setEditingSectionId(sec.id); setEditingContent(sec.content); }
                      }} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded" style={{ background: isEditing ? typeCfg.color : DS.bg, color: isEditing ? '#fff' : DS.inkSub }}>
                        {isEditing ? <><Check size={10} /> Save</> : <><Edit3 size={10} /> Edit</>}
                      </button>
                    )}
                  </div>
                  {sec.included && (
                    <div className="px-4 py-3">
                      {isEditing ? (
                        <Textarea value={editingContent} onChange={e => setEditingContent(e.target.value)} rows={8} className="text-xs resize-none w-full" />
                      ) : (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: DS.inkSub }}>{sec.content}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" className="gap-1 text-xs" onClick={() => setStep(5)}><ChevronLeft size={12} /> Regenerate</Button>
            <Button style={{ background: typeCfg.color }} className="gap-2" onClick={() => { setHealth(scoreReportHealth(sections, sessionData)); setStep(7); }}>
              <Download size={14} /> Export Report <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* ══ STEP 7: EXPORT ═════════════════════════════════════════════════════ */}
      {step === 7 && (
        <div className="space-y-5">
          <p className="text-xs" style={{ color: DS.inkSub }}>Choose your export format. All formats pull from the same generated content.</p>

          {/* Health reminder */}
          {health && health.score < 60 && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: DS.dangerSoft }}>
              <AlertTriangle size={13} style={{ color: DS.danger, flexShrink: 0 }} />
              <div>
                <div className="text-[9px] font-bold uppercase mb-0.5" style={{ color: DS.danger }}>QUALITY WARNING — SCORE {health.score}/100</div>
                <p className="text-[10px]" style={{ color: DS.inkSub }}>{health.issues[0]}. Consider completing more modules before exporting.</p>
              </div>
            </div>
          )}

          {/* Export format cards */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { fmt: 'html' as ExportFmt,     label: 'HTML Report',          sub: 'Print-ready, shareable',     icon: FileText,    desc: 'Professional HTML with cover page, headers, and styled sections. Print as PDF from your browser.',       color: DS.accent },
              { fmt: 'markdown' as ExportFmt, label: 'Markdown (.md)',        sub: 'Editable text format',       icon: FileDown,    desc: 'Clean markdown for Notion, GitHub, Confluence, or any documentation system.',                          color: DS.information.fill },
              { fmt: 'excel' as ExportFmt,    label: 'Data Export (.csv)',    sub: 'Structured data',            icon: Table,       desc: 'All issues, strategies, risks, uncertainties, stakeholders, and DQ scores in spreadsheet format.',       color: DS.success },
              { fmt: 'docx' as ExportFmt,     label: 'Word (.docx)',          sub: 'Editable document',          icon: FilePlus,    desc: 'Downloads as HTML. Open in Word, Google Docs, or Pages for additional editing.',                         color: DS.commitment.fill },
            ] as {fmt:ExportFmt;label:string;sub:string;icon:any;desc:string;color:string}[]).map(opt => {
              const Icon = opt.icon;
              const isExported = exported === opt.fmt;
              return (
                <div key={opt.fmt} className="rounded-2xl p-5 border transition-all" style={{ borderColor: DS.borderLight, background: '#fff' }}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${opt.color}15` }}>
                      <Icon size={18} style={{ color: opt.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: DS.ink }}>{opt.label}</div>
                      <div className="text-[10px]" style={{ color: opt.color }}>{opt.sub}</div>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed mb-4" style={{ color: DS.inkSub }}>{opt.desc}</p>
                  <Button className="w-full gap-2 text-xs" style={{ background: isExported ? DS.success : opt.color }} onClick={() => doExport(opt.fmt)}>
                    {isExported ? <><Check size={13} /> Downloaded!</> : <><Download size={13} /> Download {opt.label}</>}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Report summary */}
          <div className="p-4 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <div className="text-[9px] font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkDis }}>REPORT SUMMARY</div>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                ['Sections', sections.filter(s=>s.included).length],
                ['AI Generated', sections.filter(s=>s.generated&&s.included).length],
                ['Data Points', (sessionData?.issues?.length||0)+(sessionData?.strategies?.length||0)+(sessionData?.risks?.length||0)+(sessionData?.uncertainties?.length||0)],
                ['Health Score', health?.score||'—'],
              ].map(([label, val]) => (
                <div key={label as string} className="p-2.5 rounded-xl" style={{ background: '#fff', border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-xl font-black" style={{ color: typeCfg.color }}>{val}</div>
                  <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" className="gap-1 text-xs" onClick={() => setStep(6)}><ChevronLeft size={12} /> Back to Preview</Button>
            <Button variant="outline" className="gap-1 text-xs" onClick={() => { setStep(1); setSections([]); setHealth(null); }}>
              <RefreshCw size={12} /> New Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
