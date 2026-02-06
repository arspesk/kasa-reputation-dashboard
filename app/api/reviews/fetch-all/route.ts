import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateWeightedScore } from "@/lib/api-helpers";
import type { Hotel, ReviewPlatform, ReviewData } from "@/types";

interface FetchAllRequest {
  hotel_id: string;
}

interface PlatformResult {
  success: boolean;
  data?: ReviewData;
  error?: string;
}

interface FetchAllResponse {
  success: boolean;
  hotel?: Hotel;
  results?: {
    google: PlatformResult;
    tripadvisor: PlatformResult;
    booking: PlatformResult;
    expedia: PlatformResult;
  };
  saved_count?: number;
  weighted_score?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: FetchAllRequest = await request.json();
    const { hotel_id } = body;

    // Validate input
    if (!hotel_id) {
      return NextResponse.json(
        {
          success: false,
          error: "hotel_id is required",
        } as FetchAllResponse,
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        } as FetchAllResponse,
        { status: 401 }
      );
    }

    // Fetch hotel from database (RLS ensures user owns it)
    const { data: hotel, error: hotelError } = await supabase
      .from("hotels")
      .select("*")
      .eq("id", hotel_id)
      .single();

    if (hotelError || !hotel) {
      return NextResponse.json(
        {
          success: false,
          error: `Hotel not found: ${hotelError?.message || "Invalid hotel_id"}`,
        } as FetchAllResponse,
        { status: 404 }
      );
    }

    console.log(`Fetching reviews for hotel: ${hotel.name} (${hotel.city})`);

    // Construct base URL for internal API calls
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    // Define platforms and their endpoints
    const platforms: Array<{ name: ReviewPlatform; endpoint: string }> = [
      { name: "google", endpoint: "/api/reviews/google" },
      { name: "tripadvisor", endpoint: "/api/reviews/tripadvisor" },
      { name: "booking", endpoint: "/api/reviews/booking" },
      { name: "expedia", endpoint: "/api/reviews/expedia" },
    ];

    // Call all platform APIs in parallel
    const apiCalls = platforms.map(({ endpoint }) =>
      fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hotelName: hotel.name,
          city: hotel.city,
        }),
      })
    );

    console.log("Calling all platform APIs in parallel...");
    const results = await Promise.allSettled(apiCalls);

    // Process results and prepare data for database insertion
    const platformResults: Record<ReviewPlatform, PlatformResult> = {
      google: { success: false },
      tripadvisor: { success: false },
      booking: { success: false },
      expedia: { success: false },
    };

    const reviewSnapshots: Array<{
      hotel_id: string;
      platform: ReviewPlatform;
      rating: number;
      original_rating: number;
      review_count: number;
    }> = [];

    const successfulReviews: Array<{ rating: number; review_count: number }> = [];

    // Process each platform result
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const platform = platforms[i].name;

      if (result.status === "fulfilled") {
        try {
          if (result.value.ok) {
            const data = await result.value.json();

            if (data.success && data.data) {
              // Success - save platform result
              platformResults[platform] = {
                success: true,
                data: {
                  platform,
                  rating: data.data.normalized_rating,
                  original_rating: data.data.rating,
                  review_count: data.data.review_count,
                },
              };

              // Prepare for database insertion
              reviewSnapshots.push({
                hotel_id: hotel.id,
                platform,
                rating: data.data.normalized_rating, // Use normalized rating for DB
                original_rating: data.data.rating,
                review_count: data.data.review_count,
              });

              // Add to weighted score calculation
              successfulReviews.push({
                rating: data.data.normalized_rating,
                review_count: data.data.review_count,
              });

              console.log(
                `✓ ${platform}: ${data.data.rating} (${data.data.review_count} reviews)`
              );
            } else {
              // API returned but with error
              platformResults[platform] = {
                success: false,
                error: data.error || "Unknown error",
              };
              console.log(`✗ ${platform}: ${data.error || "Failed"}`);
            }
          } else {
            // HTTP error
            platformResults[platform] = {
              success: false,
              error: `HTTP ${result.value.status}`,
            };
            console.log(`✗ ${platform}: HTTP ${result.value.status}`);
          }
        } catch (parseError) {
          platformResults[platform] = {
            success: false,
            error: "Failed to parse response",
          };
          console.log(`✗ ${platform}: Parse error`);
        }
      } else {
        // Promise rejected
        platformResults[platform] = {
          success: false,
          error: result.reason?.message || "Request failed",
        };
        console.log(`✗ ${platform}: ${result.reason?.message || "Failed"}`);
      }
    }

    // Insert successful results into database
    let saved_count = 0;
    if (reviewSnapshots.length > 0) {
      const { data: insertedSnapshots, error: insertError } = await supabase
        .from("review_snapshots")
        .insert(reviewSnapshots)
        .select();

      if (insertError) {
        console.error("Error inserting review snapshots:", insertError);
        // Don't fail the entire request, just log the error
      } else {
        saved_count = insertedSnapshots?.length || 0;
        console.log(`✓ Saved ${saved_count} review snapshots to database`);
      }
    }

    // Calculate weighted score if we have at least one successful result
    let weighted_score: number | undefined;
    if (successfulReviews.length > 0) {
      weighted_score = calculateWeightedScore(successfulReviews);
      console.log(`✓ Weighted score: ${weighted_score}/10`);
    }

    // Return consolidated results
    return NextResponse.json({
      success: true,
      hotel,
      results: platformResults,
      saved_count,
      weighted_score,
    } as FetchAllResponse);

  } catch (error) {
    console.error("Error in fetch-all route:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as FetchAllResponse,
      { status: 500 }
    );
  }
}
