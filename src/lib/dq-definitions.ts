/**
 * DQ AI Definition Layer — Vantage DQ
 * 
 * Centralized definitions, guardrails and examples for every AI prompt
 * across all modules. This is what separates elite DQ facilitation
 * from generic AI output.
 * 
 * Pattern: Field Definition + AI Guardrails + Good/Bad Examples + Consistency Rules
 */

// ── PROBLEM FRAME ─────────────────────────────────────────────────────────────
export const PROBLEM_FRAME_DEFS = `
DECISION STATEMENT:
- Definition: The specific choice being made, expressed as an open question
- Must: be genuinely open (not rhetorical), name the decision-maker's real choice
- Must NOT: describe a situation, state a goal, or imply a predetermined answer
- Test: Could someone legitimately answer it differently? If no → rewrite
- Good: "Which market entry strategy maximises risk-adjusted NPV within our $25M constraint?"
- Bad: "Should we expand to APAC?" (yes/no, not a real choice)
- Bad: "How do we grow revenue?" (goal, not decision)

CONTEXT:
- Definition: Factual background that frames why this decision exists
- Must: state facts only, explain the trigger, describe the current situation
- Must NOT: include opinions, recommendations, or proposed solutions
- Good: "Competitors entered Singapore 14 months ago. Domestic market share plateaued at 18%."
- Bad: "We should expand because competitors are doing well"

SCOPE IN/OUT:
- Definition: Explicit boundaries of what this decision does and does not cover
- Must: name specific elements, be mutually exclusive and collectively exhaustive
- Must NOT: be vague ("everything relevant") or redundant with decision statement
- Rule: Out-of-scope items are as important as in-scope items

CONSTRAINTS:
- Definition: Non-negotiable limits that cannot be violated by any alternative
- Must: be truly binding (board resolution, legal requirement, physical limit)
- Must NOT: include preferences, soft targets, or things that could be negotiated
- Test: If we violated this, would the decision be invalid? If no → it's a preference

SUCCESS CRITERIA:
- Definition: Specific, measurable outcomes that define a good decision
- Must: be pre-committed (defined before evaluation), measurable, time-bounded
- Must NOT: be defined post-hoc to justify a preferred alternative
- Good: "Year 1: 3+ paying customers, $500K ARR. Year 3: 15% market share"
- Bad: "Achieve good growth and satisfied stakeholders"
`;

// ── ISSUE GENERATION ──────────────────────────────────────────────────────────
export const ISSUE_DEFS = `
WHAT IS AN ISSUE:
- Definition: A question, concern, or uncertainty that MUST be addressed to make a good decision
- Must: be decision-relevant (changes the preferred alternative if resolved)
- Must NOT: be a solution ("we should hire locally"), a fact ("the market is growing"), or a task
- Test: "If we knew the answer to this, would it change our decision?" If no → not an issue
- Phrasing: Express as a question or open concern, not a statement

ISSUE CATEGORIES:
- uncertainty-external: unknowns outside management control (market, regulatory, competitive)
- uncertainty-internal: unknowns within the organisation (capability, capacity, culture)
- assumption: something treated as true that hasn't been validated
- information-gap: data we need but don't have
- stakeholder-concern: alignment or buy-in risk
- constraint: limit that shapes the decision space
- opportunity: upside that current framing may miss
- brutal-truth: uncomfortable reality the team is avoiding
- regulatory-trap: hidden compliance requirement
- second-order: consequence of a consequence
- black-swan: low probability, catastrophic impact
- focus-decision: sub-decision that must be resolved as part of this decision

QUALITY RULES:
- Critical issues must be genuinely uncomfortable to state
- Avoid issues that are already solved or outside the decision scope
- "Brutal truth" category must contain at least one issue that makes the room uncomfortable
`;

// ── DECISION HIERARCHY ────────────────────────────────────────────────────────
export const DECISION_HIERARCHY_DEFS = `
GIVEN DECISIONS:
- Definition: Already made, locked, non-negotiable — the context for all other decisions
- Test: Could we realistically reopen this? If no → Given
- Examples: Board mandates, regulatory requirements, already-spent sunk costs

FOCUS DECISIONS (THE FOCUS FIVE):
- Definition: The 2-5 strategic decisions that must be resolved NOW to move forward
- Must: be genuinely open, within decision-maker's authority, sequentially independent
- Limit: Maximum 5 — if more exist, re-examine which are truly strategic
- Test: "Would a different choice here significantly change our recommended strategy?" If yes → Focus
- Common failure: Too many focus decisions → paralysis. Too few → false precision

DEFERRED DECISIONS:
- Definition: Decisions that depend on Focus decisions being resolved first
- Must: have a clear trigger ("decide by Month 6 once entry mode is chosen")
- Must NOT: be deferred simply because they're hard or uncomfortable

FOCUS FIVE QUALITY TEST:
1. Are they all genuinely open? (not secretly already decided)
2. Does each one materially affect strategy selection?
3. Are they within the decision-maker's authority?
4. Can they be resolved with available information?
5. Are there really ≤5? (if not, what's actually operational vs strategic?)
`;

// ── SCENARIO PLANNING ─────────────────────────────────────────────────────────
export const SCENARIO_DEFS = `
UNCERTAINTY vs ASSUMPTION (CRITICAL DISTINCTION):
- Uncertainty: Something we do NOT know and cannot control (external, future, variable)
  → "What will the regulatory approval timeline be?" 
- Assumption: Something we TREAT AS TRUE for planning purposes (could be wrong)
  → "We assume English is acceptable for initial Singapore sales"
- Rule: Uncertainties drive scenario axes. Assumptions drive sensitivity analysis.
- Common error: Calling a decision "uncertainty" (e.g. "which strategy we choose")

WHAT MAKES A GOOD SCENARIO AXIS:
- Must be: HIGH IMPACT (significantly changes decision value) AND HIGH UNCERTAINTY (genuinely unknown)
- Must NOT be: something we control, something already decided, a low-impact variable
- Test: "If this resolved differently, would our preferred strategy change?" If yes → strong axis

WHAT IS A SCENARIO:
- Definition: A coherent, internally consistent description of a plausible future world
- Must: tell a story (not just a data point), be internally consistent, challenge strategies
- Must NOT: be optimistic/pessimistic versions of the same world (that's sensitivity analysis)
- Rule: Each scenario must have at least one strategy that wins and one that loses
- Quality test: Would a well-informed person say "yes, this could plausibly happen"?

PROBABILITY RULES:
- All scenarios must sum to 100%
- No scenario should be <5% (if too unlikely, remove it)
- Base case should typically be 40-60% probability
- Avoid three scenarios where one is clearly the "expected" case
`;

// ── QUALITATIVE ASSESSMENT ────────────────────────────────────────────────────
export const ASSESSMENT_DEFS = `
WHAT IS A CRITERION:
- Definition: A dimension of value that matters to decision-makers when choosing between alternatives
- Must: reflect actual stakeholder values (not proxy metrics), be independent of other criteria
- Must NOT: double-count (e.g. "NPV" and "profitability" measure the same thing)
- Test: "Would someone legitimately weight this differently from other criteria?" If yes → valid criterion

SCORE MEANINGS (1-5):
- 5 (Excellent): This strategy strongly fulfils this criterion — best possible performance
- 4 (Good): Above average performance on this criterion
- 3 (Adequate): Meets minimum threshold — acceptable but not strong
- 2 (Weak): Below par — this criterion is a meaningful weakness for this strategy
- 1 (Poor): This strategy fails this criterion — significant problem

SCORING RULES:
- Scores must reflect RELATIVE performance (how does strategy A compare to B and C?)
- Never score all strategies the same on any criterion (if so, remove the criterion)
- The spread of scores is more important than the absolute values
- Critical criteria (weight: critical) should show meaningful differentiation

WEIGHT MEANINGS:
- Critical: Would veto a strategy if it scores poorly here
- High: Significantly influences the recommendation
- Medium: Relevant but not decisive
- Low: Nice to have — tiebreaker only
`;

// ── DQ SCORECARD ──────────────────────────────────────────────────────────────
export const DQ_SCORECARD_DEFS = `
THE 6 DQ ELEMENTS AND WHAT EACH MEASURES:

FRAME (Appropriate Frame):
- Measures: Is the right decision being made? Is it framed as an open question with clear scope?
- Score high (80+) if: Decision statement is a genuine open question, scope is explicit, owner and deadline exist
- Score low (<40) if: Decision is a goal in disguise, scope is undefined, or the frame excludes viable alternatives

ALTERNATIVES (Creative Alternatives):
- Measures: Are there genuinely distinct, creative alternatives being considered?
- Score high (80+) if: 3+ genuinely distinct alternatives, null option considered, no alternative is dominant by construction
- Score low (<40) if: Only 1-2 alternatives, they're variations of same approach, or the preferred answer is baked in

INFORMATION (Meaningful Information):
- Measures: Is the right information available to distinguish between alternatives?
- Score high (80+) if: Key uncertainties are identified, critical data gaps are named, no false precision
- Score low (<40) if: Key uncertainties are unknown/ignored, data is assumed without validation

VALUES (Clear Values):
- Measures: Are the right criteria being used, weighted correctly, reflecting real stakeholder values?
- Score high (80+) if: Criteria reflect genuine trade-offs, weights are defensible, no double-counting
- Score low (<40) if: Financial proxies substitute for real values, criteria aren't independent

REASONING (Sound Reasoning):
- Measures: Does the analysis logically connect information and values to conclusions?
- Score high (80+) if: Recommendations are traceable to data, assumptions are explicit, alternative interpretations acknowledged
- Score low (<40) if: Conclusions jump from data, assumptions are hidden, analysis confirms prior belief

COMMITMENT (Commitment to Action):
- Measures: Is the team ready to commit to a decision and execute?
- Score high (80+) if: All six elements are strong, stakeholders aligned, implementation plan exists
- Score low (<40) if: Any element is below 40, unresolved blockers, team not aligned

THE CEILING RULE:
The weakest element sets the ceiling for overall DQ quality.
A 90/90/90/90/90/20 decision has overall quality of ~20 — you cannot commit.
`;

// ── VALUE OF INFORMATION ──────────────────────────────────────────────────────
export const VOI_DEFS = `
WHAT HAS VALUE OF INFORMATION:
- An uncertainty has VOI only if: resolving it would change the preferred alternative
- Zero VOI: "We'd choose Strategy A whether the market grows 5% or 25% → studying market growth has zero VOI"
- Positive VOI: "If competitor enters first, we'd choose Strategy C not A → studying competitor timing has positive VOI"
- Test (the VOI test): "If I knew the answer, would I make a different decision?" If no → VOI = 0

WHAT IS A STUDY (INFORMATION OPTION):
- Definition: A specific, actionable way to reduce uncertainty before committing
- Must: be completable before the decision deadline
- Must: cost less than the expected value it creates (net positive VOI)
- Must NOT: be "do more analysis" or "wait and see" (too vague)
- Good: "Regulatory pre-submission meeting with Japan FSA (8 weeks, $150K)"
- Bad: "Research the market more"

DECISION IMPACT vs NICE TO KNOW:
- Decision impact: Resolving this uncertainty changes which alternative is preferred
- Nice to know: Interesting information that doesn't change the decision
- Rule: Only study decision-impacting uncertainties before committing
- The trap: Teams study what's interesting, not what's decision-relevant

EVPI (EXPECTED VALUE OF PERFECT INFORMATION):
- Definition: Maximum you should EVER pay to learn about this uncertainty
- Calculation: Value of best decision WITH perfect info MINUS value of best decision WITHOUT
- Rule: Never pay more than EVPI for any study (even a perfect one costs less than EVPI)
`;

// ── STAKEHOLDER ALIGNMENT ─────────────────────────────────────────────────────
export const STAKEHOLDER_DEFS = `
WHO IS A STAKEHOLDER (for DQ purposes):
- Those with AUTHORITY over the decision (must approve or can veto)
- Those who must IMPLEMENT the decision (execution depends on them)
- Those MATERIALLY AFFECTED by the decision outcome
- Those who can BLOCK or DERAIL implementation
- NOT: anyone with an opinion, all customers, all employees

ALIGNMENT LEVELS (be honest, not optimistic):
- Champion: Actively advocating for this decision and will drive implementation
- Supportive: In favour but not leading the charge
- Neutral: No strong view — could go either way
- Cautious: Has concerns but open to being persuaded
- Concerned: Has significant objections that must be addressed
- Opposed: Actively against — will resist or block if not managed

INFLUENCE vs INTEREST:
- Influence: Power to affect the decision or its implementation (0-100)
- Interest: How much they care about the outcome (0-100)
- High influence + low alignment = CRITICAL risk (manage first)
- Low influence + opposed = monitor (don't ignore)

ENGAGEMENT ACTION QUALITY:
- Good: "Schedule 1:1 with CFO to walk through financial model before board meeting — owner: CEO, by Week 3"
- Bad: "Engage stakeholders" / "Have a meeting" / "Communicate the decision"
- Rule: Every engagement action must have a WHO, WHAT, and WHEN
`;

// ── MASTER PROMPT BUILDER ─────────────────────────────────────────────────────
export function buildDQPrompt(module: string, task: string, context: string): string {
  const defs: Record<string, string> = {
    'problem-frame': PROBLEM_FRAME_DEFS,
    'issue-generation': ISSUE_DEFS,
    'decision-hierarchy': DECISION_HIERARCHY_DEFS,
    'scenario-planning': SCENARIO_DEFS,
    'qualitative-assessment': ASSESSMENT_DEFS,
    'dq-scorecard': DQ_SCORECARD_DEFS,
    'voi': VOI_DEFS,
    'stakeholder': STAKEHOLDER_DEFS,
  };

  const def = defs[module] || '';
  return `You are an elite Decision Quality (DQ) facilitator. Apply DQ standards rigorously.

${def ? `DQ DEFINITIONS FOR THIS MODULE:\n${def}\n` : ''}
TASK:
${task}

SESSION CONTEXT:
${context}

QUALITY RULES:
- Ground every output in the session data provided
- Apply the definitions above strictly — reject generic outputs
- If data is insufficient, say so explicitly rather than fabricate
- Return JSON only — no preamble, no markdown fences`;
}
