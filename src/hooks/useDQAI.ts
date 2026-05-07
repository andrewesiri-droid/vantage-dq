/**
 * useDQAI — DQ-compliant AI caller
 * Wraps every AI call with the DQ Constitution, grounding, and trust scoring.
 */
import { useState, useCallback } from 'react';
import { buildDQCompliantPrompt, classifyOutputTrust, detectCrossModuleContradictions } from '@/lib/dq-ai-engine';
import { toastAIError } from '@/lib/toast';

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
    setBusy(true);
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
