// AI.Reply — /api/generate  (SPEED-OPTIMIZED v2)
// Changes vs v1:
//   - max_tokens capped at 350 (emails don't need more; big speed win)
//   - userContent trimmed to 6000 chars server-side (long threads slowed everything)
//   - temperature 0.7, no streaming (extension contract unchanged: {reply} / {error})
// Required Vercel env var: OPENAI_API_KEY

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.OPENAI_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'Server not configured' });

  try {
    let { systemPrompt, userContent } = req.body || {};
    if (!systemPrompt || !userContent) return res.status(400).json({ error: 'Missing prompt' });

    // Trim very long threads: keep the START (latest message in Gmail DOM order)
    // and a slice of the end so older context isn't fully lost.
    userContent = String(userContent);
    if (userContent.length > 6000) {
      userContent = userContent.slice(0, 4500) + '\n[...older thread trimmed...]\n' + userContent.slice(-1200);
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 350,
        temperature: 0.7,
        messages: [
          { role: 'system', content: String(systemPrompt).slice(0, 4000) },
          { role: 'user', content: userContent }
        ]
      })
    });

    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('AIREPLY-ERROR upstream', r.status, t.slice(0, 300));
      return res.status(502).json({ error: 'AI service error ' + r.status });
    }

    const d = await r.json();
    const reply = d?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'Empty AI response' });

    return res.status(200).json({ reply });
  } catch (e) {
    console.error('AIREPLY-ERROR generate', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
