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
