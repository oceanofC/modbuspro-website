const { sql } = require('./_lib/db');

/**
 * GET /api/trial-unsubscribe?token=<fingerprint>
 * One-click unsubscribe link included in trial nurture emails.
 */
module.exports = async function handler(req, res) {
  const token = (req.query.token || '').trim();

  const page = (title, msg) => `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0e17;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{max-width:420px;text-align:center;padding:2rem}a{color:#10b981}</style></head>
    <body><div class="card"><h1 style="color:#10b981">${title}</h1><p>${msg}</p>
    <p><a href="https://modbus.app">Back to modbus.app</a></p></div></body></html>`;

  if (!token) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page('Invalid link', 'This unsubscribe link is missing its token.'));
  }

  try {
    await sql`UPDATE trial_signups SET unsubscribed = true WHERE fingerprint = ${token}`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(page('Unsubscribed', "You won't receive any more trial emails from ModBus Pro. Your trial and app are unaffected."));
  } catch (err) {
    console.error('trial-unsubscribe error:', err.message);
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(page('Something went wrong', 'Please email support@modbus.app to unsubscribe.'));
  }
};
