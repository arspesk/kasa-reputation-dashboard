"use client";

import { use, useState, useEffect, useMemo } from 'react';
import GroupScoreCard from '@/components/GroupScoreCard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  generateHotelCSV,
  generateGroupHistoricalCSV,
  downloadCSV,
  sanitizeFilename,
  ExportHotelData
} from '@/lib/export-helpers';
import toast from 'react-hot-toast';
import type { Hotel, ReviewSnapshot, ReviewPlatform } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface HotelGroupMember {
  hotel_id: string;
  hotels: Hotel;
}

interface GroupData {
  id: string;
  name: string;
  hotel_group_members: HotelGroupMember[];
}

type DateRange = '7d' | '30d' | '90d' | 'all';
type SortColumn = 'date' | 'hotel' | 'platform' | 'score' | 'original_rating' | 'review_count';
type SortDirection = 'asc' | 'desc';

export default function GroupDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params);
  const supabase = createClient();

  // Core data state
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Historical tracking state
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [allSnapshots, setAllSnapshots] = useState<ReviewSnapshot[]>([]);

  // Refresh functionality state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 });

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Sorting state for snapshots table
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadGroupData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-dropdown')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const loadGroupData = async () => {
    try {
      setIsLoading(true);

      // Fetch group with nested hotels
      const { data: groupWithHotels, error: groupError } = await supabase
        .from('hotel_groups')
        .select(`
          *,
          hotel_group_members!inner(
            hotels(*)
          )
        `)
        .eq('id', id)
        .single();

      if (groupError) throw groupError;
      if (!groupWithHotels) throw new Error('Group not found');

      const typedGroupData = groupWithHotels as unknown as GroupData;
      const hotelsData = typedGroupData.hotel_group_members
        ?.map((m: HotelGroupMember) => m.hotels)
        .filter(Boolean) || [];

      setHotels(hotelsData);
      setGroupData(typedGroupData);

      if (hotelsData.length > 0) {
        const hotelIds = hotelsData.map((h: Hotel) => h.id);

        // Fetch ALL historical snapshots (not just latest)
        const { data: allSnapshotsData, error: snapshotsError } = await supabase
          .from('review_snapshots')
          .select('*')
          .in('hotel_id', hotelIds)
          .order('fetched_at', { ascending: false });

        if (snapshotsError) throw snapshotsError;
        setAllSnapshots(allSnapshotsData || []);
      }
    } catch (error) {
      console.error('Error loading group:', error);
      toast.error('Failed to load group data');
    } finally {
      setIsLoading(false);
    }
  };

  // Get date filter based on selected range
  const getDateFilter = (range: DateRange): Date | null => {
    if (range === 'all') return null;

    const now = new Date();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  };

  // Filter snapshots by date range
  const filteredSnapshots = useMemo(() => {
    const dateFilter = getDateFilter(dateRange);
    if (!dateFilter) return allSnapshots;

    return allSnapshots.filter((s) => new Date(s.fetched_at) >= dateFilter);
  }, [allSnapshots, dateRange]);

  // Helper functions for snapshots table
  const getPlatformName = (platform: ReviewPlatform): string => {
    const names: Record<ReviewPlatform, string> = {
      google: 'Google',
      tripadvisor: 'TripAdvisor',
      booking: 'Booking.com',
      expedia: 'Expedia',
    };
    return names[platform];
  };

  const getPlatformColor = (platform: ReviewPlatform): string => {
    const colors: Record<ReviewPlatform, string> = {
      google: 'bg-blue-100 text-blue-800',
      tripadvisor: 'bg-green-100 text-green-800',
      booking: 'bg-indigo-100 text-indigo-800',
      expedia: 'bg-yellow-100 text-yellow-800',
    };
    return colors[platform];
  };

  const getScoreColor = (score: number): string => {
    if (score >= 8.0) return 'text-[#2eab6e]';
    if (score >= 6.0) return 'text-[#ff9520]';
    return 'text-[#e23c00]';
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedSnapshots = (
    snapshots: Array<ReviewSnapshot & { hotel_id: string }>
  ): Array<ReviewSnapshot & { hotel_id: string }> => {
    return [...snapshots].sort((a, b) => {
      let compareResult = 0;

      const hotelA = hotels.find((h) => h.id === a.hotel_id);
      const hotelB = hotels.find((h) => h.id === b.hotel_id);

      switch (sortColumn) {
        case 'date':
          compareResult = new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime();
          break;
        case 'hotel':
          compareResult = (hotelA?.name || '').localeCompare(hotelB?.name || '');
          break;
        case 'platform':
          compareResult = a.platform.localeCompare(b.platform);
          break;
        case 'score':
          compareResult = a.rating - b.rating;
          break;
        case 'original_rating':
          compareResult = a.original_rating - b.original_rating;
          break;
        case 'review_count':
          compareResult = a.review_count - b.review_count;
          break;
      }

      return sortDirection === 'asc' ? compareResult : -compareResult;
    });
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Transform to chart data: group by date and calculate aggregate
  const chartData = useMemo(() => {
    if (filteredSnapshots.length === 0) return [];

    // Group snapshots by date
    const snapshotsByDate = new Map<string, ReviewSnapshot[]>();

    filteredSnapshots.forEach((snapshot) => {
      const dateKey = snapshot.fetched_at.split('T')[0]; // YYYY-MM-DD
      if (!snapshotsByDate.has(dateKey)) {
        snapshotsByDate.set(dateKey, []);
      }
      snapshotsByDate.get(dateKey)!.push(snapshot);
    });

    // Calculate aggregate for each date
    return Array.from(snapshotsByDate.entries())
      .map(([dateKey, dateSnapshots]) => {
        const totalWeight = dateSnapshots.reduce((sum, s) => sum + s.review_count, 0);
        const weightedSum = dateSnapshots.reduce(
          (sum, s) => sum + s.rating * s.review_count,
          0
        );
        const aggregateScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

        return {
          date: new Date(dateKey),
          timestamp: new Date(dateKey).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          aggregateScore,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredSnapshots]);

  const handleRefreshAll = async () => {
    if (!groupData || hotels.length === 0) return;

    // Warning for large groups
    if (hotels.length > 50) {
      const estimatedTime = Math.ceil((hotels.length * 1.5) / 60);
      const estimatedCost = (hotels.length * 4 * 0.01).toFixed(2);

      const confirmed = confirm(
        `This will refresh ${hotels.length} hotels.\n\n` +
        `Estimated time: ${estimatedTime} minutes\n` +
        `Estimated SerpAPI cost: ~$${estimatedCost}\n\n` +
        `Continue?`
      );

      if (!confirmed) return;
    }

    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: hotels.length });

    const loadingToast = toast.loading('Starting group refresh...');
    const errors: string[] = [];
    let successCount = 0;

    try {
      // Process hotels sequentially to avoid rate limits
      for (let i = 0; i < hotels.length; i++) {
        const hotel = hotels[i];
        setRefreshProgress({ current: i + 1, total: hotels.length });

        try {
          const response = await fetch('/api/reviews/fetch-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel_id: hotel.id }),
          });

          const data = await response.json();

          if (data.success) {
            successCount++;
          } else {
            errors.push(`${hotel.name}: ${data.error || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`${hotel.name}: Network error`);
          console.error(`Failed to refresh ${hotel.name}:`, error);
        }

        // Rate limiting delay (except after last hotel)
        if (i < hotels.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      // Reload all data after refresh completes
      await loadGroupData();

      // Show results
      if (successCount === hotels.length) {
        toast.success(`Successfully refreshed all ${hotels.length} hotels`, {
          id: loadingToast,
        });
      } else if (successCount > 0) {
        toast.success(
          `Refreshed ${successCount} of ${hotels.length} hotels. ${errors.length} failed.`,
          { id: loadingToast }
        );
      } else {
        toast.error('Failed to refresh any hotels', { id: loadingToast });
      }

      if (errors.length > 0 && errors.length < 10) {
        console.warn('Refresh errors:', errors);
      }
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error('Failed to refresh group', { id: loadingToast });
    } finally {
      setIsRefreshing(false);
      setRefreshProgress({ current: 0, total: 0 });
    }
  };

  // Export current snapshot (existing functionality)
  const handleExportCurrent = async () => {
    if (!groupData || hotels.length === 0) return;

    try {
      // Fetch review snapshots for all hotels
      const hotelIds = hotels.map((h) => h.id);
      const { data: snapshots } = await supabase
        .from('review_snapshots')
        .select('*')
        .in('hotel_id', hotelIds)
        .order('fetched_at', { ascending: false });

      // Build review data map
      const reviewMap = new Map<
        string,
        {
          google?: { rating: number; reviewCount: number };
          tripadvisor?: { rating: number; reviewCount: number };
          booking?: { rating: number; reviewCount: number };
          expedia?: { rating: number; reviewCount: number };
          weighted_score?: number;
          last_updated?: string;
        }
      >();

      if (snapshots) {
        // Group by hotel
        const hotelSnapshots = new Map<string, ReviewSnapshot[]>();
        snapshots.forEach((snapshot) => {
          if (!hotelSnapshots.has(snapshot.hotel_id)) {
            hotelSnapshots.set(snapshot.hotel_id, []);
          }
          hotelSnapshots.get(snapshot.hotel_id)!.push(snapshot);
        });

        // Process each hotel
        hotelSnapshots.forEach((hotelSnaps, hotelId) => {
          const platformMap = new Map<ReviewPlatform, ReviewSnapshot>();

          // Get latest per platform
          hotelSnaps.forEach((snap) => {
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
              reviewCount: snap.review_count,
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
            const weightedSum = reviews.reduce(
              (sum, r) => sum + r.rating * r.review_count,
              0
            );
            hotelReview.weighted_score = weightedSum / totalReviews;
          }

          hotelReview.last_updated = latestUpdate || undefined;

          reviewMap.set(hotelId, hotelReview);
        });
      }

      // Calculate aggregate scores
      const aggregateGoogle: { totalRating: number; totalCount: number } = {
        totalRating: 0,
        totalCount: 0,
      };
      const aggregateTripadvisor: { totalRating: number; totalCount: number } = {
        totalRating: 0,
        totalCount: 0,
      };
      const aggregateBooking: { totalRating: number; totalCount: number } = {
        totalRating: 0,
        totalCount: 0,
      };
      const aggregateExpedia: { totalRating: number; totalCount: number } = {
        totalRating: 0,
        totalCount: 0,
      };
      const overallWeighted: { totalRating: number; totalCount: number } = {
        totalRating: 0,
        totalCount: 0,
      };

      hotels.forEach((hotel) => {
        const reviews = reviewMap.get(hotel.id);
        if (!reviews) return;

        if (reviews.google) {
          aggregateGoogle.totalRating +=
            reviews.google.rating * reviews.google.reviewCount;
          aggregateGoogle.totalCount += reviews.google.reviewCount;
        }
        if (reviews.tripadvisor) {
          aggregateTripadvisor.totalRating +=
            reviews.tripadvisor.rating * reviews.tripadvisor.reviewCount;
          aggregateTripadvisor.totalCount += reviews.tripadvisor.reviewCount;
        }
        if (reviews.booking) {
          aggregateBooking.totalRating +=
            reviews.booking.rating * reviews.booking.reviewCount;
          aggregateBooking.totalCount += reviews.booking.reviewCount;
        }
        if (reviews.expedia) {
          aggregateExpedia.totalRating +=
            reviews.expedia.rating * reviews.expedia.reviewCount;
          aggregateExpedia.totalCount += reviews.expedia.reviewCount;
        }
        if (reviews.weighted_score !== undefined) {
          const totalReviews =
            (reviews.google?.reviewCount || 0) +
            (reviews.tripadvisor?.reviewCount || 0) +
            (reviews.booking?.reviewCount || 0) +
            (reviews.expedia?.reviewCount || 0);
          overallWeighted.totalRating += reviews.weighted_score * totalReviews;
          overallWeighted.totalCount += totalReviews;
        }
      });

      // Transform to export format
      const exportData: ExportHotelData[] = hotels.map((hotel) => {
        const reviews = reviewMap.get(hotel.id);
        return {
          name: hotel.name,
          city: hotel.city,
          google: reviews?.google,
          tripadvisor: reviews?.tripadvisor,
          booking: reviews?.booking,
          expedia: reviews?.expedia,
          weightedScore: reviews?.weighted_score,
          lastUpdated: reviews?.last_updated,
        };
      });

      // Add aggregate row
      const aggregateRow: ExportHotelData = {
        name: `[GROUP AGGREGATE] ${groupData.name}`,
        city: '-',
        google:
          aggregateGoogle.totalCount > 0
            ? {
                rating: aggregateGoogle.totalRating / aggregateGoogle.totalCount,
                reviewCount: aggregateGoogle.totalCount,
              }
            : undefined,
        tripadvisor:
          aggregateTripadvisor.totalCount > 0
            ? {
                rating: aggregateTripadvisor.totalRating / aggregateTripadvisor.totalCount,
                reviewCount: aggregateTripadvisor.totalCount,
              }
            : undefined,
        booking:
          aggregateBooking.totalCount > 0
            ? {
                rating: aggregateBooking.totalRating / aggregateBooking.totalCount,
                reviewCount: aggregateBooking.totalCount,
              }
            : undefined,
        expedia:
          aggregateExpedia.totalCount > 0
            ? {
                rating: aggregateExpedia.totalRating / aggregateExpedia.totalCount,
                reviewCount: aggregateExpedia.totalCount,
              }
            : undefined,
        weightedScore:
          overallWeighted.totalCount > 0
            ? overallWeighted.totalRating / overallWeighted.totalCount
            : undefined,
        lastUpdated: new Date().toISOString(),
      };

      exportData.push(aggregateRow);

      const csv = generateHotelCSV(exportData);
      const filename = `group-${sanitizeFilename(groupData.name)}-${
        new Date().toISOString().split('T')[0]
      }.csv`;

      downloadCSV(csv, filename);
      toast.success(
        `Exported group with ${hotels.length} hotel${hotels.length !== 1 ? 's' : ''} to CSV`
      );
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export group data');
    }
  };

  // Export historical data
  const handleExportHistory = () => {
    if (!groupData || hotels.length === 0 || filteredSnapshots.length === 0) {
      toast.error('No historical data to export');
      return;
    }

    try {
      const csv = generateGroupHistoricalCSV(
        groupData.name,
        hotels,
        filteredSnapshots as Array<ReviewSnapshot & { hotel_id: string }>
      );

      const dateRangeSuffix = dateRange === 'all' ? 'all-time' : `last-${dateRange}`;
      const filename = `group-${sanitizeFilename(groupData.name)}-history-${dateRangeSuffix}-${
        new Date().toISOString().split('T')[0]
      }.csv`;

      downloadCSV(csv, filename);
      toast.success(`Exported ${filteredSnapshots.length} historical snapshots`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export historical data');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-kasa-neutral-warm">
        <header className="bg-white shadow-sm border-b border-kasa-neutral-light">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kasa-blue-300"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kasa-neutral-warm">
      {/* Header */}
      <header className="bg-white border-b border-kasa-neutral-light sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Back button */}
            <Link
              href="/dashboard/groups"
              className="text-kasa-blue-300 hover:text-[#144a70] flex items-center gap-2"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Groups
            </Link>

            {/* Action buttons */}
            <div className="flex gap-3">
              {/* Refresh All Button */}
              <button
                onClick={handleRefreshAll}
                disabled={isRefreshing || hotels.length === 0}
                className="inline-flex items-center px-4 py-2 bg-kasa-blue-300 text-white rounded-kasa font-medium hover:bg-[#144a70] focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-kasa-button-md"
              >
                {isRefreshing ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                    Refreshing {refreshProgress.current}/{refreshProgress.total}...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="w-4 h-4 mr-2" />
                    Refresh All Hotels
                  </>
                )}
              </button>

              {/* Export Dropdown */}
              <div className="relative export-dropdown">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={hotels.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-kasa-blue-300 text-kasa-blue-300 rounded-kasa font-medium hover:bg-kasa-neutral-warm focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-kasa-button-md"
                >
                  <svg
                    className="w-4 h-4 mr-2"
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
                  Export
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-kasa shadow-lg border border-kasa-neutral-light z-20">
                    <button
                      onClick={handleExportCurrent}
                      className="w-full text-left px-4 py-3 hover:bg-kasa-neutral-warm transition-colors border-b border-kasa-neutral-light"
                    >
                      <div className="font-medium text-kasa-black-500">
                        Export Current Snapshot
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Latest review data for all hotels
                      </div>
                    </button>
                    <button
                      onClick={handleExportHistory}
                      disabled={allSnapshots.length === 0}
                      className="w-full text-left px-4 py-3 hover:bg-kasa-neutral-warm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium text-kasa-black-500">
                        Export Historical Data
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        All snapshots for {dateRange === 'all' ? 'all time' : `last ${dateRange}`}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Group Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-kasa-black-500">
            {groupData?.name}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {hotels.length} {hotels.length === 1 ? 'hotel' : 'hotels'}
          </p>
        </div>

        {/* Group Score Card */}
        <GroupScoreCard group_id={id} />

        {/* Historical Performance Section */}
        {allSnapshots.length > 0 && (
          <div className="space-y-6">
            {/* Date Range Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setDateRange('7d')}
                className={`px-4 py-2 min-h-kasa-button-md rounded-kasa font-medium transition-colors ${
                  dateRange === '7d'
                    ? 'bg-kasa-blue-300 text-white'
                    : 'bg-kasa-neutral-light text-gray-700 hover:bg-kasa-neutral-medium'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setDateRange('30d')}
                className={`px-4 py-2 min-h-kasa-button-md rounded-kasa font-medium transition-colors ${
                  dateRange === '30d'
                    ? 'bg-kasa-blue-300 text-white'
                    : 'bg-kasa-neutral-light text-gray-700 hover:bg-kasa-neutral-medium'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setDateRange('90d')}
                className={`px-4 py-2 min-h-kasa-button-md rounded-kasa font-medium transition-colors ${
                  dateRange === '90d'
                    ? 'bg-kasa-blue-300 text-white'
                    : 'bg-kasa-neutral-light text-gray-700 hover:bg-kasa-neutral-medium'
                }`}
              >
                Last 90 Days
              </button>
              <button
                onClick={() => setDateRange('all')}
                className={`px-4 py-2 min-h-kasa-button-md rounded-kasa font-medium transition-colors ${
                  dateRange === 'all'
                    ? 'bg-kasa-blue-300 text-white'
                    : 'bg-kasa-neutral-light text-gray-700 hover:bg-kasa-neutral-medium'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Historical Trends Chart */}
            <div className="bg-white rounded-kasa-lg shadow-md border border-kasa-neutral-light p-6">
              <h2 className="text-xl font-bold text-kasa-black-500 mb-4">
                Group Aggregate Performance Trends
              </h2>

              {chartData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No historical data available for selected time period.</p>
                  <p className="text-sm mt-2">
                    Click "Refresh All Hotels" to start tracking performance.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="timestamp"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) =>
                        value !== undefined ? [value.toFixed(2), 'Aggregate Score'] : ['N/A', 'Aggregate Score']
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="aggregateScore"
                      stroke="#195c8c"
                      strokeWidth={3}
                      name="Group Average"
                      dot={{ fill: '#195c8c', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Historical Snapshots Table */}
            {filteredSnapshots.length > 0 && (
              <div className="bg-white rounded-kasa shadow-md border border-kasa-neutral-light overflow-hidden">
                <div className="px-6 py-4 border-b border-kasa-neutral-light">
                  <h2 className="text-xl font-bold text-kasa-black-500">Historical Snapshots</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {filteredSnapshots.length} snapshot{filteredSnapshots.length !== 1 ? 's' : ''} across all hotels
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-kasa-neutral-light">
                    <thead className="bg-kasa-black-500">
                      <tr>
                        <th
                          className="px-4 py-3 text-left text-xs font-bold text-gray-100 uppercase cursor-pointer hover:bg-[#0a1a3d] select-none"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center gap-2">
                            Date & Time
                            <SortIcon column="date" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-bold text-gray-100 uppercase cursor-pointer hover:bg-[#0a1a3d] select-none"
                          onClick={() => handleSort('hotel')}
                        >
                          <div className="flex items-center gap-2">
                            Hotel
                            <SortIcon column="hotel" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-center text-xs font-bold text-gray-100 uppercase cursor-pointer hover:bg-[#0a1a3d] select-none"
                          onClick={() => handleSort('platform')}
                        >
                          <div className="flex items-center justify-center gap-2">
                            Platform
                            <SortIcon column="platform" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-center text-xs font-bold text-gray-100 uppercase cursor-pointer hover:bg-[#0a1a3d] select-none"
                          onClick={() => handleSort('score')}
                        >
                          <div className="flex items-center justify-center gap-2">
                            Score (0-10)
                            <SortIcon column="score" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-center text-xs font-bold text-gray-100 uppercase cursor-pointer hover:bg-[#0a1a3d] select-none"
                          onClick={() => handleSort('original_rating')}
                        >
                          <div className="flex items-center justify-center gap-2">
                            Original Rating
                            <SortIcon column="original_rating" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-center text-xs font-bold text-gray-100 uppercase cursor-pointer hover:bg-[#0a1a3d] select-none"
                          onClick={() => handleSort('review_count')}
                        >
                          <div className="flex items-center justify-center gap-2">
                            Review Count
                            <SortIcon column="review_count" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-kasa-neutral-light">
                      {getSortedSnapshots(
                        filteredSnapshots as Array<ReviewSnapshot & { hotel_id: string }>
                      ).map((snapshot) => {
                        const hotel = hotels.find((h) => h.id === snapshot.hotel_id);
                        return (
                          <tr key={snapshot.id} className="hover:bg-kasa-neutral-warm">
                            <td className="px-4 py-3 text-sm text-kasa-black-500">
                              {new Date(snapshot.fetched_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-kasa-black-500">
                              {hotel?.name || 'Unknown Hotel'}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getPlatformColor(
                                  snapshot.platform
                                )}`}
                              >
                                {getPlatformName(snapshot.platform)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`text-sm font-semibold ${getScoreColor(
                                  snapshot.rating
                                )}`}
                              >
                                {snapshot.rating.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-center">
                              {snapshot.original_rating.toFixed(1)}/
                              {snapshot.platform === 'booking' ? '10' : '5'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-center">
                              {snapshot.review_count.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State - No Historical Data Yet */}
        {allSnapshots.length === 0 && !isLoading && (
          <div className="bg-white rounded-kasa-lg shadow-md border border-kasa-neutral-light p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Historical Data Yet
            </h3>
            <p className="text-gray-600 mb-4">
              Start tracking this group's performance by refreshing review data.
            </p>
            <button
              onClick={handleRefreshAll}
              disabled={hotels.length === 0}
              className="inline-flex items-center px-6 py-3 bg-kasa-blue-300 text-white rounded-kasa font-medium hover:bg-[#144a70] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowPathIcon className="w-5 h-5 mr-2" />
              Refresh All Hotels
            </button>
          </div>
        )}
      </main>

      {/* Refresh Progress Overlay */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-kasa-lg p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-kasa-black-500 mb-4">
              Refreshing Group Reviews
            </h3>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
              <div
                className="bg-kasa-blue-300 h-4 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${(refreshProgress.current / refreshProgress.total) * 100}%`,
                }}
              />
            </div>

            {/* Progress Text */}
            <div className="space-y-2 text-center">
              <p className="text-lg font-medium text-gray-700">
                Processing hotel {refreshProgress.current} of {refreshProgress.total}
              </p>
              <p className="text-sm text-gray-600">
                {Math.round((refreshProgress.current / refreshProgress.total) * 100)}% complete
              </p>
              <p className="text-xs text-gray-500 mt-4">
                This may take several minutes for large groups.
                <br />
                Please do not close this window.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
