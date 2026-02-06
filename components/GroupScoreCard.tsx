"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, ReviewSnapshot, ReviewPlatform, GroupWithDetails } from "@/types";
import { calculateWeightedScore, calculateGroupAggregateScore } from "@/lib/api-helpers";
import toast from "react-hot-toast";

// Internal types for component
interface PlatformScore {
  rating: number;      // Normalized 0-10
  review_count: number;
}

interface HotelScoreData {
  hotel: Hotel;
  google?: PlatformScore;
  tripadvisor?: PlatformScore;
  booking?: PlatformScore;
  expedia?: PlatformScore;
  weighted_score?: number;
  total_reviews: number;
  last_updated?: string;
}

type SortableColumn =
  | 'hotel_name'
  | 'city'
  | 'weighted_score'
  | 'total_reviews'
  | 'google_rating'
  | 'tripadvisor_rating'
  | 'booking_rating'
  | 'expedia_rating';

interface SortConfig {
  key: SortableColumn;
  direction: 'asc' | 'desc';
}

interface GroupScoreCardProps {
  group_id: string;
}

export default function GroupScoreCard({ group_id }: GroupScoreCardProps) {
  const [groupData, setGroupData] = useState<GroupWithDetails | null>(null);
  const [hotelScores, setHotelScores] = useState<HotelScoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'hotel_name',
    direction: 'asc'
  });

  useEffect(() => {
    loadGroupData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group_id]);

  /**
   * Color coding for scores (consistent with HotelScoreCard):
   * - Kasa Success (8.0+): Excellent
   * - Kasa Warning (6.0-7.9): Good
   * - Kasa Error (<6.0): Needs improvement
   */
  const getScoreColor = (score: number): string => {
    if (score >= 8.0) return "text-kasa-success bg-green-50 border-green-200";
    if (score >= 6.0) return "text-kasa-warning bg-orange-50 border-orange-200";
    return "text-kasa-error bg-red-50 border-red-200";
  };

  const getScoreTextColor = (score: number): string => {
    if (score >= 8.0) return "text-kasa-success";
    if (score >= 6.0) return "text-kasa-warning";
    return "text-kasa-error";
  };

  const isValidPlatformData = (data?: PlatformScore): boolean => {
    return data !== undefined && data.review_count > 0;
  };

  const loadGroupData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      // Step 1: Fetch group with nested hotel members
      const { data: groupDataRaw, error: groupError } = await supabase
        .from('hotel_groups')
        .select(`
          *,
          hotel_group_members (
            hotel_id,
            hotels (*)
          )
        `)
        .eq('id', group_id)
        .single();

      if (groupError) throw groupError;

      // Step 2: Extract hotels
      const hotels: Hotel[] = groupDataRaw.hotel_group_members
        ?.map((m: { hotels: Hotel }) => m.hotels)
        .filter(Boolean) || [];

      const hotelIds = hotels.map(h => h.id);

      // Step 3: Fetch review snapshots for all hotels
      let reviewSnapshots: ReviewSnapshot[] = [];
      if (hotelIds.length > 0) {
        const { data: snapshots, error: snapshotsError } = await supabase
          .from('review_snapshots')
          .select('*')
          .in('hotel_id', hotelIds)
          .order('fetched_at', { ascending: false });

        if (!snapshotsError && snapshots) {
          reviewSnapshots = snapshots;
        }
      }

      // Step 4: Find latest snapshot per hotel-platform
      const latestSnapshots = getLatestSnapshots(reviewSnapshots);

      // Step 5: Transform into HotelScoreData format
      const hotelScoresData = hotels.map(hotel =>
        buildHotelScoreData(hotel, latestSnapshots)
      );

      setGroupData({
        ...groupDataRaw,
        member_count: hotels.length,
        hotels
      });
      setHotelScores(hotelScoresData);

    } catch (error) {
      console.error('Error loading group data:', error);
      toast.error('Failed to load group data');
    } finally {
      setIsLoading(false);
    }
  };

  // Get latest snapshot per hotel-platform combination
  const getLatestSnapshots = (snapshots: ReviewSnapshot[]): Map<string, ReviewSnapshot> => {
    const latestMap = new Map<string, ReviewSnapshot>();

    snapshots.forEach(snapshot => {
      const key = `${snapshot.hotel_id}-${snapshot.platform}`;
      const existing = latestMap.get(key);

      if (!existing || new Date(snapshot.fetched_at) > new Date(existing.fetched_at)) {
        latestMap.set(key, snapshot);
      }
    });

    return latestMap;
  };

  // Build HotelScoreData from hotel and snapshots
  const buildHotelScoreData = (
    hotel: Hotel,
    latestSnapshots: Map<string, ReviewSnapshot>
  ): HotelScoreData => {
    const platforms: ReviewPlatform[] = ['google', 'tripadvisor', 'booking', 'expedia'];

    const platformData: Record<string, PlatformScore> = {};
    const reviews: Array<{ rating: number; review_count: number }> = [];
    let lastUpdated: string | undefined;

    platforms.forEach(platform => {
      const snapshot = latestSnapshots.get(`${hotel.id}-${platform}`);
      if (snapshot && snapshot.review_count > 0) {
        platformData[platform] = {
          rating: snapshot.rating,
          review_count: snapshot.review_count
        };
        reviews.push({
          rating: snapshot.rating,
          review_count: snapshot.review_count
        });

        // Track most recent update
        if (!lastUpdated || snapshot.fetched_at > lastUpdated) {
          lastUpdated = snapshot.fetched_at;
        }
      }
    });

    const weighted_score = reviews.length > 0
      ? calculateWeightedScore(reviews)
      : undefined;

    const total_reviews = reviews.reduce((sum, r) => sum + r.review_count, 0);

    return {
      hotel,
      ...platformData,
      weighted_score,
      total_reviews,
      last_updated: lastUpdated
    };
  };

  // Calculate per-platform aggregate for aggregate row
  const calculatePlatformAggregate = (
    platform: ReviewPlatform,
    scores: HotelScoreData[]
  ): PlatformScore | undefined => {
    const platformReviews = scores
      .map(hs => hs[platform])
      .filter(isValidPlatformData) as PlatformScore[];

    if (platformReviews.length === 0) return undefined;

    const totalReviews = platformReviews.reduce((sum, p) => sum + p.review_count, 0);
    const weightedScore = calculateWeightedScore(
      platformReviews.map(p => ({
        rating: p.rating,
        review_count: p.review_count
      }))
    );

    return {
      rating: weightedScore,
      review_count: totalReviews
    };
  };

  // Sort hotel scores based on current sort configuration
  const sortHotelScores = (scores: HotelScoreData[], config: SortConfig): HotelScoreData[] => {
    const sorted = [...scores];

    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (config.key) {
        case 'hotel_name':
          aValue = a.hotel.name.toLowerCase();
          bValue = b.hotel.name.toLowerCase();
          break;
        case 'city':
          aValue = a.hotel.city.toLowerCase();
          bValue = b.hotel.city.toLowerCase();
          break;
        case 'weighted_score':
          aValue = a.weighted_score ?? -1;  // N/A sorts to bottom
          bValue = b.weighted_score ?? -1;
          break;
        case 'total_reviews':
          aValue = a.total_reviews;
          bValue = b.total_reviews;
          break;
        case 'google_rating':
          aValue = a.google?.rating ?? -1;
          bValue = b.google?.rating ?? -1;
          break;
        case 'tripadvisor_rating':
          aValue = a.tripadvisor?.rating ?? -1;
          bValue = b.tripadvisor?.rating ?? -1;
          break;
        case 'booking_rating':
          aValue = a.booking?.rating ?? -1;
          bValue = b.booking?.rating ?? -1;
          break;
        case 'expedia_rating':
          aValue = a.expedia?.rating ?? -1;
          bValue = b.expedia?.rating ?? -1;
          break;
      }

      // Handle string vs number comparison
      if (typeof aValue === 'string') {
        return config.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return config.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
    });

    return sorted;
  };

  // Handle column header clicks
  const handleSort = (column: SortableColumn) => {
    setSortConfig(prev => ({
      key: column,
      direction: prev.key === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sorted hotel scores
  const sortedHotelScores = sortHotelScores(hotelScores, sortConfig);

  // Calculate aggregates
  const groupAggregate = calculateGroupAggregateScore(
    hotelScores.map(hs => ({
      hotel_id: hs.hotel.id,
      reviews: [
        hs.google && { rating: hs.google.rating, review_count: hs.google.review_count },
        hs.tripadvisor && { rating: hs.tripadvisor.rating, review_count: hs.tripadvisor.review_count },
        hs.booking && { rating: hs.booking.rating, review_count: hs.booking.review_count },
        hs.expedia && { rating: hs.expedia.rating, review_count: hs.expedia.review_count },
      ].filter(Boolean) as Array<{ rating: number; review_count: number }>
    }))
  );

  const platformAggregates = {
    google: calculatePlatformAggregate('google', hotelScores),
    tripadvisor: calculatePlatformAggregate('tripadvisor', hotelScores),
    booking: calculatePlatformAggregate('booking', hotelScores),
    expedia: calculatePlatformAggregate('expedia', hotelScores)
  };

  const totalReviews = hotelScores.reduce((sum, hs) => sum + hs.total_reviews, 0);
  const hasAnyReviewData = hotelScores.some(hs => hs.weighted_score !== undefined);

  // Sortable Header Component
  const SortableHeader = ({
    column,
    label,
    className = "text-left"
  }: {
    column: SortableColumn;
    label: string;
    className?: string;
  }) => {
    const isActive = sortConfig.key === column;

    return (
      <th
        className={`px-6 py-3 text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-[#0a1a3d] transition-colors ${className}`}
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-2 justify-center">
          <span>{label}</span>
          {isActive && (
            <svg
              className={`w-4 h-4 transform transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          )}
        </div>
      </th>
    );
  };

  // Platform Cell Component
  const PlatformCell = ({ data }: { data?: PlatformScore }) => {
    if (!data || !isValidPlatformData(data)) {
      return (
        <td className="px-6 py-4 text-center text-sm text-gray-400 italic">
          N/A
        </td>
      );
    }

    return (
      <td className="px-6 py-4 text-center">
        <div className={`text-sm font-semibold ${getScoreTextColor(data.rating)}`}>
          {data.rating.toFixed(1)}
        </div>
        <div className="text-xs text-gray-700">
          {data.review_count.toLocaleString()} reviews
        </div>
      </td>
    );
  };

  // Weighted Score Cell Component
  const WeightedScoreCell = ({ score }: { score?: number }) => {
    if (score === undefined) {
      return (
        <td className="px-6 py-4 text-center text-sm text-gray-400 italic">
          N/A
        </td>
      );
    }

    return (
      <td className="px-6 py-4 text-center">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border-2 ${getScoreColor(score)}`}>
          {score.toFixed(1)}/10
        </span>
      </td>
    );
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kasa-blue-300"></div>
      </div>
    );
  }

  // Empty State - No Hotels
  if (!isLoading && hotelScores.length === 0) {
    return (
      <div className="bg-white rounded-kasa border border-kasa-neutral-light p-12 text-center">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <h3 className="text-lg font-medium text-kasa-black-500 mb-2">
          No hotels in this group
        </h3>
        <p className="text-gray-700">
          Add hotels to this group to see their review scores and aggregate performance
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Warning for no review data */}
      {!isLoading && hotelScores.length > 0 && !hasAnyReviewData && (
        <div className="bg-orange-50 border border-orange-200 rounded-kasa-sm p-4 mb-4">
          <p className="text-sm text-kasa-warning">
            <strong>No review data yet.</strong> Click &quot;Refresh Reviews&quot; on individual hotels to fetch their ratings.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-kasa shadow-md border border-kasa-neutral-light overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-kasa-neutral-light">
            {/* Table Header */}
            <thead className="bg-kasa-black-500">
              <tr>
                <SortableHeader column="hotel_name" label="Hotel Name" className="text-left" />
                <SortableHeader column="city" label="City" className="text-left" />
                <SortableHeader column="google_rating" label="Google" />
                <SortableHeader column="tripadvisor_rating" label="TripAdvisor" />
                <SortableHeader column="booking_rating" label="Booking" />
                <SortableHeader column="expedia_rating" label="Expedia" />
                <SortableHeader column="weighted_score" label="Weighted Score" />
                <SortableHeader column="total_reviews" label="Total Reviews" />
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-kasa-neutral-light">
              {/* Aggregate Row */}
              <tr className="bg-blue-50 font-bold">
                <td className="px-6 py-4 text-sm text-kasa-black-500">
                  GROUP AGGREGATE
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {groupData?.name || ''}
                </td>
                <PlatformCell data={platformAggregates.google} />
                <PlatformCell data={platformAggregates.tripadvisor} />
                <PlatformCell data={platformAggregates.booking} />
                <PlatformCell data={platformAggregates.expedia} />
                <WeightedScoreCell score={groupAggregate} />
                <td className="px-6 py-4 text-center text-sm text-kasa-black-500">
                  {totalReviews.toLocaleString()}
                </td>
              </tr>

              {/* Hotel Rows */}
              {sortedHotelScores.map(hotelScore => (
                <tr key={hotelScore.hotel.id} className="hover:bg-kasa-neutral-warm transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-kasa-black-500">
                    {hotelScore.hotel.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {hotelScore.hotel.city}
                  </td>
                  <PlatformCell data={hotelScore.google} />
                  <PlatformCell data={hotelScore.tripadvisor} />
                  <PlatformCell data={hotelScore.booking} />
                  <PlatformCell data={hotelScore.expedia} />
                  <WeightedScoreCell score={hotelScore.weighted_score} />
                  <td className="px-6 py-4 text-center text-sm text-kasa-black-500">
                    {hotelScore.total_reviews.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
