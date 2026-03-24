#!/usr/bin/env python3
"""
GoNoGo SA — API Server (Google Sheets Edition)
Reads brand data from pre-generated JSON files (synced from Google Sheets).
Reviews are stored in JSON files and synced to/from Google Sheets via cron.
No SQLite dependency — all persistent data lives in Google Sheets.
"""

import json
import os
import uuid
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from research_engine import research_brand, apply_research_to_brand

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
API_DATA_DIR = os.path.join(BASE_DIR, 'api_data')
REVIEWS_FILE = os.path.join(API_DATA_DIR, 'reviews.json')

# In-memory cache
brand_cache = {}
reviews_cache = []


def load_json(filename):
    """Load a JSON file from api_data directory."""
    filepath = os.path.join(API_DATA_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath) as f:
            return json.load(f)
    return None


def save_reviews():
    """Save reviews to JSON file (will be synced to Google Sheets by cron)."""
    os.makedirs(API_DATA_DIR, exist_ok=True)
    with open(REVIEWS_FILE, 'w') as f:
        json.dump(reviews_cache, f, ensure_ascii=False, indent=2)


def load_all_data():
    """Load all pre-generated API data into memory."""
    global brand_cache, reviews_cache

    brand_cache['categories'] = load_json('categories.json') or []
    brand_cache['brands'] = load_json('brands.json') or []
    brand_cache['stats'] = load_json('stats.json') or {}
    brand_cache['top_brands'] = load_json('top_brands.json') or []

    # Load per-category brand lists
    for cat in brand_cache['categories']:
        cat_brands = load_json(f"brands_{cat['id']}.json")
        if cat_brands:
            brand_cache[f"brands_{cat['id']}"] = cat_brands

    # Load reviews
    raw_reviews = load_json('reviews.json')
    if raw_reviews:
        reviews_cache = raw_reviews
    else:
        reviews_cache = []

    print(f"Loaded: {len(brand_cache['brands'])} brands, {len(brand_cache['categories'])} categories, {len(reviews_cache)} reviews")


@asynccontextmanager
async def lifespan(app):
    load_all_data()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ============================================================
# BRAND ENDPOINTS (read from cached JSON)
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "total_brands": len(brand_cache.get('brands', [])),
        "total_categories": len(brand_cache.get('categories', [])),
        "total_reviews": len(reviews_cache),
        "data_source": "google_sheets"
    }


@app.get("/api/categories")
def get_categories():
    return brand_cache.get('categories', [])


@app.get("/api/brands")
def get_all_brands():
    return brand_cache.get('brands', [])


@app.get("/api/brands/{slug}")
def get_brands_by_category(slug: str):
    key = f"brands_{slug}"
    if key in brand_cache:
        return brand_cache[key]
    # Fallback: filter from all brands
    return [b for b in brand_cache.get('brands', []) if b.get('categorySlug') == slug]


@app.get("/api/brand/{brand_id}")
def get_brand_by_id(brand_id: str):
    # Try per-brand file first
    brand = load_json(f"brand_{brand_id}.json")
    if brand:
        return brand
    # Fallback: search all brands
    for b in brand_cache.get('brands', []):
        if b.get('id') == brand_id:
            return b
    raise HTTPException(status_code=404, detail="Brand not found")


@app.get("/api/top-brands")
def get_top_brands(count: int = Query(default=6)):
    return brand_cache.get('top_brands', [])[:count]


@app.get("/api/stats")
def get_stats():
    stats = brand_cache.get('stats', {})
    # Update review count dynamically
    stats['totalReviews'] = len(reviews_cache)
    return stats


# ============================================================
# REVIEW ENDPOINTS (read/write JSON, synced to Google Sheets)
# ============================================================

class ReviewSubmission(BaseModel):
    category: str
    brand_name: str
    reviewer_name: str
    scores: Optional[dict] = {}
    review_text: str


@app.get("/api/reviews")
def get_reviews(brand: str = "", category: str = ""):
    filtered = reviews_cache
    if brand:
        filtered = [r for r in filtered if r.get('BrandName', '') == brand]
    if category:
        filtered = [r for r in filtered if r.get('Category', '') == category]

    # Only return approved + pending reviews (not rejected)
    filtered = [r for r in filtered if r.get('Status', 'pending') != 'rejected']

    # Map to frontend format
    return [{
        'id': r.get('ReviewID', ''),
        'category': r.get('Category', ''),
        'brand_name': r.get('BrandName', ''),
        'reviewer_name': r.get('ReviewerName', ''),
        'scores': {
            'compliance': safe_float(r.get('Compliance', '0')),
            'customer_satisfaction': safe_float(r.get('CustomerSatisfaction', '0')),
            'product_value': safe_float(r.get('ProductValue', '0')),
            'innovation': safe_float(r.get('Innovation', '0')),
            'customer_support': safe_float(r.get('CustomerSupport', '0')),
            'accessibility_security': safe_float(r.get('AccessibilitySecurity', '0'))
        },
        'average_score': safe_float(r.get('AverageScore', '0')),
        'review_text': r.get('ReviewText', ''),
        'created_at': r.get('Date', ''),
        'status': r.get('Status', 'pending')
    } for r in filtered]


@app.get("/api/reviews/all")
def get_all_reviews():
    return [{
        'id': r.get('ReviewID', ''),
        'category': r.get('Category', ''),
        'brand_name': r.get('BrandName', ''),
        'reviewer_name': r.get('ReviewerName', ''),
        'scores': {
            'compliance': safe_float(r.get('Compliance', '0')),
            'customer_satisfaction': safe_float(r.get('CustomerSatisfaction', '0')),
            'product_value': safe_float(r.get('ProductValue', '0')),
            'innovation': safe_float(r.get('Innovation', '0')),
            'customer_support': safe_float(r.get('CustomerSupport', '0')),
            'accessibility_security': safe_float(r.get('AccessibilitySecurity', '0'))
        },
        'average_score': safe_float(r.get('AverageScore', '0')),
        'review_text': r.get('ReviewText', ''),
        'created_at': r.get('Date', ''),
        'status': r.get('Status', 'pending')
    } for r in reviews_cache]


@app.post("/api/reviews")
def submit_review(review: ReviewSubmission):
    review_id = uuid.uuid4().hex[:8]
    now = datetime.now()

    # Calculate average from scores
    scores = review.scores or {}
    score_vals = [float(v) for v in scores.values() if v]
    avg = round(sum(score_vals) / len(score_vals), 1) if score_vals else 0

    new_review = {
        'ReviewID': review_id,
        'Category': review.category,
        'BrandName': review.brand_name,
        'ReviewerName': review.reviewer_name,
        'Compliance': str(scores.get('compliance', '0')),
        'CustomerSatisfaction': str(scores.get('customer_satisfaction', '0')),
        'ProductValue': str(scores.get('product_value', '0')),
        'Innovation': str(scores.get('innovation', '0')),
        'CustomerSupport': str(scores.get('customer_support', '0')),
        'AccessibilitySecurity': str(scores.get('accessibility_security', '0')),
        'AverageScore': str(avg),
        'ReviewText': review.review_text,
        'Date': now.strftime('%d %b %Y'),
        'Status': 'pending',
        'ModeratedBy': '',
        'ModeratedAt': ''
    }

    reviews_cache.append(new_review)
    save_reviews()

    return {
        'id': review_id,
        'status': 'pending',
        'message': 'Review submitted successfully'
    }


@app.put("/api/reviews/{review_id}/status")
def update_review_status(review_id: str, status: str = Query(...)):
    if status not in ['approved', 'rejected', 'pending']:
        raise HTTPException(status_code=400, detail="Invalid status")

    for r in reviews_cache:
        if r.get('ReviewID') == review_id:
            r['Status'] = status
            r['ModeratedBy'] = 'admin'
            r['ModeratedAt'] = datetime.now().strftime('%d %b %Y %H:%M')
            save_reviews()
            return {'id': review_id, 'status': status}

    raise HTTPException(status_code=404, detail="Review not found")


# ============================================================
# ADMIN ENDPOINTS
# ============================================================

class BrandData(BaseModel):
    category_slug: str
    brand_name: str
    scores: dict = {}
    details: dict = {}


@app.post("/api/admin/brand")
def save_brand(data: BrandData):
    """Save/update brand data. Changes are stored in memory and will be
    written back to Google Sheets by the sync cron."""
    # Find and update in cache
    for b in brand_cache.get('brands', []):
        if b.get('name', '').lower() == data.brand_name.lower():
            if data.scores:
                for key, val in data.scores.items():
                    if key in b.get('categoryScores', {}):
                        b['categoryScores'][key]['score'] = val
            if data.details:
                for key, val in data.details.items():
                    b[key] = val
            return {'status': 'updated', 'brand': data.brand_name}

    return {'status': 'not_found', 'message': f'Brand {data.brand_name} not found in cache. Add via Google Sheets.'}


@app.post("/api/admin/reload")
def reload_data():
    """Reload all data from JSON files (after a sync)."""
    load_all_data()
    return {
        'status': 'reloaded',
        'brands': len(brand_cache.get('brands', [])),
        'categories': len(brand_cache.get('categories', [])),
        'reviews': len(reviews_cache)
    }


# ============================================================
# RESEARCH ENDPOINTS
# ============================================================

# Track active research tasks
research_status = {}


@app.get("/api/admin/research/status")
def get_research_status():
    """Get status of all research tasks."""
    return research_status


@app.get("/api/admin/research/status/{brand_id}")
def get_brand_research_status(brand_id: str):
    """Get research status for a specific brand."""
    if brand_id in research_status:
        return research_status[brand_id]
    return {'status': 'not_started'}


@app.post("/api/admin/research-batch")
async def trigger_batch_research(category: str = "", freshness: str = "outdated"):
    """Trigger research for multiple brands at once.
    Can filter by category and/or freshness status."""
    now = datetime.now()
    targets = []

    for b in brand_cache.get('brands', []):
        # Filter by category if specified
        if category and b.get('categorySlug') != category:
            continue

        # Filter by freshness
        try:
            last_date = datetime.strptime(b.get('lastUpdated', '2020-01-01'), '%Y-%m-%d')
        except (ValueError, TypeError):
            last_date = datetime(2020, 1, 1)

        days_since = (now - last_date).days

        if freshness == 'outdated' and days_since <= 30:
            continue
        elif freshness == 'stale' and days_since <= 14:
            continue

        targets.append(b)

    if not targets:
        return {'status': 'no_targets', 'message': 'No brands match the criteria'}

    # Limit batch size to avoid overwhelming
    max_batch = 10
    batch = targets[:max_batch]

    # Run research in parallel (with concurrency limit)
    results = []
    for brand in batch:
        brand_id = brand.get('id', '')
        research_status[brand_id] = {
            'status': 'queued',
            'brand_name': brand.get('name', '')
        }

    # Process sequentially with small delays to be respectful
    for brand in batch:
        brand_id = brand.get('id', '')
        research_status[brand_id]['status'] = 'in_progress'
        try:
            res = await research_brand(
                brand_name=brand.get('name', ''),
                website=brand.get('website', ''),
                current_data=brand
            )
            updated, changes = apply_research_to_brand(brand, res)

            # Update cache
            for i, b in enumerate(brand_cache.get('brands', [])):
                if b.get('id') == brand_id:
                    brand_cache['brands'][i] = updated
                    break

            research_status[brand_id] = {
                'status': 'completed',
                'fields_updated': res.get('fields_updated', []),
                'changes': changes
            }
            results.append({'brand': brand.get('name', ''), 'status': 'completed', 'changes': changes})
        except Exception as e:
            research_status[brand_id] = {'status': 'error', 'error': str(e)}
            results.append({'brand': brand.get('name', ''), 'status': 'error', 'error': str(e)})

        await asyncio.sleep(1)  # Rate limiting

    # Save all updated data
    brands_json_path = os.path.join(API_DATA_DIR, 'brands.json')
    with open(brands_json_path, 'w') as f:
        json.dump(brand_cache.get('brands', []), f, ensure_ascii=False)

    return {
        'status': 'completed',
        'total_researched': len(batch),
        'total_remaining': max(0, len(targets) - max_batch),
        'results': results
    }


@app.post("/api/admin/research/{brand_id}")
async def trigger_research(brand_id: str):
    """Trigger auto-research for a specific brand."""
    # Find the brand
    target = None
    for b in brand_cache.get('brands', []):
        if b.get('id') == brand_id:
            target = b
            break

    if not target:
        raise HTTPException(status_code=404, detail="Brand not found")

    brand_name = target.get('name', '')

    # Check if already researching
    if brand_id in research_status and research_status[brand_id].get('status') == 'in_progress':
        return {'status': 'already_running', 'brand': brand_name}

    # Mark as in progress
    research_status[brand_id] = {
        'status': 'in_progress',
        'started_at': datetime.now().isoformat(),
        'brand_name': brand_name
    }

    try:
        # Run research
        results = await research_brand(
            brand_name=brand_name,
            website=target.get('website', ''),
            current_data=target
        )

        # Apply results to brand data
        updated_brand, changes = apply_research_to_brand(target, results)

        # Update the brand in cache
        for i, b in enumerate(brand_cache.get('brands', [])):
            if b.get('id') == brand_id:
                brand_cache['brands'][i] = updated_brand
                break

        # Also update category-specific cache
        cat_key = f"brands_{updated_brand.get('categorySlug', '')}"
        if cat_key in brand_cache:
            for i, b in enumerate(brand_cache[cat_key]):
                if b.get('id') == brand_id:
                    brand_cache[cat_key][i] = updated_brand
                    break

        # Save updated brand to individual JSON file
        brand_json_path = os.path.join(API_DATA_DIR, f'brand_{brand_id}.json')
        with open(brand_json_path, 'w') as f:
            json.dump(updated_brand, f, ensure_ascii=False)

        # Save all brands to brands.json
        brands_json_path = os.path.join(API_DATA_DIR, 'brands.json')
        with open(brands_json_path, 'w') as f:
            json.dump(brand_cache.get('brands', []), f, ensure_ascii=False)

        # Save category brands too
        if cat_key in brand_cache:
            cat_json_path = os.path.join(API_DATA_DIR, f"{cat_key.replace('brands_', 'brands_')}.json")
            with open(cat_json_path, 'w') as f:
                json.dump(brand_cache[cat_key], f, ensure_ascii=False)

        # Update top brands
        sorted_brands = sorted(brand_cache.get('brands', []), key=lambda x: x.get('overallScore', 0), reverse=True)
        top_brands_path = os.path.join(API_DATA_DIR, 'top_brands.json')
        with open(top_brands_path, 'w') as f:
            json.dump(sorted_brands[:10], f, ensure_ascii=False)

        # Mark research complete
        research_status[brand_id] = {
            'status': 'completed',
            'completed_at': datetime.now().isoformat(),
            'brand_name': brand_name,
            'fields_updated': results.get('fields_updated', []),
            'changes': changes,
            'errors': results.get('errors', []),
            'research_data': results.get('data', {})
        }

        return {
            'status': 'completed',
            'brand': brand_name,
            'fields_updated': results.get('fields_updated', []),
            'changes': changes,
            'data': results.get('data', {}),
            'errors': results.get('errors', [])
        }

    except Exception as e:
        research_status[brand_id] = {
            'status': 'error',
            'error': str(e),
            'brand_name': brand_name
        }
        return {
            'status': 'error',
            'brand': brand_name,
            'error': str(e)
        }


def safe_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
