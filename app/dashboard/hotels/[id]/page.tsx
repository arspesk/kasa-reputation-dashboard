"use client";

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import HotelScoreCard from '@/components/HotelScoreCard';
import type { Hotel, ReviewSnapshot, ReviewPlatform, ScoreData } from '@/types';
import toast from 'react-hot-toast';
import { generateHotelCSV, generateHistoricalCSV, downloadCSV, sanitizeFilename, generateFilename, ExportHotelData } from '@/lib/export-helpers';
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

interface ChartDataPoint {
  timestamp: string;
  date: Date;
  google?: number;
  tripadvisor?: number;
  booking?: number;
  expedia?: number;
}

type DateRange = '7d' | '30d' | '90d' | 'all';
type SortColumn = 'date' | 'platform' | 'score' | 'original_rating' | 'review_count';
type SortDirection = 'asc' | 'desc';

export default function HotelDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [weightedScore, setWeightedScore] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allSnapshots, setAllSnapshots] = useState<ReviewSnapshot[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    loadHotelData();
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

  const loadHotelData = async () => {
    setIsLoading(true);

    try {
      // Fetch hotel details
      const { data: hotelData, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', id)
        .single();

      if (hotelError) throw hotelError;
      if (!hotelData) throw new Error('Hotel not found');

      setHotel(hotelData);

      // Fetch review snapshots
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('review_snapshots')
        .select('*')
        .eq('hotel_id', id)
        .order('fetched_at', { ascending: false });

      if (!snapshotsError && snapshots && snapshots.length > 0) {
        // Store all snapshots for history view
        setAllSnapshots(snapshots);

        // Get latest snapshot per platform
        const platformMap = new Map<ReviewPlatform, ReviewSnapshot>();
        snapshots.forEach(snapshot => {
          if (!platformMap.has(snapshot.platform)) {
            platformMap.set(snapshot.platform, snapshot);
          }
        });

        // Transform to ScoreData format
        const scoresData: ScoreData[] = Array.from(platformMap.values()).map(snapshot => ({
          platform: snapshot.platform,
          rating: snapshot.rating,
          originalRating: snapshot.original_rating,
          reviewCount: snapshot.review_count
        }));

        setScores(scoresData);

        // Calculate weighted score
        if (scoresData.length > 0) {
          const totalReviews = scoresData.reduce((sum, s) => sum + s.reviewCount, 0);
          const weightedSum = scoresData.reduce((sum, s) => sum + (s.rating * s.reviewCount), 0);
          setWeightedScore(weightedSum / totalReviews);
        }

        // Get most recent fetch timestamp
        const mostRecent = snapshots[0].fetched_at;
        setLastUpdated(mostRecent);
      }
    } catch (error) {
      console.error('Error loading hotel data:', error);
      toast.error('Failed to load hotel data');
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!hotel) return;

    setIsRefreshing(true);
    const loadingToast = toast.loading('Fetching reviews from all platforms...');

    try {
      const response = await fetch('/api/reviews/fetch-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hotel_id: hotel.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reviews');
      }

      if (data.success && data.results) {
        // Transform API response to ScoreData format
        const scoresData: ScoreData[] = [];
        const platforms: ReviewPlatform[] = ['google', 'tripadvisor', 'booking', 'expedia'];

        platforms.forEach(platform => {
          const result = data.results[platform];
          if (result.success && result.data) {
            scoresData.push({
              platform,
              rating: result.data.rating,
              originalRating: result.data.original_rating,
              reviewCount: result.data.review_count
            });
          }
        });

        setScores(scoresData);

        // Calculate weighted score
        if (scoresData.length > 0) {
          const totalReviews = scoresData.reduce((sum, s) => sum + s.reviewCount, 0);
          const weightedSum = scoresData.reduce((sum, s) => sum + (s.rating * s.reviewCount), 0);
          setWeightedScore(weightedSum / totalReviews);
        }

        setLastUpdated(new Date().toISOString());

        const successCount = scoresData.length;
        toast.success(
          `Successfully fetched reviews from ${successCount} platform(s)`,
          { id: loadingToast }
        );

        // Reload all snapshots to update history
        loadHotelData();
      } else {
        throw new Error('No results returned');
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to fetch reviews',
        { id: loadingToast }
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCurrent = () => {
    if (!hotel) return;

    try {
      const exportData: ExportHotelData = {
        name: hotel.name,
        city: hotel.city,
        google: scores.find(s => s.platform === 'google') ? {
          rating: scores.find(s => s.platform === 'google')!.rating,
          reviewCount: scores.find(s => s.platform === 'google')!.reviewCount
        } : undefined,
        tripadvisor: scores.find(s => s.platform === 'tripadvisor') ? {
          rating: scores.find(s => s.platform === 'tripadvisor')!.rating,
          reviewCount: scores.find(s => s.platform === 'tripadvisor')!.reviewCount
        } : undefined,
        booking: scores.find(s => s.platform === 'booking') ? {
          rating: scores.find(s => s.platform === 'booking')!.rating,
          reviewCount: scores.find(s => s.platform === 'booking')!.reviewCount
        } : undefined,
        expedia: scores.find(s => s.platform === 'expedia') ? {
          rating: scores.find(s => s.platform === 'expedia')!.rating,
          reviewCount: scores.find(s => s.platform === 'expedia')!.reviewCount
        } : undefined,
        weightedScore,
        lastUpdated
      };

      const csv = generateHotelCSV([exportData]);
      const filename = generateFilename(sanitizeFilename(hotel.name));

      downloadCSV(csv, filename);
      toast.success('Exported hotel data to CSV');
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export CSV');
    }
  };

  const handleExportHistory = () => {
    if (!hotel) return;

    try {
      const csv = generateHistoricalCSV(hotel.name, hotel.city, allSnapshots);
      const filename = `${sanitizeFilename(hotel.name)}-history-${new Date().toISOString().split('T')[0]}.csv`;

      downloadCSV(csv, filename);
      toast.success(`Exported ${allSnapshots.length} historical snapshot${allSnapshots.length !== 1 ? 's' : ''} to CSV`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export CSV');
    }
  };

  const getDateFilter = (range: DateRange): Date | null => {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'all':
        return null;
    }
  };

  const transformToChartData = (snapshots: ReviewSnapshot[]): ChartDataPoint[] => {
    // Group by fetched_at timestamp
    const groupedByTime = new Map<string, Record<string, number>>();

    snapshots.forEach(snapshot => {
      const key = snapshot.fetched_at;
      if (!groupedByTime.has(key)) {
        groupedByTime.set(key, {});
      }
      groupedByTime.get(key)![snapshot.platform] = snapshot.rating;
    });

    // Convert to array format for Recharts
    return Array.from(groupedByTime.entries())
      .map(([timestamp, platforms]) => ({
        timestamp: new Date(timestamp).toLocaleDateString(),
        date: new Date(timestamp),
        ...platforms
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const getPlatformName = (platform: ReviewPlatform): string => {
    const names: Record<ReviewPlatform, string> = {
      google: 'Google',
      tripadvisor: 'TripAdvisor',
      booking: 'Booking.com',
      expedia: 'Expedia'
    };
    return names[platform];
  };

  const getPlatformColor = (platform: ReviewPlatform): string => {
    const colors: Record<ReviewPlatform, string> = {
      google: 'bg-blue-100 text-blue-800',
      tripadvisor: 'bg-green-100 text-green-800',
      booking: 'bg-indigo-100 text-indigo-800',
      expedia: 'bg-yellow-100 text-yellow-800'
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
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with descending as default
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedSnapshots = (snapshots: ReviewSnapshot[]): ReviewSnapshot[] => {
    return [...snapshots].sort((a, b) => {
      let compareResult = 0;

      switch (sortColumn) {
        case 'date':
          compareResult = new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-kasa-neutral-warm">
        <header className="bg-white shadow-sm border-b border-kasa-neutral-light">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-kasa-blue-300 hover:bg-[#144a70] font-medium transition-colors"
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
              Back to Hotels
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

  if (!hotel) {
    return null;
  }

  return (
    <div className="min-h-screen bg-kasa-neutral-warm">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-kasa-neutral-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/dashboard"
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
            Back to Hotels
          </Link>

          {/* Export Dropdown */}
          <div className="relative export-dropdown">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center px-4 py-2 min-h-kasa-button-md border border-kasa-blue-300 text-kasa-blue-300 rounded-kasa hover:bg-kasa-neutral-light transition-colors font-medium gap-2 focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)]"
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
              Export
              <svg
                className="w-4 h-4"
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

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-kasa-neutral-light rounded-kasa shadow-lg z-10">
                <button
                  onClick={handleExportCurrent}
                  className="w-full px-4 py-2 text-left hover:bg-kasa-neutral-warm text-sm text-gray-700 rounded-t-kasa-sm"
                >
                  Export Current Data
                </button>
                <button
                  onClick={handleExportHistory}
                  className="w-full px-4 py-2 text-left hover:bg-kasa-neutral-warm text-sm text-gray-700 rounded-b-kasa-sm"
                >
                  Export Full History
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hotel Score Card */}
        <HotelScoreCard
          hotel={{
            name: hotel.name,
            city: hotel.city,
            id: hotel.id
          }}
          scores={scores}
          weightedScore={weightedScore}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
          isLoading={isRefreshing}
        />

        {/* History Section */}
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

            {/* Line Chart */}
            <div className="bg-white rounded-kasa shadow-sm border border-kasa-neutral-light p-6">
              <h2 className="text-xl font-bold text-kasa-black-500 mb-4">Score Trends</h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={transformToChartData(
                    allSnapshots.filter(s => {
                      const dateFilter = getDateFilter(dateRange);
                      if (!dateFilter) return true;
                      return new Date(s.fetched_at) >= dateFilter;
                    })
                  )}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    label={{ value: 'Score (0-10)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(value: number) => value.toFixed(1)}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />

                  {/* Platform Lines */}
                  <Line
                    type="monotone"
                    dataKey="google"
                    stroke="#4285F4"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Google"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="tripadvisor"
                    stroke="#00AF87"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="TripAdvisor"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="booking"
                    stroke="#003580"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Booking.com"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="expedia"
                    stroke="#FFCB05"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Expedia"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Snapshots Table */}
            <div className="bg-white rounded-kasa shadow-sm border border-kasa-neutral-light overflow-hidden">
              <div className="px-6 py-4 border-b border-kasa-neutral-light">
                <h2 className="text-xl font-bold text-kasa-black-500">Historical Snapshots</h2>
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
                      allSnapshots.filter(s => {
                        const dateFilter = getDateFilter(dateRange);
                        if (!dateFilter) return true;
                        return new Date(s.fetched_at) >= dateFilter;
                      })
                    ).map((snapshot) => (
                        <tr key={snapshot.id} className="hover:bg-kasa-neutral-warm">
                          <td className="px-4 py-3 text-sm text-kasa-black-500">
                            {new Date(snapshot.fetched_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                              getPlatformColor(snapshot.platform)
                            }`}>
                              {getPlatformName(snapshot.platform)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-semibold ${getScoreColor(snapshot.rating)}`}>
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
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
