import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  X, Mic, MicOff, Monitor, Users, Brain,
  Sparkles, ChevronRight, Clock, FileText,
  Maximize2, Volume2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface Props {
  sessionName: string;
  decisionStatement?: string;
  activeModuleLabel: string;
  onClose: () => void;
  children: React.ReactNode; // the current module rendered inside workshop
}

interface Transcript {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
  dqFlag?: string;
}

// ── Helpers ──────────────────────────────────────────────────

async function callAI(prompt: string): Promise<any> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0,
      system: 'You are a DQ facilitator assistant listening to a workshop discussion. Extract decision intelligence from what was said. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Scribe Panel ─────────────────────────────────────────────

function ScribePanel({ decisionStatement }: { decisionStatement?: string }) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const addEntry = useCallback((text: string) => {
    if (!text.trim()) return;
    const now = new Date();
    const entry: Transcript = {
      id: `t_${Date.now()}`,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      speaker: 'Participant',
      text: text.trim(),
    };
    setTranscript(p => [...p, entry]);
    setManualInput('');
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!transcript.length) return;
    setAnalyzing(true);
    const text = transcript.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n');
    try {
      const result = await callAI(`You are a DQ facilitator. Analyze this workshop discussion and extract decision intelligence.

DECISION: ${decisionStatement || 'Not stated'}

WORKSHOP TRANSCRIPT:
${text}

Extract:
1. Key issues raised
2. Assumptions being made
3. Disagreements or tensions
4. New information shared
5. Action items mentioned

Return ONLY valid JSON:
{
  "insights": ["insight 1", "insight 2"],
  "issues": ["issue raised"],
  "assumptions": ["assumption detected"],
  "tensions": ["tension identified"],
  "actions": ["action item"]
}`);
      const all = [
        ...(result.insights ?? []),
        ...(result.issues ?? []).map((i: string) => `Issue: ${i}`),
        ...(result.assumptions ?? []).map((a: string) => `Assumption: ${a}`),
        ...(result.tensions ?? []).map((t: string) => `Tension: ${t}`),
        ...(result.actions ?? []).map((a: string) => `Action: ${a}`),
      ];
      setAiInsights(all);
    } catch (e) { console.error(e); }
    finally { setAnalyzing(false); }
  }, [transcript, decisionStatement]);

  return (
    <div className="flex flex-col h-full" style={{ background: '#0B1D3A' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: recording ? '#EF4444' : '#334155' }} />
          <span className="text-xs font-bold" style={{ color: '#F8FAFC' }}>🎙 Scribe</span>
          <span className="text-xs" style={{ color: '#64748B' }}>— AI note-taker</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRecording(r => !r)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: recording ? '#DC2626' : 'rgba(255,255,255,0.08)', color: recording ? '#fff' : '#94A3B8' }}
          >
            {recording ? <MicOff size={12} /> : <Mic size={12} />}
            {recording ? 'Stop' : 'Start Recording'}
          </button>
          <button onClick={handleAnalyze} disabled={analyzing || !transcript.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(79,106,245,0.2)', color: '#818CF8' }}>
            <Sparkles size={12} /> {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {transcript.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Mic size={24} style={{ color: '#334155' }} />
            <p className="text-xs text-center" style={{ color: '#475569' }}>
              Type workshop discussion below or use recording.<br />Scribe captures and extracts DQ intelligence.
            </p>
          </div>
        )}
        {transcript.map(t => (
          <div key={t.id} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{t.speaker}</span>
              <span className="text-xs" style={{ color: '#475569' }}>{t.timestamp}</span>
            </div>
            <p className="text-xs" style={{ color: '#CBD5E1', lineHeight: '1.5' }}>{t.text}</p>
          </div>
        ))}
        {aiInsights.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(79,106,245,0.1)', border: '1px solid rgba(79,106,245,0.2)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#818CF8' }}>🧠 AI Insights</p>
            {aiInsights.map((insight, i) => (
              <p key={i} className="text-xs mb-1" style={{ color: '#94A3B8' }}>· {insight}</p>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex gap-2">
          <input
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEntry(manualInput)}
            placeholder="Type what was said… (Enter to add)"
            className="flex-1 rounded-lg px-3 py-2 text-xs"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#F8FAFC', outline: 'none' }}
          />
          <button onClick={() => addEntry(manualInput)}
            className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(79,106,245,0.3)', color: '#818CF8' }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Workshop Mode ────────────────────────────────────────

export default function WorkshopMode({ sessionName, decisionStatement, activeModuleLabel, onClose, children }: Props) {
  const [activePanel, setActivePanel] = useState<'none' | 'scribe'>('none');
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Projector mode opens a new window
  const handleProjector = useCallback(() => {
    const w = window.open('', '_blank', 'width=1280,height=720,menubar=no,toolbar=no');
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><title>${sessionName} — Projector</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0B1D3A; color: #F8FAFC; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; height: 100vh; }
  .header { padding: 24px 48px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .label { font-size: 12px; color: #C9A84C; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; }
  .session { font-size: 28px; font-weight: 800; }
  .module { font-size: 18px; color: #64748B; margin-top: 4px; }
  .decision { padding: 48px; flex: 1; display: flex; align-items: center; justify-content: center; }
  .decision-text { font-size: 36px; font-weight: 700; text-align: center; line-height: 1.4; max-width: 900px; color: #F8FAFC; }
  .footer { padding: 16px 48px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #475569; display: flex; justify-content: space-between; }
</style></head><body>
<div class="header">
  <div class="label">Decision Session</div>
  <div class="session">${sessionName}</div>
  <div class="module">📍 ${activeModuleLabel}</div>
</div>
<div class="decision">
  <div class="decision-text">${decisionStatement || 'No decision statement set'}</div>
</div>
<div class="footer">
  <span>Vantage DQ — Decision Intelligence Platform</span>
  <span>${new Date().toLocaleDateString()}</span>
</div>
</body></html>`);
      w.document.close();
    }
  }, [sessionName, activeModuleLabel, decisionStatement]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0B1D3A' }}>

      {/* Workshop topbar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3" style={{ background: '#091729', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9A84C' }}>Workshop Mode</p>
            <p className="text-sm font-semibold truncate" style={{ color: '#F8FAFC' }}>{sessionName}</p>
          </div>
          <div className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
            📍 {activeModuleLabel}
          </div>
        </div>

        <div className="flex-1" />

        {/* Timer */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <Clock size={12} style={{ color: '#64748B' }} />
          <span className="text-xs font-mono font-bold" style={{ color: '#94A3B8' }}>{formatTime(elapsed)}</span>
        </div>

        {/* Tools */}
        <button
          onClick={handleProjector}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: projectorOpen ? '#7C3AED' : 'rgba(255,255,255,0.06)', color: projectorOpen ? '#fff' : '#94A3B8' }}
        >
          <Monitor size={13} /> Projector
        </button>

        <button
          onClick={() => setActivePanel(p => p === 'scribe' ? 'none' : 'scribe')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: activePanel === 'scribe' ? '#4F6AF5' : 'rgba(255,255,255,0.06)', color: activePanel === 'scribe' ? '#fff' : '#94A3B8' }}
        >
          <Mic size={13} /> Scribe
        </button>

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}
        >
          <X size={13} /> Exit Workshop
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Module content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {children}
        </div>

        {/* Scribe panel */}
        <AnimatePresence>
          {activePanel === 'scribe' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="shrink-0 overflow-hidden"
              style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div style={{ width: 320, height: '100%' }}>
                <ScribePanel decisionStatement={decisionStatement} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
