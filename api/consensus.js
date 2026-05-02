/**
 * AI Consensus Check — runs both Claude and Gemini, diffs outputs
 */

import { callClaude } from './claude.js';
import { callGemini } from './gemini.js';
import { sanitisePrompt } from './_lib/sanitiser.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, context = '' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt' });

  const safePrompt = sanitisePrompt(`${context}\n\n${prompt}`);

  try {
    // Run both models in parallel
    const [claudeResult, geminiResult] = await Promise.allSettled([
      callClaude({ prompt: safePrompt, version: 'claude-sonnet-4-20250514', max_tokens: 3000 }),
      process.env.GEMINI_API_KEY
        ? callGemini({ prompt: safePrompt, version: 'gemini-1.5-pro', max_tokens: 3000 })
        : Promise.reject(new Error('Gemini not configured')),
    ]);

    const claudeText = claudeResult.status === 'fulfilled' ? claudeResult.value : null;
    const geminiText = geminiResult.status === 'fulfilled' ? geminiResult.value : null;

    if (!claudeText && !geminiText) {
      return res.status(500).json({ error: 'Both models failed' });
    }

    // If only one model succeeded, return that with a note
    if (!geminiText) {
      return res.status(200).json({
        claude: claudeText, gemini: null,
        consensus: { available: false, reason: 'Gemini not available — configure GEMINI_API_KEY for consensus checks' },
      });
    }

    // Diff the outputs — ask Claude to synthesise
    const diffPrompt = `Compare these two AI analyses of the same decision quality question and identify:
1. Points of AGREEMENT — both models found this
2. CLAUDE-ONLY insights — important things Claude found that Gemini missed
3. GEMINI-ONLY insights — important things Gemini found that Claude missed  
4. CONFLICTS — where the models directly contradict each other

Claude analysis:
${claudeText}

Gemini analysis:
${geminiText}

Return JSON: {
  agreement: [string],
  claudeOnly: [string],
  geminiOnly: [string],
  conflicts: [{topic, claudeView, geminiView, severity: high|medium|low}],
  consensusStrength: 0-100,
  recommendedAction: string,
  overallVerdict: "HIGH_CONSENSUS" | "MODERATE_CONSENSUS" | "SIGNIFICANT_DISAGREEMENT"
}`;

    const diffRaw = await callClaude({ prompt: diffPrompt, version: 'claude-sonnet-4-20250514', max_tokens: 2000 });
    let diff;
    try { diff = JSON.parse((diffRaw.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch { diff = {}; }

    return res.status(200).json({ claude: claudeText, gemini: geminiText, consensus: diff });

  } catch (err) {
    console.error('[CONSENSUS]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
