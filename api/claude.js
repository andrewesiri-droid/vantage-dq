const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const { prompt, system } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system: system || 'You are an expert decision quality analyst. Return ONLY valid JSON with no markdown fences, no preamble, no explanation. Output only the JSON object.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Anthropic API error: ${response.status}`, detail: errText });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Try to parse as JSON
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      return res.json(parsed);
    } catch {
      // Try extracting JSON block
      const m = rawText.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          return res.json(parsed);
        } catch { /* fall through */ }
      }
      // Return raw text for co-pilot use
      return res.json({ _raw: rawText });
    }
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
}
