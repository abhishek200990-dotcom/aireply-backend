export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { systemPrompt, userContent } = req.body;
    if (!systemPrompt || !userContent)
      return res.status(400).json({ error: 'Missing systemPrompt or userContent.' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured in Vercel environment.' });

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 450,
        temperature: 0.8,
        presence_penalty: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent }
        ]
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'OpenAI: ' + (data.error?.message || 'unknown') });
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(500).json({ error: 'Empty response from OpenAI.' });
    return res.status(200).json({ reply });
  } catch(e) {
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
