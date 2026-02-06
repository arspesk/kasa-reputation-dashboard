import { NextRequest, NextResponse } from "next/server";

interface BookingRequest {
  hotelName: string;
  city: string;
}

interface BookingResponse {
  success: boolean;
  data?: {
    rating: number; // 0-10 scale (Booking.com uses 0-10)
    normalized_rating: number; // Same as rating (already 0-10)
    review_count: number;
    url?: string;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BookingRequest = await request.json();
    const { hotelName, city } = body;

    // Validate input
    if (!hotelName || !city) {
      return NextResponse.json(
        {
          success: false,
          error: "Hotel name and city are required",
        } as BookingResponse,
        { status: 400 }
      );
    }

    // Get SerpAPI key
    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "SerpAPI key not configured",
        } as BookingResponse,
        { status: 500 }
      );
    }

    // Use SerpAPI to find Booking.com URL and extract rating from Google search snippet
    const searchQuery = `site:booking.com ${hotelName} ${city}`;
    console.log(`Searching for Booking.com rating via Google: ${searchQuery}`);

    const serpApiUrl = new URL("https://serpapi.com/search");
    serpApiUrl.searchParams.set("engine", "google");
    serpApiUrl.searchParams.set("q", searchQuery);
    serpApiUrl.searchParams.set("api_key", serpApiKey);

    const searchResponse = await fetch(serpApiUrl.toString());
    if (!searchResponse.ok) {
      throw new Error(`SerpAPI request failed: ${searchResponse.status}`);
    }

    const searchData: any = await searchResponse.json();
    console.log("SerpAPI search results:", JSON.stringify(searchData, null, 2));

    // Extract Booking.com URL and rating from first result
    const firstResult = searchData.organic_results?.[0];
    if (!firstResult || !firstResult.link) {
      return NextResponse.json(
        {
          success: false,
          error: `No Booking.com page found for "${hotelName}" in ${city}. The hotel may not be listed on Booking.com.`,
        } as BookingResponse,
        { status: 404 }
      );
    }

    const bookingUrl = firstResult.link;
    console.log(`Found Booking.com URL: ${bookingUrl}`);

    // Try to extract rating from rich snippet
    let rating = 0;
    let reviewCount = 0;

    // Check for rich_snippet data
    if (firstResult.rich_snippet) {
      const snippet = firstResult.rich_snippet;

      // Try top.detected_extensions (object with rating, reviews fields)
      if (snippet.top?.detected_extensions) {
        const extensions = snippet.top.detected_extensions;
        console.log("Found detected_extensions:", extensions);

        if (extensions.rating) {
          rating = parseFloat(extensions.rating);
        }
        if (extensions.reviews) {
          reviewCount = parseInt(extensions.reviews);
        }
      }

      // Also check extensions array (e.g., ["7.3/10(125)"])
      if (snippet.top?.extensions && Array.isArray(snippet.top.extensions)) {
        console.log("Found extensions array:", snippet.top.extensions);
        for (const ext of snippet.top.extensions) {
          // Match patterns like "7.3/10" or "7.3 out of 10"
          const ratingMatch = ext.match(/(\d+\.?\d*)\s*(?:\/|out of)\s*10/i);
          if (ratingMatch && !rating) {
            rating = parseFloat(ratingMatch[1]);
          }

          // Match review count patterns
          const reviewMatch = ext.match(/\((\d+)\)/);
          if (reviewMatch && !reviewCount) {
            reviewCount = parseInt(reviewMatch[1]);
          }
        }
      }

      // Try rating field directly
      if (snippet.rating && !rating) {
        rating = parseFloat(snippet.rating);
      }

      // Try reviews field directly
      if (snippet.reviews && !reviewCount) {
        reviewCount = parseInt(snippet.reviews);
      }
    }

    // Also check snippet text as fallback
    if (!rating && firstResult.snippet) {
      const snippetText = firstResult.snippet;
      console.log("Checking snippet text:", snippetText);

      const ratingMatch = snippetText.match(/(\d+\.?\d*)\s*(?:\/|out of)\s*10/i);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      }

      const reviewMatch = snippetText.match(/([\d,]+)\s*reviews?/i);
      if (reviewMatch) {
        reviewCount = parseInt(reviewMatch[1].replace(/,/g, ""));
      }
    }

    if (rating === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Found Booking.com page but could not extract rating from Google search results for "${hotelName}" in ${city}. The property may not have reviews yet.`,
        } as BookingResponse,
        { status: 404 }
      );
    }

    // Booking.com uses 0-10 scale, so no normalization needed
    const normalizedRating = rating;

    console.log(
      `Extracted from Google search: Rating: ${rating.toFixed(2)}/10, Reviews: ${reviewCount}`
    );

    return NextResponse.json({
      success: true,
      data: {
        rating: parseFloat(rating.toFixed(2)),
        normalized_rating: parseFloat(normalizedRating.toFixed(2)),
        review_count: reviewCount,
        url: bookingUrl,
      },
    } as BookingResponse);

  } catch (error) {
    console.error("Error fetching Booking.com reviews:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as BookingResponse,
      { status: 500 }
    );
  }
}
