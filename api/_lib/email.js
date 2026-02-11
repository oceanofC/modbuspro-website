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

module.exports = { sendLicenseEmail };
