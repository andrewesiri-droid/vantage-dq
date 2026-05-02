/**
 * Audit logging — writes to Supabase if available, console otherwise
 */

export async function writeAuditLog(entry) {
  // In production: write to Supabase ai_audit_log table
  // For now: structured console log (Vercel captures these)
  const log = {
    ...entry,
    platform: 'vantage-dq',
    env: process.env.NODE_ENV || 'production',
  };

  if (process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_URL) {
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/ai_audit_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(log),
      });
    } catch (err) {
      console.error('[AUDIT] Supabase write failed:', err.message);
    }
  } else {
    console.log('[AUDIT]', JSON.stringify(log));
  }
}
