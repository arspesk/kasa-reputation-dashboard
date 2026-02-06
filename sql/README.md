# Database Migrations

SQL migrations for the Kasa Reputation Dashboard Supabase database.

## Overview

This directory contains SQL migration files that set up the complete database schema with Row-Level Security (RLS) for multi-tenant data isolation.

### Migration Files

1. **`001_initial_schema.sql`** - Creates all database tables
2. **`002_rls_policies.sql`** - Enables Row-Level Security policies

## Database Schema

### Tables

#### `hotels`
Core hotel records with basic information.
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `name` (TEXT, required)
- `city` (TEXT, required)
- `website_url` (TEXT, optional)
- `created_at` (TIMESTAMPTZ)

#### `hotel_groups`
Named groups for organizing hotels (e.g., "NYC Portfolio", "Competitive Set").
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `name` (TEXT, required)
- `created_at` (TIMESTAMPTZ)

#### `hotel_group_members`
Junction table linking hotels to groups (many-to-many relationship).
- `hotel_id` (UUID, references hotels)
- `group_id` (UUID, references hotel_groups)
- `created_at` (TIMESTAMPTZ)
- Primary key: `(hotel_id, group_id)`

#### `review_snapshots`
Historical review data snapshots from all platforms.
- `id` (UUID, primary key)
- `hotel_id` (UUID, references hotels)
- `platform` (TEXT: 'google', 'tripadvisor', 'expedia', 'booking')
- `rating` (DECIMAL: 0-10 normalized scale)
- `original_rating` (DECIMAL: raw platform score)
- `review_count` (INTEGER)
- `fetched_at` (TIMESTAMPTZ)

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `medpqabiozetwuphwygz`

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar

3. **Run Migrations in Order**

   **Step 1: Create Tables**
   - Copy the contents of `001_initial_schema.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)
   - Wait for "Success" message

   **Step 2: Enable RLS**
   - Copy the contents of `002_rls_policies.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Wait for "Success" message

4. **Verify Setup**
   - Go to "Table Editor" in the left sidebar
   - You should see 4 tables: `hotels`, `hotel_groups`, `hotel_group_members`, `review_snapshots`
   - Click on each table to verify columns are correct

### Option 2: Supabase CLI (Advanced)

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref medpqabiozetwuphwygz

# Apply migrations
supabase db push
```

## Verification

### Check if Tables Exist

Run this query in the SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('hotels', 'hotel_groups', 'hotel_group_members', 'review_snapshots');
```

Expected result: 4 rows showing all tables.

### Check if RLS is Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

Expected result: All tables should have `rowsecurity = true`.

### View RLS Policies

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

Expected result: Multiple policies for SELECT, INSERT, UPDATE, DELETE on each table.

## Testing RLS Policies

### Test Data Isolation

1. **Create a test user** via your app's sign-up page or Supabase Auth UI
2. **Sign in as that user** and add a hotel
3. **Sign in as a different user** and verify you cannot see the first user's hotel

### Manual Testing Queries

```sql
-- As authenticated user, insert a hotel (should succeed)
INSERT INTO hotels (user_id, name, city)
VALUES (auth.uid(), 'Test Hotel', 'New York');

-- Try to view all hotels (should only see your own)
SELECT * FROM hotels;

-- Try to view another user's hotel by ID (should return empty)
SELECT * FROM hotels WHERE id = 'some-other-users-hotel-id';
```

## Rollback Instructions

If you need to undo the migrations:

### Remove RLS Policies

```sql
-- Drop all RLS policies
DROP POLICY IF EXISTS "Users can view their own hotels" ON public.hotels;
DROP POLICY IF EXISTS "Users can insert their own hotels" ON public.hotels;
DROP POLICY IF EXISTS "Users can update their own hotels" ON public.hotels;
DROP POLICY IF EXISTS "Users can delete their own hotels" ON public.hotels;

DROP POLICY IF EXISTS "Users can view their own groups" ON public.hotel_groups;
DROP POLICY IF EXISTS "Users can insert their own groups" ON public.hotel_groups;
DROP POLICY IF EXISTS "Users can update their own groups" ON public.hotel_groups;
DROP POLICY IF EXISTS "Users can delete their own groups" ON public.hotel_groups;

DROP POLICY IF EXISTS "Users can view their own group members" ON public.hotel_group_members;
DROP POLICY IF EXISTS "Users can insert their own group members" ON public.hotel_group_members;
DROP POLICY IF EXISTS "Users can delete their own group members" ON public.hotel_group_members;

DROP POLICY IF EXISTS "Users can view reviews for their own hotels" ON public.review_snapshots;
DROP POLICY IF EXISTS "Users can insert reviews for their own hotels" ON public.review_snapshots;
DROP POLICY IF EXISTS "Users can update reviews for their own hotels" ON public.review_snapshots;
DROP POLICY IF EXISTS "Users can delete reviews for their own hotels" ON public.review_snapshots;

-- Disable RLS
ALTER TABLE public.hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_snapshots DISABLE ROW LEVEL SECURITY;
```

### Drop All Tables

```sql
-- Drop tables in reverse order (respect foreign key constraints)
DROP TABLE IF EXISTS public.review_snapshots CASCADE;
DROP TABLE IF EXISTS public.hotel_group_members CASCADE;
DROP TABLE IF EXISTS public.hotel_groups CASCADE;
DROP TABLE IF EXISTS public.hotels CASCADE;
```

## Troubleshooting

### Issue: "Permission denied for table hotels"

**Cause:** RLS is enabled but you're not authenticated.

**Solution:** Make sure you're signed in via Supabase Auth. Check `auth.uid()` returns a value:
```sql
SELECT auth.uid();
```

### Issue: "Cannot see data I just inserted"

**Cause:** RLS policies might not be correctly configured.

**Solution:**
1. Check if RLS is enabled: `SELECT rowsecurity FROM pg_tables WHERE tablename = 'hotels';`
2. Verify policies exist: `SELECT * FROM pg_policies WHERE tablename = 'hotels';`
3. Make sure `user_id` matches `auth.uid()`

### Issue: "Foreign key constraint violation"

**Cause:** Trying to insert/delete data that violates relationships.

**Solution:**
- When deleting a hotel, all related reviews and group memberships are auto-deleted (CASCADE)
- When adding to `hotel_group_members`, ensure both hotel and group exist and belong to you

## Next Steps

After applying these migrations:

1. **Test Authentication** - Sign up and sign in via your app
2. **Test CRUD Operations** - Create, read, update, delete hotels
3. **Test RLS** - Verify users can't see each other's data
4. **Implement API Routes** - Connect your Next.js API routes to these tables
5. **Add Sample Data** - Use the CSV import feature to bulk-load hotels

## Support

For issues related to:
- **Schema design**: Check `CLAUDE.md` in project root
- **Supabase setup**: Visit https://supabase.com/docs
- **RLS policies**: See https://supabase.com/docs/guides/auth/row-level-security
