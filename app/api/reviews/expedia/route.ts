import { NextRequest, NextResponse } from "next/server";

interface ExpediaRequest {
  hotelName: string;
  city: string;
}

interface ExpediaResponse {
  success: boolean;
  data?: {
    rating: number; // Could be 1-5 or 0-10 scale depending on source
    normalized_rating: number; // 0-10 scale
    review_count: number;
    url?: string;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExpediaRequest = await request.json();
    const { hotelName, city } = body;

    // Validate input
    if (!hotelName || !city) {
      return NextResponse.json(
        {
          success: false,
          error: "Hotel name and city are required",
        } as ExpediaResponse,
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
        } as ExpediaResponse,
        { status: 500 }
      );
    }

    // Use SerpAPI to find Expedia URL and extract rating from Google search snippet
    const searchQuery = `site:expedia.com ${hotelName} ${city}`;
    console.log(`Searching for Expedia rating via Google: ${searchQuery}`);

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

    // Extract Expedia URL and rating from first result
    const firstResult = searchData.organic_results?.[0];
    if (!firstResult || !firstResult.link) {
      return NextResponse.json(
        {
          success: false,
          error: `No Expedia page found for "${hotelName}" in ${city}. The hotel may not be listed on Expedia.`,
        } as ExpediaResponse,
        { status: 404 }
      );
    }

    const expediaUrl = firstResult.link;
    console.log(`Found Expedia URL: ${expediaUrl}`);

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

        // detected_extensions is an object, not an array
        if (extensions.rating) {
          rating = parseFloat(extensions.rating);
        }
        if (extensions.reviews) {
          reviewCount = parseInt(extensions.reviews);
        }
      }

      // Also check extensions array (e.g., ["4.5(160)", "Price range: $"])
      if (snippet.top?.extensions && Array.isArray(snippet.top.extensions)) {
        console.log("Found extensions array:", snippet.top.extensions);
        for (const ext of snippet.top.extensions) {
          // Match patterns like "4.5/5" or "4.5 out of 5"
          const ratingMatch = ext.match(/(\d+\.?\d*)\s*(?:\/|out of)\s*5/i);
          if (ratingMatch && !rating) {
            rating = parseFloat(ratingMatch[1]);
          }

          // Match review count patterns like "1,234 reviews" or "1234 reviews"
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
          error: `Found Expedia page but could not extract rating from Google search results for "${hotelName}" in ${city}. The property may not have reviews yet.`,
        } as ExpediaResponse,
        { status: 404 }
      );
    }

    // Determine scale and normalize
    // Expedia uses 0-10 scale, but Google might show it on different scales
    // If rating is > 5, assume it's already on 0-10 scale
    // If rating is <= 5, assume it's on 1-5 scale and needs conversion
    let normalizedRating: number;
    let displayRating: number;

    if (rating > 5) {
      // Already on 0-10 scale (or 0-100 scale divided by 10)
      normalizedRating = rating > 10 ? rating / 10 : rating;
      displayRating = normalizedRating;
      console.log(
        `Extracted from Google search (0-10 scale): Rating: ${displayRating.toFixed(2)}/10, Reviews: ${reviewCount}`
      );
    } else {
      // On 1-5 scale, convert to 0-10
      displayRating = rating;
      normalizedRating = rating * 2;
      console.log(
        `Extracted from Google search (1-5 scale): Rating: ${displayRating.toFixed(2)}/5 (${normalizedRating.toFixed(2)}/10), Reviews: ${reviewCount}`
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        rating: parseFloat(displayRating.toFixed(2)),
        normalized_rating: parseFloat(normalizedRating.toFixed(2)),
        review_count: reviewCount,
        url: expediaUrl,
      },
    } as ExpediaResponse);

  } catch (error) {
    console.error("Error fetching Expedia reviews:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as ExpediaResponse,
      { status: 500 }
    );
  }
}
