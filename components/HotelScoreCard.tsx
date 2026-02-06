"use client";

import { useMemo } from "react";
import type { HotelScoreCardProps, ScoreData, ReviewPlatform } from "@/types";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import HotelAvatar from "./HotelAvatar";

/**
 * StarRating Component
 * Displays a 5-star visualization based on a 0-10 rating scale
 */
const StarRating = ({ rating }: { rating: number }) => {
  // Convert 0-10 rating to 0-5 stars
  const stars = rating / 2;
  const fullStars = Math.floor(stars);
  const hasHalfStar = stars % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5 my-2">
      {[...Array(fullStars)].map((_, i) => (
        <svg key={`full-${i}`} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {hasHalfStar && (
        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="currentColor"/>
              <stop offset="50%" stopColor="#D1D5DB" stopOpacity="1"/>
            </linearGradient>
          </defs>
          <path fill="url(#half)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <svg key={`empty-${i}`} className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
};

/**
 * SkeletonCard Component
 * Shown during loading state
 */
const SkeletonCard = () => (
  <div className="border rounded-lg p-4 bg-gray-50 animate-pulse">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 bg-gray-300 rounded"></div>
      <div className="h-4 w-24 bg-gray-300 rounded"></div>
    </div>
    <div className="h-8 w-16 bg-gray-300 rounded mb-2"></div>
    <div className="h-4 w-20 bg-gray-300 rounded"></div>
  </div>
);

export default function HotelScoreCard({
  hotel,
  scores,
  weightedScore,
  lastUpdated,
  onRefresh,
  isLoading,
}: HotelScoreCardProps) {

  /**
   * Color coding for scores (Kasa brand colors):
   * - Kasa Success (8.0+): Excellent
   * - Kasa Warning (6.0-7.9): Good
   * - Kasa Error (<6.0): Needs improvement
   */
  const getScoreColor = (score: number): string => {
    if (score >= 8.0) return "text-kasa-success bg-green-50 border-green-200";
    if (score >= 6.0) return "text-kasa-warning bg-orange-50 border-orange-200";
    return "text-kasa-error bg-red-50 border-red-200";
  };

  /**
   * Format relative time
   * "Updated 2 hours ago" instead of absolute timestamp
   */
  const formatRelativeTime = (isoTimestamp: string): string => {
    const now = new Date();
    const updated = new Date(isoTimestamp);
    const diffMs = now.getTime() - updated.getTime();

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (minutes < 1) return "Updated just now";
    if (minutes < 60) return `Updated ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `Updated ${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `Updated ${days} day${days > 1 ? 's' : ''} ago`;

    return `Updated ${updated.toLocaleDateString()}`;
  };

  /**
   * Display original rating with correct scale
   * Google, TripAdvisor: 1-5 scale
   * Booking, Expedia: 0-10 scale
   */
  const getOriginalRatingDisplay = (platform: string, originalRating: number): string => {
    // Booking and Expedia use 0-10 scale
    if (platform === 'booking' || platform === 'expedia') {
      return `${originalRating.toFixed(1)}/10 on platform`;
    }
    // Google, TripAdvisor use 1-5 scale
    return `${originalRating.toFixed(1)}/5 on platform`;
  };

  /**
   * Transform scores array to platform map for rendering
   * Memoized to prevent unnecessary re-renders
   */
  const platformMap = useMemo(() => {
    const map: Record<string, ScoreData> = {};
    scores.forEach(score => {
      map[score.platform] = score;
    });
    return map;
  }, [scores]);

  const platforms: Array<{
    key: ReviewPlatform;
    name: string;
    icon: JSX.Element;
  }> = [
    {
      key: "google",
      name: "Google",
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      ),
    },
    {
      key: "tripadvisor",
      name: "TripAdvisor",
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#00AF87" />
          <circle cx="9" cy="12" r="3" fill="white" />
          <circle cx="15" cy="12" r="3" fill="white" />
          <circle cx="9" cy="12" r="1.5" fill="#000" />
          <circle cx="15" cy="12" r="1.5" fill="#000" />
        </svg>
      ),
    },
    {
      key: "booking",
      name: "Booking.com",
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#003580" />
          <path
            d="M7 8h4c1.1 0 2 .9 2 2s-.9 2-2 2H7V8zm0 6h4.5c1.1 0 2 .9 2 2s-.9 2-2 2H7v-4z"
            fill="white"
          />
        </svg>
      ),
    },
    {
      key: "expedia",
      name: "Expedia",
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#FFCC00" />
          <path
            d="M7 9h10v2H7V9zm0 4h10v2H7v-2z"
            fill="#003D79"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-kasa-lg shadow-md border border-kasa-neutral-light p-6">
      {/* Header Section */}
      <div className="flex items-start mb-6">
        <div className="flex items-center gap-4">
          <HotelAvatar
            hotelName={hotel.name}
            imageUrl={hotel.image_url}
            size="lg"
          />
          <div>
            <h2 className="text-2xl font-bold text-kasa-black-500">{hotel.name}</h2>
            <p className="text-gray-700 mt-1">{hotel.city}</p>
          </div>
        </div>
      </div>

      {/* Weighted Score Section */}
      {isLoading && !weightedScore ? (
        <div className="mb-6 animate-pulse">
          <div className="h-4 w-32 bg-gray-300 rounded mb-2"></div>
          <div className="h-12 w-32 bg-gray-300 rounded"></div>
        </div>
      ) : weightedScore !== undefined ? (
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-gray-700 mb-1">Overall Score</p>
              <div
                className={`inline-flex items-center px-4 py-2 rounded-kasa border-2 font-bold text-3xl ${getScoreColor(
                  weightedScore
                )}`}
              >
                {weightedScore.toFixed(1)}/10
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-700">
                Weighted average across all platforms
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {formatRelativeTime(lastUpdated)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Platform Breakdown Grid */}
      {isLoading && scores.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {platforms.map(({ key, name, icon }) => {
            const data = platformMap[key];
            const hasData = data !== undefined;

            return (
              <div
                key={key}
                className={`border rounded-kasa-lg p-4 ${
                  hasData
                    ? "bg-white border-kasa-neutral-light"
                    : "bg-kasa-neutral-warm border-kasa-neutral-light opacity-60"
                }`}
              >
                {/* Platform Icon and Name */}
                <div className="flex items-center gap-2 mb-3">
                  {icon}
                  <h3 className="font-semibold text-kasa-black-500">{name}</h3>
                </div>

                {/* Rating, Stars, Original Rating, and Review Count */}
                {hasData ? (
                  <div>
                    <div
                      className={`text-2xl font-bold mb-1 ${
                        data.rating >= 8
                          ? "text-kasa-success"
                          : data.rating >= 6
                          ? "text-kasa-warning"
                          : "text-kasa-error"
                      }`}
                    >
                      {data.rating.toFixed(1)}/10
                    </div>
                    <StarRating rating={data.rating} />
                    <p className="text-xs text-gray-700 mb-1">
                      {getOriginalRatingDisplay(key, data.originalRating)}
                    </p>
                    <p className="text-sm text-gray-700">
                      {data.reviewCount.toLocaleString()} reviews
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-700 italic">No data</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !weightedScore && scores.length === 0 && (
        <div className="text-center py-8 text-gray-700">
          <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No reviews yet</p>
          <p className="text-sm">
            Click the "Refresh" button in the header to fetch reviews from all platforms
          </p>
        </div>
      )}
    </div>
  );
}
