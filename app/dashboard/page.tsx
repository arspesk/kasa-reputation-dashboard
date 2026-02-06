"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/components/LogoutButton";
import AddHotelModal from "@/components/AddHotelModal";
import EditHotelModal from "@/components/EditHotelModal";
import ImportCSVModal from "@/components/ImportCSVModal";
import HotelAvatar from "@/components/HotelAvatar";
import toast from "react-hot-toast";
import type { Hotel } from "@/types/hotel";
import type { ReviewSnapshot, ReviewPlatform } from "@/types";
import { generateHotelCSV, downloadCSV, generateFilename, ExportHotelData } from "@/lib/export-helpers";

type FilterType = 'all' | 'with_data' | 'missing_data' | 'low_scores';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelReviews, setHotelReviews] = useState<Map<string, {
    google?: { rating: number; reviewCount: number };
    tripadvisor?: { rating: number; reviewCount: number };
    booking?: { rating: number; reviewCount: number };
    expedia?: { rating: number; reviewCount: number };
    weighted_score?: number;
    platform_count?: number;
    last_updated?: string;
  }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingHotelId, setRefreshingHotelId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'city' | 'score' | 'status' | 'updated'>('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedHotels, setSelectedHotels] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
        await loadHotels();
      }
      setIsLoading(false);
    };

    checkUser();
  }, [router, supabase]);

  const loadHotels = async () => {
    const { data, error } = await supabase
      .from("hotels")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading hotels:", error);
      toast.error("Failed to load hotels");
    } else {
      setHotels(data || []);

      // Load review snapshots for all hotels
      if (data && data.length > 0) {
        const hotelIds = data.map(h => h.id);
        const { data: snapshots, error: snapshotsError } = await supabase
          .from('review_snapshots')
          .select('*')
          .in('hotel_id', hotelIds)
          .order('fetched_at', { ascending: false });

        if (!snapshotsError && snapshots) {
          // Get latest snapshot per hotel-platform
          const reviewMap = new Map<string, {
            google?: { rating: number; reviewCount: number };
            tripadvisor?: { rating: number; reviewCount: number };
            booking?: { rating: number; reviewCount: number };
            expedia?: { rating: number; reviewCount: number };
            weighted_score?: number;
          }>();

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
            const hotelReview: any = {};
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

            hotelReview.platform_count = platformMap.size;
            hotelReview.last_updated = latestUpdate;

            reviewMap.set(hotelId, hotelReview);
          });

          setHotelReviews(reviewMap);
        }
      }
    }
  };

  const handleHotelAdded = (hotel: Hotel) => {
    setHotels((prev) => [hotel, ...prev]);
    setIsModalOpen(false);
    toast.success(`${hotel.name} added successfully!`);
  };

  const handleHotelUpdated = (updatedHotel: Hotel) => {
    setHotels((prev) =>
      prev.map((h) => (h.id === updatedHotel.id ? updatedHotel : h))
    );
    setEditingHotel(null);
    toast.success(`${updatedHotel.name} updated successfully!`);
  };

  const handleImportComplete = (importedHotels: Hotel[]) => {
    setHotels((prev) => [...importedHotels, ...prev]);
    setIsImportModalOpen(false);
    toast.success(
      `Successfully imported ${importedHotels.length} hotel${
        importedHotels.length !== 1 ? "s" : ""
      }!`
    );
  };

  const handleDeleteHotel = async (hotel: Hotel) => {
    if (!confirm(`Are you sure you want to delete "${hotel.name}"?`)) {
      return;
    }

    const { error } = await supabase
      .from("hotels")
      .delete()
      .eq("id", hotel.id);

    if (error) {
      console.error("Error deleting hotel:", error);
      toast.error("Failed to delete hotel");
    } else {
      setHotels((prev) => prev.filter((h) => h.id !== hotel.id));
      toast.success(`${hotel.name} deleted successfully`);
    }
  };

  const handleRefreshHotel = async (hotel: Hotel) => {
    setRefreshingHotelId(hotel.id);
    const loadingToast = toast.loading(`Fetching reviews for ${hotel.name}...`);

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

      if (data.success) {
        // Reload hotels to get updated review data
        await loadHotels();
        toast.success(`Reviews updated for ${hotel.name}`, { id: loadingToast });
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
      setRefreshingHotelId(null);
    }
  };

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleSelectHotel = (hotelId: string) => {
    setSelectedHotels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hotelId)) {
        newSet.delete(hotelId);
      } else {
        newSet.add(hotelId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedHotels.size === hotels.length) {
      setSelectedHotels(new Set());
    } else {
      setSelectedHotels(new Set(hotels.map(h => h.id)));
    }
  };

  const handleBulkRefresh = async () => {
    const selectedCount = selectedHotels.size;
    const loadingToast = toast.loading(`Fetching reviews for ${selectedCount} hotel${selectedCount > 1 ? 's' : ''}...`);

    try {
      await Promise.all(
        Array.from(selectedHotels).map(hotelId => {
          const hotel = hotels.find(h => h.id === hotelId);
          if (!hotel) return Promise.resolve();

          return fetch('/api/reviews/fetch-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel_id: hotel.id }),
          });
        })
      );

      await loadHotels();
      setSelectedHotels(new Set());
      toast.success(`Reviews updated for ${selectedCount} hotel${selectedCount > 1 ? 's' : ''}`, { id: loadingToast });
    } catch (error) {
      console.error('Error bulk refreshing:', error);
      toast.error('Failed to refresh some hotels', { id: loadingToast });
    }
  };

  const handleBulkDelete = async () => {
    const selectedCount = selectedHotels.size;
    if (!confirm(`Are you sure you want to delete ${selectedCount} hotel${selectedCount > 1 ? 's' : ''}?`)) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedHotels).map(hotelId =>
          supabase.from("hotels").delete().eq("id", hotelId)
        )
      );

      setHotels(prev => prev.filter(h => !selectedHotels.has(h.id)));
      setSelectedHotels(new Set());
      toast.success(`${selectedCount} hotel${selectedCount > 1 ? 's' : ''} deleted successfully`);
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error('Failed to delete some hotels');
    }
  };

  const handleExportCSV = () => {
    try {
      // Export selected hotels if any are selected, otherwise export all filtered/sorted hotels
      const hotelsToExport = selectedHotels.size > 0
        ? sortedHotels.filter(hotel => selectedHotels.has(hotel.id))
        : sortedHotels;

      // Transform current hotel data to export format
      const exportData: ExportHotelData[] = hotelsToExport.map(hotel => {
        const reviews = hotelReviews.get(hotel.id);

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

      const csv = generateHotelCSV(exportData);
      const filename = generateFilename(
        selectedHotels.size > 0 ? 'selected-hotels-export' : 'hotels-export'
      );

      downloadCSV(csv, filename);
      toast.success(
        selectedHotels.size > 0
          ? `Exported ${exportData.length} selected hotel${exportData.length !== 1 ? 's' : ''} to CSV`
          : `Exported ${exportData.length} hotel${exportData.length !== 1 ? 's' : ''} to CSV`
      );
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export CSV');
    }
  };

  const formatRelativeTime = (isoTimestamp: string): string => {
    const now = new Date();
    const updated = new Date(isoTimestamp);
    const diffMs = now.getTime() - updated.getTime();

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredHotels = useMemo(() => {
    return hotels.filter(hotel => {
      const reviews = hotelReviews.get(hotel.id);

      switch (filter) {
        case 'with_data':
          return reviews && reviews.platform_count && reviews.platform_count > 0;
        case 'missing_data':
          return !reviews || !reviews.platform_count || reviews.platform_count === 0;
        case 'low_scores':
          return reviews && reviews.weighted_score && reviews.weighted_score < 6.0;
        default:
          return true;
      }
    });
  }, [hotels, hotelReviews, filter]);

  const sortedHotels = useMemo(() => {
    return [...filteredHotels].sort((a, b) => {
      const reviewsA = hotelReviews.get(a.id);
      const reviewsB = hotelReviews.get(b.id);

      let comparison = 0;

      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'city':
          comparison = a.city.localeCompare(b.city);
          break;
        case 'score':
          comparison = (reviewsA?.weighted_score ?? -1) - (reviewsB?.weighted_score ?? -1);
          break;
        case 'status':
          comparison = (reviewsA?.platform_count ?? 0) - (reviewsB?.platform_count ?? 0);
          break;
        case 'updated':
          const dateA = reviewsA?.last_updated ? new Date(reviewsA.last_updated).getTime() : 0;
          const dateB = reviewsB?.last_updated ? new Date(reviewsB.last_updated).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredHotels, hotelReviews, sortColumn, sortDirection]);

  const SortableHeader = ({
    column,
    label,
    className = "text-left"
  }: {
    column: typeof sortColumn;
    label: string;
    className?: string;
  }) => {
    const isActive = sortColumn === column;

    return (
      <th
        className={`px-4 py-3 text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-[#0a1a3d] transition-colors sticky top-0 bg-kasa-black-500 z-10 ${className}`}
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isActive && (
            <svg
              className={`w-4 h-4 transform transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kasa-neutral-warm">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kasa-blue-300"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kasa-neutral-warm">
      <header className="bg-white shadow-sm border-b border-kasa-neutral-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold text-kasa-black-500">
                Kasa Reputation Dashboard
              </h1>
              <nav className="flex gap-4">
                <Link
                  href="/dashboard"
                  className="text-kasa-blue-300 font-medium border-b-2 border-kasa-blue-300"
                >
                  Hotels
                </Link>
                <Link
                  href="/dashboard/groups"
                  className="text-kasa-neutral-dark hover:text-kasa-black-500 font-medium"
                >
                  Groups
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">{user?.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-kasa-black-500">Hotels</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-kasa-blue-300 text-kasa-blue-300 rounded-kasa font-medium hover:bg-kasa-neutral-warm focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] transition-colors min-h-kasa-button-md"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Import CSV
            </button>
            <button
              onClick={handleExportCSV}
              disabled={hotels.length === 0}
              className="inline-flex items-center px-4 py-2 border border-kasa-blue-300 text-kasa-blue-300 rounded-kasa font-medium hover:bg-kasa-neutral-warm focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-kasa-button-md"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              {selectedHotels.size > 0 ? `Export ${selectedHotels.size} Selected` : 'Export CSV'}
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-kasa-blue-300 text-white rounded-kasa font-medium hover:bg-[#144a70] focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] transition-colors min-h-kasa-button-md"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Add Hotel
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {hotels.length > 0 && (
          <div className="mb-4">
            <label className="text-sm font-medium text-kasa-black-500 mr-2">Show:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="inline-flex px-3 py-2 border border-kasa-neutral-medium rounded-kasa-sm text-sm focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] focus:border-kasa-blue-300 transition-colors h-kasa-button-md"
            >
              <option value="all">All Hotels</option>
              <option value="with_data">With Data</option>
              <option value="missing_data">Missing Data</option>
              <option value="low_scores">Low Scores (&lt;6.0)</option>
            </select>
            <span className="ml-4 text-sm text-gray-700">
              {filteredHotels.length} of {hotels.length} hotels
            </span>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedHotels.size > 0 && (
          <div className="mb-4 bg-blue-50 border border-kasa-blue-200 rounded-kasa p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-kasa-blue-300">
              {selectedHotels.size} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkRefresh}
                className="px-3 py-1.5 text-sm bg-white text-kasa-blue-300 border border-kasa-blue-200 rounded-kasa-sm hover:bg-kasa-neutral-warm transition-colors font-medium"
              >
                Refresh All
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 text-sm bg-white text-kasa-error border border-red-300 rounded-kasa-sm hover:bg-red-100 transition-colors font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedHotels(new Set())}
                className="px-3 py-1.5 text-sm text-kasa-neutral-dark hover:text-kasa-black-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-kasa-lg shadow overflow-hidden">
          {hotels.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No hotels
              </h3>
              <p className="mt-1 text-sm text-gray-700">
                Get started by adding your first hotel.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-kasa-blue-300 text-white rounded-kasa font-medium hover:bg-[#144a70] focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] transition-colors min-h-kasa-button-md"
                >
                  <svg
                    className="-ml-1 mr-2 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Add Hotel
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-kasa-neutral-medium">
                <thead className="bg-kasa-black-500">
                  <tr>
                    <th className="px-4 py-3 sticky top-0 bg-kasa-black-500 z-10">
                      <input
                        type="checkbox"
                        checked={selectedHotels.size === hotels.length && hotels.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-kasa-blue-300 focus:ring-kasa-blue-300 border-gray-300 rounded bg-white"
                      />
                    </th>
                    <SortableHeader column="name" label="Hotel" className="text-left" />
                    <SortableHeader column="city" label="City" className="text-left" />
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider sticky top-0 bg-kasa-black-500 z-10">
                      Website
                    </th>
                    <SortableHeader column="score" label="Overall Score" className="text-center" />
                    <SortableHeader column="status" label="Status" className="text-center" />
                    <SortableHeader column="updated" label="Last Updated" className="text-center" />
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-100 uppercase tracking-wider sticky top-0 bg-kasa-black-500 z-10">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-kasa-neutral-medium">
                  {sortedHotels.map((hotel, index) => {
                    const reviews = hotelReviews.get(hotel.id);
                    const platformCount = reviews?.platform_count ?? 0;
                    const hasData = platformCount > 0;
                    const isSelected = selectedHotels.has(hotel.id);

                    // Status indicator
                    let statusColor = 'gray';
                    let statusText = 'Pending';
                    let statusIcon = '○';
                    if (platformCount === 4) {
                      statusColor = 'green';
                      statusText = 'Complete';
                      statusIcon = '✓';
                    } else if (platformCount > 0) {
                      statusColor = 'yellow';
                      statusText = 'Partial';
                      statusIcon = '⚠';
                    }

                    return (
                      <tr
                        key={hotel.id}
                        className={`hover:bg-kasa-neutral-warm hover:shadow-sm transition-all ${
                          index % 2 === 0 ? 'bg-white' : 'bg-kasa-neutral-warm/30'
                        } ${!hasData ? 'opacity-60' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectHotel(hotel.id)}
                            className="h-4 w-4 text-kasa-blue-300 focus:ring-kasa-blue-300 border-kasa-neutral-medium rounded"
                          />
                        </td>

                        {/* Hotel Name with Icon */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <HotelAvatar
                              hotelName={hotel.name}
                              imageUrl={hotel.image_url}
                              size="md"
                            />
                            <Link
                              href={`/dashboard/hotels/${hotel.id}`}
                              className="text-sm font-medium text-kasa-black-500 hover:text-kasa-blue-300 transition-colors"
                            >
                              {hotel.name}
                            </Link>
                          </div>
                        </td>

                        {/* City */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-700">{hotel.city}</div>
                        </td>

                        {/* Website */}
                        <td className="px-4 py-4">
                          {hotel.website_url ? (
                            <a
                              href={hotel.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-kasa-blue-300 hover:text-kasa-blue-200 hover:underline truncate max-w-xs inline-block"
                              title={hotel.website_url}
                            >
                              {hotel.website_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        {/* Overall Score */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {reviews?.weighted_score ? (
                            <div className="flex flex-col items-center">
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-kasa-sm text-base font-bold border-2 ${
                                reviews.weighted_score >= 8.0
                                  ? "bg-green-50 text-kasa-success border-green-200"
                                  : reviews.weighted_score >= 6.0
                                  ? "bg-orange-50 text-kasa-warning border-orange-200"
                                  : "bg-red-50 text-kasa-error border-red-200"
                              }`}>
                                {reviews.weighted_score.toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-lg text-gray-400 font-medium">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              statusColor === 'green'
                                ? 'bg-green-50 text-kasa-success border-green-200'
                                : statusColor === 'yellow'
                                ? 'bg-orange-50 text-kasa-warning border-orange-200'
                                : 'bg-gray-50 text-gray-700 border-gray-300'
                            }`}>
                              <span>{statusIcon}</span>
                              <span>{statusText}</span>
                            </span>
                            <span className="text-xs text-gray-700">
                              {platformCount}/4 platforms
                            </span>
                          </div>
                        </td>

                        {/* Last Updated */}
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                          {reviews?.last_updated ? formatRelativeTime(reviews.last_updated) : '—'}
                        </td>

                        {/* Actions Dropdown */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {hasData ? (
                            <div className="relative inline-block text-left">
                              <button
                                onClick={() => setDropdownOpenId(dropdownOpenId === hotel.id ? null : hotel.id)}
                                className="text-gray-500 hover:text-gray-700 transition-colors"
                                title="More actions"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>

                              {dropdownOpenId === hotel.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setDropdownOpenId(null)}
                                  />
                                  <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-50">
                                    <div className="py-1 flex flex-col">
                                      <Link
                                        href={`/dashboard/hotels/${hotel.id}`}
                                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
                                        onClick={() => setDropdownOpenId(null)}
                                      >
                                        View Details
                                      </Link>
                                      <button
                                        onClick={() => {
                                          handleRefreshHotel(hotel);
                                          setDropdownOpenId(null);
                                        }}
                                        disabled={refreshingHotelId === hotel.id}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                                      >
                                        Refresh Data
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingHotel(hotel);
                                          setDropdownOpenId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDeleteHotel(hotel);
                                          setDropdownOpenId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRefreshHotel(hotel)}
                              disabled={refreshingHotelId === hotel.id}
                              className="inline-flex items-center px-3 py-1.5 text-xs bg-kasa-blue-300 text-white rounded-kasa-sm hover:bg-[#144a70] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              {refreshingHotelId === hotel.id ? 'Fetching...' : 'Fetch Reviews'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <AddHotelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onHotelAdded={handleHotelAdded}
      />

      <EditHotelModal
        isOpen={!!editingHotel}
        onClose={() => setEditingHotel(null)}
        hotel={editingHotel}
        onHotelUpdated={handleHotelUpdated}
      />

      <ImportCSVModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
