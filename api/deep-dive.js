/**
 * Vantage DQ — Deep Dive Analysis Pipeline
 * 
 * 6-step pipeline: ingest → context → extract → critique → distribute → questions
 * Streams progress via Server-Sent Events (SSE)
 */

import { callClaude } from './claude.js';
import { callGemini } from './gemini.js';
import { sanitisePrompt, validateFiles } from './_lib/sanitiser.js';
import { EXTRACTOR_PROMPT } from './_lib/prompts/dq-system.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { files = [], session_id, user_id = 'anonymous' } = req.body;

  if (!files.length) return res.status(400).json({ error: 'No files provided' });

  // SSE setup
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const emit = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    // ── STEP 1: INGEST ────────────────────────────────────
    emit('step', { id: 1, label: 'Ingesting document…', pct: 10 });

    const fileNames = files.map(f => f.name || 'document').join(', ');
    const fileContext = files.map(f => f.textContent || '').join('\n\n').slice(0, 100_000);

    // Use Gemini if available (large context), else Claude
    const ingestPrompt = `${EXTRACTOR_PROMPT}

Extract all text content, tables, and key data from this document.
Return a clean, structured text representation. Preserve all numbers, names, dates, and quoted text.
Document: ${fileNames}

<document_content>
${fileContext}
</document_content>

Return JSON: { extractedText: string, documentType: string, pageCount: number, keyEntities: [string], detectedLanguage: string }`;

    let extracted;
    try {
      const rawExtract = process.env.GEMINI_API_KEY
        ? await callGemini({ prompt: ingestPrompt, version: 'gemini-1.5-pro', max_tokens: 8000, files, isExtraction: true })
        : await callClaude({ prompt: ingestPrompt, version: 'claude-sonnet-4-20250514', max_tokens: 6000, files });
      extracted = parseJSON(rawExtract) || { extractedText: fileContext, documentType: 'unknown', keyEntities: [] };
    } catch { extracted = { extractedText: fileContext, documentType: 'unknown', keyEntities: [] }; }

    emit('step', { id: 1, label: 'Document ingested', pct: 18, result: { documentType: extracted.documentType, entities: extracted.keyEntities?.length } });

    // ── STEP 2: IDENTIFY DECISION CONTEXT ─────────────────
    emit('step', { id: 2, label: 'Identifying decision context…', pct: 25 });

    const contextPrompt = `You are a Decision Quality expert. Analyse this document and identify the primary decision being made.

<document>
${(extracted.extractedText || '').slice(0, 20_000)}
</document>

Return JSON: {
  decisionStatement: string (open question format),
  decisionType: string (strategic|operational|investment|policy),
  owner: string (likely decision maker),
  deadline: string,
  stakes: string (what's at risk),
  context: string (situation summary in 2-3 sentences),
  confidence: 0-100 (how confident you are this is the primary decision)
}`;

    const contextRaw = await callClaude({ prompt: contextPrompt, version: 'claude-sonnet-4-20250514', max_tokens: 2000 });
    const decisionContext = parseJSON(contextRaw) || {};
    emit('step', { id: 2, label: 'Decision context identified', pct: 35, result: { decision: decisionContext.decisionStatement } });

    // ── STEP 3: PARALLEL DQ EXTRACTION ────────────────────
    emit('step', { id: 3, label: 'Extracting DQ elements…', pct: 45 });

    const extractPrompt = `Extract all Decision Quality elements from this document.

Decision context: ${decisionContext.decisionStatement || 'Unknown'}

<document>
${(extracted.extractedText || '').slice(0, 30_000)}
</document>

Return JSON: {
  stakeholders: [{name, role, influence: High|Medium|Low, interest: High|Medium|Low, alignment: supportive|neutral|cautious|opposed}],
  objectives: [string],
  uncertainties: [{label, type: Market|Regulatory|Technical|Financial|Competitive, impact: Critical|High|Medium}],
  alternatives: [{name, description, rationale}],
  constraints: [{label, type: financial|regulatory|operational|time}],
  risks: [{label, likelihood: High|Medium|Low, impact: Critical|High|Medium|Low, timeframe}],
  assumptions: [{label, category: market|technical|regulatory|financial}],
  dependencies: [{from, to, relationship}],
  timelines: [{event, date, type: deadline|milestone|gate}],
  economicsRefs: [{metric, value, source}],
  strategicTensions: [{tension, implication}],
  missingInformation: [string]
}`;

    const extractionRaw = process.env.GEMINI_API_KEY
      ? await callGemini({ prompt: extractPrompt, version: 'gemini-1.5-pro', max_tokens: 8000, isExtraction: true })
      : await callClaude({ prompt: extractPrompt, version: 'claude-sonnet-4-20250514', max_tokens: 6000 });
    const dqElements = parseJSON(extractionRaw) || {};

    const elementCount = Object.values(dqElements).reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);
    emit('step', { id: 3, label: `${elementCount} DQ elements extracted`, pct: 60, result: { elements: elementCount } });

    // ── STEP 4: DQ CRITIQUE ───────────────────────────────
    emit('step', { id: 4, label: 'Running DQ critique…', pct: 70 });

    const critiquePrompt = `Apply a rigorous Decision Quality critique to these extracted elements.

Decision: ${decisionContext.decisionStatement}
Elements found: ${JSON.stringify(dqElements, null, 2).slice(0, 5_000)}

Assess:
1. Frame quality — is the decision well-defined?
2. Alternative coverage — are options genuinely distinct?
3. Information gaps — what's critically missing?
4. Stakeholder risk — who could block this?
5. Assumption risks — what hidden assumptions could break this?

Return JSON: {
  overallDQRisk: High|Medium|Low,
  framingScore: 0-100,
  dqGaps: [{ element, gap, severity: critical|high|medium }],
  hiddenAssumptions: [string],
  framingRisks: [string],
  strongPoints: [string],
  criticalMissing: [string]
}`;

    const critiqueRaw = await callClaude({ prompt: critiquePrompt, version: 'claude-sonnet-4-20250514', max_tokens: 3000 });
    const critique = parseJSON(critiqueRaw) || {};
    emit('step', { id: 4, label: 'DQ critique complete', pct: 78, result: { risk: critique.overallDQRisk, gaps: critique.dqGaps?.length } });

    // ── STEP 5: DISTRIBUTE TO MODULES ─────────────────────
    emit('step', { id: 5, label: 'Populating modules…', pct: 88 });

    const moduleData = distributeToModules(decisionContext, dqElements, critique);
    emit('step', { id: 5, label: 'Modules populated', pct: 93, result: { modules: Object.keys(moduleData).length } });

    // ── STEP 6: FACILITATOR QUESTIONS ─────────────────────
    emit('step', { id: 6, label: 'Generating facilitator questions…', pct: 97 });

    const questionsPrompt = `Based on this DQ analysis, generate 6 pointed facilitator questions that the team MUST answer before committing.

Decision: ${decisionContext.decisionStatement}
Critical gaps: ${(critique.dqGaps || []).map(g => g.gap).join('; ')}
Hidden assumptions: ${(critique.hiddenAssumptions || []).join('; ')}

Questions should be uncomfortable but fair. The kind a senior board advisor would ask.
Return JSON: { questions: [{question, targetElement, urgency: critical|high|medium, why: string}] }`;

    const questionsRaw = await callClaude({ prompt: questionsPrompt, version: 'claude-sonnet-4-20250514', max_tokens: 2000 });
    const facilitatorOutput = parseJSON(questionsRaw) || { questions: [] };

    // ── COMPLETE ───────────────────────────────────────────
    emit('complete', {
      pct: 100,
      decisionContext,
      dqElements,
      critique,
      moduleData,
      facilitatorQuestions: facilitatorOutput.questions || [],
      summary: {
        documentType:     extracted.documentType,
        elementsExtracted: elementCount,
        dqRisk:           critique.overallDQRisk,
        framingScore:     critique.framingScore,
        questionsGenerated: facilitatorOutput.questions?.length || 0,
      }
    });

    res.end();

  } catch (err) {
    console.error('[DEEP-DIVE]', err);
    emit('error', { message: err.message });
    res.end();
  }
}

// ── DISTRIBUTORS ────────────────────────────────────────────

function distributeToModules(context, elements, critique) {
  return {
    session: {
      decisionStatement: context.decisionStatement,
      context:           context.context,
      owner:             context.owner,
      deadline:          context.deadline,
      trigger:           context.stakes,
    },
    issues: [
      ...(elements.assumptions  || []).map(a => ({ text: a.label, category: 'assumption',          severity: 'High', status: 'open', source: 'deep-dive' })),
      ...(elements.strategicTensions || []).map(t => ({ text: t.tension, category: 'brutal-truth', severity: 'Critical', status: 'open', source: 'deep-dive' })),
      ...(elements.missingInformation || []).map(m => ({ text: m, category: 'information-gap',     severity: 'High', status: 'open', source: 'deep-dive' })),
    ],
    uncertainties: (elements.uncertainties || []).map(u => ({
      label:  u.label, type: u.type || 'Market', impact: u.impact || 'High', source: 'deep-dive',
    })),
    strategies: (elements.alternatives || []).map((a, i) => ({
      id: Date.now() + i, name: a.name, rationale: a.description || a.rationale || '',
      colorIdx: i, selections: {}, objective: a.description, source: 'deep-dive',
    })),
    stakeholderEntries: (elements.stakeholders || []).map((s, i) => ({
      id: Date.now() + i, name: s.name, role: s.role,
      influence: s.influence === 'High' ? 80 : s.influence === 'Medium' ? 50 : 30,
      interest:  s.interest  === 'High' ? 80 : s.interest  === 'Medium' ? 50 : 30,
      alignment: s.alignment || 'neutral', source: 'deep-dive',
    })),
    riskItems: (elements.risks || []).map((r, i) => ({
      id: Date.now() + i, label: r.label, likelihood: r.likelihood || 'Medium',
      impact: r.impact || 'High', timeframe: r.timeframe || '', source: 'deep-dive',
    })),
    decisions: (elements.constraints || []).map((c, i) => ({
      id: Date.now() + i, label: c.label, tier: 'given',
      choices: ['Confirmed'], rationale: `Hard constraint from document`, source: 'deep-dive',
    })),
    dqCritique: critique,
  };
}

function parseJSON(text) {
  if (!text) return null;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { return null; }
  return null;
}
