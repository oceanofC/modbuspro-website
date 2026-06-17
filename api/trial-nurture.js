const { sql } = require('./_lib/db');
const { sendTrialWelcomeEmail, sendTrialTipsEmail, sendTrialEndingEmail } = require('./_lib/email');

/**
 * GET /api/trial-nurture  (invoked daily by Vercel Cron)
 * Sends the day-3 tips and day-6 trial-ending emails to opted-in trial users.
 * Also retries any welcome emails that failed at signup.
 *
 * Secured with CRON_SECRET: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 */
module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const sent = { welcome: 0, day3: 0, day6: 0 };
  const errors = [];

  try {
    // Retry missed welcomes (signup-time send failures)
    const missedWelcome = await sql`
      SELECT email, fingerprint FROM trial_signups
      WHERE welcome_sent = false AND unsubscribed = false
      LIMIT 100
    `;
    for (const row of missedWelcome.rows) {
      try {
        await sendTrialWelcomeEmail(row.email, row.fingerprint);
        await sql`UPDATE trial_signups SET welcome_sent = true WHERE fingerprint = ${row.fingerprint}`;
        sent.welcome++;
      } catch (e) { errors.push(`welcome ${row.fingerprint}: ${e.message}`); }
    }

    // Day 3 tips: signed up 3-7 days ago, not yet sent
    const day3 = await sql`
      SELECT email, fingerprint FROM trial_signups
      WHERE day3_sent = false AND unsubscribed = false
        AND created_at <= now() - interval '3 days'
        AND created_at >  now() - interval '7 days'
      LIMIT 100
    `;
    for (const row of day3.rows) {
      try {
        await sendTrialTipsEmail(row.email, row.fingerprint);
        await sql`UPDATE trial_signups SET day3_sent = true WHERE fingerprint = ${row.fingerprint}`;
        sent.day3++;
      } catch (e) { errors.push(`day3 ${row.fingerprint}: ${e.message}`); }
    }

    // Day 6 ending: signed up 6+ days ago, not yet sent
    const day6 = await sql`
      SELECT email, fingerprint FROM trial_signups
      WHERE day6_sent = false AND unsubscribed = false
        AND created_at <= now() - interval '6 days'
        AND created_at >  now() - interval '10 days'
      LIMIT 100
    `;
    for (const row of day6.rows) {
      try {
        await sendTrialEndingEmail(row.email, row.fingerprint);
        await sql`UPDATE trial_signups SET day6_sent = true WHERE fingerprint = ${row.fingerprint}`;
        sent.day6++;
      } catch (e) { errors.push(`day6 ${row.fingerprint}: ${e.message}`); }
    }

    return res.status(200).json({ ok: true, sent, errors });
  } catch (err) {
    console.error('trial-nurture error:', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
