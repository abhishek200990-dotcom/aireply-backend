// AI.Reply error logging endpoint — add as api/log.js in your GitHub repo.
// View errors: Vercel dashboard → your project → Logs → search "AIREPLY-ERROR".
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { msg, src, line, stack, ver, mode } = req.body || {};
    console.error('AIREPLY-ERROR', JSON.stringify({
      t: new Date().toISOString(),
      msg: String(msg || '').slice(0, 300),
      src: String(src || '').slice(0, 120),
      line: line || 0,
      mode: String(mode || ''),
      ver: String(ver || ''),
      stack: String(stack || '').slice(0, 500)
    }));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
}
