export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err?.error?.message || `Anthropic API error ${response.status}`,
      });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text || "")
      .join("")
      .trim();

    // Try multiple JSON extraction strategies
    let parsed = null;

    // Strategy 1: direct parse
    try { parsed = JSON.parse(text); } catch(e) {}

    // Strategy 2: strip markdown code blocks
    if (!parsed) {
      try {
        const stripped = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        parsed = JSON.parse(stripped);
      } catch(e) {}
    }

    // Strategy 3: find JSON object in text
    if (!parsed) {
      try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch(e) {}
    }

    // Strategy 4: find JSON array in text
    if (!parsed) {
      try {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      } catch(e) {}
    }

    if (parsed) {
      return res.status(200).json(parsed);
    }

    // Return raw if nothing worked
    console.error("Could not parse JSON from response:", text.slice(0, 200));
    return res.status(200).json({ _raw: text });

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
