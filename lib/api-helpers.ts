/**
 * API Helper Functions
 * Utility functions for API integrations with SerpAPI
 */

// Placeholder for API helper functions
// These will be implemented when integrating with external APIs

/**
 * Normalize review scores to 0-10 scale
 * @param score - Original score
 * @param scale - Original scale (e.g., "1-5" or "1-10")
 * @returns Normalized score on 0-10 scale
 */
export function normalizeScore(score: number, scale: "1-5" | "1-10"): number {
  if (scale === "1-5") {
    return score * 2;
  }
  return score;
}

/**
 * Calculate weighted average score across multiple review platforms
 *
 * This function computes a weighted average where platforms with more reviews
 * have proportionally greater influence on the final score. All ratings must
 * be pre-normalized to a 0-10 scale before passing to this function.
 *
 * ## Platform Normalization
 *
 * Each platform uses a different rating scale that must be normalized to 0-10:
 * - **Google Maps**: 1-5 scale → multiply by 2 (e.g., 4.5/5 → 9.0/10)
 * - **TripAdvisor**: 1-5 scale → multiply by 2 (e.g., 4.0/5 → 8.0/10)
 * - **Booking.com**: Already 0-10 scale → no conversion needed (e.g., 8.5/10 → 8.5/10)
 * - **Expedia**: 1-5 scale → multiply by 2 (e.g., 4.2/5 → 8.4/10)
 *
 * ## Weighted Average Formula
 *
 * ```
 * weighted_score = sum(rating × review_count) / sum(review_count)
 * ```
 *
 * The weight for each platform is its `review_count`. Platforms with more
 * reviews contribute more to the final score, reflecting greater statistical
 * confidence in that platform's rating.
 *
 * ## Example Calculation
 *
 * Given these normalized reviews:
 * - Google: 9.0/10 with 900 reviews
 * - TripAdvisor: 8.0/10 with 200 reviews
 * - Booking: 8.5/10 with 150 reviews
 *
 * Calculation:
 * ```
 * weighted_score = (9.0 × 900 + 8.0 × 200 + 8.5 × 150) / (900 + 200 + 150)
 *                = (8100 + 1600 + 1275) / 1250
 *                = 10975 / 1250
 *                = 8.78
 *                ≈ 8.8 (rounded to 1 decimal)
 * ```
 *
 * @param reviews - Array of review data with normalized rating (0-10 scale) and review_count
 * @returns Weighted average score rounded to 1 decimal place, or 0 if no reviews provided
 *
 * @example
 * ```typescript
 * const reviews = [
 *   { rating: 9.0, review_count: 900 },  // Google (normalized from 4.5/5)
 *   { rating: 8.0, review_count: 200 },  // TripAdvisor (normalized from 4.0/5)
 *   { rating: 8.5, review_count: 150 }   // Booking (already 0-10)
 * ];
 *
 * const score = calculateWeightedScore(reviews);
 * // Returns: 8.8
 * ```
 */
export function calculateWeightedScore(
  reviews: Array<{ rating: number; review_count: number }>
): number {
  const totalWeight = reviews.reduce((sum, r) => sum + r.review_count, 0);

  if (totalWeight === 0) return 0;

  const weightedSum = reviews.reduce(
    (sum, r) => sum + r.rating * r.review_count,
    0
  );

  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

/**
 * Calculate aggregate score for a hotel group
 *
 * This function computes the aggregate weighted score across all hotels in a group.
 * It takes the latest review snapshot for each hotel-platform combination and calculates
 * a weighted average across all hotels, where the weight is the review count for each platform.
 *
 * ## Calculation Method
 *
 * 1. For each hotel, get the latest review snapshots for each platform
 * 2. Calculate weighted score for each hotel (using calculateWeightedScore)
 * 3. Calculate overall weighted average across all hotels, weighted by total review count
 *
 * ## Example
 *
 * Given 2 hotels in a group:
 * - Hotel A: 8.5/10 with 1000 total reviews
 * - Hotel B: 7.5/10 with 500 total reviews
 *
 * Aggregate score = (8.5 × 1000 + 7.5 × 500) / (1000 + 500)
 *                 = (8500 + 3750) / 1500
 *                 = 12250 / 1500
 *                 = 8.17 ≈ 8.2/10
 *
 * @param hotelReviews - Array of review data grouped by hotel, with latest snapshots per platform
 * @returns Aggregate score on 0-10 scale rounded to 1 decimal, or undefined if no data
 *
 * @example
 * ```typescript
 * const hotelReviews = [
 *   {
 *     hotel_id: "hotel-1",
 *     reviews: [
 *       { rating: 9.0, review_count: 500 },  // Google
 *       { rating: 8.0, review_count: 200 }   // TripAdvisor
 *     ]
 *   },
 *   {
 *     hotel_id: "hotel-2",
 *     reviews: [
 *       { rating: 7.5, review_count: 300 },  // Google
 *       { rating: 8.5, review_count: 150 }   // Booking
 *     ]
 *   }
 * ];
 *
 * const score = calculateGroupAggregateScore(hotelReviews);
 * // Returns: 8.4
 * ```
 */
export function calculateGroupAggregateScore(
  hotelReviews: Array<{
    hotel_id: string;
    reviews: Array<{ rating: number; review_count: number }>;
  }>
): number | undefined {
  if (hotelReviews.length === 0) return undefined;

  // Calculate weighted score for each hotel
  const hotelScores: Array<{ score: number; totalReviews: number }> = [];

  for (const hotel of hotelReviews) {
    if (hotel.reviews.length === 0) continue;

    const hotelScore = calculateWeightedScore(hotel.reviews);
    const totalReviews = hotel.reviews.reduce(
      (sum, r) => sum + r.review_count,
      0
    );

    hotelScores.push({
      score: hotelScore,
      totalReviews,
    });
  }

  // If no hotels have reviews, return undefined
  if (hotelScores.length === 0) return undefined;

  // Calculate aggregate weighted average across all hotels
  const totalReviews = hotelScores.reduce(
    (sum, h) => sum + h.totalReviews,
    0
  );

  if (totalReviews === 0) return undefined;

  const weightedSum = hotelScores.reduce(
    (sum, h) => sum + h.score * h.totalReviews,
    0
  );

  return Math.round((weightedSum / totalReviews) * 10) / 10;
}

/**
 * Calculate group aggregate score for snapshots from a specific date
 *
 * Used for historical trend calculations where we need to compute the group's
 * aggregate weighted score at a specific point in time. Takes all snapshots
 * from a single date (across all hotels and platforms) and calculates the
 * overall weighted average.
 *
 * @param snapshots - Array of review snapshots from a specific date
 * @returns Weighted average score on 0-10 scale, or undefined if no reviews
 *
 * @example
 * ```typescript
 * // Snapshots from 2024-01-15
 * const snapshots = [
 *   { rating: 9.0, review_count: 500, platform: 'google', hotel_id: 'hotel-1' },
 *   { rating: 8.0, review_count: 200, platform: 'tripadvisor', hotel_id: 'hotel-1' },
 *   { rating: 7.5, review_count: 300, platform: 'google', hotel_id: 'hotel-2' }
 * ];
 *
 * const score = calculateGroupAggregateForDate(snapshots);
 * // Returns: 8.4 (weighted across all hotels and platforms)
 * ```
 */
export function calculateGroupAggregateForDate(
  snapshots: Array<{ rating: number; review_count: number }>
): number | undefined {
  if (snapshots.length === 0) return undefined;

  const reviews = snapshots.map((s) => ({
    rating: s.rating,
    review_count: s.review_count,
  }));

  return calculateWeightedScore(reviews);
}
