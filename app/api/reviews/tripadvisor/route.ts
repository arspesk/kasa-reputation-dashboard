import { NextRequest, NextResponse } from "next/server";

interface TripAdvisorRequest {
  hotelName: string;
  city: string;
}

interface TripAdvisorResponse {
  success: boolean;
  data?: {
    rating: number; // Original 1-5 scale
    normalized_rating: number; // 0-10 scale
    review_count: number;
    url?: string;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TripAdvisorRequest = await request.json();
    const { hotelName, city } = body;

    // Validate input
    if (!hotelName || !city) {
      return NextResponse.json(
        {
          success: false,
          error: "Hotel name and city are required",
        } as TripAdvisorResponse,
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
        } as TripAdvisorResponse,
        { status: 500 }
      );
    }

    // Use SerpAPI to find TripAdvisor URL and extract rating from Google search snippet
    const searchQuery = `site:tripadvisor.com ${hotelName} ${city}`;
    console.log(`Searching for TripAdvisor rating via Google: ${searchQuery}`);

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

    // Extract TripAdvisor URL and rating from first result
    const firstResult = searchData.organic_results?.[0];
    if (!firstResult || !firstResult.link) {
      return NextResponse.json(
        {
          success: false,
          error: `No TripAdvisor page found for "${hotelName}" in ${city}. The hotel may not be listed on TripAdvisor.`,
        } as TripAdvisorResponse,
        { status: 404 }
      );
    }

    const tripadvisorUrl = firstResult.link;
    console.log(`Found TripAdvisor URL: ${tripadvisorUrl}`);

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

      // Also check extensions array (e.g., ["3.8(274)", "Price range: $$"])
      if (snippet.top?.extensions && Array.isArray(snippet.top.extensions)) {
        console.log("Found extensions array:", snippet.top.extensions);
        for (const ext of snippet.top.extensions) {
          // Match patterns like "3.8(274)"
          const combinedMatch = ext.match(/(\d+\.?\d*)\((\d+)\)/);
          if (combinedMatch) {
            if (!rating) rating = parseFloat(combinedMatch[1]);
            if (!reviewCount) reviewCount = parseInt(combinedMatch[2]);
          }

          // Match patterns like "3.8/5" or "3.8 out of 5"
          const ratingMatch = ext.match(/(\d+\.?\d*)\s*(?:\/|out of)\s*5/i);
          if (ratingMatch && !rating) {
            rating = parseFloat(ratingMatch[1]);
          }

          // Match review count patterns
          const reviewMatch = ext.match(/([\d,]+)\s*reviews?/i);
          if (reviewMatch && !reviewCount) {
            reviewCount = parseInt(reviewMatch[1].replace(/,/g, ""));
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

      const ratingMatch = snippetText.match(/(\d+\.?\d*)\s*(?:\/|out of)\s*5/i);
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
          error: `Found TripAdvisor page but could not extract rating from Google search results for "${hotelName}" in ${city}. The property may not have reviews yet.`,
        } as TripAdvisorResponse,
        { status: 404 }
      );
    }

    // TripAdvisor uses 1-5 scale, normalize to 0-10
    const normalizedRating = rating * 2;

    console.log(
      `Extracted from Google search: Rating: ${rating.toFixed(2)}/5 (${normalizedRating.toFixed(2)}/10), Reviews: ${reviewCount}`
    );

    return NextResponse.json({
      success: true,
      data: {
        rating: parseFloat(rating.toFixed(2)),
        normalized_rating: parseFloat(normalizedRating.toFixed(2)),
        review_count: reviewCount,
        url: tripadvisorUrl,
      },
    } as TripAdvisorResponse);

  } catch (error) {
    console.error("Error fetching TripAdvisor reviews:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as TripAdvisorResponse,
      { status: 500 }
    );
  }
}
