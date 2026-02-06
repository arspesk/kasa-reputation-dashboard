/**
 * TypeScript Type Definitions
 * Shared types for the Kasa Reputation Dashboard
 */

// Database types matching Supabase schema

export interface Hotel {
  id: string;
  user_id: string;
  name: string;
  city: string;
  website_url?: string;
  created_at: string;
}

export interface HotelGroup {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface HotelGroupMember {
  hotel_id: string;
  group_id: string;
}

export type ReviewPlatform = 'google' | 'tripadvisor' | 'expedia' | 'booking';

export interface ReviewSnapshot {
  id: string;
  hotel_id: string;
  platform: ReviewPlatform;
  rating: number; // normalized 0-10
  original_rating: number; // raw score from platform
  review_count: number;
  fetched_at: string;
}

// API response types

export interface ReviewData {
  platform: ReviewPlatform;
  rating: number;
  original_rating: number;
  review_count: number;
}

export interface HotelScore {
  hotel: Hotel;
  reviews: ReviewData[];
  weighted_score: number;
  last_updated: string;
}

// Form types

export interface HotelFormData {
  name: string;
  city: string;
  website_url?: string;
}

export interface GroupFormData {
  name: string;
}

// Extended types for group management UI

export interface GroupWithDetails extends HotelGroup {
  member_count: number;
  aggregate_score?: number;
  hotels?: Hotel[];
}

// HotelScoreCard component types

export interface ScoreData {
  platform: ReviewPlatform;
  rating: number;        // 0-10 normalized
  originalRating: number; // Original scale (1-5 or 0-10)
  reviewCount: number;
}

export interface HotelScoreCardProps {
  hotel: {
    name: string;
    city: string;
    id: string;
  };
  scores: ScoreData[];
  weightedScore: number;
  lastUpdated: string; // ISO timestamp
  onRefresh: () => Promise<void>;
  isLoading?: boolean; // Optional: can be derived from parent
}
