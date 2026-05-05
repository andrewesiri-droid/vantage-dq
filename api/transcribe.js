/**
 * /api/transcribe.js — Workshop Copilot Transcription
 * Uses node-fetch compatible FormData for Vercel serverless
 */

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const { audio, mimeType, mode = 'realtime', phaseId, phaseLabel, sessionContext, previousTranscript } = req.body;
  if (!audio) return res.status(400).json({ error: 'No audio data' });

  try {
    // Build multipart form manually — more reliable in Vercel serverless
    const audioBuffer = Buffer.from(audio, 'base64');
    const ext = getExtension(mimeType);
    const filename = `audio.${ext}`;
    const boundary = `----FormBoundary${Date.now()}`;

    // Build the multipart body manually
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1`,
      `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nen`,
      `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson`,
      `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${`Decision Quality workshop. Phase: ${phaseLabel}. Decision: ${sessionContext?.decisionStatement || ''}.`}`,
    ];

    const preamble = parts.join('\r\n') + '\r\n';
    const filePart = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType || 'audio/mp4'}\r\n\r\n`;
    const epilogue = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(preamble),
      Buffer.from(filePart),
      audioBuffer,
      Buffer.from(epilogue),
    ]);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}));
      console.error('[transcribe] Whisper error:', JSON.stringify(err));
      return res.status(500).json({ error: 'Transcription failed', detail: err });
    }

    const whisperData = await whisperRes.json();
    const transcript = whisperData.text || '';

    if (!transcript || transcript.trim().length < 2) {
      return res.status(200).json({ transcript: '', items: [], silent: true });
    }

    // DQ extraction with Claude (only if API key available)
    let items = [], tensions = [], summary = '', commitmentDetected = false;

    if (ANTHROPIC_API_KEY && transcript.length > 10) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `You are a Decision Quality workshop facilitator. Extract insights from this transcript.

Phase: ${phaseLabel} (${phaseId})
Decision: ${sessionContext?.decisionStatement || 'Unknown'}
Transcript: "${transcript}"

Extract meaningful contributions only. For each:
- category: ISSUE | ASSUMPTION | ALTERNATIVE | CONSTRAINT | QUESTION | EVIDENCE | OPINION
- text: clean concise version
- speakerName: "Speaker" (unknown)
- targetModule: issue-generation | problem-frame | strategy-table | qualitative-assessment
- confidence: 0-100
- addToBoard: true/false

Skip filler, greetings, very short phrases.

Return JSON: {"items":[{"category":"ISSUE","text":"...","speakerName":"Speaker","targetModule":"issue-generation","confidence":85,"addToBoard":true}],"tensions":[],"commitmentDetected":false,"summary":"1 sentence"}`
          }],
        }),
      });

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        const text = claudeData.content?.[0]?.text || '';
        try {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            items = parsed.items || [];
            tensions = parsed.tensions || [];
            summary = parsed.summary || '';
            commitmentDetected = parsed.commitmentDetected || false;
          }
        } catch { /**/ }
      }
    }

    // Add metadata to items
    const stamped = items.map((item, i) => ({
      ...item,
      id: `item_${Date.now()}_${i}`,
      phase: phaseId,
      timestamp: Date.now(),
      status: 'pending',
      source: 'workshop-copilot',
    }));

    return res.status(200).json({
      transcript,
      items: stamped,
      tensions,
      commitmentDetected,
      summary,
      silent: false,
      wordCount: transcript.split(' ').length,
    });

  } catch (err) {
    console.error('[transcribe] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function getExtension(mimeType) {
  if (!mimeType) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'mp4';
}
