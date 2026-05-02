/**
 * DQ Task Classification Engine
 * Rule-based classifier — deterministic, no ML dependency
 */

export const TASK_CATEGORIES = {
  // Claude — reasoning, critique, coaching
  FRAME_CRITIQUE:       'frame_critique',
  FACILITATION:         'facilitation',
  STRATEGY_CRITIQUE:    'strategy_critique',
  BLIND_SPOT:           'blind_spot_analysis',
  DQ_SCORING:           'dq_scoring',
  ASSUMPTION_CHALLENGE: 'assumption_challenge',
  UNCERTAINTY_FRAMING:  'uncertainty_framing',
  EXECUTIVE_SYNTHESIS:  'executive_synthesis',
  DEEP_REASONING:       'deep_reasoning',
  CONSENSUS_CRITIQUE:   'consensus_critique',

  // Gemini — ingestion, extraction, speed
  DOCUMENT_PARSE:       'document_parse',
  BULK_EXTRACTION:      'bulk_extraction',
  IMAGE_CHART:          'image_chart_parse',
  LARGE_CONTEXT:        'large_context',
  TRANSCRIPT:           'transcript_process',
  FAST_GENERATION:      'fast_generation',
  PREPROCESSING:        'preprocessing',
};

const MODULE_BASE_ROUTING = {
  'problem-frame':         TASK_CATEGORIES.FRAME_CRITIQUE,
  'dq-scorecard':          TASK_CATEGORIES.DQ_SCORING,
  'workshop':              TASK_CATEGORIES.FACILITATION,
  'export-report':         TASK_CATEGORIES.EXECUTIVE_SYNTHESIS,
  'scenario-planning':     TASK_CATEGORIES.UNCERTAINTY_FRAMING,
  'stakeholder-alignment': TASK_CATEGORIES.DEEP_REASONING,
  'decision-hierarchy':    TASK_CATEGORIES.DEEP_REASONING,
  'qualitative':           TASK_CATEGORIES.STRATEGY_CRITIQUE,
  'value-of-information':  TASK_CATEGORIES.DEEP_REASONING,
};

const TASK_TYPE_OVERRIDES = {
  'ai-generate':         TASK_CATEGORIES.FAST_GENERATION,
  'bulk-suggest':        TASK_CATEGORIES.FAST_GENERATION,
  'ai-categorise':       TASK_CATEGORIES.FAST_GENERATION,
  'blind-spots':         TASK_CATEGORIES.BLIND_SPOT,
  'frame-check':         TASK_CATEGORIES.FRAME_CRITIQUE,
  'apply-improvements':  TASK_CATEGORIES.FRAME_CRITIQUE,
  'ai-narrative':        TASK_CATEGORIES.EXECUTIVE_SYNTHESIS,
  'decision-brief':      TASK_CATEGORIES.EXECUTIVE_SYNTHESIS,
  'ai-auto-populate':    TASK_CATEGORIES.DQ_SCORING,
  'ai-analysis':         TASK_CATEGORIES.DEEP_REASONING,
  'ai-auto-sort':        TASK_CATEGORIES.STRATEGY_CRITIQUE,
  'ai-suggest-criteria': TASK_CATEGORIES.STRATEGY_CRITIQUE,
  'transcript':          TASK_CATEGORIES.TRANSCRIPT,
  'workshop-insight':    TASK_CATEGORIES.FACILITATION,
};

/**
 * @param {object} params
 * @param {string} params.module
 * @param {string} params.task_type
 * @param {Array}  params.files
 * @param {number} params.token_estimate
 * @param {string} params.prompt
 * @returns {{ category: string, confidence: number, reasoning: string }}
 */
export function classifyTask({ module, task_type, files = [], token_estimate = 0, prompt = '' }) {
  // Hard rules — document/file based
  if (files.length > 0) {
    const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
    if (totalSize > 50_000)   return result(TASK_CATEGORIES.DOCUMENT_PARSE,  0.99, 'Large file detected');
    if (files.some(isImage))  return result(TASK_CATEGORIES.IMAGE_CHART,     0.99, 'Image/chart file detected');
    if (files.some(isPDF))    return result(TASK_CATEGORIES.DOCUMENT_PARSE,  0.97, 'PDF detected');
    if (files.some(isTranscript)) return result(TASK_CATEGORIES.TRANSCRIPT,  0.97, 'Transcript detected');
  }

  // Token size rule
  if (token_estimate > 50_000) return result(TASK_CATEGORIES.LARGE_CONTEXT, 0.98, 'Large token count');

  // Task type override (most specific)
  if (task_type && TASK_TYPE_OVERRIDES[task_type]) {
    return result(TASK_TYPE_OVERRIDES[task_type], 0.95, `Task type: ${task_type}`);
  }

  // Module base routing
  if (module && MODULE_BASE_ROUTING[module]) {
    return result(MODULE_BASE_ROUTING[module], 0.85, `Module: ${module}`);
  }

  // Prompt content heuristics
  if (prompt.length > 3000)   return result(TASK_CATEGORIES.DEEP_REASONING, 0.75, 'Long prompt → deep reasoning');
  if (prompt.includes('generate') && prompt.includes('JSON'))
    return result(TASK_CATEGORIES.FAST_GENERATION, 0.80, 'Bulk JSON generation detected');

  return result(TASK_CATEGORIES.DEEP_REASONING, 0.60, 'Default fallback');
}

function result(category, confidence, reasoning) {
  return { category, confidence, reasoning };
}

function isImage(f)      { return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.name || ''); }
function isPDF(f)        { return /\.pdf$/i.test(f.name || ''); }
function isTranscript(f) { return /\.(txt|vtt|srt)$/i.test(f.name || '') || (f.name || '').toLowerCase().includes('transcript'); }
