/**
 * useDQAI — V1-compatible shim for V2
 * Matches V1 interface: { call, busy, lastResult }
 * Uses V2's direct Anthropic API call (no backend needed)
 */
import { useState, useCallback } from 'react';
import { DQ_CONSTITUTION, DQ_MODULE_PROMPTS } from './useDQAI';

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
      const modulePrompt = DQ_MODULE_PROMPTS[options.module] ?? '';
      const moduleSpecific = DQ_MODULE_PROMPTS[options.module] ?? '';
      const system = `${DQ_CONSTITUTION}

MODULE: ${options.module}
DQ ELEMENT: ${options.dqElement}
${moduleSpecific}

DQ HANDOFF RULE: End every recommendation by stating:
1. What the human must own (values, feasibility, or commitment)
2. One thing you cannot determine from the available data
3. One condition that would change your analysis

Respond ONLY with valid JSON. No markdown, no explanation.`;

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
          max_tokens: 4000,
          system,
          messages: [{ role: 'user', content: rawPrompt }],
        }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);
      const apiData = await response.json();
      const raw = apiData.content?.find((b: any) => b.type === 'text')?.text ?? '{}';
      const clean = raw.replace(/```json|```/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);

      const result: DQAIResult = {
        data: parsed,
        trust: null,
        meta: parsed.meta ?? null,
        contradictions: [],
      };
      setLastResult(result);
      return result;
    } catch (e) {
      console.error('[useDQAI]', e);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { call, busy, lastResult };
}
