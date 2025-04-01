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

  // Construct the target Google Maps API URL
  // event.path starts with /.netlify/functions/places-proxy/
  // We want to map /maps/api/place/... to the Google endpoint
  const googleMapsPath = event.path.replace('/.netlify/functions/places-proxy', '/maps/api');
  const targetUrl = `https://maps.googleapis.com${googleMapsPath}`;

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

  console.log(`Proxying request to: ${url.toString()}`); // Log for debugging

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("Google Maps API Error:", data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Google Maps API Error: ${data?.error_message || response.statusText}` }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    console.error("Proxy function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch data from Google Maps API." }),
    };
  }
};

export { handler };
