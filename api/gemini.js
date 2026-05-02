const DQ_SYSTEM = `You are an elite Decision Quality analyst. Extract and analyse information precisely. Return structured JSON when asked. Focus on decision quality elements: stakeholders, uncertainties, alternatives, constraints, risks, assumptions.`;

export async function callGemini({ prompt, version = 'gemini-1.5-flash', max_tokens = 4000, files = [] }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: version,
    systemInstruction: DQ_SYSTEM,
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
