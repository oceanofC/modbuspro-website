const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sql } = require('./_lib/db');
const { generateLicenseKey } = require('./_lib/keys');
const { sendLicenseEmail } = require('./_lib/email');

// Map Stripe price IDs to tiers — only add entries whose env var is actually
// set, otherwise all unset vars collapse onto the literal key "undefined" and
// an unresolvable price silently matches the wrong tier.
const PRICE_TO_TIER = {};
if (process.env.STRIPE_PRICE_PERSONAL) PRICE_TO_TIER[process.env.STRIPE_PRICE_PERSONAL] = { tier: 'personal', maxActivations: 1 };
if (process.env.STRIPE_PRICE_TEAM)     PRICE_TO_TIER[process.env.STRIPE_PRICE_TEAM]     = { tier: 'team',     maxActivations: 5 };
if (process.env.STRIPE_PRICE_SITE)     PRICE_TO_TIER[process.env.STRIPE_PRICE_SITE]     = { tier: 'site',     maxActivations: 10 };

// Ground truth by amount actually paid (in cents): a $199 payment can only
// ever be a personal license. If the price-ID map disagrees, the money wins.
const AMOUNT_TO_TIER = {
  19900:  { tier: 'personal', maxActivations: 1 },
  74900:  { tier: 'team',     maxActivations: 5 },
  169900: { tier: 'site',     maxActivations: 10 },
};

// Disable Vercel's default body parser — Stripe needs the raw body for signature verification
module.exports.config = { api: { bodyParser: false } };

/**
 * Read the raw request body as a Buffer.
 */
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * POST /api/webhook
 * Stripe sends checkout.session.completed events here.
 * We generate a license key, store it in Postgres, and email it to the customer.
 */
module.exports = async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Stripe signature
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Handle checkout completion
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || session.customer_email || '';
    const customerName = session.customer_details?.name || '';
    const stripeCustomerId = session.customer || '';

    // Determine which product was purchased
    let priceId = null;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      priceId = lineItems.data[0]?.price?.id;
    } catch (err) {
      console.error('Failed to fetch line items:', err.message);
    }

    const byPrice = priceId ? PRICE_TO_TIER[priceId] : null;
    const byAmount = AMOUNT_TO_TIER[session.amount_total] || null;
    let tierInfo = byPrice || byAmount;
    if (byPrice && byAmount && byPrice.tier !== byAmount.tier) {
      console.error(`Tier mismatch for session ${session.id}: price map says ${byPrice.tier}, amount ${session.amount_total} says ${byAmount.tier} — trusting the amount`);
      tierInfo = byAmount;
    }

    if (!tierInfo) {
      console.error('Unknown price ID and amount:', priceId, session.amount_total, '— session:', session.id);
      // Acknowledge the webhook (don't retry) but skip license creation
      return res.status(200).json({ received: true, warning: 'Unknown price ID' });
    }

    // Check for duplicate (idempotency — Stripe may retry webhooks)
    const existing = await sql`
      SELECT id FROM licenses WHERE stripe_checkout_session_id = ${session.id}
    `;
    if (existing.rows.length > 0) {
      return res.status(200).json({ received: true, note: 'Already processed' });
    }

    // Generate a unique license key (retry on rare collision)
    let licenseKey;
    for (let attempt = 0; attempt < 5; attempt++) {
      licenseKey = generateLicenseKey();
      const collision = await sql`SELECT id FROM licenses WHERE license_key = ${licenseKey}`;
      if (collision.rows.length === 0) break;
    }

    // Insert license into database
    await sql`
      INSERT INTO licenses (license_key, tier, max_activations, customer_email, customer_name, stripe_checkout_session_id, stripe_customer_id)
      VALUES (${licenseKey}, ${tierInfo.tier}, ${tierInfo.maxActivations}, ${customerEmail}, ${customerName}, ${session.id}, ${stripeCustomerId})
    `;

    // Send license key to customer via email
    try {
      await sendLicenseEmail(customerEmail, customerName, licenseKey, tierInfo.tier);
    } catch (emailErr) {
      // License is created — customer can contact support if email fails
      console.error('Failed to send license email:', emailErr.message);
    }

    console.log(`License created: ${licenseKey} (${tierInfo.tier}) for ${customerEmail}`);
  }

  // Always acknowledge receipt
  res.status(200).json({ received: true });
};
