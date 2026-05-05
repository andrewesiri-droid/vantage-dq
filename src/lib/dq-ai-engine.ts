/**
 * Vantage DQ — AI Trustworthiness Engine
 * 
 * Implements 4 layers of AI output verification:
 * 
 * Layer 1: DQ Constitution — every prompt carries explicit DQ standards
 * Layer 2: Self-Critique — AI checks its own output before returning it
 * Layer 3: Grounding — AI cites the specific data behind every claim
 * Layer 4: Confidence Scoring — AI rates certainty and flags weak conclusions
 * 
 * Research basis:
 * - Constitutional AI (Anthropic, 2022): self-critique against explicit principles
 * - Self-consistency (Wang et al., 2022): verify outputs against reasoning chain
 * - Chain-of-thought verification: decompose and check each reasoning step
 * - Uncertainty quantification: score confidence, flag low-confidence outputs
 */

// ── DQ CONSTITUTION ────────────────────────────────────────────────────────────
// These are the immutable DQ principles every AI output is checked against
export const DQ_CONSTITUTION = `
DECISION QUALITY CONSTITUTION — VANTAGE DQ PLATFORM
Every AI output MUST comply with all of the following standards.

═══ THE 6 DQ ELEMENTS ═══════════════════════════════════════════════════════════

FRAME (Appropriate Frame):
✓ Decision statements must be open questions ("Which...?", "How should...?", "What...?")
✓ They must not be disguised situation descriptions or goals
✓ Scope must be explicitly bounded (in scope AND out of scope)
✓ A clear decision owner and deadline must exist or be flagged as missing
✗ VIOLATION: Describing a situation without a clear choice to be made
✗ VIOLATION: Frame so broad it cannot produce a clear commitment

ALTERNATIVES (Creative Alternatives):
✓ At least 3 alternatives must be present
✓ Alternatives must be GENUINELY distinct — different logic, not just scale variations
✓ The null alternative (do nothing) must be considered
✓ Alternatives must be actionable and within the decision-maker's control
✗ VIOLATION: Two alternatives that make the same choices on all key dimensions
✗ VIOLATION: Only one alternative is explored in depth

INFORMATION (Meaningful Information):
✓ Only information that could CHANGE the decision has value
✓ Uncertainty must be explicitly quantified or acknowledged
✓ Critical information gaps must be named, not papered over
✓ Past data ≠ future certainty — distinguish what is known vs assumed
✗ VIOLATION: False precision — stating a number without acknowledging its uncertainty
✗ VIOLATION: Omitting known data gaps to create false confidence

VALUES (Clear Values):
✓ Criteria must reflect actual stakeholder values, not proxy metrics
✓ Trade-offs must be made explicit — not hidden behind weighted sums
✓ The criteria used for evaluation must match the stated objectives
✓ Weighting must be defensible and acknowledged as a value judgment
✗ VIOLATION: Using a financial metric as a proxy when the real value is strategic
✗ VIOLATION: Hiding a value judgment inside a technical assessment

REASONING (Sound Reasoning):
✓ Conclusions must follow logically from evidence, not preference
✓ Each recommendation must be traceable to specific data or analysis
✓ Assumptions must be stated — not embedded as hidden facts
✓ Alternative interpretations of the same data must be acknowledged
✗ VIOLATION: Recommending without citing the specific evidence
✗ VIOLATION: Treating an assumption as a fact

COMMITMENT (Commitment to Action):
✓ A DQ score below 40 on any element means commitment is premature
✓ The weakest element sets the ceiling, not the average
✓ Commitment language must be proportionate to DQ quality
✓ Conditions for revision must be stated with any commitment
✗ VIOLATION: Strong recommendation despite low DQ scores
✗ VIOLATION: No mention of what would change the recommendation

═══ AI CONDUCT STANDARDS ════════════════════════════════════════════════════════

GROUND every claim in session data. Do not invent.
DISTINGUISH: "The data shows..." vs "I assess that..." vs "Assumption: ..."  
FLAG: When session data is insufficient to support a strong conclusion
CALIBRATE: Never express more confidence than the data warrants
CHALLENGE: Surface uncomfortable truths the team may be avoiding
CITE: Every recommendation traces to specific session data
ESCALATE: Flag DQ violations clearly — do not smooth them over
CONSERVE: If in doubt, say "insufficient data" rather than fabricate

═══ FORBIDDEN OUTPUTS ════════════════════════════════════════════════════════════

NEVER invent financial figures not in the session data
NEVER recommend without citing supporting evidence
NEVER give a strong recommendation on a low-quality decision frame
NEVER hide an assumption as a stated fact
NEVER give false precision on uncertain estimates
NEVER ignore a critical DQ weakness to produce a cleaner narrative
NEVER produce a recommendation that contradicts a stated DQ score
`;

// ── SELF-CRITIQUE TEMPLATE ─────────────────────────────────────────────────────
export function buildSelfCritiquePrompt(
  originalPrompt: string,
  firstOutput: string,
  dqElement: string,
  sessionContext: string
): string {
  return `You are a senior DQ auditor reviewing an AI output from the Vantage DQ platform.

ORIGINAL TASK:
${originalPrompt}

AI OUTPUT TO REVIEW:
${firstOutput}

SESSION DATA USED:
${sessionContext}

DQ ELEMENT THIS OUTPUT RELATES TO: ${dqElement}

Apply the DQ Constitution to audit this output. Check:

1. GROUNDING: Is every claim traceable to session data provided? Flag any invented claims.
2. DQ COMPLIANCE: Does this output comply with DQ standards for ${dqElement}?
3. CALIBRATION: Is the confidence level appropriate? Any overconfident claims?
4. ASSUMPTION TRANSPARENCY: Are all assumptions explicitly labeled?
5. CONTRADICTION CHECK: Does anything contradict other session data?
6. MISSING FLAGS: What important caveats are missing?
7. VERDICT: Is this output trustworthy as-is, or does it need revision?

Return JSON:
{
  "overallVerdict": "TRUSTED" | "NEEDS_REVISION" | "REJECTED",
  "trustScore": 0-100,
  "groundingScore": 0-100,
  "dqComplianceScore": 0-100,
  "calibrationScore": 0-100,
  "inventedClaims": [string],
  "hiddenAssumptions": [string],
  "contradictions": [string],
  "missingCaveats": [string],
  "revisedOutput": string (improved version if NEEDS_REVISION, same as original if TRUSTED),
  "auditNarrative": string (2-sentence explanation for the user)
}`;
}

// ── GROUNDING PROMPT BUILDER ───────────────────────────────────────────────────
export function addGroundingInstructions(prompt: string, sessionData: Record<string, any>): string {
  const dataInventory = buildDataInventory(sessionData);
  
  return `${prompt}

═══ GROUNDING REQUIREMENTS ══════════════════════════════════════════════════════

You have access to the following session data. Ground every claim in this data.
Do NOT use general knowledge to fill gaps — flag them as missing instead.

AVAILABLE SESSION DATA:
${dataInventory}

GROUNDING RULES:
- Prefix claims from session data with: [Data: ...]
- Prefix your own assessments with: [Assessment: ...]
- Prefix assumptions with: [Assumption: ...]
- If data is insufficient, write: [Insufficient data — cannot determine...]
- NEVER invent numbers, names, dates, or facts not in the session data above

CITATION FORMAT:
Every recommendation must include which session data supports it.
Example: "Recommend Strategy Alpha [Data: highest score on Risk-adjusted NPV criterion, lowest regulatory risk rating among 3 strategies]"
`;
}

function buildDataInventory(sessionData: Record<string, any>): string {
  const lines: string[] = [];
  const session = sessionData?.session || {};
  
  if (session.decisionStatement) lines.push(`• Decision: "${session.decisionStatement}"`);
  if (session.context) lines.push(`• Context: ${session.context.slice(0, 200)}`);
  if (session.deadline) lines.push(`• Deadline: ${session.deadline}`);
  if (session.successCriteria) lines.push(`• Success criteria: ${session.successCriteria.slice(0, 150)}`);
  if (session.constraints) lines.push(`• Constraints: ${session.constraints.slice(0, 150)}`);
  
  const strategies = sessionData?.strategies || [];
  if (strategies.length) lines.push(`• Strategies (${strategies.length}): ${strategies.map((s: any) => s.name).join(', ')}`);
  
  const issues = sessionData?.issues || [];
  if (issues.length) {
    const critical = issues.filter((i: any) => i.severity === 'Critical');
    lines.push(`• Issues: ${issues.length} total, ${critical.length} critical`);
    critical.slice(0, 4).forEach((i: any) => lines.push(`  - [Critical/${i.category}] ${i.text}`));
  }
  
  const criteria = sessionData?.criteria || [];
  if (criteria.length) lines.push(`• Criteria: ${criteria.map((c: any) => `${c.label} (${c.weight})`).join(', ')}`);
  
  const uncertainties = sessionData?.uncertainties || [];
  if (uncertainties.length) lines.push(`• Uncertainties (${uncertainties.length}): ${uncertainties.slice(0, 4).map((u: any) => u.label).join('; ')}`);
  
  const risks = sessionData?.riskItems || [];
  if (risks.length) lines.push(`• Risks (${risks.length}): ${risks.slice(0, 4).map((r: any) => r.label).join('; ')}`);
  
  const stakeholders = sessionData?.stakeholderEntries || [];
  if (stakeholders.length) lines.push(`• Stakeholders (${stakeholders.length}): ${stakeholders.map((s: any) => `${s.name} (${s.alignment})`).join(', ')}`);
  
  const dqScores = session.dqScores || {};
  if (Object.keys(dqScores).length) {
    const scores = Object.entries(dqScores).map(([k, v]) => `${k}=${v}`).join(', ');
    const values = Object.values(dqScores) as number[];
    const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    lines.push(`• DQ Scores: ${scores}. Overall average: ${avg}/100`);
  }
  
  if (lines.length === 0) lines.push('• No session data available — flag all outputs as ungrounded');
  
  return lines.join('\n');
}

// ── CONFIDENCE SCORING SCHEMA ──────────────────────────────────────────────────
export interface AIOutputMetadata {
  trustScore: number;          // 0-100: overall trustworthiness
  groundingScore: number;      // 0-100: how well grounded in session data
  dqComplianceScore: number;   // 0-100: compliance with DQ standards
  calibrationScore: number;    // 0-100: appropriate confidence level
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  flags: AIFlag[];
  dataPointsUsed: string[];
  assumptionsMade: string[];
  caveatsRequired: string[];
  requiresHumanReview: boolean;
  auditNarrative: string;
}

export interface AIFlag {
  type: 'INVENTED_CLAIM' | 'HIDDEN_ASSUMPTION' | 'OVERCONFIDENT' | 'DQ_VIOLATION' | 'CONTRADICTION' | 'MISSING_CAVEAT';
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

// ── DQ ELEMENT VALIDATORS ──────────────────────────────────────────────────────
// These run BEFORE sending to AI — catch structural DQ problems
export function validateBeforeAI(
  module: string,
  sessionData: any,
): { canProceed: boolean; warnings: string[]; blockers: string[] } {
  // AI always runs — we just surface warnings if data is sparse
  const warnings: string[] = [];
  
  if (!sessionData?.decisionStatement) {
    warnings.push('No decision statement yet — add one in Problem Frame for better AI analysis.');
  }

  // Always allow AI to proceed
  return { canProceed: true, warnings, blockers: [] };
}

port function validateBeforeAI(
  module: string, 
  sessionData: Record<string, any>
): { canProceed: boolean; warnings: string[]; blockers: string[] } {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const session = sessionData?.session || {};
  const strategies = sessionData?.strategies || [];
  const dqScores = session.dqScores || {};

  // Universal checks
  if (!session.decisionStatement) {
    blockers.push('No decision statement — AI cannot generate meaningful analysis without a focal decision.');
  }

  // Module-specific checks
  switch (module) {
    case 'strategy-table':
      if (strategies.length === 0) warnings.push('No strategies yet — AI will suggest initial alternatives.');
      if (strategies.length === 1) warnings.push('Only 1 strategy — DQ requires at least 3 genuinely distinct alternatives.');
      break;

    case 'qualitative-assessment':
      if (strategies.length < 2) warnings.push('Only 1 strategy — AI will suggest additional alternatives to consider.');
      if ((sessionData?.criteria || []).length < 3) warnings.push('Fewer than 3 criteria — assessment may not capture full value picture.');
      break;

    case 'dq-scorecard':
      const scored = Object.values(dqScores).filter(v => (v as number) > 0).length;
      if (scored < 3) warnings.push('Only ' + scored + '/6 elements scored — AI auto-populate will be speculative.');
      break;

    case 'scenario-planning':
      if ((sessionData?.uncertainties || []).length < 2) warnings.push('Fewer than 2 uncertainties — scenario matrix will be weak.');
      break;

    case 'export-report':
      const dqVals = Object.values(dqScores) as number[];
      const dqAvg = dqVals.length ? dqVals.reduce((a, b) => a + b, 0) / dqVals.length : 0;
      if (dqAvg < 40) warnings.push(`DQ average score is ${Math.round(dqAvg)}/100 — consider strengthening decision quality before committing.`);
      const weakEls = Object.entries(dqScores).filter(([, v]) => (v as number) < 40);
      if (weakEls.length > 0) warnings.push(`Critical DQ weaknesses: ${weakEls.map(([k]) => k).join(', ')} all below 40. Report must flag these prominently.`);
      break;

    case 'stakeholder-alignment':
      if (!session.context) warnings.push('No context — stakeholder identification will be generic, not decision-specific.');
      break;

    case 'voi':
      if (strategies.length < 2) warnings.push('VOI is most meaningful when comparing multiple strategies — results may be limited.');
      break;
  }

  return { canProceed: blockers.length === 0, warnings, blockers };
}

// ── ENHANCED PROMPT BUILDER ────────────────────────────────────────────────────
// Wraps every AI prompt with DQ Constitution + grounding + confidence requirements
export function buildDQCompliantPrompt(
  rawPrompt: string,
  options: {
    module: string;
    dqElement: string;
    sessionData: Record<string, any>;
    requireSelfCritique?: boolean;
    confidenceRequired?: boolean;
  }
): string {
  const { module, dqElement, sessionData, requireSelfCritique = true, confidenceRequired = true } = options;
  
  const dataInventory = buildDataInventory(sessionData);
  
  const basePrompt = `${DQ_CONSTITUTION}

═══ YOUR TASK ════════════════════════════════════════════════════════════════════

MODULE: ${module}
DQ ELEMENT: ${dqElement}

TASK:
${rawPrompt}

═══ SESSION DATA (ground all claims in this) ════════════════════════════════════
${dataInventory}

═══ REQUIRED OUTPUT FORMAT ══════════════════════════════════════════════════════

Your response MUST include a "meta" section with:
- confidenceLevel: HIGH (strong data support) | MEDIUM (partial support) | LOW (limited data) | INSUFFICIENT_DATA
- dataPointsUsed: which session data points drove the main conclusions
- assumptionsMade: explicit list of assumptions you made
- dqWarnings: any DQ principle violations you detected in the current session data
- caveat: one honest statement about the limits of this analysis

${requireSelfCritique ? `
SELF-CRITIQUE REQUIREMENT:
After generating your main response, apply the DQ Constitution to critique it.
Ask yourself:
1. Did I invent any claim not grounded in session data?
2. Did I hide any assumption as a fact?
3. Is my confidence level appropriate to the data quality?
4. Does my recommendation comply with DQ standards?
If you find any violations, correct them before finalizing.
` : ''}

Return JSON with your main output fields PLUS a "meta" object containing the above.`;

  return basePrompt;
}

// ── OUTPUT TRUSTWORTHINESS CLASSIFIER ─────────────────────────────────────────
export function classifyOutputTrust(meta: any): {
  level: 'TRUSTED' | 'REVIEW_RECOMMENDED' | 'LOW_CONFIDENCE' | 'DO_NOT_USE';
  color: string;
  label: string;
  reason: string;
} {
  if (!meta) return { level: 'REVIEW_RECOMMENDED', color: '#F59E0B', label: 'Unverified', reason: 'No trust metadata available' };
  
  const score = meta.trustScore || meta.confidenceLevel === 'HIGH' ? 85 : meta.confidenceLevel === 'MEDIUM' ? 65 : meta.confidenceLevel === 'LOW' ? 40 : 20;
  
  if (meta.confidenceLevel === 'INSUFFICIENT_DATA') return {
    level: 'DO_NOT_USE', color: '#EF4444',
    label: 'Insufficient Data', reason: 'Session data is too sparse — results unreliable'
  };
  
  if (score >= 80 && !meta.dqWarnings?.length) return {
    level: 'TRUSTED', color: '#10B981',
    label: 'High Confidence', reason: 'Well-grounded in session data, DQ compliant'
  };
  
  if (score >= 60) return {
    level: 'REVIEW_RECOMMENDED', color: '#F59E0B',
    label: 'Review Recommended', reason: meta.dqWarnings?.[0] || 'Moderate confidence — verify key claims'
  };
  
  return {
    level: 'LOW_CONFIDENCE', color: '#EF4444',
    label: 'Low Confidence', reason: 'Limited data support — treat as directional only'
  };
}

// ── MODULE-SPECIFIC DQ PROMPTS ─────────────────────────────────────────────────
// These replace the current generic prompts with DQ-grounded versions

export const DQ_MODULE_PROMPTS = {

  'frame-check': (frameData: any, sessionData: any) => buildDQCompliantPrompt(`
Run a comprehensive DQ frame check on this decision frame.

Decision Statement: "${frameData.decisionStatement}"
Context: ${frameData.context}
Scope In: ${frameData.scopeIn}
Scope Out: ${frameData.scopeOut}
Owner: ${frameData.owner}
Deadline: ${frameData.deadline}
Constraints: ${frameData.constraints}
Success Criteria: ${frameData.successCriteria}

FRAME CHECK CRITERIA (check each explicitly):
1. Is the decision statement a genuine open question (not a situation description)?
2. Does it define a clear choice between alternatives?
3. Is there an explicit decision owner?
4. Is there a clear deadline?
5. Is scope explicitly bounded (in AND out)?
6. Are success criteria measurable and outcome-based?
7. Are constraints real constraints vs preferences?
8. Is the framing appropriately narrow (not trying to solve everything)?
9. Does the frame reflect where decision authority actually lies?
10. Is there a risk that framing biases toward a pre-determined conclusion?

Return JSON: { 
  overallScore: 0-100, 
  band: "Elite|Strong|Adequate|Weak|High-Risk",
  summary: string,
  checks: [{name, pass: boolean, note}],
  improvements: [{field, current, suggestion, reason, priority: critical|high|medium}],
  verdict: string,
  meta: {confidenceLevel, dataPointsUsed: [], assumptionsMade: [], dqWarnings: [], caveat}
}`,
  { module: 'problem-frame', dqElement: 'Frame', sessionData }),

  'issue-blind-spots': (issues: any[], sessionData: any) => buildDQCompliantPrompt(`
Analyse this issue list for blind spots and coverage gaps.

Issues captured (${issues.length}):
${issues.map(i => `[${i.category}/${i.severity}] ${i.text}`).join('\n')}

BLIND SPOT ANALYSIS:
For a high-quality DQ issue list:
- All 12 issue categories should be represented or explicitly excluded
- Critical issues should surface uncomfortable truths, not just obvious problems
- "Second-order" and "black-swan" categories are most commonly missed
- Issues should be decision-specific, not generic to the industry

Categories to check: uncertainty-external, uncertainty-internal, stakeholder-concern, assumption, information-gap, opportunity, constraint, brutal-truth, regulatory-trap, second-order, black-swan, focus-decision

For each missing or underrepresented category: generate a decision-specific example issue.

Return JSON: {
  coverageScore: 0-100,
  coverageSummary: string,
  missingCategories: [{category, title, why, exampleIssue, severity}],
  patternInsight: string,
  topBlindSpot: string,
  dominanceWarning: string or null (if one category dominates),
  meta: {confidenceLevel, dataPointsUsed: [], assumptionsMade: [], dqWarnings: [], caveat}
}`,
  { module: 'issue-generation', dqElement: 'Information', sessionData }),

  'strategy-recommend': (strategies: any[], criteria: any[], sessionData: any) => buildDQCompliantPrompt(`
Recommend the best strategy. This is a high-stakes DQ recommendation.

Strategies:
${strategies.map(s => `- ${s.name}: ${s.rationale || ''}`).join('\n')}

Criteria (weighted):
${criteria.map(c => `- ${c.label} (${c.weight})`).join('\n')}

DQ RECOMMENDATION REQUIREMENTS:
- Recommendation MUST follow from criteria scores, not from general preference
- If strategies are too similar, flag this as a DQ violation before recommending
- Confidence must reflect actual score differences — close races require LOW confidence
- Must state what would change the recommendation (sensitivity)
- Must acknowledge the strongest argument AGAINST the recommended strategy

Return JSON: {
  recommendation: string,
  confidence: "High|Medium|Low",
  confidenceRationale: string (why this confidence level),
  reasoningChain: [string] (step-by-step from data to conclusion),
  keyTradeoff: string,
  strongestCounterargument: string,
  conditionForRevision: string (what would flip the recommendation),
  alternativeIf: string,
  meta: {confidenceLevel, dataPointsUsed: [], assumptionsMade: [], dqWarnings: [], caveat}
}`,
  { module: 'strategy-table', dqElement: 'Alternatives', sessionData }),

  'dq-score': (context: any, sessionData: any) => buildDQCompliantPrompt(`
Score this decision on all 6 DQ elements.

Context:
${JSON.stringify(context, null, 2)}

DQ SCORING STANDARDS (apply strictly):
- 0-19: High-Risk — fundamental problem, commitment would be negligent
- 20-39: Weak — significant gaps, should not commit without addressing
- 40-59: Adequate — meets minimum bar but meaningful room for improvement  
- 60-79: Strong — solid quality, minor improvements possible
- 80-100: Elite — exceptional quality, ready for high-stakes commitment

SCORING RULES:
1. Score based on EVIDENCE in session data — not optimism
2. The weakest element sets the ceiling for the overall decision quality
3. If an element cannot be scored (no data), score it LOW and flag as missing
4. Do NOT average-up a weak element because others are strong
5. Frame score: Is the decision question genuinely open? Is there an owner and deadline?
6. Alternatives score: Are there 3+ genuinely distinct alternatives?
7. Information score: Are key uncertainties identified? Or is it falsely precise?
8. Values score: Are criteria reflecting real values? Are trade-offs explicit?
9. Reasoning score: Do conclusions follow from evidence? Are assumptions surfaced?
10. Commitment score: Is the team ready to commit? Are reservations addressed?

Return JSON: {
  frame: 0-100, alternatives: 0-100, information: 0-100, values: 0-100, reasoning: 0-100, commitment: 0-100,
  rationale: {frame, alternatives, information, values, reasoning, commitment},
  weakestElement: string,
  overallBand: "Elite|Strong|Adequate|Weak|High-Risk",
  commitmentReadiness: "Ready|Conditional|Premature",
  meta: {confidenceLevel, dataPointsUsed: [], assumptionsMade: [], dqWarnings: [], caveat}
}`,
  { module: 'dq-scorecard', dqElement: 'All 6 Elements', sessionData }),

  'stakeholder-analysis': (sessionData: any) => buildDQCompliantPrompt(`
Identify and analyse key stakeholders for this decision.

DQ STAKEHOLDER ANALYSIS REQUIREMENTS:
- Include ALL parties who: (a) have authority over the decision, (b) must implement it, (c) are materially affected by it, or (d) can block or derail it
- Do not limit to obvious stakeholders — who is not in the room but should be?
- Alignment ratings must be calibrated: "neutral" is different from "unknown"
- Opposition must be taken seriously, not minimised
- Engagement actions must be specific, not generic ("have a meeting" is not an engagement action)

Return JSON: {
  stakeholders: [{
    name, role, influence: 0-100, interest: 0-100,
    alignment: "champion|supportive|neutral|cautious|concerned|opposed",
    concerns: string,
    engagementAction: string (specific, actionable),
    urgency: "critical|high|medium|low",
    riskIfIgnored: string
  }],
  criticalOpposition: string or null,
  missingVoices: [string],
  coalitionOpportunities: [string],
  meta: {confidenceLevel, dataPointsUsed: [], assumptionsMade: [], dqWarnings: [], caveat}
}`,
  { module: 'stakeholder-alignment', dqElement: 'Values', sessionData }),

  'voi-screening': (uncertainties: any[], sessionData: any) => buildDQCompliantPrompt(`
Screen each uncertainty for VOI decision-relevance.

Uncertainties to screen:
${uncertainties.map(u => `- ${u.label} (VOI score: ${u.voiScore || 'unscored'})`).join('\n')}

VOI SCREENING STANDARDS:
1. An uncertainty has VOI = 0 if the preferred alternative stays the same regardless of how it resolves
2. An uncertainty is NOT worth studying if we cannot learn the answer before the decision deadline
3. An uncertainty is NOT worth studying if the study cost exceeds its EVPI
4. Studying everything is as bad as studying nothing — focus on 1-2 decision-critical uncertainties
5. The single biggest risk: teams study what's interesting, not what's decision-relevant

For each uncertainty, explicitly test: "If we knew the worst-case outcome, would we change our preferred strategy?"

Return JSON: {
  screeningResults: [{
    uncertaintyLabel, isDecisionCritical: boolean, decisionCriticalRationale,
    canLearnBeforeDeadline: boolean, estimatedVOICategory: "High|Medium|Low|Zero",
    recommendedStudyType, proxyOption: string or null, warningFlag: string or null
  }],
  topPriority: string,
  studyEverythingWarning: string or null,
  keyInsight: string,
  decisionReadiness: "Ready to commit|Critical gaps remain|Dangerous to proceed",
  meta: {confidenceLevel, dataPointsUsed: [], assumptionsMade: [], dqWarnings: [], caveat}
}`,
  { module: 'voi', dqElement: 'Information', sessionData }),
};

// ── COPILOT DQ-ANCHORED PROMPTS ────────────────────────────────────────────────
export const DQ_COPILOT_PROMPTS: Record<string, string[]> = {
  'problem-frame': [
    'Is this decision statement genuinely an open question, or is it a situation description masquerading as a decision?',
    'Who has the actual authority to make this decision — and is that person in the room?',
    'What is explicitly OUT of scope? Name three things that are tempting to include but should be excluded.',
    'What would a terrible outcome look like, and is it captured in the success criteria?',
    'What constraint looks like a given but is actually a choice someone made?',
  ],
  'issue-generation': [
    'What is the most uncomfortable truth about this decision that nobody in the room wants to say?',
    'Which category of issues is most underrepresented — and what does that tell us about our blind spots?',
    'What would happen if our most critical assumption turns out to be wrong?',
    'Which issue, if it occurs, would make all the others irrelevant?',
    'Who is not in the room whose perspective would fundamentally change this issue list?',
  ],
  'decision-hierarchy': [
    'Are any of the "focus decisions" actually already made but not admitted to?',
    'Which focus decision, if resolved differently, would change all the other answers?',
    'Is the Focus Five actually five, or are there more than five — and if so, which are truly focal?',
    'Which decisions appear to be strategic but are actually operational (and vice versa)?',
    'Are any of these decisions reversible? If so, they may not need to be in the Focus Five.',
  ],
  'strategy-table': [
    'Could a well-informed competitor legitimately choose each of these strategies? If not, they are not distinct enough.',
    'What is the null strategy — do nothing — and is it honestly represented?',
    'Which strategy makes the most assumptions, and what happens if those assumptions are wrong?',
    'Where do two strategies appear different but actually make the same bet on the same key uncertainty?',
    'What strategy is being avoided and why? Name the option that nobody wants to put on the table.',
  ],
  'qualitative-assessment': [
    'Which criterion is doing the most work in driving the recommendation, and is that weight defensible?',
    'Are any criteria actually proxies for something else — and if so, should we measure the real thing?',
    'Where are two strategies so close in scores that the difference is within the noise of the assessment?',
    'Which score in this matrix would change most if a key assumption turned out to be wrong?',
    'Is the leading strategy leading because it is genuinely better, or because the criteria favour it?',
  ],
  'dq-scorecard': [
    'Which DQ element has the worst score, and what specifically would it take to move it from weak to adequate?',
    'The weakest element sets the ceiling — given that, is commitment to this decision appropriate right now?',
    'Which DQ element score is most optimistic relative to the actual evidence in the session?',
    'What would need to happen before the Commitment score could legitimately reach 60+?',
    'Is the Information score hiding behind "we have some data" when the critical uncertainties are unresolved?',
  ],
  'stakeholder-alignment': [
    'Who in this stakeholder map has the most power to block this decision after it is made?',
    'Whose concerns are being dismissed as "low priority" but could become a critical blocker?',
    'Which stakeholder group is most underrepresented in the framing of this decision?',
    'What would the most skeptical stakeholder say about this decision, and how would you respond?',
    'Where is there a risk that stakeholder "alignment" is actually compliance without real commitment?',
  ],
  'scenario-planning': [
    'Which scenario is most uncomfortable for the preferred strategy — and is it being taken seriously?',
    'What is the early warning indicator that would tell us we are in the worst scenario?',
    'Which strategy remains viable in the most scenarios, even if it is not optimal in any of them?',
    'What assumption is being made about the future that is shared across all scenarios?',
    'Which scenario is being implicitly treated as "impossible" but is simply uncomfortable?',
  ],
  'voi': [
    'If we learned the answer to the top uncertainty tomorrow, would we actually change our preferred strategy?',
    'Which proposed study is genuinely decision-relevant versus intellectually interesting?',
    'What is the cost of being wrong if we commit now — and does that justify delaying for more information?',
    'Is there a proxy data source that could answer this question faster and cheaper?',
    'Which uncertainty can we NOT resolve before the decision deadline — and what does that mean for commitment?',
  ],
};

// ── AUDIT TRAIL ENTRY ──────────────────────────────────────────────────────────
export interface AIAuditEntry {
  timestamp: string;
  module: string;
  dqElement: string;
  promptHash: string;
  sessionDataSnapshot: Record<string, number>; // counts only, not full data
  outputTrustScore: number;
  confidenceLevel: string;
  flagCount: number;
  criticalFlags: string[];
  wasRevised: boolean;
  userOverrode: boolean;
}

export function createAuditEntry(
  module: string,
  dqElement: string,
  prompt: string,
  meta: any,
  sessionData: any
): AIAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    module,
    dqElement,
    promptHash: simpleHash(prompt),
    sessionDataSnapshot: {
      issueCount: sessionData?.issues?.length || 0,
      strategyCount: sessionData?.strategies?.length || 0,
      criteriaCount: sessionData?.criteria?.length || 0,
      uncertaintyCount: sessionData?.uncertainties?.length || 0,
      riskCount: sessionData?.riskItems?.length || 0,
      stakeholderCount: sessionData?.stakeholderEntries?.length || 0,
      dqElementsScored: Object.values(sessionData?.session?.dqScores || {}).filter(v => (v as number) > 0).length,
    },
    outputTrustScore: meta?.trustScore || 0,
    confidenceLevel: meta?.confidenceLevel || 'UNKNOWN',
    flagCount: meta?.dqWarnings?.length || 0,
    criticalFlags: (meta?.dqWarnings || []).filter((w: string) => w.toLowerCase().includes('critical')),
    wasRevised: false,
    userOverrode: false,
  };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// ── CONTRADICTION DETECTOR ─────────────────────────────────────────────────────
export function detectCrossModuleContradictions(sessionData: any): string[] {
  const contradictions: string[] = [];
  const dqScores = sessionData?.session?.dqScores || {};
  const strategies = sessionData?.strategies || [];
  const issues = sessionData?.issues || [];
  const uncertainties = sessionData?.uncertainties || [];

  // Check 1: DQ scores vs session completeness
  if ((dqScores.alternatives || 0) > 70 && strategies.length < 3) {
    contradictions.push(`Alternatives DQ score is ${dqScores.alternatives} but only ${strategies.length} strategy/strategies exist — score appears inflated`);
  }
  if ((dqScores.information || 0) > 70 && uncertainties.length === 0) {
    contradictions.push(`Information DQ score is ${dqScores.information} but no uncertainties have been identified — score appears inflated`);
  }
  if ((dqScores.frame || 0) > 80 && !sessionData?.session?.decisionStatement) {
    contradictions.push(`Frame DQ score is ${dqScores.frame} but no decision statement exists — score appears invalid`);
  }

  // Check 2: Issue severity vs DQ scores
  const criticalIssues = issues.filter((i: any) => i.severity === 'Critical');
  if (criticalIssues.length > 3 && (dqScores.commitment || 0) > 60) {
    contradictions.push(`${criticalIssues.length} critical issues exist but Commitment score is ${dqScores.commitment} — commitment may be premature`);
  }

  // Check 3: Strategy count vs alternatives score
  if (strategies.length === 1 && (dqScores.alternatives || 0) > 50) {
    contradictions.push('Only 1 strategy defined but Alternatives element score is above 50 — DQ requires at least 3 genuinely distinct alternatives');
  }

  return contradictions;
}

export default {
  DQ_CONSTITUTION,
  buildDQCompliantPrompt,
  buildSelfCritiquePrompt,
  addGroundingInstructions,
  validateBeforeAI,
  classifyOutputTrust,
  DQ_MODULE_PROMPTS,
  DQ_COPILOT_PROMPTS,
  detectCrossModuleContradictions,
  createAuditEntry,
};
