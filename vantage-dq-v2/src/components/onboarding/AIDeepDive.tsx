import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  DeepDiveExtractionResult,
  ReviewQueueItem,
  DQAIResult,
} from '../../types/entities';
import {
  buildExtractionPrompt as buildStrictExtractionPrompt,
  extractionToReviewItems,
  DQ_EXTRACTION_SYSTEM_PROMPT,
  getStatusBadge,
  getConfidenceBadge,
} from '../../lib/dq/dq-extraction-prompt';

// ─────────────────────────────────────────────────────────────
// RESPONSIVE STYLES
// ─────────────────────────────────────────────────────────────
const RESPONSIVE_CSS = `
  * { box-sizing: border-box; }

  /* ── Base (desktop) ── */
  .dq-container { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
  .dq-header { padding: 16px 24px; }
  .dq-header-title { font-size: 18px; }
  .dq-stats-bar { display: flex; flex-wrap: wrap; gap: 12px; }
  .dq-filter-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .dq-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .dq-extract-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
  .dq-card-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
  .dq-launch-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }

  /* ── Tablet (641–1024px) ── */
  @media (min-width: 641px) and (max-width: 1024px) {
    .dq-container { padding: 24px 20px; max-width: 100%; }
    .dq-header { padding: 14px 20px; }
    .dq-header-title { font-size: 16px; }
    .dq-extract-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .dq-grid-2 { grid-template-columns: 1fr 1fr; gap: 12px; }
    .dq-launch-bar { gap: 14px; }
    .dq-launch-bar button { min-width: 180px; }
    .dq-filter-tab { font-size: 12px; padding: 6px 12px; }
    .dq-filter-row { gap: 7px; }
    textarea { font-size: 14px !important; }
    .dq-stats-bar > div:last-child { display: flex; gap: 8px; }
  }

  /* ── Mobile (≤640px) ── */
  @media (max-width: 640px) {
    .dq-container { padding: 16px 12px; }
    .dq-header { padding: 12px 14px; }
    .dq-header-title { font-size: 14px; }
    .dq-phase-steps { display: none !important; }
    .dq-stats-bar { justify-content: space-between; }
    .dq-stats-bar > div:first-child { gap: 10px !important; }
    .dq-stats-bar > div:last-child { width: 100%; display: flex !important; gap: 8px; }
    .dq-stats-bar > div:last-child button { flex: 1; font-size: 11px !important; padding: 6px 8px !important; }
    .dq-grid-2 { grid-template-columns: 1fr; gap: 10px; }
    .dq-extract-grid { grid-template-columns: repeat(2, 1fr); gap: 7px; }
    .dq-launch-bar { flex-direction: column !important; align-items: stretch !important; text-align: center; }
    .dq-launch-bar button { width: 100% !important; padding: 14px !important; font-size: 15px !important; }
    .dq-filter-row { gap: 5px; }
    .dq-filter-tab { font-size: 11px !important; padding: 5px 9px !important; }
    .dq-back-btn { font-size: 12px !important; padding: 5px 10px !important; }
    .dq-card-title { font-size: 13px !important; }
    .dq-card-sub { font-size: 11px !important; }
    .dq-confidence-badge { font-size: 10px !important; }
    .dq-source-quote { display: none !important; }
    .dq-group-label { font-size: 13px !important; }
    textarea { min-height: 180px !important; font-size: 13px !important; }
  }

  /* ── Tiny phones (≤380px) ── */
  @media (max-width: 380px) {
    .dq-container { padding: 12px 10px; }
    .dq-header { padding: 10px 12px; }
    .dq-extract-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
    .dq-stats-bar > div:first-child { gap: 6px !important; }
    .dq-filter-tab { font-size: 10px !important; padding: 4px 7px !important; }
  }
`;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type ExtractionPhase =
  | 'upload'        // Paste / upload document
  | 'extracting'    // Claude is reading the doc
  | 'review'        // Staging area: user accepts/rejects items
  | 'launching';    // Writing accepted items to session + navigating

interface ReviewItem extends ReviewQueueItem {
  /** Local edit state (before commit) */
  editedData?: Record<string, unknown>;
  isExpanded?: boolean;
}

interface GroupedItems {
  label: string;
  module: string;
  icon: string;
  color: string;
  items: ReviewItem[];
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const MODULE_META: Record<string, { label: string; icon: string; color: string }> = {
  problem_frame:  { label: 'Problem Frame',        icon: '⬡', color: '#3B82F6' },
  issue:          { label: 'Issues',               icon: '⚠', color: '#EF4444' },
  decision_node:  { label: 'Decision Hierarchy',   icon: '◈', color: '#6366F1' },
  strategy:       { label: 'Strategies',           icon: '◆', color: '#0D9488' },
  stakeholder:    { label: 'Stakeholders',         icon: '◉', color: '#D97706' },
  risk_item:      { label: 'Risks',                icon: '▲', color: '#E11D48' },
  criterion:      { label: 'Success Criteria',     icon: '✦', color: '#10B981' },
};

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

function buildExtractionPrompt(document: string): string {
  return `You are a Decision Quality (DQ) analyst trained in the Decision Quality methodology. Analyze the document below and extract ALL of the following into a single JSON object. Respond ONLY with valid JSON — no preamble, no markdown fences.

RECOGNIZED FORMATS: You are trained to recognize Decision Quality templates. If the document uses any of these field labels, map them as follows:
- "Decision Statement" or "Decision Problem Statement" → decisionStatement
- "Driver for a decision at this time" → trigger
- "Values/Objectives to select the strategy" → successCriteria (as array)
- "Key questions the decision evaluation needs to answer" → context
- "Givens/decisions made which set the decision scope" → constraints (as array)
- "Decision Executive" → stakeholders (role: Decision Executive)
- "Guiding Decision Makers" → stakeholders (role: Guiding Decision Maker)
- "Project Lead" → stakeholders (role: Project Lead)
- "Decision Facilitator" → stakeholders (role: Decision Facilitator)
- "Project Team" → stakeholders (role: Project Team)
- "Subject Matter Experts" → stakeholders (role: SME)
- Any scope boundaries → scopeIn / scopeOut arrays
- Any assumptions stated as facts → assumptions array

REQUIRED OUTPUT SHAPE:
{
  "sessionName": string,
  "confidenceScore": number (0-1),
  "extractionNotes": string,
  "humanReviewFlags": string[],

  "decisionStatement": string,
  "context": string,
  "decisionOwner": string | null,
  "trigger": string | null,
  "scopeIn": string[],
  "scopeOut": string[],
  "givens": string[],
  "constraints": string[],
  "successCriteria": string[],

  "initialIssues": [{ "label": string, "category": string, "description": string, "confidenceScore": number, "sourceQuote": string }],
  "decisionHierarchyCandidates": [{ "label": string, "type": "big_arrow"|"strategic"|"tactical"|"operational", "rationale": string, "confidenceScore": number }],
  "strategyCandidates": [{ "name": string, "description": string, "tagline": string, "confidenceScore": number, "sourceQuote": string }],
  "uncertainties": string[],
  "risks": [{ "label": string, "likelihood": "Low"|"Medium"|"High", "impact": "Low"|"Medium"|"High", "rationale": string, "confidenceScore": number }],
  "stakeholders": [{ "name": string, "role": string, "influence": number, "interest": number, "alignment": "champion"|"supporter"|"neutral"|"skeptic"|"blocker", "confidenceScore": number, "sourceQuote": string }],
  "dataGaps": string[],

  "dataUsed": string[],
  "missingData": string[],
  "assumptionsMade": string[],
  "suggestedNextActions": string[]
}

RULES:
- confidenceScore = how certain you are about each extracted item (0 = guess, 1 = directly stated)
- sourceQuote = the exact short phrase from the doc that supports this item (max 20 words)
- If something isn't in the doc, return [] or null — do not invent
- humanReviewFlags = list items where human judgment is essential before proceeding
- extractionNotes = 2-3 sentences on overall doc quality and extraction completeness

DECISION STATEMENT RULES:
- Must be a specific, board-ready open question — NOT a generic "what strategy should X use"
- Include the specific context: company name, asset names, key constraints, key tensions
- Good example: "How should [Company] sequence [specific activities] to optimize [specific outcome] given [specific constraint] and [specific tension]?"
- Bad example: "What strategy should [Company] use to get maximum value?" — too generic, no context
- If the document implies a decision but doesn't state it well, craft a precise board-ready question

STRATEGY EXTRACTION RULES:
- Only extract GENUINE strategic alternatives — distinct development or resource allocation paths
- DO NOT include information-gathering actions as strategies (e.g. "conduct study", "gather more data", "run pilot", "commission research")
- Information-gathering actions belong in uncertainties or issues, NOT strategies
- A strategy must answer: "If we choose this, what are we committing to?" not "What should we learn first?"
- Good strategy: a named development path, market move, or resource commitment with a clear direction
- Bad strategy: "Conduct further study", "Gather more information", "Run analysis" — these are actions, not strategies

SUCCESS CRITERIA RULES:
- If no success criteria are explicitly stated, add to humanReviewFlags: "SUCCESS CRITERIA MISSING — human must define: what does a good outcome look like for this decision?"
- Do NOT invent success criteria — flag them as missing

DECISION OWNER EXTRACTION RULES:
- Look for named individuals, job titles, boards, or organizational roles making decisions
- "Management", "the board", "CEO", "commercial team lead" are all valid owners — extract them
- If a group is divided, the owner is whoever must break the tie — name that role
- If the document says "the board approved" or "management decided", use that as the owner
- PARTIALLY_STATED if only a group is named — flag for human to name the specific person
- Only leave blank if absolutely no organizational entity is referenced

DECISION DEADLINE EXTRACTION RULES:  
- Look for license expiry dates, regulatory deadlines, fiscal deadlines, partner commitments
- "License expires in three years", "before next licensing round", "prior to FID" are valid deadlines
- Extract relative timeframes as approximate dates — "three year license" → "~3 years from acquisition"
- Always extract something if time pressure exists in the document
- Only leave blank if absolutely no time pressure is mentioned anywhere

BRUTAL TRUTH RULES:
- Always look for the uncomfortable reality the document dances around but never states
- In oil & gas decisions: is the primary asset actually commercially viable? Is the team avoiding this question?
- Add the brutal truth to initialIssues with category "brutal_truth"

FOCUS DECISION RULES:
- Farm-down timing is ALWAYS a focus decision if it affects the primary strategy — not a tactical detail
- Any decision that affects government negotiations, capital structure, or partner relationships is a focus decision

DOCUMENT:
${document}`;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function extractionResultToReviewItems(result: DeepDiveExtractionResult): ReviewItem[] {
  const now = new Date().toISOString();
  const items: ReviewItem[] = [];
  const makeId = () => `rq_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  const session_id = '__pending__'; // replaced on commit

  // Problem Frame — single item
  items.push({
    id: makeId(), session_id,
    targetType: 'problem_frame', targetModule: 'problem',
    data: {
      decisionStatement: result.decisionStatement,
      context: result.context,
      decisionOwner: result.decisionOwner,
      trigger: result.trigger,
      scopeIn: result.scopeIn ?? [],
      scopeOut: result.scopeOut ?? [],
      givens: result.givens ?? [],
      constraints: result.constraints ?? [],
      successCriteria: result.successCriteria ?? [],
    },
    confidenceScore: result.confidenceScore,
    extractionRationale: 'Core problem frame extracted from document introduction and executive summary.',
    status: 'pending', created_at: now,
    createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
  } as ReviewItem);

  // Issues
  (result.initialIssues ?? []).forEach((issue: any) => {
    items.push({
      id: makeId(), session_id,
      targetType: 'issue', targetModule: 'issues',
      data: { label: issue.label, category: issue.category, description: issue.description },
      confidenceScore: issue.confidenceScore ?? 0.7,
      sourceQuote: issue.sourceQuote,
      extractionRationale: issue.description,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    } as ReviewItem);
  });

  // Decision hierarchy
  (result.decisionHierarchyCandidates ?? []).forEach((node: any) => {
    items.push({
      id: makeId(), session_id,
      targetType: 'decision_node', targetModule: 'hierarchy',
      data: { label: node.label, type: node.type, rationale: node.rationale },
      confidenceScore: node.confidenceScore ?? 0.6,
      extractionRationale: node.rationale,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    } as ReviewItem);
  });

  // Strategies
  (result.strategyCandidates ?? []).forEach((strat: any) => {
    items.push({
      id: makeId(), session_id,
      targetType: 'strategy', targetModule: 'strategy',
      data: { name: strat.name, description: strat.description, tagline: strat.tagline },
      confidenceScore: strat.confidenceScore ?? 0.7,
      sourceQuote: strat.sourceQuote,
      extractionRationale: strat.description,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    } as ReviewItem);
  });

  // Stakeholders
  (result.stakeholders ?? []).forEach((s: any) => {
    items.push({
      id: makeId(), session_id,
      targetType: 'stakeholder', targetModule: 'stakeholders',
      data: { name: s.name, role: s.role, influence: s.influence, interest: s.interest, alignment: s.alignment },
      confidenceScore: s.confidenceScore ?? 0.65,
      sourceQuote: s.sourceQuote,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    } as ReviewItem);
  });

  // Risks
  (result.risks ?? []).forEach((r: any) => {
    items.push({
      id: makeId(), session_id,
      targetType: 'risk_item', targetModule: 'risk-timeline',
      data: { label: r.label, likelihood: r.likelihood, impact: r.impact },
      confidenceScore: r.confidenceScore ?? 0.6,
      extractionRationale: r.rationale,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    } as ReviewItem);
  });

  // Success criteria as individual items
  (result.successCriteria ?? []).forEach((criterion: string) => {
    items.push({
      id: makeId(), session_id,
      targetType: 'criterion', targetModule: 'assessment',
      data: { label: criterion, weight: 0.5 },
      confidenceScore: 0.75,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    } as ReviewItem);
  });

  return items;
}

function groupReviewItems(items: ReviewItem[]): GroupedItems[] {
  const groups: Record<string, ReviewItem[]> = {};
  items.forEach(item => {
    const key = item.targetType;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).map(([type, items]) => {
    const meta = MODULE_META[type] ?? { label: type, icon: '●', color: '#64748B' };
    return { label: meta.label, module: type, icon: meta.icon, color: meta.color, items };
  });
}

function confidenceLabel(score: number) {
  if (score >= 0.85) return { text: 'High confidence', color: '#10B981', bg: '#ECFDF5' };
  if (score >= 0.6)  return { text: 'Medium confidence', color: '#D97706', bg: '#FFFBEB' };
  return                    { text: 'Low confidence', color: '#EF4444', bg: '#FEF2F2' };
}

function getItemTitle(item: ReviewItem): string {
  const d = item.editedData ?? item.data;
  if (item.targetType === 'problem_frame') return (d.decisionStatement as string) || 'Problem Frame';
  return (d.label ?? d.name ?? d.decisionStatement ?? 'Unnamed') as string;
}

function getItemSub(item: ReviewItem): string | null {
  const d = item.editedData ?? item.data;
  if (item.targetType === 'problem_frame') return (d.context as string) ?? null;
  if (item.targetType === 'strategy') return (d.tagline ?? d.description) as string ?? null;
  if (item.targetType === 'issue') return (d.description ?? d.category) as string ?? null;
  if (item.targetType === 'stakeholder') return `${d.role ?? ''} — influence ${d.influence}, interest ${d.interest}`;
  if (item.targetType === 'risk_item') return `${d.likelihood} likelihood · ${d.impact} impact`;
  return item.extractionRationale ?? null;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

interface Props {
  onComplete: (sessionName: string, items: ReviewQueueItem[], sourceDocument: string, aiMeta: Pick<DQAIResult, 'dataUsed' | 'missingData' | 'assumptionsMade' | 'suggestedNextActions'>) => void;
  onBack: () => void;
}

export default function AIDeepDive({ onComplete, onBack }: Props) {
  const [phase, setPhase] = useState<ExtractionPhase>('upload');
  const [documentText, setDocumentText] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [aiMeta, setAiMeta] = useState<any>(null);
  const [humanFlags, setHumanFlags] = useState<string[]>([]);
  const [missingFieldsList, setMissingFieldsList] = useState<{ field: string; humanTask: string }[]>([]);
  const [extractionNotes, setExtractionNotes] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Stats ──────────────────────────────────────────────────
  const accepted  = items.filter(i => i.status === 'accepted').length;
  const rejected  = items.filter(i => i.status === 'rejected').length;
  const pending   = items.filter(i => i.status === 'pending').length;
  const edited    = items.filter(i => i.status === 'edited').length;
  const total     = items.length;

  // ── Extract ────────────────────────────────────────────────
  const handleExtract = useCallback(async () => {
    if (!documentText.trim()) return;
    setPhase('extracting');
    setError(null);
    setProgress('Reading your document…');

    try {
      setProgress('Extracting decision context, issues, strategies, stakeholders…');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          temperature: 0,
          system: DQ_EXTRACTION_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildExtractionPrompt(documentText) }],
        }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);
      const apiData = await response.json();
      const raw = apiData.content?.find((b: any) => b.type === 'text')?.text ?? '';

      setProgress('Parsing extraction results…');
      const clean = raw.replace(/```json|```/g, '').trim();
      if (!clean) throw new Error('Empty response from AI — please try again');

      let parsed: DeepDiveExtractionResult & any;
      try {
        parsed = JSON.parse(clean);
      } catch {
        // Retry once if JSON is malformed
        setProgress('Retrying extraction…');
        const retry = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            temperature: 0,
            system: DQ_EXTRACTION_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildExtractionPrompt(documentText) }],
          }),
        });
        const retryData = await retry.json();
        const retryRaw = retryData.content?.find((b: any) => b.type === 'text')?.text ?? '';
        const retryClean = retryRaw.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(retryClean);
      }

      // For background documents, decision statement may not exist yet — that's OK
      // Route it to human tasks instead of hard-failing
      if (!parsed.decisionStatement && !parsed.decisionStatement?.value) {
        // Add to human flags instead of throwing
        if (!parsed.humanReviewFlags) parsed.humanReviewFlags = [];
        parsed.humanReviewFlags.unshift('MISSING — Decision Statement: No decision statement found in document. You will need to write this yourself in the Problem Frame.');
      }

      setSessionName(parsed.sessionName ?? 'New Decision Session');
      setHumanFlags(parsed.humanReviewFlags ?? []);
      setExtractionNotes(parsed.extractionNotes ?? '');
      setAiMeta({
        dataUsed: parsed.dataUsed ?? [],
        missingData: parsed.missingData ?? [],
        assumptionsMade: parsed.assumptionsMade ?? [],
        suggestedNextActions: parsed.suggestedNextActions ?? [],
      });

      // Detect if Claude returned old flat shape vs new structured shape
      // and handle both gracefully
      const isNewShape = parsed.decisionStatement && typeof parsed.decisionStatement === 'object' && 'status' in parsed.decisionStatement;
      
      let reviewItems: any[];
      let missingFields: { field: string; humanTask: string }[] = [];

      if (isNewShape) {
        const result = extractionToReviewItems(parsed);
        reviewItems = result.items;
        missingFields = result.missingFields;
      } else {
        // Fallback: old flat shape — use legacy converter
        reviewItems = extractionResultToReviewItems(parsed);
      }
      setItems(reviewItems);
      if (missingFields.length > 0) {
        setMissingFieldsList(missingFields);
      }
      setPhase('review');
    } catch (err: any) {
      setError(err.message ?? 'Extraction failed. Please check your document and try again.');
      setPhase('upload');
    }
  }, [documentText]);

  // ── Item actions ───────────────────────────────────────────
  const setStatus = (id: string, status: ReviewItem['status']) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const acceptAll = () => setItems(prev => prev.map(i =>
    i.status === 'pending' ? { ...i, status: 'accepted' } : i
  ));

  const rejectAll = () => setItems(prev => prev.map(i =>
    i.status === 'pending' ? { ...i, status: 'rejected' } : i
  ));

  const updateItemField = (id: string, field: string, value: unknown) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const base = i.editedData ?? { ...i.data };
      return { ...i, editedData: { ...base, [field]: value }, status: 'edited' };
    }));
  };

  const toggleExpand = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isExpanded: !i.isExpanded } : i));
  };

  // ── Launch ─────────────────────────────────────────────────
  const handleLaunch = () => {
    setPhase('launching');
    const committed = items
      .filter(i => i.status === 'accepted' || i.status === 'edited')
      .map(i => ({
        ...i,
        data: i.editedData ?? i.data,
        reviewStatus: 'user_validated' as const,
      }));
    setTimeout(() => {
      onComplete(sessionName, committed, documentText, aiMeta);
    }, 800);
  };

  // ── File upload ────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setDocumentText(ev.target?.result as string);
    reader.readAsText(file);
  };

  // ── Filtered groups ────────────────────────────────────────
  const allGroups = groupReviewItems(
    filterType === 'all' ? items :
    filterType === 'pending' ? items.filter(i => i.status === 'pending') :
    items.filter(i => i.targetType === filterType)
  );

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #0B1D3A 0%, #132B4F 50%, #0B1D3A 100%)',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: '#F8FAFC',
      overflowX: 'hidden',
    }}>
      <style>{RESPONSIVE_CSS}</style>

      {/* ── Header ── */}
      <div className="dq-header" style={{
        borderBottom: '1px solid rgba(201,168,76,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(11,29,58,0.8)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, padding: '6px 14px', color: '#94A3B8', cursor: 'pointer',
            fontSize: 13, letterSpacing: 0.3,
          }}>← Back</button>
          <div>
            <div style={{ fontSize: 11, color: '#C9A84C', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
              AI Deep Dive
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
              {phase === 'upload' ? 'Upload Your Document' :
               phase === 'extracting' ? 'Extracting…' :
               phase === 'review' ? 'Review Extracted Items' :
               'Launching Session'}
            </div>
          </div>
        </div>

        {/* Phase indicator */}
        <div className="dq-phase-steps" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['upload', 'review', 'launching'] as const).map((p, i) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: phase === p ? '#C9A84C' :
                  (['upload', 'extracting'].includes(phase) && i > 0) ||
                  (phase === 'review' && i > 1) ? 'rgba(255,255,255,0.06)' : 'rgba(201,168,76,0.3)',
                border: `2px solid ${phase === p ? '#C9A84C' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: phase === p ? '#0B1D3A' : '#64748B',
                transition: 'all 0.3s',
              }}>{i + 1}</div>
              {i < 2 && <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.1)' }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="dq-container">

        {/* ── UPLOAD PHASE ── */}
        {phase === 'upload' && (
          <div>
            <p style={{ color: '#94A3B8', marginBottom: 28, fontSize: 15, lineHeight: 1.6 }}>
              Paste or upload any decision document — memo, brief, board paper, strategy doc.
              Claude will extract up to 15 categories of decision-relevant information for your review before anything is written to the session.
            </p>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                color: '#FCA5A5', fontSize: 14,
              }}>{error}</div>
            )}

            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <textarea
                value={documentText}
                onChange={e => setDocumentText(e.target.value)}
                placeholder="Paste your decision document here…&#10;&#10;Works best with: board memos, strategy briefs, investment cases, project proposals, or any document describing a decision to be made."
                style={{
                  width: '100%', minHeight: 340, background: 'transparent',
                  border: 'none', outline: 'none', color: '#E2E8F0',
                  fontSize: 14, lineHeight: 1.7, padding: '20px 22px',
                  resize: 'vertical', fontFamily: "'DM Mono', 'Courier New', monospace",
                  boxSizing: 'border-box',
                }}
              />
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                padding: '12px 16px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 7, padding: '7px 14px', color: '#94A3B8',
                      cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >📎 Upload .txt or .md</button>
                  <input ref={fileRef} type="file" accept=".txt,.md" onChange={handleFile} style={{ display: 'none' }} />
                  {documentText && (
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      {documentText.split(/\s+/).length.toLocaleString()} words
                    </span>
                  )}
                </div>
                <button
                  onClick={handleExtract}
                  disabled={!documentText.trim()}
                  style={{
                    background: documentText.trim() ? 'linear-gradient(135deg, #C9A84C, #E8D69B)' : 'rgba(255,255,255,0.06)',
                    border: 'none', borderRadius: 9, padding: '10px 24px',
                    color: documentText.trim() ? '#0B1D3A' : '#475569',
                    fontWeight: 700, fontSize: 14, cursor: documentText.trim() ? 'pointer' : 'not-allowed',
                    letterSpacing: 0.3, transition: 'all 0.2s',
                  }}
                >Extract →</button>
              </div>
            </div>

            {/* What gets extracted */}
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 11, color: '#64748B', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                What Claude extracts
              </div>
              <div className="dq-extract-grid">
                {Object.entries(MODULE_META).map(([key, meta], idx, arr) => (
                  <div key={key} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 9, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    gridColumn: idx === arr.length - 1 && arr.length % 2 !== 0 ? 'span 2' : undefined,
                  }}>
                    <span style={{ color: meta.color, fontSize: 16 }}>{meta.icon}</span>
                    <span style={{ fontSize: 13, color: '#CBD5E1' }}>{meta.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── EXTRACTING PHASE ── */}
        {phase === 'extracting' && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 28px',
              background: 'linear-gradient(135deg, #C9A84C22, #C9A84C44)',
              border: '2px solid #C9A84C66',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
              animation: 'spin 2s linear infinite',
            }}>⬡</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Analyzing your document</div>
            <div style={{ color: '#64748B', fontSize: 14 }}>{progress}</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── REVIEW PHASE ── */}
        {phase === 'review' && (
          <div>
            {/* Session name editor */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, color: '#C9A84C', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Session Name
              </label>
              <input
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,168,76,0.3)',
                  borderRadius: 9, padding: '10px 16px', color: '#F8FAFC',
                  fontSize: 16, fontWeight: 600, width: '100%', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* AI summary banner */}
            {extractionNotes && (
              <div style={{
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 12, padding: '14px 18px', marginBottom: 20,
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⬡</span>
                <div>
                  <div style={{ fontSize: 12, color: '#C9A84C', fontWeight: 600, marginBottom: 4 }}>Extraction Summary</div>
                  <div style={{ fontSize: 14, color: '#CBD5E1', lineHeight: 1.6 }}>{extractionNotes}</div>
                </div>
              </div>
            )}

            {/* Human Required — separate from review queue */}
            {missingFieldsList.length > 0 && (
              <div style={{
                background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.25)',
                borderRadius: 12, padding: '16px 18px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>📋</span>
                  <div>
                    <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 700 }}>
                      Human Required — {missingFieldsList.length} field{missingFieldsList.length !== 1 ? 's' : ''} not found in document
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      These fields were not stated in your document. You must supply them in the Problem Frame module.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {missingFieldsList.map((f, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8, padding: '10px 14px',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#FCA5A5', fontWeight: 700, marginTop: 1,
                      }}>✗</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0', marginBottom: 2 }}>{f.field}</div>
                        <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>{f.humanTask}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI flags — contradictions or quality warnings */}
            {humanFlags.length > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 12, padding: '12px 16px', marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, color: '#FCA5A5', fontWeight: 600, marginBottom: 6 }}>⚠ AI Quality Flags</div>
                {humanFlags.map((flag, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#94A3B8', marginBottom: 3, lineHeight: 1.5 }}>· {flag}</div>
                ))}
              </div>
            )}

            {/* Stats bar */}
            <div className="dq-stats-bar" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 18px',
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', gap: 20 }}>
                {[
                  { label: 'Total', val: total, color: '#94A3B8' },
                  { label: 'Pending', val: pending, color: '#F59E0B' },
                  { label: 'Accepted', val: accepted + edited, color: '#10B981' },
                  { label: 'Rejected', val: rejected, color: '#EF4444' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={acceptAll} disabled={pending === 0} style={{
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 8, padding: '7px 16px', color: '#34D399',
                  cursor: pending === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                  opacity: pending === 0 ? 0.4 : 1,
                }}>✓ Accept All Pending</button>
                <button onClick={rejectAll} disabled={pending === 0} style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8, padding: '7px 16px', color: '#FCA5A5',
                  cursor: pending === 0 ? 'not-allowed' : 'pointer', fontSize: 13,
                  opacity: pending === 0 ? 0.4 : 1,
                }}>✗ Reject All Pending</button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="dq-filter-row" style={{ display: 'flex', marginBottom: 20 }}>
              <FilterTab label="All" value="all" active={filterType} onClick={setFilterType} count={total} />
              <FilterTab label="Pending" value="pending" active={filterType} onClick={setFilterType} count={pending} color="#F59E0B" />
              {Object.entries(MODULE_META).map(([key, meta]) => {
                const count = items.filter(i => i.targetType === key).length;
                if (!count) return null;
                return <FilterTab key={key} label={meta.icon + ' ' + meta.label} value={key} active={filterType} onClick={setFilterType} count={count} color={meta.color} />;
              })}
            </div>

            {/* Item groups */}
            {allGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>No items in this filter</div>
            ) : (
              allGroups.map(group => (
                <div key={group.module} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ color: group.color, fontSize: 18 }}>{group.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#E2E8F0' }}>{group.label}</span>
                    <span style={{
                      background: `${group.color}22`, border: `1px solid ${group.color}44`,
                      borderRadius: 20, padding: '2px 9px', fontSize: 11, color: group.color,
                    }}>{group.items.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.items.map(item => (
                      <ReviewCard
                        key={item.id}
                        item={item}
                        onAccept={() => setStatus(item.id, 'accepted')}
                        onReject={() => setStatus(item.id, 'rejected')}
                        onEdit={(field, val) => updateItemField(item.id, field, val)}
                        onToggle={() => toggleExpand(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* AI metadata */}
            {aiMeta && (
              <div style={{
                marginTop: 28, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden',
              }}>
                <details>
                  <summary style={{
                    padding: '12px 18px', cursor: 'pointer', color: '#64748B', fontSize: 13,
                    userSelect: 'none',
                  }}>
                    ↳ AI extraction metadata (data used, assumptions, gaps)
                  </summary>
                  <div className="dq-grid-2">
                    <MetaSection title="Data Used" items={aiMeta.dataUsed} color="#10B981" />
                    <MetaSection title="Missing Data" items={aiMeta.missingData} color="#EF4444" />
                    <MetaSection title="Assumptions Made" items={aiMeta.assumptionsMade} color="#F59E0B" />
                    <MetaSection title="Suggested Next Actions" items={aiMeta.suggestedNextActions} color="#6366F1" />
                  </div>
                </details>
              </div>
            )}

            {/* Launch CTA */}
            <div className="dq-launch-bar" style={{
              marginTop: 32, padding: '24px 28px',
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
              borderRadius: 14,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  Ready to launch with {accepted + edited} accepted item{accepted + edited !== 1 ? 's' : ''}
                </div>
                <div style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
                  {pending > 0
                    ? `${pending} item${pending !== 1 ? 's' : ''} still pending — accept or reject before launching`
                    : missingFieldsList.length > 0
                    ? `All items reviewed. ${missingFieldsList.length} field${missingFieldsList.length !== 1 ? 's' : ''} will need to be completed in Problem Frame.`
                    : 'All items reviewed. Your session will be pre-loaded with your selections.'}
                </div>
              </div>
              <button
                onClick={handleLaunch}
                disabled={accepted + edited === 0}
                style={{
                  background: accepted + edited > 0 ? 'linear-gradient(135deg, #C9A84C, #E8D69B)' : 'rgba(255,255,255,0.06)',
                  border: 'none', borderRadius: 10, padding: '12px 28px',
                  color: accepted + edited > 0 ? '#0B1D3A' : '#475569',
                  fontWeight: 800, fontSize: 15, cursor: accepted + edited > 0 ? 'pointer' : 'not-allowed',
                  letterSpacing: 0.3, whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >Launch Session →</button>
            </div>
          </div>
        )}

        {/* ── LAUNCHING PHASE ── */}
        {phase === 'launching' && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>◆</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Building your session…</div>
            <div style={{ color: '#64748B', fontSize: 14 }}>Writing {accepted + edited} validated items to modules</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function FilterTab({ label, value, active, onClick, count, color }: any) {
  const isActive = active === value;
  return (
    <button onClick={() => onClick(value)} className="dq-filter-tab" style={{
      background: isActive ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isActive ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 8, padding: '6px 14px',
      color: isActive ? '#C9A84C' : '#64748B',
      cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 600 : 400,
      display: 'flex', alignItems: 'center', gap: 6,
      transition: 'all 0.15s',
    }}>
      {label}
      <span style={{
        background: color ? `${color}22` : 'rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '1px 7px', fontSize: 11,
        color: color ?? '#94A3B8',
      }}>{count}</span>
    </button>
  );
}

function ReviewCard({ item, onAccept, onReject, onEdit, onToggle }: {
  item: ReviewItem;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (field: string, val: unknown) => void;
  onToggle: () => void;
}) {
  const conf = confidenceLabel(item.confidenceScore);
  const title = getItemTitle(item);
  const sub = getItemSub(item);
  const isAccepted = item.status === 'accepted' || item.status === 'edited';
  const isRejected = item.status === 'rejected';

  return (
    <div style={{
      background: isAccepted ? 'rgba(16,185,129,0.06)' : isRejected ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isAccepted ? 'rgba(16,185,129,0.25)' : isRejected ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 10, overflow: 'hidden',
      opacity: isRejected ? 0.5 : 1,
      transition: 'all 0.2s',
    }}>
      {/* Card header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Status indicator */}
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          background: isAccepted ? '#10B981' : isRejected ? '#EF4444' : '#334155',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#fff',
        }}>
          {isAccepted ? '✓' : isRejected ? '✗' : '?'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dq-card-title" style={{ fontWeight: 600, fontSize: 14, color: '#E2E8F0', lineHeight: 1.4, marginBottom: sub ? 4 : 0 }}>
            {title}
          </div>
          {sub && (
            <div className="dq-card-sub" style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
              {sub.length > 120 ? sub.slice(0, 120) + '…' : sub}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(item as any).extractionStatus && (
              <span style={{
                borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                background: (item as any).extractionStatus === 'EXPLICIT' ? 'rgba(16,185,129,0.15)' : (item as any).extractionStatus === 'PARTIALLY_STATED' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: (item as any).extractionStatus === 'EXPLICIT' ? '#10B981' : (item as any).extractionStatus === 'PARTIALLY_STATED' ? '#F59E0B' : '#EF4444',
                border: `1px solid ${(item as any).extractionStatus === 'EXPLICIT' ? 'rgba(16,185,129,0.3)' : (item as any).extractionStatus === 'PARTIALLY_STATED' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {(item as any).extractionStatus === 'EXPLICIT' ? '◆ EXPLICIT' : (item as any).extractionStatus === 'PARTIALLY_STATED' ? '◇ PARTIAL' : '△ MISSING'}
              </span>
            )}
            <span className="dq-confidence-badge" style={{
              background: conf.bg, color: conf.color,
              borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
            }}>{conf.text} · {Math.round(item.confidenceScore * 100)}%</span>
            {item.sourceQuote && (
              <span className="dq-source-quote" style={{
                background: 'rgba(99,102,241,0.12)', color: '#A5B4FC',
                borderRadius: 6, padding: '2px 8px', fontSize: 11,
                maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                " {item.sourceQuote} "
              </span>
            )}
            {item.status === 'edited' && (
              <span style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                edited
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <button onClick={onToggle} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#64748B',
            fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{item.isExpanded ? '▲' : '▼'}</button>
          <button onClick={onReject} title="Reject" style={{
            background: isRejected ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isRejected ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6, width: 32, height: 32, cursor: 'pointer',
            color: isRejected ? '#FCA5A5' : '#64748B', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>✗</button>
          <button onClick={onAccept} title="Accept" style={{
            background: isAccepted ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isAccepted ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6, width: 32, height: 32, cursor: 'pointer',
            color: isAccepted ? '#34D399' : '#64748B', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>✓</button>
        </div>
      </div>

      {/* Expanded edit section */}
      {item.isExpanded && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <InlineEditor item={item} onEdit={onEdit} />
        </div>
      )}
    </div>
  );
}

function InlineEditor({ item, onEdit }: { item: ReviewItem; onEdit: (f: string, v: unknown) => void }) {
  const d = item.editedData ?? item.data;

  const field = (label: string, key: string, multiline = false) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={(d[key] as string) ?? ''}
          onChange={e => onEdit(key, e.target.value)}
          rows={3}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7,
            padding: '8px 12px', color: '#E2E8F0', fontSize: 13, lineHeight: 1.5,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      ) : (
        <input
          value={(d[key] as string) ?? ''}
          onChange={e => onEdit(key, e.target.value)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7,
            padding: '8px 12px', color: '#E2E8F0', fontSize: 13,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );

  if (item.targetType === 'problem_frame') return (
    <div>
      {field('Decision Statement', 'decisionStatement')}
      {field('Context', 'context', true)}
      {field('Decision Owner', 'decisionOwner')}
      {field('Trigger', 'trigger')}
    </div>
  );

  if (item.targetType === 'issue') return (
    <div>{field('Label', 'label')}{field('Description', 'description', true)}</div>
  );

  if (item.targetType === 'strategy') return (
    <div>{field('Name', 'name')}{field('Tagline', 'tagline')}{field('Description', 'description', true)}</div>
  );

  if (item.targetType === 'stakeholder') return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
      {field('Name', 'name')}{field('Role', 'role')}
    </div>
  );

  if (item.targetType === 'risk_item') return (
    <div>{field('Label', 'label')}</div>
  );

  return <div>{field('Label', 'label')}</div>;
}

function MetaSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
        {items.map((item: string, i: number) => (
          <li key={i} style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4, lineHeight: 1.5 }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
