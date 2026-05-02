import Anthropic from '@anthropic-ai/sdk';

const DQ_SYSTEM = `You are an elite Decision Quality facilitator embedded in Vantage DQ. Your role is to improve decision quality - challenge weak framing, identify hidden assumptions, surface blind spots. Use DQ vocabulary: frame, alternatives, information, values, reasoning, commitment. Write at executive level. Never be a generic chatbot.`;

export async function callClaude({ prompt, version = 'claude-sonnet-4-20250514', max_tokens = 4000, files = [] }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content = buildContent(prompt, files);
  const response = await client.messages.create({
    model: version,
    max_tokens,
    system: DQ_SYSTEM,
    messages: [{ role: 'user', content }],
  });
  return response.content[0]?.text || '';
}

function buildContent(prompt, files = []) {
  if (!files.length) return prompt;
  const parts = [];
  for (const file of files) {
    if (file.base64 && file.mediaType) {
      parts.push({ type: 'document', source: { type: 'base64', media_type: file.mediaType, data: file.base64 } });
    }
  }
  parts.push({ type: 'text', text: prompt });
  return parts;
}

// Legacy direct handler
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { messages, system } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'No messages' });
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: system || DQ_SYSTEM,
      messages,
    });
    return res.status(200).json(response);
  } catch (err) {
    console.error('[CLAUDE]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
