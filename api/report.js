// AI.Reply — /api/report
// Receives a "Report a problem" submission from the extension and stores it so the
// owner dashboard shows it. Also keeps the most recent 100 reports. This is how you
// hear about issues BEFORE a user leaves a bad Chrome Web Store review.
//
// Body: { device, plan, message, context }
// Required env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

let redis;
try { ({ redis } = require('./_redis')); } catch (e) { redis = null; }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  try {
    const body = req.body || {};
    const msg = (body.message || '').toString().slice(0, 1000);
    if (!msg.trim()) return res.status(400).json({ ok: false, error: 'Empty message' });

    const rec = JSON.stringify({
      message: msg,
      plan: (body.plan || '').toString().slice(0, 16),
      device: (body.device || '').toString().slice(0, 40),
      context: (body.context || '').toString().slice(0, 500),
      at: Date.now()
    });

    if (redis) {
      await redis('LPUSH', 'reports', rec);
      await redis('LTRIM', 'reports', 0, 99);   // keep last 100
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
