import { useState, useCallback } from 'react';

/**
 * Real AI hook — calls /api/claude proxy with parsed JSON result.
 */
export function useAI() {
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (prompt: string, cb: (result: any) => void) => {
    setBusy(true);
    try {
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!r.ok) { cb({ error: `HTTP ${r.status}` }); return; }
      const d = await r.json();
      if (d._raw !== undefined) {
        const clean = (d._raw || '').replace(/```json|```/g, '').trim();
        const m = clean.match(/\{[\s\S]*\}/);
        if (m) { try { cb(JSON.parse(m[0])); return; } catch { /**/ } }
        cb({ _raw: d._raw });
      } else {
        cb(d);
      }
    } catch (e) {
      cb({ error: String(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  return { call, busy };
}
