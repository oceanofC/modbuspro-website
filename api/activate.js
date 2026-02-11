const { sql } = require('./_lib/db');

/**
 * POST /api/activate
 * Activate a license key on a machine.
 *
 * Body: { key, label, meta: { fingerprint, hostname, platform } }
 * Returns: { id, license_key: { customer: { name, email } } }
 */
module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, label, meta } = req.body || {};

  if (!key || !meta?.fingerprint) {
    return res.status(400).json({ error: 'Missing required fields: key, meta.fingerprint' });
  }

  try {
    // Look up the license
    const licenseResult = await sql`
      SELECT id, tier, max_activations, status, customer_name, customer_email
      FROM licenses WHERE license_key = ${key.trim().toUpperCase()}
    `;

    if (licenseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid license key. Please check and try again.' });
    }

    const license = licenseResult.rows[0];

    if (license.status !== 'active') {
      return res.status(403).json({
        error: `License has been ${license.status}. Contact support@modbus.app for assistance.`
      });
    }

    // Check if this machine is already activated (idempotent)
    const existingActivation = await sql`
      SELECT id FROM activations
      WHERE license_id = ${license.id} AND fingerprint = ${meta.fingerprint}
    `;

    if (existingActivation.rows.length > 0) {
      return res.status(200).json({
        id: existingActivation.rows[0].id,
        license_key: {
          customer: { name: license.customer_name, email: license.customer_email }
        }
      });
    }

    // Count current activations
    const countResult = await sql`
      SELECT COUNT(*)::int AS count FROM activations WHERE license_id = ${license.id}
    `;
    const currentCount = countResult.rows[0].count;

    if (currentCount >= license.max_activations) {
      return res.status(403).json({
        error: `Activation limit reached (${license.max_activations} machine${license.max_activations > 1 ? 's' : ''}). Deactivate another machine first, or contact support@modbus.app.`
      });
    }

    // Create the activation
    const activation = await sql`
      INSERT INTO activations (license_id, fingerprint, label, hostname, platform)
      VALUES (${license.id}, ${meta.fingerprint}, ${label || ''}, ${meta.hostname || ''}, ${meta.platform || ''})
      RETURNING id
    `;

    return res.status(200).json({
      id: activation.rows[0].id,
      license_key: {
        customer: { name: license.customer_name, email: license.customer_email }
      }
    });

  } catch (err) {
    console.error('Activation error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
