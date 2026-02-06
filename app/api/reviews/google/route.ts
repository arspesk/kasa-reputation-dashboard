import { NextRequest, NextResponse } from "next/server";

interface GoogleReviewRequest {
  hotelName: string;
  city: string;
}

interface SerpAPIResponse {
  search_metadata?: {
    status?: string;
  };
  local_results?: Array<{
    title?: string;
    rating?: number;
    reviews?: number;
    place_id?: string;
    thumbnail?: string;
    website?: string;
  }>;
  place_results?: {
    title?: string;
    rating?: number;
    reviews?: number;
    place_id?: string;
    thumbnail?: string;
    website?: string;
  };
  error?: string;
}

interface GoogleReviewResponse {
  success: boolean;
  data?: {
    rating: number; // Original 1-5 scale
    normalized_rating: number; // 0-10 scale
    review_count: number;
    place_id?: string;
    image_url?: string;
    website_url?: string;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GoogleReviewRequest = await request.json();
    const { hotelName, city } = body;

    // Validate input
    if (!hotelName || !city) {
      return NextResponse.json(
        {
          success: false,
          error: "Hotel name and city are required",
        } as GoogleReviewResponse,
        { status: 400 }
      );
    }

    // Get SerpAPI key from environment
    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "SerpAPI key not configured",
        } as GoogleReviewResponse,
        { status: 500 }
      );
    }

    // Build search query - add "hotel" to improve results
    const searchQuery = `${hotelName} hotel ${city}`;

    // Call SerpAPI Google Maps API
    const serpApiUrl = new URL("https://serpapi.com/search");
    serpApiUrl.searchParams.set("engine", "google_maps");
    serpApiUrl.searchParams.set("q", searchQuery);
    serpApiUrl.searchParams.set("type", "search");
    serpApiUrl.searchParams.set("api_key", serpApiKey);

    console.log(`Searching Google Maps for: ${searchQuery}`);
    console.log(`SerpAPI URL: ${serpApiUrl.toString().replace(serpApiKey, 'REDACTED')}`);

    const response = await fetch(serpApiUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
    }

    const data: SerpAPIResponse = await response.json();

    // Log the full response for debugging
    console.log("SerpAPI Response:", JSON.stringify(data, null, 2));

    // Check for API errors
    if (data.error) {
      return NextResponse.json(
        {
          success: false,
          error: `SerpAPI error: ${data.error}`,
        } as GoogleReviewResponse,
        { status: 500 }
      );
    }

    // Extract result - check place_results first (single object), then local_results (array)
    let result;
    if (data.place_results) {
      console.log("Using place_results data");
      result = data.place_results;
    } else if (data.local_results && data.local_results.length > 0) {
      console.log("Using local_results[0] data");
      result = data.local_results[0];
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `No results found for "${hotelName}" in ${city}. Try a different search term or check the hotel name.`,
          debug: {
            searchQuery,
            hasPlaceResults: !!data.place_results,
            hasLocalResults: !!data.local_results,
            localResultCount: data.local_results?.length || 0,
          }
        } as any,
        { status: 404 }
      );
    }

    // Extract rating and review count
    const rating = result.rating || 0;
    const reviewCount = result.reviews || 0;
    const placeId = result.place_id;
    const imageUrl = result.thumbnail;
    const websiteUrl = result.website;

    // Normalize rating from 1-5 scale to 0-10 scale
    const normalizedRating = rating * 2;

    console.log(`Found: ${result.title} - Rating: ${rating}/5 (${normalizedRating}/10), Reviews: ${reviewCount}`);

    return NextResponse.json({
      success: true,
      data: {
        rating,
        normalized_rating: normalizedRating,
        review_count: reviewCount,
        place_id: placeId,
        image_url: imageUrl,
        website_url: websiteUrl,
      },
    } as GoogleReviewResponse);

  } catch (error) {
    console.error("Error fetching Google reviews:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as GoogleReviewResponse,
      { status: 500 }
    );
  }
}
