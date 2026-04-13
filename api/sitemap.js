// Vercel Serverless Function: /api/sitemap
// Auto-generates sitemap.xml from Supabase data

const SUPABASE_URL = 'https://fnpxaneextqidbessnej.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_132Gl37kwIXtdJc5VHtGCw_iXPxa6cW';
const SITE_URL = 'https://www.gonogo.co.uk';

export default async function handler(req, res) {
  try {
    const [cats, brands] = await Promise.all([
      sbGet('categories?select=slug'),
      sbGet('brands?select=slug,category_slug,last_updated&order=last_updated.desc')
    ]);

    const today = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages (clean URLs matching canonical tags)
    xml += url(SITE_URL + '/', today, '1.0', 'daily');
    xml += url(SITE_URL + '/compare', today, '0.6', 'weekly');
    xml += url(SITE_URL + '/business', today, '0.7', 'weekly');
    xml += url(SITE_URL + '/about', today, '0.5', 'monthly');
    xml += url(SITE_URL + '/privacy', today, '0.3', 'monthly');
    xml += url(SITE_URL + '/terms', today, '0.3', 'monthly');

    // Category pages
    for (const cat of cats) {
      xml += url(SITE_URL + '/category?cat=' + cat.slug, today, '0.8', 'weekly');
    }

    // Brand pages
    for (const brand of brands) {
      const lastmod = brand.last_updated || today;
      xml += url(SITE_URL + '/brand?id=' + brand.slug, lastmod, '0.7', 'weekly');
    }

    xml += '</urlset>';

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);

  } catch (err) {
    res.status(500).send('<!-- Error generating sitemap: ' + err.message + ' -->');
  }
}

function url(loc, lastmod, priority, changefreq) {
  return '  <url>\n' +
    '    <loc>' + loc + '</loc>\n' +
    '    <lastmod>' + lastmod + '</lastmod>\n' +
    '    <changefreq>' + changefreq + '</changefreq>\n' +
    '    <priority>' + priority + '</priority>\n' +
    '  </url>\n';
}

async function sbGet(path) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  });
  if (!r.ok) throw new Error('Supabase: ' + r.status);
  return r.json();
}
