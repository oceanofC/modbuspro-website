const { sql } = require('./_lib/db');

/**
 * POST /api/deactivate
 * Release a license activation from a machine.
 *
 * Body: { key, activation_id }
 * Returns: { success: true }
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
    // Verify the license key owns this activation
    const result = await sql`
      SELECT a.id FROM activations a
      JOIN licenses l ON a.license_id = l.id
      WHERE l.license_key = ${key.trim().toUpperCase()} AND a.id = ${activation_id}::uuid
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activation not found.' });
    }

    // Delete the activation — frees up a slot
    await sql`DELETE FROM activations WHERE id = ${activation_id}::uuid`;

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Deactivation error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};
