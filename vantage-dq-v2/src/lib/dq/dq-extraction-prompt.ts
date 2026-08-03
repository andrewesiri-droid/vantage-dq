/**
 * Vantage DQ — Document Extraction Engine
 *
 * Built on established Decision Analysis methodology.
 * Every extraction rule is grounded in DQ principles.
 *
 * CORE PHILOSOPHY:
 * - EXPLICIT only: if it is not stated in the document, it does not exist
 * - NEVER infer: inference is the human's job, not the AI's
 * - CITE everything: every field must have a source quote or be flagged MISSING
 * - LABEL clearly: every field is EXPLICIT, MISSING, or PARTIALLY_STATED
 * - ROUTE to human: missing fields become human tasks, not AI guesses
 */

// ─────────────────────────────────────────────────────────────
// EXTRACTION CONFIDENCE LEVELS
// ─────────────────────────────────────────────────────────────

export type ExtractionStatus =
  | 'EXPLICIT'          // Directly and unambiguously stated in the document
  | 'PARTIALLY_STATED'  // Present but incomplete — needs human completion
  | 'MISSING';          // Not in the document at all — route to human

export interface ExtractedField<T = string> {
  value: T | null;
  status: ExtractionStatus;
  sourceQuote: string | null;   // Exact phrase from document (≤25 words) or null
  confidence: number;           // 0.0–1.0 — only meaningful if EXPLICIT or PARTIALLY_STATED
  humanTask: string | null;     // What the human needs to fill in if MISSING or PARTIALLY_STATED
}

// ─────────────────────────────────────────────────────────────
// EXTRACTION RESULT SCHEMA
// ─────────────────────────────────────────────────────────────

export interface DQExtractionResult {
  // ── Session metadata ──────────────────────────────────────
  sessionName: string;
  documentType: string;           // What kind of document this appears to be
  overallConfidence: number;      // 0.0–1.0 overall extraction quality
  extractionNotes: string;        // 2–3 sentences on doc quality and completeness
  humanReviewFlags: string[];     // Items requiring human judgment before proceeding

  // ── DQ Background Outputs (pre-frame) ──────────────────────
  // These are the 6 things that must be established BEFORE writing the frame

  trigger: ExtractedField;        // What specific event is forcing a decision NOW
  whatWeKnow: ExtractedField;     // Explicitly stated facts and confirmed data
  whatWeDoNotKnow: ExtractedField; // Explicitly stated uncertainties and data gaps
  alreadyDecided: ExtractedField; // Explicitly fixed constraints and non-negotiables
  stakeholderLandscape: ExtractedField; // Who has a stake and what their position is
  alternativeFramings: ExtractedField;  // Other ways this situation could be framed

  // ── Problem Frame Fields ──────────────────────────────────
  decisionStatement: ExtractedField;
  context: ExtractedField;        // Key questions this evaluation must answer
  decisionOwner: ExtractedField;  // One named person — not a committee
  deadline: ExtractedField;       // Concrete date or timeframe
  scopeIn: ExtractedField<string[]>;
  scopeOut: ExtractedField<string[]>;
  constraints: ExtractedField<string[]>;
  assumptions: ExtractedField<string[]>;
  successCriteria: ExtractedField<string[]>;
  failureConsequences: ExtractedField;
  perspective: ExtractedField;    // Whose lens this is framed from

  // ── Downstream Module Seeds ───────────────────────────────
  initialIssues: DQIssueExtraction[];
  strategyCandidates: DQStrategyExtraction[];
  stakeholders: DQStakeholderExtraction[];
  risks: DQRiskExtraction[];
  decisionHierarchyCandidates: DQDecisionNodeExtraction[];

  // ── AI Metadata ───────────────────────────────────────────
  dataUsed: string[];
  missingData: string[];
  assumptionsMade: string[];      // Should be empty if extraction is truly strict
  suggestedNextActions: string[]; // What the human should do next
}

export interface DQIssueExtraction {
  label: string;
  category: string;
  description: string;
  status: ExtractionStatus;
  sourceQuote: string | null;
  confidence: number;
}

export interface DQStrategyExtraction {
  name: string;
  description: string;
  tagline: string;
  status: ExtractionStatus;
  sourceQuote: string | null;
  confidence: number;
}

export interface DQStakeholderExtraction {
  name: string;
  role: string;
  influence: number;      // 0–100
  interest: number;       // 0–100
  alignment: 'champion' | 'supporter' | 'neutral' | 'skeptic' | 'blocker';
  status: ExtractionStatus;
  sourceQuote: string | null;
  confidence: number;
}

export interface DQRiskExtraction {
  label: string;
  likelihood: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
  rationale: string;
  status: ExtractionStatus;
  confidence: number;
}

export interface DQDecisionNodeExtraction {
  label: string;
  type: 'big_arrow' | 'strategic' | 'tactical' | 'operational';
  rationale: string;
  status: ExtractionStatus;
  confidence: number;
}

// ─────────────────────────────────────────────────────────────
// DQ EXTRACTION SYSTEM PROMPT
// This replaces the generic "Decision Quality expert" system prompt.
// Injected into every extraction API call.
// ─────────────────────────────────────────────────────────────

export const DQ_EXTRACTION_SYSTEM_PROMPT = `You are a Decision Quality extraction engine trained in the Decision Analysis methodology of established Decision Analysis methodology and Decision Quality DQ methodology.

YOUR ONLY JOB: Extract what is explicitly stated in the document. You are not an analyst. You are a precise extraction engine.

═══ THE IRON RULE ════════════════════════════════════════════════════════════════

EXPLICIT ONLY. If a piece of information is not stated in the document in clear, unambiguous language, it does not exist for the purposes of this extraction. You must not:
- Infer from context
- Complete partial information with domain knowledge
- Assume standard industry practices fill in gaps
- Use your training data to fill missing fields
- Extrapolate from related information in the document

If information is not there, the field status is MISSING and the human must supply it.

═══ STATUS LABELS — USE THESE PRECISELY ═════════════════════════════════════════

EXPLICIT: The document states this directly, clearly, and without ambiguity.
  Example: "The decision must be made by Q3 2025" → deadline is EXPLICIT

PARTIALLY_STATED: The document mentions this but incompletely.
  Example: "We need to consider budget" → constraint is PARTIALLY_STATED (no amount given)

MISSING: This field is not addressed in the document at all.
  Example: No deadline mentioned anywhere → deadline is MISSING

NEVER use EXPLICIT if you had to interpret, infer, or assume anything.

═══ SOURCE QUOTE RULES ══════════════════════════════════════════════════════════

Every EXPLICIT or PARTIALLY_STATED field MUST include a sourceQuote:
- Copy the exact words from the document (max 25 words)
- Do not paraphrase — exact text only
- If you cannot find the exact text that supports a field, the status must be MISSING, not EXPLICIT

MISSING fields always have sourceQuote: null

═══ DQ 6 BACKGROUND OUTPUTS ══════════════════════════════════════════════

Before building the problem frame, DQ methodology requires these 6 things to be established.
Extract them with the same strictness:

1. TRIGGER: What specific event, deadline, pressure, or window is forcing a decision NOW?
   - Must be a named, specific forcing condition — not general context
   - "The market is changing" is NOT a trigger — it is background
   - "The regulatory deadline is June 30" IS a trigger

2. WHAT WE KNOW: Explicitly stated facts, confirmed data, completed analyses
   - Must distinguish from estimates, projections, and assumptions
   - Do not include anything presented as uncertain or forward-looking

3. WHAT WE DO NOT KNOW: Explicitly stated uncertainties, data gaps, open questions
   - Only include uncertainties the document explicitly acknowledges
   - Do not add uncertainties you think should exist

4. ALREADY DECIDED: Explicitly stated fixed constraints, non-negotiables, prior decisions
   - "Budget is capped at $50M" is ALREADY DECIDED
   - "We prefer option A" is NOT already decided — it is a preference

5. STAKEHOLDER LANDSCAPE: Named parties with explicitly stated interests or positions
   - Must be named — not "some stakeholders" or "leadership"
   - Position must be stated — not inferred from their role

6. ALTERNATIVE FRAMINGS: Other ways this same situation could be framed
   - Only include if the document explicitly mentions alternative approaches considered
   - Do not generate alternatives yourself

═══ DECISION FRAME EXTRACTION RULES ════════════════════════════════════════════

DECISION STATEMENT:
- Must be an open question ("How should we…?", "Whether to…?", "Which…?")
- If the document states a conclusion ("We should do X"), this is NOT a decision statement — flag it as PARTIALLY_STATED with humanTask: "Reframe as an open question"
- If no decision statement exists, status is MISSING

DECISION OWNER EXTRACTION RULES:
- Look for: named individuals, job titles, committees, boards, or organizational roles
- "Management", "the board", "CEO", "the investment committee", "the project team" are all valid owners
- If a group is divided or disagreeing, the owner is the person/role who must break the tie
- If the document mentions "the board has approved" or "management has decided", the owner is that body
- PARTIALLY_STATED if a group is named but no individual — flag for human to name the specific person
- Only MISSING if no organizational entity is referenced at all

DECISION DEADLINE EXTRACTION RULES:
- Look for: license expiry dates, regulatory deadlines, fiscal year ends, board meeting dates, partner deadlines
- "License expires in three years", "before the next licensing round", "prior to FID" are all valid deadlines
- Convert relative timeframes to approximate dates using context clues
- "Three-year license expiry" with no start date → PARTIALLY_STATED, humanTask: "Confirm exact license expiry date"
- Only MISSING if absolutely no time pressure or deadline is mentioned anywhere in the document

DECISION OWNER:
- Must be a named individual — not a role, team, or committee
- "The executive team" is NOT an owner — flag as PARTIALLY_STATED
- "Jane Smith, CEO" IS an owner — EXPLICIT

DEADLINE:
- Must be a concrete date, quarter, or timeframe — not "soon" or "urgently"
- "We need to move quickly" is NOT a deadline — MISSING
- "By end of Q2 2025" IS a deadline — EXPLICIT

SCOPE:
- In scope: what assets, geographies, time periods, business units, or options ARE being decided
- Extract from: named entities, assets, projects, business units, products, markets mentioned as the subject of the decision
- Infer: if the document is about a specific project/asset/market, that project/asset/market is in scope
- Infer: all options being compared are in scope
- Out of scope: what is explicitly excluded OR clearly not being decided now
- Infer: things deferred to a later decision, things outside the decision-maker's control, alternatives already eliminated
- Always extract 2-4 items per category — PARTIALLY_STATED if inferred rather than explicitly listed

SUCCESS CRITERIA:
- What does success look like for the decision-maker?
- Extract from ANY language expressing: goals, objectives, desired outcomes, things to maximize/minimize/protect
- Value signals: "maximize", "optimize", "increase", "grow", "capture", "returns", "profitability", "NPV", "value"
- Risk signals: "minimize", "avoid", "protect", "reduce exposure", "manage risk", "not exceed budget"
- Relationship signals: "maintain", "strengthen", "preserve", "regulatory", "stakeholder", "partnership"
- Time signals: "early mover advantage", "secure terms before", "lock in", "first to market"
- Operational signals: "deliver on time", "within budget", "meet commitment", "fulfill obligation"
- Always extract 2-4 success criteria from any business document — PARTIALLY_STATED if inferred

PERSPECTIVE:
- Whose interests and constraints frame this entire document?
- Ask: who is described as "we"? Whose balance sheet matters? Who made the commitment?
- Ask: who commissioned this analysis? Who must live with the consequences?
- Extract as: "[Organization/Role] as [their relationship to the decision]"
- Examples of universal patterns: "Company X as project proponent", "Board as approving authority", 
  "Business unit Y as operator", "Management team as decision-makers", "Partnership as joint venture operator"
- Always extract — PARTIALLY_STATED if inferred, never leave blank if any organization appears in document

═══ DOWNSTREAM MODULE EXTRACTION RULES ══════════════════════════════════════════

ISSUES:
- Only extract issues explicitly identified as problems, risks, concerns, or gaps
- Do not generate issues you think should exist
- Each issue must have a sourceQuote

STRATEGIES:
- Only extract explicitly named strategic options or alternatives
- "We could consider X" qualifies if X is named
- Do not generate strategies from the decision context

STAKEHOLDERS:
- Must be named individuals or named groups
- Influence (0–100) and interest (0–100) must be inferred from stated information ONLY
- If influence/interest cannot be determined from the document, set to 50 and flag
- Alignment must come from explicitly stated positions, not assumed from role

RISKS:
- Only extract risks explicitly identified in the document
- Likelihood and impact must come from stated language ("high risk", "unlikely", etc.)
- If likelihood/impact not stated, default to Medium and flag as PARTIALLY_STATED

═══ FORBIDDEN OUTPUTS ════════════════════════════════════════════════════════════

BOARD-READY EXTRACTION STANDARDS:

DECISION STATEMENT: Must be specific, named, and board-ready.
- Include: company name, asset names, key constraints, key tension
- Format: "How should [Company] [specific action] given [specific context]?"
- NEVER use generic language like "get maximum value" or "determine best strategy"
- If document implies a decision poorly, craft a precise version using only explicit document facts

STRATEGIES: Only genuine strategic paths — never information-gathering actions.
- A strategy commits to a direction: a named path, a resource allocation choice, a market move, a build/buy/partner decision
- Information-gathering is NOT a strategy: "conduct study", "gather data", "run analysis", "appraise further", "test before deciding"
- Information actions belong in uncertainties or issues

BRUTAL TRUTH: Always surface the uncomfortable reality.
- Look for what the document dances around but never states directly
- Ask: is the core assumption driving this decision actually true? Is the team avoiding this question?
- Flag this explicitly in issues with high confidence if evidence supports it

FARM-DOWN / PARTNER DECISIONS: Always a Focus Decision if it affects strategy sequencing.

SUCCESS CRITERIA: If missing, flag prominently in humanReviewFlags — never invent them.

NEVER:
- Fill a MISSING field with a plausible guess
- Use "typically" or "usually" to justify an extraction
- Add issues, risks, or criteria that seem relevant but aren't in the document
- Reframe a conclusion as a decision statement without flagging it
- Assign EXPLICIT status to anything you inferred
- Use your training data to complete partial information

ALWAYS:
- Return null for missing sourceQuotes
- Set status MISSING when the field is not in the document
- Provide a humanTask for every MISSING or PARTIALLY_STATED field
- Be more conservative than you think you need to be

═══ CONFIDENCE SCORING ══════════════════════════════════════════════════════════

0.9–1.0: Unambiguous, directly stated, exact quote available
0.7–0.89: Clearly stated but requires minor interpretation of phrasing
0.5–0.69: PARTIALLY_STATED — present but incomplete
0.0–0.49: Do not use — if confidence is this low, status should be MISSING

Respond ONLY with valid JSON. No markdown, no preamble, no explanation.`;

// ─────────────────────────────────────────────────────────────
// EXTRACTION PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

export function buildExtractionPrompt(document: string): string {
  return `Extract all decision-relevant information from this document following the strict rules in your system prompt.

RECOGNIZED DECISION FRAMEWORKS FIELD LABELS:
If the document uses any of these exact labels, map them as follows:
- "Decision Statement" or "Decision Problem Statement" → decisionStatement
- "Driver for a decision at this time" or "Driver" → trigger
- "Values/Objectives to select the strategy" or "Values & Objectives" → successCriteria
- "Key questions the decision evaluation needs to answer" → context
- "Givens/decisions made which set the decision scope" or "Givens & Constraints" → constraints + alreadyDecided
- "Background & History" or "Background" → whatWeKnow + context
- "Decision Executive" → stakeholders (role: Decision Executive, high influence)
- "Guiding Decision Makers" → stakeholders (role: Guiding Decision Maker)
- "Project Lead" → stakeholders (role: Project Lead)
- "Decision Facilitator" → stakeholders (role: Decision Facilitator)
- "Project Team" → stakeholders (role: Project Team)
- "Subject Matter Experts" or "SMEs" → stakeholders (role: SME)
- "In Scope" → scopeIn
- "Out of Scope" → scopeOut
- "Assumptions" → assumptions
- "Cost of a Wrong Decision" or "Failure Consequences" → failureConsequences
- "Decision Owner" or "Decision Executive" → decisionOwner
- "Deadline" or "Decision Deadline" or "Time Horizon" → deadline

REQUIRED OUTPUT — return ONLY this JSON structure, nothing else:

{
  "sessionName": string,
  "documentType": string,
  "overallConfidence": number,
  "extractionNotes": string,
  "humanReviewFlags": string[],

  "trigger": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "whatWeKnow": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "whatWeDoNotKnow": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "alreadyDecided": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "stakeholderLandscape": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "alternativeFramings": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "decisionStatement": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "context": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "decisionOwner": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "deadline": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "scopeIn": {
    "value": string[] | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "scopeOut": {
    "value": string[] | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "constraints": {
    "value": string[] | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "assumptions": {
    "value": string[] | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "successCriteria": {
    "value": string[] | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "failureConsequences": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "perspective": {
    "value": string | null,
    "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
    "sourceQuote": string | null,
    "confidence": number,
    "humanTask": string | null
  },

  "initialIssues": [
    {
      "label": string,
      "category": string,
      "description": string,
      "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
      "sourceQuote": string | null,
      "confidence": number
    }
  ],

  "strategyCandidates": [
    {
      "name": string,
      "description": string,
      "tagline": string,
      "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
      "sourceQuote": string | null,
      "confidence": number
    }
  ],

  "stakeholders": [
    {
      "name": string,
      "role": string,
      "influence": number,
      "interest": number,
      "alignment": "champion" | "supporter" | "neutral" | "skeptic" | "blocker",
      "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
      "sourceQuote": string | null,
      "confidence": number
    }
  ],

  "risks": [
    {
      "label": string,
      "likelihood": "Low" | "Medium" | "High",
      "impact": "Low" | "Medium" | "High",
      "rationale": string,
      "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
      "confidence": number
    }
  ],

  "decisionHierarchyCandidates": [
    {
      "label": string,
      "type": "big_arrow" | "strategic" | "tactical" | "operational",
      "rationale": string,
      "status": "EXPLICIT" | "PARTIALLY_STATED" | "MISSING",
      "confidence": number
    }
  ],

  "dataUsed": string[],
  "missingData": string[],
  "assumptionsMade": string[],
  "suggestedNextActions": string[]
}

DOCUMENT:
${document}`;
}

// ─────────────────────────────────────────────────────────────
// RESULT CONVERTER
// Converts new strict extraction result to ReviewQueueItems
// Maps MISSING fields to human tasks, not empty items
// ─────────────────────────────────────────────────────────────

export function extractionToReviewItems(result: DQExtractionResult): {
  items: any[];
  missingFields: { field: string; humanTask: string }[];
} {
  const now = new Date().toISOString();
  const items: any[] = [];
  const missingFields: { field: string; humanTask: string }[] = [];
  const makeId = () => `rq_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  const session_id = '__pending__';

  // ── Helper: check if field should become a review item or a human task ──
  const processField = (
    fieldName: string,
    field: ExtractedField<any>,
    humanFriendlyName: string
  ) => {
    if (field.status === 'MISSING') {
      missingFields.push({
        field: humanFriendlyName,
        humanTask: field.humanTask ?? `Please provide: ${humanFriendlyName}`,
      });
    }
  };

  // Route missing background fields to human tasks
  processField('trigger', result.trigger, 'Decision Trigger — what is forcing a decision now?');
  processField('whatWeKnow', result.whatWeKnow, 'What We Know — confirmed facts and data');
  processField('whatWeDoNotKnow', result.whatWeDoNotKnow, 'What We Don\'t Know — uncertainties and gaps');
  processField('alreadyDecided', result.alreadyDecided, 'Already Decided — fixed constraints and prior decisions');
  processField('alternativeFramings', result.alternativeFramings, 'Alternative Framings — other ways to frame this situation');
  processField('decisionOwner', result.decisionOwner, 'Decision Owner — one named person accountable for this decision');
  processField('deadline', result.deadline, 'Decision Deadline — concrete date or timeframe');
  processField('perspective', result.perspective, 'Decision Perspective — whose lens this is framed from');

  // ── Problem Frame — only include if decision statement is EXPLICIT or PARTIALLY_STATED ──
  if (result.decisionStatement.status !== 'MISSING') {
    items.push({
      id: makeId(), session_id,
      targetType: 'problem_frame', targetModule: 'problem',
      data: {
        decisionStatement: result.decisionStatement.value ?? '',
        context: result.context.value ?? '',
        decisionOwner: result.decisionOwner.value ?? '',
        deadline: result.deadline.value ?? '',
        trigger: result.trigger.value ?? '',
        scopeIn: result.scopeIn.value ?? [],
        scopeOut: result.scopeOut.value ?? [],
        constraints: result.constraints.value ?? [],
        assumptions: result.assumptions.value ?? [],
        successCriteria: result.successCriteria.value ?? [],
        failureConsequences: result.failureConsequences.value ?? '',
        perspective: result.perspective.value ?? '',
        whatWeKnow: result.whatWeKnow.value ?? '',
        whatWeDoNotKnow: result.whatWeDoNotKnow.value ?? '',
        alreadyDecided: result.alreadyDecided.value ?? '',
      },
      confidenceScore: result.decisionStatement.confidence,
      sourceQuote: result.decisionStatement.sourceQuote,
      extractionStatus: result.decisionStatement.status,
      extractionRationale: `Decision statement extracted from document. Status: ${result.decisionStatement.status}.`,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    });
  } else {
    missingFields.push({
      field: 'Decision Statement',
      humanTask: result.decisionStatement.humanTask ?? 'Write the decision statement as an open question — How should we…? / Whether to…?',
    });
  }

  // ── Issues ──
  (result.initialIssues ?? []).forEach(issue => {
    if (issue.status === 'MISSING') return; // skip ghost items
    items.push({
      id: makeId(), session_id,
      targetType: 'issue', targetModule: 'issues',
      data: { label: issue.label, category: issue.category, description: issue.description },
      confidenceScore: issue.confidence,
      sourceQuote: issue.sourceQuote,
      extractionStatus: issue.status,
      extractionRationale: issue.description,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    });
  });

  // ── Strategies ──
  (result.strategyCandidates ?? []).forEach(strat => {
    if (strat.status === 'MISSING') return;
    items.push({
      id: makeId(), session_id,
      targetType: 'strategy', targetModule: 'strategy',
      data: { name: strat.name, description: strat.description, tagline: strat.tagline },
      confidenceScore: strat.confidence,
      sourceQuote: strat.sourceQuote,
      extractionStatus: strat.status,
      extractionRationale: strat.description,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    });
  });

  // ── Stakeholders ──
  (result.stakeholders ?? []).forEach(s => {
    if (s.status === 'MISSING') return;
    items.push({
      id: makeId(), session_id,
      targetType: 'stakeholder', targetModule: 'stakeholders',
      data: { name: s.name, role: s.role, influence: s.influence, interest: s.interest, alignment: s.alignment },
      confidenceScore: s.confidence,
      sourceQuote: s.sourceQuote,
      extractionStatus: s.status,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    });
  });

  // ── Risks ──
  (result.risks ?? []).forEach(r => {
    if (r.status === 'MISSING') return;
    items.push({
      id: makeId(), session_id,
      targetType: 'risk_item', targetModule: 'risk-timeline',
      data: { label: r.label, likelihood: r.likelihood, impact: r.impact },
      confidenceScore: r.confidence,
      extractionStatus: r.status,
      extractionRationale: r.rationale,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    });
  });

  // ── Decision Hierarchy ──
  (result.decisionHierarchyCandidates ?? []).forEach(node => {
    if (node.status === 'MISSING') return;
    items.push({
      id: makeId(), session_id,
      targetType: 'decision_node', targetModule: 'hierarchy',
      data: { label: node.label, type: node.type, rationale: node.rationale },
      confidenceScore: node.confidence,
      extractionStatus: node.status,
      extractionRationale: node.rationale,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    });
  });

  // ── Success criteria as individual items ──
  (result.successCriteria.value ?? []).forEach(criterion => {
    items.push({
      id: makeId(), session_id,
      targetType: 'criterion', targetModule: 'assessment',
      data: { label: criterion, weight: 0.5 },
      confidenceScore: result.successCriteria.confidence,
      sourceQuote: result.successCriteria.sourceQuote,
      extractionStatus: result.successCriteria.status,
      status: 'pending', created_at: now,
      createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
    });
  });

  return { items, missingFields };
}

// ─────────────────────────────────────────────────────────────
// STATUS DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────

export function getStatusBadge(status: ExtractionStatus) {
  const map = {
    EXPLICIT: {
      label: 'Explicit',
      color: '#059669',
      bg: '#DCFCE7',
      icon: '◆',
      description: 'Directly stated in the document',
    },
    PARTIALLY_STATED: {
      label: 'Partial',
      color: '#D97706',
      bg: '#FEF3C7',
      icon: '◇',
      description: 'Present but incomplete — review carefully',
    },
    MISSING: {
      label: 'Missing',
      color: '#DC2626',
      bg: '#FEF2F2',
      icon: '△',
      description: 'Not in the document — human must supply',
    },
  };
  return map[status];
}

export function getConfidenceBadge(confidence: number) {
  if (confidence >= 0.85) return { text: 'High confidence', color: '#10B981', bg: '#ECFDF5' };
  if (confidence >= 0.6)  return { text: 'Medium confidence', color: '#D97706', bg: '#FFFBEB' };
  return                         { text: 'Low confidence', color: '#EF4444', bg: '#FEF2F2' };
}
