export async function writeAuditLog(entry) {
  const log = { ...entry, platform: 'vantage-dq' };
  
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
    } catch (_) {}
  } else {
    console.log('[AUDIT]', JSON.stringify(log));
  }
}
