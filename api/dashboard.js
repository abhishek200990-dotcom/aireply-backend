// AI.Reply — /api/dashboard  (OWNER ONLY)
// Open in your browser to see subscribers, active users, usage and problem reports:
//   https://aireply-backend.vercel.app/api/dashboard?key=YOUR_OWNER_KEY
//
// Required env vars: OWNER_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

let redis;
try { ({ redis } = require('./_redis')); } catch (e) { redis = null; }

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function esc(s) { return (s || '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

module.exports = async (req, res) => {
  if (req.query.key !== process.env.OWNER_KEY) return res.status(403).send('Forbidden');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!redis) return res.status(200).send('<body style="font-family:sans-serif;padding:40px">Upstash not configured yet. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.</body>');

  try {
    const day = todayKey();

    // Subscribers
    const subIds = (await redis('SMEMBERS', 'subs')) || [];
    let subs = [];
    for (const id of subIds) {
      const raw = await redis('GET', 'sub:' + id);
      if (raw) { try { subs.push(JSON.parse(raw)); } catch (e) {} }
    }
    subs.sort((a, b) => (b.activated || 0) - (a.activated || 0));
    const active = subs.filter(s => Date.now() < (s.expiry || 0));

    // Active users today
    const activeIds = (await redis('SMEMBERS', 'active:' + day)) || [];
    let usage = [];
    for (const id of activeIds) {
      const raw = await redis('GET', 'use:' + id + ':' + day);
      if (raw) { try { const u = JSON.parse(raw); u.device = id; usage.push(u); } catch (e) {} }
    }
    usage.sort((a, b) => (b.count || 0) - (a.count || 0));
    const totalToday = usage.reduce((n, u) => n + (u.count || 0), 0);

    // Reports
    const reportsRaw = (await redis('LRANGE', 'reports', 0, 49)) || [];
    const reports = reportsRaw.map(r => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean);

    // Razorpay payments
    const payRaw = (await redis('LRANGE', 'payments', 0, 49)) || [];
    const payments = payRaw.map(r => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean);
    const payRows = payments.length ? payments.map(p => `<tr>
      <td>${ago(p.activated)}</td>
      <td>${esc(p.plan)}</td>
      <td>${esc(p.email) || '\u2014'}</td>
      <td>${p.device ? '<span class=ok>linked</span>' : '<span class=exp>no device</span>'}</td>
      <td class=mono>${esc(p.payId)}</td></tr>`).join('') : '<tr><td colspan=5 class=empty>No payments yet</td></tr>';

    const subRows = subs.length ? subs.map(s => `<tr>
      <td>${esc(s.plan)}</td>
      <td>${new Date(s.activated).toLocaleDateString('en-IN')}</td>
      <td>${new Date(s.expiry).toLocaleDateString('en-IN')}</td>
      <td>${Date.now() < s.expiry ? '<span class=ok>Active</span>' : '<span class=exp>Expired</span>'}</td>
      <td class=mono>${esc(s.device).slice(0, 12)}…</td>
      <td class=mono>${esc(s.code)}</td></tr>`).join('') : '<tr><td colspan=6 class=empty>No subscribers yet</td></tr>';

    const useRows = usage.length ? usage.map(u => `<tr>
      <td class=mono>${esc(u.device).slice(0, 12)}…</td>
      <td>${esc(u.plan)}</td>
      <td><b>${u.count}</b> replies</td>
      <td>${ago(u.last)}</td></tr>`).join('') : '<tr><td colspan=4 class=empty>No activity today</td></tr>';

    const repRows = reports.length ? reports.map(r => `<tr>
      <td>${ago(r.at)}</td>
      <td>${esc(r.plan) || '—'}</td>
      <td>${esc(r.message)}</td>
      <td class=mono>${esc(r.context).slice(0, 60)}</td></tr>`).join('') : '<tr><td colspan=4 class=empty>No reports — all good 🎉</td></tr>';

    res.status(200).send(`<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>AI.Reply Dashboard</title><style>
body{font-family:'Inter',-apple-system,sans-serif;background:#f5f3fb;color:#2a2150;margin:0;padding:24px;}
h1{font-size:22px;margin:0 0 4px;}h1 span.b1{color:#4b5bdc}h1 span.b2{color:#8b5cf6}
.sub{color:#7a6fa8;font-size:13px;margin-bottom:22px;}
.cards{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:26px;}
.c{background:#fff;border:1px solid #e0d6f5;border-radius:14px;padding:16px 20px;min-width:130px;}
.c .n{font-size:28px;font-weight:800;color:#1c1442;}.c .l{font-size:12px;color:#7a6fa8;margin-top:2px;}
h2{font-size:15px;margin:24px 0 10px;}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05);}
th{background:#ece4fa;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#4b3b8f;padding:9px 12px;}
td{padding:9px 12px;border-top:1px solid #f1edf9;font-size:13px;}
.mono{font-family:monospace;font-size:11px;color:#7a6fa8;}
.ok{color:#1f7a44;font-weight:700;}.exp{color:#b04444;font-weight:700;}
.empty{color:#9a93b8;text-align:center;font-style:italic;}
.refresh{float:right;font-size:12px;color:#8b5cf6;text-decoration:none;}
</style></head><body>
<a class=refresh href="?key=${esc(req.query.key)}">↻ Refresh</a>
<h1><span class=b1>AI.</span><span class=b2>Reply</span> Owner Dashboard</h1>
<div class=sub>Live data · ${new Date().toLocaleString('en-IN')}</div>
<div class=cards>
  <div class=c><div class=n>${active.length}</div><div class=l>Active subscribers</div></div>
  <div class=c><div class=n>${subs.length}</div><div class=l>Total ever</div></div>
  <div class=c><div class=n>${usage.length}</div><div class=l>Active today</div></div>
  <div class=c><div class=n>${totalToday}</div><div class=l>Replies today</div></div>
  <div class=c><div class=n>${reports.length}</div><div class=l>Open reports</div></div>
</div>
<h2>💳 Subscribers</h2>
<table><tr><th>Plan</th><th>Activated</th><th>Expires</th><th>Status</th><th>Device</th><th>Code</th></tr>${subRows}</table>
<h2>💰 Razorpay payments</h2>
<table><tr><th>When</th><th>Plan</th><th>Email</th><th>Device</th><th>Payment ID</th></tr>${payRows}</table>
<h2>📊 Usage today</h2>
<table><tr><th>Device</th><th>Plan</th><th>Used</th><th>Last seen</th></tr>${useRows}</table>
<h2>🛠️ Problem reports</h2>
<table><tr><th>When</th><th>Plan</th><th>Message</th><th>Context</th></tr>${repRows}</table>
</body></html>`);
  } catch (e) {
    res.status(500).send('Dashboard error: ' + esc(e.message));
  }
};
