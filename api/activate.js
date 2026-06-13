// AI.Reply — /api/activate
// Verifies HMAC-signed activation codes (no user DB needed for verification).
// On success it ALSO records the subscriber in Upstash so the owner dashboard can
// see who activated, which plan, and when it expires. A device id (anonymous) lets
// us count usage per subscriber later.
//
// Required Vercel env vars: CODE_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

const crypto = require('crypto');
let redis;
try { ({ redis } = require('./_redis')); } catch (e) { redis = null; }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ valid: false, error: 'Method not allowed' });

  const SECRET = process.env.CODE_SECRET;
  if (!SECRET) return res.status(500).json({ valid: false, error: 'Server not configured' });

  try {
    const { code, device } = req.body || {};
    if (!code || typeof code !== 'string') return res.status(400).json({ valid: false, error: 'No code provided' });

    const clean = code.trim().toUpperCase().replace(/\s+/g, '');
    const m = clean.match(/^AIR([MY])-([0-9A-Z]+)-([0-9A-Z]{4})-([0-9A-F]{6})$/);
    if (!m) return res.status(200).json({ valid: false, error: 'Invalid code format. Check for typos.' });

    const planLetter = m[1], genB36 = m[2], nonce = m[3], sig = m[4];
    const expected = crypto.createHmac('sha256', SECRET)
      .update(planLetter + '|' + genB36 + '|' + nonce)
      .digest('hex').slice(0, 6).toUpperCase();
    if (sig !== expected) return res.status(200).json({ valid: false, error: 'Invalid code. Contact support if you paid.' });

    const genDay = parseInt(genB36, 36);
    const todayDay = Math.floor(Date.now() / 86400000);
    if (!isFinite(genDay) || todayDay - genDay > 14 || genDay > todayDay + 1) {
      return res.status(200).json({ valid: false, error: 'This code has expired. Contact support for a fresh one.' });
    }

    // One-time use: a code can only be redeemed once (prevents sharing).
    if (redis) {
      try {
        const used = await redis('GET', 'code:' + clean);
        if (used) return res.status(200).json({ valid: false, error: 'This code was already used. Contact support if this is a mistake.' });
      } catch (e) { /* if Redis is down, still allow activation */ }
    }

    const days = planLetter === 'Y' ? 366 : 31;
    const expiry = Date.now() + days * 86400000;
    const plan = planLetter === 'Y' ? 'yearly' : 'monthly';

    // Record subscriber + mark code used (best-effort; never blocks activation)
    if (redis) {
      try {
        const id = (device || 'unknown').toString().slice(0, 40);
        const rec = JSON.stringify({ code: clean, plan: plan, activated: Date.now(), expiry: expiry, device: id });
        await redis('SET', 'code:' + clean, rec);
        await redis('SET', 'sub:' + id, rec);
        await redis('SADD', 'subs', id);
      } catch (e) { /* ignore */ }
    }

    return res.status(200).json({ valid: true, plan: plan, expiry: expiry });
  } catch (e) {
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
};
