// GoNoGo SA — Data Access Layer
// Works with the BRAND_DATA array from data_part[A-F].js

// ============================================================
// CATEGORY / INDUSTRY HELPERS
// ============================================================
function getCategories() {
  return BRAND_DATA.map(cat => ({
    id: cat.slug,
    name: cat.category,
    icon: cat.icon,
    brandCount: cat.brands.length,
    scoringCategories: cat.scoring_categories
  }));
}

function getCategoriesWithBrands() {
  return BRAND_DATA.map(cat => ({
    id: cat.slug,
    name: cat.category,
    icon: cat.icon,
    brandCount: cat.brands.length,
    hasBrands: cat.brands.length > 0,
    scoringCategories: cat.scoring_categories
  }));
}

function getCategoryBySlug(slug) {
  const cat = BRAND_DATA.find(c => c.slug === slug);
  if (!cat) return null;
  return {
    id: cat.slug,
    name: cat.category,
    icon: cat.icon,
    brandCount: cat.brands.length,
    scoringCategories: cat.scoring_categories,
    brands: cat.brands.map(b => normalizeBrand(b, cat))
  };
}

// ============================================================
// BRAND NORMALIZATION
// Converts SA brand data into a flat, consistent format
// ============================================================
function normalizeBrand(brand, category) {
  // Parse framework_breakdown scores
  const categoryScores = {};
  const categoryDescriptions = {};
  (brand.framework_breakdown || []).forEach(fb => {
    const parts = fb.score.split('/');
    const score = parseFloat(parts[0]);
    const max = parseFloat(parts[1]);
    const key = fb.category;
    categoryScores[key] = { score, max, description: fb.description };
    categoryDescriptions[key] = fb.description;
  });

  // Parse app ratings
  const gpRaw = (brand.app_ratings && brand.app_ratings.google_play) || 'N/A';
  const iosRaw = (brand.app_ratings && brand.app_ratings.ios) || 'N/A';
  const gpScore = parseFloat(gpRaw) || 0;
  const iosScore = parseFloat(iosRaw) || 0;

  return {
    id: slugify(brand.name),
    name: brand.name,
    categorySlug: category.slug,
    categoryName: category.category,
    categoryIcon: category.icon,
    logo: brand.logo_url || '',
    website: brand.website_url || '',
    overallScore: brand.gonogo_score,
    verdict: brand.verdict,
    categoryScores: categoryScores,
    scoringCategories: category.scoring_categories,
    keyFeatures: brand.key_features || [],
    pricing: brand.pricing || [],
    appRatings: {
      googlePlay: gpRaw,
      ios: iosRaw,
      googlePlayScore: gpScore,
      iosScore: iosScore
    },
    strengths: brand.key_strengths || [],
    concerns: brand.key_concerns || [],
    socialSentiment: brand.social_sentiment || {},
    lastUpdated: '2026-03-01'
  };
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ============================================================
// BRAND ACCESS
// ============================================================
function getAllBrands() {
  const all = [];
  BRAND_DATA.forEach(cat => {
    cat.brands.forEach(b => {
      all.push(normalizeBrand(b, cat));
    });
  });
  return all;
}

function getBrandsByCategory(slug) {
  const cat = BRAND_DATA.find(c => c.slug === slug);
  if (!cat) return [];
  return cat.brands.map(b => normalizeBrand(b, cat));
}

function getBrandById(id) {
  for (const cat of BRAND_DATA) {
    for (const b of cat.brands) {
      if (slugify(b.name) === id) {
        return normalizeBrand(b, cat);
      }
    }
  }
  return null;
}

function getBrandByName(name) {
  for (const cat of BRAND_DATA) {
    for (const b of cat.brands) {
      if (b.name === name) {
        return normalizeBrand(b, cat);
      }
    }
  }
  return null;
}

function getTopBrands(count = 6) {
  return getAllBrands()
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, count);
}

function getTotalBrandCount() {
  return BRAND_DATA.reduce((sum, cat) => sum + cat.brands.length, 0);
}

// ============================================================
// SCORE HELPERS
// ============================================================
function getScoreColor(score) {
  if (score >= 80) return '#11a551';
  if (score >= 60) return '#ff9800';
  return '#e74c3c';
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Poor';
}

function getVerdictFromScore(score) {
  if (score >= 80) return 'GO';
  if (score >= 60) return 'GO WITH CAUTION';
  return 'NOGO';
}

// ============================================================
// PERSISTENT STORAGE (localStorage)
// ============================================================
const GoNoGoStorage = {
  get(key) { try { var v = localStorage.getItem('gonogo_' + key); return v ? JSON.parse(v) : null; } catch(e) { return null; } },
  set(key, value) { try { localStorage.setItem('gonogo_' + key, JSON.stringify(value)); } catch(e) {} },
  remove(key) { try { localStorage.removeItem('gonogo_' + key); } catch(e) {} },
  getLocal(key) { return this.get('local_' + key); },
  setLocal(key, value) { this.set('local_' + key, value); }
};
