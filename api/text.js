export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ ok: false, message: 'GEMINI_API_KEY belum diatur di Vercel' });
    }

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ ok: false, message: 'Prompt wajib diisi.' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: String(prompt) }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: data?.error?.message || 'Gagal dari Gemini API'
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ ok: true, text });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Server error'
    });
  }
}
