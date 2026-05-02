/**
 * DQ Model Routing Table
 * Determines which model + version handles each task category
 */

export const ROUTING_TABLE = {
  // ── CLAUDE ROUTES ──────────────────────────────────────
  frame_critique:        { model: 'claude', version: 'claude-sonnet-4-20250514', max_tokens: 4000 },
  facilitation:          { model: 'claude', version: 'claude-opus-4-20250514',   max_tokens: 6000 },
  strategy_critique:     { model: 'claude', version: 'claude-sonnet-4-20250514', max_tokens: 4000 },
  blind_spot_analysis:   { model: 'claude', version: 'claude-sonnet-4-20250514', max_tokens: 4000 },
  dq_scoring:            { model: 'claude', version: 'claude-sonnet-4-20250514', max_tokens: 3000 },
  assumption_challenge:  { model: 'claude', version: 'claude-sonnet-4-20250514', max_tokens: 3000 },
  uncertainty_framing:   { model: 'claude', version: 'claude-sonnet-4-20250514', max_tokens: 4000 },
  executive_synthesis:   { model: 'claude', version: 'claude-opus-4-20250514',   max_tokens: 6000 },
  deep_reasoning:        { model: 'claude', version: 'claude-sonnet-4-20250514', max_tokens: 4000 },
  consensus_critique:    { model: 'claude', version: 'claude-opus-4-20250514',   max_tokens: 5000 },

  // ── GEMINI ROUTES ──────────────────────────────────────
  document_parse:        { model: 'gemini', version: 'gemini-1.5-pro',   max_tokens: 8000 },
  bulk_extraction:       { model: 'gemini', version: 'gemini-1.5-pro',   max_tokens: 8000 },
  image_chart_parse:     { model: 'gemini', version: 'gemini-1.5-pro',   max_tokens: 4000 },
  large_context:         { model: 'gemini', version: 'gemini-1.5-pro',   max_tokens: 8000 },
  transcript_process:    { model: 'gemini', version: 'gemini-1.5-pro',   max_tokens: 6000 },
  fast_generation:       { model: 'gemini', version: 'gemini-1.5-flash', max_tokens: 4000 },
  preprocessing:         { model: 'gemini', version: 'gemini-1.5-flash', max_tokens: 4000 },
};

// Fallback chain — if primary model fails, use this
export const FALLBACK = {
  claude: { model: 'claude', version: 'claude-sonnet-4-20250514', max_tokens: 4000 },
  gemini: { model: 'gemini', version: 'gemini-1.5-flash',        max_tokens: 4000 },
};

// Tasks that warrant running BOTH models for consensus
export const CONSENSUS_TASKS = new Set([
  'frame_critique',
  'executive_synthesis',
  'consensus_critique',
]);

export function getRouting(category) {
  return ROUTING_TABLE[category] || ROUTING_TABLE.deep_reasoning;
}

export function getFallback(model) {
  return model === 'claude' ? FALLBACK.gemini : FALLBACK.claude;
}

export function shouldRunConsensus(category, forceConsensus = false) {
  return forceConsensus || CONSENSUS_TASKS.has(category);
}
