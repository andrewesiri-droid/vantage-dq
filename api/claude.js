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
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: prompt
          },
          {
            // Pre-fill assistant turn with { to force JSON-only response
            role: "assistant",
            content: "{"
          }
        ],
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
      return res.status(500).json({ error: "Failed to parse Anthropic response" });
    }

    // The assistant turn was pre-filled with "{" so prepend it
    const fullText = "{" + text;
    console.log("Response length:", fullText.length, "ends with:", fullText.slice(-20));

    if (!text) return res.status(500).json({ error: "Empty response from AI" });

    // Strategy 1: parse the prefilled response directly
    try {
      return res.status(200).json(JSON.parse(fullText));
    } catch(e) {}

    // Strategy 2: find first { to last } in full text
    try {
      const start = fullText.indexOf("{");
      const end = fullText.lastIndexOf("}");
      if (start !== -1 && end > start) {
        return res.status(200).json(JSON.parse(fullText.slice(start, end + 1)));
      }
    } catch(e) {}

    // Strategy 3: strip any markdown, try original text
    try {
      const stripped = text
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/\s*```\s*$/im, "")
        .trim();
      const withBrace = stripped.startsWith("{") ? stripped : "{" + stripped;
      return res.status(200).json(JSON.parse(withBrace));
    } catch(e) {}

    // Strategy 4: fix trailing commas and control chars
    try {
      const fixed = fullText
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u0000-\u001F]/g, " ")
        .replace(/\n/g, " ").replace(/\r/g, " ");
      const start = fixed.indexOf("{");
      const end = fixed.lastIndexOf("}");
      if (start !== -1 && end > start) {
        return res.status(200).json(JSON.parse(fixed.slice(start, end + 1)));
      }
    } catch(e) {}

    console.error("All strategies failed. Length:", fullText.length, "Preview:", fullText.slice(0, 200));
    return res.status(200).json({ _raw: fullText });

  } catch(err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
