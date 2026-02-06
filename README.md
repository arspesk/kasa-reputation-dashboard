# Kasa Reputation Dashboard

## Architecture
- Frontend: Next.js 14 (App Router) + Tailwind CSS
- Backend: Next.js API Routes (serverless)
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Hosting: Vercel

## Data Collection
- All platforms (Google, TripAdvisor, Booking, Expedia): SerpAPI
- Using SerpAPI's Google Search engine to find platform-specific listings

## Key Assumptions
- Score normalization: All platforms converted to 0-10 scale
- Weighted average: Weight = review count per platform
- Hotel matching: Search by name + city (may have edge cases)

## Shortcuts Taken
- [List any shortcuts]

## Production Improvements
- Add rate limiting
- Implement caching layer
- Add retry logic for failed scrapes
- Set up monitoring/alerting
- Add proper error tracking (Sentry)
- Implement job queue for batch processing