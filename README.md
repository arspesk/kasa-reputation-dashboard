# Kasa Reputation Dashboard

Multi-tenant hotel reputation platform aggregating reviews from Google Maps, TripAdvisor, Booking.com, and Expedia into a unified 0-10 scoring system with historical tracking.

## Features

- Multi-platform review aggregation (4 platforms via SerpAPI)
- Weighted scoring by review count
- Historical trend charts with Recharts
- Hotel grouping for portfolio tracking
- CSV import/export with date filtering
- Kasa.com brand design system
- Multi-tenant with Supabase RLS

## Tech Stack

**Frontend:** Next.js 15 + TypeScript + Tailwind CSS
**Backend:** Next.js API Routes
**Database:** Supabase (PostgreSQL with RLS)
**Auth:** Supabase Auth
**API:** SerpAPI (Google Maps API)
**Hosting:** Vercel

## Quick Start

### Option 1: Try Demo Portfolio (Ready-to-Go)

Login with test account to explore a pre-populated portfolio:
- **Email:** test@test.com
- **Password:** Kasa23!

This account includes 234 hotels ready for review fetching.

### Option 2: Create Your Own Portfolio

```bash
# Install dependencies
npm install

# Configure .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key
SERPAPI_KEY=your_serpapi_key

# Run database migrations (see /sql/README.md)
# 1. Open Supabase Dashboard → SQL Editor
# 2. Run 001_initial_schema.sql
# 3. Run 002_rls_policies.sql
# 4. Run 003_add_hotel_images.sql

# Start development server
npm run dev

# Import sample hotels (optional)
# Use Import CSV button in dashboard with: tests/hotels_test_import.csv
```

## Commands

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

## Architecture

### Score Normalization
All platforms convert to 0-10 scale:
- Google/TripAdvisor/Expedia (1-5) → multiply by 2
- Booking.com (already 0-10) → no conversion

### Weighted Scoring
```
weighted_score = sum(rating × review_count) / sum(review_count)
```

### Data Flow
1. User adds hotel → `hotels` table (RLS enforced)
2. Fetch reviews → `/api/reviews/fetch-all` (parallel SerpAPI calls)
3. Normalize ratings → Save to `review_snapshots` with timestamp
4. Calculate weighted scores → Display trends in UI

### Database Schema
- **hotels** - Core hotel records
- **hotel_groups** - Group management
- **hotel_group_members** - Many-to-many relationship
- **review_snapshots** - Historical review data

## Deployment

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy (auto on push to main)

**Costs:** ~$50-70/month (SerpAPI + Supabase/Vercel free tiers)

## Documentation

- **CLAUDE.md** - Development guide for Claude Code
- **Case_Study_AI_Specialist.md** - Original requirements
- **/sql/README.md** - Database setup instructions
