-- =============================================
-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema for Kasa Reputation Dashboard
-- Author: Claude Code
-- Date: 2026-02-05
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Table: hotels
-- Description: Core hotel records
-- =============================================
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    website_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT hotels_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT hotels_city_not_empty CHECK (length(trim(city)) > 0)
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_hotels_user_id ON public.hotels(user_id);
CREATE INDEX IF NOT EXISTS idx_hotels_created_at ON public.hotels(created_at DESC);

-- =============================================
-- Table: hotel_groups
-- Description: Group management for hotel portfolios
-- =============================================
CREATE TABLE IF NOT EXISTS public.hotel_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT hotel_groups_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_hotel_groups_user_id ON public.hotel_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_groups_created_at ON public.hotel_groups(created_at DESC);

-- =============================================
-- Table: hotel_group_members
-- Description: Many-to-many relationship between hotels and groups
-- =============================================
CREATE TABLE IF NOT EXISTS public.hotel_group_members (
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.hotel_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite primary key to prevent duplicates
    PRIMARY KEY (hotel_id, group_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_hotel_group_members_hotel_id ON public.hotel_group_members(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_group_members_group_id ON public.hotel_group_members(group_id);

-- =============================================
-- Table: review_snapshots
-- Description: Historical review data from all platforms
-- =============================================
CREATE TABLE IF NOT EXISTS public.review_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    rating DECIMAL(4,2) NOT NULL,
    original_rating DECIMAL(4,2) NOT NULL,
    review_count INTEGER NOT NULL DEFAULT 0,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT review_snapshots_platform_valid CHECK (
        platform IN ('google', 'tripadvisor', 'expedia', 'booking')
    ),
    CONSTRAINT review_snapshots_rating_range CHECK (rating >= 0 AND rating <= 10),
    CONSTRAINT review_snapshots_original_rating_positive CHECK (original_rating >= 0),
    CONSTRAINT review_snapshots_review_count_positive CHECK (review_count >= 0)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_review_snapshots_hotel_id ON public.review_snapshots(hotel_id);
CREATE INDEX IF NOT EXISTS idx_review_snapshots_platform ON public.review_snapshots(platform);
CREATE INDEX IF NOT EXISTS idx_review_snapshots_fetched_at ON public.review_snapshots(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_snapshots_hotel_platform ON public.review_snapshots(hotel_id, platform);

-- =============================================
-- Comments for documentation
-- =============================================
COMMENT ON TABLE public.hotels IS 'Core hotel records with basic information';
COMMENT ON TABLE public.hotel_groups IS 'Named groups for organizing hotels (e.g., "NYC Portfolio")';
COMMENT ON TABLE public.hotel_group_members IS 'Junction table linking hotels to groups (many-to-many)';
COMMENT ON TABLE public.review_snapshots IS 'Historical review data snapshots from all platforms';

COMMENT ON COLUMN public.review_snapshots.rating IS 'Normalized rating on 0-10 scale';
COMMENT ON COLUMN public.review_snapshots.original_rating IS 'Raw rating from platform (e.g., 4.5 on 1-5 scale)';
COMMENT ON COLUMN public.review_snapshots.platform IS 'Platform source: google, tripadvisor, expedia, or booking';

-- =============================================
-- Migration Complete
-- =============================================
-- Next step: Apply 002_rls_policies.sql to enable Row-Level Security
