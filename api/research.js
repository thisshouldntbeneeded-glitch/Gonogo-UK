// Vercel Serverless Function: /api/research
// Researches a brand using Perplexity API with full GoNoGo scoring methodology
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://fnpxaneextqidbessnej.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_132Gl37kwIXtdJc5VHtGCw_iXPxa6cW';
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY || '';

// Load scoring methodology
let SCORING;
try {
  SCORING = JSON.parse(readFileSync(join(process.cwd(), 'api', 'scoring.json'), 'utf8'));
} catch (e) {
  SCORING = {};
}

// SA standard scoring (used when no industry-specific scoring exists)
const SA_STANDARD = {
  categories: [
    { name: 'Compliance', max: 20, subs: [{ name: 'Regulatory Standing', weight: 10, criteria: 'Licensing, regulatory body memberships, legal compliance' }, { name: 'Track Record', weight: 10, criteria: 'Fines, sanctions, violations history' }] },
    { name: 'Customer Satisfaction', max: 25, subs: [{ name: 'Review Aggregation', weight: 10, criteria: 'HelloPeter, Trustpilot, Google, app store ratings' }, { name: 'Complaint Resolution', weight: 8, criteria: 'Response times, resolution quality' }, { name: 'Social Sentiment', weight: 7, criteria: 'Social media feedback, community perception' }] },
    { name: 'Product Value', max: 35, subs: [{ name: 'Pricing', weight: 15, criteria: 'Fee transparency, value for money, competitiveness' }, { name: 'Features', weight: 12, criteria: 'Product breadth, feature quality' }, { name: 'Transparency', weight: 8, criteria: 'Clear T&Cs, no hidden charges' }] },
    { name: 'Innovation', max: 10, subs: [{ name: 'Technology', weight: 6, criteria: 'Digital experience, tech adoption, unique features' }, { name: 'Leadership', weight: 4, criteria: 'Industry firsts, forward-thinking approach' }] },
    { name: 'Customer Support', max: 15, subs: [{ name: 'Availability', weight: 8, criteria: 'Support channels, hours, accessibility' }, { name: 'Quality', weight: 7, criteria: 'Response time, agent knowledge, resolution rates' }] },
    { name: 'Accessibility & Security', max: 10, subs: [{ name: 'Accessibility', weight: 4, criteria: 'Platform accessibility, inclusive design, POPIA/GDPR' }, { name: 'Security', weight: 3, criteria: 'Data security, breach history, fraud protection' }, { name: 'App Quality', weight: 3, criteria: 'iOS/Android ratings, usability' }] }
  ]
};

function getScoringForIndustry(categorySlug) {
  // Try exact match first, then fuzzy
  const slug = (categorySlug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (SCORING[slug]) return SCORING[slug];
  // Try partial match
  for (const key of Object.keys(SCORING)) {
    if (slug.includes(key) || key.includes(slug)) return SCORING[key];
  }
  // Map common SA categories to UK equivalents
  const map = { 'mobile-networks': 'mobile', 'online-retailers': 'e-commerce', 'food-delivery': 'meal-delivery', 'property-letting': null, 'medical-aid': null, 'home-cleaning': null, 'armed-response': null, 'car-dealers': null, 'car-rentals': null };
  if (map[slug] && SCORING[map[slug]]) return SCORING[map[slug]];
  return null;
}

function buildScoringPrompt(scoring) {
  let prompt = '';
  for (const cat of scoring.categories) {
    prompt += `\n**${cat.name}** (max: ${cat.max} points)\n`;
    for (const sub of cat.subs) {
      prompt += `  - ${sub.name} (weight: ${sub.weight}): ${sub.criteria}\n`;
      if (sub.high) prompt += `    HIGH score: ${sub.high}\n`;
      if (sub.low) prompt += `    LOW score: ${sub.low}\n`;
    }
  }
  return prompt;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { brandName, categorySlug, brandSlug } = req.body || {};
  if (!brandName || !brandSlug) return res.status(400).json({ error: 'brandName and brandSlug required' });

  const today = new Date().toISOString().split('T')[0];

  if (!PERPLEXITY_KEY) {
    await supabasePatch(brandSlug, { last_updated: today });
    return res.status(200).json({ ok: true, mode: 'mark-fresh', message: 'No PERPLEXITY_API_KEY — marked as fresh. Add the key in Vercel Environment Variables.', brandSlug, last_updated: today });
  }

  try {
    // Get the right scoring methodology for this industry
    const industryScoring = getScoringForIndustry(categorySlug);
    const scoring = industryScoring || SA_STANDARD;
    const scoringPrompt = buildScoringPrompt(scoring);
    const industryName = industryScoring ? industryScoring.name : categorySlug;

    // Build the framework breakdown format from scoring
    const frameworkFormat = scoring.categories.map(c => 
      `{"category": "${c.name}", "score": "<X/${c.max}>", "description": "<detailed 1-2 sentence assessment citing specific evidence>"}`
    ).join(',\n    ');

    const prompt = `You are a brand research analyst for GoNoGo, an independent brand rating platform. Research "${brandName}" in the ${industryName} industry thoroughly using real, current data.

## SCORING METHODOLOGY
Score this brand using the following framework. Each category has weighted subcategories — distribute points based on the evidence you find:
${scoringPrompt}

## RESEARCH REQUIREMENTS
For each scoring category, you MUST:
1. Search for real data: Trustpilot ratings, app store reviews, HelloPeter (SA brands), Which? surveys (UK brands), regulatory records (FCA/Ofgem/Ofcom/ICASA/SARB), complaint data
2. Cite specific numbers (e.g. "Trustpilot 4.2/5 from 12,400 reviews", "FCA authorized, no enforcement actions")
3. Score conservatively — don't inflate. A brand with mixed reviews should NOT score above 70%
4. The description for each category must reference specific evidence, not generic statements

## SCORING RULES
- Each subcategory score should be proportional to its weight
- The category score is the SUM of subcategory scores
- GoNoGoScore = round((sum of all category scores / 100) * 100)
- Verdict: 80+ = "TOP PERFORMER", 60-79 = "GO", below 60 = "NOGO"
- Be honest and critical. Real brands rarely score above 85.

Return ONLY valid JSON with this exact structure:
{
  "gonogo_score": <integer 0-100>,
  "verdict": "<TOP PERFORMER|GO|NOGO>",
  "overview": "<3-4 sentence brand overview with key facts — founding year, market position, what they're known for>",
  "rating_summary": "<3-4 sentence explanation of the rating, referencing the strongest and weakest scoring areas>",
  "framework_breakdown": [
    ${frameworkFormat}
  ],
  "key_features": ["<feature1>", "<feature2>", "<feature3>", "<feature4>", "<feature5>"],
  "key_strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "key_concerns": ["<concern1>", "<concern2>", "<concern3>"],
  "app_ratings": {"google_play": "<X.X/5 or N/A>", "ios": "<X.X/5 or N/A>"},
  "social_sentiment": {
    "summary": "<1-2 sentence summary of public sentiment>",
    "positive_themes": ["<theme1>", "<theme2>", "<theme3>"],
    "common_concerns": ["<concern1>", "<concern2>", "<concern3>"]
  }
}

Return ONLY the JSON. No markdown, no explanation.`;

    const pplxRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PERPLEXITY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a thorough brand research analyst. You cite real data and score conservatively. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 3000
      })
    });

    if (!pplxRes.ok) {
      const errText = await pplxRes.text();
      return res.status(500).json({ error: 'Perplexity API error', details: errText });
    }

    const pplxData = await pplxRes.json();
    const content = pplxData.choices?.[0]?.message?.content || '';

    let research;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      research = JSON.parse(jsonStr);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse research response', raw: content.substring(0, 500) });
    }

    // Validate score matches framework
    if (research.framework_breakdown) {
      let totalScore = 0, totalMax = 0;
      for (const fb of research.framework_breakdown) {
        const parts = fb.score.split('/');
        totalScore += parseFloat(parts[0]) || 0;
        totalMax += parseFloat(parts[1]) || 0;
      }
      const calculated = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
      // Use calculated score if it differs significantly from what AI returned
      if (Math.abs(calculated - research.gonogo_score) > 3) {
        research.gonogo_score = calculated;
        research.verdict = calculated >= 80 ? 'TOP PERFORMER' : calculated >= 60 ? 'GO' : 'NOGO';
      }
    }

    const update = {
      gonogo_score: research.gonogo_score,
      verdict: research.verdict,
      overview: research.overview || '',
      rating_summary: research.rating_summary || '',
      framework_breakdown: research.framework_breakdown || [],
      key_features: research.key_features || [],
      key_strengths: research.key_strengths || [],
      key_concerns: research.key_concerns || [],
      app_ratings: research.app_ratings || {},
      social_sentiment: research.social_sentiment || {},
      last_updated: today
    };

    await supabasePatch(brandSlug, update);

    return res.status(200).json({ ok: true, mode: 'ai-research', brandSlug, research: update });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function supabasePatch(slug, data) {
  const url = `${SUPABASE_URL}/rest/v1/brands?slug=eq.${encodeURIComponent(slug)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('Supabase PATCH failed: ' + await r.text());
  return r.json();
}
