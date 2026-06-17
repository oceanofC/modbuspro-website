const { sql } = require('./_lib/db');
const { sendTrialWelcomeEmail } = require('./_lib/email');

/**
 * POST /api/trial-signup
 * A trial user opts in to setup tips + a trial-ending reminder.
 *
 * Body: { email, fingerprint, platform }
 * Idempotent per fingerprint (re-launches won't duplicate or re-email).
 */
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS trial_signups (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL,
      fingerprint   TEXT UNIQUE,
      platform      TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      welcome_sent  BOOLEAN NOT NULL DEFAULT false,
      day3_sent     BOOLEAN NOT NULL DEFAULT false,
      day6_sent     BOOLEAN NOT NULL DEFAULT false,
      unsubscribed  BOOLEAN NOT NULL DEFAULT false
    )
  `;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, fingerprint, platform } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!fingerprint || typeof fingerprint !== 'string') {
    return res.status(400).json({ error: 'Missing fingerprint.' });
  }

  try {
    await ensureTable();

    // Insert; if this machine already signed up, keep the original row.
    const result = await sql`
      INSERT INTO trial_signups (email, fingerprint, platform)
      VALUES (${cleanEmail}, ${fingerprint}, ${platform || ''})
      ON CONFLICT (fingerprint) DO NOTHING
      RETURNING id
    `;

    const isNew = result.rows.length > 0;

    if (isNew) {
      try {
        await sendTrialWelcomeEmail(cleanEmail, fingerprint);
        await sql`UPDATE trial_signups SET welcome_sent = true WHERE fingerprint = ${fingerprint}`;
      } catch (mailErr) {
        console.error('Trial welcome email failed:', mailErr.message);
        // Row is stored; the cron/welcome can be retried later. Don't fail the request.
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('trial-signup error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
