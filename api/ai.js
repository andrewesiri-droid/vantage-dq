import Anthropic from '@anthropic-ai/sdk';

const DQ_SYSTEM = `You are an elite Decision Quality facilitator embedded in Vantage DQ.

Your role is to improve the quality of this decision - not to be generically helpful.

CORE BEHAVIOURS:
- Challenge weak framing before answering
- Identify hidden assumptions without being asked  
- Flag when a decision is actually a goal in disguise
- Use DQ vocabulary: frame, alternatives, information, values, reasoning, commitment
- Write at executive level - concise, precise, actionable
- Never express false confidence

DQ STANDARDS:
- Decision statements must be open questions, not descriptions
- Alternatives must be genuinely distinct
- A DQ score below 45 means commitment is premature
- The weakest element determines the ceiling

TONE: Senior advisor. Strategic challenger. NOT a chatbot.`;

// Task classification - which module/task goes to which model
function classifyTask(module, taskType, hasFiles, tokenEstimate) {
  if (hasFiles || tokenEstimate > 50000) return 'gemini';
  
  const geminiTasks = ['ai-generate', 'bulk-suggest', 'ai-categorise', 'fast-generation'];
  if (geminiTasks.includes(taskType)) return 'gemini';
  
  const geminiModules = ['influence-diagram', 'risk-timeline', 'scenario-planning'];
  if (geminiModules.includes(module) && taskType === 'ai-generate') return 'gemini';
  
  return 'claude';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    messages,
    prompt: rawPrompt,
    module = '',
    task_type = '',
    files = [],
  } = req.body;

  // Support both messages[] format and direct prompt
  const prompt = rawPrompt || (messages?.length
    ? messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n')
    : '');

  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  const tokenEstimate = Math.ceil(prompt.length / 4);
  const target = classifyTask(module, task_type, files.length > 0, tokenEstimate);

  console.log(`[AI] module=${module} task=${task_type} → ${target} (${tokenEstimate} tokens)`);

  // Try primary model, fallback to Claude if anything fails
  try {
    let text;

    if (target === 'gemini' && process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: DQ_SYSTEM,
          generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
        });
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        text = result.response.text();
        console.log(`[AI] Gemini responded (${text.length} chars)`);
      } catch (geminiErr) {
        console.warn('[AI] Gemini failed, falling back to Claude:', geminiErr.message);
        text = await callClaude(prompt);
      }
    } else {
      text = await callClaude(prompt);
    }

    return res.status(200).json({
      content: [{ type: 'text', text }],
      result: text,
      meta: { model: target, module, task_type },
    });

  } catch (err) {
    console.error('[AI] Fatal error:', err.message);
    return res.status(500).json({ error: `AI request failed: ${err.message}` });
  }
}

async function callClaude(prompt) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: DQ_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content[0]?.text || '';
  console.log(`[AI] Claude responded (${text.length} chars)`);
  return text;
}
