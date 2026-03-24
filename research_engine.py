#!/usr/bin/env python3
"""
GoNoGo SA — Auto-Research Engine
Fetches real public data for South African brands:
- Google Play Store ratings
- Apple App Store ratings
- Hellopeter ratings
- General web presence signals

Updates brand data in memory and local JSON files.
Sync back to Google Sheets happens via daily cron.
"""

import httpx
import re
import json
import os
from datetime import datetime
from typing import Optional

TIMEOUT = httpx.Timeout(15.0, connect=10.0)
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-ZA,en;q=0.9',
}


async def research_brand(brand_name: str, website: str = '', current_data: dict = None) -> dict:
    """
    Research a brand and return updated data fields.
    Returns a dict with fields that were successfully updated.
    """
    results = {
        'brand_name': brand_name,
        'researched_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'fields_updated': [],
        'errors': [],
        'data': {}
    }

    async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS, follow_redirects=True) as client:
        # 1. Google Play Store rating
        gp_rating = await fetch_google_play_rating(client, brand_name)
        if gp_rating:
            results['data']['googlePlay'] = gp_rating
            results['fields_updated'].append('Google Play rating')

        # 2. Apple App Store rating
        ios_rating = await fetch_ios_rating(client, brand_name)
        if ios_rating:
            results['data']['ios'] = ios_rating
            results['fields_updated'].append('iOS rating')

        # 3. Hellopeter rating
        hp_data = await fetch_hellopeter_data(client, brand_name)
        if hp_data:
            results['data']['hellopeter'] = hp_data
            results['fields_updated'].append('Hellopeter data')

        # 4. Website status check
        if website:
            site_status = await check_website_status(client, website)
            results['data']['website_status'] = site_status
            results['fields_updated'].append('Website status')

        # 5. Update timestamp
        results['data']['lastUpdated'] = datetime.now().strftime('%Y-%m-%d')

    return results


async def fetch_google_play_rating(client: httpx.AsyncClient, brand_name: str) -> Optional[str]:
    """Fetch Google Play Store rating for a brand's app."""
    try:
        # Search for the app on Google Play
        search_name = brand_name.lower().replace(' ', '+')
        search_url = f'https://play.google.com/store/search?q={search_name}&c=apps&gl=ZA'

        resp = await client.get(search_url)
        if resp.status_code != 200:
            return None

        text = resp.text

        # Look for rating pattern in search results
        # Google Play shows ratings like "4.2" near app listings
        # Try to find the first app result's rating
        rating_patterns = [
            r'<div[^>]*aria-label="Rated (\d\.\d) stars[^"]*"',
            r'>(\d\.\d)</div>.*?star',
            r'Rated (\d\.\d) out of',
        ]

        for pattern in rating_patterns:
            match = re.search(pattern, text)
            if match:
                rating = match.group(1)
                return f'{rating}/5'

        # Alternative: try direct app page if we can find the package name
        # Search for common SA app package names
        package_match = re.search(r'href="/store/apps/details\?id=([^"&]+)"', text)
        if package_match:
            package_id = package_match.group(1)
            app_url = f'https://play.google.com/store/apps/details?id={package_id}&gl=ZA'
            app_resp = await client.get(app_url)
            if app_resp.status_code == 200:
                for pattern in rating_patterns:
                    match = re.search(pattern, app_resp.text)
                    if match:
                        return f'{match.group(1)}/5'

    except Exception as e:
        pass

    return None


async def fetch_ios_rating(client: httpx.AsyncClient, brand_name: str) -> Optional[str]:
    """Fetch iOS App Store rating using the iTunes Search API."""
    try:
        search_url = f'https://itunes.apple.com/search?term={brand_name}&country=ZA&entity=software&limit=3'
        resp = await client.get(search_url)
        if resp.status_code != 200:
            return None

        data = resp.json()
        results = data.get('results', [])
        if not results:
            return None

        # Find the best matching app
        brand_lower = brand_name.lower()
        for app in results:
            app_name = app.get('trackName', '').lower()
            seller = app.get('sellerName', '').lower()

            # Check if the brand name is in the app name or seller
            if brand_lower in app_name or brand_lower in seller or any(w in app_name for w in brand_lower.split()):
                rating = app.get('averageUserRating')
                if rating:
                    return f'{round(rating, 1)}/5'

        # If no exact match, use the first result
        if results[0].get('averageUserRating'):
            return f'{round(results[0]["averageUserRating"], 1)}/5'

    except Exception as e:
        pass

    return None


async def fetch_hellopeter_data(client: httpx.AsyncClient, brand_name: str) -> Optional[dict]:
    """Fetch Hellopeter rating and review summary for a brand."""
    try:
        # Try the Hellopeter search/business page
        slug = brand_name.lower().replace(' ', '-').replace('&', 'and')
        # Common URL patterns on Hellopeter
        urls_to_try = [
            f'https://www.hellopeter.com/{slug}',
            f'https://www.hellopeter.com/{slug.replace("-", "")}',
        ]

        for url in urls_to_try:
            try:
                resp = await client.get(url, follow_redirects=True)
                if resp.status_code == 200:
                    text = resp.text

                    # Look for trust index / rating
                    trust_match = re.search(r'Trust\s*Index[^\d]*(\d+(?:\.\d+)?)', text, re.IGNORECASE)
                    rating_match = re.search(r'(\d+(?:\.\d+)?)\s*/\s*10', text)
                    star_match = re.search(r'(\d+(?:\.\d+)?)\s*out\s*of\s*5', text)
                    review_count_match = re.search(r'([\d,]+)\s*(?:reviews?|ratings?)', text, re.IGNORECASE)

                    result = {}
                    if trust_match:
                        result['trust_index'] = float(trust_match.group(1))
                    if rating_match:
                        result['rating'] = float(rating_match.group(1))
                    if star_match:
                        result['star_rating'] = float(star_match.group(1))
                    if review_count_match:
                        result['review_count'] = review_count_match.group(1).replace(',', '')

                    if result:
                        result['url'] = url
                        return result
            except Exception:
                continue

    except Exception as e:
        pass

    return None


async def check_website_status(client: httpx.AsyncClient, website: str) -> dict:
    """Check if a brand's website is accessible and get basic info."""
    result = {
        'url': website,
        'accessible': False,
        'https': website.startswith('https'),
        'response_time_ms': None
    }

    try:
        if not website.startswith('http'):
            website = 'https://' + website

        import time
        start = time.time()
        resp = await client.head(website, follow_redirects=True)
        elapsed = round((time.time() - start) * 1000)

        result['accessible'] = resp.status_code < 400
        result['response_time_ms'] = elapsed
        result['status_code'] = resp.status_code
        result['https'] = str(resp.url).startswith('https')

    except Exception as e:
        result['error'] = str(e)[:100]

    return result


def apply_research_to_brand(brand_data: dict, research: dict) -> dict:
    """
    Apply research results to a brand's data.
    Returns the updated brand data and a list of changes.
    """
    changes = []
    data = research.get('data', {})

    # Update app ratings
    if 'googlePlay' in data:
        old = brand_data.get('appRatings', {}).get('googlePlay', 'N/A')
        new = data['googlePlay']
        if old != new:
            if 'appRatings' not in brand_data:
                brand_data['appRatings'] = {}
            brand_data['appRatings']['googlePlay'] = new
            brand_data['appRatings']['googlePlayScore'] = float(new.replace('/5', ''))
            changes.append(f'Google Play: {old} -> {new}')

    if 'ios' in data:
        old = brand_data.get('appRatings', {}).get('ios', 'N/A')
        new = data['ios']
        if old != new:
            if 'appRatings' not in brand_data:
                brand_data['appRatings'] = {}
            brand_data['appRatings']['ios'] = new
            brand_data['appRatings']['iosScore'] = float(new.replace('/5', ''))
            changes.append(f'iOS: {old} -> {new}')

    # Update last updated
    brand_data['lastUpdated'] = data.get('lastUpdated', datetime.now().strftime('%Y-%m-%d'))
    changes.append(f'Last updated: {brand_data["lastUpdated"]}')

    return brand_data, changes
