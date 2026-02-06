"use client";

import { use, useState } from 'react';
import GroupScoreCard from '@/components/GroupScoreCard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { generateHotelCSV, downloadCSV, sanitizeFilename, ExportHotelData } from '@/lib/export-helpers';
import toast from 'react-hot-toast';
import type { Hotel, ReviewSnapshot, ReviewPlatform } from '@/types';

interface HotelGroupMember {
  hotel_id: string;
  hotels: Hotel;
}

interface GroupData {
  id: string;
  name: string;
  hotel_group_members: HotelGroupMember[];
}

export default function GroupDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportGroup = async () => {
    setIsExporting(true);
    try {
      // Fetch group with hotels
      const { data: groupData, error: groupError } = await supabase
        .from('hotel_groups')
        .select(`
          *,
          hotel_group_members (
            hotel_id,
            hotels (*)
          )
        `)
        .eq('id', id)
        .single();

      if (groupError) throw groupError;

      const typedGroupData = groupData as unknown as GroupData;

      // Extract hotels from nested structure
      const hotels: Hotel[] = typedGroupData?.hotel_group_members
        ?.map((member: HotelGroupMember) => member.hotels)
        .filter(Boolean) || [];

      if (hotels.length === 0) {
        toast.error('No hotels in this group to export');
        return;
      }

      // Fetch review snapshots for all hotels
      const hotelIds = hotels.map(h => h.id);
      const { data: snapshots } = await supabase
        .from('review_snapshots')
        .select('*')
        .in('hotel_id', hotelIds)
        .order('fetched_at', { ascending: false });

      // Build review data map
      const reviewMap = new Map<string, {
        google?: { rating: number; reviewCount: number };
        tripadvisor?: { rating: number; reviewCount: number };
        booking?: { rating: number; reviewCount: number };
        expedia?: { rating: number; reviewCount: number };
        weighted_score?: number;
        last_updated?: string;
      }>();

      if (snapshots) {
        // Group by hotel
        const hotelSnapshots = new Map<string, ReviewSnapshot[]>();
        snapshots.forEach(snapshot => {
          if (!hotelSnapshots.has(snapshot.hotel_id)) {
            hotelSnapshots.set(snapshot.hotel_id, []);
          }
          hotelSnapshots.get(snapshot.hotel_id)!.push(snapshot);
        });

        // Process each hotel
        hotelSnapshots.forEach((hotelSnaps, hotelId) => {
          const platformMap = new Map<ReviewPlatform, ReviewSnapshot>();

          // Get latest per platform
          hotelSnaps.forEach(snap => {
            if (!platformMap.has(snap.platform)) {
              platformMap.set(snap.platform, snap);
            }
          });

          // Build review data
          const reviews: { rating: number; review_count: number }[] = [];
          const hotelReview: Record<string, { rating: number; reviewCount: number }> & {
            weighted_score?: number;
            last_updated?: string;
          } = {};
          let latestUpdate: string | null = null;

          platformMap.forEach((snap, platform) => {
            hotelReview[platform] = {
              rating: snap.rating,
              reviewCount: snap.review_count
            };
            reviews.push({ rating: snap.rating, review_count: snap.review_count });

            // Track most recent update
            if (!latestUpdate || new Date(snap.fetched_at) > new Date(latestUpdate)) {
              latestUpdate = snap.fetched_at;
            }
          });

          // Calculate weighted score
          if (reviews.length > 0) {
            const totalReviews = reviews.reduce((sum, r) => sum + r.review_count, 0);
            const weightedSum = reviews.reduce((sum, r) => sum + (r.rating * r.review_count), 0);
            hotelReview.weighted_score = weightedSum / totalReviews;
          }

          hotelReview.last_updated = latestUpdate;

          reviewMap.set(hotelId, hotelReview);
        });
      }

      // Calculate aggregate scores
      const aggregateGoogle: { totalRating: number; totalCount: number } = { totalRating: 0, totalCount: 0 };
      const aggregateTripadvisor: { totalRating: number; totalCount: number } = { totalRating: 0, totalCount: 0 };
      const aggregateBooking: { totalRating: number; totalCount: number } = { totalRating: 0, totalCount: 0 };
      const aggregateExpedia: { totalRating: number; totalCount: number } = { totalRating: 0, totalCount: 0 };
      const overallWeighted: { totalRating: number; totalCount: number } = { totalRating: 0, totalCount: 0 };

      hotels.forEach(hotel => {
        const reviews = reviewMap.get(hotel.id);
        if (!reviews) return;

        if (reviews.google) {
          aggregateGoogle.totalRating += reviews.google.rating * reviews.google.reviewCount;
          aggregateGoogle.totalCount += reviews.google.reviewCount;
        }
        if (reviews.tripadvisor) {
          aggregateTripadvisor.totalRating += reviews.tripadvisor.rating * reviews.tripadvisor.reviewCount;
          aggregateTripadvisor.totalCount += reviews.tripadvisor.reviewCount;
        }
        if (reviews.booking) {
          aggregateBooking.totalRating += reviews.booking.rating * reviews.booking.reviewCount;
          aggregateBooking.totalCount += reviews.booking.reviewCount;
        }
        if (reviews.expedia) {
          aggregateExpedia.totalRating += reviews.expedia.rating * reviews.expedia.reviewCount;
          aggregateExpedia.totalCount += reviews.expedia.reviewCount;
        }
        if (reviews.weighted_score !== undefined) {
          const totalReviews = (reviews.google?.reviewCount || 0) +
                             (reviews.tripadvisor?.reviewCount || 0) +
                             (reviews.booking?.reviewCount || 0) +
                             (reviews.expedia?.reviewCount || 0);
          overallWeighted.totalRating += reviews.weighted_score * totalReviews;
          overallWeighted.totalCount += totalReviews;
        }
      });

      // Transform to export format
      const exportData: ExportHotelData[] = hotels.map(hotel => {
        const reviews = reviewMap.get(hotel.id);
        return {
          name: hotel.name,
          city: hotel.city,
          google: reviews?.google,
          tripadvisor: reviews?.tripadvisor,
          booking: reviews?.booking,
          expedia: reviews?.expedia,
          weightedScore: reviews?.weighted_score,
          lastUpdated: reviews?.last_updated
        };
      });

      // Add aggregate row
      const aggregateRow: ExportHotelData = {
        name: `[GROUP AGGREGATE] ${typedGroupData.name}`,
        city: '-',
        google: aggregateGoogle.totalCount > 0 ? {
          rating: aggregateGoogle.totalRating / aggregateGoogle.totalCount,
          reviewCount: aggregateGoogle.totalCount
        } : undefined,
        tripadvisor: aggregateTripadvisor.totalCount > 0 ? {
          rating: aggregateTripadvisor.totalRating / aggregateTripadvisor.totalCount,
          reviewCount: aggregateTripadvisor.totalCount
        } : undefined,
        booking: aggregateBooking.totalCount > 0 ? {
          rating: aggregateBooking.totalRating / aggregateBooking.totalCount,
          reviewCount: aggregateBooking.totalCount
        } : undefined,
        expedia: aggregateExpedia.totalCount > 0 ? {
          rating: aggregateExpedia.totalRating / aggregateExpedia.totalCount,
          reviewCount: aggregateExpedia.totalCount
        } : undefined,
        weightedScore: overallWeighted.totalCount > 0 ? overallWeighted.totalRating / overallWeighted.totalCount : undefined,
        lastUpdated: new Date().toISOString()
      };

      exportData.push(aggregateRow);

      const csv = generateHotelCSV(exportData);
      const filename = `group-${sanitizeFilename(typedGroupData.name)}-${new Date().toISOString().split('T')[0]}.csv`;

      downloadCSV(csv, filename);
      toast.success(`Exported group with ${hotels.length} hotel${hotels.length !== 1 ? 's' : ''} to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export group data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-kasa-neutral-warm">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-kasa-neutral-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/dashboard/groups"
            className="inline-flex items-center text-kasa-blue-300 hover:text-[#144a70] font-medium transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Groups
          </Link>

          {/* Export Button */}
          <button
            onClick={handleExportGroup}
            disabled={isExporting}
            className="inline-flex items-center px-4 py-2 min-h-kasa-button-md border border-kasa-blue-300 text-kasa-blue-300 rounded-kasa hover:bg-kasa-neutral-light transition-colors font-medium gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)]"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {isExporting ? 'Exporting...' : 'Export Group'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GroupScoreCard group_id={id} />
      </main>
    </div>
  );
}
