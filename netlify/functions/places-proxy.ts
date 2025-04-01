import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import fetch from 'node-fetch'; // Use node-fetch for making requests in Node.js environment

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Use the standard environment variable name (set in Netlify UI)
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  console.log("Function invoked. Trying to read GOOGLE_MAPS_API_KEY..."); // Log start

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

  // Forward existing query parameters from the original request
  if (event.queryStringParameters) {
    Object.entries(event.queryStringParameters).forEach(([key, value]) => {
      // Don't forward the key parameter if it was somehow passed by the client
      if (key !== 'key' && value) {
        url.searchParams.set(key, value);
      }
    });
  }

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
      let errorData;
      try {
        errorData = await response.json();
        console.error("Google Maps API Error (JSON):", errorData);
      } catch (e) {
        // If not JSON, read as text
        const errorText = await response.text();
        console.error("Google Maps API Error (Non-JSON):", errorText);
        errorData = { error_message: errorText || response.statusText };
      }
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Google Maps API Error: ${errorData?.error_message || response.statusText}` }),
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

  } catch (error: any) { // Add type 'any' to error
    console.error("Proxy function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch data from Google Maps API." }),
    };
  }
};

export { handler };
