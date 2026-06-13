// AI.Reply — shared Upstash Redis REST helper
// Required Vercel env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// (Both are shown on your Upstash database page under "REST API".)

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Run a single Redis command, e.g. cmd('SET', 'key', 'value')
async function redis(...args) {
  if (!URL || !TOKEN) throw new Error('Upstash not configured');
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error('Redis ' + r.status);
  const d = await r.json();
  return d.result;
}

module.exports = { redis };
