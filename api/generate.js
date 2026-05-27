export default async function handler(req, res) {
  // ── CORS headers — must be on EVERY response including errors ──────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read systemPrompt + userContent sent by bg.js
    const { systemPrompt, userContent } = req.body;

    if (!systemPrompt || !userContent) {
      return res.status(400).json({ error: 'Missing systemPrompt or userContent in request body.' });
    }

    // Get API key from Vercel environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server. Add OPENAI_API_KEY in Vercel dashboard.' });
    }

    // Call OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent }
        ]
      })
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({
        error: 'OpenAI error: ' + (data.error?.message || 'unknown')
      });
    }

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(500).json({ error: 'OpenAI returned empty response.' });
    }

    // Return reply — bg.js reads d.reply
    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({
      error: 'Server error: ' + error.message
    });
  }
}
