let cooldownUntil = 0;
let lastImageAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  // 1. PENGATURAN CORS WAJIB (Harus paling atas)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. TANGANI PREFLIGHT DARI BROWSER
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. KODE ASLI KAMU
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const { prompt, aspectRatio = '1:1' } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ ok: false, message: 'GEMINI_API_KEY belum diatur di Vercel' });
    }

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ ok: false, message: 'Prompt wajib diisi.' });
    }

    const now = Date.now();
    if (now < cooldownUntil) {
      const waitSec = Math.ceil((cooldownUntil - now) / 1000);
      return res.status(429).json({ ok: false, message: `Batas permintaan gambar tercapai. Tunggu ${waitSec} detik lalu coba lagi.` });
    }

    const diff = now - lastImageAt;
    if (diff < 4000) {
      await sleep(4000 - diff);
    }
    lastImageAt = Date.now();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: String(prompt) }]
            }
          ],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        cooldownUntil = Date.now() + 45000;
      }
      return res.status(response.status).json({
        ok: false,
        message: data?.error?.message || 'Gagal dari Gemini Image API'
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const base64Data = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
    const mimeType = imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || 'image/png';

    if (!base64Data) {
      return res.status(500).json({ ok: false, message: 'Respons gambar kosong atau format tidak dikenali.' });
    }

    return res.status(200).json({ ok: true, imageUrl: `data:${mimeType};base64,${base64Data}` });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.message || 'Server error' });
  }
}
