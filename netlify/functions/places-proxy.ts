import type { Handler, HandlerEvent } from "@netlify/functions"; // Removed unused HandlerContext
import fetch from 'node-fetch';

// Helper function to parse distance
const parseDistance = (query: string): { radius: number | null; cleanedQuery: string } => {
  // Regex to find patterns like "10km", "5 km", "15 miles", "2 mi" near the end or start
  const distanceRegex = /(?:^|\s)(\d+(\.\d+)?)\s?(km|kilometers|kilometer|miles|mile|mi)(?:\s|$)/i;
  const match = query.match(distanceRegex);

  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[3].toLowerCase();
    let radiusInMeters: number | null = null;

    if (unit.startsWith('km') || unit.startsWith('kilom')) {
      radiusInMeters = value * 1000;
    } else if (unit.startsWith('mi') || unit.startsWith('mile')) {
      radiusInMeters = value * 1609.34; // Convert miles to meters
    }

    if (radiusInMeters !== null) {
      // Remove the matched distance string from the query
      const cleanedQuery = query.replace(distanceRegex, ' ').trim();
      console.log(`Parsed distance: ${value} ${unit} -> ${radiusInMeters}m. Cleaned query: "${cleanedQuery}"`);
      return { radius: Math.round(radiusInMeters), cleanedQuery };
    }
  }

  // Default radius if no distance specified or parsed
  console.log(`No distance found in query: "${query}". Using default radius.`);
  return { radius: null, cleanedQuery: query }; // Return null radius to use default later or rely on API default
};


const handler: Handler = async (event: HandlerEvent) => { // Removed unused context
  // Use the standard environment variable name (set in Netlify UI)
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  console.log("Function invoked. Trying to read GOOGLE_MAPS_API_KEY...");

  if (!GOOGLE_MAPS_API_KEY) {
    console.error("GOOGLE_MAPS_API_KEY environment variable not found!"); // Log error
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Google Maps API Key is not configured on the server." }),
    };
  }

  // Construct the target Google Maps API URL more robustly
  // Remove the function path prefix to get the intended API path
  const functionPathPrefix = `/.netlify/functions/places-proxy`;
  let apiPath = event.path;
  if (apiPath.startsWith(functionPathPrefix)) {
    apiPath = apiPath.substring(functionPathPrefix.length); // e.g., /place/nearbysearch/json OR potentially /maps-api/place/...
  }
  // Explicitly remove potential leading /maps-api/ if present due to unexpected event.path structure
  if (apiPath.startsWith('/maps-api/')) {
      console.warn("Removing unexpected '/maps-api/' prefix from apiPath");
      apiPath = apiPath.substring('/maps-api'.length); // Should leave /place/...
  }

  // Construct the final target URL
  const targetUrl = `https://maps.googleapis.com/maps/api${apiPath}`;

  // Append the API key and any existing query parameters
  const url = new URL(targetUrl);
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  // --- Distance Parsing and Query Parameter Handling ---
  let radius: number | null = null;
  let cleanedQuery: string | undefined = event.queryStringParameters?.query;

  if (cleanedQuery) {
    const distanceResult = parseDistance(cleanedQuery);
    radius = distanceResult.radius;
    cleanedQuery = distanceResult.cleanedQuery;
  }

  // Forward query parameters, applying parsed distance/query
  if (event.queryStringParameters) {
    Object.entries(event.queryStringParameters).forEach(([key, value]) => {
      if (key === 'query' && cleanedQuery !== undefined) {
        // Use the cleaned query if distance was parsed
        if (cleanedQuery.trim()) { // Only set query if it's not empty after cleaning
           url.searchParams.set(key, cleanedQuery);
        } else {
           // If cleaning removed everything, maybe remove the query param?
           // Or let Google handle an empty query if that makes sense.
           // For now, let's not set it if it became empty.
           console.log("Query became empty after distance removal, not setting 'query' param.");
        }
      } else if (key === 'radius' && radius !== null) {
        // Use parsed radius, overriding any client-sent radius
        url.searchParams.set(key, radius.toString());
      } else if (key !== 'key' && value) {
        // Forward other parameters, excluding API key
        url.searchParams.set(key, value);
      }
    });
  }

  // Ensure radius is set if not parsed from query or provided by client
  if (!url.searchParams.has('radius')) {
      const defaultRadius = 10000; // Default 10km
      console.log(`Setting default radius: ${defaultRadius}m`);
      url.searchParams.set('radius', defaultRadius.toString());
  }
  // --- End Distance Handling ---


  console.log(`Proxying request to: ${url.toString()}`);

  try {
    // Check if it's a photo request
    const isPhotoRequest = apiPath.startsWith('/place/photo');

    const response = await fetch(url.toString(), {
      // Important: Do not follow redirects automatically for photo requests,
      // as we want the final image URL which might be in the Location header.
      // However, node-fetch v2 follows redirects by default. Let's fetch normally
      // and check the final response URL. If it's not JSON, return the URL.
      redirect: 'follow' // Keep default follow for simplicity for now
    });

    if (!response.ok) {
      // Try parsing error as JSON first
      let errorData: unknown; // Use unknown instead of any
      try {
        errorData = await response.json();
        console.error("Google Maps API Error (JSON):", errorData);
      } catch (parseError) { // Give the catch variable a name
        // If not JSON, read as text
        const errorText = await response.text();
        console.error("Google Maps API Error (Non-JSON):", errorText, "Parse Error:", parseError);
        errorData = { error_message: errorText || response.statusText };
      }
      // Type guard to safely access properties on unknown
      const errorMessage = (typeof errorData === 'object' && errorData !== null && 'error_message' in errorData)
        ? (errorData as { error_message: string }).error_message
        : response.statusText;

      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Google Maps API Error: ${errorMessage}` }),
      };
    }

    // If it was a photo request and the response looks like an image URL (from redirect)
    // or if the content type suggests an image, return the final URL.
    // Google Photos API redirects to the actual image URL.
    if (isPhotoRequest) {
       // The final URL after redirects is in response.url with node-fetch v2
       console.log("Photo request successful, returning final URL:", response.url);
       return {
         statusCode: 200,
         body: JSON.stringify({ imageUrl: response.url }), // Send back the final image URL as JSON
         headers: { 'Content-Type': 'application/json' },
       };
    } else {
      // Otherwise, parse and return as JSON (for nearbysearch, textsearch, etc.)
      const data = await response.json();
      return {
        statusCode: 200,
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      };
    }

  } catch (error) { // Remove explicit 'any' type, let TS infer or use 'unknown'
    console.error("Proxy function error:", error);
    const message = error instanceof Error ? error.message : "Unknown proxy error";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to fetch data from Google Maps API. ${message}` }), // Include error message
    };
  }
};

export { handler };
