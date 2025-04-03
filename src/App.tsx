import { useState, useEffect, FormEvent, useCallback } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster, toast } from 'react-hot-toast';
// Import corrected types
import type { CoffeeShop, OpeningHours, OpeningHoursPeriod } from './lib/types';
// import { supabase } from './lib/supabaseClient';
// import { mockFavorites } from './lib/mockData';
import Header from './components/Header';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Initialize Gemini AI Client
const apiKeyGemini = import.meta.env.VITE_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;
if (apiKeyGemini) {
  genAI = new GoogleGenerativeAI(apiKeyGemini);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25"});
} else {
  console.error("Gemini API Key is missing!");
}

// Google Places API Types (Simplified)
interface PlaceResult {
  place_id: string; name: string; geometry: { location: { lat: number; lng: number; }; }; vicinity: string; rating?: number;
}
interface PlaceDetailsResult {
  place_id: string; name?: string; formatted_address?: string; geometry?: { location: { lat: number; lng: number; }; }; rating?: number; opening_hours?: OpeningHours; // Use imported type
}
interface PlacesNearbyResponse { results: PlaceResult[]; status: string; error_message?: string; next_page_token?: string; }
interface PlaceDetailsResponse { result?: PlaceDetailsResult; status: string; error_message?: string; }

// AI Response Types - Added openNow
interface AiFilters { openAfter?: string; wifi?: boolean; openNow?: boolean; }
type AiResponse = | { related: true; keywords: string; count: number | null; filters: AiFilters | null } | { related: false; message: string; suggestion?: string }; // Added optional suggestion

// --- Helper Function for Filtering ---
const filterShopsByCriteria = (shops: CoffeeShop[], filters: AiFilters): CoffeeShop[] => {
  // No filters? Return all shops.
  if (!filters || Object.keys(filters).length === 0) {
    return shops;
  }

  return shops.filter(shop => {
    // Check openNow filter (only if requested and details were fetched)
    // Note: If useOpenNowParam was true in handleKeywordSearch, the API already filtered.
    // This client-side check is for when details had to be fetched for other reasons (like openAfter).
    if (filters.openNow === true) {
      // Requires opening_hours and open_now to be explicitly true from Details API
      if (shop.opening_hours?.open_now !== true) {
        return false; // Doesn't match if not explicitly open now according to details
      }
    }

    // Check openAfter filter (always requires details fetch)
    if (filters.openAfter) {
      if (!shop.opening_hours || !Array.isArray(shop.opening_hours.periods) || shop.opening_hours.periods.length === 0) {
        return false; // Cannot determine opening times
      } else {
         const [filterHour, filterMinute] = filters.openAfter.split(':').map(Number);
         if (isNaN(filterHour) || isNaN(filterMinute)) {
            console.warn(`Invalid openAfter time format: ${filters.openAfter}`);
            return false; // Corrected: Exit early if format is invalid
         } else {
             const filterTimeMinutes = filterHour * 60 + filterMinute;
            // Add explicit type for period
            const isOpenLateEnough = shop.opening_hours.periods.some((period: OpeningHoursPeriod) => {
               if (period?.close?.time && /^\d{4}$/.test(period.close.time)) {
                 const closeHour = parseInt(period.close.time.substring(0, 2), 10);
                 const closeMinute = parseInt(period.close.time.substring(2, 4), 10);
                 let closeTimeMinutes = closeHour * 60 + closeMinute;
                 if (period.open?.day !== undefined && period.close.day !== undefined && (period.close.day > period.open.day || (period.close.day === 0 && period.open.day === 6))) {
                    closeTimeMinutes += 24 * 60;
                 }
                 return closeTimeMinutes >= filterTimeMinutes;
               }
               if (!period.close && period.open?.time === '0000') return true; // 24/7 case
               return false;
            });
            if (!isOpenLateEnough) return false; // Doesn't match if not open late enough
        }
      }
    }

    // Check wifi filter (requires details fetch and a field we haven't added yet)
    if (filters.wifi === true) {
       // TODO: Implement wifi check if/when wifi data is fetched and stored in CoffeeShop type
       // Example: if (shop.wifi_available !== true) return false;
       console.warn("Wifi filtering requested but not implemented yet.");
       // For now, let's assume it doesn't match if wifi is requested but not implemented
       // return false;
    }

    // If we passed all checks, keep the shop
    return true;
  });
};


function App() {
  const [selectedLocation, setSelectedLocation] = useState<CoffeeShop | null>(null);
  const [coffeeShops, setCoffeeShops] = useState<CoffeeShop[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For initial load / major searches
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [mapCenter] = useState({ lat: 24.1477, lng: 120.6736 });
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false); // Specifically for AI interaction
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null); // User's current location

  // Function to request user's location
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    const loadingToast = toast.loading("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        toast.success("Location found!", { id: loadingToast });
        // Optionally trigger a search based on the new location here
        // handleKeywordSearch(`coffee near me`, null, null, undefined, { lat: latitude, lng: longitude });
      },
      (error) => {
        console.error("Geolocation error:", error);
        let message = "Failed to get location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied. Please enable it in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            message = "Location request timed out.";
            break;
        }
        toast.error(message, { id: loadingToast });
        setUserLocation(null); // Ensure location is null on error
      },
      {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 0 // Force fresh location
      }
    );
  }, []); // Empty dependency array as it uses browser API and toast

  // Effect for initial data load
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const lat = mapCenter.lat; const lng = mapCenter.lng; const radius = 5000; const type = 'cafe';
        const apiUrl = `/maps-api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}`;
        try {
          const response = await fetch(apiUrl);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data: PlacesNearbyResponse = await response.json();
          if (data.status === 'OK') {
            const fetchedShops: CoffeeShop[] = data.results.map(place => ({
              id: place.place_id, name: place.name, lat: place.geometry.location.lat, lng: place.geometry.location.lng,
              address: place.vicinity, rating: place.rating, opening_hours: undefined, price_range: undefined,
              wifi_available: undefined, pet_friendly: undefined, description: undefined, menu_highlights: [],
            }));
            setCoffeeShops(fetchedShops);
          } else {
             toast.error(data.status === 'ZERO_RESULTS' ? 'No coffee shops found nearby.' : `Places API Error: ${data.error_message || data.status}`);
             setCoffeeShops([]);
          }
        } catch (error) {
          console.error('Failed to fetch initial coffee shops:', error);
          toast.error('Failed to load coffee shop data.'); setCoffeeShops([]);
        }
      } else {
         toast.error("Google Maps API Key is missing!");
      }
      // Load favorites regardless of maps API status
      const savedFavorites = localStorage.getItem('coffeeLoverFavorites');
      if (savedFavorites) {
        try {
          const favoriteIdsArray = JSON.parse(savedFavorites);
          setFavoriteIds(Array.isArray(favoriteIdsArray) ? new Set(favoriteIdsArray) : new Set());
        } catch (e) { console.error("Failed to parse favorites", e); setFavoriteIds(new Set()); }
      } else { setFavoriteIds(new Set()); }
      setIsLoading(false);
    };
    fetchInitialData();
  }, [mapCenter]);

  // Effect to save favorites
  useEffect(() => {
    localStorage.setItem('coffeeLoverFavorites', JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds]);

  // Handler for AI Prompt Submit
  const handlePromptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
       toast.error("Please enter what you're looking for.");
       return;
    }
    if (!model) {
      toast.error("AI assistant is not available right now.");
      return;
    }

    setIsGenerating(true);
    let loadingToastId: string | undefined = undefined;
    let aiResponseRelated = false; // Track if AI response was related

    try {
      const allowedLocations = "Taiwan, USA, Japan, Korea, Singapore, Hong Kong, Canada, or London (UK)";
      // Updated prompt to include openNow and suggestions
      const structuredPrompt = `Analyze the user request: "${prompt}".
Is it about finding coffee shops/cafes in ${allowedLocations}?
Respond ONLY with JSON that strictly follows one of these formats:
1. If related: {"related": true, "keywords": "...", "count": num|null, "filters": {"openAfter": "HH:MM"|null, "wifi": bool|null, "openNow": bool|null}|null}
   - Extract relevant keywords (e.g., "quiet cafe Taipei", "coffee near Central Park"). Include location if mentioned.
   - If the user asks for places open "now", "currently", or similar, set "openNow": true.
   - If the user asks for places open after a specific time (e.g., "after 10pm", "late night"), extract the time as HH:MM (24h format) for "openAfter". Assume "late" means 21:00 if no specific time. "openNow" and "openAfter" can coexist if the request implies both (e.g., "open now and after 10pm").
   - Extract a specific number if requested (e.g., "find 3 cafes") for "count".
   - Extract boolean filter for "wifi" if mentioned.
2. If unrelated or too ambiguous: {"related": false, "message": "...", "suggestion": "..."|null}
   - If unrelated to coffee shops in allowed locations, use message: "I can only help with coffee shops in ${allowedLocations}."
   - If it seems coffee-related but is too vague (e.g., "good coffee"), use message: "Could you be more specific? e.g., 'cafes near me with wifi', 'quiet coffee shop in downtown'." and optionally add a suggestion like "Maybe try searching for 'coffee shops near me'?"
   - If it's coffee-related but asks for something impossible (e.g., specific bean type), use message: "I can search by location, opening hours, and wifi, but not specific bean types yet." and optionally suggest a broader search.`;


      console.log("Sending prompt to AI:", structuredPrompt);
      loadingToastId = toast.loading("Asking AI assistant...");

      const result = await model.generateContent(structuredPrompt);
      const response = await result.response;
      const rawJsonResponse = response.text().trim();
      console.log("Raw AI response:", rawJsonResponse);

      let parsedResponse: AiResponse | null = null;
      try {
        const jsonMatch = rawJsonResponse.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
        if (!jsonMatch) throw new Error("No valid JSON found in AI response.");
        const jsonString = jsonMatch[1] || jsonMatch[2];
        const tempParsed = JSON.parse(jsonString);

        // Validate structure more thoroughly
        if (tempParsed.related === true) {
            if (typeof tempParsed.keywords !== 'string' || !tempParsed.keywords.trim()) throw new Error("Missing or empty 'keywords'.");
            if (tempParsed.count !== null && typeof tempParsed.count !== 'number') throw new Error("Invalid 'count' format.");
            if (tempParsed.filters !== null && typeof tempParsed.filters !== 'object') throw new Error("Invalid 'filters' format.");
            if (tempParsed.filters) {
                if (tempParsed.filters.openAfter && (typeof tempParsed.filters.openAfter !== 'string' || !/^\d{2}:\d{2}$/.test(tempParsed.filters.openAfter))) throw new Error("Invalid 'openAfter' format.");
                if (tempParsed.filters.wifi !== null && typeof tempParsed.filters.wifi !== 'boolean') throw new Error("Invalid 'wifi' format.");
                if (tempParsed.filters.openNow !== null && typeof tempParsed.filters.openNow !== 'boolean') throw new Error("Invalid 'openNow' format.");
            }
            parsedResponse = tempParsed as AiResponse;
        } else if (tempParsed.related === false) {
            if (typeof tempParsed.message !== 'string' || !tempParsed.message.trim()) throw new Error("Missing or empty 'message' for unrelated response.");
            if (tempParsed.suggestion !== undefined && tempParsed.suggestion !== null && typeof tempParsed.suggestion !== 'string') throw new Error("Invalid 'suggestion' format.");
             // Ensure message contains expected text for location restriction
             if (!tempParsed.message.includes("I can only help with") && !tempParsed.message.includes("Could you be more specific?") && !tempParsed.message.includes("I can search by location")) {
                throw new Error("Unrelated message content is unexpected.");
             }
            parsedResponse = tempParsed as AiResponse;
        } else {
            throw new Error("Invalid JSON structure: 'related' field missing or invalid.");
        }
      } catch (parseError) {
        console.error("AI response parsing/validation failed:", parseError, "Raw:", rawJsonResponse);
        toast.error("Received an unexpected or invalid response from the AI.", { id: loadingToastId });
        setIsGenerating(false);
        return;
      }

      // Process valid response
      if (parsedResponse.related === true) {
        aiResponseRelated = true; // Mark as related to handle finally block correctly
        const { keywords, count, filters } = parsedResponse;
        // Keywords should be validated already, but double-check trim
        if (keywords.trim()) {
          let searchMessage = `Searching for ${keywords.trim()}`;
          if (filters?.openNow) searchMessage += " (open now)";
          if (filters?.openAfter) searchMessage += ` (open after ${filters.openAfter})`;
          if (filters?.wifi) searchMessage += " (with wifi)";
          if (count) searchMessage += ` (limit ${count})`;

          toast.loading(searchMessage, { id: loadingToastId });
          await handleKeywordSearch(keywords.trim(), count, filters, loadingToastId); // Pass toast ID
        } else {
          // This case should ideally be caught by validation, but handle defensively
          toast.error("AI didn't provide valid keywords.", { id: loadingToastId });
          setIsGenerating(false);
        }
      } else {
        // Handle unrelated/ambiguous cases
        const { message, suggestion } = parsedResponse;
        console.log("AI determined query unrelated/ambiguous:", message, suggestion);
        // Show the primary message from AI
        toast.error(message, { id: loadingToastId, duration: 5000 }); // Longer duration for reading
        // If there's a suggestion, maybe offer it in a different way?
        // For now, just logging it. Could potentially add a button or follow-up prompt.
        if (suggestion) {
            console.log("AI Suggestion:", suggestion);
            // Example: Could show another toast or modify UI
            // toast.info(`Suggestion: ${suggestion}`, { duration: 6000 });
        }
        // No search started, so set generating false in finally
      }

    } catch (error: unknown) {
      console.error("Error calling Gemini API:", error);
      const message = error instanceof Error ? error.message : "Unknown AI error";
      toast.error(`AI Error: ${message}`, { id: loadingToastId });
      // Error occurred before or during AI call, ensure loading stops
      setIsGenerating(false);
    } finally {
       // Set generating false ONLY if the process finished here (unrelated query or AI error before search)
       // If a related query started the search, handleKeywordSearch will set it false.
       if (!aiResponseRelated) {
           setIsGenerating(false);
       }
    }
  };

  // Handler for keyword search (now accepts optional location override)
  const handleKeywordSearch = async (
    keyword: string,
    requestedCount: number | null = null,
    filters: AiFilters | null = null,
    loadingToastId?: string,
    locationOverride?: { lat: number; lng: number } // Optional location
  ) => {
    setIsLoading(true); // Use main loading overlay for search process
    setCoffeeShops([]);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      toast.error("Google Maps API Key is missing!", { id: loadingToastId });
      setIsLoading(false); setIsGenerating(false); return;
    }

    let candidateShops: PlaceResult[] = [];
    // Determine location to use: override > userLocation > mapCenter
    const searchLocation = locationOverride ?? userLocation ?? mapCenter;
    // Determine if we can use the efficient 'opennow' parameter
    const useOpenNowParam = filters?.openNow === true && !filters.openAfter && !filters.wifi; // Only use if 'openNow' is the sole filter

    try {
      // Step 1: Initial Search (NearbySearch might be better for simple "near me" + openNow)
      let searchApiUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${searchLocation.lat},${searchLocation.lng}&radius=10000`;
      if (useOpenNowParam) {
         searchApiUrl += '&opennow=true';
         console.log("Using opennow=true parameter in Text Search");
      }
      // TODO: Consider using Nearby Search API if keywords are simple like "cafe" or "coffee shop" + openNow filter for potentially better relevance?
      // Example: if (keyword.toLowerCase().includes('near me') && useOpenNowParam) { searchApiUrl = `/maps-api/place/nearbysearch/json?location=...&rankby=distance&keyword=cafe&opennow=true`; }

      const response = await fetch(searchApiUrl);
      if (!response.ok) throw new Error(`Search API HTTP error! status: ${response.status}`);
      const data: PlacesNearbyResponse = await response.json();
      if (data.status === 'OK') { candidateShops = data.results; }
      else if (data.status === 'ZERO_RESULTS') {
        toast.success(`No initial results found for "${keyword}".`, { id: loadingToastId });
        setIsLoading(false); setIsGenerating(false); return;
      } else { throw new Error(`Places API Error: ${data.status} - ${data.error_message || ''}`); }
    } catch (error) {
      console.error('Initial text search failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown search error';
      toast.error(`Initial search error: ${message}`, { id: loadingToastId });
      setIsLoading(false); setIsGenerating(false); return;
    }

    // Step 2 & 3: Fetch Details & Filter
    let detailedShops: CoffeeShop[] = [];
    // Determine if we *still* need to fetch details (e.g., for openAfter, wifi, or if openNow wasn't the only filter)
    const needsDetailsFetch = filters && (!!filters.openAfter || !!filters.wifi || (filters.openNow && !useOpenNowParam));

    try {
        if (needsDetailsFetch) {
           toast.loading('Fetching details for filtering...', { id: loadingToastId });
           const detailPromises = candidateShops.map(async (candidate) => {
             // Ensure opening_hours is requested if openAfter or openNow filtering is needed client-side
             const fields = `place_id,name,geometry,vicinity,rating,formatted_address${(filters.openAfter || (filters.openNow && !useOpenNowParam)) ? ',opening_hours' : ''}`;
             const detailsApiUrl = `/maps-api/place/details/json?placeid=${candidate.place_id}&fields=${fields}`;
             try {
               const detailsResponse = await fetch(detailsApiUrl);
               if (!detailsResponse.ok) return null;
               const detailsData: PlaceDetailsResponse = await detailsResponse.json();
               if (detailsData.status === 'OK' && detailsData.result) {
                 return { // Map to CoffeeShop type
                   id: candidate.place_id,
                   name: detailsData.result.name || candidate.name,
                   lat: detailsData.result.geometry?.location.lat || candidate.geometry.location.lat,
                   lng: detailsData.result.geometry?.location.lng || candidate.geometry.location.lng,
                   address: detailsData.result.formatted_address || candidate.vicinity,
                   rating: detailsData.result.rating || candidate.rating,
                   opening_hours: detailsData.result.opening_hours,
                   // Initialize others
                   price_range: undefined, wifi_available: undefined, pet_friendly: undefined,
                   description: undefined, menu_highlights: [],
                 } as CoffeeShop;
               } return null;
             } catch (detailsError) { console.error(`Details fetch error for ${candidate.place_id}:`, detailsError); return null; }
           });
           const results = await Promise.all(detailPromises);
           const validDetailedShops = results.filter((shop): shop is CoffeeShop => shop !== null);
           // Apply client-side filtering if needed (openAfter, wifi, or openNow if not handled by API)
           detailedShops = filterShopsByCriteria(validDetailedShops, filters);
           const filterDesc = filters.openAfter ? ` open after ${filters.openAfter}` : (filters.openNow ? " open now" : "");
           toast.success(`Found ${detailedShops.length} shop(s) matching criteria${filterDesc}.`, { id: loadingToastId });
        } else {
          // No details fetch needed, map basic data directly from initial search results
          detailedShops = candidateShops.map(place => ({
            id: place.place_id, name: place.name, lat: place.geometry.location.lat, lng: place.geometry.location.lng,
            address: place.vicinity, rating: place.rating, opening_hours: undefined, price_range: undefined,
            wifi_available: undefined, pet_friendly: undefined, description: undefined, menu_highlights: [],
          }));
          if (loadingToastId) toast.success(`Found ${detailedShops.length} result(s).`, { id: loadingToastId });
        }

        // Step 4: Apply Count Limit
        const finalShops = requestedCount !== null ? detailedShops.slice(0, requestedCount) : detailedShops;

        // Step 5: Update State & UI
    setCoffeeShops(finalShops);

    // --- Refined Final User Messages ---
    // Dismiss the loading toast before showing the final status
    if (loadingToastId) toast.dismiss(loadingToastId);

    if (finalShops.length === 0) {
      // No results found, either initially or after filtering
      const reason = needsDetailsFetch ? "matching criteria" : "for your search"; // Use needsDetailsFetch
      toast.success(`No shops found ${reason}.`);
    } else if (requestedCount !== null) {
      // A specific count was requested
      if (finalShops.length < requestedCount) {
        // Fewer results shown than requested
        const reason = needsDetailsFetch // Use needsDetailsFetch
          ? `Only ${finalShops.length} shop(s) matched the criteria (requested ${requestedCount}).`
          : `Only found ${finalShops.length} result(s) for "${keyword}" (requested ${requestedCount}).`;
        toast.success(reason);
      } else {
        // Exact count requested was found and shown
        toast.success(`Displaying ${finalShops.length} shop(s) as requested.`);
      }
    } else {
      // No specific count requested, just show how many were found
      const afterFiltering = needsDetailsFetch ? " matching criteria" : ""; // Use needsDetailsFetch
      toast.success(`Displaying ${finalShops.length} shop(s)${afterFiltering}.`);
    }

    } catch (error) {
        // Catch errors during details fetching or filtering
        console.error('Error during details fetch/filter:', error);
        const message = error instanceof Error ? error.message : 'Unknown error processing results';
        toast.error(`Error processing results: ${message}`, { id: loadingToastId });
    } finally {
        setIsLoading(false); // Hide main loading overlay
        setIsGenerating(false); // Re-enable AI button
    }
  };

  // Handler for toggling favorite status
  const handleToggleFavorite = (shopId: string) => {
    const isCurrentlyFavorite = favoriteIds.has(shopId);
    setFavoriteIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isCurrentlyFavorite) { newIds.delete(shopId); toast.success('Removed from favorites'); }
      else { newIds.add(shopId); toast.success('Added to favorites'); }
      return newIds;
    });
  };

  // Handler for selecting a location
  const handleSelectLocation = (location: CoffeeShop) => {
    setSelectedLocation(location);
  };

  return (
    <>
      <div className="flex flex-col h-screen">
        {/* Pass location state and request function to Header */}
        <Header
          prompt={prompt}
          setPrompt={setPrompt}
          isGenerating={isGenerating}
          handlePromptSubmit={handlePromptSubmit}
          requestLocation={requestLocation}
          hasLocation={!!userLocation} // Pass boolean indicating if location is available
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar locations={coffeeShops} onSelectLocation={handleSelectLocation} className="hidden md:flex w-96 flex-col" />
          <div className="flex-1 relative">
            <Map locations={coffeeShops} onMarkerClick={handleSelectLocation} favoriteIds={favoriteIds} />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            )}
          </div>
        </div>
        {selectedLocation && (
          <LocationDetails location={selectedLocation} isFavorite={favoriteIds.has(selectedLocation.id)} onToggleFavorite={handleToggleFavorite} onClose={() => setSelectedLocation(null)} />
        )}
      </div>
      <Toaster />
    </>
  );
}

export default App;
