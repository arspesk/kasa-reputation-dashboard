import Papa from 'papaparse';
import { ReviewPlatform } from '@/types';

/**
 * Export hotel data structure
 */
export interface ExportHotelData {
  name: string;
  city: string;
  google?: { rating: number; reviewCount: number };
  tripadvisor?: { rating: number; reviewCount: number };
  booking?: { rating: number; reviewCount: number };
  expedia?: { rating: number; reviewCount: number };
  weightedScore?: number;
  lastUpdated?: string;
}

/**
 * Review snapshot structure for historical exports
 */
export interface ReviewSnapshot {
  platform: ReviewPlatform;
  rating: number;
  original_rating: number;
  review_count: number;
  fetched_at: string;
}

/**
 * Generate CSV data from hotel review records
 */
export function generateHotelCSV(data: ExportHotelData[]): string {
  const csvData = data.map(hotel => ({
    'Hotel Name': hotel.name,
    'City': hotel.city,
    'Google Rating': formatRating(hotel.google?.rating),
    'Google Reviews': formatReviewCount(hotel.google?.reviewCount),
    'TripAdvisor Rating': formatRating(hotel.tripadvisor?.rating),
    'TripAdvisor Reviews': formatReviewCount(hotel.tripadvisor?.reviewCount),
    'Booking Rating': formatRating(hotel.booking?.rating),
    'Booking Reviews': formatReviewCount(hotel.booking?.reviewCount),
    'Expedia Rating': formatRating(hotel.expedia?.rating),
    'Expedia Reviews': formatReviewCount(hotel.expedia?.reviewCount),
    'Weighted Score': formatRating(hotel.weightedScore),
    'Last Updated': formatDate(hotel.lastUpdated)
  }));

  return Papa.unparse(csvData, {
    quotes: true,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    header: true,
    newline: '\r\n',
    skipEmptyLines: false
  });
}

/**
 * Generate CSV with historical snapshots (one row per snapshot)
 */
export function generateHistoricalCSV(
  hotelName: string,
  hotelCity: string,
  snapshots: ReviewSnapshot[]
): string {
  const csvData = snapshots.map(snapshot => ({
    'Hotel Name': hotelName,
    'City': hotelCity,
    'Date': formatDate(snapshot.fetched_at),
    'Platform': getPlatformName(snapshot.platform),
    'Rating (0-10)': snapshot.rating.toFixed(1),
    'Original Rating': snapshot.original_rating.toFixed(1),
    'Review Count': snapshot.review_count.toString()
  }));

  return Papa.unparse(csvData, {
    quotes: true,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    header: true,
    newline: '\r\n',
    skipEmptyLines: false
  });
}

/**
 * Generate CSV with historical group data
 *
 * Exports all review snapshots for all hotels in a group within a date range.
 * Each row represents a hotel-date-platform combination. Includes aggregate
 * rows for each unique date showing the group's overall performance.
 *
 * Format: Group Name, Hotel Name, City, Date, Platform, Rating (0-10), Original Rating, Review Count
 *
 * @param groupName - Name of the hotel group
 * @param hotels - Array of hotels in the group with id, name, and city
 * @param snapshots - All review snapshots to include in export
 * @returns CSV string with UTF-8 BOM for Excel compatibility
 *
 * @example
 * ```typescript
 * const csv = generateGroupHistoricalCSV(
 *   "Europe Collection",
 *   [
 *     { id: "hotel-1", name: "Hotel Paris", city: "Paris" },
 *     { id: "hotel-2", name: "Hotel Rome", city: "Rome" }
 *   ],
 *   snapshots
 * );
 * downloadCSV(csv, "group-history.csv");
 * ```
 */
export function generateGroupHistoricalCSV(
  groupName: string,
  hotels: Array<{ id: string; name: string; city: string }>,
  snapshots: Array<ReviewSnapshot & { hotel_id: string }>
): string {
  const rows: string[] = [];

  // Header
  rows.push(
    'Group Name,Hotel Name,City,Date,Platform,Rating (0-10),Original Rating,Review Count'
  );

  // Group snapshots by date
  const snapshotsByDate = new Map<string, Array<ReviewSnapshot & { hotel_id: string }>>();
  snapshots.forEach((s) => {
    const dateKey = new Date(s.fetched_at).toISOString().split('T')[0];
    if (!snapshotsByDate.has(dateKey)) {
      snapshotsByDate.set(dateKey, []);
    }
    snapshotsByDate.get(dateKey)!.push(s);
  });

  // Sort dates chronologically
  const sortedDates = Array.from(snapshotsByDate.keys()).sort();

  // For each date, output snapshots + aggregate row
  sortedDates.forEach((date) => {
    const dateSnapshots = snapshotsByDate.get(date)!;

    // Output individual hotel snapshots
    dateSnapshots.forEach((snapshot) => {
      const hotel = hotels.find((h) => h.id === snapshot.hotel_id);
      if (!hotel) return;

      rows.push(
        [
          escapeCsvField(groupName),
          escapeCsvField(hotel.name),
          escapeCsvField(hotel.city),
          date,
          getPlatformName(snapshot.platform),
          snapshot.rating.toFixed(1),
          snapshot.original_rating.toFixed(1),
          snapshot.review_count.toString(),
        ].join(',')
      );
    });

    // Calculate and output aggregate row for this date
    // Import calculateGroupAggregateForDate from api-helpers
    const totalWeight = dateSnapshots.reduce((sum, s) => sum + s.review_count, 0);
    if (totalWeight > 0) {
      const weightedSum = dateSnapshots.reduce(
        (sum, s) => sum + s.rating * s.review_count,
        0
      );
      const aggregateScore = Math.round((weightedSum / totalWeight) * 10) / 10;

      rows.push(
        [
          escapeCsvField(groupName),
          '[GROUP AGGREGATE]',
          '',
          date,
          'All Platforms',
          aggregateScore.toFixed(1),
          '',
          totalWeight.toString(),
        ].join(',')
      );
    }
  });

  return '\ufeff' + rows.join('\n');
}

/**
 * Escape CSV field for proper quoting
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Add UTF-8 BOM for Excel compatibility
  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Format rating for CSV (handles undefined/null)
 */
function formatRating(rating?: number): string {
  return rating !== undefined ? rating.toFixed(1) : '-';
}

/**
 * Format review count (handles undefined/null)
 */
function formatReviewCount(count?: number): string {
  return count !== undefined ? count.toString() : '-';
}

/**
 * Format ISO timestamp to readable date
 */
function formatDate(isoString?: string): string {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString();
}

/**
 * Get display name for platform
 */
function getPlatformName(platform: ReviewPlatform): string {
  const names: Record<ReviewPlatform, string> = {
    google: 'Google',
    tripadvisor: 'TripAdvisor',
    booking: 'Booking.com',
    expedia: 'Expedia'
  };
  return names[platform];
}

/**
 * Sanitize filename to remove unsafe characters
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9]/gi, '_');
}

/**
 * Generate filename with current date
 */
export function generateFilename(prefix: string, extension: string = 'csv'): string {
  const date = new Date().toISOString().split('T')[0];
  return `${sanitizeFilename(prefix)}-${date}.${extension}`;
}
