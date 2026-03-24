// Vercel Serverless Function: /api/research
// Researches a brand using Perplexity API and updates Supabase
// POST { brandName, categorySlug, brandSlug }

const SUPABASE_URL = 'https://fnpxaneextqidbessnej.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_132Gl37kwIXtdJc5VHtGCw_iXPxa6cW';
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY || '';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { brandName, categorySlug, brandSlug } = req.body || {};
  if (!brandName || !brandSlug) {
    return res.status(400).json({ error: 'brandName and brandSlug required' });
  }

  // If no Perplexity key, just mark as fresh and return
  if (!PERPLEXITY_KEY) {
    const today = new Date().toISOString().split('T')[0];
    await supabasePatch(brandSlug, { last_updated: today });
    return res.status(200).json({
      ok: true,
      mode: 'mark-fresh',
      message: 'No PERPLEXITY_API_KEY set — marked as fresh. Add the key in Vercel Environment Variables to enable AI research.',
      brandSlug,
      last_updated: today
    });
  }

  try {
    // Step 1: Research via Perplexity API
    const prompt = `Research the South African brand "${brandName}" (category: ${categorySlug || 'general'}). 
Provide a JSON object with these exact fields:
{
  "gonogo_score": <integer 0-100, overall brand quality score>,
  "verdict": "<GO|GO WITH CAUTION|NOGO>",
  "overview": "<2-3 sentence brand overview>",
  "rating_summary": "<2-3 sentence summary of the rating rationale>",
  "framework_breakdown": [
    {"category": "Compliance", "score": "<X/20>", "description": "<1 sentence>"},
    {"category": "Customer Satisfaction", "score": "<X/25>", "description": "<1 sentence>"},
    {"category": "Product Value", "score": "<X/35>", "description": "<1 sentence>"},
    {"category": "Innovation", "score": "<X/10>", "description": "<1 sentence>"},
    {"category": "Customer Support", "score": "<X/15>", "description": "<1 sentence>"},
    {"category": "Accessibility & Security", "score": "<X/10>", "description": "<1 sentence>"}
  ],
  "key_strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "key_concerns": ["<concern1>", "<concern2>", "<concern3>"],
  "app_ratings": {"google_play": "<X.X/5 or N/A>", "ios": "<X.X/5 or N/A>"},
  "social_sentiment": {
    "summary": "<1 sentence>",
    "positive_themes": ["<theme1>", "<theme2>"],
    "common_concerns": ["<concern1>", "<concern2>"]
  }
}
Use real, current data. Score based on: regulatory compliance, customer satisfaction (HelloPeter, Trustpilot, app store reviews), product value, innovation, support quality, and accessibility/security. The gonogo_score should equal round((sum of raw scores / sum of max scores) * 100). Return ONLY valid JSON, no markdown.`;

    const pplxRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'You are a South African brand research analyst. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!pplxRes.ok) {
      const errText = await pplxRes.text();
      return res.status(500).json({ error: 'Perplexity API error', details: errText });
    }

    const pplxData = await pplxRes.json();
    const content = pplxData.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response (strip markdown fences if present)
    let research;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      research = JSON.parse(jsonStr);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse research response', raw: content });
    }

    // Step 2: Update Supabase
    const update = {
      gonogo_score: research.gonogo_score,
      verdict: research.verdict,
      overview: research.overview || '',
      rating_summary: research.rating_summary || '',
      framework_breakdown: research.framework_breakdown || [],
      key_strengths: research.key_strengths || [],
      key_concerns: research.key_concerns || [],
      app_ratings: research.app_ratings || {},
      social_sentiment: research.social_sentiment || {},
      last_updated: new Date().toISOString().split('T')[0]
    };

    await supabasePatch(brandSlug, update);

    return res.status(200).json({
      ok: true,
      mode: 'ai-research',
      brandSlug,
      research: update
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function supabasePatch(slug, data) {
  const url = `${SUPABASE_URL}/rest/v1/brands?slug=eq.${encodeURIComponent(slug)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('Supabase PATCH failed: ' + t);
  }
  return r.json();
}
