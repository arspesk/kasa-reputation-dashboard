-- =============================================
-- Migration: 002_rls_policies.sql
-- Description: Enable Row-Level Security (RLS) for multi-tenant data isolation
-- Author: Claude Code
-- Date: 2026-02-05
-- =============================================

-- =============================================
-- Enable Row-Level Security on all tables
-- =============================================
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_snapshots ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for: hotels
-- Users can only access their own hotels
-- =============================================

-- Policy: Users can view their own hotels
CREATE POLICY "Users can view their own hotels"
    ON public.hotels
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own hotels
CREATE POLICY "Users can insert their own hotels"
    ON public.hotels
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own hotels
CREATE POLICY "Users can update their own hotels"
    ON public.hotels
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own hotels
CREATE POLICY "Users can delete their own hotels"
    ON public.hotels
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- RLS Policies for: hotel_groups
-- Users can only access their own groups
-- =============================================

-- Policy: Users can view their own groups
CREATE POLICY "Users can view their own groups"
    ON public.hotel_groups
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own groups
CREATE POLICY "Users can insert their own groups"
    ON public.hotel_groups
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own groups
CREATE POLICY "Users can update their own groups"
    ON public.hotel_groups
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own groups
CREATE POLICY "Users can delete their own groups"
    ON public.hotel_groups
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- RLS Policies for: hotel_group_members
-- Users can only manage members of their own hotels and groups
-- =============================================

-- Policy: Users can view members of their own hotels/groups
CREATE POLICY "Users can view their own group members"
    ON public.hotel_group_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = hotel_group_members.hotel_id
            AND hotels.user_id = auth.uid()
        )
    );

-- Policy: Users can insert members to their own hotels/groups
CREATE POLICY "Users can insert their own group members"
    ON public.hotel_group_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = hotel_group_members.hotel_id
            AND hotels.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.hotel_groups
            WHERE hotel_groups.id = hotel_group_members.group_id
            AND hotel_groups.user_id = auth.uid()
        )
    );

-- Policy: Users can delete members from their own hotels/groups
CREATE POLICY "Users can delete their own group members"
    ON public.hotel_group_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = hotel_group_members.hotel_id
            AND hotels.user_id = auth.uid()
        )
    );

-- =============================================
-- RLS Policies for: review_snapshots
-- Users can only access reviews for their own hotels
-- =============================================

-- Policy: Users can view reviews for their own hotels
CREATE POLICY "Users can view reviews for their own hotels"
    ON public.review_snapshots
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = review_snapshots.hotel_id
            AND hotels.user_id = auth.uid()
        )
    );

-- Policy: Users can insert reviews for their own hotels
CREATE POLICY "Users can insert reviews for their own hotels"
    ON public.review_snapshots
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = review_snapshots.hotel_id
            AND hotels.user_id = auth.uid()
        )
    );

-- Policy: Users can update reviews for their own hotels
CREATE POLICY "Users can update reviews for their own hotels"
    ON public.review_snapshots
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = review_snapshots.hotel_id
            AND hotels.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = review_snapshots.hotel_id
            AND hotels.user_id = auth.uid()
        )
    );

-- Policy: Users can delete reviews for their own hotels
CREATE POLICY "Users can delete reviews for their own hotels"
    ON public.review_snapshots
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = review_snapshots.hotel_id
            AND hotels.user_id = auth.uid()
        )
    );

-- =============================================
-- Verification Queries (for testing)
-- =============================================

-- To test RLS policies, run these queries as different users:

-- 1. Check if RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 2. List all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies WHERE schemaname = 'public';

-- 3. Test as authenticated user (should only see own data):
-- SELECT * FROM hotels;
-- SELECT * FROM hotel_groups;
-- SELECT * FROM review_snapshots;

-- =============================================
-- Migration Complete
-- =============================================
-- Row-Level Security is now fully configured.
-- Each user can only access their own data across all tables.
