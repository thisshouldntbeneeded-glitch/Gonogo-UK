#!/usr/bin/env python3
"""
GoNoGo SA — Google Sheets Sync Script
Reads brand data from the SA Mastersheet and reviews from the SA Reviews Sheet,
generates static JSON API files that the frontend can consume.

This script is called by the cron job and also by the backend server on demand.
All data lives in Google Sheets — this just generates the JSON cache.
"""

import json
import os
import sys
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'api_data')
os.makedirs(DATA_DIR, exist_ok=True)

def parse_mastersheet(raw_rows):
    """Parse raw mastersheet rows into structured brand data."""
    if not raw_rows or len(raw_rows) < 2:
        print("ERROR: No data in mastersheet")
        return []

    headers = raw_rows[0]
    brands = []

    for row in raw_rows[1:]:
        if len(row) < 5 or not row[4]:  # Need at least BrandName
            continue

        # Pad row to match headers length
        while len(row) < len(headers):
            row.append('')

        brand = {}
        for i, h in enumerate(headers):
            brand[h] = row[i] if i < len(row) else ''

        brands.append(brand)

    return brands


def build_category_data(brands):
    """Group brands by category and build the category structure."""
    categories = {}

    for b in brands:
        slug = b.get('CategorySlug', '')
        if not slug:
            continue

        if slug not in categories:
            categories[slug] = {
                'id': slug,
                'name': b.get('CategoryName', ''),
                'icon': b.get('CategoryIcon', ''),
                'scoring_categories': [],
                'brands': []
            }

        # Build scoring categories from this brand's data
        scoring_cats = [
            {'name': 'Compliance', 'max': safe_int(b.get('Compliance_Max', '20'))},
            {'name': 'Customer Satisfaction', 'max': safe_int(b.get('CustomerSatisfaction_Max', '25'))},
            {'name': 'Product Value', 'max': safe_int(b.get('ProductValue_Max', '35'))},
            {'name': 'Innovation', 'max': safe_int(b.get('Innovation_Max', '10'))},
            {'name': 'Customer Support', 'max': safe_int(b.get('CustomerSupport_Max', '15'))},
            {'name': 'Accessibility & Security', 'max': safe_int(b.get('AccessibilitySecurity_Max', '10'))}
        ]

        if not categories[slug]['scoring_categories']:
            categories[slug]['scoring_categories'] = scoring_cats

        # Normalize brand data
        brand_data = normalize_brand(b)
        categories[slug]['brands'].append(brand_data)

    return categories


def normalize_brand(b):
    """Convert a mastersheet row into the normalized brand format."""
    framework = [
        {'category': 'Compliance', 'score': f"{b.get('Compliance_Score','0')}/{b.get('Compliance_Max','20')}", 'description': b.get('Compliance_Description', '')},
        {'category': 'Customer Satisfaction', 'score': f"{b.get('CustomerSatisfaction_Score','0')}/{b.get('CustomerSatisfaction_Max','25')}", 'description': b.get('CustomerSatisfaction_Description', '')},
        {'category': 'Product Value', 'score': f"{b.get('ProductValue_Score','0')}/{b.get('ProductValue_Max','35')}", 'description': b.get('ProductValue_Description', '')},
        {'category': 'Innovation', 'score': f"{b.get('Innovation_Score','0')}/{b.get('Innovation_Max','10')}", 'description': b.get('Innovation_Description', '')},
        {'category': 'Customer Support', 'score': f"{b.get('CustomerSupport_Score','0')}/{b.get('CustomerSupport_Max','15')}", 'description': b.get('CustomerSupport_Description', '')},
        {'category': 'Accessibility & Security', 'score': f"{b.get('AccessibilitySecurity_Score','0')}/{b.get('AccessibilitySecurity_Max','10')}", 'description': b.get('AccessibilitySecurity_Description', '')}
    ]

    # Parse semicolon-separated lists
    key_features = [f.strip() for f in b.get('KeyFeatures', '').split(';') if f.strip()]
    key_strengths = [s.strip() for s in b.get('KeyStrengths', '').split(';') if s.strip()]
    key_concerns = [c.strip() for c in b.get('KeyConcerns', '').split(';') if c.strip()]
    pos_themes = [t.strip() for t in b.get('SocialSentiment_Positive', '').split(';') if t.strip()]
    neg_themes = [t.strip() for t in b.get('SocialSentiment_Concerns', '').split(';') if t.strip()]

    # Parse pricing
    pricing_raw = b.get('Pricing', '')
    pricing = []
    if pricing_raw:
        pricing = [{'name': 'Pricing', 'cost': pricing_raw, 'features': ''}]

    # Normalize verdict
    verdict = b.get('Verdict', 'GO WITH CAUTION').upper().strip()
    if verdict == 'CAUTION':
        verdict = 'GO WITH CAUTION'

    score = safe_int(b.get('GoNoGoScore', '0'))
    if not verdict or verdict not in ['GO', 'GO WITH CAUTION', 'NOGO']:
        if score >= 80:
            verdict = 'GO'
        elif score >= 60:
            verdict = 'GO WITH CAUTION'
        else:
            verdict = 'NOGO'

    return {
        'name': b.get('BrandName', ''),
        'gonogo_score': score,
        'verdict': verdict,
        'logo_url': b.get('LogoURL', ''),
        'website_url': b.get('WebsiteURL', ''),
        'framework_breakdown': framework,
        'key_features': key_features,
        'pricing': pricing,
        'app_ratings': {
            'google_play': b.get('GooglePlay_Rating', 'N/A'),
            'ios': b.get('iOS_Rating', 'N/A')
        },
        'key_strengths': key_strengths,
        'key_concerns': key_concerns,
        'social_sentiment': {
            'summary': b.get('SocialSentiment_Summary', ''),
            'positive_themes': pos_themes,
            'common_concerns': neg_themes
        },
        'last_updated': b.get('LastUpdated', '')
    }


def parse_reviews(raw_rows):
    """Parse raw review rows from the Reviews sheet."""
    if not raw_rows or len(raw_rows) < 2:
        return []

    headers = raw_rows[0]
    reviews = []

    for row in raw_rows[1:]:
        if len(row) < 4:
            continue

        while len(row) < len(headers):
            row.append('')

        review = {}
        for i, h in enumerate(headers):
            review[h] = row[i] if i < len(row) else ''

        reviews.append(review)

    return reviews


def generate_api_files(categories, reviews):
    """Generate all the static JSON API files."""

    # 1. categories.json
    cats_list = []
    for slug, cat in categories.items():
        cats_list.append({
            'id': cat['id'],
            'name': cat['name'],
            'icon': cat['icon'],
            'brandCount': len(cat['brands']),
            'scoringCategories': cat['scoring_categories']
        })
    write_json('categories.json', cats_list)

    # 2. All brands (normalized with helpers-style format)
    all_brands = []
    for slug, cat in categories.items():
        for brand in cat['brands']:
            normalized = helpers_normalize(brand, cat)
            all_brands.append(normalized)
    write_json('brands.json', all_brands)

    # 3. Brands by category
    for slug, cat in categories.items():
        cat_brands = [helpers_normalize(b, cat) for b in cat['brands']]
        write_json(f'brands_{slug}.json', cat_brands)

    # 4. Individual brand files
    for b in all_brands:
        write_json(f'brand_{b["id"]}.json', b)

    # 5. Top brands
    sorted_brands = sorted(all_brands, key=lambda x: x['overallScore'], reverse=True)
    write_json('top_brands.json', sorted_brands[:10])

    # 6. Stats
    total_brands = len(all_brands)
    avg_score = round(sum(b['overallScore'] for b in all_brands) / max(total_brands, 1), 1)
    go_count = sum(1 for b in all_brands if b['verdict'] == 'GO')
    caution_count = sum(1 for b in all_brands if b['verdict'] == 'GO WITH CAUTION')
    nogo_count = sum(1 for b in all_brands if b['verdict'] == 'NOGO')

    write_json('stats.json', {
        'totalCategories': len(categories),
        'totalBrands': total_brands,
        'totalReviews': len(reviews),
        'averageScore': avg_score,
        'goCount': go_count,
        'cautionCount': caution_count,
        'nogoCount': nogo_count
    })

    # 7. Reviews
    write_json('reviews.json', reviews)

    # 8. Brand data JS files (for static fallback)
    generate_brand_data_js(categories)

    print(f"Generated API files: {total_brands} brands, {len(categories)} categories, {len(reviews)} reviews")
    return total_brands


def helpers_normalize(brand, cat):
    """Convert brand to the helpers.js normalized format."""
    category_scores = {}
    for fb in brand.get('framework_breakdown', []):
        parts = fb['score'].split('/')
        score = safe_float(parts[0])
        max_val = safe_float(parts[1]) if len(parts) > 1 else 100
        category_scores[fb['category']] = {
            'score': score,
            'max': max_val,
            'description': fb.get('description', '')
        }

    gp_raw = brand.get('app_ratings', {}).get('google_play', 'N/A')
    ios_raw = brand.get('app_ratings', {}).get('ios', 'N/A')

    brand_id = slugify(brand['name'])

    return {
        'id': brand_id,
        'name': brand['name'],
        'categorySlug': cat['id'],
        'categoryName': cat['name'],
        'categoryIcon': cat['icon'],
        'logo': brand.get('logo_url', ''),
        'website': brand.get('website_url', ''),
        'overallScore': brand.get('gonogo_score', 0),
        'verdict': brand.get('verdict', 'GO WITH CAUTION'),
        'categoryScores': category_scores,
        'scoringCategories': cat.get('scoring_categories', []),
        'keyFeatures': brand.get('key_features', []),
        'pricing': brand.get('pricing', []),
        'appRatings': {
            'googlePlay': gp_raw,
            'ios': ios_raw,
            'googlePlayScore': safe_float(gp_raw.replace('/5', '')),
            'iosScore': safe_float(ios_raw.replace('/5', ''))
        },
        'strengths': brand.get('key_strengths', []),
        'concerns': brand.get('key_concerns', []),
        'socialSentiment': brand.get('social_sentiment', {}),
        'lastUpdated': brand.get('last_updated', datetime.now().strftime('%Y-%m-%d'))
    }


def generate_brand_data_js(categories):
    """Generate the data_partA-F.js files for static fallback."""
    cat_list = list(categories.values())

    # Split into roughly equal parts
    parts = ['A', 'B', 'C', 'D', 'E', 'F']
    chunk_size = max(1, len(cat_list) // len(parts) + (1 if len(cat_list) % len(parts) else 0))

    data_dir = os.path.join(os.path.dirname(DATA_DIR), 'data')
    os.makedirs(data_dir, exist_ok=True)

    var_names = []
    for i, part in enumerate(parts):
        start = i * chunk_size
        end = min(start + chunk_size, len(cat_list))
        chunk = cat_list[start:end] if start < len(cat_list) else []

        # Convert to the old JS format
        js_data = []
        for cat in chunk:
            js_data.append({
                'category': cat['name'],
                'slug': cat['id'],
                'icon': cat['icon'],
                'scoring_categories': cat['scoring_categories'],
                'brands': cat['brands']
            })

        var_name = f'BRAND_DATA_PART{part}'
        var_names.append(var_name)
        content = f'var {var_name} = {json.dumps(js_data, ensure_ascii=False)};'

        with open(os.path.join(data_dir, f'data_part{part}.js'), 'w') as f:
            f.write(content)

    # Generate data.js that combines all parts
    concat_parts = ', '.join(var_names)
    with open(os.path.join(data_dir, 'data.js'), 'w') as f:
        f.write(f'var BRAND_DATA = {var_names[0]}.concat({", ".join(var_names[1:])});')

    print(f"Generated {len(parts)} data_part*.js files + data.js")


def write_json(filename, data):
    """Write JSON file to the api_data directory."""
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def slugify(name):
    """Convert name to URL-friendly slug."""
    import re
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug


def safe_int(val):
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


def safe_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


if __name__ == '__main__':
    # When called directly, read from saved JSON files (produced by cron)
    mastersheet_file = os.path.join(os.path.dirname(DATA_DIR), 'mastersheet_raw.json')
    reviews_file = os.path.join(os.path.dirname(DATA_DIR), 'reviews_raw.json')

    if os.path.exists(mastersheet_file):
        with open(mastersheet_file) as f:
            raw_brands = json.load(f)
        brands = parse_mastersheet(raw_brands)
        categories = build_category_data(brands)
    else:
        print(f"WARNING: {mastersheet_file} not found. Run the cron sync first.")
        sys.exit(1)

    reviews = []
    if os.path.exists(reviews_file):
        with open(reviews_file) as f:
            raw_reviews = json.load(f)
        reviews = parse_reviews(raw_reviews)

    total = generate_api_files(categories, reviews)
    print(f"Sync complete: {total} brands processed")
