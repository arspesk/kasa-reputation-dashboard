-- Migration 003: Add hotel images
-- Adds image_url column to hotels table for storing SerpAPI thumbnail

-- Add image URL column to hotels table
ALTER TABLE public.hotels
  ADD COLUMN image_url TEXT;

-- Add index for hotels missing images (speeds up bulk operations)
CREATE INDEX IF NOT EXISTS idx_hotels_missing_images
  ON public.hotels(user_id)
  WHERE image_url IS NULL;

-- Add column comment
COMMENT ON COLUMN public.hotels.image_url IS 'URL to hotel thumbnail from SerpAPI Google Maps';
