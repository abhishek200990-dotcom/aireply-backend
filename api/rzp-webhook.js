// AI.Reply — /api/rzp-webhook
// Razorpay calls this automatically when a payment succeeds on a Payment Page.
// It verifies the signature, reads the customer's EMAIL, and marks that email as Pro
// in Upstash. The extension (which knows the user's Gmail address) then auto-unlocks.
//
// Required Vercel env vars:
//   RZP_WEBHOOK_SECRET  (set when creating the webhook in Razorpay)
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
//
// Amount mapping: 19900 paise = monthly (31 days), 149900 paise = yearly (366 days).

const crypto = require('crypto');
let redis;
try { ({ redis } = require('./_redis')); } catch (e) { redis = null; }

module.exports.config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
  });
}
function normEmail(e) { return (e || '').toString().trim().toLowerCase(); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const SECRET = process.env.RZP_WEBHOOK_SECRET;
  if (!SECRET) return res.status(500).json({ ok: false, error: 'not configured' });

  try {
    const raw = await readRaw(req);
    const signature = req.headers['x-razorpay-signature'] || '';

    // Verify authenticity (HMAC-SHA256 of raw body with the webhook secret)
    const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
    if (expected !== signature) return res.status(400).json({ ok: false, error: 'bad signature' });

    const body = JSON.parse(raw);
    const event = body.event;
    if (event !== 'payment.captured' && event !== 'payment.authorized' && event !== 'order.paid') {
      return res.status(200).json({ ok: true, ignored: event });
    }

    const payment = body.payload && body.payload.payment && body.payload.payment.entity;
    if (!payment) return res.status(200).json({ ok: true, note: 'no payment entity' });

    const amount = payment.amount;                 // paise
    const email = normEmail(payment.email);
    const contact = payment.contact || '';
    const payId = payment.id || '';

    const plan = amount >= 149900 ? 'yearly' : 'monthly';
    const days = plan === 'yearly' ? 366 : 31;
    const expiry = Date.now() + days * 86400000;

    if (redis) {
      const rec = JSON.stringify({ plan, activated: Date.now(), expiry, email, contact, payId, via: 'razorpay' });
      // Always record the payment for the dashboard
      await redis('LPUSH', 'payments', rec);
      await redis('LTRIM', 'payments', 0, 499);
      if (email) {
        await redis('SET', 'proemail:' + email, JSON.stringify({ plan, expiry, payId }));  // extension reads this by email
        await redis('SET', 'sub:' + email, rec);
        await redis('SADD', 'subs', email);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'server error' });
  }
};
