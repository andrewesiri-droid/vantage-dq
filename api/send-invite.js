/**
 * /api/send-invite.js — Vantage DQ Email Invite Serverless Function
 * Uses Resend to send branded magic invite emails
 * Requires: RESEND_API_KEY in Vercel environment variables
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, role, token, sessionName, invitedBy } = req.body;

  if (!email || !token || !sessionName) {
    return res.status(400).json({ error: 'Missing required fields: email, token, sessionName' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const inviteUrl = `https://vantage-dq.vercel.app/join/${token}`;
  const roleLabel = role === 'facilitator' ? 'Facilitator' : role === 'observer' ? 'Observer' : 'Participant';
  const roleDesc = {
    facilitator: 'You have full access to all modules and can control Workshop Mode.',
    participant: 'You can contribute notes, vote on ideas, and participate in live workshops.',
    observer: 'You have read-only access to review all decision work.',
  }[role] || 'You have been invited to collaborate on a decision.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to Vantage DQ</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <td style="background:#0B1D3A;border-radius:12px;padding:10px 14px;vertical-align:middle;">
                    <span style="color:#C9A84C;font-weight:900;font-size:13px;letter-spacing:2px;">VANTAGE DQ</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

              <!-- Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#0B1D3A;padding:32px 40px;">
                    <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;">Decision Quality Platform</p>
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;line-height:1.2;">You're invited to collaborate</h1>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:36px 40px;">

                    <!-- Session info -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FC;border-radius:12px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:20px 24px;">
                          <p style="margin:0 0 4px;color:#9BA3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">SESSION</p>
                          <p style="margin:0 0 16px;color:#0B1D3A;font-size:16px;font-weight:700;">${sessionName}</p>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#C9A84C20;border-radius:6px;padding:4px 12px;">
                                <span style="color:#C9A84C;font-size:11px;font-weight:700;">${roleLabel}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 8px;color:#3A4255;font-size:14px;line-height:1.6;">
                      ${invitedBy ? `<strong>${invitedBy}</strong> has invited you` : 'You have been invited'} to join a Decision Quality session on Vantage DQ.
                    </p>
                    <p style="margin:0 0 28px;color:#64748B;font-size:13px;line-height:1.6;">${roleDesc}</p>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${inviteUrl}"
                            style="display:inline-block;background:#0B1D3A;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:0.3px;">
                            Join Session →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:24px 0 0;text-align:center;color:#9BA3B8;font-size:11px;">
                      Or copy this link: <br>
                      <a href="${inviteUrl}" style="color:#0B1D3A;word-break:break-all;">${inviteUrl}</a>
                    </p>

                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#F8F9FC;padding:20px 40px;border-top:1px solid #E8EAF0;">
                    <p style="margin:0;color:#9BA3B8;font-size:11px;text-align:center;">
                      This invite expires in 48 hours · Vantage DQ Decision Quality Platform<br>
                      If you didn't expect this email, you can safely ignore it.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vantage DQ <invites@vantage-dq.vercel.app>',
        to: [email],
        subject: `You're invited to "${sessionName}" on Vantage DQ`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[send-invite] Resend error:', data);
      return res.status(500).json({ error: data.message || 'Email failed to send' });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error('[send-invite] Error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
