/**
 * /api/transcribe.js — Workshop Copilot Transcription + DQ Categorization
 * 
 * Handles TWO modes:
 * 1. REALTIME: base64 audio chunk (from MediaRecorder, every 8s)
 * 2. UPLOAD:   full audio file (MP3, WAV, M4A, M4V, MP4, WebM) for post-hoc
 * 
 * Pipeline: Audio → Whisper → Claude DQ Categorization → Structured JSON
 */

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { audio, mimeType, mode = 'realtime', phaseId, phaseLabel, sessionContext, previousTranscript, speakerHint } = req.body;
  if (!audio) return res.status(400).json({ error: 'No audio data' });

  try {
    // ── WHISPER TRANSCRIPTION ─────────────────────────────────────────────────
    const audioBuffer = Buffer.from(audio, 'base64');
    const ext = getExtension(mimeType);
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', mode === 'upload' ? 'verbose_json' : 'json');
    if (mode === 'upload') {
      formData.append('timestamp_granularities[]', 'segment');
    }
    formData.append('prompt',
      `Decision Quality workshop. Phase: "${phaseLabel}". Decision: "${sessionContext?.decisionStatement || ''}". ` +
      `Speakers: ${speakerHint || 'multiple participants'}. Preserve technical terms and proper nouns.`
    );

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}));
      return res.status(500).json({ error: 'Transcription failed', detail: err });
    }

    const whisperData = await whisperRes.json();
    const fullTranscript = typeof whisperData === 'string' ? whisperData : (whisperData.text || '');
    const segments = whisperData.segments || [];

    if (!fullTranscript || fullTranscript.trim().length < 3) {
      return res.status(200).json({ transcript: '', items: [], segments: [], silent: true });
    }

    // ── CLAUDE DQ CATEGORIZATION ─────────────────────────────────────────────
    const categorizationPrompt = `You are an expert Decision Quality facilitator analyzing a workshop transcript.

WORKSHOP CONTEXT:
- Current Phase: ${phaseLabel} (${phaseId})
- Decision: ${sessionContext?.decisionStatement || 'Unknown'}
- Session: ${sessionContext?.sessionName || 'Workshop'}
- Previous discussion: ${previousTranscript?.slice(-600) || 'Start of session'}

TRANSCRIPT TO ANALYZE:
"""
${fullTranscript}
"""

Extract ALL meaningful contributions. For each contribution:

CATEGORIES (pick ONE):
- ISSUE: concern, risk, problem, "what could go wrong", obstacle
- ASSUMPTION: something assumed without proof, "we're assuming", "I think we can expect"
- ALTERNATIVE: strategic option, different approach, "what if we...", "another option"
- CONSTRAINT: hard limit, boundary, budget/time/legal/regulatory cap
- QUESTION: open question needing investigation or decision
- EVIDENCE: data point, fact, research finding, statistic
- OPINION: personal preference or judgment without evidence
- META: about the process itself (skip these unless important)

For each item ALSO identify:
- targetModule: best module to receive this item:
  issue-generation | problem-frame | strategy-table | qualitative-assessment | 
  decision-hierarchy | scenario-planning | voi | risk-timeline | stakeholder-alignment
- speakerName: use context clues. If unclear use "Speaker"
- confidence: 0-100 (how certain is classification?)
- dqLabel: frame | alternatives | information | values | reasoning | commitment | general
- addToBoard: true if this is substantive and actionable

Skip: greetings, filler words, logistics talk, single-word responses.
Only extract if confidence > 40.

${mode === 'upload' ? 'This is a full workshop recording — extract ALL significant contributions across the entire transcript.' : 'This is a live chunk — be selective, only extract clear contributions.'}

Return JSON:
{
  "items": [
    {
      "id": "item_1",
      "category": "ISSUE",
      "text": "clean concise version of the contribution",
      "rawQuote": "exact words from transcript",
      "speakerName": "Speaker",
      "targetModule": "issue-generation",
      "targetSection": null,
      "confidence": 87,
      "dqLabel": "information",
      "addToBoard": true,
      "suggestedAction": "Add to Issue Board"
    }
  ],
  "tensions": ["description of any opposing viewpoints detected"],
  "commitmentDetected": false,
  "phaseSignal": null,
  "circularDiscussion": null,
  "summary": "1-2 sentence summary of what was discussed",
  "detectedPhase": "issue-generation"
}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: mode === 'upload' ? 4000 : 1500,
        messages: [{ role: 'user', content: categorizationPrompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    const claudeText = claudeData.content?.[0]?.text || '';

    let extracted = { items: [], tensions: [], commitmentDetected: false, phaseSignal: null, summary: '', detectedPhase: null, circularDiscussion: null };
    try {
      const match = claudeText.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);
    } catch { /**/ }

    // Add timestamp and phase to each item
    const timestampedItems = (extracted.items || []).map((item, i) => ({
      ...item,
      id: `item_${Date.now()}_${i}`,
      phase: phaseId,
      timestamp: Date.now(),
      status: 'pending',
      source: 'workshop-copilot',
    }));

    return res.status(200).json({
      transcript: fullTranscript,
      segments,
      items: timestampedItems,
      tensions: extracted.tensions || [],
      commitmentDetected: extracted.commitmentDetected || false,
      phaseSignal: extracted.phaseSignal,
      circularDiscussion: extracted.circularDiscussion,
      summary: extracted.summary || '',
      detectedPhase: extracted.detectedPhase,
      silent: false,
      wordCount: fullTranscript.split(' ').length,
    });

  } catch (err) {
    console.error('[transcribe] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function getExtension(mimeType) {
  if (!mimeType) return 'webm';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}
