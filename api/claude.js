export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "No prompt provided" });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const raw = await anthropicRes.text();

  if (!anthropicRes.ok) {
    return res.status(anthropicRes.status).json({ error: raw.slice(0, 200) });
  }

  let text = "";
  try {
    const data = JSON.parse(raw);
    text = (data.content || []).map(b => b.text || "").join("").trim();
  } catch(e) {
    return res.status(500).json({ error: "Failed to parse Anthropic response" });
  }

  // Extract JSON from text using multiple strategies
  const strategies = [
    t => JSON.parse(t),
    t => JSON.parse(t.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim()),
    t => { const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; },
  ];

  for (const fn of strategies) {
    try {
      const parsed = fn(text);
      if (parsed) return res.status(200).json(parsed);
    } catch(e) {}
  }

  return res.status(200).json({ _raw: text });
}
