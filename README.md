# GoNoGo South Africa

Honest brand comparisons for the South African market. GoNoGo rates every brand on a transparent 100-point scoring framework across 6 key categories.

## Live Sites

- **Full Platform (with reviews & admin)**: Hosted on Perplexity Computer
- **Static Version**: [gonogo-sa.vercel.app](https://gonogo-sa.vercel.app)

## Features

- **83 brands** across **13 industries** (Banking, Insurance, Mobile Networks, etc.)
- 6-category scoring: Compliance, Customer Satisfaction, Product Value, Innovation, Customer Support, Accessibility & Security
- Verdicts: **GO** (≥80), **GO WITH CAUTION** (60-79), **NOGO** (<60)
- Brand comparison tool (side-by-side radar charts)
- User reviews and ratings
- Admin CMS for brand management and moderation

## Pages

| Page | Description |
|---|---|
| `index.html` | Homepage with industry grid and top-rated brands |
| `category.html` | Category browser with brand cards and sorting |
| `brand.html` | Brand detail with score breakdown, pricing, reviews |
| `compare.html` | Side-by-side brand comparison |
| `admin.html` | Admin dashboard (password: see admin notes) |
| `admin-brands.html` | Brand CRUD management |
| `admin-comments.html` | Review moderation |
| `admin-research.html` | Research status tracker |

## Architecture

### Dual-Mode API

The platform runs in two modes:

1. **Live Backend** (Perplexity Computer): FastAPI + SQLite — full CRUD for brands and reviews
2. **Static Fallback** (Vercel): Reads brand data from JS files, reviews are read-only

The `api.js` client automatically detects which mode is available.

### Data Files

Brand data lives in `data/data_partA.js` through `data/data_partF.js`, organized by industry. The `data/helpers.js` provides accessor functions.

### Backend

`api_server.py` is a FastAPI server with endpoints for:
- `GET /api/categories`, `/api/brands`, `/api/brand/{id}`, `/api/top-brands`, `/api/stats`
- `GET/POST /api/reviews`
- `PUT /api/reviews/{id}/status` (moderation)
- `POST /api/admin/brand` (add/update brands)

## Deployment

### Vercel (Static)

This repo auto-deploys to Vercel. The `vercel.json` handles URL rewrites for clean routes.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Self-Hosted (with Backend)

```bash
# Install dependencies
pip install fastapi uvicorn

# Start the API server
python api_server.py

# Serve static files (or use nginx/caddy)
```

## Google Sheets Integration

- SA Brand Mastersheet syncs research data
- Reviews sync daily to a separate Google Sheet
- Scheduled via automated cron tasks

## Built With

- HTML/CSS/JavaScript (no framework)
- FastAPI + SQLite (backend)
- Chart.js (radar charts)
- Font Awesome (icons)

---

Created with [Perplexity Computer](https://www.perplexity.ai/computer)
