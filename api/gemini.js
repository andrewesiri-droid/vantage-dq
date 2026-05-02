import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { EXTRACTOR_PROMPT, DQ_SYSTEM_PROMPT } from './_lib/prompts/dq-system.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export async function callGemini({ prompt, version = 'gemini-1.5-flash', max_tokens = 4000, files = [], isExtraction = false }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const systemInstruction = isExtraction ? EXTRACTOR_PROMPT : DQ_SYSTEM_PROMPT;

  const model = genAI.getGenerativeModel({
    model: version,
    systemInstruction,
    safetySettings: SAFETY,
    generationConfig: { maxOutputTokens: max_tokens, temperature: 0.3 },
  });

  const parts = buildParts(prompt, files);
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  return result.response.text();
}

function buildParts(prompt, files = []) {
  const parts = [];
  for (const file of files) {
    if (file.base64 && file.mediaType) {
      parts.push({ inlineData: { mimeType: file.mediaType, data: file.base64 } });
    }
  }
  parts.push({ text: prompt });
  return parts;
}

// Direct handler
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, version, files } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt' });

  try {
    const text = await callGemini({ prompt, version, files });
    return res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('[GEMINI]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
