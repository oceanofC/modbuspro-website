const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a license key email to the customer after purchase.
 * @param {string} to - Customer email
 * @param {string} customerName - Customer name (or empty)
 * @param {string} licenseKey - The generated license key
 * @param {string} tier - 'personal', 'team', or 'site'
 */
async function sendLicenseEmail(to, customerName, licenseKey, tier) {
  const tierLabel = { personal: 'Personal', team: 'Team', site: 'Site License' }[tier] || tier;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'ModBus Pro <license@modbus.app>',
    to: [to],
    subject: `Your ModBus Pro ${tierLabel} License Key`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="text-align: center; padding: 32px 0 16px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 12px; line-height: 48px; color: white; font-weight: 800; font-size: 18px; font-family: monospace;">MB</div>
        </div>

        <h2 style="text-align: center; margin: 0 0 8px;">Thank you for purchasing ModBus Pro!</h2>
        <p style="text-align: center; color: #666; margin: 0 0 32px;">Your ${tierLabel} license is ready to activate.</p>

        <p>Hi ${customerName || 'there'},</p>
        <p>Here is your license key:</p>

        <div style="background: #f0fdf4; border: 2px solid #10b981; padding: 20px; border-radius: 12px; text-align: center; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; letter-spacing: 2px; margin: 24px 0; color: #065f46;">
          ${licenseKey}
        </div>

        <p><strong>Plan:</strong> ${tierLabel}</p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px; font-weight: 600;">How to activate:</p>
          <ol style="margin: 0; padding-left: 20px; color: #444;">
            <li style="margin-bottom: 8px;">Open ModBus Pro</li>
            <li style="margin-bottom: 8px;">Go to <strong>Settings</strong> (gear icon in the sidebar)</li>
            <li style="margin-bottom: 8px;">Paste your license key and click <strong>Activate</strong></li>
          </ol>
        </div>

        <p style="color: #666; font-size: 14px;">Keep this email safe — you'll need the key if you reinstall or move to a new machine. You can deactivate and reactivate on a different machine at any time.</p>

        <p>If you have any questions, reply to this email or contact <a href="mailto:support@modbus.app" style="color: #059669;">support@modbus.app</a>.</p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          <a href="https://modbus.app" style="color: #999;">modbus.app</a>
        </p>
      </div>
    `
  });
}

const TRIAL_FROM = process.env.RESEND_TRIAL_FROM || 'ModBus Pro <hello@modbus.app>';

function shell(inner) {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
    <div style="text-align: center; padding: 32px 0 16px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 12px; line-height: 48px; color: white; font-weight: 800; font-size: 18px; font-family: monospace;">MB</div>
    </div>
    ${inner}
  </div>`;
}

function footer(fingerprint) {
  const unsub = `https://modbus.app/api/trial-unsubscribe?token=${encodeURIComponent(fingerprint || '')}`;
  return `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">
      <a href="https://modbus.app" style="color: #999;">modbus.app</a> &middot;
      <a href="${unsub}" style="color: #999;">Unsubscribe</a>
    </p>`;
}

/**
 * Day 0 — welcome email sent when a trial user opts in.
 */
async function sendTrialWelcomeEmail(to, fingerprint) {
  await resend.emails.send({
    from: TRIAL_FROM,
    to: [to],
    subject: 'Welcome to your ModBus Pro trial',
    html: shell(`
      <h2 style="text-align: center; margin: 0 0 8px;">Your 7-day trial is live</h2>
      <p style="text-align: center; color: #666; margin: 0 0 32px;">Full features, no limits, no credit card.</p>
      <p>Thanks for trying ModBus Pro. A few things worth doing first:</p>
      <ul style="color: #444; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Connect to a device over TCP or RTU, or spin up the built-in <strong>slave simulator</strong> to test without hardware.</li>
        <li style="margin-bottom: 8px;">Use <strong>Auto-Discovery</strong> to scan an address range and find live registers.</li>
        <li style="margin-bottom: 8px;">Import a device from the built-in library (84 devices) to skip manual register setup.</li>
      </ul>
      <p style="text-align: center; margin: 28px 0;">
        <a href="https://modbus.app/read-modbus-data.html" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;">Read the quick-start guide</a>
      </p>
      <p style="color: #666; font-size: 14px;">Questions? Just reply to this email.</p>
      ${footer(fingerprint)}
    `)
  });
}

/**
 * Day 3 — mid-trial tips / activation nudge.
 */
async function sendTrialTipsEmail(to, fingerprint) {
  await resend.emails.send({
    from: TRIAL_FROM,
    to: [to],
    subject: 'Getting the most out of ModBus Pro',
    html: shell(`
      <h2 style="text-align: center; margin: 0 0 8px;">3 features people miss</h2>
      <p>You're a few days into your trial — here are three things that tend to win people over:</p>
      <ul style="color: #444; padding-left: 20px;">
        <li style="margin-bottom: 8px;"><strong>Logging &amp; charts</strong> — record every request/response with timestamps and plot trends, so intermittent faults stop being guesswork.</li>
        <li style="margin-bottom: 8px;"><strong>Scripting</strong> — automate reads/writes and build quick test sequences.</li>
        <li style="margin-bottom: 8px;"><strong>Byte-order decoding</strong> — see float32/int32 values in every word order at once, so wrong values become obvious.</li>
      </ul>
      <p style="text-align: center; margin: 28px 0;">
        <a href="https://modbus.app/user-manual.html" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;">Open the user manual</a>
      </p>
      ${footer(fingerprint)}
    `)
  });
}

/**
 * Day 6 — trial ending, convert to purchase.
 */
async function sendTrialEndingEmail(to, fingerprint) {
  await resend.emails.send({
    from: TRIAL_FROM,
    to: [to],
    subject: 'Your ModBus Pro trial ends tomorrow',
    html: shell(`
      <h2 style="text-align: center; margin: 0 0 8px;">One day left on your trial</h2>
      <p>Your 7-day trial wraps up tomorrow. If ModBus Pro has earned a place in your toolkit, a license is a <strong>one-time</strong> purchase — no subscription.</p>
      <ul style="color: #444; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Personal — $199, 1 machine</li>
        <li style="margin-bottom: 8px;">Team — $749, 5 machines</li>
      </ul>
      <p style="color:#666;">Master polling and a slave simulator in one app — Modbus Poll + Slave cost $258 as two separate tools.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="https://modbus.app/pricing.html" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;">View pricing &amp; buy</a>
      </p>
      <p style="color: #666; font-size: 14px;">Not ready? No problem — your projects stay on disk, and you can license any time. Reply if you have questions.</p>
      ${footer(fingerprint)}
    `)
  });
}

module.exports = { sendLicenseEmail, sendTrialWelcomeEmail, sendTrialTipsEmail, sendTrialEndingEmail };
