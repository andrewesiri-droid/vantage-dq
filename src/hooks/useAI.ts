/**
 * useAI — Unified AI hook for all Vantage DQ modules
 * Routes through /api/ai which orchestrates Claude + Gemini
 */
import { useState, useCallback } from 'react';

type AICallback = (result: any) => void;

interface AICallOptions {
  module?: string;
  taskType?: string;
  files?: any[];
  consensus?: boolean;
}

export function useAI(defaultModule?: string) {
  const [busy, setBusy] = useState(false);
  const [lastMeta, setLastMeta] = useState<any>(null);

  const call = useCallback(async (
    prompt: string,
    callback: AICallback,
    options: AICallOptions | string = {}
  ) => {
    setBusy(true);

    // Support legacy string task_type as third arg
    const opts: AICallOptions = typeof options === 'string'
      ? { taskType: options }
      : options;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          prompt,
          module:    opts.module || defaultModule || '',
          task_type: opts.taskType || '',
          files:     opts.files || [],
          consensus: opts.consensus || false,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Network error' }));
        console.error('[useAI] API error:', err);
        callback({ error: err.error || 'Request failed', _raw: null });
        return;
      }

      const data = await response.json();

      // Store routing metadata for debugging
      if (data.meta) setLastMeta(data.meta);

      // Extract text from response (supports both formats)
      const text = data.result
        || data.content?.[0]?.text
        || '';

      // Try to parse JSON from text
      let parsed: any = null;
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* not JSON */ }
      }

      if (parsed) {
        callback(parsed);
      } else {
        // Return raw text with _raw field for modules that need it
        callback({ _raw: text, text });
      }

    } catch (err: any) {
      console.error('[useAI] fetch error:', err);
      callback({ error: err.message, _raw: null });
    } finally {
      setBusy(false);
    }
  }, [defaultModule]);

  return { call, busy, lastMeta };
}

// Deep Dive hook — SSE streaming
export function useDeepDive() {
  const [progress, setProgress] = useState<any[]>([]);
  const [result, setResult]     = useState<any>(null);
  const [running, setRunning]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const run = useCallback(async (files: any[]) => {
    setRunning(true);
    setProgress([]);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'step') {
              setProgress(p => [...p.filter(x => x.id !== data.id), data]);
            } else if (data.type === 'complete') {
              setResult(data);
              setRunning(false);
            } else if (data.type === 'error') {
              setError(data.message);
              setRunning(false);
            }
          } catch { /* bad line */ }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setRunning(false);
    }
  }, []);

  return { run, progress, result, running, error };
}
