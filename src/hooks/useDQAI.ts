/**
 * useDQAI — DQ-compliant AI caller
 * Wraps every AI call with the DQ Constitution, grounding, and trust scoring.
 */
import { useState, useCallback } from 'react';
import { buildDQCompliantPrompt, classifyOutputTrust, detectCrossModuleContradictions } from '@/lib/dq-ai-engine';
import { trackAICall, trackAICallServer } from '@/lib/ai-rate-limiter';
import { toastAIError, toastError } from '@/lib/toast';

export interface DQAIResult {
  data: any;
  trust: { level: string; color: string; label: string; reason: string } | null;
  meta: any;
  contradictions: string[];
}

export function useDQAI() {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<DQAIResult | null>(null);

  const call = useCallback(async (
    rawPrompt: string,
    options: { module: string; dqElement: string; sessionData: any }
  ): Promise<DQAIResult | null> => {
    const sessionId = options.sessionData?.session?.id;
    // Use Supabase rate limiter for auth sessions, localStorage for demo
    const rateCheck = trackAICall(sessionId);
    if (!rateCheck.allowed) { toastError(rateCheck.warning || 'AI call limit reached'); setBusy(false); return null; }
    if (rateCheck.warning && rateCheck.count >= 50) toastError(rateCheck.warning);
    // Fire-and-forget server rate tracking for authenticated sessions
    if (sessionId) trackAICallServer(sessionId).catch(() => {});
    // Load cached trust result for this module
    const cacheKey = 'vdq_trust_' + (options.sessionData?.session?.id || 'demo') + '_' + (options.module || '');
    try {
      const contradictions = detectCrossModuleContradictions(options.sessionData || {});
      const fullPrompt = buildDQCompliantPrompt(rawPrompt, {
        module: options.module,
        dqElement: options.dqElement,
        sessionData: options.sessionData || {},
        requireSelfCritique: false,
        confidenceRequired: true,
      }) + (contradictions.length ? `\n\nCROSS-MODULE ISSUES DETECTED:\n${contradictions.map(c => '⚠ ' + c).join('\n')}` : '');

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, module: options.module }),
      });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return null;

      const parsed = JSON.parse(m[0]);
      const meta = parsed.meta || null;
      const trust = meta ? classifyOutputTrust(meta) : null;
      const result: DQAIResult = { data: parsed, trust, meta, contradictions };
      setLastResult(result);
      // Cache trust result
      if (result?.trust) {
        try { localStorage.setItem('vdq_trust_' + (options.sessionData?.session?.id || 'demo') + '_' + (options.module || ''), JSON.stringify(result.trust)); } catch(e) {}
      }
      return result;
    } catch(e) {
      console.error('[useDQAI]', e);
      toastAIError();
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { call, busy, lastResult };
}
