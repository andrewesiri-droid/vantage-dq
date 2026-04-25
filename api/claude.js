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

  try {
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

    const rawBody = await anthropicRes.text();

    if (!anthropicRes.ok) {
      console.error("Anthropic error:", rawBody.slice(0, 300));
      return res.status(anthropicRes.status).json({ error: rawBody.slice(0, 200) });
    }

    let text = "";
    try {
      const data = JSON.parse(rawBody);
      text = (data.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text || "")
        .join("")
        .trim();
    } catch(e) {
      console.error("Failed to parse Anthropic body:", e.message);
      return res.status(500).json({ error: "Failed to parse Anthropic response body" });
    }

    // Log first 500 chars for debugging
    console.log("AI response preview:", text.slice(0, 500));

    if (!text) {
      return res.status(500).json({ error: "Empty response from AI" });
    }

    // Strategy 1: direct parse
    try {
      const parsed = JSON.parse(text);
      console.log("Strategy 1 success");
      return res.status(200).json(parsed);
    } catch(e) {}

    // Strategy 2: strip ```json ... ``` blocks
    try {
      const stripped = text
        .replace(/^[\s\S]*?```json\s*/i, "")
        .replace(/```[\s\S]*$/i, "")
        .trim();
      const parsed = JSON.parse(stripped);
      console.log("Strategy 2 success");
      return res.status(200).json(parsed);
    } catch(e) {}

    // Strategy 3: strip any ``` blocks
    try {
      const stripped = text
        .replace(/```[a-z]*\n?/gi, "")
        .trim();
      const parsed = JSON.parse(stripped);
      console.log("Strategy 3 success");
      return res.status(200).json(parsed);
    } catch(e) {}

    // Strategy 4: find first { to last }
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        const extracted = text.slice(start, end + 1);
        const parsed = JSON.parse(extracted);
        console.log("Strategy 4 success");
        return res.status(200).json(parsed);
      }
    } catch(e) {}

    // Nothing worked — return raw so frontend can try
    console.error("All parse strategies failed. Text preview:", text.slice(0, 300));
    return res.status(200).json({ _raw: text });

  } catch(err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
