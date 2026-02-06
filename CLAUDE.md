# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hotel reputation dashboard that aggregates review ratings from 4 platforms (Google Maps, TripAdvisor, Booking.com, Expedia) into a unified scoring system with historical tracking. Multi-tenant SaaS with user authentication and hotel group management.

**Status:** Fully implemented and operational

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Kasa brand styling
- **Backend:** Next.js API Routes (serverless)
- **Database:** Supabase (PostgreSQL) with Row-Level Security (RLS)
- **Auth:** Supabase Auth (email/password) + @supabase/auth-ui-react
- **Charts:** Recharts for historical trend visualization
- **External APIs:** SerpAPI (all 4 platforms via Google Search)
- **Hosting:** Vercel

## Development Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm start            # Run production build locally
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL                      # Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY  # Supabase publishable key
SERPAPI_KEY                                   # SerpAPI key for all platforms
```

**Note:** All platforms (Google, TripAdvisor, Booking, Expedia) use SerpAPI's Google Search engine to find platform-specific review data. The original plan to use Apify was changed to use SerpAPI exclusively.

## Architecture Overview

### Authentication Flow
- `/login` → Supabase Auth UI (email/password)
- `/middleware.ts` → Session management and route protection
- Protected routes redirect unauthenticated users to `/login`
- Authenticated users at `/login` redirect to `/dashboard`

### Supabase Client Pattern (Official Next.js Integration)
```
/lib/supabase/
  - client.ts        # Browser client for Client Components
  - server.ts        # Server client for Server Components & API routes
  - middleware.ts    # Middleware client for session refresh
```

**Critical:** Always use the appropriate client for the context:
- Client Components: Use `createClient()` from `@/lib/supabase/client`
- Server Components/API Routes: Use `createClient()` from `@/lib/supabase/server`
- Middleware: Use `updateSession()` from `@/lib/supabase/middleware`

### Data Flow

1. **User adds hotel** → Saved to `hotels` table with `user_id` (RLS enforced)
2. **User clicks "Fetch Reviews"** → POST to `/api/reviews/fetch-all`
3. **API fetches in parallel:**
   - `/api/reviews/google` (SerpAPI Google Search)
   - `/api/reviews/tripadvisor` (SerpAPI Google Search)
   - `/api/reviews/booking` (SerpAPI Google Search)
   - `/api/reviews/expedia` (SerpAPI Google Search)
4. **Each API normalizes** ratings to 0-10 scale
5. **Results saved** to `review_snapshots` table with timestamp
6. **Frontend calculates** weighted score and displays trends

### Database Schema

**hotels** - Core hotel records
- `id` (UUID, PK), `user_id` (UUID, FK), `name`, `city`, `website_url`, `created_at`

**hotel_groups** - Group management
- `id` (UUID, PK), `user_id` (UUID, FK), `name`, `created_at`

**hotel_group_members** - Many-to-many relationship
- `hotel_id` (UUID, FK), `group_id` (UUID, FK) - Composite primary key

**review_snapshots** - Historical review data
- `id` (UUID, PK), `hotel_id` (UUID, FK), `platform` (enum), `rating` (0-10 normalized), `original_rating`, `review_count`, `fetched_at`

**RLS Policies:** All tables enforce `user_id = auth.uid()` for multi-tenant isolation. See `/sql/migrations/002_rls_policies.sql` for details.

### Database Setup

**Manual migration process:**
1. Open Supabase Dashboard → SQL Editor
2. Run `/sql/migrations/001_initial_schema.sql`
3. Run `/sql/migrations/002_rls_policies.sql`
4. Verify tables in Table Editor

See `/sql/README.md` for detailed instructions and troubleshooting.

## Key Business Logic

### Score Normalization (Critical!)

All platforms convert to 0-10 scale in their respective API route handlers:
- **Google Maps:** 1-5 scale → multiply by 2
- **TripAdvisor:** 1-5 scale → multiply by 2
- **Booking.com:** Already 0-10 scale → no conversion
- **Expedia:** 1-5 scale → multiply by 2

Implemented in each `/app/api/reviews/{platform}/route.ts` file.

### Weighted Score Calculation

```javascript
weighted_score = sum(rating × review_count) / sum(review_count)
```

Weight = number of reviews. More reviews = more influence on final score.

Implementation: `calculateWeightedScore()` in `/lib/api-helpers.ts`

### Historical Tracking

Every review fetch creates a **new** `review_snapshots` entry (never updates existing ones). This enables:
- Time-series charts showing rating trends over time
- Multiple snapshots per hotel-platform combination
- Comparison of ratings across different dates
- Audit trail of all data collection

Charts use Recharts library to visualize trends on hotel detail pages.

## Kasa Brand Implementation

The dashboard uses Kasa.com's official brand colors and design system:

### Brand Colors (in Tailwind config)
```
kasa-blue-300: #195c8c    (primary buttons, links)
kasa-success: #2eab6e      (scores ≥8.0)
kasa-warning: #ff9520      (scores 6.0-7.9)
kasa-error: #e23c00        (scores <6.0)
kasa-black-500: #061332    (dark text)
kasa-neutral-warm: #faf9f6 (page backgrounds)
```

### UI Patterns
- **Border radius:** `rounded-kasa` (12px), `rounded-kasa-sm` (8px), `rounded-kasa-lg` (16px)
- **Button heights:** `min-h-kasa-button` (3rem), `min-h-kasa-button-md` (2.5rem)
- **Focus rings:** `focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)]`
- **Primary button:** `bg-kasa-blue-300 hover:bg-[#144a70]`
- **Secondary button:** `border border-kasa-blue-300 text-kasa-blue-300 hover:bg-kasa-neutral-warm`

### Score Color Coding
- **Green (Excellent):** 8.0+ uses `kasa-success` (#2eab6e)
- **Yellow (Good):** 6.0-7.9 uses `kasa-warning` (#ff9520)
- **Red (Poor):** <6.0 uses `kasa-error` (#e23c00)

Applied consistently across HotelScoreCard, GroupCard, and all dashboard views.

## Important Implementation Notes

### Row-Level Security (RLS)
**Critical:** All Supabase queries automatically enforce `user_id = auth.uid()` via RLS policies. Users can only see their own hotels, groups, and review snapshots. This is enforced at the database level, not in application code.

### API Route Error Handling
All `/api/reviews/{platform}` routes follow the same pattern:
- Return partial success if some platforms fail (don't block entire operation)
- Log errors to console for debugging
- Return structured JSON: `{ success: boolean, data?: any, error?: string }`
- Handle SerpAPI rate limits and empty results gracefully

### SerpAPI Search Strategy
- Search query: `"{hotel_name}" {platform} {city}` (e.g., "Hotel Sunrise" TripAdvisor Paris)
- If no results, try adding "hotel" keyword or more specific location
- Extract review data from organic search results (position 0-2)
- Parse review count from text (e.g., "1,234 reviews" → 1234)

### Parallel API Calls
`/api/reviews/fetch-all` uses `Promise.allSettled()` to call all 4 platforms concurrently. This allows partial success—if 2 platforms fail, the other 2 still save data.

### Hotel Matching Edge Cases
- Search by name + city may have ambiguity (similar names, spelling variations)
- No fuzzy matching implemented—relies on exact SerpAPI search results
- Manual verification recommended for high-value hotels

## CSV Import/Export

### Import
- **Format:** `name`, `city`, `website_url` (optional)
- **Component:** `ImportCSVModal.tsx` with preview before import
- **Parsing:** Uses `papaparse` with column name normalization
- **Validation:** Filters out empty rows and rows with numeric names

### Export
- **Current Export:** Exports filtered/sorted hotels with latest review data
- **Historical Export:** Available on hotel detail pages with date range filter
- **Format:** All 4 platforms + weighted score + timestamps
- **Component:** `generateHotelCSV()` and `generateHistoricalCSV()` in `/lib/export-helpers.ts`

## Common Pitfalls

1. **Wrong Supabase client:** Using browser client in Server Components causes hydration errors
2. **RLS bypass attempts:** Don't try to manually filter by `user_id` in queries—RLS handles this automatically
3. **Score normalization:** Always normalize in API route, never in frontend display logic
4. **Snapshot updates:** Never UPDATE existing snapshots—always INSERT new ones for history
5. **Auth redirect loops:** Middleware handles redirects—don't add additional auth checks in page components

## Deployment Checklist

1. Push to GitHub repository
2. Connect to Vercel (auto-deploys from main branch)
3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `SERPAPI_KEY`
4. Verify Supabase RLS policies are enabled in production
5. Test authentication flow on production URL
6. Test all 4 platform API integrations with real hotels

## Cost Considerations

- **SerpAPI:** ~$50/month for 100 searches (4 platforms × 25 hotels)
- **Supabase:** Free tier sufficient for development/small deployments
- **Vercel:** Free tier sufficient (serverless functions auto-scale)
- **Total:** ~$50-70/month for production usage

## Future Production Improvements

Not implemented but recommended:
- Rate limiting on API routes (prevent abuse)
- Redis caching layer for repeated searches (reduce SerpAPI costs)
- Retry logic with exponential backoff for failed API calls
- Job queue (Bull/BullMQ) for batch processing large hotel lists
- Sentry or similar for error tracking in production
- Monitoring/alerting for API failures and RLS policy violations
- More robust hotel matching (fuzzy search, manual verification UI)
