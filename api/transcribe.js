/**
 * /api/transcribe.js — Workshop Copilot Transcription
 * Uses Node.js fs + native fetch with proper multipart form
 */
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const { audio, mimeType, phaseId, phaseLabel, sessionContext, previousTranscript } = req.body;
  if (!audio) return res.status(400).json({ error: 'No audio data' });

  const tmpPath = join(tmpdir(), `audio_${Date.now()}.mp4`);

  try {
    // Write audio to temp file
    const audioBuffer = Buffer.from(audio, 'base64');
    writeFileSync(tmpPath, audioBuffer);

    // Read file back as a Blob using the File constructor
    const { Blob } = await import('buffer');
    const fileBlob = new Blob([audioBuffer], { type: mimeType || 'audio/mp4' });

    // Use FormData from undici (available in Node 18+ / Vercel)
    const formData = new FormData();
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'json');
    formData.append('prompt', `Decision Quality workshop phase: ${phaseLabel}. Decision: ${sessionContext?.decisionStatement || ''}.`);
    formData.append('file', fileBlob, `audio.mp4`);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    // Cleanup temp file
    if (existsSync(tmpPath)) unlinkSync(tmpPath);

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

    // DQ extraction
    let items = [], tensions = [], summary = '', commitmentDetected = false;

    if (ANTHROPIC_API_KEY) {
      try {
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
              content: `Extract Decision Quality insights from this workshop transcript.

Phase: ${phaseLabel} | Decision: ${sessionContext?.decisionStatement || 'Unknown'}
Transcript: "${transcript}"

Return JSON only - no other text:
{
  "items": [{"category":"ISSUE|ASSUMPTION|ALTERNATIVE|CONSTRAINT|QUESTION|EVIDENCE","text":"concise statement","speakerName":"Speaker","targetModule":"issue-generation|problem-frame|strategy-table","confidence":80,"addToBoard":true}],
  "tensions": ["string description only"],
  "commitmentDetected": false,
  "summary": "one sentence"
}`
            }],
          }),
        });

        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          const text = claudeData.content?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            items = (parsed.items || []).map((item, i) => ({
              ...item,
              id: `item_${Date.now()}_${i}`,
              phase: phaseId,
              timestamp: Date.now(),
              status: 'pending',
              source: 'workshop-copilot',
              text: String(item.text || ''),
              speakerName: String(item.speakerName || 'Speaker'),
            }));
            tensions = (parsed.tensions || []).map(t =>
              typeof t === 'string' ? t : (t?.description || t?.type || JSON.stringify(t))
            );
            commitmentDetected = !!parsed.commitmentDetected;
            summary = typeof parsed.summary === 'string' ? parsed.summary : '';
          }
        }
      } catch (e) {
        console.error('[transcribe] Claude error:', e.message);
      }
    }

    return res.status(200).json({
      transcript,
      items,
      tensions,
      commitmentDetected,
      summary,
      silent: false,
      wordCount: transcript.split(' ').length,
    });

  } catch (err) {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
    console.error('[transcribe] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
