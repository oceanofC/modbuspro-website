const { sql } = require('./_lib/db');

/**
 * POST /api/validate
 * Validate an existing license activation (soft check on app startup).
 *
 * Body: { key, activation_id }
 * Returns: { id, customer: { name, email } } on success
 *          { status: 'revoked' } if license was revoked/refunded
 */
module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, activation_id } = req.body || {};

  if (!key || !activation_id) {
    return res.status(400).json({ error: 'Missing required fields: key, activation_id' });
  }

  try {
    const result = await sql`
      SELECT l.id, l.status, l.customer_name, l.customer_email, a.id AS activation_id
      FROM licenses l
      JOIN activations a ON a.license_id = l.id
      WHERE l.license_key = ${key.trim().toUpperCase()} AND a.id = ${activation_id}::uuid
    `;

    if (result.rows.length === 0) {
      // Activation not found — could be deactivated or key changed
      // Return 404 (the app's softValidateOnStart treats this as a no-op)
      return res.status(404).json({ error: 'Activation not found.' });
    }

    const row = result.rows[0];

    // If the license was revoked or refunded, tell the app
    if (row.status !== 'active') {
      return res.status(200).json({ status: row.status });
    }

    // Update last_validated_at timestamp
    await sql`UPDATE activations SET last_validated_at = NOW() WHERE id = ${activation_id}::uuid`;

    return res.status(200).json({
      id: row.id,
      customer: { name: row.customer_name, email: row.customer_email }
    });

  } catch (err) {
    console.error('Validation error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};
