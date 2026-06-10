const { sql } = require('./_lib/db');

/**
 * GET /api/license-lookup?session_id=cs_...
 * Look up the license generated for a completed Stripe checkout session,
 * so the success page can display the key immediately (backup for email).
 *
 * The session id acts as the bearer token: it is unguessable and only the
 * purchaser's browser receives it (via the Stripe redirect).
 *
 * Returns: { license_key, tier } or 404 while the webhook is still processing.
 */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sessionId = (req.query.session_id || '').trim();

  // Stripe checkout session ids always start with cs_
  if (!sessionId.startsWith('cs_') || sessionId.length < 20 || sessionId.length > 200) {
    return res.status(400).json({ error: 'Invalid session id' });
  }

  try {
    const result = await sql`
      SELECT license_key, tier FROM licenses
      WHERE stripe_checkout_session_id = ${sessionId}
    `;

    if (result.rows.length === 0) {
      // Webhook may not have run yet — client retries
      return res.status(404).json({ error: 'License not ready yet' });
    }

    return res.status(200).json({
      license_key: result.rows[0].license_key,
      tier: result.rows[0].tier
    });
  } catch (err) {
    console.error('License lookup error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
