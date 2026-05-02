/**
 * Vantage DQ — Unified AI Gateway
 * 
 * Orchestrates Claude + Gemini based on task classification.
 * Handles: routing, fallback, consensus, audit, rate limiting.
 */

import { classifyTask } from './_lib/classifier.js';
import { getRouting, getFallback, shouldRunConsensus } from './_lib/router.js';
import { sanitisePrompt, estimateTokens, hashPrompt, validateFiles } from './_lib/sanitiser.js';
import { writeAuditLog } from './_lib/audit.js';
import { checkRateLimit } from './_lib/rateLimiter.js';
import { callClaude } from './claude.js';
import { callGemini } from './gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  const {
    messages,           // Legacy Claude format: [{role, content}]
    prompt: rawPrompt,  // Direct prompt string
    module  = '',
    task_type = '',
    session_id,
    user_id = 'anonymous',
    files   = [],
    consensus = false,
  } = req.body;

  // Support legacy messages[] format from existing useAI hook
  const prompt = rawPrompt || (messages && messages.length > 0
    ? messages.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n')
    : '');

  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  // 1. RATE LIMIT
  const allowed = await checkRateLimit(user_id);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });

  // 2. SANITISE
  let safePrompt;
  try {
    safePrompt = sanitisePrompt(prompt);
    if (files.length) validateFiles(files);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // 3. CLASSIFY TASK
  const tokenEstimate = estimateTokens(prompt, files);
  const classification = classifyTask({ module, task_type, files, token_estimate: tokenEstimate, prompt });
  const routing = getRouting(classification.category);

  // 4. AUDIT ENTRY
  const auditBase = {
    session_id, user_id, module, task_type,
    task_category:  classification.category,
    model_selected: routing.model,
    model_version:  routing.version,
    token_estimate: tokenEstimate,
    prompt_hash:    hashPrompt(safePrompt),
    timestamp:      new Date().toISOString(),
  };

  console.log(`[AI-GATEWAY] module=${module} task=${task_type} → ${routing.model}/${routing.version} (${classification.category}, conf=${classification.confidence})`);

  try {
    // 5. PRIMARY MODEL CALL
    const primaryText = await callModel(routing, safePrompt, files);

    // 6. CONSENSUS (optional — runs both models on critical tasks)
    let consensusText = null;
    if (shouldRunConsensus(classification.category, consensus)) {
      try {
        const altRouting = getFallback(routing.model);
        consensusText = await callModel(altRouting, safePrompt, files);
      } catch (consensusErr) {
        console.warn('[AI-GATEWAY] Consensus model failed:', consensusErr.message);
      }
    }

    // 7. WRITE AUDIT
    await writeAuditLog({
      ...auditBase,
      status:        'success',
      latency_ms:    Date.now() - startTime,
      has_consensus: !!consensusText,
    });

    // 8. RESPOND — format to match existing Claude response format
    // so legacy useAI hook keeps working without changes
    const responseText = primaryText;
    return res.status(200).json({
      // Legacy format (for existing useAI hook)
      content: [{ type: 'text', text: responseText }],
      // Enhanced format
      result: responseText,
      consensus: consensusText,
      meta: {
        model:         routing.model,
        version:       routing.version,
        task_category: classification.category,
        confidence:    classification.confidence,
        latency_ms:    Date.now() - startTime,
        routed_by:     classification.reasoning,
      },
    });

  } catch (primaryErr) {
    console.error(`[AI-GATEWAY] Primary model (${routing.model}) failed:`, primaryErr.message);

    // 9. FALLBACK
    const fallbackRouting = getFallback(routing.model);
    try {
      const fallbackText = await callModel(fallbackRouting, safePrompt, files);
      await writeAuditLog({
        ...auditBase,
        status:         'fallback',
        fallback_reason: primaryErr.message,
        latency_ms:     Date.now() - startTime,
      });
      return res.status(200).json({
        content: [{ type: 'text', text: fallbackText }],
        result:  fallbackText,
        meta:    { ...fallbackRouting, fallback: true, original_error: primaryErr.message },
      });
    } catch (fallbackErr) {
      await writeAuditLog({ ...auditBase, status: 'failed', latency_ms: Date.now() - startTime });
      return res.status(500).json({ error: 'All AI models unavailable. Please try again.' });
    }
  }
}

async function callModel({ model, version, max_tokens }, prompt, files) {
  if (model === 'claude') {
    return callClaude({ prompt, version, max_tokens, files });
  }
  if (model === 'gemini') {
    // Gracefully degrade to Claude if Gemini not configured
    if (!process.env.GEMINI_API_KEY) {
      console.log('[AI-GATEWAY] GEMINI_API_KEY not set, falling back to Claude');
      return callClaude({ prompt, version: 'claude-sonnet-4-20250514', max_tokens, files });
    }
    return callGemini({ prompt, version, max_tokens, files });
  }
  throw new Error(`Unknown model: ${model}`);
}
