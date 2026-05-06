/**
 * /api/ai.js — Vantage DQ AI Gateway
 * Calls Claude Haiku directly via fetch (no SDK dependency needed)
 */

export const config = { api: { bodyParser: { sizeLimit: '10mb' } }, maxDuration: 30 };

const DQ_SYSTEM = `You are an elite Decision Quality (DQ) facilitator embedded in Vantage DQ.

Your role is to improve decision quality — not to be generically helpful.

CORE BEHAVIOURS:
- Challenge weak framing before answering
- Identify hidden assumptions without being asked
- Flag when a decision is actually a goal in disguise
- Use DQ vocabulary: frame, alternatives, information, values, reasoning, commitment
- Write at executive level — concise, precise, actionable
- Never express false confidence

DQ STANDARDS:
- Decision statements must be open questions, not descriptions
- Alternatives must be genuinely distinct
- A DQ score below 45 means commitment is premature
- The weakest element determines the ceiling

TONE: Senior advisor. Strategic challenger. NOT a chatbot.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { prompt, messages, module = 'unknown', task_type = '' } = req.body;
  const userPrompt = prompt || (messages?.[messages.length - 1]?.content) || '';

  if (!userPrompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    // Use Haiku for speed (fits Vercel 10s timeout), Sonnet for deep tasks
    const deepTasks = ['deep-analysis', 'export-report', 'full-scorecard'];
    const model = deepTasks.includes(task_type)
      ? 'claude-sonnet-4-20250514'
      : 'claude-haiku-4-5-20251001';

    console.log(`[AI] ${module} / ${task_type} → ${model}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: DQ_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[AI] Claude error:', JSON.stringify(err));
      return res.status(500).json({ error: `Claude error: ${err.error?.message || response.status}` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    console.log(`[AI] responded (${text.length} chars)`);

    return res.status(200).json({
      result: text,
      content: [{ type: 'text', text }],
      meta: { model, module, task_type },
    });

  } catch (err) {
    console.error('[AI] Fatal:', err.message);
    return res.status(500).json({ error: `AI request failed: ${err.message}` });
  }
}
