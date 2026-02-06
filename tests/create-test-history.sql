-- Create Test Historical Data for Time Filter Testing
-- This script creates snapshots with backdated timestamps
-- Run this in Supabase SQL Editor

-- Instructions:
-- 1. First, get your hotel_id from the hotels table
-- 2. Replace 'YOUR_HOTEL_ID_HERE' with your actual hotel UUID
-- 3. Run this script in Supabase Dashboard → SQL Editor

-- Example: If your hotel_id is '2e0ebe4d-5190-4f72-885b-56bf70c802db'
-- Replace all instances of 'YOUR_HOTEL_ID_HERE' with that UUID

DO $$
DECLARE
  target_hotel_id UUID := 'YOUR-HOTEL_UUID'; -- CHANGE THIS
  current_user_id UUID;
BEGIN
  -- Get the user_id for the hotel
  SELECT user_id INTO current_user_id
  FROM hotels
  WHERE id = target_hotel_id;

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Hotel not found or no user_id associated';
  END IF;

  RAISE NOTICE 'Creating historical snapshots for hotel % (user: %)', target_hotel_id, current_user_id;

  -- Delete any existing snapshots for this hotel to start fresh
  DELETE FROM review_snapshots WHERE hotel_id = target_hotel_id;

  -- Create snapshots from 90 days ago with varied, realistic score trends
  -- Story: Hotel started lower, dipped mid-period due to renovations, then improved significantly

  -- Day -90 (3 months ago) - Starting point, decent scores
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 7.8, 3.9, 820, NOW() - INTERVAL '90 days'),
    (target_hotel_id, 'tripadvisor', 7.4, 3.7, 430, NOW() - INTERVAL '90 days'),
    (target_hotel_id, 'booking', 7.9, 7.9, 115, NOW() - INTERVAL '90 days'),
    (target_hotel_id, 'expedia', 8.0, 4.0, 880, NOW() - INTERVAL '90 days');

  -- Day -80 - Slight improvement
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 7.9, 3.95, 835, NOW() - INTERVAL '80 days'),
    (target_hotel_id, 'tripadvisor', 7.6, 3.8, 445, NOW() - INTERVAL '80 days'),
    (target_hotel_id, 'booking', 8.1, 8.1, 120, NOW() - INTERVAL '80 days'),
    (target_hotel_id, 'expedia', 8.2, 4.1, 895, NOW() - INTERVAL '80 days');

  -- Day -70 - DIPS DOWN (renovation issues, maintenance problems)
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 7.4, 3.7, 850, NOW() - INTERVAL '70 days'),
    (target_hotel_id, 'tripadvisor', 7.0, 3.5, 460, NOW() - INTERVAL '70 days'),
    (target_hotel_id, 'booking', 7.6, 7.6, 125, NOW() - INTERVAL '70 days'),
    (target_hotel_id, 'expedia', 7.8, 3.9, 910, NOW() - INTERVAL '70 days');

  -- Day -60 - Still struggling, lowest point
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 7.2, 3.6, 865, NOW() - INTERVAL '60 days'),
    (target_hotel_id, 'tripadvisor', 6.8, 3.4, 475, NOW() - INTERVAL '60 days'),
    (target_hotel_id, 'booking', 7.4, 7.4, 130, NOW() - INTERVAL '60 days'),
    (target_hotel_id, 'expedia', 7.6, 3.8, 925, NOW() - INTERVAL '60 days');

  -- Day -50 - Starting recovery (renovations complete, new management)
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 7.8, 3.9, 880, NOW() - INTERVAL '50 days'),
    (target_hotel_id, 'tripadvisor', 7.5, 3.75, 485, NOW() - INTERVAL '50 days'),
    (target_hotel_id, 'booking', 8.0, 8.0, 135, NOW() - INTERVAL '50 days'),
    (target_hotel_id, 'expedia', 8.2, 4.1, 940, NOW() - INTERVAL '50 days');

  -- Day -40 - Strong improvement continues
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 8.2, 4.1, 895, NOW() - INTERVAL '40 days'),
    (target_hotel_id, 'tripadvisor', 8.0, 4.0, 490, NOW() - INTERVAL '40 days'),
    (target_hotel_id, 'booking', 8.4, 8.4, 140, NOW() - INTERVAL '40 days'),
    (target_hotel_id, 'expedia', 8.6, 4.3, 955, NOW() - INTERVAL '40 days');

  -- Day -30 (1 month ago) - Excellent scores achieved
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 8.6, 4.3, 910, NOW() - INTERVAL '30 days'),
    (target_hotel_id, 'tripadvisor', 8.3, 4.15, 495, NOW() - INTERVAL '30 days'),
    (target_hotel_id, 'booking', 8.7, 8.7, 145, NOW() - INTERVAL '30 days'),
    (target_hotel_id, 'expedia', 8.9, 4.45, 970, NOW() - INTERVAL '30 days');

  -- Day -20 - Maintaining high standards with slight variation
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 8.5, 4.25, 915, NOW() - INTERVAL '20 days'),
    (target_hotel_id, 'tripadvisor', 8.4, 4.2, 498, NOW() - INTERVAL '20 days'),
    (target_hotel_id, 'booking', 8.8, 8.8, 147, NOW() - INTERVAL '20 days'),
    (target_hotel_id, 'expedia', 9.0, 4.5, 982, NOW() - INTERVAL '20 days');

  -- Day -10 - Peak performance
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 8.8, 4.4, 918, NOW() - INTERVAL '10 days'),
    (target_hotel_id, 'tripadvisor', 8.6, 4.3, 500, NOW() - INTERVAL '10 days'),
    (target_hotel_id, 'booking', 9.0, 9.0, 149, NOW() - INTERVAL '10 days'),
    (target_hotel_id, 'expedia', 9.2, 4.6, 990, NOW() - INTERVAL '10 days');

  -- Day -5 (5 days ago) - Small natural fluctuation
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 8.7, 4.35, 920, NOW() - INTERVAL '5 days'),
    (target_hotel_id, 'tripadvisor', 8.5, 4.25, 502, NOW() - INTERVAL '5 days'),
    (target_hotel_id, 'booking', 8.9, 8.9, 150, NOW() - INTERVAL '5 days'),
    (target_hotel_id, 'expedia', 9.1, 4.55, 995, NOW() - INTERVAL '5 days');

  -- Today (current data) - Stable at high level
  INSERT INTO review_snapshots (hotel_id, platform, rating, original_rating, review_count, fetched_at)
  VALUES
    (target_hotel_id, 'google', 8.8, 4.4, 925, NOW()),
    (target_hotel_id, 'tripadvisor', 8.6, 4.3, 505, NOW()),
    (target_hotel_id, 'booking', 9.0, 9.0, 152, NOW()),
    (target_hotel_id, 'expedia', 9.2, 4.6, 1000, NOW());

  RAISE NOTICE 'Successfully created 44 historical snapshots (11 time points x 4 platforms)';
END $$;

-- Verify the data
SELECT
  DATE(fetched_at) as date,
  COUNT(*) as snapshots_per_date,
  STRING_AGG(DISTINCT platform::text, ', ' ORDER BY platform::text) as platforms
FROM review_snapshots
WHERE hotel_id = 'YOUR-HOTEL_UUID' -- CHANGE THIS
GROUP BY DATE(fetched_at)
ORDER BY date DESC;
