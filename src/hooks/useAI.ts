/**
 * useAI — Vantage DQ Trusted AI Hook
 *
 * Every AI call now goes through the DQ Trustworthiness Engine:
 * 1. Pre-flight validation (is there enough session data to ask this question?)
 * 2. DQ-grounded prompts (constitution + grounding + confidence requirements)
 * 3. Trust scoring (parse meta from output, classify confidence level)
 * 4. Contradiction detection (cross-module consistency checks)
 * 5. Audit trail (every call logged with trust score and session snapshot)
 *
 * The hook returns an enriched result with trust metadata the UI can display.
 */
import { useState, useCallback } from 'react';
import { validateBeforeAI, classifyOutputTrust, detectCrossModuleContradictions, createAuditEntry } from './dq-ai-engine';

type AICallback = (result: any) => void;

export interface TrustedAIOptions {
  module?: string;
  taskType?: string;
  dqElement?: string;
  sessionData?: Record<string, any>;
  skipValidation?: boolean;
}

export interface TrustResult {
  level: 'TRUSTED' | 'REVIEW_RECOMMENDED' | 'LOW_CONFIDENCE' | 'DO_NOT_USE';
  color: string;
  label: string;
  reason: string;
  trustScore: number;
  flags: string[];
  assumptionsMade: string[];
  caveats: string[];
  dataPointsUsed: string[];
}

const AUDIT_LOG_KEY = 'vantage_dq_ai_audit';

function getSessionData(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem('vantage_dq_demo_sessions') || '{}');
  } catch { return {}; }
}

function saveAuditEntry(entry: any) {
  try {
    const log = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || '[]');
    log.unshift(entry);
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(log.slice(0, 100))); // keep last 100
  } catch { /**/ }
}

export function useAI(defaultModule?: string) {
  const [busy, setBusy] = useState(false);
  const [lastTrust, setLastTrust] = useState<TrustResult | null>(null);
  const [preflightWarnings, setPreflightWarnings] = useState<string[]>([]);
  const [preflightBlockers, setPreflightBlockers] = useState<string[]>([]);

  const call = useCallback(async (
    prompt: string,
    callback: AICallback,
    options: TrustedAIOptions | string = {}
  ) => {
    setBusy(true);
    setLastTrust(null);
    setPreflightWarnings([]);
    setPreflightBlockers([]);

    const opts: TrustedAIOptions = typeof options === 'string'
      ? { taskType: options }
      : options;

    const module = opts.module || defaultModule || 'unknown';
    const dqElement = opts.dqElement || 'General';
    const sessionData = opts.sessionData || getSessionData();

    // ── LAYER 1: PRE-FLIGHT VALIDATION ────────────────────────────────────────
    if (!opts.skipValidation) {
      const preflight = validateBeforeAI(module, sessionData);
      setPreflightWarnings(preflight.warnings);
      setPreflightBlockers(preflight.blockers);

      if (!preflight.canProceed) {
        setBusy(false);
        callback({
          error: preflight.blockers[0],
          blockers: preflight.blockers,
          warnings: preflight.warnings,
          _blocked: true,
        });
        return;
      }
    }

    // ── LAYER 2: CROSS-MODULE CONTRADICTION CHECK ──────────────────────────────
    const contradictions = detectCrossModuleContradictions(sessionData);
    const contradictionWarnings = contradictions.length > 0
      ? `\n\nNote: Cross-module contradictions detected: ${contradictions.join('; ')}. Factor these into your analysis.`
      : '';

    // ── LAYER 3: ENHANCED PROMPT with DQ Constitution + grounding ─────────────
    // Include constitution principles inline rather than the full 400-line version
    const dqPreamble = `You are an elite Decision Quality AI advisor embedded in Vantage DQ.

DQ CONDUCT RULES (non-negotiable):
1. Ground every claim in the session data provided — do NOT invent
2. Prefix claims from data with [Data:], your assessments with [Assessment:], assumptions with [Assumption:]
3. If data is insufficient, write [Insufficient data] — never fabricate
4. Flag any DQ violations you detect (weak frame, insufficient alternatives, etc.)
5. Express confidence proportionate to data quality — never overstate certainty
6. After generating your output, include a "meta" section with:
   - confidenceLevel: HIGH | MEDIUM | LOW | INSUFFICIENT_DATA
   - dataPointsUsed: [list of session data that drove conclusions]
   - assumptionsMade: [explicit list]
   - dqWarnings: [any DQ principle violations detected]
   - caveat: one honest statement about output limits

${contradictionWarnings}

`;

    const enhancedPrompt = dqPreamble + prompt;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: enhancedPrompt }],
          prompt: enhancedPrompt,
          module,
          task_type: opts.taskType || '',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Network error' }));
        callback({ error: err.error || 'Request failed', _raw: null });
        setBusy(false);
        return;
      }

      const data = await response.json();
      const text = data.result || data.content?.[0]?.text || '';

      // ── LAYER 4: PARSE + TRUST SCORE OUTPUT ───────────────────────────────
      let parsed: any = null;
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /**/ }
      }

      // Extract trust metadata
      const meta = parsed?.meta || {};
      const trustClassification = classifyOutputTrust(meta);
      const trustResult: TrustResult = {
        ...trustClassification,
        trustScore: meta.trustScore || (trustClassification.level === 'TRUSTED' ? 85 : trustClassification.level === 'REVIEW_RECOMMENDED' ? 65 : 35),
        flags: meta.dqWarnings || [],
        assumptionsMade: meta.assumptionsMade || [],
        caveats: meta.caveat ? [meta.caveat] : [],
        dataPointsUsed: meta.dataPointsUsed || [],
      };
      setLastTrust(trustResult);

      // ── LAYER 5: AUDIT LOG ─────────────────────────────────────────────────
      const auditEntry = createAuditEntry(module, dqElement, prompt, meta, sessionData);
      auditEntry.outputTrustScore = trustResult.trustScore;
      saveAuditEntry(auditEntry);

      // Return result
      if (parsed && !parsed.error) {
        callback({ ...parsed, _trust: trustResult, _warnings: preflightWarnings });
      } else {
        callback({ _raw: text, text, _trust: trustResult });
      }

    } catch (err: any) {
      callback({ error: err.message, _raw: null });
    } finally {
      setBusy(false);
    }
  }, [defaultModule]);

  return {
    call,
    busy,
    lastTrust,
    preflightWarnings,
    preflightBlockers,
    getAuditLog: () => {
      try { return JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || '[]'); }
      catch { return []; }
    },
  };
}

// ── DEEP DIVE HOOK (unchanged) ─────────────────────────────────────────────────
export function useDeepDive() {
  const [progress, setProgress] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (files: any[]) => {
    setRunning(true);
    setProgress([]); setResult(null); setError(null);

    try {
      const response = await fetch('/api/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'step') setProgress(p => [...p.filter(x => x.id !== data.id), data]);
            else if (data.type === 'complete') { setResult(data); setRunning(false); }
            else if (data.type === 'error') { setError(data.message); setRunning(false); }
          } catch { /**/ }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setRunning(false);
    }
  }, []);

  return { run, progress, result, running, error };
}
