// AI.Reply — /api/makecode  (OWNER ONLY — protected by secret key)
// When a customer pays, open this URL in your browser to generate their code:
//
//   Monthly: https://aireply-backend.vercel.app/api/makecode?key=YOUR_OWNER_KEY&plan=monthly
//   Yearly:  https://aireply-backend.vercel.app/api/makecode?key=YOUR_OWNER_KEY&plan=yearly
//
// Copy the code shown and WhatsApp/email it to the customer.
// Each code: redeemable within 14 days, grants 31 days (monthly) or 366 days (yearly) of Pro.
//
// Required Vercel env vars: CODE_SECRET (same as activate.js), OWNER_KEY (your private password)

const crypto = require('crypto');

module.exports = async (req, res) => {
  const SECRET = process.env.CODE_SECRET;
  const OWNER_KEY = process.env.OWNER_KEY;
  if (!SECRET || !OWNER_KEY) return res.status(500).send('Server not configured');

  const { key, plan } = req.query || {};
  if (key !== OWNER_KEY) return res.status(403).send('Forbidden');

  const planLetter = (plan === 'yearly' || plan === 'y') ? 'Y' : 'M';
  const genB36 = Math.floor(Date.now() / 86400000).toString(36).toUpperCase();
  const nonce = crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
  const sig = crypto.createHmac('sha256', SECRET)
    .update(planLetter + '|' + genB36 + '|' + nonce)
    .digest('hex').slice(0, 6).toUpperCase();

  const code = 'AIR' + planLetter + '-' + genB36 + '-' + nonce + '-' + sig;
  const label = planLetter === 'Y' ? 'YEARLY (366 days Pro)' : 'MONTHLY (31 days Pro)';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(
    '<body style="font-family:sans-serif;text-align:center;padding:60px;background:#faf9fe">' +
    '<h2 style="color:#4b3b8f">AI.Reply activation code — ' + label + '</h2>' +
    '<div style="font-size:28px;font-weight:bold;letter-spacing:2px;background:#fff;border:2px dashed #8b5cf6;border-radius:12px;display:inline-block;padding:18px 30px;margin:16px">' + code + '</div>' +
    '<p style="color:#5f5a72">Send this to the customer. They enter it in the AI.Reply popup in Gmail.<br>Code is redeemable for 14 days. Do NOT share this page URL.</p></body>'
  );
};
