// AI.Reply — /api/ping
// Anonymous usage counter. The extension calls this (best-effort, fire-and-forget)
// each time a Pro/trial user generates a reply, so the owner dashboard can show
// active users and how much they use. No email or personal data — just a random
// device id the extension made up on install.
//
// Body: { device, plan, count }   count = today's running total for that device
// Required env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

let redis;
try { ({ redis } = require('./_redis')); } catch (e) { redis = null; }

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!redis) return res.status(200).json({ ok: false });

  try {
    const body = req.body || {};
    const id = (body.device || 'unknown').toString().slice(0, 40);
    const plan = (body.plan || 'trial').toString().slice(0, 16);
    const count = Math.max(0, Math.min(100000, parseInt(body.count, 10) || 0));
    const day = todayKey();

    const rec = JSON.stringify({ plan: plan, count: count, day: day, last: Date.now() });
    // Per-device usage for today (expires after 3 days to keep the DB tiny)
    await redis('SET', 'use:' + id + ':' + day, rec, 'EX', 259200);
    await redis('SADD', 'active:' + day, id);
    await redis('EXPIRE', 'active:' + day, 259200);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};
