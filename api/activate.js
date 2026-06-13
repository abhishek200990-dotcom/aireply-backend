// AI.Reply — /api/activate
// Verifies HMAC-signed activation codes (no database needed).
// Code format: AIRM-GGGG-NNNN-SSSSSS  (M=monthly) or AIRY-... (Y=yearly)
//   GGGG   = generation day (days since epoch, base36, uppercase)
//   NNNN   = random nonce
//   SSSSSS = first 6 hex chars of HMAC-SHA256(plan|gen|nonce, CODE_SECRET)
// A code must be activated within 14 days of being generated.
// Activation grants: monthly = 31 days Pro, yearly = 366 days Pro.
//
// Required Vercel env var: CODE_SECRET (any long random string, e.g. 40+ chars)

const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS (also covered by vercel.json, kept here for safety)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ valid: false, error: 'Method not allowed' });

  const SECRET = process.env.CODE_SECRET;
  if (!SECRET) return res.status(500).json({ valid: false, error: 'Server not configured' });

  try {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') return res.status(400).json({ valid: false, error: 'No code provided' });

    const clean = code.trim().toUpperCase().replace(/\s+/g, '');
    const m = clean.match(/^AIR([MY])-([0-9A-Z]+)-([0-9A-Z]{4})-([0-9A-F]{6})$/);
    if (!m) return res.status(200).json({ valid: false, error: 'Invalid code format. Check for typos.' });

    const [, planLetter, genB36, nonce, sig] = m;
    const expected = crypto.createHmac('sha256', SECRET)
      .update(planLetter + '|' + genB36 + '|' + nonce)
      .digest('hex').slice(0, 6).toUpperCase();

    if (sig !== expected) return res.status(200).json({ valid: false, error: 'Invalid code. Contact support if you paid.' });

    // Codes must be redeemed within 14 days of generation
    const genDay = parseInt(genB36, 36);
    const todayDay = Math.floor(Date.now() / 86400000);
    if (!isFinite(genDay) || todayDay - genDay > 14 || genDay > todayDay + 1) {
      return res.status(200).json({ valid: false, error: 'This code has expired. Contact support for a fresh one.' });
    }

    const days = planLetter === 'Y' ? 366 : 31;
    const expiry = Date.now() + days * 86400000;
    return res.status(200).json({
      valid: true,
      plan: planLetter === 'Y' ? 'yearly' : 'monthly',
      expiry
    });
  } catch (e) {
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
};
