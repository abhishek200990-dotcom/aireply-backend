// AI.Reply — /api/prostatus?email=user@gmail.com
// The extension calls this with the user's Gmail address to check whether they've
// been unlocked to Pro (after a Razorpay payment matched on email).
// Returns { pro:true, plan, expiry } or { pro:false }.
//
// Required env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

let redis;
try { ({ redis } = require('./_redis')); } catch (e) { redis = null; }
function normEmail(e) { return (e || '').toString().trim().toLowerCase(); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!redis) return res.status(200).json({ pro: false });

  try {
    const email = normEmail(req.query.email);
    if (!email) return res.status(200).json({ pro: false });

    const raw = await redis('GET', 'proemail:' + email);
    if (!raw) return res.status(200).json({ pro: false });

    const d = JSON.parse(raw);
    if (!d.expiry || Date.now() > d.expiry) return res.status(200).json({ pro: false });

    return res.status(200).json({ pro: true, plan: d.plan, expiry: d.expiry });
  } catch (e) {
    return res.status(200).json({ pro: false });
  }
};
